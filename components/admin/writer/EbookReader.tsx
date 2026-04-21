'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { WriterBook, WriterBookSection } from '@/types/writer'

interface ReaderScene {
  id: string
  scene_number: number
  content: string | null
}

interface ReaderChapter {
  id: string
  chapter_number: number
  title: string
  scenes: ReaderScene[]
}

type Page =
  | { kind: 'title' }
  | { kind: 'front'; section: WriterBookSection; index: number }
  | { kind: 'chapter'; chapter: ReaderChapter; index: number }
  | { kind: 'back'; section: WriterBookSection; index: number }

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

const PAGE_BG = '#f8f5f0'
const TRANSITION_MS = 300

type TocEntry = { label: string; pageIndex: number }

export default function EbookReader({
  book,
  chapters,
  sections,
}: {
  book: WriterBook
  chapters: ReaderChapter[]
  sections: WriterBookSection[]
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
    ...frontMatter.map((s, i) => ({ kind: 'front' as const, section: s, index: i })),
    ...writtenChapters.map((ch, i) => ({ kind: 'chapter' as const, chapter: ch, index: i })),
    ...backMatter.map((s, i) => ({ kind: 'back' as const, section: s, index: i })),
  ]

  const toc: TocEntry[] = []
  pages.forEach((p, i) => {
    if (p.kind === 'chapter') {
      toc.push({ label: `Chapter ${p.chapter.chapter_number}: ${p.chapter.title}`, pageIndex: i })
    } else if (p.kind === 'front' || p.kind === 'back') {
      toc.push({ label: SECTION_LABELS[p.section.type] ?? p.section.type, pageIndex: i })
    }
  })

  const storageKey = `ebook-pos-${book.id}`

  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [uiVisible, setUiVisible] = useState(true)
  const [tocOpen, setTocOpen] = useState(false)

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Stable ref so touch handlers always call the current go()
  const navRef = useRef<{ next: () => void; prev: () => void }>({ next: () => {}, prev: () => {} })

  // Restore saved position once
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    if (!isNaN(saved) && saved > 0 && saved < pages.length) setCurrent(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem(storageKey, String(current))
  }, [current])

  function bumpUi() {
    setUiVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (!tocOpen) setUiVisible(false)
    }, 3500)
  }

  useEffect(() => {
    bumpUi()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [tocOpen])

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

  // Keep navRef in sync so touch handler always uses current version
  useEffect(() => { navRef.current = { next, prev } }, [next, prev])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tocOpen) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tocOpen])

  // Native non-passive touch listeners — required so preventDefault works
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
      bumpUi()
    }

    function onMove(e: TouchEvent) {
      if (startX === null || startY === null) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 3) {
        dragging = true
        e.preventDefault()
      } else if (Math.abs(dy) > Math.abs(dx) + 8) {
        startX = null
      }
    }

    function onEnd(e: TouchEvent) {
      if (startX === null) return
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 48) dx < 0 ? navRef.current.next() : navRef.current.prev()
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
  }, []) // only register once — navRef stays current

  const page = pages[current]
  const progress = pages.length > 1 ? current / (pages.length - 1) : 0

  function renderPage() {
    if (!page) return null

    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center text-center py-20 space-y-6 min-h-[70vh]">
          <h1
            className="font-serif text-gray-900 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3.2rem)' }}
          >
            {book.title}
          </h1>
          {book.subtitle && (
            <p
              className="font-serif italic text-gray-500 max-w-sm"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}
            >
              {book.subtitle}
            </p>
          )}
          <div className="flex flex-col items-center gap-1 mt-4">
            {(book.pen_name || book.author_name) && (
              <p className="text-gray-400 text-xs tracking-[0.2em] uppercase">
                {book.pen_name || book.author_name}
              </p>
            )}
            {book.publisher_name && (
              <p className="text-gray-400 text-[11px] tracking-wider">{book.publisher_name}</p>
            )}
          </div>
          {pages.length > 1 && (
            <p className="text-[11px] text-gray-300 mt-8">Swipe or press → to begin</p>
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
              className="font-serif text-gray-800 mb-10"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}
            >
              {SECTION_LABELS[section.type] ?? section.type}
            </h2>
          )}
          <div className={
            isEpigraph
              ? 'flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 italic text-gray-500 px-8'
              : isDedication
                ? 'flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 text-gray-600 px-8'
                : 'space-y-[1.1em]'
          }>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p
                key={i}
                className="font-serif text-gray-700"
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
            <p className="text-[11px] text-gray-400 uppercase tracking-[0.2em] mb-3">
              Chapter {chapter.chapter_number}
            </p>
            <h2
              className="font-serif text-gray-900 leading-snug"
              style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}
            >
              {chapter.title}
            </h2>
            <div className="mt-6 mx-auto w-8 h-px bg-gray-300" />
          </div>

          {scenes.map((scene, idx) => (
            <div key={scene.id}>
              {idx > 0 && (
                <div className="text-center text-gray-300 text-xs my-10 tracking-[0.4em]">
                  ✦ ✦ ✦
                </div>
              )}
              {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                <p
                  key={i}
                  className="font-serif text-gray-700"
                  style={{
                    fontSize: 'clamp(1rem, 2.2vw, 1.1rem)',
                    lineHeight: 1.9,
                    textIndent: (idx === 0 && i === 0) ? 0 : '1.6em',
                    marginBottom: '0.9em',
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
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: PAGE_BG }}>
        <p className="font-serif text-gray-400 italic">This book has no written content yet.</p>
        <Link href="/admin/writer" className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
          ← Back to library
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: PAGE_BG }}
      onMouseMove={bumpUi}
      onClick={bumpUi}
    >
      {/* Progress line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-30" style={{ background: '#e8e2d8' }}>
        <div
          className="h-full"
          style={{ width: `${progress * 100}%`, background: '#a09070', transition: 'width 0.4s ease' }}
        />
      </div>

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 h-14 transition-all duration-500"
        style={{
          background: `linear-gradient(to bottom, ${PAGE_BG}f0, ${PAGE_BG}00)`,
          paddingTop: 4,
          opacity: uiVisible ? 1 : 0,
          pointerEvents: uiVisible ? 'auto' : 'none',
          transform: uiVisible ? 'translateY(0)' : 'translateY(-4px)',
        }}
      >
        <Link
          href="/admin/writer"
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors py-2 pr-3"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Library
        </Link>

        <p className="font-serif text-xs text-gray-500 truncate mx-4 max-w-[180px] sm:max-w-xs text-center">
          {book.title}
        </p>

        <button
          onClick={() => setTocOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors py-2 pl-3"
          aria-label="Table of contents"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="16" y2="12"/>
            <line x1="3" y1="18" x2="12" y2="18"/>
          </svg>
          Contents
        </button>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex items-start justify-center">
        <div
          style={{
            width: '100%',
            maxWidth: 660,
            paddingInline: 'clamp(1.5rem, 6vw, 4.5rem)',
            paddingTop: 'clamp(4.5rem, 10vh, 6rem)',
            paddingBottom: 'clamp(5rem, 10vh, 7rem)',
            overflowY: 'auto',
            height: '100%',
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${slideDir === 'left' ? -60 : 60}px)`
              : 'translateX(0)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            willChange: 'transform, opacity',
          }}
        >
          {renderPage()}
        </div>
      </div>

      {/* Bottom nav */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-500"
        style={{
          opacity: uiVisible ? 1 : 0,
          pointerEvents: uiVisible ? 'auto' : 'none',
          transform: uiVisible ? 'translateY(0)' : 'translateY(6px)',
        }}
      >
        <div className="h-10" style={{ background: `linear-gradient(to top, ${PAGE_BG}, transparent)` }} />
        <div className="flex items-center justify-between px-5 pb-6 pt-1" style={{ background: PAGE_BG }}>
          <button
            onClick={prev}
            disabled={current === 0 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: '#d8d0c4', color: current === 0 ? '#ccc' : '#78716c' }}
          >
            ← Prev
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1 flex-wrap justify-center" style={{ maxWidth: 180 }}>
              {pages.length <= 18
                ? pages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      style={{
                        width: i === current ? 18 : 6,
                        height: 6,
                        borderRadius: 999,
                        background: i === current ? '#a09070' : '#d8d0c4',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                  ))
                : (
                  <div style={{ width: 120, height: 4, background: '#e8e2d8', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: '#a09070', borderRadius: 999, transition: 'width 0.3s ease' }} />
                  </div>
                )
              }
            </div>
            <span style={{ fontSize: 10, color: '#b8ad9e', fontVariantNumeric: 'tabular-nums' }}>
              {current + 1} / {pages.length}
            </span>
          </div>

          <button
            onClick={next}
            disabled={current === pages.length - 1 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: '#d8d0c4', color: current === pages.length - 1 ? '#ccc' : '#78716c' }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* TOC drawer */}
      <div
        className="absolute inset-y-0 right-0 z-40 flex flex-col"
        style={{
          width: 'min(320px, 88vw)',
          background: '#faf7f3',
          borderLeft: '1px solid #e8e2d8',
          boxShadow: tocOpen ? '-8px 0 32px rgba(0,0,0,0.08)' : 'none',
          transform: tocOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e8e2d8' }}>
          <span className="font-serif text-sm text-gray-700">Contents</span>
          <button
            onClick={() => setTocOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <button
            onClick={() => { go(0); setTocOpen(false) }}
            className="w-full text-left px-5 py-2.5 transition-colors hover:bg-stone-100"
          >
            <span className="font-serif text-gray-700 text-sm leading-snug block" style={{ fontWeight: current === 0 ? 600 : 400 }}>
              {book.title}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Title page</span>
          </button>
          {toc.map((entry) => (
            <button
              key={entry.pageIndex}
              onClick={() => { go(entry.pageIndex); setTocOpen(false) }}
              className="w-full text-left px-5 py-2.5 transition-colors hover:bg-stone-100"
            >
              <span
                className="font-serif text-gray-700 text-sm leading-snug"
                style={{ fontWeight: current === entry.pageIndex ? 600 : 400 }}
              >
                {entry.label}
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t" style={{ borderColor: '#e8e2d8' }}>
          <Link href={`/admin/writer/${book.id}`} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
            ✎ Edit this book
          </Link>
        </div>
      </div>

      {/* TOC backdrop */}
      {tocOpen && (
        <div
          className="absolute inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.15)' }}
          onClick={() => setTocOpen(false)}
        />
      )}
    </div>
  )
}
