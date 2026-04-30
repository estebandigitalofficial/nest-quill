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

  const src = book.source_text as string
  const len = src.length

  // Multi-point sampling: beginning always included, mid and end added when
  // the manuscript is long enough that a single excerpt would be unrepresentative.
  const beginning = src.slice(0, 20000)
  let sample = beginning

  if (len > 30000) {
    const midPoint = Math.floor(len / 2)
    const middle = src.slice(Math.max(20000, midPoint - 6000), midPoint + 6000)
    sample += `\n\n[MID-MANUSCRIPT EXCERPT — approximately ${Math.round(midPoint / 5)} words in]\n${middle}`
  }

  if (len > 55000) {
    const ending = src.slice(Math.max(len - 8000, 32000))
    sample += `\n\n[FINAL SECTION]\n${ending}`
  }

  const systemPrompt = `You are a senior literary editor performing an initial manuscript assessment.

Your job is to extract accurate, specific, grounded information from the manuscript text provided. Do not generalize. Do not invent.

Rules:
- Base every observation on what is actually in the text — not assumptions about the genre or what books like this usually contain
- Be specific: a vague genre label or generic tone description is useless — name the distinguishing characteristics of this particular manuscript
- voice_notes must be concrete and actionable enough that an AI writing model could use them to match the author's style without reading the manuscript itself
- Do not use filler or flattering language in any field ("the author skillfully...", "this compelling narrative...", "readers will find...")
- If something genuinely cannot be determined from the excerpts provided, say so briefly — do not fill the gap with guesswork

Return valid JSON only. No markdown, no explanation, no text outside the JSON object.`

  const userPrompt = `Analyze this manuscript and return a JSON object with exactly these keys:

title
The book's title as it appears in the text. If not explicitly stated, infer from the content. Do not leave blank.

subtitle
Subtitle if present in the text, otherwise empty string "".

genre
The single most accurate genre label for this specific manuscript. Be precise, not broad.
Good: "Narrative Memoir", "Business Self-Help", "Psychological Thriller", "Practical Nonfiction", "Literary Fiction", "Spiritual Memoir", "Investigative Journalism"
Bad: "Fiction", "Nonfiction", "Self-Help", "Memoir" (too broad to be useful)

tone
4-8 words or a short phrase capturing the actual tonal register of this writing as it reads on the page. Not adjectives stacked together — describe how it sounds and feels.
Good: "Candid and dry — restrained emotion, occasional wry humor", "Urgent and confessional — raw but tightly controlled", "Warm and practical — conversational authority without condescension"
Bad: "Engaging and compelling", "Dark and mysterious", "Heartfelt and moving"

premise
2-3 sentences: what this book is about, what the central tension or argument is, and what the reader is meant to take away from it. Ground this in what the text actually contains.

audience
Who this book is specifically for. Do not say "general readers" or "anyone who...". Describe the life experience, background, situation, or mindset of the reader who will most strongly connect with this material. 2-3 sentences.

purpose
What this book appears to be trying to do for its reader — not the subject matter, but the intended effect. What should the reader feel, understand, or be able to do after reading this that they could not before? 1-2 sentences. Be specific.

voice_notes
A concrete description of the author's prose voice for direct use by an AI writing model. Must include:
- Sentence length and rhythm patterns (short declarative, long flowing, or specifically how they mix)
- Point of view and narrative distance (close first-person, removed third, direct address, etc.)
- Vocabulary register (formal, conversational, technical, literary, colloquial — be specific)
- Any recurring structural or stylistic signatures observed in this text
- What generic AI prose patterns this voice would NOT tolerate (filler phrases, overly ornate description, emotional over-explanation, etc.)
Write 3-5 sentences. This field will be used directly to guide AI generation — vague is useless.

structural_notes
Observations about the manuscript's current organization: how it is structured, what is working structurally, what appears to be missing or out of sequence, and the single most important structural decision the author faces. 2-4 sentences.

---

Manuscript (may include multiple sections from different points in the book):
${sample}`

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
      temperature: 0.2,
      max_tokens: 1500,
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
    metadata = JSON.parse(raw.replace(/^```json|^```|```$/gm, '').trim())
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }

  // Save only the fields that exist in the current schema.
  // audience, purpose, voice_notes, structural_notes are returned in the payload
  // but not yet persisted — they will be saved once those columns are added.
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
