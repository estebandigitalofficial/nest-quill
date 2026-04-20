'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewBookPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    genre: '',
    tone: '',
    premise: '',
    target_chapters: 10,
    target_words_per_chapter: 2000,
  })

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const res = await fetch('/api/admin/writer/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error ?? 'Failed to create book')
      setSaving(false)
      return
    }

    const book = await res.json()
    router.push(`/admin/writer/${book.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 h-14 flex items-center gap-3">
        <Link href="/admin/writer" className="text-xs text-gray-500 hover:text-gray-300">← Books</Link>
        <span className="text-gray-700">/</span>
        <span className="font-semibold text-white">New book</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Title" required>
              <input className={input} value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. The Last Light" />
            </Field>
            <Field label="Subtitle">
              <input className={input} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Genre" required>
              <input className={input} value={form.genre} onChange={e => set('genre', e.target.value)} required placeholder="e.g. Thriller, Literary Fiction" />
            </Field>
            <Field label="Tone" required>
              <input className={input} value={form.tone} onChange={e => set('tone', e.target.value)} required placeholder="e.g. Dark and tense, Warm and hopeful" />
            </Field>
          </div>

          <Field label="Premise" required hint="The core description of the book. This is passed to the AI for every chapter.">
            <textarea
              className={`${input} resize-none`}
              rows={4}
              value={form.premise}
              onChange={e => set('premise', e.target.value)}
              required
              placeholder="A brief, clear description of what this book is about — characters, conflict, world, stakes."
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Target chapters" hint="How many chapters in the book">
              <input
                type="number"
                className={input}
                value={form.target_chapters}
                onChange={e => set('target_chapters', parseInt(e.target.value))}
                min={1} max={100}
              />
            </Field>
            <Field label="Words per chapter" hint="Approximate target per chapter">
              <input
                type="number"
                className={input}
                value={form.target_words_per_chapter}
                onChange={e => set('target_words_per_chapter', parseInt(e.target.value))}
                min={500} max={10000} step={500}
              />
            </Field>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">
            Estimated book length: ~<span className="text-white font-semibold">
              {(form.target_chapters * form.target_words_per_chapter).toLocaleString()}
            </span> words
          </div>

          {error && <p className="text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Link
              href="/admin/writer"
              className="flex-1 text-center py-3 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-500 text-sm font-semibold transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Creating…' : 'Create book →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  )
}

const input = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors'
