/**
 * STORY STORAGE PATH SAFETY (Privacy Foundation 3C-2)
 *
 * Pure helpers that decide which Supabase Storage objects a failed-story
 * deletion may touch. Nothing here talks to the network; deleteFailedStory.ts
 * feeds it the paths returned by delete_failed_story (known_paths) and the
 * paths discovered by listing the story's own prefix, and removes only what
 * these helpers accept.
 *
 * Layout facts (repo + production catalog, 2026-10-16):
 *   bucket story-images   <request_id>/<page>.jpg   (legacy <page>.png)
 *                         <request_id>/cover.jpg    (legacy cover.png)
 *   bucket book-exports   <request_id>/storybook.pdf
 *                         (lib/services/storage.ts still names <id>/book.pdf;
 *                          no caller and no such object exists, but the rule
 *                          below accepts any file directly under the prefix,
 *                          so a leftover of that shape would be removed too)
 * Every production object is `<uuid>/<file>`, exactly two segments. Both
 * buckets are private. The ONLY ownership rule is the first path segment:
 * an object belongs to story X iff its path starts with `<X>/`.
 *
 * Safety rules enforced by classifyStoragePath():
 *   - bucket must be one of STORY_STORAGE_BUCKETS;
 *   - the story id must be a lowercase UUID (storage paths are written from
 *     the Postgres uuid text, which is lowercase);
 *   - the path must start with the exact `<requestId>/` prefix boundary;
 *     substring or startsWith-without-slash matches are impossible because
 *     a UUID has a fixed length and the slash is required;
 *   - no `.` or `..` segments, no empty segments (`//`), no leading slash,
 *     no backslash, no control characters, no trailing slash, bounded length;
 *   - the remainder must name a file, never the bare prefix.
 */

export const STORY_IMAGES_BUCKET = 'story-images'
export const BOOK_EXPORTS_BUCKET = 'book-exports'
export const STORY_STORAGE_BUCKETS = [STORY_IMAGES_BUCKET, BOOK_EXPORTS_BUCKET] as const
export type StoryStorageBucket = (typeof STORY_STORAGE_BUCKETS)[number]

export interface StorageObjectRef {
  bucket: StoryStorageBucket
  path: string
}

export interface RejectedPath {
  bucket: unknown
  path: unknown
  reason: PathRejectReason
}

export type PathRejectReason =
  | 'bucket_not_allowed'
  | 'path_not_string'
  | 'path_too_long'
  | 'path_has_forbidden_characters'
  | 'path_outside_story_prefix'
  | 'path_is_bare_prefix'
  | 'path_has_dot_segment'
  | 'path_has_empty_segment'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** Longest path we will ever accept: a UUID prefix plus a modest file name. */
export const MAX_STORAGE_PATH_LENGTH = 256

/** Lowercase UUID text, or null when the value cannot be a story id. */
export function normalizeRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return UUID_RE.test(id) ? id : null
}

export function isStoryStorageBucket(bucket: unknown): bucket is StoryStorageBucket {
  return typeof bucket === 'string' && (STORY_STORAGE_BUCKETS as readonly string[]).includes(bucket)
}

/** The exact prefix boundary that owns a story's objects, `<requestId>/`. */
export function storyPrefix(requestId: string): string {
  const id = normalizeRequestId(requestId)
  if (!id) throw new Error('storyPrefix: requestId is not a UUID')
  return `${id}/`
}

export type PathClassification =
  | { ok: true; object: StorageObjectRef }
  | { ok: false; reason: PathRejectReason }

/**
 * Decide whether (bucket, path) is an object the deletion of `requestId`
 * may remove. Pure, total, never throws for unknown input shapes.
 */
export function classifyStoragePath(bucket: unknown, path: unknown, requestId: string): PathClassification {
  if (!isStoryStorageBucket(bucket)) return { ok: false, reason: 'bucket_not_allowed' }
  if (typeof path !== 'string') return { ok: false, reason: 'path_not_string' }
  if (path.length === 0 || path.length > MAX_STORAGE_PATH_LENGTH) return { ok: false, reason: 'path_too_long' }
  // Backslashes, NUL and other control characters never appear in a path we
  // wrote; a leading slash would make the prefix test ambiguous.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(path) || path.startsWith('/')) {
    return { ok: false, reason: 'path_has_forbidden_characters' }
  }
  const prefix = storyPrefix(requestId)
  if (!path.startsWith(prefix)) return { ok: false, reason: 'path_outside_story_prefix' }
  const rest = path.slice(prefix.length)
  if (rest.length === 0) return { ok: false, reason: 'path_is_bare_prefix' }
  const segments = rest.split('/')
  for (const seg of segments) {
    if (seg === '') return { ok: false, reason: 'path_has_empty_segment' } // `//` or trailing `/`
    if (seg === '.' || seg === '..') return { ok: false, reason: 'path_has_dot_segment' }
  }
  return { ok: true, object: { bucket, path } }
}

/** Stable identity of an object across buckets. */
export function objectKey(o: StorageObjectRef): string {
  return `${o.bucket}\n${o.path}`
}

/** Deduplicate by (bucket, path), keeping first occurrence order. */
export function dedupeObjects(objects: Iterable<StorageObjectRef>): StorageObjectRef[] {
  const seen = new Set<string>()
  const out: StorageObjectRef[] = []
  for (const o of objects) {
    const k = objectKey(o)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(o)
  }
  return out
}

/**
 * Split the `known_paths` array returned by delete_failed_story into the
 * objects this deletion may remove and the entries it must ignore. Entries
 * are untrusted until classified: the database returned them, but a path
 * that does not sit under `<requestId>/` is never removed on its word.
 */
export function partitionKnownPaths(known: unknown, requestId: string): { accepted: StorageObjectRef[]; rejected: RejectedPath[] } {
  const accepted: StorageObjectRef[] = []
  const rejected: RejectedPath[] = []
  if (!Array.isArray(known)) return { accepted, rejected }
  for (const entry of known) {
    const bucket = entry && typeof entry === 'object' ? (entry as { bucket?: unknown }).bucket : undefined
    const path = entry && typeof entry === 'object' ? (entry as { path?: unknown }).path : undefined
    const c = classifyStoragePath(bucket, path, requestId)
    if (c.ok) accepted.push(c.object)
    else rejected.push({ bucket, path, reason: c.reason })
  }
  return { accepted: dedupeObjects(accepted), rejected }
}
