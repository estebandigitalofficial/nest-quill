'use client'

import { useState } from 'react'
import type { WriterBookSection } from '@/types/writer'

const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication',
  epigraph: 'Epigraph',
  foreword: 'Foreword',
  preface: 'Preface',
  acknowledgments: 'Acknowledgments',
  conclusion: 'Conclusion',
  notes: 'Notes',
  about_author: 'About the Author',
  also_by: 'Also By',
}

export default function SectionEditor({
  section,
  onToggle,
  onSave,
}: {
  section: WriterBookSection
  onToggle: (id: string, enabled: boolean) => void
  onSave: (id: string, content: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(section.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(section.id, content)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${section.enabled ? 'border-adm-border' : 'border-adm-border'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          onClick={() => onToggle(section.id, !section.enabled)}
          className={`w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0 ${section.enabled ? 'bg-brand-500' : 'bg-gray-700'}`}
          style={{ width: 32, height: 18 }}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${section.enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
            style={{ width: 14, height: 14 }}
          />
        </button>
        <span className={`text-sm font-medium flex-1 ${section.enabled ? 'text-adm-text' : 'text-adm-subtle'}`}>
          {SECTION_LABELS[section.type] ?? section.type}
        </span>
        {section.enabled && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-adm-muted hover:text-adm-muted transition-colors"
          >
            {open ? 'Close' : 'Edit'}
          </button>
        )}
      </div>

      {section.enabled && open && (
        <div className="border-t border-adm-border px-4 py-3 space-y-3 bg-adm-surface/50">
          <textarea
            autoFocus
            rows={6}
            className="w-full bg-adm-surface border border-adm-border rounded-lg px-3 py-2.5 text-sm text-adm-text placeholder:text-adm-subtle resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={`Write your ${SECTION_LABELS[section.type]?.toLowerCase() ?? section.type} here…`}
            value={content}
            onChange={e => { setContent(e.target.value); setSaved(false) }}
          />
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs bg-gray-700 hover:bg-adm-border disabled:opacity-50 text-adm-text font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
