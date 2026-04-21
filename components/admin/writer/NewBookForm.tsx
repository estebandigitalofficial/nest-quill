'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type AdminUser = { userId: string; displayName: string; role: 'admin' | 'super_admin' }

export default function NewBookForm({
  isSuperAdmin,
  currentUserId,
  adminUsers,
}: {
  isSuperAdmin: boolean
  currentUserId: string
  adminUsers: AdminUser[]
}) {
  const router = useRouter()
  const [ownerId] = useState(currentUserId)
  const [mode, setMode] = useState<'choose' | 'manual'>('choose')

  // PDF upload state
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [pdfError, setPdfError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Manual form state
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    genre: '',
    tone: '',
    premise: '',
    target_chapters: 10,
    target_words_per_chapter: 2000,
    instructions: '',
  })

  function setField(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPdfStatus('uploading')
    setPdfError(null)

    // Extract text in the browser using PDF.js — avoids serverless parsing issues
    let text = ''
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item: unknown) => ('str' in (item as object) ? (item as { str: string }).str : ''))
          .join(' ')
        text += pageText + '\n'
      }
      text = text.trim()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPdfError(`Could not read PDF: ${msg}`)
      setPdfStatus('error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    if (!text || text.length < 50) {
      setPdfError('No readable text found. Make sure this is a text-based PDF.')
      setPdfStatus('error')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const res = await fetch('/api/admin/writer/books/from-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName: file.name, owner_id: ownerId }),
    })
    const json = await res.json()

    if (!res.ok) {
      setPdfError(json.error ?? 'Failed to create book')
      setPdfStatus('error')
      if (fileRef.current) fileRef.current.value = ''
    } else {
      router.push(`/admin/writer/${json.id}`)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)

    const res = await fetch('/api/admin/writer/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, owner_id: ownerId }),
    })

    if (!res.ok) {
      const json = await res.json()
      setFormError(json.error ?? 'Failed to create book')
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

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {isSuperAdmin && adminUsers.length > 1 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Author</label>
            <select className={input} defaultValue={currentUserId}>
              {adminUsers.map(u => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName}{u.userId === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* PDF upload — primary path */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-6 py-6 space-y-3">
          <div>
            <p className="text-base font-semibold text-white">Upload a PDF</p>
            <p className="text-sm text-gray-500 mt-0.5">Reedsy export or any text-based PDF — title, genre, and premise will be pulled automatically</p>
          </div>

          {pdfStatus === 'uploading' ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
              <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin shrink-0" />
              Creating book from PDF…
            </div>
          ) : (
            <label className="inline-flex cursor-pointer bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
              Choose PDF →
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </label>
          )}

          {pdfError && <p className="text-sm text-red-400">{pdfError}</p>}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-800" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 border-t border-gray-800" />
        </div>

        {/* Manual form — secondary path */}
        {mode === 'choose' ? (
          <button
            onClick={() => setMode('manual')}
            className="w-full border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-sm py-4 rounded-xl transition-colors"
          >
            Start from scratch — fill in details manually
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title" required>
                <input className={input} value={form.title} onChange={e => setField('title', e.target.value)} required placeholder="e.g. The Last Light" />
              </Field>
              <Field label="Subtitle">
                <input className={input} value={form.subtitle} onChange={e => setField('subtitle', e.target.value)} placeholder="Optional" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Genre" required>
                <input className={input} value={form.genre} onChange={e => setField('genre', e.target.value)} required placeholder="e.g. Thriller, Literary Fiction" />
              </Field>
              <Field label="Tone" required>
                <input className={input} value={form.tone} onChange={e => setField('tone', e.target.value)} required placeholder="e.g. Dark and tense" />
              </Field>
            </div>

            <Field label="Premise" required hint="Passed to the AI for every chapter.">
              <textarea
                className={`${input} resize-none`}
                rows={4}
                value={form.premise}
                onChange={e => setField('premise', e.target.value)}
                required
                placeholder="What is this book about — characters, conflict, stakes."
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Target chapters">
                <input type="number" className={input} value={form.target_chapters} onChange={e => setField('target_chapters', parseInt(e.target.value))} min={1} max={100} />
              </Field>
              <Field label="Words per chapter">
                <input type="number" className={input} value={form.target_words_per_chapter} onChange={e => setField('target_words_per_chapter', parseInt(e.target.value))} min={500} max={10000} step={500} />
              </Field>
            </div>

            <Field label="Writing instructions" hint="Sent to the AI on every scene generation.">
              <textarea
                className={`${input} resize-none`}
                rows={4}
                value={form.instructions}
                onChange={e => setField('instructions', e.target.value)}
                placeholder="e.g. Write in first person, casual and conversational. Don't make it sound like a published novel."
              />
            </Field>

            {formError && <p className="text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setMode('choose')} className="flex-1 text-center py-3 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-500 text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {saving ? 'Creating…' : 'Create book →'}
              </button>
            </div>
          </form>
        )}
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
