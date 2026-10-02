// Run: node --experimental-strip-types --test lib/services/storyFormSynthesis.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_NOTES_DB_LIMIT,
  mergeIntoCustomNotes,
  synthesizeStructureLines,
  synthesizeTheme,
  synthesizeTraitsLine,
} from './storyFormSynthesis.ts'

test('traits become a labelled line the worker can parse', () => {
  assert.equal(synthesizeTraitsLine(['brave', 'curious'], 'quietly stubborn'), 'Character traits: brave, curious, quietly stubborn')
  assert.equal(synthesizeTraitsLine([], null), null)
  assert.equal(synthesizeTraitsLine(undefined, '  '), null)
})

test('conflict and goal are NOT duplicated when the theme was synthesized from the cards', () => {
  const theme = synthesizeTheme({ setting: 'ocean', conflict: 'overcome_fear', goal: 'find_courage' })!
  assert.deepEqual(synthesizeStructureLines({ theme, conflict: 'overcome_fear', goal: 'find_courage' }), [])
})

test('conflict and goal travel in custom_notes when the parent typed a custom theme', () => {
  const lines = synthesizeStructureLines({ theme: 'A brave rabbit who learns to share', conflict: 'overcome_fear', goal: 'find_courage' })
  assert.deepEqual(lines, ['Story conflict: a fear must be faced and overcome', 'Story goal: finding the courage inside'])
})

test('structured lines come first and the note follows on its own line', () => {
  const merged = mergeIntoCustomNotes('Loves her red wellies', ['Character traits: brave', 'Story goal: finding the courage inside'])
  assert.equal(merged, 'Character traits: brave\nStory goal: finding the courage inside\nLoves her red wellies')
})

test('empty inputs produce no custom_notes at all', () => {
  assert.equal(mergeIntoCustomNotes(undefined, [null, undefined, '']), undefined)
  assert.equal(mergeIntoCustomNotes('   ', []), undefined)
})

test('only the parent note is truncated when the DB limit is hit, never the selections', () => {
  const note = 'x'.repeat(500)
  const merged = mergeIntoCustomNotes(note, ['Character traits: brave, curious, clever', 'Story conflict: a fear must be faced and overcome', 'Story goal: finding the courage inside'])!
  assert.ok(merged.length <= CUSTOM_NOTES_DB_LIMIT)
  assert.ok(merged.startsWith('Character traits: brave, curious, clever\nStory conflict:'))
  assert.ok(merged.includes('Story goal: finding the courage inside\n'))
})
