// Run: node --experimental-strip-types --test supabase/functions/process-story/imageProvider.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_IMAGE_COMPRESSION,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_SIZE,
  IMAGES_ENDPOINT,
  IMAGE_TELEMETRY_KEYS,
  MAX_RATE_LIMIT_WAIT_MS,
  PUBLISHED_IMAGE_RATES,
  buildImageRequest,
  estimateImageCostUsd,
  imageFailureTelemetry,
  imageRequestTelemetry,
  imageUsageTelemetry,
  parseImageUsage,
  decodeBase64Image,
  looksLikeJpeg,
  looksLikePng,
  normalizeCompression,
  normalizeQuality,
  normalizeSize,
  parseImageResponse,
  isCurrentFormatPath,
  rateLimitDelayMs,
  sceneStoragePath,
  sniffImageFormat,
  storageMetaFor,
} from './imageProvider.ts'
import { buildVisualBible, buildImagePrompt, buildCoverPrompt } from './visual.ts'

const INDEX = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8')

// 1x1 transparent PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('1-3. request shape targets the Images API with the selected GPT Image model and no response_format', () => {
  const body = buildImageRequest('a child on a beach')
  assert.equal(IMAGES_ENDPOINT, 'https://api.openai.com/v1/images/generations')
  assert.equal(body.model, 'gpt-image-2.5-flare')
  assert.equal(DEFAULT_IMAGE_MODEL, body.model)
  assert.deepEqual(Object.keys(body).sort(), ['model', 'moderation', 'n', 'output_compression', 'output_format', 'prompt', 'quality', 'size'])
  assert.ok(!('response_format' in body), 'response_format is rejected by GPT Image models')
  assert.ok(!('style' in body), 'style is dall-e-3 only')
  assert.equal(body.n, 1)
  assert.equal(body.output_format, 'jpeg')
  assert.equal(body.output_compression, DEFAULT_IMAGE_COMPRESSION)
  assert.equal(DEFAULT_IMAGE_COMPRESSION, 85)
  assert.equal(normalizeCompression('70'), 70)
  assert.equal(normalizeCompression(0), 1)
  assert.equal(normalizeCompression('nope'), 85)
  assert.equal(normalizeCompression(null), 85)
  assert.equal(normalizeCompression(''), 85)
  assert.equal(buildImageRequest('p', { compression: 120 }).output_compression, 100)
  assert.equal(body.prompt, 'a child on a beach')
  assert.ok(!INDEX.includes("'dall-e-3'"), 'index.ts must not name the retired model')
  assert.ok(!/response_format:\s*'(url|b64_json)'/.test(INDEX), 'index.ts must not send response_format to the Images API')
})

test('4. quality mapping: GPT Image values pass through, DALL-E names map, unknown falls back', () => {
  assert.equal(DEFAULT_IMAGE_QUALITY, 'medium')
  assert.equal(normalizeQuality('standard'), 'medium')
  assert.equal(normalizeQuality('hd'), 'high')
  assert.equal(normalizeQuality('high'), 'high')
  assert.equal(normalizeQuality('XHIGH'), 'xhigh')
  assert.equal(normalizeQuality('bogus'), 'medium')
  assert.equal(normalizeQuality(null), 'medium')
  assert.equal(buildImageRequest('p', { quality: 'standard' }).quality, 'medium')
})

test('5. size mapping: square default, legacy dall-e-3 sizes map to supported ones', () => {
  assert.equal(DEFAULT_IMAGE_SIZE, '1024x1024')
  assert.equal(normalizeSize(undefined), '1024x1024')
  assert.equal(normalizeSize('1792x1024'), '1536x1024')
  assert.equal(normalizeSize('1024x1792'), '1024x1536')
  assert.equal(normalizeSize('nonsense'), '1024x1024')
})

// Minimal JPEG prefix: SOI + APP0/JFIF header (enough for signature detection)
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00])
const JPEG_B64 = Buffer.from(JPEG_BYTES).toString('base64')

test('6-7. base64 decodes to real bytes; JPEG and legacy PNG are recognised by signature; garbage is rejected', () => {
  const png = decodeBase64Image(PNG_B64)
  assert.equal(looksLikePng(png), true)
  assert.equal(sniffImageFormat(png), 'png')
  assert.deepEqual(storageMetaFor('png'), { ext: 'png', contentType: 'image/png' })
  const jpg = decodeBase64Image(JPEG_B64)
  assert.equal(looksLikeJpeg(jpg), true)
  assert.equal(sniffImageFormat(jpg), 'jpeg')
  assert.deepEqual(storageMetaFor('jpeg'), { ext: 'jpg', contentType: 'image/jpeg' })
  assert.throws(() => decodeBase64Image(''), /invalid base64/)
  assert.throws(() => decodeBase64Image('!!not base64!!'), /invalid base64/)
  assert.equal(sniffImageFormat(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])), null)
  assert.equal(sniffImageFormat(new Uint8Array(Buffer.from('<html>not an image</html>'))), null)
})

test('scene and cover storage paths: new assets are .jpg, legacy .png paths remain expressible', () => {
  assert.equal(sceneStoragePath('req', 7), 'req/7.jpg')
  assert.equal(sceneStoragePath('req', 7, 'png'), 'req/7.png')
  assert.ok(!INDEX.includes('.png`'), 'index.ts must not hard-code a .png asset path')
  assert.ok(!INDEX.includes("contentType: 'image/png'"), 'uploads must use the sniffed content type')
  assert.equal((INDEX.match(/contentType: image\.contentType/g) ?? []).length, 3, 'pipeline page, backfill page, cover')
  assert.equal((INDEX.match(/sceneStoragePath\(requestId/g) ?? []).length, 2)
  assert.match(INDEX, /coverStoragePath\(requestId, image\.ext\)/)
  // 11. backfill re-render is format-aware and resumable
  assert.equal(isCurrentFormatPath('req/3.jpg'), true)
  assert.equal(isCurrentFormatPath('req/3.png'), false)
  assert.equal(isCurrentFormatPath(null), false)
  assert.match(INDEX, /forceAll && !isCurrentFormatPath\(s\.storage_path\)/)
  assert.match(INDEX, /args\.force && !args\.skip && !isCurrentFormatPath\(gs\.cover_storage_path\)/)
})

test('response parsing: b64_json required, revised_prompt null when absent, usage captured when present', () => {
  const p = parseImageResponse({ created: 1, data: [{ b64_json: PNG_B64 }], output_format: 'png', usage: { input_tokens: 120, output_tokens: 1056, total_tokens: 1176 } })
  assert.equal(p.b64, PNG_B64)
  assert.equal(p.revisedPrompt, null)
  assert.deepEqual(p.usage, { input_tokens: 120, input_text_tokens: null, input_image_tokens: null, output_tokens: 1056, output_image_tokens: null, output_text_tokens: null, total_tokens: 1176 })
  assert.equal(p.outputFormat, 'png')
  assert.equal(p.quality, null)
  assert.equal(p.size, null)
  const q = parseImageResponse({ data: [{ b64_json: PNG_B64, revised_prompt: 'rewritten' }] })
  assert.equal(q.revisedPrompt, 'rewritten')
  assert.equal(q.usage, null)
  assert.throws(() => parseImageResponse({ data: [{ url: 'https://x' }] }), /no b64_json/)
  assert.throws(() => parseImageResponse(null), /no b64_json/)
})

test('8-10. page, cover and backfill all use the single provider integration and store its metadata', () => {
  assert.equal((INDEX.match(/await generateImage\(built\.prompt\)/g) ?? []).length, 3, 'pipeline page, backfill page and cover call the same client')
  assert.equal((INDEX.match(/IMAGES_ENDPOINT/g) ?? []).length, 2, 'one import, one fetch')
  assert.ok(!INDEX.includes('https://api.openai.com/v1/images'), 'no second endpoint literal')
  assert.equal((INDEX.match(/image_model: image\.model/g) ?? []).length, 2, 'page metadata stored by pipeline and backfill')
  assert.equal((INDEX.match(/cover_model: image\.model/g) ?? []).length, 1, 'cover metadata stored')
  assert.equal((INDEX.match(/image_revised_prompt: image\.revisedPrompt/g) ?? []).length, 2)
  assert.equal((INDEX.match(/\.\.\.imageTelemetry\('page', image\)/g) ?? []).length, 2, 'usage telemetry on the pipeline and backfill page logs')
  assert.equal((INDEX.match(/\.\.\.imageTelemetry\('cover', image\)/g) ?? []).length, 1, 'usage telemetry on the cover log')
  assert.equal((INDEX.match(/image_tokens: image\.usage/g) ?? []).length, 0, 'the legacy inline token field is produced by the helper now')
})

test('11. the visual-bible prompt reaches the provider unchanged', () => {
  const bible = buildVisualBible({
    requestId: 'req-provider', childName: 'Pip', childAge: 5, childDescription: 'curly red hair, green glasses',
    supportingCharactersText: 'Nana June (grandmother)', illustrationStyle: 'watercolor', styleHint: 'soft watercolor', plan: null, consistencyRules: null,
  })
  const page = buildImagePrompt({ bible, pageNumber: 1, imageDescription: 'Pip holds a yellow bucket at the tide pool.', planPage: null, safetySuffix: 'Child-safe, no text.' })
  const cover = buildCoverPrompt({ bible, plan: null, tones: ['heartwarming'], bandImageHint: '', safetySuffix: 'Child-safe, no text.' })
  assert.equal(buildImageRequest(page.prompt).prompt, page.prompt)
  assert.equal(buildImageRequest(cover.prompt).prompt, cover.prompt)
})

test('12. one bounded retry on 429 honours Retry-After within the wall clock; other statuses do not retry', () => {
  assert.equal(rateLimitDelayMs(429, '3'), 3_000)
  assert.equal(rateLimitDelayMs(429, null), 5_000)
  assert.equal(rateLimitDelayMs(429, '120'), MAX_RATE_LIMIT_WAIT_MS)
  const now = Date.parse('2026-10-02T03:00:00Z')
  assert.equal(rateLimitDelayMs(429, new Date(now + 4_000).toUTCString(), now), 4_000)
  assert.equal(rateLimitDelayMs(400, '3'), null)
  assert.equal(rateLimitDelayMs(500, null), null)
  assert.ok(INDEX.includes('rateLimitDelayMs(res.status'), 'client applies the 429 rule')
  // existing resume behaviour: a failed page stays failed for the next run / backfill
  assert.ok(INDEX.includes("image_status: 'failed'"))
})

// ── Phase 0A: image-generation cost telemetry ────────────────────────────────

const REQ = imageRequestTelemetry(buildImageRequest('PROMPT-MARKER-zq'))
const FULL_USAGE = {
  input_tokens: 430, input_tokens_details: { text_tokens: 430, image_tokens: 0 },
  output_tokens: 512, output_tokens_details: { image_tokens: 512, text_tokens: 0 },
  total_tokens: 942,
}

test('13. complete usage response: every documented field is read with its real nesting; served quality/size/format captured', () => {
  const p = parseImageResponse({ created: 1, data: [{ b64_json: PNG_B64 }], output_format: 'jpeg', quality: 'medium', size: '1024x1024', usage: FULL_USAGE })
  assert.deepEqual(p.usage, { input_tokens: 430, input_text_tokens: 430, input_image_tokens: 0, output_tokens: 512, output_image_tokens: 512, output_text_tokens: 0, total_tokens: 942 })
  assert.equal(p.quality, 'medium')
  assert.equal(p.size, '1024x1024')
  const m = imageUsageTelemetry({ kind: 'page', requested: REQ, model: 'gpt-image-2.5-flare', usage: p.usage, quality: p.quality, size: p.size, outputFormat: p.outputFormat })
  assert.equal(m.image_kind, 'page')
  assert.equal(m.image_outcome, 'success')
  assert.equal(m.usage_reported, true)
  assert.equal(m.image_model, 'gpt-image-2.5-flare')
  assert.equal(m.image_quality_requested, DEFAULT_IMAGE_QUALITY)
  assert.equal(m.image_size_requested, DEFAULT_IMAGE_SIZE)
  assert.equal(m.image_output_format_requested, 'jpeg')
  assert.equal(m.image_quality, 'medium')
  assert.equal(m.image_size, '1024x1024')
  assert.equal(m.input_tokens, 430); assert.equal(m.input_text_tokens, 430); assert.equal(m.input_image_tokens, 0)
  assert.equal(m.output_tokens, 512); assert.equal(m.output_image_tokens, 512); assert.equal(m.output_text_tokens, 0)
  assert.equal(m.total_tokens, 942)
  // legacy key preserved with its historical meaning (total ?? output)
  assert.equal(m.image_tokens, 942)
  // cost: 430 × $5/M + 512 × $30/M = 0.00215 + 0.01536
  assert.equal(m.cost_estimate_usd, 0.01751)
  assert.equal(m.cost_estimate_input_basis, 'details')
  assert.equal(m.cost_estimate_output_basis, 'details')
  assert.equal(m.cost_estimate_rates_as_of, PUBLISHED_IMAGE_RATES.as_of)
})

test('14. partial usage response: totals without details → details null, cost basis says so; input-only and output-only priced from what exists', () => {
  const u = parseImageUsage({ input_tokens: 400, output_tokens: 500, total_tokens: 900 })
  assert.deepEqual(u, { input_tokens: 400, input_text_tokens: null, input_image_tokens: null, output_tokens: 500, output_image_tokens: null, output_text_tokens: null, total_tokens: 900 })
  const est = estimateImageCostUsd(u)
  assert.deepEqual(est, { usd: 0.017, input_basis: 'input_tokens_as_text', output_basis: 'output_tokens', rates_as_of: '2026-10-30' })
  // total only: nothing can be priced
  assert.equal(estimateImageCostUsd(parseImageUsage({ total_tokens: 900 })), null)
  const m = imageUsageTelemetry({ kind: 'cover', requested: REQ, model: 'm', usage: parseImageUsage({ total_tokens: 900 }), quality: null, size: null, outputFormat: null })
  assert.equal(m.usage_reported, true)
  assert.equal(m.total_tokens, 900)
  assert.equal(m.output_tokens, null)
  assert.equal(m.image_tokens, 900)
  assert.equal(m.cost_estimate_usd, null)
  assert.equal(m.cost_estimate_input_basis, null)
  // non-numeric or malformed values never become numbers
  assert.deepEqual(parseImageUsage({ input_tokens: '430', output_tokens: NaN, input_tokens_details: 'oops' }), null)
  // output_tokens_details takes precedence over the output total for the image-output rate
  const e2 = estimateImageCostUsd(parseImageUsage({ output_tokens: 600, output_tokens_details: { image_tokens: 500, text_tokens: 100 } }))
  assert.equal(e2?.usd, 0.015)
  assert.equal(e2?.output_basis, 'details')
})

test('15. missing usage response: usage null, usage_reported false, every token field null, no legacy image_tokens, no cost — nothing fabricated', () => {
  const p = parseImageResponse({ data: [{ b64_json: PNG_B64 }] })
  assert.equal(p.usage, null)
  assert.equal(parseImageUsage({}), null)
  assert.equal(parseImageUsage(null), null)
  assert.equal(estimateImageCostUsd(null), null)
  const m = imageUsageTelemetry({ kind: 'page', requested: REQ, model: 'm', usage: null, quality: null, size: null, outputFormat: null })
  assert.equal(m.usage_reported, false)
  for (const k of ['input_tokens', 'input_text_tokens', 'input_image_tokens', 'output_tokens', 'output_image_tokens', 'output_text_tokens', 'total_tokens', 'image_quality', 'image_size', 'image_output_format', 'cost_estimate_usd']) {
    assert.equal(m[k], null, k)
  }
  assert.equal('image_tokens' in m, false)
  assert.equal(m.image_model, 'm')
})

test('16. page versus cover, success versus failure: failures carry request facts and kind only, never tokens or a cost', () => {
  const page = imageFailureTelemetry('page', REQ)
  const cover = imageFailureTelemetry('cover', REQ)
  assert.deepEqual(page, { image_kind: 'page', image_outcome: 'failed', usage_reported: false, ...REQ })
  assert.equal(cover.image_kind, 'cover')
  for (const k of Object.keys(page)) assert.ok((IMAGE_TELEMETRY_KEYS as readonly string[]).includes(k), k)
  assert.ok(!('input_tokens' in page) && !('output_tokens' in page) && !('cost_estimate_usd' in page) && !('image_tokens' in page))
  // all six worker log sites: three successes (kind-tagged) and three failures
  assert.equal((INDEX.match(/imageFailureTelemetry\('page', IMAGE_REQUEST_META\)/g) ?? []).length, 2, 'pipeline page failure + backfill page failure')
  assert.equal((INDEX.match(/imageFailureTelemetry\('cover', IMAGE_REQUEST_META\)/g) ?? []).length, 1, 'cover failure')
  assert.match(INDEX, /const IMAGE_REQUEST_META = imageRequestTelemetry\(buildImageRequest\('', \{ model: IMAGE_MODEL, quality: IMAGE_QUALITY, compression: IMAGE_COMPRESSION \}\)\)/)
})

test('17. no customer information or prompt text in telemetry keys; request telemetry never includes the prompt', () => {
  const forbidden = /prompt|name|child|note|description|dedication|email|key|secret|b64|bytes/i
  for (const k of IMAGE_TELEMETRY_KEYS) assert.ok(!forbidden.test(k), k)
  const m = imageUsageTelemetry({ kind: 'page', requested: imageRequestTelemetry(buildImageRequest('Pip with curly red hair at the tide pool')), model: 'm', usage: parseImageUsage(FULL_USAGE), quality: 'medium', size: '1024x1024', outputFormat: 'jpeg' })
  for (const k of Object.keys(m)) assert.ok((IMAGE_TELEMETRY_KEYS as readonly string[]).includes(k), `unexpected key ${k}`)
  assert.ok(!JSON.stringify(m).includes('Pip'), 'prompt text must not leak')
  assert.ok(!JSON.stringify(REQ).includes('PROMPT-MARKER'), 'request telemetry carries no prompt')
})

test('18. image-generation request parameters and retry/continuation behaviour are unchanged by the telemetry work', () => {
  // request body is byte-for-byte the same contract as before Phase 0A
  assert.deepEqual(buildImageRequest('p'), {
    model: DEFAULT_IMAGE_MODEL, prompt: 'p', n: 1, size: '1024x1024', quality: 'medium',
    output_format: 'jpeg', output_compression: DEFAULT_IMAGE_COMPRESSION, moderation: 'auto',
  })
  // generateImage still: one call, one bounded 429 retry, then throw on !ok
  const gen = INDEX.slice(INDEX.indexOf('async function generateImage('), INDEX.indexOf('async function resolveVisualBible('))
  assert.equal((gen.match(/await call\(\)/g) ?? []).length, 2, 'initial call + single 429 retry')
  assert.match(gen, /const wait = rateLimitDelayMs\(res\.status, res\.headers\.get\('retry-after'\)\)/)
  assert.match(gen, /if \(!res\.ok\) \{\s*const err = await res\.text\(\)\s*throw new Error\(`Image error \$\{res\.status\}: \$\{err\}`\)/)
  // the page loop still draws only pending/failed scenes, still guards complete rows, still releases on the time budget
  assert.match(INDEX, /const pendingScenes = allScenes\.filter\(s => s\.image_status === 'pending' \|\| s\.image_status === 'failed'\)/)
  assert.match(INDEX, /\.neq\('image_status', 'complete'\)\s*\.select\('id'\)/)
  assert.match(INDEX, /if \(elapsed >= TIME_BUDGET_MS\) \{/)
  assert.equal((INDEX.match(/dispatchSelf\(\{ requestId, language, mode: 'continue' \}\)/g) ?? []).length, 3, 'plan, image-loop and cover continuations')
  assert.match(INDEX, /const decision = args\.force && !args\.skip && !isCurrentFormatPath\(gs\.cover_storage_path\) \? 'generate' : shouldGenerateCover\(gs, args\.skip\)/)
})
