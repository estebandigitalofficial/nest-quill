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

  const SECTION_LABELS: Record<string, string> = {
    dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
    preface: 'Preface', acknowledgments: 'Acknowledgments', conclusion: 'Conclusion',
    notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
  }

  function EditHint({ onClick }: { onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 text-xs text-gray-500 hover:text-brand-400 px-2 py-1 rounded"
      >
        Edit ✎
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-8 py-16">

        {/* Title page */}
        <div className="text-center mb-24">
          <h1 className="font-serif text-4xl text-white mb-3">{book.title}</h1>
          {book.subtitle && <p className="font-serif text-xl text-gray-400 italic mb-6">{book.subtitle}</p>}
          {(book.author_name || book.pen_name) && (
            <p className="text-gray-500 text-sm tracking-widest uppercase">{book.pen_name || book.author_name}</p>
          )}
        </div>

        {/* Front matter */}
        {frontMatter.length > 0 && (
          <div className="mb-16">
            {frontMatter.map(section => (
              <div key={section.id} className="relative group mb-16">
                <EditHint onClick={() => onEditSection('front')} />
                {section.type !== 'epigraph' && (
                  <h2 className="font-serif text-xl text-gray-300 mb-6 pb-3 border-b border-gray-800">
                    {SECTION_LABELS[section.type] ?? section.type}
                  </h2>
                )}
                <div className={`prose-reader ${section.type === 'epigraph' ? 'italic text-center text-gray-400' : ''}`}>
                  {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                    <p key={i} className="text-gray-300 leading-relaxed mb-4 font-serif text-base">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            <hr className="border-gray-800 mb-16" />
          </div>
        )}

        {/* Chapters */}
        {chapters.map(chapter => {
          const scenes = chapter.scenes
            .filter(s => s.content)
            .sort((a, b) => a.scene_number - b.scene_number)

          if (scenes.length === 0) return null

          return (
            <div key={chapter.id} className="relative group mb-20">
              <EditHint onClick={() => onEditChapter(chapter.id)} />
              <div className="mb-8">
                <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Chapter {chapter.chapter_number}</p>
                <h2 className="font-serif text-2xl text-white">{chapter.title}</h2>
              </div>
              <div className="space-y-6">
                {scenes.map((scene, idx) => (
                  <div key={scene.id}>
                    {idx > 0 && (
                      <div className="text-center text-gray-700 text-sm my-6">✦ ✦ ✦</div>
                    )}
                    {(scene.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                      <p
                        key={i}
                        className="text-gray-300 leading-relaxed font-serif text-base mb-4"
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
        })}

        {/* Back matter */}
        {backMatter.length > 0 && (
          <div className="mt-8">
            <hr className="border-gray-800 mb-16" />
            {backMatter.map(section => (
              <div key={section.id} className="relative group mb-16">
                <EditHint onClick={() => onEditSection('back')} />
                <h2 className="font-serif text-xl text-gray-300 mb-6 pb-3 border-b border-gray-800">
                  {SECTION_LABELS[section.type] ?? section.type}
                </h2>
                <div>
                  {(section.content ?? '').split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                    <p key={i} className="text-gray-300 leading-relaxed mb-4 font-serif text-base">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {chapters.every(ch => ch.scenes.every(s => !s.content)) && frontMatter.length === 0 && (
          <p className="text-gray-600 text-center py-12 italic">No content written yet. Switch to Edit mode to get started.</p>
        )}
      </div>
    </div>
  )
}
