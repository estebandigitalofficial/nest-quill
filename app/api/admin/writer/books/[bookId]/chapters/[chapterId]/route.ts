import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { chapterId } = await params
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('writer_chapters')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', chapterId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { chapterId } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('writer_chapters').delete().eq('id', chapterId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
