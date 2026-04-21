import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

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
    .select('title, genre, tone, premise, source_text')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  if (!book.source_text) return NextResponse.json({ error: 'No source manuscript uploaded' }, { status: 400 })

  const systemPrompt = `You are an expert book editor reviewing a manuscript draft.
The book is a ${book.genre} with tone: ${book.tone}.
Premise: ${book.premise}

Provide honest, specific, actionable editorial feedback. Be direct and constructive.`

  const userPrompt = `Please review this manuscript and provide editorial feedback structured as follows:

1. **Overall Assessment** — 2-3 sentences on the manuscript's current state and main strengths
2. **What's Working** — 3-5 specific things done well (with examples from the text)
3. **Key Issues to Address** — the most important problems to fix (be specific, reference the text)
4. **Chapter-by-Chapter Notes** — brief notes on each chapter: pacing, characterization, plot
5. **Style & Voice** — observations on prose quality, consistency, distinctive voice
6. **Recommended Next Steps** — concrete, prioritized list of revisions

Manuscript:
${book.source_text.slice(0, 80000)}`  // cap at ~80k chars to stay within context

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI error ${res.status}: ${err}`)
    }

    const json = await res.json()
    const review = json.choices[0].message.content.trim()
    return NextResponse.json({ review })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
