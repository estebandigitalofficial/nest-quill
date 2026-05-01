'use client'

import { useState, useEffect, useRef } from 'react'
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
  | { kind: 'front'; section: WriterBookSection }
  | { kind: 'scene'; chapter: ReaderChapter; scene: ReaderScene; firstInChapter: boolean }
  | { kind: 'back'; section: WriterBookSection }

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

const PAGE_BG = '#f8f5f0'
const TRANSITION_MS = 280

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

  // Each scene is its own page
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

  // TOC entries — one per chapter (link to first scene of chapter)
  const toc: TocEntry[] = []
  pages.forEach((p, i) => {
    if (p.kind === 'scene' && p.firstInChapter) {
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

  const navRef = useRef({ next: () => {}, prev: () => {} })
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // Restore position
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

  // Lock body scroll
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

  // Keep navRef current every render
  useEffect(() => {
    navRef.current = {
      next: () => go(current + 1),
      prev: () => go(current - 1),
    }
  })

  // Window-level swipe — always fires
  useEffect(() => {
    let startX = 0
    let startY = 0

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      bumpUi()
    }
    function onEnd(e: TouchEvent) {
      if (tocOpen) return
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
  }, [tocOpen])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tocOpen) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tocOpen])

  const page = pages[current]
  const progress = pages.length > 1 ? current / (pages.length - 1) : 0

  function renderPage() {
    if (!page) return null

    if (page.kind === 'title') {
      return (
        <div className="flex flex-col items-center justify-center text-center py-20 space-y-6 min-h-[70vh]">
          <h1 className="font-serif text-gray-900 leading-tight" style={{ fontSize: 'clamp(1.8rem, 5vw, 3.2rem)' }}>
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="font-serif italic text-adm-muted max-w-sm" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>
              {book.subtitle}
            </p>
          )}
          <div className="flex flex-col items-center gap-1 mt-4">
            {(book.pen_name || book.author_name) && (
              <p className="text-adm-muted text-xs tracking-[0.2em] uppercase">{book.pen_name || book.author_name}</p>
            )}
            {book.publisher_name && (
              <p className="text-adm-muted text-[11px] tracking-wider">{book.publisher_name}</p>
            )}
          </div>
          {pages.length > 1 && (
            <p className="text-[11px] text-adm-muted mt-8">Swipe or press → to begin</p>
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
            <h2 className="font-serif text-gray-800 mb-10" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)' }}>
              {SECTION_LABELS[section.type] ?? section.type}
            </h2>
          )}
          <div className={isEpigraph || isDedication
            ? 'flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 italic text-adm-muted px-8'
            : 'space-y-[1.1em]'
          }>
            {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i} className="font-serif text-gray-700"
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
              <p className="text-[11px] text-adm-muted uppercase tracking-[0.2em] mb-3">
                Chapter {chapter.chapter_number}
              </p>
              <h2 className="font-serif text-gray-900 leading-snug" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
                {chapter.title}
              </h2>
              <div className="mt-6 mx-auto w-8 h-px bg-gray-300" />
            </div>
          )}
          {!firstInChapter && (
            <div className="text-center text-adm-muted text-xs mb-10 tracking-[0.4em]">✦ ✦ ✦</div>
          )}
          <div>
            {paragraphs.map((para, i) => (
              <p key={i} className="font-serif text-gray-700"
                style={{
                  fontSize: 'clamp(1rem, 2.2vw, 1.1rem)',
                  lineHeight: 1.9,
                  textIndent: i === 0 ? 0 : '1.6em',
                  marginBottom: '0.9em',
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
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: PAGE_BG }}>
        <p className="font-serif text-adm-muted italic">This book has no written content yet.</p>
        <Link href="/admin/writer" className="mt-4 text-xs text-adm-muted hover:text-adm-subtle underline underline-offset-2">
          ← Back to library
        </Link>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: PAGE_BG }}
      onClick={bumpUi}
    >
      {/* Progress line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-30" style={{ background: '#e8e2d8' }}>
        <div className="h-full transition-all duration-400"
          style={{ width: `${progress * 100}%`, background: '#a09070' }} />
      </div>

      {/* Invisible tap zones — left = prev, right = next */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={e => { e.stopPropagation(); go(current - 1) }}
        disabled={current === 0 || animating}
        className="absolute top-0 bottom-0 left-0 z-10 disabled:pointer-events-none"
        style={{ width: '38%', cursor: current === 0 ? 'default' : 'w-resize', background: 'transparent' }}
      />
      <button
        aria-hidden
        tabIndex={-1}
        onClick={e => { e.stopPropagation(); go(current + 1) }}
        disabled={current === pages.length - 1 || animating}
        className="absolute top-0 bottom-0 right-0 z-10 disabled:pointer-events-none"
        style={{ width: '38%', cursor: current === pages.length - 1 ? 'default' : 'e-resize', background: 'transparent' }}
      />

      {/* Subtle side arrows */}
      <div
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-300"
        style={{ opacity: uiVisible && current > 0 ? 0.3 : 0 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-300"
        style={{ opacity: uiVisible && current < pages.length - 1 ? 0.3 : 0 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
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
        <Link href="/admin/writer"
          className="flex items-center gap-1.5 text-[11px] text-adm-muted hover:text-gray-700 transition-colors py-2 pr-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Library
        </Link>

        <p className="font-serif text-xs text-adm-muted truncate mx-4 max-w-[180px] sm:max-w-xs text-center">
          {book.title}
        </p>

        <button onClick={() => setTocOpen(o => !o)}
          className="flex items-center gap-1.5 text-[11px] text-adm-muted hover:text-gray-700 transition-colors py-2 pl-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="18" x2="12" y2="18"/>
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
            transform: animating ? `translateX(${slideDir === 'left' ? -50 : 50}px)` : 'translateX(0)',
            transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
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
          <button onClick={() => go(current - 1)} disabled={current === 0 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: '#d8d0c4', color: current === 0 ? '#ccc' : '#78716c' }}>
            ← Prev
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1 flex-wrap justify-center" style={{ maxWidth: 180 }}>
              {pages.length <= 18
                ? pages.map((_, i) => (
                    <button key={i} onClick={() => go(i)}
                      style={{
                        width: i === current ? 18 : 6, height: 6,
                        borderRadius: 999, background: i === current ? '#a09070' : '#d8d0c4',
                        transition: 'all 0.2s', border: 'none', padding: 0,
                        cursor: 'pointer', flexShrink: 0,
                      }} />
                  ))
                : (
                  <div style={{ width: 120, height: 4, background: '#e8e2d8', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: '#a09070', borderRadius: 999, transition: 'width 0.3s' }} />
                  </div>
                )
              }
            </div>
            <span style={{ fontSize: 10, color: '#b8ad9e' }}>{current + 1} / {pages.length}</span>
          </div>

          <button onClick={() => go(current + 1)} disabled={current === pages.length - 1 || animating}
            className="text-[11px] font-medium px-4 py-2 rounded-lg border transition-all"
            style={{ borderColor: '#d8d0c4', color: current === pages.length - 1 ? '#ccc' : '#78716c' }}>
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
          <button onClick={() => setTocOpen(false)} className="text-adm-muted hover:text-adm-subtle transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <button onClick={() => { go(0); setTocOpen(false) }}
            className="w-full text-left px-5 py-2.5 hover:bg-stone-100 transition-colors">
            <span className="font-serif text-gray-700 text-sm block" style={{ fontWeight: current === 0 ? 600 : 400 }}>
              {book.title}
            </span>
            <span className="text-[10px] text-adm-muted uppercase tracking-wider">Title page</span>
          </button>
          {toc.map(entry => (
            <button key={entry.pageIndex} onClick={() => { go(entry.pageIndex); setTocOpen(false) }}
              className="w-full text-left px-5 py-2.5 hover:bg-stone-100 transition-colors">
              <span className="font-serif text-gray-700 text-sm leading-snug"
                style={{ fontWeight: current === entry.pageIndex ? 600 : 400 }}>
                {entry.label}
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t" style={{ borderColor: '#e8e2d8' }}>
          <Link href={`/admin/writer/${book.id}`} className="text-[11px] text-adm-muted hover:text-adm-subtle transition-colors">
            ✎ Edit this book
          </Link>
        </div>
      </div>

      {tocOpen && (
        <div className="absolute inset-0 z-30" style={{ background: 'rgba(0,0,0,0.15)' }}
          onClick={() => setTocOpen(false)} />
      )}
    </div>
  )
}
