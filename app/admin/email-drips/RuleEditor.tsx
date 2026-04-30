'use client'

import { useState } from 'react'
import type { EmailDripRule, EmailDripTemplate } from '@/types/database'

export default function RuleEditor({
  rule,
  templates,
  onClose,
  onSaved,
}: {
  rule: EmailDripRule | null
  templates: EmailDripTemplate[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !rule
  const [form, setForm] = useState({
    name: rule?.name ?? '',
    trigger_type: rule?.trigger_type ?? 'signup',
    delay_days: rule?.delay_days ?? 0,
    template_id: rule?.template_id ?? '',
    conditions: JSON.stringify(rule?.conditions ?? {}, null, 2),
    enabled: rule?.enabled ?? true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      let conditions = {}
      try { conditions = JSON.parse(form.conditions) } catch { /* use empty */ }

      const url = isNew
        ? '/api/admin/email-drips/rules'
        : `/api/admin/email-drips/rules/${rule!.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          conditions,
          template_id: form.template_id || null,
        }),
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">{isNew ? 'New Rule' : 'Edit Rule'}</h3>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Name</label>
          <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Trigger type</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.trigger_type} onChange={(e) => update('trigger_type', e.target.value)}>
              <option value="signup">signup</option>
              <option value="first_story">first_story</option>
              <option value="no_activity">no_activity</option>
              <option value="post_trial">post_trial</option>
              <option value="review_incentive">review_incentive</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Delay (days)</label>
            <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.delay_days} onChange={(e) => update('delay_days', Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Template</label>
          <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" value={form.template_id} onChange={(e) => update('template_id', e.target.value)}>
            <option value="">— None —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.sequence} step {t.step}: {t.subject.slice(0, 50)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Conditions (JSON)</label>
          <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono min-h-[80px] resize-y" value={form.conditions} onChange={(e) => update('conditions', e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.enabled} onChange={(e) => update('enabled', e.target.checked)} className="accent-brand-500" />
          Enabled
        </label>

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
