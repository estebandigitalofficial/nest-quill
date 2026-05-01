'use client'

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

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
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

  const writtenChapters = chapters.filter(ch => ch.scenes.some(s => s.content))

  if (writtenChapters.length === 0 && frontMatter.length === 0 && backMatter.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-adm-subtle italic text-sm font-serif">No content yet. Switch to Edit to get started.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-16">
      {/* Title */}
      <div className="text-center space-y-3 pb-8 border-b border-adm-border">
        <h1 className="font-serif text-white text-3xl">{book.title}</h1>
        {book.subtitle && <p className="font-serif italic text-adm-muted">{book.subtitle}</p>}
        {(book.pen_name || book.author_name) && (
          <p className="text-adm-subtle text-xs tracking-widest uppercase mt-1">
            {book.pen_name || book.author_name}
          </p>
        )}
      </div>

      {/* Front matter */}
      {frontMatter.map(s => (
        <div key={s.type} className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-white text-xl">{SECTION_LABELS[s.type] ?? s.type}</h2>
            <button
              onClick={() => onEditSection('front')}
              className="text-xs text-adm-subtle hover:text-adm-muted shrink-0 transition-colors"
            >Edit</button>
          </div>
          <div className="space-y-4 font-serif text-adm-muted text-base leading-relaxed">
            {(s.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </div>
        </div>
      ))}

      {/* Chapters */}
      {writtenChapters.map(ch => {
        const scenes = ch.scenes
          .filter(s => s.content)
          .sort((a, b) => a.scene_number - b.scene_number)
        return (
          <div key={ch.id} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-adm-subtle uppercase tracking-widest mb-1">Chapter {ch.chapter_number}</p>
                <h2 className="font-serif text-white text-xl">{ch.title}</h2>
              </div>
              <button
                onClick={() => onEditChapter(ch.id)}
                className="text-xs text-adm-subtle hover:text-adm-muted shrink-0 mt-1 transition-colors"
              >Edit</button>
            </div>
            {scenes.map((scene, si) => (
              <div key={scene.id}>
                {si > 0 && <div className="my-6 border-t border-adm-border" />}
                <div className="font-serif text-adm-muted text-base leading-relaxed space-y-4">
                  {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, pi) => (
                    <p key={pi} style={{ textIndent: pi === 0 ? 0 : '1.5em' }}>{para.trim()}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* Back matter */}
      {backMatter.map(s => (
        <div key={s.type} className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-serif text-white text-xl">{SECTION_LABELS[s.type] ?? s.type}</h2>
            <button
              onClick={() => onEditSection('back')}
              className="text-xs text-adm-subtle hover:text-adm-muted shrink-0 transition-colors"
            >Edit</button>
          </div>
          <div className="space-y-4 font-serif text-adm-muted text-base leading-relaxed">
            {(s.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
