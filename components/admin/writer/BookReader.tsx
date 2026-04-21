'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { WriterBook, WriterBookSection } from '@/types/writer'

interface ReaderScene {
  id: string
  scene_number: number
  content: string | null
  locked: boolean
}

interface ReaderChapter {
  id: string
  chapter_number: number
  title: string
  brief: string
  scenes: ReaderScene[]
}

type Page =
  | { kind: 'title' }
  | { kind: 'front'; section: WriterBookSection }
  | { kind: 'chapter'; chapter: ReaderChapter }
  | { kind: 'back'; section: WriterBookSection }

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

export default function BookReader({
  book,
  chapters,
  sections,
  onEditChapter,
  onEditSection,
}: {
  book: WriterBook
  chapters: ReaderChapter[]
  sections: WriterBookSection[]
  onEditChapter: (chapterId: string) => void
  onEditSection: (zone: 'front' | 'back') => void
}) {
  const frontMatter = sections
    .filter(s => s.zone === 'front' && s.enabled && s.content)
    .sort((a, b) => a.position - b.position)

  const backMatter = sections
    .filter(s => s.zone === 'back' && s.enabled && s.content)
    .sort((a, b) => a.position - b.position)

  const writtenChapters = chapters.filter(ch =>
    ch.scenes.some(s => s.content)
  )

  // Build page list
  const pages: Page[] = [
    { kind: 'title' },
    ...frontMatter.map(s => ({ kind: 'front' as const, section: s })),
    ...writtenChapters.map(ch => ({ kind: 'chapter' as const, chapter: ch })),
    ...backMatter.map(s => ({ kind: 'back' as const, section: s })),
  ]

  const [current, setCurrent] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const [animating, setAnimating] = useState(false)
  const touchStartX = useRef<number | null>(null)

  function go(to: number) {
    if (to < 0 || to >= pages.length || animating) return
    setDir(to > current ? 'next' : 'prev')
    setAnimating(true)
    setTimeout(() => {
      setCurrent(to)
      setAnimating(false)
      setDir(null)
      window.scrollTo(0, 0)
    }, 200)
  }

  const next = useCallback(() => go(current + 1), [current, animating])
  const prev = useCallback(() => go(current - 1), [current, animating])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const page = pages[current]

  function renderContent() {
    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <h1 className="font-serif text-5xl text-white leading-tight">{book.title}</h1>
          {book.subtitle && <p className="font-serif text-xl text-gray-400 italic">{book.subtitle}</p>}
          {(book.author_name || book.pen_name) && (
            <p className="text-gray-500 text-sm tracking-widest uppercase mt-4">
              {book.pen_name || book.author_name}
            </p>
          )}
          {pages.length > 1 && (
            <p className="text-xs text-gray-700 mt-8">Press → to begin reading</p>
          )}
        </div>
      )
    }

    if (page.kind === 'front' || page.kind === 'back') {
      const { section } = page
      const isEpigraph = section.type === 'epigraph'
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            {!isEpigraph && (
              <h2 className="font-serif text-2xl text-white">
                {SECTION_LABELS[section.type] ?? section.type}
              </h2>
            )}
            <button
              onClick={() => page.kind === 'front' ? onEditSection('front') : onEditSection('back')}
              className="ml-auto text-xs text-gray-600 hover:text-brand-400 transition-colors"
            >
              Edit ✎
            </button>
          </div>
          <div className={isEpigraph ? 'text-center italic text-gray-400 py-8' : ''}>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i} className="font-serif text-gray-300 text-base leading-relaxed mb-5">
                {para.trim()}
              </p>
            ))}
          </div>
        </div>
      )
    }

    if (page.kind === 'chapter') {
      const { chapter } = page
      const scenes = chapter.scenes
        .filter(s => s.content)
        .sort((a, b) => a.scene_number - b.scene_number)

      return (
        <div className="space-y-6">
          <div className="flex items-start justify-between border-b border-gray-800 pb-4 gap-4">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">
                Chapter {chapter.chapter_number}
              </p>
              <h2 className="font-serif text-2xl text-white">{chapter.title}</h2>
            </div>
            <button
              onClick={() => onEditChapter(chapter.id)}
              className="text-xs text-gray-600 hover:text-brand-400 transition-colors shrink-0 mt-1"
            >
              Edit ✎
            </button>
          </div>
          <div>
            {scenes.map((scene, idx) => (
              <div key={scene.id}>
                {idx > 0 && (
                  <div className="text-center text-gray-700 text-sm my-8 tracking-widest">✦ ✦ ✦</div>
                )}
                {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                  <p
                    key={i}
                    className="font-serif text-gray-300 text-base leading-relaxed mb-5"
                    style={{ textIndent: i === 0 ? '0' : '1.5em' }}
                  >
                    {para.trim()}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600 italic text-sm">No content yet. Switch to Edit mode to get started.</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-950 flex flex-col"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return
        const diff = touchStartX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
        touchStartX.current = null
      }}
    >
      {/* Page content */}
      <div
        className="flex-1 max-w-2xl mx-auto w-full px-8 py-16 transition-opacity duration-200"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {renderContent()}
      </div>

      {/* Navigation bar */}
      <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 px-6 py-3 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={current === 0}
          className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        {/* Page indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">
            {current + 1} / {pages.length}
          </span>
          <div className="flex gap-1">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`rounded-full transition-colors ${
                  i === current
                    ? 'bg-brand-500 w-4 h-1.5'
                    : 'bg-gray-700 hover:bg-gray-500 w-1.5 h-1.5'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={next}
          disabled={current === pages.length - 1}
          className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
