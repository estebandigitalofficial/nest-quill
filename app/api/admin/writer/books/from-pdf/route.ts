import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const formData = await request.formData()
  const file = formData.get('pdf') as File | null
  const ownerIdOverride = formData.get('owner_id') as string | null

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const baseName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')

  // Extract text using pdf-parse internal module to avoid serverless init issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>

  let text = ''
  try {
    const result = await pdfParse(buffer)
    text = result.text.trim()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `PDF extraction failed: ${msg}` }, { status: 422 })
  }

  if (!text || text.length < 50) {
    return NextResponse.json({ error: 'No readable text found. Make sure this is a text-based PDF.' }, { status: 422 })
  }

  const ownerId = ctx.isSuperAdmin && ownerIdOverride ? ownerIdOverride : ctx.userId
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
      source_pdf_name: file.name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(book, { status: 201 })
}
