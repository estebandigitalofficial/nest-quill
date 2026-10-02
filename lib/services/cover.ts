// Canonical cover asset resolution for every surface that shows a book
// cover (reader, account/library cards, PDF, admin preview). One asset,
// stored by the worker at story-images/<request_id>/cover.jpg (legacy: cover.png), with a
// typographic fallback when it does not exist.
//
// Pure helpers only — signing URLs is the caller's job so each surface
// controls its own TTL.

export const COVER_BUCKET = 'story-images'

export interface CoverFields {
  cover_status?: string | null
  cover_storage_path?: string | null
}

/** Storage path of the canonical cover, or null when none is usable. */
export function pickCoverPath(story: CoverFields | null | undefined): string | null {
  if (!story) return null
  if (story.cover_status === 'complete' && story.cover_storage_path) return story.cover_storage_path
  return null
}

/**
 * Thumbnail path for a story card: the cover when it exists, otherwise the
 * page-1 illustration, otherwise null (the card renders its initial-letter
 * tile — never a broken image).
 */
export function pickThumbnailPath(story: CoverFields | null | undefined, pageOnePath: string | null | undefined): string | null {
  return pickCoverPath(story) ?? (pageOnePath || null)
}

/** How a surface should treat the cover area. */
export type CoverPresentation = { kind: 'artwork'; url: string } | { kind: 'typographic' }

export function coverPresentation(signedUrl: string | null | undefined): CoverPresentation {
  return signedUrl ? { kind: 'artwork', url: signedUrl } : { kind: 'typographic' }
}
