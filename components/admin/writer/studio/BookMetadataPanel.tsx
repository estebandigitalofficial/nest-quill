'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WriterBook } from '@/types/writer'

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500'
const label = 'text-xs text-gray-400 font-medium'

export default function BookMetadataPanel({ book }: { book: WriterBook }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [fields, setFields] = useState({
    title: book.title,
    subtitle: book.subtitle ?? '',
    genre: book.genre,
    tone: book.tone,
    premise: book.premise,
    target_chapters: book.target_chapters,
    target_words_per_chapter: book.target_words_per_chapter,
    instructions: book.instructions ?? '',
    author_name: book.author_name ?? '',
    pen_name: book.pen_name ?? '',
    publisher_name: book.publisher_name ?? '',
    edition: book.edition ?? '',
    year_published: book.year_published ?? String(new Date().getFullYear()),
    author_bio: book.author_bio ?? '',
    also_by: book.also_by ?? '',
    isbn_epub: book.isbn_epub ?? '',
    isbn_kindle: book.isbn_kindle ?? '',
    isbn_paperback: book.isbn_paperback ?? '',
    isbn_hardcover: book.isbn_hardcover ?? '',
    isbn_pdf: book.isbn_pdf ?? '',
  })

  function set(key: string, value: string | number) {
    setFields(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const body: Record<string, string | number | null> = {}
    for (const [k, v] of Object.entries(fields)) {
      body[k] = typeof v === 'string' ? (v.trim() || null) : v
    }
    // Keep required string fields non-null
    body.title = fields.title || book.title
    body.genre = fields.genre || book.genre
    body.tone = fields.tone || book.tone
    body.premise = fields.premise || book.premise

    await fetch(`/api/admin/writer/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Book Metadata</span>
        <span className="text-xs text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">

          {/* Core */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Core</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={label}>Title</label>
                <input className={input} value={fields.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Subtitle <span className="text-gray-600">(optional)</span></label>
                <input className={input} value={fields.subtitle} onChange={e => set('subtitle', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Genre</label>
                <input className={input} value={fields.genre} onChange={e => set('genre', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Tone</label>
                <input className={input} value={fields.tone} onChange={e => set('tone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Target chapters</label>
                <input type="number" min={1} className={input} value={fields.target_chapters} onChange={e => set('target_chapters', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Words per chapter</label>
                <input type="number" min={100} step={100} className={input} value={fields.target_words_per_chapter} onChange={e => set('target_words_per_chapter', Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              <label className={label}>Premise</label>
              <textarea rows={3} className={`${input} resize-none`} value={fields.premise} onChange={e => set('premise', e.target.value)} />
            </div>
            <div className="space-y-1.5 mt-3">
              <label className={label}>Writing instructions</label>
              <textarea rows={3} className={`${input} resize-none`} placeholder="e.g. Write in first person, casual and conversational." value={fields.instructions} onChange={e => set('instructions', e.target.value)} />
            </div>
          </div>

          {/* Author & Publisher */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Author & Publisher</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={label}>Author name</label>
                <input className={input} value={fields.author_name} onChange={e => set('author_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Pen name</label>
                <input className={input} value={fields.pen_name} onChange={e => set('pen_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Publisher</label>
                <input className={input} value={fields.publisher_name} onChange={e => set('publisher_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Edition</label>
                <input className={input} placeholder="e.g. First Edition" value={fields.edition} onChange={e => set('edition', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Year published</label>
                <input className={input} value={fields.year_published} onChange={e => set('year_published', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              <label className={label}>Author bio</label>
              <textarea rows={3} className={`${input} resize-none`} placeholder="Short bio for the About the Author page." value={fields.author_bio} onChange={e => set('author_bio', e.target.value)} />
            </div>
            <div className="space-y-1.5 mt-3">
              <label className={label}>Also by (one title per line)</label>
              <textarea rows={3} className={`${input} resize-none`} placeholder="Title One&#10;Title Two" value={fields.also_by} onChange={e => set('also_by', e.target.value)} />
            </div>
          </div>

          {/* ISBNs */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">ISBNs <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['epub', 'kindle', 'paperback', 'hardcover', 'pdf'] as const).map(fmt => (
                <div key={fmt} className="space-y-1.5">
                  <label className={label}>{fmt.charAt(0).toUpperCase() + fmt.slice(1)}</label>
                  <input className={input} placeholder="978-..." value={fields[`isbn_${fmt}` as keyof typeof fields] as string} onChange={e => set(`isbn_${fmt}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-600">Changes apply to future generations and exports only.</p>
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
