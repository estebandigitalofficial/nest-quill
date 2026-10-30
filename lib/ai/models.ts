// The ONE place the Next.js app names OpenAI text models and builds Chat
// Completions requests. Route handlers import a workload constant from here
// and call `chatCompletion()` (plain fetch) or spread `chatParams()` into
// the OpenAI SDK; none of them carry a model literal of their own
// (lib/ai/models.test.ts scans for that).
//
// Model facts, the retired-model guard and the request builder live in
// ./textProvider.ts, a byte-identical mirror of the story worker's copy, so
// the worker and the app can never disagree about what is retired.
import {
  TEXT_MODELS,
  buildChatRequest,
  postChatCompletion,
  type ChatMessage,
  type ChatRequestBody,
  type ReasoningEffort,
} from './textProvider.ts'

export { TEXT_MODELS, isRetiredTextModel, resolveTextModel } from './textProvider.ts'

/** Quilliam, the customer chat assistant: streamed, short, latency-sensitive. */
export const CHAT_ASSISTANT_MODEL: string = TEXT_MODELS.fast

/** Long-form writing and manuscript analysis (Writer Studio, legacy story service). */
export const WRITING_MODEL: string = TEXT_MODELS.quality

/** Focused JSON tasks: learning tools, story activities, study helper, assignments, bulk content, proofreading, vision extraction. */
export const UTILITY_MODEL: string = TEXT_MODELS.fast

export interface ChatCallOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  jsonMode?: boolean
  /** Upper bound on generated tokens (sent as max_completion_tokens). */
  maxOutputTokens?: number
  reasoningEffort?: ReasoningEffort
}

/**
 * Request parameters for the OpenAI SDK (`openai.chat.completions.create`).
 * Same builder as the fetch path, so the SDK call gets reasoning_effort,
 * max_completion_tokens (never max_tokens) and temperature rules identical
 * to every other call in the app.
 */
export function chatParams(opts: ChatCallOptions & { stream?: boolean }): ChatRequestBody {
  return buildChatRequest(opts)
}

/**
 * POST to Chat Completions with the app's API key and return the Response
 * so each route keeps its own `res.ok` handling and error copy. Retries
 * once without a parameter the API reports as unsupported for the model.
 */
export async function chatCompletion(opts: ChatCallOptions): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  const { res, dropped, body } = await postChatCompletion(fetch, apiKey, buildChatRequest(opts))
  if (dropped) console.warn(`[openai] '${dropped}' rejected for ${body.model}; retried without it`)
  return res
}
