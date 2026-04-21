'use client'

import { useState, useEffect, useRef } from 'react'
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
  | { kind: 'scene'; chapter: ReaderChapter; scene: ReaderScene; firstInChapter: boolean }
  | { kind: 'back'; section: WriterBookSection }

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

const TRANSITION_MS = 260

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

  // Build pages — each scene is its own page
  const pages: Page[] = [
    { kind: 'title' },
    ...frontMatter.map(s => ({ kind: 'front' as const, section: s })),
    ...chapters.flatMap(ch => {
      const scenes = ch.scenes
        .filter(s => s.content)
        .sort((a, b) => a.scene_number - b.scene_number)
      return scenes.map((scene, i) => ({
        kind: 'scene' as const,
        chapter: ch,
        scene,
        firstInChapter: i === 0,
      }))
    }),
    ...backMatter.map(s => ({ kind: 'back' as const, section: s })),
  ]

  const storageKey = `reader-pos-${book.id}`

  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [uiVisible, setUiVisible] = useState(true)
  const [editChipVisible, setEditChipVisible] = useState(false)

  const navRef = useRef({ next: () => {}, prev: () => {} })
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // Restore saved position
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    if (!isNaN(saved) && saved > 0 && saved < pages.length) setCurrent(saved)
  }, [])

  useEffect(() => {
    if (initialized.current) localStorage.setItem(storageKey, String(current))
  }, [current])

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

  // Lock body scroll while reader is mounted
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
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

  // Keep navRef current so window listeners always call fresh go()
  useEffect(() => {
    navRef.current = {
      next: () => go(current + 1),
      prev: () => go(current - 1),
    }
  })

  // Window-level swipe — fires regardless of DOM structure
  useEffect(() => {
    let startX = 0
    let startY = 0

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      bumpUi()
    }
    function onEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        dx < 0 ? navRef.current.next() : navRef.current.prev()
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = pages[current]
  const progress = pages.length > 1 ? current / (pages.length - 1) : 0

  function handleEditCurrent() {
    if (!page) return
    if (page.kind === 'scene') onEditChapter(page.chapter.id)
    else if (page.kind === 'front') onEditSection('front')
    else if (page.kind === 'back') onEditSection('back')
  }

  const pageIsEditable = page && page.kind !== 'title'

  function renderContent() {
    if (!page) return null

    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-5">
          <h1 className="font-serif text-white leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="font-serif italic text-gray-400 max-w-sm" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}>
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
            <h2 className="font-serif text-white mb-10" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
              {SECTION_LABELS[section.type] ?? section.type}
            </h2>
          )}
          <div className={isEpigraph || isDedication ? 'flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 italic text-gray-400 px-4' : 'space-y-[1em]'}>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i} className="font-serif text-gray-300"
                style={{ fontSize: 'clamp(1rem, 2.2vw, 1.1rem)', lineHeight: 1.9, margin: 0 }}>
                {para.trim()}
              </p>
            ))}
          </div>
        </div>
      )
    }

    if (page.kind === 'scene') {
      const { chapter, scene, firstInChapter } = page
      const paragraphs = (scene.content ?? '').split(/\n\n+/).filter(p => p.trim())
      return (
        <div>
          {firstInChapter && (
            <div className="mb-10 text-center">
              <p className="text-[11px] text-gray-600 uppercase tracking-[0.2em] mb-3">
                Chapter {chapter.chapter_number}
              </p>
              <h2 className="font-serif text-white leading-snug" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
                {chapter.title}
              </h2>
              <div className="mt-6 mx-auto w-8 h-px bg-gray-800" />
            </div>
          )}
          {!firstInChapter && (
            <div className="text-center text-gray-700 text-xs mb-10 tracking-[0.4em]">✦ ✦ ✦</div>
          )}
          <div>
            {paragraphs.map((para, i) => (
              <p key={i} className="font-serif text-gray-300"
                style={{
                  fontSize: 'clamp(1rem, 2.2vw, 1.1rem)',
                  lineHeight: 1.9,
                  textIndent: i === 0 ? 0 : '1.6em',
                  marginBottom: '0.85em',
                }}>
                {para.trim()}
              </p>
            ))}
          </div>
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
      className="fixed left-0 right-0 bottom-0 flex flex-col overflow-hidden"
      style={{ background: '#0d1117', top: 52 }}
      onClick={bumpUi}
    >
      {/* Progress line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10 bg-gray-900">
        <div className="h-full bg-brand-600 transition-all duration-300"
          style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex justify-center">
        <div
          style={{
            width: '100%',
            maxWidth: 660,
            paddingInline: 'clamp(1.5rem, 6vw, 4.5rem)',
            paddingTop: 'clamp(3rem, 8vh, 5rem)',
            paddingBottom: '6rem',
            overflowY: 'auto',
            height: '100%',
            opacity: animating ? 0 : 1,
            transform: animating ? `translateX(${slideDir === 'left' ? -40 : 40}px)` : 'translateX(0)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
          }}
        >
          {renderContent()}
        </div>
      </div>

      {/* Edit chip */}
      {pageIsEditable && (
        <div
          className="absolute z-20 transition-all duration-200"
          style={{
            top: 14, right: 12,
            opacity: editChipVisible ? 1 : 0,
            transform: editChipVisible ? 'scale(1)' : 'scale(0.9)',
            pointerEvents: editChipVisible ? 'auto' : 'none',
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); handleEditCurrent() }}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white bg-gray-900 transition-colors"
          >
            ✎ Edit
          </button>
        </div>
      )}

      {/* Nav bar */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-all duration-400"
        style={{
          opacity: uiVisible ? 1 : 0,
          transform: uiVisible ? 'translateY(0)' : 'translateY(10px)',
          pointerEvents: uiVisible ? 'auto' : 'none',
        }}
      >
        <div className="h-8" style={{ background: 'linear-gradient(to bottom, transparent, #0d1117)' }} />
        <div className="flex items-center justify-between px-5 pb-6 pt-1 gap-3" style={{ background: '#0d1117' }}>
          <button onClick={() => go(current - 1)} disabled={current === 0 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-20 transition-all">
            ← Prev
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1 flex-wrap justify-center" style={{ maxWidth: 200 }}>
              {pages.length <= 20
                ? pages.map((_, i) => (
                    <button key={i} onClick={() => go(i)}
                      style={{
                        width: i === current ? 18 : 6, height: 6,
                        borderRadius: 999, border: 'none', padding: 0,
                        background: i === current ? '#4f6ef7' : '#2d3748',
                        transition: 'all 0.2s', cursor: 'pointer', flexShrink: 0,
                      }} />
                  ))
                : (
                  <div style={{ width: 120, height: 4, background: '#1f2937', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: '#4f6ef7', borderRadius: 999, transition: 'width 0.3s' }} />
                  </div>
                )
              }
            </div>
            <span style={{ fontSize: 10, color: '#4b5563' }}>{current + 1} / {pages.length}</span>
          </div>

          <div className="flex gap-2 items-center">
            {pageIsEditable && (
              <button
                onClick={e => { e.stopPropagation(); setEditChipVisible(v => !v); bumpUi() }}
                className="text-[11px] px-2.5 py-2 rounded-lg border border-gray-800 text-gray-600 hover:text-gray-300 hover:border-gray-600 transition-all"
              >✎</button>
            )}
            <button onClick={() => go(current + 1)} disabled={current === pages.length - 1 || animating}
              className="text-[11px] font-medium px-4 py-2 rounded-lg border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600 disabled:opacity-20 transition-all">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
