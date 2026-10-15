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
// while it does. A lease is VALID only when both hold:
//
//   worker_id = this worker            nobody has claimed the row since us
//   worker_lease_expires_at > now      the window we were granted is open
//
// A matching worker_id alone is not enough: once the window has passed the
// row is claimable, so a write that relied on worker_id only could land
// after another invocation's claim. Every owned write therefore carries
// both conditions in the same UPDATE statement, which is what makes it
// atomic against a concurrent claim (Postgres re-evaluates the WHERE
// clause on the committed row version before applying the update).
//
//   heartbeat()        conditional UPDATE that extends the window; false = lost
//   require(where)     heartbeat() that throws LeaseLostError when lost. It
//                      is the pre-write checkpoint: a successful require()
//                      means the window is open for leaseMs from now, so no
//                      expiry-based claim can interleave with the write
//                      that follows (only an explicit reset of worker_id
//                      by an admin action can, see index.ts).
//   renewOrThrow()     require() with an explicit window (text stage)
//   stillOwns()        read-only view of the same two conditions
//   setStatus(...)     conditional status UPDATE; throws LeaseLostError when
//                      no row was written (owner changed or window closed)
//
// An invocation whose window closed with nobody claiming the row is also
// refused: it has no way to tell that nobody claimed, and the sweep will
// re-dispatch the row as soon as the window is seen to be free. Within the
// worker's own budgets (TIME_BUDGET_MS, HARD_LIMIT_MS in policy.ts) the
// window is always renewed before it can close, so this never fails a
// legitimately progressing run.
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
  /** True when exactly the owned row was written (both conditions matched). */
  written: boolean
  /** Database error text when the statement itself failed; null otherwise. */
  error: string | null
}

export interface LeaseOwnership {
  workerId: string | null
  leaseExpiresAt: string | null
}

/**
 * The two statements the guard needs, bound to one story and one worker.
 * Production binds them to the service-role client (see index.ts); tests
 * bind them to an in-memory row.
 */
export interface LeaseStore {
  /**
   * UPDATE story_requests SET <values>
   *   WHERE id = requestId AND worker_id = workerId AND worker_lease_expires_at > nowIso
   * RETURNING id. Must never match a row owned by anyone else, nor a row
   * whose window has closed.
   */
  updateOwned(values: Record<string, unknown>, nowIso: string): Promise<OwnedWriteResult>
  /** SELECT worker_id, worker_lease_expires_at FROM story_requests WHERE id = requestId (nulls when absent). */
  readOwnership(): Promise<LeaseOwnership>
}

export interface LeaseGuard {
  /** Extend the window (own worker, open window only). Returns false when the lease is no longer ours or could not be confirmed. */
  heartbeat(leaseMs?: number): Promise<boolean>
  /** True while this worker's id is on the row and the window is open. Read-only. */
  stillOwns(): Promise<boolean>
  /** Pre-write checkpoint: renews the window or throws LeaseLostError. `where` names the checkpoint for the log. */
  require(where: string, leaseMs?: number): Promise<void>
  /** require() with an explicit window; kept as a separate name for readability at stage boundaries. */
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
  /** Default window stamped by heartbeat()/require(). */
  leaseMs: number
  /** Injected clock for tests. */
  now?: () => number
}

/** Pure form of the ownership test, shared by stillOwns() and the in-memory store. */
export function leaseIsValid(row: LeaseOwnership, workerId: string, nowMs: number): boolean {
  if (row.workerId !== workerId) return false
  if (!row.leaseExpiresAt) return false
  const exp = Date.parse(row.leaseExpiresAt)
  return Number.isFinite(exp) && exp > nowMs
}

export function createLeaseGuard(store: LeaseStore, opts: LeaseGuardOptions): LeaseGuard {
  const now = opts.now ?? (() => Date.now())
  let lastError: string | null = null

  async function heartbeat(leaseMs: number = opts.leaseMs): Promise<boolean> {
    const t = now()
    const { written, error } = await store.updateOwned({
      worker_heartbeat_at: new Date(t).toISOString(),
      worker_lease_expires_at: new Date(t + leaseMs).toISOString(),
    }, new Date(t).toISOString())
    // Fail closed: a heartbeat that could not be confirmed is treated as a
    // lost lease, so the worker stops before paying for the next long call.
    // The sweep re-dispatches the row once the window is seen to be free.
    if (error) { lastError = error; return false }
    lastError = null
    return written
  }

  async function stillOwns(): Promise<boolean> {
    return leaseIsValid(await store.readOwnership(), opts.workerId, now())
  }

  async function renewOrThrow(where: string, leaseMs?: number): Promise<void> {
    if (!(await heartbeat(leaseMs))) throw new LeaseLostError(lastError ? `${where}; heartbeat error: ${lastError}` : where)
  }

  async function setStatus(status: string, message: string, progress: number, extra: Record<string, unknown> = {}): Promise<{ error: string | null }> {
    const { written, error } = await store.updateOwned(
      { status, status_message: message, progress_pct: progress, ...extra },
      new Date(now()).toISOString(),
    )
    // A statement error (not an ownership miss) is reported, not thrown:
    // a status message that could not be written must not fail the story,
    // matching the worker's previous tolerance for these writes.
    if (error) return { error }
    if (!written) throw new LeaseLostError(`status → ${status}`)
    return { error: null }
  }

  return { heartbeat, stillOwns, require: renewOrThrow, renewOrThrow, setStatus }
}

/**
 * In-memory store for tests: one story row whose worker_id and
 * worker_lease_expires_at another "worker" can change underneath the
 * guard. Applies the same two conditions as the SQL statement and records
 * every owned write that matched.
 */
export function memoryLeaseStore(
  initial: { worker_id: string | null; worker_lease_expires_at?: string | null } & Record<string, unknown>,
  workerId: string,
) {
  const row: Record<string, unknown> = { ...initial }
  const writes: Record<string, unknown>[] = []
  const ownership = (): LeaseOwnership => ({
    workerId: (row.worker_id as string | null) ?? null,
    leaseExpiresAt: (row.worker_lease_expires_at as string | null) ?? null,
  })
  const store: LeaseStore = {
    async updateOwned(values, nowIso) {
      if (!leaseIsValid(ownership(), workerId, Date.parse(nowIso))) return { written: false, error: null }
      Object.assign(row, values)
      writes.push(values)
      return { written: true, error: null }
    },
    async readOwnership() {
      return ownership()
    },
  }
  return { store, row, writes }
}
