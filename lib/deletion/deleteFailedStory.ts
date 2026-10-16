/**
 * FAILED-STORY DELETION SERVICE (Privacy Foundation 3C-2)
 *
 * SERVER ONLY. Orchestrates one customer's permanent deletion of an
 * archived failed story over the database functions installed by migration
 * 20240074 and corrected by 20240075 (3C-1b), and the two private storage
 * buckets. No route or UI calls this
 * yet (3C-3 onwards); the caller will be a server-side route or the
 * reconciliation sweep, always with the service-role admin client
 * (lib/supabase/admin.ts createAdminClient()). The client is injected so the
 * flow is testable with fakes and so this module itself holds no credential.
 *
 * Algorithm (D5: rows first, objects second):
 *   1. normalize ids; a non-UUID request id is `not_found` (no DB call).
 *   2. rpc delete_failed_story(request, user)
 *        not_found / not_eligible / already_deleted  → returned as such
 *        deleted (resumed=false)  → row and child rows are gone, deletion_log
 *                                  row is 'started', known_paths + counts came back
 *        deleted (resumed=true)   → row already gone from an earlier attempt,
 *                                  known_paths = [] and counts = the database
 *                                  counts stored durably on the deletion_log
 *                                  record by the deleting transaction (20240075)
 *   3. discover storage: list `<id>/` in story-images AND book-exports,
 *      paginated (STORAGE_LIST_PAGE_SIZE per page, name asc, offset) until a
 *      short page, recursing into any sub-folder that sits under the prefix.
 *      Prefix discovery is authoritative; known_paths are merged in only
 *      after classifyStoragePath() accepts them.
 *   4. remove the union in batches of STORAGE_REMOVE_BATCH_SIZE per bucket.
 *   5. re-list both prefixes; any remaining object → `incomplete`.
 *   6. rpc complete_story_deletion(log_id, dbCounts + storage_objects)
 *        true  → `deleted`
 *        false → `incomplete` (record no longer 'started': a concurrent run
 *                finished it, or it was marked failed); a retry sees
 *                already_deleted or a fresh outcome from step 2.
 *
 * Failure semantics: once step 2 commits there is no rollback and nothing
 * here pretends otherwise. Any failure from step 3 on leaves deletion_log
 * 'started' and returns `incomplete` with retryable: true; a later call
 * resumes at step 2 (resumed=true) and repeats 3-6. Objects uploaded late by
 * a stale worker are caught by the second pass the reconciliation sweep
 * runs no sooner than 10 minutes after the row delete (3C-3).
 *
 * Counts and the crash/retry boundary (closed by 20240075, 3C-1b):
 * delete_failed_story persists the eleven database deletion counts on the
 * deletion_log record inside the transaction that deletes the rows, and
 * returns those stored counts on a resumed call; complete_story_deletion
 * MERGES the caller's counts into them. This service forwards whatever
 * counts the RPC returned and adds exactly one key, storage_objects, after
 * the prefixes are verified empty (withStorageCount never invents a
 * database count). A process that dies between step 2 and step 6 therefore
 * cannot erase the database evidence: the resumed run carries it through.
 *
 * storage_objects semantics (accepted limitation): the number of objects
 * that existed under the story's prefixes at the start of the invocation
 * that completed the cleanup. Objects an earlier, crashed attempt had
 * already removed are not counted, so the operational count can be lower
 * than the historical total removed across attempts. No per-object
 * tombstones or cumulative state are kept.
 */
import {
  BOOK_EXPORTS_BUCKET,
  STORY_IMAGES_BUCKET,
  STORY_STORAGE_BUCKETS,
  classifyStoragePath,
  dedupeObjects,
  normalizeRequestId,
  partitionKnownPaths,
  storyPrefix,
  type RejectedPath,
  type StorageObjectRef,
  type StoryStorageBucket,
} from './storagePaths.ts'
import { parseDeleteRpcResult, withStorageCount, type DeletionCounts } from './decision.ts'

// ── Tunables ─────────────────────────────────────────────────
/** Supabase Storage list() page size (its default is 100; we pass it explicitly and paginate by offset). */
export const STORAGE_LIST_PAGE_SIZE = 100
/** Hard stop on pagination: a story has at most a few dozen objects; 1000 pages means something is wrong. */
export const STORAGE_LIST_MAX_PAGES = 1000
/** Objects per remove() call. */
export const STORAGE_REMOVE_BATCH_SIZE = 100

// ── Client surface this service needs ────────────────────────
export interface RpcResponse { data: unknown; error: { message: string } | null }
export interface StorageListEntry { name: string; id: string | null }
export interface StorageListOptions { limit?: number; offset?: number; sortBy?: { column: string; order: string } }
export interface StorageBucketApi {
  list(path?: string, options?: StorageListOptions): Promise<{ data: StorageListEntry[] | null; error: { message: string } | null }>
  remove(paths: string[]): Promise<{ data: unknown[] | null; error: { message: string } | null }>
}
/** Structural subset of the service-role SupabaseClient returned by createAdminClient(). */
export interface StoryDeletionClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>
  storage: { from(bucket: string): StorageBucketApi }
}

// ── Result type ──────────────────────────────────────────────
export type DeletionStage = 'storage_discovery' | 'storage_remove' | 'storage_verify' | 'complete'

export type DeleteFailedStoryResult =
  /** Unknown id, another user's story, another user's record, or a malformed id. Byte-identical for all. */
  | { outcome: 'not_found' }
  /** The requester's own live story that is not archived+failed+quiescent. */
  | { outcome: 'not_eligible' }
  /** Fully reconciled: rows gone, both prefixes verified empty, deletion_log completed (now or earlier). */
  | { outcome: 'deleted'; logId: string; resumed: boolean; completedNow: boolean; freeReleased: boolean; storageObjectsRemoved: number; counts: DeletionCounts; rejectedKnownPaths: RejectedPath[] }
  /** Database deletion is committed but storage cleanup or completion did not finish. deletion_log stays 'started'. */
  | { outcome: 'incomplete'; retryable: true; logId: string; resumed: boolean; stage: DeletionStage; failureCode: string; detail: string; storageObjectsRemoved: number; remainingObjects: number | null }
  /** delete_failed_story itself failed or returned something unexpected. Nothing changed; safe to retry as a whole. */
  | { outcome: 'rpc_failed'; retryable: true; failureCode: string; detail: string }

export interface DeleteFailedStoryInput {
  requestId: string
  userId: string
}

// ── Guards ───────────────────────────────────────────────────
/** This module must never execute in a browser bundle. */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') throw new Error('lib/deletion is server-only')
}

const FAILURE_CODE_RE = /^[a-z][a-z0-9_]{0,63}$/
function failureCode(code: string): string {
  if (!FAILURE_CODE_RE.test(code)) throw new Error(`invalid failure code ${code}`)
  return code
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ── Storage discovery ────────────────────────────────────────
/**
 * Every object under `<requestId>/` in one bucket. Paginates by offset until
 * a page comes back shorter than the page size; sub-folders (entries with
 * id === null) are descended into, staying under the same prefix. Every path
 * is re-validated with classifyStoragePath before it is returned.
 */
export async function listStoryObjects(client: StoryDeletionClient, bucket: StoryStorageBucket, requestId: string): Promise<StorageObjectRef[]> {
  const root = storyPrefix(requestId).slice(0, -1) // list() takes the folder without the trailing slash
  const out: StorageObjectRef[] = []
  const folders: string[] = [root]
  let pages = 0
  while (folders.length > 0) {
    const folder = folders.shift() as string
    let offset = 0
    for (;;) {
      if (++pages > STORAGE_LIST_MAX_PAGES) throw new Error(`storage listing exceeded ${STORAGE_LIST_MAX_PAGES} pages for ${bucket}`)
      const { data, error } = await client.storage.from(bucket).list(folder, {
        limit: STORAGE_LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`)
      const entries = data ?? []
      for (const entry of entries) {
        if (typeof entry?.name !== 'string' || entry.name.length === 0) continue
        const full = `${folder}/${entry.name}`
        if (entry.id === null) {
          // A folder placeholder. Only descend while it stays under the story prefix.
          if (full.startsWith(storyPrefix(requestId))) folders.push(full)
          continue
        }
        const c = classifyStoragePath(bucket, full, requestId)
        if (c.ok) out.push(c.object)
        // A path that fails classification cannot be ours; it is never removed.
      }
      if (entries.length < STORAGE_LIST_PAGE_SIZE) break
      offset += entries.length
    }
  }
  return dedupeObjects(out)
}

/** Union of both buckets' prefix listings. */
export async function discoverStoryObjects(client: StoryDeletionClient, requestId: string): Promise<StorageObjectRef[]> {
  const all: StorageObjectRef[] = []
  for (const bucket of STORY_STORAGE_BUCKETS) all.push(...(await listStoryObjects(client, bucket, requestId)))
  return dedupeObjects(all)
}

// ── Storage removal ──────────────────────────────────────────
/** Remove objects bucket by bucket in bounded batches. Returns how many paths were sent before any failure. */
async function removeObjects(client: StoryDeletionClient, objects: StorageObjectRef[], requestId: string): Promise<{ sent: number; error: string | null }> {
  let sent = 0
  for (const bucket of STORY_STORAGE_BUCKETS) {
    const paths = objects.filter((o) => o.bucket === bucket).map((o) => o.path)
    for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
      const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE)
      // Last line of defence: nothing leaves this function unless it passes the prefix rule.
      for (const p of batch) {
        if (!classifyStoragePath(bucket, p, requestId).ok) return { sent, error: `refused to remove ${bucket} path outside the story prefix` }
      }
      try {
        const { error } = await client.storage.from(bucket).remove(batch)
        if (error) return { sent, error: `remove ${bucket}: ${error.message}` }
      } catch (e) {
        return { sent, error: `remove ${bucket}: ${errMessage(e)}` }
      }
      sent += batch.length
    }
  }
  return { sent, error: null }
}

// ── Service ──────────────────────────────────────────────────
export async function deleteFailedStory(client: StoryDeletionClient, input: DeleteFailedStoryInput): Promise<DeleteFailedStoryResult> {
  assertServerOnly()
  const requestId = normalizeRequestId(input.requestId)
  const userId = normalizeRequestId(input.userId)
  // Privacy: a malformed id is indistinguishable from an unknown one.
  if (!requestId || !userId) return { outcome: 'not_found' }

  // 1. Atomic database deletion (or recognition of an earlier one).
  let rpc: RpcResponse
  try {
    rpc = await client.rpc('delete_failed_story', { p_request_id: requestId, p_user_id: userId })
  } catch (e) {
    return { outcome: 'rpc_failed', retryable: true, failureCode: failureCode('delete_rpc_threw'), detail: errMessage(e) }
  }
  if (rpc.error) return { outcome: 'rpc_failed', retryable: true, failureCode: failureCode('delete_rpc_error'), detail: rpc.error.message }
  const parsed = parseDeleteRpcResult(rpc.data)
  switch (parsed.outcome) {
    case 'malformed':
      return { outcome: 'rpc_failed', retryable: true, failureCode: failureCode('delete_rpc_malformed'), detail: parsed.detail }
    case 'not_found':
      return { outcome: 'not_found' }
    case 'not_eligible':
      return { outcome: 'not_eligible' }
    case 'already_deleted':
      // Idempotent success: an earlier run verified the prefixes empty and completed the record. Touch no storage.
      return { outcome: 'deleted', logId: parsed.logId, resumed: true, completedNow: false, freeReleased: false, storageObjectsRemoved: 0, counts: {}, rejectedKnownPaths: [] }
    case 'deleted':
      break
  }
  const { logId, resumed, freeReleased, counts: dbCounts } = parsed
  const incomplete = (stage: DeletionStage, code: string, detail: string, removed: number, remaining: number | null): DeleteFailedStoryResult => ({
    outcome: 'incomplete', retryable: true, logId, resumed, stage, failureCode: failureCode(code), detail, storageObjectsRemoved: removed, remainingObjects: remaining,
  })

  // 2. Discover what actually exists under the story's prefixes; merge the validated known paths.
  const known = partitionKnownPaths(parsed.knownPaths, requestId)
  let discovered: StorageObjectRef[]
  try {
    discovered = await discoverStoryObjects(client, requestId)
  } catch (e) {
    return incomplete('storage_discovery', 'storage_list_failed', errMessage(e), 0, null)
  }
  const targets = dedupeObjects([...discovered, ...known.accepted])

  // 3. Remove.
  const removal = await removeObjects(client, targets, requestId)
  if (removal.error) return incomplete('storage_remove', 'storage_remove_failed', removal.error, removal.sent, null)

  // 4. Verify both prefixes are empty before anything is marked complete.
  let remaining: StorageObjectRef[]
  try {
    remaining = await discoverStoryObjects(client, requestId)
  } catch (e) {
    return incomplete('storage_verify', 'storage_verify_list_failed', errMessage(e), removal.sent, null)
  }
  if (remaining.length > 0) {
    return incomplete('storage_verify', 'storage_objects_remain', `${remaining.length} object(s) still present under the story prefix`, removal.sent, remaining.length)
  }

  // 5. Complete the evidence record. storage_objects = objects that existed and are now verified gone.
  const storageObjectsRemoved = discovered.length
  const finalCounts = withStorageCount(dbCounts, storageObjectsRemoved)
  let done: RpcResponse
  try {
    done = await client.rpc('complete_story_deletion', { p_log_id: logId, p_counts: finalCounts })
  } catch (e) {
    return incomplete('complete', 'complete_rpc_threw', errMessage(e), storageObjectsRemoved, 0)
  }
  if (done.error) return incomplete('complete', 'complete_rpc_error', done.error.message, storageObjectsRemoved, 0)
  if (done.data !== true) {
    // false: the record is not 'started' any more (completed by a concurrent run, or marked failed). Never claim it.
    return incomplete('complete', 'complete_not_applied', `complete_story_deletion returned ${JSON.stringify(done.data)}`, storageObjectsRemoved, 0)
  }

  return {
    outcome: 'deleted',
    logId,
    resumed,
    completedNow: true,
    freeReleased,
    storageObjectsRemoved,
    counts: finalCounts,
    rejectedKnownPaths: known.rejected,
  }
}

export { STORY_IMAGES_BUCKET, BOOK_EXPORTS_BUCKET }
