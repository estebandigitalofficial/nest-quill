import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()
  const { data: book } = await supabase
    .from('writer_books')
    .select('source_text, source_pdf_name')
    .eq('id', bookId)
    .single()

  if (!book?.source_text) {
    return NextResponse.json({ error: 'No source manuscript to analyze' }, { status: 400 })
  }

  const sample = (book.source_text as string).split(/\s+/).slice(0, 2000).join(' ')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
- premise: 2-3 sentence summary of the book — characters, conflict, stakes

Manuscript:
${sample}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.choices[0].message.content.trim()

  let metadata: Record<string, string>
  try {
    metadata = JSON.parse(raw.replace(/^```json|```$/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  await supabase
    .from('writer_books')
    .update({
      title: metadata.title || book.source_pdf_name?.replace(/\.pdf$/i, '') || 'Untitled',
      subtitle: metadata.subtitle || null,
      genre: metadata.genre || '',
      tone: metadata.tone || '',
      premise: metadata.premise || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId)

  return NextResponse.json({ success: true, metadata })
}
