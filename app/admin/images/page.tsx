import { Suspense } from 'react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ImageLibraryItem } from '@/types/database'
import ImageGrid from './ImageGrid'
import ImageFilters from './ImageFilters'

interface PageProps {
  searchParams: Promise<{
    style?: string
    theme?: string
    tags?: string
    from?: string
    to?: string
    page?: string
  }>
}

export default async function AdminImagesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const limit = 48
  const offset = (page - 1) * limit

  const db = createAdminClient()

  // ── Resolve active scene IDs ──────────────────────────────────────────────
  // story_scenes can have multiple rows per (request_id, page_number) when
  // generation retried. Only the active scene per page should show in the
  // library — keep the complete + newest row, ignore the rest.
  const { data: completeScenes } = await db
    .from('story_scenes')
    .select('id, request_id, page_number, image_status, updated_at')
    .eq('image_status', 'complete')
    .limit(50000)

  // One active scene per (request_id, page_number) — newest updated_at wins
  const activeByPage = new Map<string, { id: string; updated_at: string }>()
  for (const s of completeScenes ?? []) {
    const key = `${s.request_id}|${s.page_number}`
    const prev = activeByPage.get(key)
    if (!prev || s.updated_at > prev.updated_at) {
      activeByPage.set(key, { id: s.id, updated_at: s.updated_at })
    }
  }
  const activeSceneIds = Array.from(activeByPage.values()).map(v => v.id)

  // ── Image library query — filtered to active scenes only ─────────────────
  // Excludes: orphaned rows (scene_id null), stale rows (non-active scene per page)
  let images: ImageLibraryItem[] = []
  let count: number | null = 0

  if (activeSceneIds.length > 0) {
    let query = db
      .from('image_library')
      .select('*', { count: 'exact' })
      .in('scene_id', activeSceneIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.style) query = query.eq('illustration_style', params.style)
    if (params.theme) query = query.ilike('theme', `%${params.theme}%`)
    if (params.tags) query = query.contains('tags', [params.tags])
    if (params.from) query = query.gte('created_at', params.from)
    if (params.to) query = query.lte('created_at', params.to)

    const { data, count: total } = await query
    images = (data ?? []) as unknown as ImageLibraryItem[]
    count = total
  }

  const totalPages = Math.ceil((count ?? 0) / limit)

  // ── Styles for filter dropdown ────────────────────────────────────────────
  const { data: styleRows } = await db
    .from('image_library')
    .select('illustration_style')
    .in('scene_id', activeSceneIds.length > 0 ? activeSceneIds : ['none'])
    .not('illustration_style', 'is', null)
    .limit(500)

  const styles = [...new Set((styleRows ?? []).map((r: { illustration_style: string }) => r.illustration_style))]

  // ── Signed URLs ───────────────────────────────────────────────────────────
  const paths = images.filter(i => i.storage_path).map(i => i.storage_path as string)
  const signedUrls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await db.storage
      .from('story-images')
      .createSignedUrls(paths, 60 * 60 * 2)
    signed?.forEach(item => {
      if (item.signedUrl && item.path) signedUrls[item.path] = item.signedUrl
    })
  }

  function buildPageUrl(p: number) {
    const sp = new URLSearchParams()
    if (params.style) sp.set('style', params.style)
    if (params.theme) sp.set('theme', params.theme)
    if (params.tags) sp.set('tags', params.tags)
    if (params.from) sp.set('from', params.from)
    if (params.to) sp.set('to', params.to)
    if (p > 1) sp.set('page', String(p))
    return `/admin/images?${sp.toString()}`
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Image Library</h1>
        <p className="text-sm text-adm-muted mt-1">
          {count ?? 0} active images
          {page > 1 && ` — page ${page}`}
        </p>
      </div>

      <Suspense>
        <ImageFilters styles={styles} />
      </Suspense>

      <ImageGrid images={images} signedUrls={signedUrls} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)} className="text-xs text-adm-muted hover:text-white px-3 py-1.5 border border-adm-border rounded-lg transition-colors">
              ← Prev
            </Link>
          )}
          <span className="text-xs text-adm-muted">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)} className="text-xs text-adm-muted hover:text-white px-3 py-1.5 border border-adm-border rounded-lg transition-colors">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
