'use client'

import { useEffect, useState } from 'react'
import type { WriterBookSection } from '@/types/writer'
import SectionEditor from './SectionEditor'

export default function BackMatterPanel({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState<WriterBookSection[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    const res = await fetch(`/api/admin/writer/books/${bookId}/sections`)
    const data = await res.json()
    setSections((data as WriterBookSection[]).filter(s => s.zone === 'back').sort((a, b) => a.position - b.position))
    setLoading(false)
    setLoaded(true)
  }

  useEffect(() => {
    if (open && !loaded) load()
  }, [open])

  async function handleToggle(id: string, enabled: boolean) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled } : s))
    await fetch(`/api/admin/writer/books/${bookId}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
  }

  async function handleSave(id: string, content: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s))
    await fetch(`/api/admin/writer/books/${bookId}/sections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content }),
    })
  }

  const enabledCount = sections.filter(s => s.enabled).length

  return (
    <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-adm-muted uppercase tracking-widest">Back Matter</span>
          {enabledCount > 0 && (
            <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full">{enabledCount} active</span>
          )}
        </div>
        <span className="text-xs text-adm-subtle">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-adm-border px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-xs text-adm-subtle py-2">Loading…</p>
          ) : (
            <>
              <p className="text-xs text-adm-subtle pb-1">Toggle sections on to include them in your book. Click Edit to add content.</p>
              {sections.map(section => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  onToggle={handleToggle}
                  onSave={handleSave}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
