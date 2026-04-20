import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId, chapterId } = await params
  const body = await request.json()
  const { scene_number, brief } = body

  if (!scene_number || !brief) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('writer_scenes')
    .insert({ book_id: bookId, chapter_id: chapterId, scene_number, brief })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { chapterId } = await params
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('writer_scenes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('chapter_id', chapterId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
