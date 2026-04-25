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

const STATUS_OPTIONS: { value: WriterBook['status']; label: string; color: string }[] = [
  { value: 'draft',       label: 'Draft',       color: 'text-gray-400' },
  { value: 'in_progress', label: 'In Progress', color: 'text-brand-400' },
  { value: 'complete',    label: 'Complete',    color: 'text-green-400' },
  { value: 'archived',    label: 'Archived',    color: 'text-gray-600' },
]

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
  // Default to read mode — the book opens as an ebook
  const [mode, setMode] = useState<Mode>('read')
  const [bookStatus, setBookStatus] = useState<WriterBook['status']>(book.status)
  const [sections, setSections] = useState<WriterBookSection[]>([])
  const [focusChapterId, setFocusChapterId] = useState<string | null>(null)
  const [focusZone, setFocusZone] = useState<'front' | 'back' | null>(null)
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    fetch(`/api/admin/writer/books/${book.id}/sections`)
      .then(r => r.json())
      .then(setSections)
      .catch(() => {})
  }, [book.id])

  // Jump from reader → editor for a specific chapter
  function editChapter(chapterId: string) {
    setFocusChapterId(chapterId)
    setFocusZone(null)
    setMode('edit')
  }

  // Jump from reader → editor for front/back matter
  function editSection(zone: 'front' | 'back') {
    setFocusZone(zone)
    setFocusChapterId(null)
    setMode('edit')
  }

  async function handleStatusChange(status: WriterBook['status']) {
    setBookStatus(status)
    await fetch(`/api/admin/writer/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  // Scroll to the focused element after switching to edit
  useEffect(() => {
    if (mode !== 'edit') return
    const target = focusChapterId
    if (target) {
      setTimeout(() => {
        chapterRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setFocusChapterId(null)
      }, 120)
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
      <header className="border-b border-gray-800 px-4 sm:px-6 h-13 flex items-center justify-between sticky top-0 bg-gray-950 z-10" style={{ height: 52 }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/admin/writer" className="text-xs text-gray-500 hover:text-gray-300 shrink-0">← Books</Link>
          <span className="text-gray-700 shrink-0">/</span>
          <span className="font-semibold text-white truncate text-sm">{book.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Read / Edit toggle */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode('read')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${mode === 'read' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Read
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${mode === 'edit' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Edit
            </button>
          </div>

          {mode === 'edit' && (
            <a
              href={`/api/admin/writer/books/${book.id}/export-epub`}
              className="hidden sm:inline-flex bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Export ePub
            </a>
          )}
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
          onEditChapter={editChapter}
          onEditSection={editSection}
        />
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Back to reading */}
          <button
            onClick={() => setMode('read')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to reading
          </button>

          {/* Book header */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 sm:px-6 py-5 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-xl sm:text-2xl text-white">{book.title}</h1>
                {book.subtitle && <p className="text-gray-400 italic text-sm mt-0.5">{book.subtitle}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-xs text-gray-500 hidden sm:block">{book.genre} · {book.tone}</p>
                <select
                  value={bookStatus}
                  onChange={e => handleStatusChange(e.target.value as WriterBook['status'])}
                  className={`text-xs font-semibold bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer transition-colors ${STATUS_OPTIONS.find(o => o.value === bookStatus)?.color ?? 'text-gray-400'}`}
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-400">{book.premise}</p>
            <div className="flex flex-wrap gap-4 sm:gap-6 pt-2 text-xs text-gray-500">
              <span><span className="text-white font-semibold">{book.target_chapters}</span> chapters</span>
              <span><span className="text-white font-semibold">{doneScenes}/{totalScenes}</span> scenes</span>
              <span><span className="text-white font-semibold">{totalWords.toLocaleString()}</span> words</span>
            </div>
          </div>

          <BookStudioTabs book={book} writeContent={writeContent} />
        </div>
      )}
    </div>
  )
}
