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
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

const TRANSITION_MS = 280

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

  const writtenChapters = chapters.filter(ch => ch.scenes.some(s => s.content))

  const pages: Page[] = [
    { kind: 'title' },
    ...frontMatter.map(s => ({ kind: 'front' as const, section: s })),
    ...writtenChapters.map(ch => ({ kind: 'chapter' as const, chapter: ch })),
    ...backMatter.map(s => ({ kind: 'back' as const, section: s })),
  ]

  const storageKey = `reader-pos-${book.id}`

  const [current, setCurrent] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    return isNaN(saved) || saved >= pages.length ? 0 : saved
  })

  // slide: null = idle, 'left' = going next, 'right' = going prev
  const [slide, setSlide] = useState<'left' | 'right' | null>(null)
  const [animating, setAnimating] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live swipe tracking
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const isDragging = useRef(false)

  // Save position
  useEffect(() => {
    localStorage.setItem(storageKey, String(current))
  }, [current, storageKey])

  // Idle controls
  function bumpControls() {
    setControlsVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setControlsVisible(false), 3000)
  }

  useEffect(() => {
    bumpControls()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [])

  function go(to: number) {
    if (to < 0 || to >= pages.length || animating) return
    const direction = to > current ? 'left' : 'right'
    setSlide(direction)
    setAnimating(true)
    setTimeout(() => {
      setCurrent(to)
      setSlide(null)
      setAnimating(false)
      window.scrollTo(0, 0)
    }, TRANSITION_MS)
    bumpControls()
  }

  const next = useCallback(() => go(current + 1), [current, animating])
  const prev = useCallback(() => go(current - 1), [current, animating])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { next(); bumpControls() }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { prev(); bumpControls() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isDragging.current = false
    bumpControls()
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    // Only track horizontal drags
    if (!isDragging.current && Math.abs(dy) > Math.abs(dx)) {
      touchStartX.current = null
      return
    }
    isDragging.current = true
    setDragOffset(dx)
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    setDragOffset(0)
    if (Math.abs(dx) > 50) {
      dx < 0 ? next() : prev()
    }
    touchStartX.current = null
    touchStartY.current = null
    isDragging.current = false
  }

  const page = pages[current]
  const progress = pages.length > 1 ? current / (pages.length - 1) : 0

  // Slide transform
  let translateX = dragOffset
  if (animating && slide === 'left') translateX = -60
  if (animating && slide === 'right') translateX = 60

  function renderContent() {
    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-5 py-16">
          <h1
            className="font-serif leading-tight text-gray-900 dark:text-gray-100"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="font-serif text-lg text-gray-500 dark:text-gray-400 italic max-w-sm">
              {book.subtitle}
            </p>
          )}
          {(book.author_name || book.pen_name) && (
            <p className="text-gray-400 dark:text-gray-500 text-xs tracking-[0.2em] uppercase mt-6">
              {book.pen_name || book.author_name}
            </p>
          )}
          {pages.length > 1 && (
            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-10">
              Press → or swipe to begin reading
            </p>
          )}
        </div>
      )
    }

    if (page.kind === 'front' || page.kind === 'back') {
      const { section } = page
      const isEpigraph = section.type === 'epigraph'
      return (
        <article className="prose-reader">
          {!isEpigraph && (
            <header className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-800 flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-2xl text-gray-800 dark:text-gray-100 m-0">
                {SECTION_LABELS[section.type] ?? section.type}
              </h2>
              <button
                onClick={() => page.kind === 'front' ? onEditSection('front') : onEditSection('back')}
                className="shrink-0 text-[11px] text-gray-300 dark:text-gray-700 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                Edit ✎
              </button>
            </header>
          )}
          <div className={isEpigraph ? 'text-center italic text-gray-500 dark:text-gray-400 py-16 space-y-4' : 'space-y-5'}>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i} className="font-serif text-gray-700 dark:text-gray-300 text-[1.05rem] leading-[1.85] m-0">
                {para.trim()}
              </p>
            ))}
          </div>
        </article>
      )
    }

    if (page.kind === 'chapter') {
      const { chapter } = page
      const scenes = chapter.scenes
        .filter(s => s.content)
        .sort((a, b) => a.scene_number - b.scene_number)

      return (
        <article className="prose-reader">
          <header className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 uppercase tracking-[0.15em] mb-2 font-sans">
                Chapter {chapter.chapter_number}
              </p>
              <h2 className="font-serif text-2xl text-gray-800 dark:text-gray-100 m-0 leading-snug">
                {chapter.title}
              </h2>
            </div>
            <button
              onClick={() => onEditChapter(chapter.id)}
              className="shrink-0 text-[11px] text-gray-300 dark:text-gray-700 hover:text-gray-600 dark:hover:text-gray-400 transition-colors mt-1"
            >
              Edit ✎
            </button>
          </header>
          <div className="space-y-0">
            {scenes.map((scene, idx) => (
              <div key={scene.id}>
                {idx > 0 && (
                  <div className="text-center text-gray-300 dark:text-gray-700 text-xs my-10 tracking-[0.4em]">
                    ✦ ✦ ✦
                  </div>
                )}
                {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                  <p
                    key={i}
                    className="font-serif text-gray-700 dark:text-gray-300 text-[1.05rem] leading-[1.85] mb-5 m-0 mb-[1.1em]"
                    style={{ textIndent: (idx === 0 && i === 0) ? '0' : '1.6em' }}
                  >
                    {para.trim()}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </article>
      )
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 italic text-sm font-serif">
          No content yet. Switch to Edit mode to get started.
        </p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: '#f7f4ef' }}
      onMouseMove={bumpControls}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={bumpControls}
    >
      {/* Page area */}
      <div className="flex-1 flex items-start justify-center overflow-hidden">
        <div
          className="w-full"
          style={{
            maxWidth: 680,
            paddingInline: 'clamp(1.5rem, 6vw, 4rem)',
            paddingTop: 'clamp(3rem, 8vh, 5rem)',
            paddingBottom: '6rem',
            transform: `translateX(${translateX}px)`,
            opacity: animating && dragOffset === 0 ? 0 : 1,
            transition: isDragging.current
              ? 'none'
              : `transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${TRANSITION_MS}ms ease`,
            willChange: 'transform, opacity',
          }}
        >
          {renderContent()}
        </div>
      </div>

      {/* Progress bar — always visible, very subtle */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-30 bg-stone-200">
        <div
          className="h-full bg-stone-400 transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Navigation bar — fades in/out on idle */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 transition-opacity duration-500"
        style={{ opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
      >
        {/* Gradient fade */}
        <div className="h-8" style={{ background: 'linear-gradient(to bottom, transparent, #f7f4ef)' }} />
        <div
          className="px-6 py-4 flex items-center justify-between gap-4"
          style={{ background: '#f7f4ef' }}
        >
          <button
            onClick={prev}
            disabled={current === 0 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all
              border-stone-300 text-stone-500 hover:text-stone-800 hover:border-stone-400
              disabled:opacity-20 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          {/* Dot + counter */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-stone-400 tabular-nums">
              {current + 1} of {pages.length}
            </span>
            <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
              {pages.length <= 20
                ? pages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      className="rounded-full transition-all duration-200"
                      style={{
                        width: i === current ? 16 : 6,
                        height: 6,
                        background: i === current ? '#78716c' : '#d6d3d1',
                      }}
                    />
                  ))
                : (
                  <div className="w-32 h-1 rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-500 transition-all duration-300"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )
              }
            </div>
          </div>

          <button
            onClick={next}
            disabled={current === pages.length - 1 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all
              border-stone-300 text-stone-500 hover:text-stone-800 hover:border-stone-400
              disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
