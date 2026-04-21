'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { WriterBook, WriterBookWithChapters, WriterBookSection } from '@/types/writer'
import BookStudioTabs from './studio/BookStudioTabs'
import BookReader from './BookReader'
import BookOutlineEditor from './BookOutlineEditor'
import BookSourcePanel from './BookSourcePanel'
import GenerateAllButton from './GenerateAllButton'

type Mode = 'read' | 'edit'

export default function BookPageClient({
  book,
  bookData,
  sourceWordCount,
  totalScenes,
  doneScenes,
  totalWords,
}: {
  book: WriterBook
  bookData: WriterBookWithChapters
  sourceWordCount: number | null
  totalScenes: number
  doneScenes: number
  totalWords: number
}) {
  const [mode, setMode] = useState<Mode>('edit')
  const [sections, setSections] = useState<WriterBookSection[]>([])
  const [focusChapterId, setFocusChapterId] = useState<string | null>(null)
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    fetch(`/api/admin/writer/books/${book.id}/sections`)
      .then(r => r.json())
      .then(setSections)
      .catch(() => {})
  }, [book.id])

  function switchToEdit(chapterId?: string, zone?: 'front' | 'back') {
    setMode('edit')
    if (chapterId) setFocusChapterId(chapterId)
  }

  useEffect(() => {
    if (mode === 'edit' && focusChapterId) {
      setTimeout(() => {
        chapterRefs.current[focusChapterId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setFocusChapterId(null)
      }, 100)
    }
  }, [mode, focusChapterId])

  const writeContent = (
    <div className="space-y-6">
      <BookSourcePanel
        bookId={book.id}
        initialFileName={book.source_pdf_name ?? null}
        initialWordCount={sourceWordCount}
        needsMetadata={!!book.source_text && !book.premise}
      />
      {bookData.chapters.length > 0 && (
        <GenerateAllButton bookId={book.id} savedInstructions={book.instructions} />
      )}
      <BookOutlineEditor
        book={bookData}
        focusChapterId={focusChapterId}
        chapterRefs={chapterRefs}
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <Link href="/admin/writer" className="text-xs text-gray-500 hover:text-gray-300">← Books</Link>
          <span className="text-gray-700">/</span>
          <span className="font-semibold text-white truncate max-w-xs">{book.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode('edit')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${mode === 'edit' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Edit
            </button>
            <button
              onClick={() => setMode('read')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${mode === 'read' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Read
            </button>
          </div>
          <a
            href={`/api/admin/writer/books/${book.id}/export-epub`}
            className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Export ePub
          </a>
          <a
            href={`/api/admin/writer/books/${book.id}/export`}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Export Markdown
          </a>
        </div>
      </header>

      {mode === 'read' ? (
        <BookReader
          book={book}
          chapters={bookData.chapters.map(ch => ({
            id: ch.id,
            chapter_number: ch.chapter_number,
            title: ch.title,
            brief: ch.brief,
            scenes: ch.scenes.map(s => ({
              id: s.id,
              scene_number: s.scene_number,
              content: s.content,
              locked: s.locked,
            })),
          }))}
          sections={sections}
          onEditChapter={(chapterId) => switchToEdit(chapterId)}
          onEditSection={(zone) => switchToEdit(undefined, zone)}
        />
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl text-white">{book.title}</h1>
                {book.subtitle && <p className="text-gray-400 italic text-sm mt-0.5">{book.subtitle}</p>}
              </div>
              <p className="text-xs text-gray-500 shrink-0">{book.genre} · {book.tone}</p>
            </div>
            <p className="text-sm text-gray-400">{book.premise}</p>
            <div className="flex gap-6 pt-2 text-xs text-gray-500">
              <span><span className="text-white font-semibold">{book.target_chapters}</span> chapters planned</span>
              <span><span className="text-white font-semibold">{doneScenes}/{totalScenes}</span> scenes written</span>
              <span><span className="text-white font-semibold">{totalWords.toLocaleString()}</span> words so far</span>
            </div>
          </div>
          <BookStudioTabs book={book} writeContent={writeContent} />
        </div>
      )}
    </div>
  )
}
