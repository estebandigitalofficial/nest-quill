// Quilliam identity (2026-10-15) — deterministic policy tests.
// Run: node --experimental-strip-types --test lib/assistant/identity.test.ts
//
// Pins the canonical assistant identity in lib/assistant/identity.ts, that the
// chat route actually uses it ahead of the config-derived commercial
// knowledge, and that the EN/ES chat UI copy names Quilliam consistently
// (name never translated) while keeping descriptive accessible labels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ASSISTANT_NAME, ASSISTANT_ROLE, assistantIdentityPrompt, assistantIdentitySpanishNote } from './identity.ts'
import { dictionaries } from '../i18n/index.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

test('1. canonical name and role', () => {
  assert.equal(ASSISTANT_NAME, 'Quilliam')
  assert.equal(ASSISTANT_ROLE.en, 'Nest & Quill story assistant')
  assert.equal(ASSISTANT_ROLE.es, 'asistente de cuentos de Nest & Quill')
})

test('2. identity prompt establishes Quilliam, honesty and no capability claims', () => {
  const p = assistantIdentityPrompt()
  assert.match(p, /^Your name is Quilliam\. You are Quilliam, the Nest & Quill story assistant/)
  assert.match(p, /asks who or what you are, answer in the first person as Quilliam/)
  assert.match(p, /never generically as "the Nest & Quill assistant"/)
  assert.match(p, /do not reintroduce yourself in every reply/)
  assert.match(p, /Never pretend to be human/)
  assert.match(p, /do not personally write, illustrate, store, deliver or process books/)
  assert.match(p, /never invent prices, plan limits, features or products/)
  assert.match(assistantIdentitySpanishNote(), /stays Quilliam in Spanish \(never translate it\)/)
  assert.match(assistantIdentitySpanishNote(), /Soy tu asistente de cuentos de Nest & Quill/)
})

test('3. chat route opens with the identity and keeps the commercial guardrails', () => {
  const route = read('app/api/chat/route.ts')
  assert.match(route, /return `\$\{assistantIdentityPrompt\(\)\}/)
  assert.match(route, /\$\{assistantIdentitySpanishNote\(\)\}/)
  assert.doesNotMatch(route, /You are the Nest & Quill assistant/)
  assert.match(route, /\$\{launchPricingKnowledge\(\)\}/)
  assert.match(route, /only state what is listed here; never invent plans, discounts, annual pricing or features/)
  assert.match(route, /Do not mention or promise educator plans, Classroom, Homeschool/)
})

test('4. EN/ES chat UI names Quilliam, untranslated, with descriptive accessible labels', () => {
  const { en, es } = dictionaries
  for (const d of [en, es]) {
    assert.equal(d.chat.title, ASSISTANT_NAME)
    assert.match(d.chat.greeting, /Quilliam/)
    assert.match(d.chat.open, /Quilliam/)
    assert.doesNotMatch(d.chat.greeting + d.chat.title + d.chat.subtitle, /Nest & Quill Assistant|el asistente de Nest & Quill|Asistente de Nest & Quill/)
  }
  assert.match(en.chat.greeting, /^Hi! I'm Quilliam, your Nest & Quill story assistant\./)
  assert.match(es.chat.greeting, /^¡Hola! Soy Quilliam, tu asistente de cuentos de Nest & Quill\./)
  assert.match(en.chat.open, new RegExp(ASSISTANT_ROLE.en))
  assert.match(es.chat.open, new RegExp(ASSISTANT_ROLE.es))
})
