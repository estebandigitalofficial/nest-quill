// Run: node --experimental-strip-types --test supabase/functions/process-story/imageProvider.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_SIZE,
  IMAGES_ENDPOINT,
  MAX_RATE_LIMIT_WAIT_MS,
  buildImageRequest,
  decodeBase64Image,
  looksLikePng,
  normalizeQuality,
  normalizeSize,
  parseImageResponse,
  rateLimitDelayMs,
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
  assert.deepEqual(Object.keys(body).sort(), ['model', 'moderation', 'n', 'output_format', 'prompt', 'quality', 'size'])
  assert.ok(!('response_format' in body), 'response_format is rejected by GPT Image models')
  assert.ok(!('style' in body), 'style is dall-e-3 only')
  assert.equal(body.n, 1)
  assert.equal(body.output_format, 'png')
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

test('6-7. base64 is decoded into real PNG bytes; garbage is rejected', () => {
  const bytes = decodeBase64Image(PNG_B64)
  assert.ok(bytes.length > 60)
  assert.equal(looksLikePng(bytes), true)
  assert.throws(() => decodeBase64Image(''), /invalid base64/)
  assert.throws(() => decodeBase64Image('!!not base64!!'), /invalid base64/)
  assert.equal(looksLikePng(new Uint8Array([1, 2, 3])), false)
})

test('response parsing: b64_json required, revised_prompt null when absent, usage captured when present', () => {
  const p = parseImageResponse({ created: 1, data: [{ b64_json: PNG_B64 }], output_format: 'png', usage: { input_tokens: 120, output_tokens: 1056, total_tokens: 1176 } })
  assert.equal(p.b64, PNG_B64)
  assert.equal(p.revisedPrompt, null)
  assert.deepEqual(p.usage, { input_tokens: 120, output_tokens: 1056, total_tokens: 1176 })
  assert.equal(p.outputFormat, 'png')
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
  assert.equal((INDEX.match(/image_tokens: image\.usage/g) ?? []).length, 3, 'token telemetry on all three success logs')
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
