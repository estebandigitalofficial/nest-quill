'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WriterBook } from '@/types/writer'

export default function BookSettingsPanel({ book }: { book: WriterBook }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [title, setTitle] = useState(book.title)
  const [subtitle, setSubtitle] = useState(book.subtitle ?? '')
  const [genre, setGenre] = useState(book.genre)
  const [tone, setTone] = useState(book.tone)
  const [premise, setPremise] = useState(book.premise)
  const [targetChapters, setTargetChapters] = useState(book.target_chapters)
  const [targetWords, setTargetWords] = useState(book.target_words_per_chapter)

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/writer/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subtitle: subtitle || null,
        genre,
        tone,
        premise,
        target_chapters: targetChapters,
        target_words_per_chapter: targetWords,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Book Settings</span>
        <span className="text-xs text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Title</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Subtitle <span className="text-gray-600">(optional)</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Genre</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={genre}
                onChange={e => setGenre(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Tone</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tone}
                onChange={e => setTone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Target chapters</label>
              <input
                type="number"
                min={1}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={targetChapters}
                onChange={e => setTargetChapters(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Target words per chapter</label>
              <input
                type="number"
                min={100}
                step={100}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={targetWords}
                onChange={e => setTargetWords(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium">Premise</label>
            <textarea
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={premise}
              onChange={e => setPremise(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-600">Changes apply to future generations only — existing scenes are not affected.</p>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
