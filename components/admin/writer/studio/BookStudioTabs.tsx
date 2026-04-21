'use client'

import { useState } from 'react'
import type { WriterBook, WriterBookWithChapters } from '@/types/writer'
import BookMetadataPanel from './BookMetadataPanel'
import FrontMatterPanel from './FrontMatterPanel'
import BackMatterPanel from './BackMatterPanel'
import CopyrightBuilder from './CopyrightBuilder'

type Tab = 'write' | 'studio' | 'export'

export default function BookStudioTabs({
  book,
  writeContent,
}: {
  book: WriterBook
  writeContent: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('write')

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {(['write', 'studio', 'export'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors capitalize ${
              tab === t
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'write' ? 'Write' : t === 'studio' ? 'Studio' : 'Export'}
          </button>
        ))}
      </div>

      {tab === 'write' && writeContent}

      {tab === 'studio' && (
        <div className="space-y-4">
          <BookMetadataPanel book={book} />
          <FrontMatterPanel bookId={book.id} />
          <BackMatterPanel bookId={book.id} />
          <CopyrightBuilder book={book} />
        </div>
      )}

      {tab === 'export' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-8 text-center space-y-2">
          <p className="text-sm font-semibold text-white">Export Builder</p>
          <p className="text-xs text-gray-500">Coming in Phase 5 — finish your front/back matter first.</p>
        </div>
      )}
    </div>
  )
}
