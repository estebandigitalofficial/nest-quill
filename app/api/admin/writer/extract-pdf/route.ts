import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

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

  // Use the first ~2000 words to infer book metadata (keep prompt small and fast)
  const sample = text.split(/\s+/).slice(0, 2000).join(' ')

  let metadata: { title: string; subtitle: string; genre: string; tone: string; premise: string } = {
    title: '', subtitle: '', genre: '', tone: '', premise: '',
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

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

    clearTimeout(timeout)

    if (res.ok) {
      const json = await res.json()
      const raw = json.choices[0].message.content.trim()
      const parsed = JSON.parse(raw.replace(/^```json|```$/g, '').trim())
      metadata = { ...metadata, ...parsed }
    }
  } catch {
    // If AI inference fails or times out, return text-only — form stays editable
  }

  return NextResponse.json({
    text,
    fileName: file.name,
    wordCount: text.split(/\s+/).length,
    metadata,
  })
}
