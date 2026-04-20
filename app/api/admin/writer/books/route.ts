import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return adminGuardResponse()
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('writer_books')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return adminGuardResponse()
  }

  const body = await request.json()
  const { title, subtitle, genre, tone, premise, target_chapters, target_words_per_chapter } = body

  if (!title || !genre || !tone || !premise) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('writer_books')
    .insert({ title, subtitle: subtitle || null, genre, tone, premise, target_chapters: target_chapters ?? 10, target_words_per_chapter: target_words_per_chapter ?? 2000 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
