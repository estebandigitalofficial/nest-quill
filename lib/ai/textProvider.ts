// OpenAI Chat Completions contract shared by the story worker and the
// Next.js app. This file is mirrored byte-for-byte between
// supabase/functions/process-story/textProvider.ts (Deno) and
// lib/ai/textProvider.ts (Node/Next); lib/ai/models.test.ts enforces the
// mirror. It has no Deno, Node or Next imports and reads no environment,
// so both runtimes (and plain Node tests) use the same code.
//
// Why this exists (2026-10-30): OpenAI retires the GPT-4 series from the
// API. Per developers.openai.com/api/docs/deprecations: gpt-4, gpt-4-turbo,
// gpt-4.1-nano and gpt-4o-2024-05-13 shut down on 2026-10-23; gpt-4o,
// gpt-4o-mini, gpt-4.1 and gpt-4.1-mini (all remaining snapshots) shut
// down on 2027-01-14. OpenAI's stated replacement is gpt-6-luna. The
// current catalogue (developers.openai.com/api/docs/models) lists
// gpt-6-astra, gpt-6.1-sol, gpt-6.1-terra and gpt-6-luna, all of which
// are reasoning models that serve Chat Completions.
//
// Compatibility notes that shape the request builder below:
// - Reasoning models accept `temperature` / `top_p` only when
//   `reasoning_effort` is `none` ("Using GPT-6" guide: "When reasoning
//   effort is not none, remove temperature, top_p, and top_logprobs").
//   gpt-6-astra and gpt-6.1-sol do not support `none` at all.
// - `max_tokens` is deprecated in favour of `max_completion_tokens`, which
//   also bounds reasoning tokens.
// - JSON mode (`response_format: { type: 'json_object' }`) is still a
//   documented Chat Completions parameter; the prompts that use it already
//   say "JSON" as the API requires. Because the docs do not spell out model
//   support, `compatibilityFallback` drops exactly the parameter the API
//   names in a 400 `unsupported_parameter` / `unsupported_value` error and
//   lets the caller retry once, so a documentation gap cannot take a
//   production request down.

export const CHAT_COMPLETIONS_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * Workload defaults. Not every retired model maps to the same replacement:
 * - `quality`: long-form writing where prose quality is the product (story
 *   plan + book text, Writer Studio drafting/analysis). gpt-6.1-terra is the
 *   model OpenAI positions for "clear, natural writing"; at $1/$5 per 1M
 *   tokens it is cheaper than gpt-4o was ($2.50/$10).
 * - `fast`: focused, high-volume or latency-sensitive tasks (Quilliam chat,
 *   learning tools, activity/quiz JSON, vision extraction, proofreading).
 *   gpt-6-luna is OpenAI's named replacement for the GPT-4 series and costs
 *   $0.10/$0.50 per 1M tokens (gpt-4o-mini was $0.15/$0.60).
 */
export const TEXT_MODELS = {
  quality: 'gpt-6.1-terra',
  fast: 'gpt-6-luna',
} as const

export type TextWorkload = keyof typeof TEXT_MODELS

/** The worker's story-text default (plan + book); overridable via PROCESS_STORY_TEXT_MODEL. */
export const DEFAULT_TEXT_MODEL: string = TEXT_MODELS.quality

/**
 * `none` keeps the gpt-4o-era behaviour (no hidden reasoning tokens, bounded
 * latency inside the 150 s Edge budget, `temperature` honoured). Raise to
 * `low` deliberately if story quality calls for it; that also means dropping
 * `temperature` (the builder does this automatically).
 */
export const DEFAULT_REASONING_EFFORT = 'none'

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * Model IDs retired or scheduled for retirement from the API, as listed on
 * developers.openai.com/api/docs/deprecations (read 2026-10-30). Matched as
 * prefixes so dated snapshots (gpt-4o-2024-08-06) and variants
 * (gpt-4o-mini, gpt-4.1-nano) are caught. A stored setting or env var naming
 * any of these is rejected by `resolveTextModel`, never sent.
 */
export const RETIRED_TEXT_MODEL_PREFIXES: readonly string[] = [
  'gpt-4o',            // gpt-4o, gpt-4o-mini and every dated snapshot: 2027-01-14 (2024-05-13 snapshot: 2026-10-23)
  'chatgpt-4o-latest', // ChatGPT alias of the same family
  'gpt-4.1',           // gpt-4.1, gpt-4.1-mini: 2027-01-14; gpt-4.1-nano: 2026-10-23
  'gpt-4-',            // gpt-4-0613, gpt-4-turbo*, gpt-4-1106-preview, gpt-4-32k*, gpt-4-vision-preview
]

export function isRetiredTextModel(model: string | null | undefined): boolean {
  const v = (model ?? '').trim().toLowerCase()
  if (!v) return false
  if (v === 'gpt-4') return true // bare alias of gpt-4-0613, shut down 2026-10-23
  return RETIRED_TEXT_MODEL_PREFIXES.some(p => v.startsWith(p))
}

export interface ResolvedModel {
  model: string
  source: 'default' | 'override' | 'rejected_override'
  /** The override that was refused, when source is rejected_override. */
  rejected?: string
}

/**
 * Pick the model for a request: a non-empty override wins unless it names a
 * retired model, in which case the default is used and the rejection is
 * reported so the caller can log it. Unknown (non-retired) IDs are allowed
 * through so a newer model can be adopted without a redeploy.
 */
export function resolveTextModel(override: string | null | undefined, fallback: string = DEFAULT_TEXT_MODEL): ResolvedModel {
  const v = (override ?? '').trim()
  if (!v) return { model: fallback, source: 'default' }
  if (isRetiredTextModel(v)) return { model: fallback, source: 'rejected_override', rejected: v }
  return { model: v, source: 'override' }
}

export interface ChatMessage {
  role: string
  content: unknown
}

export interface ChatRequestOptions {
  model: string
  messages: ChatMessage[]
  /** Sent only when the effective reasoning effort is `none`. */
  temperature?: number
  /** `response_format: { type: 'json_object' }` (JSON mode). */
  jsonMode?: boolean
  /** Becomes `max_completion_tokens` (bounds visible + reasoning tokens). */
  maxOutputTokens?: number
  reasoningEffort?: ReasoningEffort
  stream?: boolean
}

export interface ChatRequestBody {
  model: string
  messages: ChatMessage[]
  reasoning_effort?: ReasoningEffort
  temperature?: number
  response_format?: { type: 'json_object' }
  max_completion_tokens?: number
  stream?: boolean
}

/** The exact Chat Completions request body. Never emits the deprecated `max_tokens`. */
export function buildChatRequest(opts: ChatRequestOptions): ChatRequestBody {
  const effort: ReasoningEffort = opts.reasoningEffort ?? DEFAULT_REASONING_EFFORT
  const body: ChatRequestBody = {
    model: opts.model,
    messages: opts.messages,
    reasoning_effort: effort,
  }
  if (typeof opts.temperature === 'number' && Number.isFinite(opts.temperature) && effort === 'none') {
    body.temperature = opts.temperature
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }
  if (typeof opts.maxOutputTokens === 'number' && Number.isFinite(opts.maxOutputTokens) && opts.maxOutputTokens > 0) {
    body.max_completion_tokens = Math.floor(opts.maxOutputTokens)
  }
  if (opts.stream) body.stream = true
  return body
}

/** Request parameters a 400 may legitimately reject for a given model; each is optional to the product. */
const DROPPABLE_PARAMS = ['temperature', 'response_format', 'reasoning_effort', 'max_completion_tokens'] as const
type DroppableParam = typeof DROPPABLE_PARAMS[number]

/**
 * Read `error.param` / `error.code` out of an OpenAI error body
 * (`{"error":{"message","type","param","code"}}`), tolerating plain text.
 */
export function parseOpenAIError(text: string | null | undefined): { message: string; param: string | null; code: string | null } {
  const raw = String(text ?? '')
  try {
    const j = JSON.parse(raw) as { error?: { message?: unknown; param?: unknown; code?: unknown } }
    const e = j?.error ?? {}
    return {
      message: typeof e.message === 'string' ? e.message : raw,
      param: typeof e.param === 'string' ? e.param : null,
      code: typeof e.code === 'string' ? e.code : null,
    }
  } catch {
    return { message: raw, param: null, code: null }
  }
}

/**
 * When a 400 says one optional parameter is unsupported for this model,
 * return the same body without it so the caller can retry ONCE. Returns
 * null for every other failure (auth, 429, 5xx, prompt/content errors) so
 * those keep their existing handling. The dropped parameter is reported so
 * it can be logged.
 */
export function compatibilityFallback(status: number, errorText: string | null | undefined, body: ChatRequestBody): { body: ChatRequestBody; dropped: DroppableParam } | null {
  if (status !== 400) return null
  const err = parseOpenAIError(errorText)
  let param = err.param
  if (!param) {
    const m = /unsupported (?:parameter|value):\s*'([a-z_.]+)'/i.exec(err.message)
    param = m ? m[1] : null
  }
  if (!param) return null
  const top = param.split('.')[0].split('[')[0] as DroppableParam
  if (!(DROPPABLE_PARAMS as readonly string[]).includes(top)) return null
  if (!(top in body)) return null
  const next: ChatRequestBody = { ...body }
  delete next[top]
  return { body: next, dropped: top }
}

export interface ChatUsage {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
}

export interface ChatResult {
  content: string
  usage: ChatUsage
  /** The model the API reports it served; falls back to the requested one. */
  model: string
}

/** Pull content, usage and served model out of a (non-streaming) chat completion. */
export function parseChatResponse(json: unknown, requestedModel: string): ChatResult {
  const j = (json ?? {}) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: Record<string, unknown>; model?: unknown }
  const u = j.usage ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const content = j.choices?.[0]?.message?.content
  return {
    content: typeof content === 'string' ? content : '',
    usage: { prompt_tokens: num(u.prompt_tokens), completion_tokens: num(u.completion_tokens), total_tokens: num(u.total_tokens) },
    model: typeof j.model === 'string' && j.model ? j.model : requestedModel,
  }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>

export interface PostChatResult {
  res: Response
  /** The body actually sent (after a compatibility retry, the trimmed one). */
  body: ChatRequestBody
  /** Set when one parameter was dropped and the request retried. */
  dropped: DroppableParam | null
}

/**
 * POST the request; on a 400 that names an unsupported optional parameter,
 * drop it and retry once. Any other response (including the second attempt,
 * whatever its status) is returned to the caller untouched so existing
 * `res.ok` handling, logging and failure classification keep working.
 */
export async function postChatCompletion(fetchImpl: FetchLike, apiKey: string, body: ChatRequestBody): Promise<PostChatResult> {
  const send = (b: ChatRequestBody) => fetchImpl(CHAT_COMPLETIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(b),
  })
  const first = await send(body)
  if (first.ok || first.status !== 400) return { res: first, body, dropped: null }
  const text = await first.clone().text().catch(() => '')
  const fb = compatibilityFallback(first.status, text, body)
  if (!fb) return { res: first, body, dropped: null }
  const second = await send(fb.body)
  return { res: second, body: fb.body, dropped: fb.dropped }
}
