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

  let query = db
    .from('image_library')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.style) query = query.eq('illustration_style', params.style)
  if (params.theme) query = query.ilike('theme', `%${params.theme}%`)
  if (params.tags) query = query.contains('tags', [params.tags])
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', params.to)

  const { data, count } = await query
  const images = (data ?? []) as unknown as ImageLibraryItem[]
  const totalPages = Math.ceil((count ?? 0) / limit)

  // Get available styles for filter dropdown
  const { data: styleRows } = await db
    .from('image_library')
    .select('illustration_style')
    .not('illustration_style', 'is', null)
    .limit(500)

  const styles = [...new Set((styleRows ?? []).map((r: { illustration_style: string }) => r.illustration_style))]

  // Generate signed URLs for images
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
        <p className="text-sm text-gray-400 mt-1">
          {count ?? 0} images total
          {page > 1 && ` — page ${page}`}
        </p>
      </div>

      <Suspense>
        <ImageFilters styles={styles} />
      </Suspense>

      <ImageGrid images={images} signedUrls={signedUrls} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-gray-700 rounded-lg transition-colors">
              ← Prev
            </Link>
          )}
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-gray-700 rounded-lg transition-colors">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
