// Lease ownership guard for the process-story worker (Privacy Foundation
// 3C-7, worker lease safety hardening).
//
// The worker coordinates through story_requests.worker_id and
// worker_lease_expires_at: an invocation claims the row atomically, then
// heartbeats to keep its lease alive. Before this module every long stage
// re-checked ownership only at a few checkpoints, and several story
// writes (status transitions, scene rows, the generated story, cover
// references) ran without any ownership condition, so an invocation whose
// lease had been reclaimed could keep writing over the live worker.
//
// This module gives the worker ONE way to answer "do I still own this
// story?" and ONE way to write story_requests state that can only succeed
// while it does:
//
//   heartbeat()        conditional UPDATE … WHERE worker_id = me; false = lost
//   stillOwns()        SELECT worker_id; equality with me
//   require(where)     throws LeaseLostError when stillOwns() is false
//   renewOrThrow()     heartbeat() that throws LeaseLostError when lost
//   setStatus(...)     conditional status UPDATE; throws LeaseLostError when
//                      no row was written (the owner changed)
//
// LeaseLostError is distinct from every generation failure: the pipeline's
// catch block must treat it as "stop quietly, the current owner carries
// on", never as a failure of the story.
//
// No Deno or Supabase imports: the store is injected, so the same code is
// exercised by plain Node tests (lease.test.ts via
// `node --experimental-strip-types --test`) and by the Edge Function.

export const LEASE_LOST_PREFIX = 'LEASE_LOST:'

export class LeaseLostError extends Error {
  readonly where: string
  constructor(where: string) {
    super(`${LEASE_LOST_PREFIX} lease no longer held (${where}) — another worker owns this request`)
    this.name = 'LeaseLostError'
    this.where = where
  }
}

/** True for a LeaseLostError, or for its message carried through a plain Error. */
export function isLeaseLost(err: unknown): boolean {
  if (err instanceof LeaseLostError) return true
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return msg.startsWith(LEASE_LOST_PREFIX)
}

export interface OwnedWriteResult {
  /** True when exactly the owned row was written (the condition matched). */
  written: boolean
  /** Database error text when the statement itself failed; null otherwise. */
  error: string | null
}

/**
 * The two statements the guard needs, bound to one story and one worker.
 * Production binds them to the service-role client (see index.ts); tests
 * bind them to an in-memory row.
 */
export interface LeaseStore {
  /**
   * UPDATE story_requests SET <values> WHERE id = requestId AND worker_id = workerId
   * RETURNING id. Must never match a row owned by anyone else.
   */
  updateOwned(values: Record<string, unknown>): Promise<OwnedWriteResult>
  /** SELECT worker_id FROM story_requests WHERE id = requestId (null when absent). */
  readWorkerId(): Promise<string | null>
}

export interface LeaseGuard {
  /** Refresh heartbeat + lease (own worker only). Returns false when the lease is no longer ours or could not be confirmed. */
  heartbeat(leaseMs?: number): Promise<boolean>
  /** True while this worker's id is on the row. */
  stillOwns(): Promise<boolean>
  /** Throws LeaseLostError unless stillOwns(). `where` names the checkpoint for the log. */
  require(where: string): Promise<void>
  /** heartbeat() that throws LeaseLostError when the lease was lost. */
  renewOrThrow(where: string, leaseMs?: number): Promise<void>
  /**
   * Status transition that only the lease owner can apply. Throws
   * LeaseLostError when the conditional UPDATE wrote nothing for ownership
   * reasons; returns the error text when the statement itself failed.
   */
  setStatus(status: string, message: string, progress: number, extra?: Record<string, unknown>): Promise<{ error: string | null }>
}

export interface LeaseGuardOptions {
  workerId: string
  /** Default lease window stamped by heartbeat(). */
  leaseMs: number
  /** Injected clock for tests. */
  now?: () => number
}

export function createLeaseGuard(store: LeaseStore, opts: LeaseGuardOptions): LeaseGuard {
  const now = opts.now ?? (() => Date.now())
  let lastError: string | null = null

  async function heartbeat(leaseMs: number = opts.leaseMs): Promise<boolean> {
    const t = now()
    const { written, error } = await store.updateOwned({
      worker_heartbeat_at: new Date(t).toISOString(),
      worker_lease_expires_at: new Date(t + leaseMs).toISOString(),
    })
    // Fail closed: a heartbeat that could not be confirmed is treated as a
    // lost lease, so the worker stops before paying for the next long call.
    // The sweep re-dispatches the row once the lease window has passed.
    if (error) { lastError = error; return false }
    lastError = null
    return written
  }

  async function stillOwns(): Promise<boolean> {
    return (await store.readWorkerId()) === opts.workerId
  }

  async function require(where: string): Promise<void> {
    if (!(await stillOwns())) throw new LeaseLostError(where)
  }

  async function renewOrThrow(where: string, leaseMs?: number): Promise<void> {
    if (!(await heartbeat(leaseMs))) throw new LeaseLostError(lastError ? `${where}; heartbeat error: ${lastError}` : where)
  }

  async function setStatus(status: string, message: string, progress: number, extra: Record<string, unknown> = {}): Promise<{ error: string | null }> {
    const { written, error } = await store.updateOwned({ status, status_message: message, progress_pct: progress, ...extra })
    // A statement error (not an ownership miss) is reported, not thrown:
    // a status message that could not be written must not fail the story,
    // matching the worker's previous tolerance for these writes.
    if (error) return { error }
    if (!written) throw new LeaseLostError(`status → ${status}`)
    return { error: null }
  }

  return { heartbeat, stillOwns, require, renewOrThrow, setStatus }
}

/**
 * In-memory store for tests: one story row whose worker_id another "worker"
 * can change underneath the guard. Records every owned write that matched.
 */
export function memoryLeaseStore(initial: { worker_id: string | null } & Record<string, unknown>, workerId: string) {
  const row: Record<string, unknown> = { ...initial }
  const writes: Record<string, unknown>[] = []
  const store: LeaseStore = {
    async updateOwned(values) {
      if (row.worker_id !== workerId) return { written: false, error: null }
      Object.assign(row, values)
      writes.push(values)
      return { written: true, error: null }
    },
    async readWorkerId() {
      return (row.worker_id as string | null) ?? null
    },
  }
  return { store, row, writes }
}
