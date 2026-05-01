import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { classifyTopic, CLARIFY_MESSAGE, REDIRECT_MESSAGE, NEUTRALITY_RULE } from '@/lib/utils/learningGuardrails'

const SYSTEM_PROMPT = `You are the Nest & Quill assistant — a warm, friendly helper for a personalized AI-powered children's storybook service. You help in two ways:

STORY CREATION HELP: Help parents brainstorm and craft the perfect story for their child.
- Suggest creative themes (adventure, friendship, bravery, curiosity, kindness, bedtime, etc.)
- Help develop the child's character — their traits, interests, quirks to weave in
- Suggest story morals or lessons
- Recommend illustration styles (watercolor, cartoon, storybook, pencil sketch, digital art)
- Help write a meaningful dedication
- Suggest story tones: funny, heartwarming, adventurous, magical, calming, silly

PRODUCT SUPPORT: Answer questions about how Nest & Quill works.

How it works:
- Parents fill out a short form: child's name, age, theme, tone, and any special details
- AI writes a complete illustrated storybook starring the child as the main character
- Each page gets a custom illustration in the chosen art style
- Stories are ready in about 2 minutes
- Users get email delivery and can read online; paid plans include a full PDF download

Pricing (currently all free during beta — payments coming soon):
- Free: 1 story trial, 8 pages max, watercolor style only
- Single Story: $7.99 one-time — 24 pages, all illustration styles, full PDF, dedication page
- Story Pack: $9.99/mo (or $99/yr) — 3 stories/month, 24 pages each, full PDF
- Story Pro (most popular): $24.99/mo (or $249/yr) — 10 stories/month, 32 pages, priority processing
- Educator: $59/mo — 40 stories/month, classroom management (contact us)

Illustration styles: Watercolor, Cartoon, Storybook (classic painted fairy-tale), Pencil Sketch, Digital Art.
Free plan: Watercolor only. All paid plans: all 5 styles.

Keep responses warm, concise (2–4 sentences unless more detail is needed), and family-friendly.
If someone wants to create a story now, direct them to /create.

${NEUTRALITY_RULE}`

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

function guardedStream(text: string): Response {
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

const SPANISH_SYSTEM_NOTE = `\n\nIMPORTANT: The user has selected Spanish. You MUST respond entirely in Spanish for every message. All your responses, including product information, suggestions, and support, must be in Spanish.`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('Bad request', { status: 400 })
  }

  const language: string = body.language ?? 'en'
  const messages = body.messages.slice(-20) // any[] — passed directly to OpenAI SDK

  // Classify the latest user message and short-circuit before calling AI if needed
  const lastUserMsg = [...messages].reverse().find((m: Record<string, unknown>) => m.role === 'user')
  if (lastUserMsg && typeof lastUserMsg.content === 'string') {
    const classification = classifyTopic(lastUserMsg.content)
    if (classification === 'redirect') return guardedStream(REDIRECT_MESSAGE)
    if (classification === 'clarify') return guardedStream(CLARIFY_MESSAGE)
  }

  const systemPrompt = language === 'es' ? SYSTEM_PROMPT + SPANISH_SYSTEM_NOTE : SYSTEM_PROMPT

  const stream = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 600,
    temperature: 0.7,
  })

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) controller.enqueue(new TextEncoder().encode(delta))
      }
      controller.close()
    },
    cancel() {
      stream.controller.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
