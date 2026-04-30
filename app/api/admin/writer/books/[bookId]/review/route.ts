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
    .select('title, genre, tone, premise, instructions, source_text')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  if (!book.source_text) return NextResponse.json({ error: 'No source manuscript uploaded' }, { status: 400 })

  const instructionsBlock = book.instructions
    ? `\nAUTHOR'S STATED INTENT (use this as the lens for evaluation — the book should be judged against what it is trying to be, not against a different standard):\n${book.instructions}\n`
    : ''

  const systemPrompt = `You are a developmental editor and ghostwriter reviewing a manuscript for the author.

Your job is to give the most useful, honest, and specific editorial feedback possible. The author is not looking for encouragement or generic writing advice. They want a clear-eyed assessment of what this manuscript is doing, what it is not doing, and what to fix next.

Rules:
- Reference the actual manuscript. Cite specific passages, scenes, chapter numbers, or representative lines when making a point. Do not make general claims without grounding them in the text.
- Do not soften problems. If a chapter drags, say where and why. If the voice drops, say exactly where it drops and what it drops into.
- Do not offer generic writing advice ("show don't tell", "vary your sentence structure") unless you can connect it directly to a specific example in this manuscript.
- Preserve author intent. The goal is to make this book the best version of what it is trying to be — not to make it sound like a different book.
- Be direct. Avoid phrases like "you might consider", "it could be interesting to", or "one option would be". Say what to do.
- Distinguish between structural problems (hard to fix, high priority) and surface problems (easy to fix, lower priority).
${instructionsBlock}`

  const userPrompt = `Review this manuscript as a developmental editor. Be specific and honest throughout.

Book: "${book.title}"
Genre: ${book.genre}
Tone: ${book.tone}
Premise: ${book.premise}

Structure your review exactly as follows:

---

## 1. Overall Assessment
2-3 sentences only. What is the current state of this manuscript? What is its single biggest strength and its single biggest problem?

## 2. Strongest Material
What is genuinely working? Identify the 3-5 specific moments, chapters, passages, or elements that are most effective — and say concisely why each one works. Be specific: cite chapter numbers, scenes, or representative lines.

## 3. Structure & Pacing
- Does the overall structure serve the book's premise and genre?
- Where does pacing stall? Where does it rush past material that deserves more space?
- Are chapters sequenced logically? Is the opening chapter doing its job? Does the ending pay off what was set up?
- If the structure has a fundamental problem, name it directly.

## 4. Voice & Consistency
- Describe the author's voice in concrete terms (not vague adjectives — be specific about register, rhythm, POV, and personality markers).
- Where does the voice hold? Where does it drift, flatten, or become generic?
- Is the tone consistent with what the premise promises the reader?

## 5. Repetition, Gaps & Missing Pieces
- What ideas, scenes, or points are repeated without earning the repetition?
- What is missing that the reader will notice? (Scenes that are mentioned but skipped, questions raised but unanswered, setups without payoffs)
- What should be cut entirely?

## 6. Critical Issues
List the 3-5 most important problems, in priority order. For each:
- Name the problem precisely
- Give a specific example from the text
- Say what the fix requires (structural revision, rewrite, cut, expand, or move)

## 7. Chapter-by-Chapter Notes
For each chapter: one or two sentences maximum. Note only what matters — pacing, whether the chapter earns its place, a standout moment, or a specific problem. Skip praise unless it is instructive.

## 8. Recommended Next Steps
Concrete, prioritized list. What should the author do first, second, third? Distinguish between revision passes (structural) and line-level passes.

---

Manuscript:
${(book.source_text as string).slice(0, 80000)}`

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
