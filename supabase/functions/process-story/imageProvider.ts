// OpenAI Images API contract for the worker (pages, cover, admin backfill).
//
// Source of truth: the official openai-node SDK types (resources/images.ts)
// and developers.openai.com/api/docs. DALL·E models were removed from the
// API on 2026-05-12; GPT Image models always return base64 and reject
// `response_format`. This module is the ONE place that knows the model,
// quality, size and response shape. No Deno/Supabase imports so plain Node
// tests (imageProvider.test.ts) cover it.

export const IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations'

/**
 * gpt-image-2.5-flare: OpenAI's current "fast, high-quality everyday image
 * generation" model (snapshot 2026-09-08). Chosen over gpt-image-2.5-sunburst
 * because Sunburst's advantage is editing/inpainting precision, which this
 * pipeline never uses, at the same per-token price and higher latency; and
 * over gpt-image-1 / 1-mini because both shut down on 2026-12-01. Override
 * with the PROCESS_STORY_IMAGE_MODEL worker secret without a redeploy.
 */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare'

/** Default rendering quality for GPT Image models (low | medium | high | xhigh | max | auto). */
export const DEFAULT_IMAGE_QUALITY = 'medium'

/** Square pages and cover, as before; 1024x1024 is a supported GPT Image size. */
export const DEFAULT_IMAGE_SIZE = '1024x1024'

/** We store and serve PNG; ask the provider for it explicitly. */
export const IMAGE_OUTPUT_FORMAT = 'png'

export const GPT_IMAGE_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] as const
export const GPT_IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto'] as const

/** Map legacy DALL·E quality names (and anything unknown) onto GPT Image values. */
export function normalizeQuality(q: string | null | undefined): typeof GPT_IMAGE_QUALITIES[number] {
  const v = (q ?? '').trim().toLowerCase()
  if ((GPT_IMAGE_QUALITIES as readonly string[]).includes(v)) return v as typeof GPT_IMAGE_QUALITIES[number]
  if (v === 'standard') return 'medium'
  if (v === 'hd') return 'high'
  return DEFAULT_IMAGE_QUALITY
}

/** Map legacy DALL·E sizes (and anything unknown) onto supported GPT Image sizes. */
export function normalizeSize(s: string | null | undefined): typeof GPT_IMAGE_SIZES[number] {
  const v = (s ?? '').trim().toLowerCase()
  if ((GPT_IMAGE_SIZES as readonly string[]).includes(v)) return v as typeof GPT_IMAGE_SIZES[number]
  if (v === '1792x1024') return '1536x1024'
  if (v === '1024x1792') return '1024x1536'
  return DEFAULT_IMAGE_SIZE
}

export interface ImageRequestOptions {
  model?: string | null
  quality?: string | null
  size?: string | null
}

export interface ImageRequestBody {
  model: string
  prompt: string
  n: 1
  size: string
  quality: string
  output_format: 'png'
  moderation: 'auto'
}

/**
 * The exact request body for POST /v1/images/generations. Never includes
 * `response_format` (rejected by GPT Image models, which always return
 * base64) nor `style` (dall-e-3 only).
 */
export function buildImageRequest(prompt: string, opts: ImageRequestOptions = {}): ImageRequestBody {
  const model = (opts.model ?? '').trim() || DEFAULT_IMAGE_MODEL
  return {
    model,
    prompt,
    n: 1,
    size: normalizeSize(opts.size),
    quality: normalizeQuality(opts.quality),
    output_format: IMAGE_OUTPUT_FORMAT,
    moderation: 'auto',
  }
}

export interface ImageUsage {
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
}

export interface ParsedImageResponse {
  b64: string
  /** dall-e-3 only; GPT Image models do not return it on the Images API → null. */
  revisedPrompt: string | null
  /** Token usage when the provider reports it; null otherwise. */
  usage: ImageUsage | null
  outputFormat: string | null
}

/** Pull the first image out of an ImagesResponse. Throws a descriptive error when absent. */
export function parseImageResponse(json: unknown): ParsedImageResponse {
  const j = (json ?? {}) as { data?: Array<{ b64_json?: unknown; revised_prompt?: unknown }>; usage?: Record<string, unknown>; output_format?: unknown }
  const first = Array.isArray(j.data) ? j.data[0] : undefined
  const b64 = typeof first?.b64_json === 'string' ? first.b64_json : ''
  if (!b64) throw new Error('Image error: no b64_json in response')
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const usage = j.usage && typeof j.usage === 'object'
    ? { input_tokens: num(j.usage.input_tokens), output_tokens: num(j.usage.output_tokens), total_tokens: num(j.usage.total_tokens) }
    : null
  return {
    b64,
    revisedPrompt: typeof first?.revised_prompt === 'string' && first.revised_prompt.trim() ? first.revised_prompt : null,
    usage: usage && (usage.input_tokens !== null || usage.output_tokens !== null || usage.total_tokens !== null) ? usage : null,
    outputFormat: typeof j.output_format === 'string' ? j.output_format : null,
  }
}

/** Decode base64 (standard alphabet, optional padding) into bytes; rejects empty/invalid input. */
export function decodeBase64Image(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  if (!clean || !/^[A-Za-z0-9+/]+=*$/.test(clean)) throw new Error('Image error: invalid base64 payload')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  if (out.length < 8) throw new Error('Image error: decoded image is empty')
  return out
}

/** PNG signature check so a provider glitch never stores a non-image. */
export function looksLikePng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return bytes.length >= 8 && sig.every((b, i) => bytes[i] === b)
}

/** Max wait we are willing to spend on one 429 before giving the page up to the normal retry/backfill path. */
export const MAX_RATE_LIMIT_WAIT_MS = 20_000

/**
 * Milliseconds to wait before ONE retry after a 429, from Retry-After
 * (seconds or HTTP date) or a conservative default; capped so the Edge
 * Function wall clock is respected. Returns null when the response is not a 429.
 */
export function rateLimitDelayMs(status: number, retryAfter: string | null, nowMs = Date.now()): number | null {
  if (status !== 429) return null
  let ms = 5_000
  if (retryAfter) {
    const secs = Number(retryAfter)
    if (Number.isFinite(secs) && secs >= 0) ms = secs * 1000
    else {
      const at = Date.parse(retryAfter)
      if (Number.isFinite(at)) ms = Math.max(0, at - nowMs)
    }
  }
  return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS)
}
