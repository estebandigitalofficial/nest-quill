'use client'

import { useEffect, useState } from 'react'
import type { WriterBook, WriterCopyright } from '@/types/writer'

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500'
const label = 'text-xs text-gray-400 font-medium'

function buildCopyrightText(c: WriterCopyright, book: WriterBook): string {
  const name = c.pen_name || c.author_name || book.author_name || book.pen_name || 'The Author'
  const year = c.year || book.year_published || String(new Date().getFullYear())
  const publisher = c.publisher_name || book.publisher_name || ''
  const edition = c.edition || book.edition || ''

  const lines: string[] = []
  lines.push(`Copyright © ${year} ${name}`)
  if (edition) lines.push(edition)
  if (publisher) lines.push(`Published by ${publisher}`)
  lines.push('')

  const enabled = (c.clauses ?? []).filter(cl => cl.enabled)
  for (const cl of enabled) {
    lines.push(cl.label)
  }

  if (c.collaborators && c.collaborators.length > 0) {
    lines.push('')
    for (const col of c.collaborators) {
      if (col.name && col.role) lines.push(`${col.role}: ${col.name}`)
    }
  }

  return lines.join('\n')
}

export default function CopyrightBuilder({ book }: { book: WriterBook }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const [copyright, setCopyright] = useState<WriterCopyright | null>(null)

  async function load() {
    if (loaded) return
    setLoading(true)
    const res = await fetch(`/api/admin/writer/books/${book.id}/copyright`)
    const data = await res.json()
    setCopyright(data)
    setLoading(false)
    setLoaded(true)
  }

  useEffect(() => {
    if (open && !loaded) load()
  }, [open])

  function update(fields: Partial<WriterCopyright>) {
    setCopyright(prev => prev ? { ...prev, ...fields } : prev)
    setSaved(false)
  }

  function toggleClause(key: string) {
    if (!copyright) return
    update({
      clauses: copyright.clauses.map(cl =>
        cl.key === key ? { ...cl, enabled: !cl.enabled } : cl
      ),
    })
  }

  function setCollaborator(i: number, field: 'name' | 'role', value: string) {
    if (!copyright) return
    const updated = [...copyright.collaborators]
    updated[i] = { ...updated[i], [field]: value }
    update({ collaborators: updated })
  }

  function addCollaborator() {
    if (!copyright) return
    update({ collaborators: [...copyright.collaborators, { name: '', role: '' }] })
  }

  function removeCollaborator(i: number) {
    if (!copyright) return
    update({ collaborators: copyright.collaborators.filter((_, idx) => idx !== i) })
  }

  async function save() {
    if (!copyright) return
    setSaving(true)
    // Auto-generate custom_text from fields if not manually edited
    const generated = buildCopyrightText(copyright, book)
    const body = { ...copyright, custom_text: copyright.custom_text ?? generated }
    await fetch(`/api/admin/writer/books/${book.id}/copyright`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setCopyright(prev => prev ? { ...prev, custom_text: body.custom_text } : prev)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-left"
      >
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Copyright Page</span>
        <span className="text-xs text-gray-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">
          {loading || !copyright ? (
            <p className="text-xs text-gray-600 py-2">Loading…</p>
          ) : (
            <>
              {/* Basic info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={label}>Author name on copyright</label>
                  <input className={input} value={copyright.author_name ?? ''} onChange={e => update({ author_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Pen name</label>
                  <input className={input} value={copyright.pen_name ?? ''} onChange={e => update({ pen_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Publisher</label>
                  <input className={input} value={copyright.publisher_name ?? ''} onChange={e => update({ publisher_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Edition</label>
                  <input className={input} placeholder="First Edition" value={copyright.edition ?? ''} onChange={e => update({ edition: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Year</label>
                  <input className={input} value={copyright.year ?? ''} onChange={e => update({ year: e.target.value })} />
                </div>
              </div>

              {/* Clauses */}
              <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Clauses</p>
                <div className="space-y-2">
                  {copyright.clauses.map(cl => (
                    <label key={cl.key} className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={cl.enabled}
                        onChange={() => toggleClause(cl.key)}
                        className="mt-0.5 accent-brand-500"
                      />
                      <span className={`text-xs leading-relaxed ${cl.enabled ? 'text-gray-300' : 'text-gray-600'}`}>{cl.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Collaborators */}
              <div>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Collaborators</p>
                <div className="space-y-2">
                  {copyright.collaborators.map((col, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className={`${input} flex-1`} placeholder="Name" value={col.name} onChange={e => setCollaborator(i, 'name', e.target.value)} />
                      <input className={`${input} flex-1`} placeholder="Role (e.g. Editor)" value={col.role} onChange={e => setCollaborator(i, 'role', e.target.value)} />
                      <button onClick={() => removeCollaborator(i)} className="text-gray-600 hover:text-red-400 text-xs px-2 transition-colors">✕</button>
                    </div>
                  ))}
                  <button onClick={addCollaborator} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">+ Add collaborator</button>
                </div>
              </div>

              {/* Preview / Edit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Preview & Edit</p>
                  <button onClick={() => setPreview(p => !p)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    {preview ? 'Edit raw text' : 'Preview generated'}
                  </button>
                </div>
                {preview ? (
                  <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {copyright.custom_text || buildCopyrightText(copyright, book)}
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    className={`${input} resize-none font-mono text-xs`}
                    placeholder="Leave blank to auto-generate from fields above."
                    value={copyright.custom_text ?? ''}
                    onChange={e => update({ custom_text: e.target.value || null })}
                  />
                )}
                <p className="text-xs text-gray-600 mt-1">Leave blank to auto-generate. Edit manually to override.</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save copyright page'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
