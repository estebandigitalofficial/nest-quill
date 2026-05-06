// Server-only helper for the account "Your stories" and "Archived stories"
// pages. Returns a map of requestId → signed URL for the page-1 image of
// every completed story whose id is passed in. Lifted out of the page
// component so Next can keep page modules export-clean.

import { createAdminClient } from '@/lib/supabase/admin'

export async function loadThumbs(completeIds: string[]): Promise<Record<string, string>> {
  const thumbMap: Record<string, string> = {}
  if (completeIds.length === 0) return thumbMap

  const adminSupabase = createAdminClient()

  const { data: scenes } = await adminSupabase
    .from('story_scenes')
    .select('request_id, storage_path')
    .in('request_id', completeIds)
    .eq('page_number', 1)
    .eq('image_status', 'complete')

  const paths = (scenes ?? [])
    .filter((s: { storage_path: string | null }) => s.storage_path)
    .map((s: { storage_path: string }) => s.storage_path)
  if (paths.length === 0) return thumbMap

  const { data: signed } = await adminSupabase.storage
    .from('story-images')
    .createSignedUrls(paths, 60 * 60 * 24 * 7)

  const pathToUrl: Record<string, string> = {}
  signed?.forEach((item: { signedUrl: string | null; path: string | null }) => {
    if (item.signedUrl && item.path) pathToUrl[item.path] = item.signedUrl
  })

  scenes?.forEach((scene: { request_id: string; storage_path: string | null }) => {
    if (scene.storage_path && pathToUrl[scene.storage_path]) {
      thumbMap[scene.request_id] = pathToUrl[scene.storage_path]
    }
  })
  return thumbMap
}
