// Server-only helper for the account "Your stories" and "Archived stories"
// pages. Returns a map of requestId → signed URL of the story's thumbnail:
// the generated cover when one exists (Phase 1F), otherwise the page-1
// illustration, otherwise nothing (the card shows its initial-letter tile).
// Lifted out of the page component so Next can keep page modules export-clean.

import { createAdminClient } from '@/lib/supabase/admin'
import { COVER_BUCKET, pickThumbnailPath } from '@/lib/services/cover'

export async function loadThumbs(completeIds: string[]): Promise<Record<string, string>> {
  const thumbMap: Record<string, string> = {}
  if (completeIds.length === 0) return thumbMap

  const adminSupabase = createAdminClient()

  // Cover fields are optional until migration 20240066 is applied; a
  // select error (missing column) simply yields no covers.
  const [{ data: covers }, { data: scenes }] = await Promise.all([
    adminSupabase
      .from('generated_stories')
      .select('request_id, cover_status, cover_storage_path')
      .in('request_id', completeIds),
    adminSupabase
      .from('story_scenes')
      .select('request_id, storage_path')
      .in('request_id', completeIds)
      .eq('page_number', 1)
      .eq('image_status', 'complete'),
  ])

  const pageOne: Record<string, string> = {}
  scenes?.forEach((s: { request_id: string; storage_path: string | null }) => {
    if (s.storage_path) pageOne[s.request_id] = s.storage_path
  })
  const coverRows: Record<string, { cover_status?: string | null; cover_storage_path?: string | null }> = {}
  covers?.forEach((c: { request_id: string; cover_status?: string | null; cover_storage_path?: string | null }) => {
    coverRows[c.request_id] = c
  })

  const pathByRequest: Record<string, string> = {}
  for (const id of completeIds) {
    const path = pickThumbnailPath(coverRows[id], pageOne[id])
    if (path) pathByRequest[id] = path
  }
  const paths = Object.values(pathByRequest)
  if (paths.length === 0) return thumbMap

  const { data: signed } = await adminSupabase.storage
    .from(COVER_BUCKET)
    .createSignedUrls(paths, 60 * 60 * 24 * 7)

  const pathToUrl: Record<string, string> = {}
  signed?.forEach((item: { signedUrl: string | null; path: string | null }) => {
    if (item.signedUrl && item.path) pathToUrl[item.path] = item.signedUrl
  })

  for (const [id, path] of Object.entries(pathByRequest)) {
    if (pathToUrl[path]) thumbMap[id] = pathToUrl[path]
  }
  return thumbMap
}
