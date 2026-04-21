import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { text } = await request.json()
  if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

  const sample = (text as string).split(/\s+/).slice(0, 2000).join(' ')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a literary analyst. Extract book metadata from manuscript text and return valid JSON only — no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `From this manuscript excerpt, extract:
- title: the book title (exact, from the text if visible, otherwise infer)
- subtitle: subtitle if present, otherwise empty string
- genre: one concise genre label (e.g. "Literary Fiction", "Thriller", "Self-Help")
- tone: 3-6 word description of the writing tone (e.g. "Dark and introspective", "Warm and conversational")
- premise: 2-3 sentence summary of what the book is about — characters, conflict, stakes

Return ONLY a JSON object with those five keys.

Manuscript excerpt:
${sample}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'AI inference failed' }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.choices[0].message.content.trim()

  try {
    const metadata = JSON.parse(raw.replace(/^```json|```$/g, '').trim())
    return NextResponse.json({ metadata })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
  }
}
