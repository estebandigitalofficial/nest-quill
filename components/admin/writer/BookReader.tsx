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
const PAGE_BG = '#0d1117'   // slightly lighter than gray-950 for depth

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

  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [uiVisible, setUiVisible] = useState(true)
  // Whether the edit chip is showing for the current page
  const [editChipVisible, setEditChipVisible] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<{ next: () => void; prev: () => void }>({ next: () => {}, prev: () => {} })
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // Restore saved position once on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    if (!isNaN(saved) && saved > 0 && saved < pages.length) setCurrent(saved)
  }, [])

  useEffect(() => {
    if (initialized.current) localStorage.setItem(storageKey, String(current))
  }, [current])

  // Hide edit chip on page change
  useEffect(() => { setEditChipVisible(false) }, [current])

  function bumpUi() {
    setUiVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setUiVisible(false), 3500)
  }

  useEffect(() => {
    bumpUi()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [])

  function go(to: number) {
    if (to < 0 || to >= pages.length || animating) return
    setSlideDir(to > current ? 'left' : 'right')
    setAnimating(true)
    setTimeout(() => {
      setCurrent(to)
      setSlideDir(null)
      setAnimating(false)
    }, TRANSITION_MS)
    bumpUi()
  }

  const next = useCallback(() => go(current + 1), [current, animating])
  const prev = useCallback(() => go(current - 1), [current, animating])
  useEffect(() => { navRef.current = { next, prev } }, [next, prev])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Native non-passive touch — required so horizontal swipe can preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startX: number | null = null
    let startY: number | null = null
    let dragging = false

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      dragging = false
    }
    function onMove(e: TouchEvent) {
      if (startX === null || startY === null) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      // Claim horizontal gesture immediately — before browser commits to scroll
      if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 3) {
        dragging = true
        e.preventDefault()
      } else if (Math.abs(dy) > Math.abs(dx) + 8) {
        // Clearly vertical — abandon
        startX = null
      }
    }
    function onEnd(e: TouchEvent) {
      if (startX === null) return
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 48) {
        dx < 0 ? navRef.current.next() : navRef.current.prev()
      } else if (Math.abs(dx) < 8) {
        // Treat as tap — bump UI visibility
        bumpUi()
      }
      startX = null; startY = null; dragging = false
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  const page = pages[current]
  const progress = pages.length > 1 ? current / (pages.length - 1) : 0

  // Edit action for current page
  function handleEditCurrent() {
    if (!page) return
    if (page.kind === 'chapter') onEditChapter(page.chapter.id)
    else if (page.kind === 'front') onEditSection('front')
    else if (page.kind === 'back') onEditSection('back')
  }

  const pageIsEditable = page && page.kind !== 'title'

  function renderContent() {
    if (!page) return null

    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-5">
          <h1
            className="font-serif text-white leading-tight"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="font-serif italic text-gray-400 max-w-sm"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}
            >
              {book.subtitle}
            </p>
          )}
          {(book.pen_name || book.author_name) && (
            <p className="text-gray-500 text-xs tracking-[0.2em] uppercase mt-4">
              {book.pen_name || book.author_name}
            </p>
          )}
          {pages.length > 1 && (
            <p className="text-[11px] text-gray-700 mt-10">Swipe or press → to begin</p>
          )}
        </div>
      )
    }

    if (page.kind === 'front' || page.kind === 'back') {
      const { section } = page
      const isEpigraph = section.type === 'epigraph'
      const isDedication = section.type === 'dedication'
      return (
        <div>
          {!isEpigraph && !isDedication && (
            <h2
              className="font-serif text-white mb-10"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}
            >
              {SECTION_LABELS[section.type] ?? section.type}
            </h2>
          )}
          <div className={
            isEpigraph || isDedication
              ? 'flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 italic text-gray-400 px-4'
              : 'space-y-[1em]'
          }>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p
                key={i}
                className="font-serif text-gray-300"
                style={{ fontSize: 'clamp(1rem, 2.2vw, 1.1rem)', lineHeight: 1.9, margin: 0 }}
              >
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
        <div>
          <div className="mb-10 text-center">
            <p className="text-[11px] text-gray-600 uppercase tracking-[0.2em] mb-3">
              Chapter {chapter.chapter_number}
            </p>
            <h2
              className="font-serif text-white leading-snug"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}
            >
              {chapter.title}
            </h2>
            <div className="mt-6 mx-auto w-8 h-px bg-gray-800" />
          </div>

          {scenes.map((scene, idx) => (
            <div key={scene.id}>
              {idx > 0 && (
                <div className="text-center text-gray-700 text-xs my-10 tracking-[0.4em]">
                  ✦ ✦ ✦
                </div>
              )}
              {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                <p
                  key={i}
                  className="font-serif text-gray-300"
                  style={{
                    fontSize: 'clamp(1rem, 2.2vw, 1.1rem)',
                    lineHeight: 1.9,
                    textIndent: (idx === 0 && i === 0) ? 0 : '1.6em',
                    marginBottom: '0.85em',
                  }}
                >
                  {para.trim()}
                </p>
              ))}
            </div>
          ))}
        </div>
      )
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600 italic text-sm font-serif">No content yet. Switch to Edit mode to get started.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed left-0 right-0 bottom-0 flex flex-col overflow-hidden"
      style={{ background: PAGE_BG, top: 52 }}
      onClick={bumpUi}
    >
      {/* Progress line */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-30 bg-gray-900">
        <div
          className="h-full bg-brand-600 transition-all duration-400"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Page content */}
      <div className="flex-1 flex items-start justify-center overflow-hidden">
        <div
          style={{
            width: '100%',
            maxWidth: 660,
            paddingInline: 'clamp(1.5rem, 6vw, 4.5rem)',
            paddingTop: 'clamp(4rem, 10vh, 6rem)',
            paddingBottom: 'clamp(6rem, 12vh, 8rem)',
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${slideDir === 'left' ? -50 : 50}px)`
              : 'translateX(0)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
          }}
        >
          {renderContent()}
        </div>
      </div>

      {/* Edit chip — appears when tapping content on an editable page */}
      {pageIsEditable && (
        <div
          className="fixed z-40 transition-all duration-300"
          style={{
            top: 60,
            right: 16,
            opacity: editChipVisible ? 1 : 0,
            transform: editChipVisible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.95)',
            pointerEvents: editChipVisible ? 'auto' : 'none',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleEditCurrent() }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg shadow-lg transition-colors"
            style={{ background: '#1e2530', border: '1px solid #2d3748', color: '#a0aec0' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a0aec0')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        </div>
      )}

      {/* Bottom nav — auto-hides */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 transition-all duration-500"
        style={{
          opacity: uiVisible ? 1 : 0,
          pointerEvents: uiVisible ? 'auto' : 'none',
          transform: uiVisible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        <div
          className="h-8"
          style={{ background: `linear-gradient(to bottom, transparent, ${PAGE_BG})` }}
        />
        <div
          className="flex items-center justify-between px-5 pb-6 pt-1 gap-4"
          style={{ background: PAGE_BG }}
        >
          <button
            onClick={prev}
            disabled={current === 0 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1 flex-wrap justify-center" style={{ maxWidth: 200 }}>
              {pages.length <= 20
                ? pages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      className="rounded-full transition-all duration-200"
                      style={{
                        width: i === current ? 18 : 6,
                        height: 6,
                        background: i === current ? '#4f6ef7' : '#2d3748',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                  ))
                : (
                  <div className="w-28 h-1 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress * 100}%`, background: '#4f6ef7' }}
                    />
                  </div>
                )
              }
            </div>
            <span className="text-[10px] text-gray-600 tabular-nums">
              {current + 1} / {pages.length}
            </span>
          </div>

          {/* Edit shortcut — right side of nav */}
          <div className="flex items-center gap-2">
            {pageIsEditable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditChipVisible(v => !v)
                  bumpUi()
                }}
                className="text-[11px] font-medium px-3 py-2 rounded-lg border transition-all border-gray-800 text-gray-600 hover:text-gray-300 hover:border-gray-600"
                title="Edit this section"
              >
                ✎
              </button>
            )}
            <button
              onClick={next}
              disabled={current === pages.length - 1 || animating}
              className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
