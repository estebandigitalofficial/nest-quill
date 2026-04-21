import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  const supabase = createAdminClient()

  const { data: book, error } = await supabase
    .from('writer_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (error || !book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const { data: chapters } = await supabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true })

  const chaptersWithScenes = (chapters ?? []).map((ch: Record<string, unknown>) => ({
    ...ch,
    scenes: ((ch.writer_scenes as unknown[]) ?? []).sort(
      (a: unknown, b: unknown) => (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
    ),
  }))

  return NextResponse.json({ ...book, chapters: chaptersWithScenes })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('writer_books')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', bookId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()
  const { error } = await supabase.from('writer_books').delete().eq('id', bookId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
