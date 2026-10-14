import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderEmail, storyFailedEmail, heading, button, escapeHtml } from './layout.ts'

test('Edge Function email layout is a byte-identical mirror of lib/email/layout.ts', () => {
  assert.equal(
    readFileSync('supabase/functions/process-story/emailLayout.ts', 'utf8'),
    readFileSync('lib/email/layout.ts', 'utf8'),
    'run: cp lib/email/layout.ts supabase/functions/process-story/emailLayout.ts',
  )
})

test('layout carries brand, language and escapes plain-text fields', () => {
  const html = renderEmail({ lang: 'es', appUrl: 'https://nestandquill.com/', title: 'Hi <b>', preheader: 'Pre & view', footerNote: 'Note <x>', body: heading('Hola') + button('Ir', 'https://nestandquill.com/create') })
  assert.match(html, /<html lang="es"/)
  assert.match(html, /https:\/\/nestandquill\.com\/brand\/email-quill\.png/)
  assert.match(html, /Nest &amp; Quill/)
  assert.match(html, /border-top:4px solid #c59a00/)
  assert.match(html, /Todos los derechos reservados\./)
  assert.match(html, /<title>Hi &lt;b&gt;<\/title>/)
  assert.match(html, /Pre &amp; view/)
  assert.match(html, /Note &lt;x&gt;/)
  assert.doesNotMatch(html, /nestandquill\.com\/\/create/)
})

test('internal audience labels the email and links to admin, not marketing pages', () => {
  const html = renderEmail({ appUrl: 'https://nestandquill.com', title: 't', body: '', audience: 'internal' })
  assert.match(html, /Admin notification/)
  assert.match(html, /\/admin"/)
  assert.doesNotMatch(html, /\/create"/)
})

test('story-failed email is localized and escapes the child name in HTML only', () => {
  const en = storyFailedEmail({ appUrl: 'https://nestandquill.com', childName: 'Mia <3', requestId: 'abc' })
  assert.equal(en.subject, "We hit a snag with Mia <3's story")
  assert.match(en.html, /Something went wrong with Mia &lt;3's story/)
  assert.match(en.html, /https:\/\/nestandquill\.com\/story\/abc/)
  const es = storyFailedEmail({ lang: 'es', appUrl: 'https://nestandquill.com', childName: 'Mia', requestId: 'abc' })
  assert.equal(es.subject, 'Tuvimos un problema con el cuento de Mia')
  assert.match(es.html, /<html lang="es"/)
  assert.equal(escapeHtml(`a&"'`), 'a&amp;&quot;&#39;')
})
