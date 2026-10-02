// Run: node --experimental-strip-types --test lib/services/cover.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coverPresentation, pickCoverPath, pickThumbnailPath } from './cover.ts'

test('11-13. one canonical cover asset is resolved for PDF, reader and library', () => {
  const story = { cover_status: 'complete', cover_storage_path: 'req-1/cover.png' }
  assert.equal(pickCoverPath(story), 'req-1/cover.png')
  assert.equal(pickThumbnailPath(story, 'req-1/1.png'), 'req-1/cover.png')
  assert.deepEqual(coverPresentation('https://signed/cover'), { kind: 'artwork', url: 'https://signed/cover' })
})

test('9. image-disabled or failed covers fall back cleanly (no broken image)', () => {
  for (const story of [null, undefined, {}, { cover_status: 'failed', cover_storage_path: 'req-1/cover.png' }, { cover_status: 'complete', cover_storage_path: '' }, { cover_status: 'skipped' }]) {
    assert.equal(pickCoverPath(story as never), null)
  }
  assert.equal(pickThumbnailPath({ cover_status: 'failed' }, 'req-1/1.png'), 'req-1/1.png')
  assert.equal(pickThumbnailPath({ cover_status: 'failed' }, null), null)
  assert.deepEqual(coverPresentation(null), { kind: 'typographic' })
  assert.deepEqual(coverPresentation(''), { kind: 'typographic' })
})
