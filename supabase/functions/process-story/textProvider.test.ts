// OpenAI model retirement migration (2026-10-30) — deterministic tests for the
// text provider contract shared by the worker and the app.
// Run: node --experimental-strip-types --test supabase/functions/process-story/textProvider.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHAT_COMPLETIONS_ENDPOINT,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TEXT_MODEL,
  RETIRED_TEXT_MODEL_PREFIXES,
  TEXT_MODELS,
  buildChatRequest,
  compatibilityFallback,
  isRetiredTextModel,
  parseChatResponse,
  parseOpenAIError,
  postChatCompletion,
  resolveTextModel,
  applyKnownIncompatibilities,
  knownIncompatibilitiesFor,
  recordIncompatibility,
  resetCompatibilityMemory,
  type ChatRequestBody,
} from './textProvider.ts'
import { validateBook, validateStoryPlan } from './plan.ts'
import { buildBookPrompt, buildPlanPrompt } from './prompt.ts'
import { safeParseJson, sumUsage } from './plan.ts'
import { DEFAULT_IMAGE_MODEL, buildImageRequest, isRetiredImageModel, resolveImageModel } from './imageProvider.ts'

const INDEX = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8')

// Retired or scheduled per developers.openai.com/api/docs/deprecations (read 2026-10-30).
const RETIRED = [
  'gpt-4', 'gpt-4-0613', 'gpt-4-turbo', 'gpt-4-turbo-2024-04-09', 'gpt-4-1106-preview', 'gpt-4-32k', 'gpt-4-vision-preview',
  'gpt-4o', 'gpt-4o-2024-05-13', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'chatgpt-4o-latest',
  'gpt-4.1', 'gpt-4.1-2025-04-14', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1-nano-2025-04-14',
  'GPT-4o', ' gpt-4o-mini ',
]
// Listed as current on developers.openai.com/api/docs/models (read 2026-10-30).
const SUPPORTED = ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna']

test('1. defaults name currently supported models and the gpt-4o-era effort/temperature behaviour', () => {
  assert.equal(CHAT_COMPLETIONS_ENDPOINT, 'https://api.openai.com/v1/chat/completions')
  assert.equal(TEXT_MODELS.quality, 'gpt-6.1-terra')
  assert.equal(TEXT_MODELS.fast, 'gpt-6-luna')
  assert.equal(DEFAULT_TEXT_MODEL, TEXT_MODELS.quality)
  assert.equal(DEFAULT_REASONING_EFFORT, 'none')
  for (const m of Object.values(TEXT_MODELS)) {
    assert.ok(SUPPORTED.includes(m), `${m} is not in the current catalogue`)
    assert.equal(isRetiredTextModel(m), false)
  }
  // `none` must be supported by every default (gpt-6-astra / gpt-6.1-sol reject it with HTTP 400).
  for (const m of Object.values(TEXT_MODELS)) assert.ok(!['gpt-6-astra', 'gpt-6.1-sol'].includes(m), `${m} does not support reasoning_effort none`)
})

test('2. every retired GPT-4-series identifier is recognised; supported and unknown ones are not', () => {
  for (const m of RETIRED) assert.equal(isRetiredTextModel(m), true, m)
  for (const m of SUPPORTED) assert.equal(isRetiredTextModel(m), false, m)
  assert.equal(isRetiredTextModel('gpt-7-future'), false, 'unknown newer IDs are not blocked')
  assert.equal(isRetiredTextModel(''), false)
  assert.equal(isRetiredTextModel(null), false)
  assert.equal(isRetiredTextModel(undefined), false)
  assert.deepEqual([...RETIRED_TEXT_MODEL_PREFIXES].sort(), ['chatgpt-4o-latest', 'gpt-4-', 'gpt-4.1', 'gpt-4o'])
})

test('3. override resolution: empty → default, supported → override, retired → default with the rejection reported', () => {
  assert.deepEqual(resolveTextModel(undefined), { model: DEFAULT_TEXT_MODEL, source: 'default' })
  assert.deepEqual(resolveTextModel(''), { model: DEFAULT_TEXT_MODEL, source: 'default' })
  assert.deepEqual(resolveTextModel('   '), { model: DEFAULT_TEXT_MODEL, source: 'default' })
  assert.deepEqual(resolveTextModel(' gpt-6-luna '), { model: 'gpt-6-luna', source: 'override' })
  assert.deepEqual(resolveTextModel('gpt-4o'), { model: DEFAULT_TEXT_MODEL, source: 'rejected_override', rejected: 'gpt-4o' })
  assert.deepEqual(resolveTextModel('gpt-4.1-nano', 'gpt-6-luna'), { model: 'gpt-6-luna', source: 'rejected_override', rejected: 'gpt-4.1-nano' })
  for (const m of RETIRED) assert.equal(isRetiredTextModel(resolveTextModel(m).model), false, `${m} must never reach the API`)
})

test('4. request shape: reasoning_effort none, temperature kept, JSON mode, max_completion_tokens, never max_tokens', () => {
  const msgs = [{ role: 'system', content: 'Reply in JSON.' }, { role: 'user', content: 'hi' }]
  const body = buildChatRequest({ model: 'gpt-6.1-terra', messages: msgs, temperature: 0.8, jsonMode: true })
  assert.deepEqual(body, { model: 'gpt-6.1-terra', messages: msgs, reasoning_effort: 'none', temperature: 0.8, response_format: { type: 'json_object' } })
  assert.equal(body.messages, msgs, 'messages pass through untouched')
  const bounded = buildChatRequest({ model: 'gpt-6-luna', messages: msgs, maxOutputTokens: 600.7, stream: true })
  assert.deepEqual(bounded, { model: 'gpt-6-luna', messages: msgs, reasoning_effort: 'none', max_completion_tokens: 600, stream: true })
  assert.ok(!('max_tokens' in bounded) && !('max_tokens' in body), 'max_tokens is deprecated and rejected by reasoning models')
  assert.ok(!('temperature' in bounded), 'temperature only when asked for')
  assert.ok(!('response_format' in bounded), 'JSON mode only when asked for')
  assert.equal(buildChatRequest({ model: 'x', messages: msgs, temperature: 0 }).temperature, 0, 'zero is a valid temperature')
  assert.ok(!('max_completion_tokens' in buildChatRequest({ model: 'x', messages: msgs, maxOutputTokens: 0 })))
})

test('5. temperature is dropped automatically whenever reasoning is enabled (API rejects it)', () => {
  const msgs = [{ role: 'user', content: 'hi' }]
  for (const effort of ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const) {
    const b = buildChatRequest({ model: 'gpt-6.1-terra', messages: msgs, temperature: 0.7, reasoningEffort: effort, jsonMode: true })
    assert.equal(b.reasoning_effort, effort)
    assert.ok(!('temperature' in b), `temperature must not be sent with effort ${effort}`)
    assert.deepEqual(b.response_format, { type: 'json_object' }, 'JSON mode is independent of effort')
  }
  assert.equal(buildChatRequest({ model: 'm', messages: msgs, temperature: 0.7, reasoningEffort: 'none' }).temperature, 0.7)
})

test('6. OpenAI error bodies parse (JSON with param/code, or plain text)', () => {
  assert.deepEqual(parseOpenAIError('{"error":{"message":"Unsupported parameter: \'temperature\' is not supported with this model.","type":"invalid_request_error","param":"temperature","code":"unsupported_parameter"}}'),
    { message: "Unsupported parameter: 'temperature' is not supported with this model.", param: 'temperature', code: 'unsupported_parameter' })
  assert.deepEqual(parseOpenAIError('gateway timeout'), { message: 'gateway timeout', param: null, code: null })
  assert.deepEqual(parseOpenAIError(null), { message: '', param: null, code: null })
})

test('7. compatibility fallback drops exactly the optional parameter the API names, once, and only on 400', () => {
  const body: ChatRequestBody = { model: 'gpt-6.1-terra', messages: [], reasoning_effort: 'none', temperature: 0.8, response_format: { type: 'json_object' }, max_completion_tokens: 900 }
  const t = compatibilityFallback(400, '{"error":{"message":"Unsupported parameter: \'temperature\' is not supported with this model.","type":"invalid_request_error","param":"temperature","code":"unsupported_parameter"}}', body)
  assert.ok(t); assert.equal(t.dropped, 'temperature')
  assert.deepEqual(t.body, { model: 'gpt-6.1-terra', messages: [], reasoning_effort: 'none', response_format: { type: 'json_object' }, max_completion_tokens: 900 })
  assert.ok('temperature' in body, 'original body is not mutated')
  const v = compatibilityFallback(400, '{"error":{"message":"Unsupported value: \'temperature\' does not support 0.8 with this model. Only the default (1) value is supported.","param":"temperature","code":"unsupported_value"}}', body)
  assert.equal(v?.dropped, 'temperature')
  const rf = compatibilityFallback(400, '{"error":{"message":"Invalid parameter: \'response_format\' of type \'json_object\' is not supported with this model.","param":"response_format","code":null}}', body)
  assert.equal(rf?.dropped, 'response_format'); assert.ok(rf && !('response_format' in rf.body))
  const nested = compatibilityFallback(400, '{"error":{"message":"json_object is not supported with this model","param":"response_format.type"}}', body)
  assert.equal(nested?.dropped, 'response_format', 'nested param paths resolve to the top-level key')
  const re = compatibilityFallback(400, '{"error":{"message":"Unsupported parameter: \'reasoning_effort\' is not supported with this model."}}', body)
  assert.equal(re?.dropped, 'reasoning_effort', 'param inferred from the message when the field is absent')
  // Never dropped: things that would change the product, or failures that are not parameter compatibility.
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Invalid value for messages","param":"messages"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Unsupported parameter: \'model\'","param":"model"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"context_length_exceeded","code":"context_length_exceeded"}}', body), null)
  assert.equal(compatibilityFallback(429, '{"error":{"message":"rate limit","param":"temperature"}}', body), null)
  assert.equal(compatibilityFallback(500, 'oops', body), null)
  assert.equal(compatibilityFallback(401, '{"error":{"message":"bad key","param":"temperature"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"x","param":"temperature"}}', { model: 'm', messages: [] }), null, 'nothing to drop → null')
})

test('8. response parsing: content, usage and served model; legacy responses without details still parse', () => {
  const r = parseChatResponse({ model: 'gpt-6.1-terra-2026-09-01', choices: [{ message: { content: '{"title":"Pip"}' } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, completion_tokens_details: { reasoning_tokens: 0 } } }, 'gpt-6.1-terra')
  assert.deepEqual(r, { content: '{"title":"Pip"}', usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }, model: 'gpt-6.1-terra-2026-09-01' })
  const legacy = parseChatResponse({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }, 'req')
  assert.deepEqual(legacy, { content: 'x', usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }, model: 'req' })
  assert.deepEqual(parseChatResponse({}, 'req'), { content: '', usage: { prompt_tokens: null, completion_tokens: null, total_tokens: null }, model: 'req' })
  assert.deepEqual(parseChatResponse(null, 'req').usage, { prompt_tokens: null, completion_tokens: null, total_tokens: null })
  assert.equal(parseChatResponse({ choices: [{ message: { content: null } }] }, 'req').content, '')
})

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; body: ChatRequestBody; auth: string }> = []
  const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization })
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra call')
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
  }
  return { fetchImpl, calls }
}

test('9. postChatCompletion: success is one call to the endpoint with the bearer key and the exact body', async () => {
  resetCompatibilityMemory()
  const { fetchImpl, calls } = mockFetch([{ status: 200, body: { choices: [{ message: { content: '{}' } }] } }])
  const body = buildChatRequest({ model: 'gpt-6.1-terra', messages: [{ role: 'user', content: 'hi' }], temperature: 0.8, jsonMode: true })
  const out = await postChatCompletion(fetchImpl, 'sk-test', body)
  assert.equal(out.res.status, 200); assert.equal(out.dropped, null); assert.equal(out.body, body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, CHAT_COMPLETIONS_ENDPOINT)
  assert.equal(calls[0].auth, 'Bearer sk-test')
  assert.deepEqual(calls[0].body, body)
})

test('10. postChatCompletion: a 400 naming an unsupported parameter is retried once without it; the second answer is returned as-is', async () => {
  resetCompatibilityMemory()
  const err = { error: { message: "Unsupported parameter: 'temperature' is not supported with this model.", param: 'temperature', code: 'unsupported_parameter' } }
  const ok = { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
  const { fetchImpl, calls } = mockFetch([{ status: 400, body: err }, { status: 200, body: ok }])
  const body = buildChatRequest({ model: 'gpt-6.1-terra', messages: [{ role: 'user', content: 'hi' }], temperature: 0.8, jsonMode: true })
  const out = await postChatCompletion(fetchImpl, 'k', body)
  assert.equal(calls.length, 2)
  assert.equal(out.dropped, 'temperature')
  assert.ok(!('temperature' in calls[1].body)); assert.deepEqual(calls[1].body.response_format, { type: 'json_object' })
  assert.equal(out.res.status, 200)
  assert.equal(parseChatResponse(await out.res.json(), 'm').content, '{"ok":true}')

  // Second failure is surfaced, not retried again.
  resetCompatibilityMemory()
  const twice = mockFetch([{ status: 400, body: err }, { status: 400, body: { error: { message: "Unsupported parameter: 'response_format'", param: 'response_format' } } }])
  const out2 = await postChatCompletion(twice.fetchImpl, 'k', body)
  assert.equal(twice.calls.length, 2); assert.equal(out2.res.status, 400); assert.equal(out2.dropped, 'temperature')
  assert.match(await out2.res.text(), /response_format/, 'the caller sees the second error body intact')
})

test('11. postChatCompletion: 401/429/500 and non-parameter 400s are returned untouched with no retry', async () => {
  resetCompatibilityMemory()
  const body = buildChatRequest({ model: 'gpt-6-luna', messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 })
  for (const [status, b] of [[401, { error: { message: 'bad key' } }], [429, { error: { message: 'rate' } }], [500, 'boom'], [400, { error: { message: 'bad messages', param: 'messages' } }]] as Array<[number, unknown]>) {
    const { fetchImpl, calls } = mockFetch([{ status, body: b }])
    const out = await postChatCompletion(fetchImpl, 'k', body)
    assert.equal(calls.length, 1, `status ${status}`)
    assert.equal(out.res.status, status); assert.equal(out.dropped, null)
    assert.ok((await out.res.text()).length > 0, 'error body still readable by the caller')
  }
})

test('12. story prompts (EN and ES) go through the builder unchanged and satisfy JSON mode (they say JSON)', () => {
  const request = { child_name: 'Theo', child_age: 6, story_theme: 'a snowy village adventure', story_tone: ['heartwarming'], story_length: 8, illustration_style: 'watercolor', custom_notes: 'Child reference: they/them' }
  for (const lang of ['en', 'es']) {
    const plan = buildPlanPrompt(request, {}, lang)
    const body = buildChatRequest({ model: DEFAULT_TEXT_MODEL, messages: plan, temperature: 0.8, jsonMode: true })
    assert.equal(body.messages, plan)
    assert.ok(plan.some(m => /JSON/.test(m.content)), `${lang}: JSON mode requires the word JSON in a message`)
    assert.equal(body.reasoning_effort, 'none'); assert.equal(body.temperature, 0.8)
    assert.equal(JSON.parse(JSON.stringify(body)).messages.length, plan.length, 'serialises cleanly for fetch')
  }
  const esPlan = buildPlanPrompt(request, {}, 'es').map(m => m.content).join('\n')
  const enPlan = buildPlanPrompt(request, {}, 'en').map(m => m.content).join('\n')
  assert.notEqual(esPlan, enPlan, 'language still reaches the prompt')
  assert.ok(/Theo/.test(esPlan) && /they\/them|elle|neutr/i.test(esPlan), 'personalisation and child reference survive')
  const plan = {
    title: 'The Snowy Village', premise: 'Theo helps a lost lantern find its way home before the first snowfall.',
    protagonist: { name: 'Theo', characterization: 'Curious and kind.', want: 'To light the village square.' },
    supporting_characters: [{ name: 'Nana', role: 'grandmother who tells the lantern story' }],
    setting: 'A snowy mountain village', central_conflict: 'The lantern is lost in the snow.', goal: 'Find the lantern.',
    emotional_arc: 'Worry to pride', beginning_state: 'Dark square', escalation: 'Snow gets heavier', climax: 'Theo climbs the bell tower',
    resolution: 'The lantern is lit', ending_state: 'Bright square', lesson: 'Kindness lights the way',
    pages: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, phase: i === 0 ? 'setup' : i === 7 ? 'resolution' : 'development', beat: `Beat ${i + 1}.`, purpose: 'Advance.', development: '', continuity: 'Snow.' })),
  }
  for (const lang of ['en', 'es']) {
    const book = buildBookPrompt(request, plan as never, {}, lang)
    const body = buildChatRequest({ model: DEFAULT_TEXT_MODEL, messages: book, temperature: 0.8, jsonMode: true })
    assert.equal(body.messages, book)
    assert.ok(book.some(m => /JSON/.test(m.content)), `${lang}: book prompt says JSON`)
  }
})

test('13. historical compatibility: outputs and telemetry from gpt-4o-era stories still parse and sum alongside new ones', () => {
  const legacy = { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000, ms: 10, attempts: 1, model: 'gpt-4o' }
  const fresh = { prompt_tokens: 1500, completion_tokens: 4000, total_tokens: 5500, ms: 20, attempts: 1, model: 'gpt-6.1-terra' }
  assert.deepEqual(sumUsage([legacy, fresh]), { prompt_tokens: 2500, completion_tokens: 6000 })
  assert.deepEqual(safeParseJson('```json\n{"title":"Old"}\n```'), { ok: true, value: { title: 'Old' } }, 'fenced output (seen when JSON mode is dropped) still parses')
  assert.deepEqual(safeParseJson('Here you go: {"title":"Old"} thanks'), { ok: true, value: { title: 'Old' } })
})

test('14. index.ts takes its text model from the provider, honours the worker secret, and keeps one endpoint/one call site', () => {
  assert.match(INDEX, /const TEXT_MODEL_RESOLVED = resolveTextModel\(Deno\.env\.get\('PROCESS_STORY_TEXT_MODEL'\)\)/)
  assert.match(INDEX, /const TEXT_MODEL = TEXT_MODEL_RESOLVED\.model/)
  assert.match(INDEX, /buildChatRequest\(\{ model, messages: .*, temperature, jsonMode: true \}\)/)
  assert.match(INDEX, /await postChatCompletion\(fetch, OPENAI_API_KEY, body\)/)
  assert.match(INDEX, /return parseChatResponse\(await res\.json\(\), model\)/)
  assert.ok(!INDEX.includes('https://api.openai.com/v1/chat/completions'), 'the endpoint literal lives in textProvider.ts only')
  assert.ok(!/['"]gpt-4/.test(INDEX), 'no GPT-4-series literal in the worker')
  assert.ok(!/max_tokens/.test(INDEX))
  assert.ok(!/response_format:\s*\{\s*type:\s*'json_object'\s*\}/.test(INDEX), 'JSON mode is set by the builder, not inline')
  assert.equal((INDEX.match(/callOpenAI\(/g) ?? []).length, 3, 'one definition, two callers (the shared plan/book repair loop and the classroom story-quiz helper); no other fetch to OpenAI')
  assert.match(INDEX, /model_used: bookGen\.usage\.model \?\? TEXT_MODEL/, 'generated_stories records the served model')
})

test('15. image model guard: retired image models in the worker secret or any caller fall back to the supported default', () => {
  for (const m of ['dall-e-2', 'dall-e-3', 'gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-1.5-2025-12-16', 'chatgpt-image-latest', 'DALL-E-3']) {
    assert.equal(isRetiredImageModel(m), true, m)
    assert.deepEqual(resolveImageModel(m), { model: DEFAULT_IMAGE_MODEL, source: 'rejected_override', rejected: m })
    assert.equal(buildImageRequest('p', { model: m }).model, DEFAULT_IMAGE_MODEL, `${m} must never reach the Images API`)
  }
  for (const m of ['gpt-image-2.5-flare', 'gpt-image-2.5-flare-2026-09-08', 'gpt-image-2.5-sunburst', 'gpt-image-2']) {
    assert.equal(isRetiredImageModel(m), false, m)
    assert.deepEqual(resolveImageModel(m), { model: m, source: 'override' })
  }
  assert.deepEqual(resolveImageModel(''), { model: DEFAULT_IMAGE_MODEL, source: 'default' })
  assert.equal(DEFAULT_IMAGE_MODEL, 'gpt-image-2.5-flare', 'current catalogue model; preserved on purpose')
  assert.match(INDEX, /const IMAGE_MODEL_RESOLVED = resolveImageModel\(Deno\.env\.get\('PROCESS_STORY_IMAGE_MODEL'\)\)/)
  assert.match(INDEX, /const IMAGE_MODEL = IMAGE_MODEL_RESOLVED\.model/)
})

// ── Hardening round (PR #41 follow-up) ───────────────────────────────────────

test('16. only "unsupported" 400s qualify: out-of-range values, unknown model, bad messages, 404s never trigger a parameter drop', () => {
  const body: ChatRequestBody = { model: 'gpt-6.1-terra', messages: [], reasoning_effort: 'none', temperature: 0.8, response_format: { type: 'json_object' }, max_completion_tokens: 900 }
  // Same param, but the value is out of range → a real request bug, keep the parameter and surface the error.
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Invalid value: 3 is greater than the maximum of 2 for temperature","param":"temperature","code":"decimal_above_max_value"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Invalid \'max_completion_tokens\': integer below minimum value.","param":"max_completion_tokens","code":"integer_below_min_value"}}', body), null)
  // Unknown or retired model: OpenAI answers 404 model_not_found or a 400 about `model`; neither is ours to retry.
  assert.equal(compatibilityFallback(404, '{"error":{"message":"The model `gpt-4o` does not exist or you do not have access to it.","param":null,"code":"model_not_found"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Unsupported model: gpt-4o has been deprecated","param":"model","code":"unsupported_parameter"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Invalid value for role","param":"messages[0].role","code":"invalid_value"}}', body), null)
  // Auth, quota, rate limit, server, content policy: untouched.
  for (const [st, b] of [[401, '{"error":{"message":"Incorrect API key provided","code":"invalid_api_key","param":"temperature"}}'], [403, '{"error":{"message":"unsupported_country_region_territory","code":"unsupported_country_region_territory"}}'], [429, '{"error":{"message":"You exceeded your current quota","code":"insufficient_quota","param":"temperature"}}'], [500, 'Unsupported parameter: \'temperature\''], [503, '{"error":{"message":"The engine is currently overloaded"}}']] as Array<[number, string]>) {
    assert.equal(compatibilityFallback(st, b, body), null, `status ${st}`)
  }
  // A 400 with "unsupported" wording but no recognisable parameter: nothing to drop.
  assert.equal(compatibilityFallback(400, '{"error":{"message":"Unsupported parameter: \'foo\'","param":"foo","code":"unsupported_parameter"}}', body), null)
  assert.equal(compatibilityFallback(400, '{"error":{"message":"This model does not support images","code":"unsupported_parameter"}}', body), null)
  assert.equal(compatibilityFallback(400, '', body), null)
  assert.equal(compatibilityFallback(400, '<html>Bad Request</html>', body), null)
})

test('17. dropping reasoning_effort also drops temperature, so the retry cannot fail on the coupled parameter', () => {
  const body: ChatRequestBody = { model: 'gpt-6-luna', messages: [], reasoning_effort: 'none', temperature: 0.7, max_completion_tokens: 600, stream: true }
  const fb = compatibilityFallback(400, '{"error":{"message":"Unsupported value: \'none\' is not supported with this model.","param":"reasoning_effort","code":"unsupported_value"}}', body)
  assert.ok(fb)
  assert.equal(fb.dropped, 'reasoning_effort')
  assert.deepEqual(fb.alsoDropped, ['temperature'])
  assert.deepEqual(fb.body, { model: 'gpt-6-luna', messages: [], max_completion_tokens: 600, stream: true }, 'max_completion_tokens stays to bound any reasoning tokens; stream stays')
  // Dropping temperature alone leaves reasoning_effort none in place (no hidden reasoning tokens appear).
  const t = compatibilityFallback(400, '{"error":{"message":"Unsupported parameter: \'temperature\'","param":"temperature","code":"unsupported_parameter"}}', body)
  assert.equal(t?.body.reasoning_effort, 'none'); assert.deepEqual(t?.alsoDropped, [])
  // Without temperature there is nothing to couple.
  const noTemp = compatibilityFallback(400, '{"error":{"message":"x","param":"reasoning_effort","code":"unsupported_parameter"}}', { model: 'm', messages: [], reasoning_effort: 'none' })
  assert.deepEqual(noTemp, { body: { model: 'm', messages: [] }, dropped: 'reasoning_effort', alsoDropped: [] })
})

test('18. compatibility memory: a confirmed rejection is remembered per model and applied up front; failures are not remembered', async () => {
  resetCompatibilityMemory()
  const err = { error: { message: "Unsupported parameter: 'response_format' is not supported with this model.", param: 'response_format', code: 'unsupported_parameter' } }
  const ok = { choices: [{ message: { content: '{"ok":true}' } }] }
  const body = buildChatRequest({ model: 'gpt-6.1-terra', messages: [{ role: 'user', content: 'JSON please' }], temperature: 0.8, jsonMode: true })
  const m1 = mockFetch([{ status: 400, body: err }, { status: 200, body: ok }])
  const out1 = await postChatCompletion(m1.fetchImpl, 'k', body)
  assert.equal(out1.dropped, 'response_format'); assert.deepEqual(out1.omitted, [])
  assert.deepEqual(knownIncompatibilitiesFor('gpt-6.1-terra'), ['response_format'])
  assert.deepEqual(knownIncompatibilitiesFor('gpt-6-luna'), [], 'keyed by model')
  // Next call in the same process: one request, already without response_format, temperature still present.
  const m2 = mockFetch([{ status: 200, body: ok }])
  const out2 = await postChatCompletion(m2.fetchImpl, 'k', body)
  assert.equal(m2.calls.length, 1); assert.equal(out2.dropped, null); assert.deepEqual(out2.omitted, ['response_format'])
  assert.ok(!('response_format' in m2.calls[0].body)); assert.equal(m2.calls[0].body.temperature, 0.8); assert.equal(m2.calls[0].body.reasoning_effort, 'none')
  // Other models are untouched.
  const luna = buildChatRequest({ model: 'gpt-6-luna', messages: [{ role: 'user', content: 'hi' }], jsonMode: true })
  assert.equal(applyKnownIncompatibilities(luna), luna, 'same object when nothing applies')
  // A retry that still fails does not teach anything.
  resetCompatibilityMemory()
  const m3 = mockFetch([{ status: 400, body: err }, { status: 400, body: { error: { message: 'still bad', param: 'messages' } } }])
  await postChatCompletion(m3.fetchImpl, 'k', body)
  assert.deepEqual(knownIncompatibilitiesFor('gpt-6.1-terra'), [], 'a second 400 is not proof the parameter was the problem')
  // A 429 on the retry still proves the 400 was about the parameter.
  const m4 = mockFetch([{ status: 400, body: err }, { status: 429, body: { error: { message: 'rate' } } }])
  const out4 = await postChatCompletion(m4.fetchImpl, 'k', body)
  assert.equal(out4.res.status, 429); assert.deepEqual(knownIncompatibilitiesFor('gpt-6.1-terra'), ['response_format'])
  recordIncompatibility('gpt-6.1-terra', ['reasoning_effort', 'temperature'])
  assert.deepEqual(knownIncompatibilitiesFor('gpt-6.1-terra').sort(), ['reasoning_effort', 'response_format', 'temperature'])
  resetCompatibilityMemory()
  assert.deepEqual(knownIncompatibilitiesFor('gpt-6.1-terra'), [])
})

test('19. story JSON stays fully validated when JSON mode is dropped: prose-wrapped or fenced output is parsed, then every structural rule still applies', () => {
  // What generateJsonWithRepair does after callOpenAI: safeParseJson → validateStoryPlan / validateBook → repair prompt on failure.
  const plan = { title: 'The Snowy Village', premise: 'Theo helps a lost lantern find its way home before the first snowfall.', protagonist: { name: 'Theo', characterization: 'Curious and kind.', want: 'To light the village square.' }, supporting_characters: [], setting: 'A snowy mountain village', central_conflict: 'The lantern is lost in the snow.', goal: 'Find the lantern.', emotional_arc: 'Worry to pride', beginning_state: 'Dark square', escalation: 'Snow gets heavier', climax: 'Theo climbs the bell tower', resolution: 'The lantern is lit', ending_state: 'Bright square', lesson: 'Kindness lights the way',
    pages: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, phase: i === 0 ? 'setup' : i === 1 ? 'inciting' : i === 6 ? 'climax' : i === 7 ? 'resolution' : i === 3 ? 'complication' : 'development', beat: `On page ${i + 1} Theo does something that follows from the page before.`, purpose: 'Advance the search for the lantern.', development: i % 2 ? 'Theo grows braver.' : '', continuity: 'The lantern is still missing.' })) }
  const wrapped = `Here is the plan you asked for:\n\`\`\`json\n${JSON.stringify(plan)}\n\`\`\`\nLet me know if you want changes.`
  const parsed = safeParseJson(wrapped)
  assert.ok(parsed.ok)
  const valid = validateStoryPlan(parsed.value, 8)
  assert.equal(valid.ok, true, JSON.stringify(valid))
  // The same validator rejects a structurally wrong plan whether or not JSON mode produced it.
  const broken = safeParseJson(`\`\`\`json\n${JSON.stringify({ ...plan, pages: plan.pages.slice(0, 5) })}\n\`\`\``)
  assert.ok(broken.ok)
  assert.equal(validateStoryPlan(broken.value, 8).ok, false, 'page count is still enforced')
  assert.equal(validateStoryPlan({ title: 'x' }, 8).ok, false)
  // Book stage: prose-wrapped JSON parses; validateBook still enforces page count, text and image descriptions.
  const book = { title: 'The Snowy Village', pages: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: `Theo walked through the snow on page ${i + 1}. The lantern glowed softly ahead of him.`, image_description: `Theo in a red scarf walking through a snowy village street, page ${i + 1}, soft watercolor.` })) }
  const bookParsed = safeParseJson(`Sure! ${JSON.stringify(book)} Hope this helps.`)
  assert.ok(bookParsed.ok)
  const bookValid = validateBook(bookParsed.value, 8, plan as never)
  assert.equal(bookValid.ok, true, JSON.stringify(bookValid))
  assert.equal(validateBook({ ...book, pages: book.pages.slice(0, 7) }, 8, plan as never).ok, false)
  // And output that is not JSON at all is a validation failure (→ repair prompt), never silently accepted.
  assert.equal(safeParseJson('Once upon a time there was no JSON here.').ok, false)
  // The worker's repair loop is intact around all of this.
  assert.match(INDEX, /while \(attempts < MAX_STAGE_ATTEMPTS\)/)
  assert.match(INDEX, /convo = buildRepairMessages\(convo, res\.content, lastErrors, label\)/)
  assert.match(INDEX, /const parsed = safeParseJson\(res\.content\)/)
})

test('20. Quilliam streaming: the fallback happens before any stream is consumed, keeps stream:true, and memory is applied on later turns', () => {
  const route = readFileSync(resolve(import.meta.dirname, '..', '..', '..', 'app', 'api', 'chat', 'route.ts'), 'utf8')
  assert.match(route, /applyKnownIncompatibilities\(chatParams\(\{/)
  assert.match(route, /err instanceof OpenAI\.BadRequestError/)
  assert.match(route, /stream = await create\(fb\.body\)/)
  assert.match(route, /recordIncompatibility\(params\.model, \[fb\.dropped, \.\.\.fb\.alsoDropped\]\)/)
  // The ReadableStream that pipes deltas to the client is created only after `stream` is resolved.
  assert.ok(route.indexOf('stream = await create(fb.body)') < route.lastIndexOf('const readable = new ReadableStream('), 'retry resolves before the response stream is built')
  const params: ChatRequestBody = { model: 'gpt-6-luna', messages: [], reasoning_effort: 'none', temperature: 0.7, max_completion_tokens: 600, stream: true }
  const fb = compatibilityFallback(400, JSON.stringify({ error: { message: "Unsupported parameter: 'temperature' is not supported with this model.", type: 'invalid_request_error', param: 'temperature', code: 'unsupported_parameter' } }), params)
  assert.ok(fb); assert.equal(fb.body.stream, true); assert.equal(fb.body.max_completion_tokens, 600)
})
