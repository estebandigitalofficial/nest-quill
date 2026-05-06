import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toApiError } from '@/lib/utils/errors'
import {
  buildActivityPrompt,
  validateActivityPayload,
  type ActivityType,
} from '@/lib/services/postStoryActivities'

type RouteContext = { params: Promise<{ requestId: string; type: string }> }

const VALID: ActivityType[] = ['trivia', 'matching', 'fill_in_the_blank', 'puzzle', 'flashcards']

// GET /api/story/[requestId]/activities/[type]
// Generates an activity payload on demand from the completed story content.
// Quiz isn't served here — it lives in story_quizzes and uses the existing
// /api/story/[requestId]/quiz route. Flashcards are also generated here
// (separate from the standalone Study Helper flow which uses pasted text).
// Five supported types are listed in VALID above.
//
// Ownership: completed-story UUIDs are unguessable and act as capability
// tokens (same model as the existing /quiz GET). We still gate on status
// being 'complete' so in-progress stories don't accidentally generate.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { requestId, type } = await params

    if (!VALID.includes(type as ActivityType)) {
      return NextResponse.json({ message: 'Unsupported activity type.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: storyReq } = await admin
      .from('story_requests')
      .select('id, status, learning_mode, learning_grade, learning_subject')
      .eq('id', requestId)
      .single()

    if (!storyReq) return NextResponse.json({ message: 'Story not found' }, { status: 404 })
    if (storyReq.status !== 'complete') {
      return NextResponse.json({ message: 'Story not yet complete' }, { status: 404 })
    }

    // Pull the generated story text. We concat page text — the worker stores
    // pages on `generated_stories.full_text_json` as `[{ page, text, ... }]`.
    const { data: story } = await admin
      .from('generated_stories')
      .select('full_text_json')
      .eq('request_id', requestId)
      .single()

    if (!story?.full_text_json) {
      return NextResponse.json({ message: 'Story content not found' }, { status: 404 })
    }

    const pages = (story.full_text_json as Array<{ text?: string }> | null) ?? []
    const content = pages.map(p => (p?.text ?? '').trim()).filter(Boolean).join('\n\n')

    if (content.length < 60) {
      return NextResponse.json({ message: 'Story is too short for this activity.' }, { status: 422 })
    }

    const prompt = buildActivityPrompt({
      type: type as ActivityType,
      content,
      grade: storyReq.learning_grade,
      subject: storyReq.learning_subject,
    })
    if (!prompt) {
      return NextResponse.json({ message: 'No prompt for this activity.' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: 'Activity generation is unavailable right now.' }, { status: 503 })
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user',   content: prompt.user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      console.error('[activities] OpenAI error:', await res.text().catch(() => ''))
      return NextResponse.json({ message: 'Could not generate activity. Try another one.' }, { status: 502 })
    }

    const json = await res.json()
    let parsed: unknown
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
    } catch {
      return NextResponse.json({ message: 'Activity output was not valid JSON.' }, { status: 502 })
    }

    const payload = validateActivityPayload(type as ActivityType, parsed)
    if (!payload) {
      return NextResponse.json({ message: 'Activity output failed validation.' }, { status: 502 })
    }

    return NextResponse.json(payload)
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
