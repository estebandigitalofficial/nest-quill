// OpenAI model retirement migration (2026-10-30) — app-side policy tests.
// Run: node --experimental-strip-types --test lib/ai/models.test.ts
//
// Pins: the worker/app text-provider mirror; that every OpenAI text call in
// the Next.js app names its model through lib/ai/models (no literals, no
// raw endpoint, no deprecated max_tokens); that no retired model ID is
// reachable from production code; and the Quilliam route's request shape.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { CHAT_ASSISTANT_MODEL, UTILITY_MODEL, WRITING_MODEL, TEXT_MODELS, chatCompletion, chatParams, isRetiredTextModel, resolveTextModel } from './models.ts'
import { CHAT_COMPLETIONS_ENDPOINT } from './textProvider.ts'

const ROOT = resolve(import.meta.dirname, '..', '..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

/** Production source: app/, lib/, components/, scripts/ and the worker, minus tests. */
const SOURCE = ['app', 'lib', 'components', 'scripts', 'supabase/functions'].flatMap(d => walk(resolve(ROOT, d))).filter(f => !/\.test\.ts$/.test(f))
const rel = (f: string) => relative(ROOT, f)

test('1. the Edge Function text provider is a byte-identical mirror of lib/ai/textProvider.ts', () => {
  assert.equal(
    read('supabase/functions/process-story/textProvider.ts'),
    read('lib/ai/textProvider.ts'),
    'run: cp supabase/functions/process-story/textProvider.ts lib/ai/textProvider.ts',
  )
})

test('2. workload constants are current, non-retired models and differ by workload on purpose', () => {
  for (const m of [CHAT_ASSISTANT_MODEL, WRITING_MODEL, UTILITY_MODEL]) {
    assert.equal(isRetiredTextModel(m), false, m)
    assert.ok(Object.values(TEXT_MODELS).includes(m as never), `${m} comes from TEXT_MODELS`)
  }
  assert.equal(CHAT_ASSISTANT_MODEL, 'gpt-6-luna', 'Quilliam: fast, cheap, streamed')
  assert.equal(UTILITY_MODEL, 'gpt-6-luna', 'learning tools, activities, proofreading, vision extraction')
  assert.equal(WRITING_MODEL, 'gpt-6.1-terra', 'Writer Studio and long-form prose')
  assert.notEqual(WRITING_MODEL, UTILITY_MODEL, 'not every retired model maps to the same replacement')
})

test('3. no retired OpenAI model identifier appears in production source (strings or comments that name one as the model)', () => {
  const offenders: string[] = []
  for (const f of SOURCE) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/['"`](gpt-4o[^'"`]*|gpt-4\.1[^'"`]*|gpt-4(?:-[^'"`]*)?|chatgpt-4o-latest|dall-e-[23]|gpt-image-1(?:[^'"`]*)?)['"`]/g)) {
      if (/textProvider\.ts$|imageProvider\.ts$/.test(f)) continue // the guard lists define what is retired
      offenders.push(`${rel(f)}: ${m[0]}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('4. every Chat Completions call in the app goes through lib/ai/models: no raw endpoint, no inline model literal, no max_tokens', () => {
  const raw: string[] = []
  const literals: string[] = []
  const maxTokens: string[] = []
  for (const f of SOURCE) {
    const text = readFileSync(f, 'utf8')
    const r = rel(f)
    if (text.includes(CHAT_COMPLETIONS_ENDPOINT) && !/textProvider\.ts$|scripts\/generate-all-content\.mjs$/.test(r)) raw.push(r)
    if (/\bmodel:\s*['"`]/.test(text) && !/textProvider\.ts$|imageProvider\.ts$|scripts\/generate-all-content\.mjs$/.test(r)) literals.push(r)
    if (/\bmax_tokens\b\s*:/.test(text)) maxTokens.push(r)
  }
  assert.deepEqual(raw, [], 'raw fetch to the endpoint outside the provider')
  assert.deepEqual(literals, [], 'model literal outside the provider modules')
  assert.deepEqual(maxTokens, [], 'deprecated max_tokens (use maxOutputTokens → max_completion_tokens)')
  // The one ops script that cannot import TS mirrors the utility model and effort explicitly.
  const script = read('scripts/generate-all-content.mjs')
  assert.match(script, new RegExp(`model: '${UTILITY_MODEL}'`))
  assert.match(script, /reasoning_effort: 'none'/)
})

test('5. every production file that calls OpenAI imports its model from lib/ai/models', () => {
  const callers = SOURCE.filter(f => /chatCompletion\(|chatParams\(/.test(readFileSync(f, 'utf8')) && !/lib\/ai\//.test(rel(f)))
  assert.ok(callers.length >= 16, `expected the 16 migrated call sites plus the chat route, found ${callers.length}`)
  for (const f of callers) {
    const text = readFileSync(f, 'utf8')
    assert.match(text, /from '@\/lib\/ai\/models'/, `${rel(f)} must import from lib/ai/models`)
    assert.match(text, /\b(CHAT_ASSISTANT_MODEL|WRITING_MODEL|UTILITY_MODEL)\b/, `${rel(f)} must use a workload constant`)
  }
  const expected = [
    'app/api/admin/university/generate/route.ts',
    'app/api/admin/writer/books/[bookId]/analyze/route.ts',
    'app/api/admin/writer/books/[bookId]/auto-outline/route.ts',
    'app/api/admin/writer/books/[bookId]/chapters/[chapterId]/scenes/[sceneId]/generate/route.ts',
    'app/api/admin/writer/books/[bookId]/review/route.ts',
    'app/api/chat/route.ts',
    'app/api/learning/explain/route.ts',
    'app/api/learning/flashcards/route.ts',
    'app/api/learning/math/route.ts',
    'app/api/learning/quiz/route.ts',
    'app/api/learning/reading/route.ts',
    'app/api/learning/study-guide/route.ts',
    'app/api/learning/trivia/route.ts',
    'app/api/story/[requestId]/activities/[type]/route.ts',
    'app/api/study-helper/generate/route.ts',
    'lib/learning/imageExtraction.ts',
    'lib/services/ai.ts',
    'lib/services/assignmentContent.ts',
  ]
  assert.deepEqual(callers.map(rel).sort(), expected.sort())
})

test('6. Quilliam (app/api/chat/route.ts): central model, streamed, bounded, temperature kept, one compatibility retry', () => {
  const route = read('app/api/chat/route.ts')
  assert.match(route, /import \{ CHAT_ASSISTANT_MODEL, chatParams \} from '@\/lib\/ai\/models'/)
  assert.match(route, /model: CHAT_ASSISTANT_MODEL/)
  assert.match(route, /stream: true/)
  assert.match(route, /maxOutputTokens: 600/)
  assert.match(route, /temperature: 0\.7/)
  assert.match(route, /compatibilityFallback\(err\.status/)
  assert.ok(!/gpt-4o/.test(route))
  const params = chatParams({ model: CHAT_ASSISTANT_MODEL, messages: [{ role: 'system', content: 'Eres Quilliam.' }, { role: 'user', content: 'Hola' }], stream: true, maxOutputTokens: 600, temperature: 0.7 })
  assert.deepEqual(params, {
    model: 'gpt-6-luna',
    messages: [{ role: 'system', content: 'Eres Quilliam.' }, { role: 'user', content: 'Hola' }],
    reasoning_effort: 'none',
    temperature: 0.7,
    max_completion_tokens: 600,
    stream: true,
  })
  assert.ok(!('max_tokens' in params))
})

test('7. chatCompletion() posts the built body with the app key and returns the Response untouched for route-level handling', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const realFetch = globalThis.fetch
  const prevKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'sk-unit'
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"questions":[]}' } }] }), { status: 200 })
  }) as typeof fetch
  try {
    const res = await chatCompletion({ model: UTILITY_MODEL, messages: [{ role: 'user', content: 'Return JSON' }], jsonMode: true, temperature: 0.5 })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { choices: [{ message: { content: '{"questions":[]}' } }] })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, CHAT_COMPLETIONS_ENDPOINT)
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer sk-unit')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { model: 'gpt-6-luna', messages: [{ role: 'user', content: 'Return JSON' }], reasoning_effort: 'none', temperature: 0.5, response_format: { type: 'json_object' } })
  } finally {
    globalThis.fetch = realFetch
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prevKey
  }
})

test('8. there is no admin-editable or env-driven text model in the app that could bypass the guard', () => {
  // No app_settings key or env var names a text model in the Next.js app; the
  // only overrides are the worker secrets, both filtered by resolve*Model.
  for (const f of SOURCE) {
    const text = readFileSync(f, 'utf8')
    const r = rel(f)
    if (/process\.env\.[A-Z_]*MODEL/.test(text)) assert.fail(`${r} reads a model from the environment outside the worker`)
    if (/getSetting\([^)]*model/i.test(text)) assert.fail(`${r} reads a model from app_settings`)
  }
  const idx = read('supabase/functions/process-story/index.ts')
  assert.equal((idx.match(/Deno\.env\.get\('PROCESS_STORY_[A-Z_]*MODEL'\)/g) ?? []).length, 2)
  assert.deepEqual(resolveTextModel('gpt-4o-mini'), { model: TEXT_MODELS.quality, source: 'rejected_override', rejected: 'gpt-4o-mini' })
  // The retired DALL·E service (lib/services/images.ts) is gone; nothing imports it.
  assert.throws(() => statSync(resolve(ROOT, 'lib/services/images.ts')))
  for (const f of SOURCE) assert.ok(!/services\/images'/.test(readFileSync(f, 'utf8')), `${rel(f)} imports the removed DALL·E service`)
})
