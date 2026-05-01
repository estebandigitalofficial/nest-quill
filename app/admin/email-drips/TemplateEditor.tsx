'use client'

import { useState } from 'react'
import type { EmailDripTemplate } from '@/types/database'

export default function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: EmailDripTemplate | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !template
  const [form, setForm] = useState({
    sequence: template?.sequence ?? 'story',
    step: template?.step ?? 1,
    delay_days: template?.delay_days ?? 1,
    subject: template?.subject ?? '',
    body_html: template?.body_html ?? '',
    enabled: template?.enabled ?? true,
    trigger_condition: template?.trigger_condition ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const url = isNew
        ? '/api/admin/email-drips/templates'
        : `/api/admin/email-drips/templates/${template!.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  function update(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">{isNew ? 'New Template' : 'Edit Template'}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sequence</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.sequence} onChange={(e) => update('sequence', e.target.value)}>
              <option value="story">story</option>
              <option value="signup">signup</option>
              <option value="re-engagement">re-engagement</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Step</label>
            <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.step} onChange={(e) => update('step', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Delay (days)</label>
            <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.delay_days} onChange={(e) => update('delay_days', Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Trigger condition</label>
            <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.trigger_condition} onChange={(e) => update('trigger_condition', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Subject</label>
          <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.subject} onChange={(e) => update('subject', e.target.value)} />
          <p className="text-[10px] text-gray-600 mt-1">Use {'{child_name}'}, {'{story_url}'}, {'{create_url}'} placeholders</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Body HTML</label>
          <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono min-h-[200px] resize-y" value={form.body_html} onChange={(e) => update('body_html', e.target.value)} />
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Preview</p>
          <div className="bg-white rounded-lg p-4 max-h-[200px] overflow-y-auto">
            <iframe
              sandbox=""
              srcDoc={form.body_html}
              className="w-full min-h-[150px] border-0"
              title="Email preview"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} className="accent-brand-500" />
            Enabled
          </label>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
