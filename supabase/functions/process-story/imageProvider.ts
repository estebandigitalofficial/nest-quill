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

/**
 * Image model IDs retired or scheduled for retirement from the API per
 * developers.openai.com/api/docs/deprecations (read 2026-10-30):
 * dall-e-2 / dall-e-3 (2026-05-12), gpt-image-1 (2026-10-23),
 * gpt-image-1-mini, gpt-image-1.5* and chatgpt-image-latest (2026-12-01).
 * Prefix-matched so dated snapshots are caught too. An override naming one
 * of these falls back to DEFAULT_IMAGE_MODEL instead of reaching the API.
 */
export const RETIRED_IMAGE_MODEL_PREFIXES: readonly string[] = ['dall-e', 'gpt-image-1', 'chatgpt-image-latest']

export function isRetiredImageModel(model: string | null | undefined): boolean {
  const v = (model ?? '').trim().toLowerCase()
  return !!v && RETIRED_IMAGE_MODEL_PREFIXES.some(p => v.startsWith(p))
}

export interface ResolvedImageModel {
  model: string
  source: 'default' | 'override' | 'rejected_override'
  rejected?: string
}

/** Non-empty override wins unless it names a retired model; unknown IDs pass so a newer model needs no redeploy. */
export function resolveImageModel(override: string | null | undefined): ResolvedImageModel {
  const v = (override ?? '').trim()
  if (!v) return { model: DEFAULT_IMAGE_MODEL, source: 'default' }
  if (isRetiredImageModel(v)) return { model: DEFAULT_IMAGE_MODEL, source: 'rejected_override', rejected: v }
  return { model: v, source: 'override' }
}

/** Default rendering quality for GPT Image models (low | medium | high | xhigh | max | auto). */
export const DEFAULT_IMAGE_QUALITY = 'medium'

/** Square pages and cover, as before; 1024x1024 is a supported GPT Image size. */
export const DEFAULT_IMAGE_SIZE = '1024x1024'

/**
 * JPEG, not PNG: GPT Image PNGs average ~1.9 MB at 1024x1024, so a 24-page
 * book's PDF (which embeds the bytes verbatim) exceeded the 50 MiB
 * book-exports object limit. JPEG at the compression below is a fraction
 * of that with no visible loss at picture-book size. Existing PNG assets
 * stay valid: every consumer resolves the stored path and sniffs bytes.
 */
export const IMAGE_OUTPUT_FORMAT = 'jpeg'

/** JPEG compression 0-100 (official `output_compression`, jpeg/webp only). Override: PROCESS_STORY_IMAGE_COMPRESSION. */
export const DEFAULT_IMAGE_COMPRESSION = 85

/** Storage extension + content type for newly generated assets. */
export const IMAGE_FILE_EXT = 'jpg'
export const IMAGE_CONTENT_TYPE = 'image/jpeg'

/** Canonical scene asset path for NEW images; legacy rows keep their stored .png path. */
export function sceneStoragePath(requestId: string, pageNumber: number, ext: string = IMAGE_FILE_EXT): string {
  return `${requestId}/${pageNumber}.${ext}`
}

/** Clamp a compression override into 1..100 (100 = no compression). */
export function normalizeCompression(c: string | number | null | undefined): number {
  if (c === null || c === undefined || (typeof c === 'string' && c.trim() === '')) return DEFAULT_IMAGE_COMPRESSION
  const n = typeof c === 'number' ? c : Number(c.trim())
  if (!Number.isFinite(n)) return DEFAULT_IMAGE_COMPRESSION
  return Math.min(100, Math.max(1, Math.round(n)))
}

/** True when a stored asset path is already in the current output format. */
export function isCurrentFormatPath(path: string | null | undefined): boolean {
  return typeof path === 'string' && path.toLowerCase().endsWith('.' + IMAGE_FILE_EXT)
}

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
  compression?: string | number | null
}

export interface ImageRequestBody {
  model: string
  prompt: string
  n: 1
  size: string
  quality: string
  output_format: 'jpeg'
  output_compression: number
  moderation: 'auto'
}

/**
 * The exact request body for POST /v1/images/generations. Never includes
 * `response_format` (rejected by GPT Image models, which always return
 * base64) nor `style` (dall-e-3 only).
 */
export function buildImageRequest(prompt: string, opts: ImageRequestOptions = {}): ImageRequestBody {
  return {
    model: resolveImageModel(opts.model).model,
    prompt,
    n: 1,
    size: normalizeSize(opts.size),
    quality: normalizeQuality(opts.quality),
    output_format: IMAGE_OUTPUT_FORMAT,
    output_compression: normalizeCompression(opts.compression),
    moderation: 'auto',
  }
}

/**
 * Token usage as the Images API reports it (ImagesResponse.usage):
 * input_tokens + input_tokens_details { text_tokens, image_tokens },
 * output_tokens + output_tokens_details { image_tokens, text_tokens },
 * total_tokens. Every field is null when the response does not carry it;
 * nothing here is ever estimated.
 */
export interface ImageUsage {
  input_tokens: number | null
  input_text_tokens: number | null
  input_image_tokens: number | null
  output_tokens: number | null
  output_image_tokens: number | null
  output_text_tokens: number | null
  total_tokens: number | null
}

export interface ParsedImageResponse {
  b64: string
  /** dall-e-3 only; GPT Image models do not return it on the Images API → null. */
  revisedPrompt: string | null
  /** Token usage when the provider reports it; null otherwise. */
  usage: ImageUsage | null
  outputFormat: string | null
  /** Served quality / size as the response states them (top-level `quality`, `size`); null when absent. */
  quality: string | null
  size: string | null
}

/** Pull the first image out of an ImagesResponse. Throws a descriptive error when absent. */
export function parseImageResponse(json: unknown): ParsedImageResponse {
  const j = (json ?? {}) as { data?: Array<{ b64_json?: unknown; revised_prompt?: unknown }>; usage?: Record<string, unknown>; output_format?: unknown; quality?: unknown; size?: unknown }
  const first = Array.isArray(j.data) ? j.data[0] : undefined
  const b64 = typeof first?.b64_json === 'string' ? first.b64_json : ''
  if (!b64) throw new Error('Image error: no b64_json in response')
  const usage = parseImageUsage(j.usage)
  return {
    b64,
    revisedPrompt: typeof first?.revised_prompt === 'string' && first.revised_prompt.trim() ? first.revised_prompt : null,
    usage,
    outputFormat: typeof j.output_format === 'string' ? j.output_format : null,
    quality: typeof j.quality === 'string' ? j.quality : null,
    size: typeof j.size === 'string' ? j.size : null,
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Read ImagesResponse.usage with its documented nesting. Absent or
 * non-numeric fields become null; a usage object with no numeric field at
 * all is reported as null (no usage), never as zeros.
 */
export function parseImageUsage(raw: unknown): ImageUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Record<string, unknown>
  const inD = u.input_tokens_details && typeof u.input_tokens_details === 'object' ? u.input_tokens_details as Record<string, unknown> : {}
  const outD = u.output_tokens_details && typeof u.output_tokens_details === 'object' ? u.output_tokens_details as Record<string, unknown> : {}
  const usage: ImageUsage = {
    input_tokens: num(u.input_tokens),
    input_text_tokens: num(inD.text_tokens),
    input_image_tokens: num(inD.image_tokens),
    output_tokens: num(u.output_tokens),
    output_image_tokens: num(outD.image_tokens),
    output_text_tokens: num(outD.text_tokens),
    total_tokens: num(u.total_tokens),
  }
  return Object.values(usage).some(v => v !== null) ? usage : null
}

// ── Telemetry (processing_logs.metadata) ─────────────────────────────────────
//
// One flat, documented shape for every image call the worker logs, so the
// cost of illustrations can be measured from processing_logs instead of
// inferred. Values come only from the request body the worker sent and the
// usage object the provider returned; a field the provider did not report
// is null. No prompt text, names or personalization ever enters here.

export type ImageKind = 'page' | 'cover'

/** The request-side facts worth logging (never the prompt). */
export interface ImageRequestTelemetry {
  image_model: string
  image_quality_requested: string
  image_size_requested: string
  image_output_format_requested: string
}

export function imageRequestTelemetry(body: ImageRequestBody): ImageRequestTelemetry {
  return {
    image_model: body.model,
    image_quality_requested: body.quality,
    image_size_requested: body.size,
    image_output_format_requested: body.output_format,
  }
}

/**
 * Published list prices for gpt-image-2.5 models, USD per 1M tokens, as read
 * on developers.openai.com/api/docs/pricing on 2026-10-30 (Standard
 * processing). These are configuration for an ESTIMATE, not an observation:
 * the invoice from OpenAI is the only record of actual spend. Update
 * `as_of` whenever the numbers change.
 */
export interface ImageRates {
  as_of: string
  text_input_per_1m: number
  image_input_per_1m: number
  image_output_per_1m: number
}

export const PUBLISHED_IMAGE_RATES: ImageRates = {
  as_of: '2026-10-30',
  text_input_per_1m: 5.0,
  image_input_per_1m: 8.0,
  image_output_per_1m: 30.0,
}

export interface ImageCostEstimate {
  usd: number
  /** How the input side was priced: by the reported text/image split, or all as text because the split was absent. */
  input_basis: 'details' | 'input_tokens_as_text' | 'none'
  /** How the output side was priced: image-output tokens from the details, or all output tokens as image output. */
  output_basis: 'details' | 'output_tokens' | 'none'
  rates_as_of: string
}

/**
 * Pure estimate of one image call from reported token counts × configured
 * published rates. Returns null when neither an input nor an output count is
 * available (nothing to price). Rounded to 6 decimals.
 */
export function estimateImageCostUsd(usage: ImageUsage | null | undefined, rates: ImageRates = PUBLISHED_IMAGE_RATES): ImageCostEstimate | null {
  if (!usage) return null
  let usd = 0
  let input_basis: ImageCostEstimate['input_basis'] = 'none'
  let output_basis: ImageCostEstimate['output_basis'] = 'none'
  if (usage.input_text_tokens !== null || usage.input_image_tokens !== null) {
    usd += ((usage.input_text_tokens ?? 0) * rates.text_input_per_1m + (usage.input_image_tokens ?? 0) * rates.image_input_per_1m) / 1_000_000
    input_basis = 'details'
  } else if (usage.input_tokens !== null) {
    usd += (usage.input_tokens * rates.text_input_per_1m) / 1_000_000
    input_basis = 'input_tokens_as_text'
  }
  if (usage.output_image_tokens !== null) {
    usd += (usage.output_image_tokens * rates.image_output_per_1m) / 1_000_000
    output_basis = 'details'
  } else if (usage.output_tokens !== null) {
    usd += (usage.output_tokens * rates.image_output_per_1m) / 1_000_000
    output_basis = 'output_tokens'
  }
  if (input_basis === 'none' && output_basis === 'none') return null
  return { usd: Math.round(usd * 1e6) / 1e6, input_basis, output_basis, rates_as_of: rates.as_of }
}

/** Every key the telemetry helpers may emit (pinned by tests; no prompt/name fields). */
export const IMAGE_TELEMETRY_KEYS = [
  'image_kind', 'image_outcome', 'usage_reported',
  'image_model', 'image_quality_requested', 'image_size_requested', 'image_output_format_requested',
  'image_quality', 'image_size', 'image_output_format',
  'input_tokens', 'input_text_tokens', 'input_image_tokens', 'output_tokens', 'output_image_tokens', 'output_text_tokens', 'total_tokens',
  'image_tokens', 'cost_estimate_usd', 'cost_estimate_input_basis', 'cost_estimate_output_basis', 'cost_estimate_rates_as_of',
] as const

export interface ImageSuccessTelemetryArgs {
  kind: ImageKind
  requested: ImageRequestTelemetry
  /** Served model: the model the request named (the Images API does not echo it). */
  model: string
  usage: ImageUsage | null
  quality: string | null
  size: string | null
  outputFormat: string | null
  rates?: ImageRates
}

/**
 * Metadata for a successful image call. Keeps the legacy `image_tokens`
 * (total ?? output, present only when usage was reported) so existing
 * queries keep working, and adds the full breakdown with nulls for anything
 * the provider did not return.
 */
export function imageUsageTelemetry(a: ImageSuccessTelemetryArgs): Record<string, unknown> {
  const u = a.usage
  const est = estimateImageCostUsd(u, a.rates)
  const legacy = u ? (u.total_tokens ?? u.output_tokens) : null
  return {
    image_kind: a.kind,
    image_outcome: 'success',
    usage_reported: u !== null,
    ...a.requested,
    image_model: a.model,
    image_quality: a.quality,
    image_size: a.size,
    image_output_format: a.outputFormat,
    input_tokens: u?.input_tokens ?? null,
    input_text_tokens: u?.input_text_tokens ?? null,
    input_image_tokens: u?.input_image_tokens ?? null,
    output_tokens: u?.output_tokens ?? null,
    output_image_tokens: u?.output_image_tokens ?? null,
    output_text_tokens: u?.output_text_tokens ?? null,
    total_tokens: u?.total_tokens ?? null,
    ...(legacy !== null ? { image_tokens: legacy } : {}),
    cost_estimate_usd: est?.usd ?? null,
    cost_estimate_input_basis: est?.input_basis ?? null,
    cost_estimate_output_basis: est?.output_basis ?? null,
    cost_estimate_rates_as_of: est?.rates_as_of ?? null,
  }
}

/**
 * Metadata for a failed image attempt: what was requested, that no usage
 * was reported (a failed call returns no usage object), and the kind.
 * Tokens are never guessed for failures.
 */
export function imageFailureTelemetry(kind: ImageKind, requested: ImageRequestTelemetry): Record<string, unknown> {
  return { image_kind: kind, image_outcome: 'failed', usage_reported: false, ...requested }
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

/** PNG signature check. */
export function looksLikePng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return bytes.length >= 8 && sig.every((b, i) => bytes[i] === b)
}

/** JPEG signature check (SOI marker FF D8 FF). */
export function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export type ImageFormat = 'png' | 'jpeg'

/** Decide the real format from the bytes, never from a filename or a header claim. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (looksLikeJpeg(bytes)) return 'jpeg'
  if (looksLikePng(bytes)) return 'png'
  return null
}

/** Storage extension + content type for a sniffed format. */
export function storageMetaFor(format: ImageFormat): { ext: 'jpg' | 'png'; contentType: 'image/jpeg' | 'image/png' } {
  return format === 'jpeg' ? { ext: 'jpg', contentType: 'image/jpeg' } : { ext: 'png', contentType: 'image/png' }
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
