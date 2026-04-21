import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

// Text is extracted client-side and sent as JSON
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const { text, fileName } = await request.json()

  if (!text || text.length < 50) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('writer_books')
    .update({
      source_text: text,
      source_pdf_name: fileName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    fileName,
    wordCount: (text as string).split(/\s+/).length,
  })
}
