import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

// Text is extracted client-side (PDF.js in browser) and sent as JSON
export async function POST(request: NextRequest) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { text, fileName, owner_id } = await request.json()

  if (!text || text.length < 50) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const baseName = (fileName as string ?? 'Untitled').replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
  const ownerId = ctx.isSuperAdmin && owner_id ? owner_id : ctx.userId
  const supabase = createAdminClient()

  const { data: book, error } = await supabase
    .from('writer_books')
    .insert({
      title: baseName,
      subtitle: null,
      genre: '',
      tone: '',
      premise: '',
      target_chapters: 10,
      target_words_per_chapter: 2000,
      owner_id: ownerId,
      source_text: text,
      source_pdf_name: fileName,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(book, { status: 201 })
}
