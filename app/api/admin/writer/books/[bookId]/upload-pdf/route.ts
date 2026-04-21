import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const formData = await request.formData()
  const file = formData.get('pdf') as File | null

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let text: string
  try {
    const result = await pdfParse(buffer)
    text = result.text.trim()
  } catch {
    return NextResponse.json({ error: 'Could not extract text from this PDF. Make sure it is a text-based PDF, not a scanned image.' }, { status: 422 })
  }

  if (!text || text.length < 100) {
    return NextResponse.json({ error: 'No readable text found in this PDF.' }, { status: 422 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('writer_books')
    .update({
      source_text: text,
      source_pdf_name: file.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    fileName: file.name,
    wordCount: text.split(/\s+/).length,
  })
}
