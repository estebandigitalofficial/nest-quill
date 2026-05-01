'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WriterBookWithChapters } from '@/types/writer'
import { cn } from '@/lib/utils/cn'

export default function BookOutlineEditor({
  book,
  focusChapterId,
  chapterRefs,
}: {
  book: WriterBookWithChapters
  focusChapterId?: string | null
  chapterRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newChapter, setNewChapter] = useState({ title: '', brief: '' })
  const [saving, setSaving] = useState(false)

  async function addChapter() {
    if (!newChapter.title || !newChapter.brief) return
    setSaving(true)

    const nextNumber = (book.chapters?.length ?? 0) + 1
    const res = await fetch(`/api/admin/writer/books/${book.id}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapter_number: nextNumber,
        title: newChapter.title,
        brief: newChapter.brief,
      }),
    })

    if (res.ok) {
      setNewChapter({ title: '', brief: '' })
      setAdding(false)
      router.refresh()
    }
    setSaving(false)
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm('Delete this chapter and all its scenes?')) return
    await fetch(`/api/admin/writer/books/${book.id}/chapters/${chapterId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest">Chapters</h2>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
        >
          + Add chapter
        </button>
      </div>

      {book.chapters.length === 0 && !adding && (
        <div className="bg-adm-surface border border-dashed border-adm-border rounded-xl px-6 py-10 text-center space-y-2">
          <p className="text-adm-muted text-sm">No chapters yet. Add your first chapter to start.</p>
          <button
            onClick={() => setAdding(true)}
            className="text-sm text-brand-400 hover:text-brand-300 font-semibold"
          >
            + Add chapter
          </button>
        </div>
      )}

      <div className="space-y-3">
        {book.chapters.map((chapter) => {
          const sceneCount = chapter.scenes?.length ?? 0
          const writtenCount = chapter.scenes?.filter(s => s.content).length ?? 0
          const wordCount = chapter.scenes?.reduce((sum, s) => sum + (s.word_count ?? 0), 0) ?? 0

          return (
            <div
              key={chapter.id}
              ref={el => { if (chapterRefs) chapterRefs.current[chapter.id] = el }}
              className={`bg-adm-surface border rounded-xl overflow-hidden transition-colors ${focusChapterId === chapter.id ? 'border-brand-500' : 'border-adm-border'}`}
            >
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-adm-subtle uppercase tracking-widest">
                      Ch. {chapter.chapter_number}
                    </span>
                    <ChapterStatusDot status={chapter.status} />
                  </div>
                  <h3 className="font-serif text-white text-base leading-snug">{chapter.title}</h3>
                  <p className="text-xs text-adm-muted mt-1 line-clamp-2">{chapter.brief}</p>
                  <div className="flex gap-3 mt-2 text-xs text-adm-subtle">
                    <span>{writtenCount}/{sceneCount} scenes</span>
                    {wordCount > 0 && <span>· {wordCount.toLocaleString()} words</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/writer/${book.id}/${chapter.id}`}
                    className="text-xs bg-brand-500 hover:bg-brand-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Open →
                  </Link>
                  <button
                    onClick={() => deleteChapter(chapter.id)}
                    className="text-xs text-adm-subtle hover:text-red-400 transition-colors p-1.5"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Add chapter form */}
        {adding && (
          <div className="bg-adm-surface border border-brand-700 rounded-xl px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
              Chapter {(book.chapters?.length ?? 0) + 1}
            </p>
            <input
              autoFocus
              className={inputClass}
              placeholder="Chapter title"
              value={newChapter.title}
              onChange={e => setNewChapter(n => ({ ...n, title: e.target.value }))}
            />
            <textarea
              className={cn(inputClass, 'resize-none')}
              rows={2}
              placeholder="What happens in this chapter? (brief — this guides the AI)"
              value={newChapter.brief}
              onChange={e => setNewChapter(n => ({ ...n, brief: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAdding(false); setNewChapter({ title: '', brief: '' }) }}
                className="flex-1 text-sm text-adm-muted hover:text-adm-muted py-2 rounded-lg border border-adm-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addChapter}
                disabled={saving || !newChapter.title || !newChapter.brief}
                className="flex-1 text-sm bg-brand-500 hover:bg-brand-600 disabled:bg-brand-900 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                {saving ? 'Adding…' : 'Add chapter'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChapterStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-700',
    in_progress: 'bg-brand-500',
    complete: 'bg-green-500',
  }
  return <span className={`w-1.5 h-1.5 rounded-full inline-block ${colors[status] ?? 'bg-gray-700'}`} />
}

const inputClass = 'w-full bg-adm-surface border border-adm-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-adm-subtle focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
