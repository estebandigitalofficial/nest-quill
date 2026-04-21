import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

// Just extracts text — fast, no AI call
export async function POST(request: NextRequest) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

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
    return NextResponse.json({
      error: 'Could not extract text. Make sure this is a text-based PDF, not a scanned image.',
    }, { status: 422 })
  }

  if (!text || text.length < 100) {
    return NextResponse.json({ error: 'No readable text found in this PDF.' }, { status: 422 })
  }

  return NextResponse.json({
    text,
    fileName: file.name,
    wordCount: text.split(/\s+/).length,
  })
}
