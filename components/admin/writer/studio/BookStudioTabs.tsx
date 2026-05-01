'use client'

import { useState } from 'react'
import type { WriterBook, WriterBookWithChapters } from '@/types/writer'
import BookMetadataPanel from './BookMetadataPanel'
import FrontMatterPanel from './FrontMatterPanel'
import BackMatterPanel from './BackMatterPanel'
import CopyrightBuilder from './CopyrightBuilder'
import ExportBuilder from './ExportBuilder'

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
      <div className="flex gap-1 bg-adm-surface border border-adm-border rounded-xl p-1">
        {(['write', 'studio', 'export'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors capitalize ${
              tab === t
                ? 'bg-adm-surface text-white'
                : 'text-adm-muted hover:text-adm-muted'
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
        <div className="bg-adm-surface border border-adm-border rounded-xl px-6 py-6">
          <p className="text-xs font-bold text-adm-muted uppercase tracking-widest mb-5">Export Builder</p>
          <ExportBuilder bookId={book.id} />
        </div>
      )}
    </div>
  )
}
