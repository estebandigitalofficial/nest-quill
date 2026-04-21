import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

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

  let text = ''
  try {
    const result = await pdfParse(buffer)
    text = result.text.trim()
  } catch {
    return NextResponse.json({ error: 'Could not extract text from this PDF.' }, { status: 422 })
  }

  if (!text || text.length < 100) {
    return NextResponse.json({ error: 'No readable text found in this PDF.' }, { status: 422 })
  }

  // Try to infer metadata — fall back to safe defaults if it fails or times out
  let title = baseName
  let subtitle = ''
  let genre = 'Fiction'
  let tone = 'To be determined'
  let premise = ''

  try {
    const sample = text.split(/\s+/).slice(0, 2000).join(' ')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a literary analyst. Return valid JSON only — no markdown, no explanation.',
          },
          {
            role: 'user',
            content: `From this manuscript excerpt return a JSON object with exactly these keys:
- title: book title (from the text if visible, otherwise infer)
- subtitle: subtitle if present, otherwise ""
- genre: one genre label (e.g. "Literary Fiction", "Thriller", "Self-Help")
- tone: 3-6 words describing the tone (e.g. "Dark and introspective")
- premise: 2-3 sentence summary of the book

Manuscript:
${sample}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    })

    clearTimeout(timeout)

    if (res.ok) {
      const json = await res.json()
      const raw = json.choices[0].message.content.trim()
      const parsed = JSON.parse(raw.replace(/^```json|```$/g, '').trim())
      title = parsed.title || title
      subtitle = parsed.subtitle || ''
      genre = parsed.genre || genre
      tone = parsed.tone || tone
      premise = parsed.premise || ''
    }
  } catch {
    // Use defaults — book still gets created
  }

  const ownerId = ctx.isSuperAdmin && ownerIdOverride ? ownerIdOverride : ctx.userId
  const supabase = createAdminClient()

  const { data: book, error } = await supabase
    .from('writer_books')
    .insert({
      title,
      subtitle: subtitle || null,
      genre,
      tone,
      premise,
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
