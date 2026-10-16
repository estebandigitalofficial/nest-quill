/**
 * DELETION OUTCOME PARSING AND COUNTS (Privacy Foundation 3C-2)
 *
 * Pure. Interprets the jsonb returned by delete_failed_story (migrations
 * 20240074 + 20240075) and shapes the bounded counts object that
 * complete_story_deletion stores in deletion_log.counts, which the table
 * CHECK deletion_log_counts_ok() (migration 20240073) validates.
 *
 * Nothing here widens the schema: DELETION_COUNT_KEYS mirrors the SQL
 * allow-list byte for byte (pinned by deleteFailedStory.test.ts against the
 * migration text) and STORAGE_OBJECTS_COUNT_KEY is the one key the storage
 * cleanup adds.
 */

/** Allow-listed deletion_log.counts keys, exactly as deletion_log_counts_ok() lists them. */
export const DELETION_COUNT_KEYS = [
  'storage_objects',
  'story_requests',
  'generated_stories',
  'story_scenes',
  'book_exports',
  'delivery_logs',
  'processing_logs',
  'image_library',
  'idempotency_keys',
  'drip_email_log',
  'notifications',
  'support_tickets',
  'stories_deleted',
  'purchases_detached',
  'subscription_periods_detached',
] as const
export type DeletionCountKey = (typeof DELETION_COUNT_KEYS)[number]
export type DeletionCounts = Partial<Record<DeletionCountKey, number>>

/** The key under which removed storage objects are counted. */
export const STORAGE_OBJECTS_COUNT_KEY: DeletionCountKey = 'storage_objects'

/** Non-negative integer with at most 9 digits, as the CHECK requires. */
export function isCountValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 999_999_999
}

/**
 * Keep only allow-listed keys with valid values. Anything else is dropped
 * rather than passed on, so a stray key can never make
 * complete_story_deletion fail the table CHECK after storage is already gone.
 */
export function sanitizeCounts(raw: unknown): { counts: DeletionCounts; dropped: string[] } {
  const counts: DeletionCounts = {}
  const dropped: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { counts, dropped }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((DELETION_COUNT_KEYS as readonly string[]).includes(k) && isCountValue(v)) counts[k as DeletionCountKey] = v
    else dropped.push(k)
  }
  return { counts, dropped }
}

/**
 * Final counts for complete_story_deletion: the database counts exactly as
 * delete_failed_story returned them (fresh call: computed in the deleting
 * transaction; resumed call: read back from deletion_log, where 20240075
 * stores them durably) plus the storage count. Never invents a database
 * count; complete_story_deletion merges this object into the stored one.
 */
export function withStorageCount(dbCounts: DeletionCounts, storageObjects: number): DeletionCounts {
  if (!isCountValue(storageObjects)) throw new Error('withStorageCount: storageObjects must be a non-negative integer')
  return { ...dbCounts, [STORAGE_OBJECTS_COUNT_KEY]: storageObjects }
}

/** Parsed delete_failed_story result. */
export type DeleteRpcOutcome =
  | { outcome: 'not_found' }
  | { outcome: 'not_eligible' }
  | { outcome: 'already_deleted'; logId: string }
  | { outcome: 'deleted'; resumed: boolean; logId: string; knownPaths: unknown[]; counts: DeletionCounts; droppedCountKeys: string[]; freeReleased: boolean }
  | { outcome: 'malformed'; detail: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Interpret the jsonb from delete_failed_story. Total: never throws. */
export function parseDeleteRpcResult(data: unknown): DeleteRpcOutcome {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { outcome: 'malformed', detail: 'result is not an object' }
  const r = data as Record<string, unknown>
  switch (r.outcome) {
    case 'not_found':
      return { outcome: 'not_found' }
    case 'not_eligible':
      return { outcome: 'not_eligible' }
    case 'already_deleted': {
      if (typeof r.log_id !== 'string' || !UUID_RE.test(r.log_id)) return { outcome: 'malformed', detail: 'already_deleted without log_id' }
      return { outcome: 'already_deleted', logId: r.log_id.toLowerCase() }
    }
    case 'deleted': {
      if (typeof r.log_id !== 'string' || !UUID_RE.test(r.log_id)) return { outcome: 'malformed', detail: 'deleted without log_id' }
      const { counts, dropped } = sanitizeCounts(r.counts)
      return {
        outcome: 'deleted',
        resumed: r.resumed === true,
        logId: r.log_id.toLowerCase(),
        knownPaths: Array.isArray(r.known_paths) ? r.known_paths : [],
        counts,
        droppedCountKeys: dropped,
        freeReleased: r.free_released === true,
      }
    }
    default:
      return { outcome: 'malformed', detail: `unknown outcome ${JSON.stringify(r.outcome)}` }
  }
}
