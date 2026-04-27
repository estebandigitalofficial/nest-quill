import { NextRequest, NextResponse } from 'next/server'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'

// ── Topic classification helpers ──────────────────────────────────────────────

// Historical and civics topics that are always safe to explain
const HISTORICAL_SAFE = [
  'constitution', 'bill of rights', 'amendment', 'civil war',
  'world war', 'revolutionary war', 'founding fathers', 'american revolution',
  'declaration of independence', 'branches of government',
  'checks and balances', 'three branches', 'supreme court',
  'congress', 'senate', 'house of representatives', 'electoral college',
  'how does voting work', 'history of', 'ancient', 'roman', 'greek',
  'medieval', 'renaissance', 'cold war', 'slavery', 'reconstruction',
  'civil rights movement', 'suffrage', 'emancipation', 'magna carta',
  'french revolution', 'industrial revolution',
]

// Partisan or opinion-seeking keywords — ask for clarification
const PARTISAN_KEYWORDS = [
  'democrat', 'republican', 'democrats', 'republicans',
  'liberal', 'conservatives', 'far left', 'far right',
  'maga', 'antifa', 'political party', 'left wing', 'right wing',
  'left-wing', 'right-wing',
]

// Debate/persuasion phrases — redirect to safe use
const DEBATE_PHRASES = [
  'who is better', 'who is worse', 'is better than', 'should i vote',
  'who should win', 'which is better', 'who is right', 'who is wrong',
  'is right or wrong', 'is good or bad', 'should i support',
  'who do you like', 'do you agree', 'is evil', 'is bad',
]

// Vague political terms that need clarification without historical context
const VAGUE_POLITICAL = [
  'politics', 'political', 'election', 'voting', 'campaign',
  'politician', 'government scandal', 'political debate',
]

function classifyTopic(input: string): 'safe' | 'clarify' | 'redirect' {
  const lower = input.toLowerCase()

  // Debate/persuasion phrases are always redirected
  if (DEBATE_PHRASES.some(p => lower.includes(p))) return 'redirect'

  // If the topic contains historical/civics context, allow it through
  const isHistorical = HISTORICAL_SAFE.some(kw => lower.includes(kw))
  if (isHistorical) return 'safe'

  // Partisan keywords without historical context → clarify
  if (PARTISAN_KEYWORDS.some(kw => lower.includes(kw))) return 'clarify'

  // Vague political terms without historical context → clarify
  if (VAGUE_POLITICAL.some(kw => lower.includes(kw))) return 'clarify'

  return 'safe'
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'explain')
  if (limited) return limited

  try {
    const { topic, grade } = await request.json() as { topic: string; grade?: number }

    const topicTrimmed = topic?.trim() ?? ''

    // ── Input validation ──────────────────────────────────────────────────────
    if (topicTrimmed.length < 10) {
      return NextResponse.json(
        { message: 'Please enter a more specific topic (at least 10 characters) so I can explain it well.' },
        { status: 400 }
      )
    }
    if (topicTrimmed.length > 1000) {
      return NextResponse.json(
        { message: 'That topic is a bit long. Try shortening it to a single concept or question.' },
        { status: 400 }
      )
    }

    // ── Topic classification ──────────────────────────────────────────────────
    const classification = classifyTopic(topicTrimmed)

    if (classification === 'redirect') {
      return NextResponse.json(
        { message: 'I can help explain school topics like math, science, reading, or history. Try asking about something you\'re learning.' },
        { status: 422 }
      )
    }

    if (classification === 'clarify') {
      return NextResponse.json(
        { message: 'Are you asking about a history or civics topic you\'re learning in school? I can explain how government works in a general, educational way—can you be a bit more specific about what you\'re studying?' },
        { status: 422 }
      )
    }

    // ── Generate explanation ──────────────────────────────────────────────────
    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const ageLabel   = grade ? `a ${4 + grade}-${5 + grade} year old` : 'a young student'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an educational assistant for students (grades 1–8). You are explaining to ${ageLabel} in ${gradeLabel}.

Explain concepts in a simple, clear, and age-appropriate way.

Rules:
- Focus on helping the student understand step-by-step
- Do not provide direct answers to tests or assignments
- Keep explanations neutral, factual, and easy to understand
- Do not engage in political opinions, debates, persuasion, or advocacy
- Do not show political, cultural, religious, or social bias
- Present information in a balanced, neutral way
- Avoid framing one side, group, belief, or viewpoint as better or worse
- Avoid current events or controversial modern topics unless clearly handled as neutral educational content

Handling political topics:
- If the topic is clearly historical or civics-related (e.g., Constitution, branches of government, past events), explain it normally in a neutral, educational way
- If the topic is vague or could be modern/political, ask a clarifying question instead of answering
- Never take sides or express opinions

If a topic is unclear or not appropriate, gently guide the student toward a safe, school-related explanation.

Output valid JSON:
{
  "summary": "2-3 sentence plain-language summary",
  "analogy": "a relatable real-world analogy that makes it click",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "fun_fact": "one surprising or interesting fact about this topic",
  "try_this": "a simple hands-on activity or thing to try at home"
}`,
          },
          {
            role: 'user',
            content: `Explain "${topicTrimmed}" to a ${gradeLabel} student.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[learning/explain] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate explanation.' }, { status: 500 })
    }

    const json   = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[learning/explain] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
