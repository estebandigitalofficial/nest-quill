import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const style = searchParams.get('style')
  const theme = searchParams.get('theme')
  const tags = searchParams.get('tags')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = 48
  const offset = (page - 1) * limit

  const db = createAdminClient()

  // ── Resolve active scene IDs (same logic as the page) ─────────────────────
  const { data: completeScenes } = await db
    .from('story_scenes')
    .select('id, request_id, page_number, updated_at')
    .eq('image_status', 'complete')
    .limit(50000)

  const activeByPage = new Map<string, { id: string; updated_at: string }>()
  for (const s of completeScenes ?? []) {
    const key = `${(s as { request_id: string }).request_id}|${(s as { page_number: number }).page_number}`
    const prev = activeByPage.get(key)
    const updatedAt = (s as { updated_at: string }).updated_at
    if (!prev || updatedAt > prev.updated_at) {
      activeByPage.set(key, { id: (s as { id: string }).id, updated_at: updatedAt })
    }
  }
  const activeSceneIds = Array.from(activeByPage.values()).map(v => v.id)

  if (activeSceneIds.length === 0) {
    return NextResponse.json({ images: [], total: 0, page, limit })
  }

  let query = db
    .from('image_library')
    .select('*', { count: 'exact' })
    .in('scene_id', activeSceneIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (style) query = query.eq('illustration_style', style)
  if (theme) query = query.ilike('theme', `%${theme}%`)
  if (tags) query = query.contains('tags', [tags])
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ images: data, total: count, page, limit })
}
