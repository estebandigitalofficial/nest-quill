// Shared guardrail helpers for all student-facing learning tools.
// Import from here rather than duplicating across routes.
import { getSetting } from '@/lib/settings/appSettings'

// Historical and civics topics that are always safe to explain
export const HISTORICAL_SAFE = [
  'constitution', 'bill of rights', 'amendment', 'civil war',
  'world war', 'revolutionary war', 'founding fathers', 'american revolution',
  'declaration of independence', 'branches of government',
  'checks and balances', 'three branches', 'supreme court',
  'congress', 'senate', 'house of representatives', 'electoral college',
  'voting rights', 'how does voting work', 'history of', 'ancient', 'roman', 'greek',
  'medieval', 'renaissance', 'cold war', 'slavery', 'reconstruction',
  'civil rights movement', 'suffrage', 'emancipation', 'magna carta',
  'french revolution', 'industrial revolution',
]

// Partisan or opinion-seeking keywords — ask for clarification
export const PARTISAN_KEYWORDS = [
  'democrat', 'republican', 'democrats', 'republicans',
  'liberals', 'conservatives', 'far left', 'far right',
  'maga', 'antifa', 'political party', 'left wing', 'right wing',
  'left-wing', 'right-wing',
]

// Debate/persuasion phrases — redirect to safe use
export const DEBATE_PHRASES = [
  'who is better', 'who is worse', 'is better than', 'should i vote',
  'who should win', 'which is better', 'who is wrong',
  'is right or wrong', 'is good or bad', 'should i support',
  'who do you like', 'do you agree', 'is evil',
]

// Vague political terms that need clarification without historical context
export const VAGUE_POLITICAL = [
  'politics', 'political', 'election', 'voting', 'campaign',
  'politician', 'government scandal', 'political debate',
]

export function classifyTopic(input: string): 'safe' | 'clarify' | 'redirect' {
  const lower = input.toLowerCase()

  if (DEBATE_PHRASES.some(p => lower.includes(p))) return 'redirect'

  const isHistorical = HISTORICAL_SAFE.some(kw => lower.includes(kw))
  if (isHistorical) return 'safe'

  if (PARTISAN_KEYWORDS.some(kw => lower.includes(kw))) return 'clarify'
  if (VAGUE_POLITICAL.some(kw => lower.includes(kw))) return 'clarify'

  return 'safe'
}

export const CLARIFY_MESSAGE =
  "Are you asking about a history or civics topic you're learning in school? I can explain how government works in a general, educational way—can you be a bit more specific about what you're studying?"

export const REDIRECT_MESSAGE =
  "I can help explain school topics like math, science, reading, or history. Try asking about something you're learning."

// Appended to all student-facing learning system prompts
export const NEUTRALITY_RULE =
  'Keep all content neutral, age-appropriate, and free from political, cultural, religious, or social bias. ' +
  'Do not advocate for any viewpoint, take sides, or frame one group, belief, or perspective as better or worse than another.'

// Reads both safety flags from app_settings in a single round-trip.
// neutralityRule is '' when strict_school_safe_mode is off (omit from prompts).
// politicalClarificationEnabled controls whether classifyTopic() is run.
export async function getActiveGuardrails(): Promise<{
  neutralityRule: string
  politicalClarificationEnabled: boolean
}> {
  const [schoolSafe, politicalClarify] = await Promise.all([
    getSetting('strict_school_safe_mode', true),
    getSetting('political_clarification_enabled', true),
  ])
  return {
    neutralityRule: schoolSafe ? NEUTRALITY_RULE : '',
    politicalClarificationEnabled: politicalClarify as boolean,
  }
}
