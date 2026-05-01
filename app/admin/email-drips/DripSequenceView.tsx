'use client'

import { useState } from 'react'
import type { EmailDripTemplate, EmailDripRule } from '@/types/database'
import TemplateEditor from './TemplateEditor'
import RuleEditor from './RuleEditor'

export default function DripSequenceView({
  initialTemplates,
  initialRules,
}: {
  initialTemplates: EmailDripTemplate[]
  initialRules: EmailDripRule[]
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [rules, setRules] = useState(initialRules)
  const [editingTemplate, setEditingTemplate] = useState<EmailDripTemplate | null | 'new'>(null)
  const [editingRule, setEditingRule] = useState<EmailDripRule | null | 'new'>(null)

  const sequences = [...new Set(templates.map((t) => t.sequence))]

  async function refresh() {
    const [tRes, rRes] = await Promise.all([
      fetch('/api/admin/email-drips/templates'),
      fetch('/api/admin/email-drips/rules'),
    ])
    if (tRes.ok) setTemplates(await tRes.json())
    if (rRes.ok) setRules(await rRes.json())
  }

  async function toggleTemplate(id: string, enabled: boolean) {
    await fetch(`/api/admin/email-drips/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, enabled } : t)))
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/admin/email-drips/templates/${id}`, { method: 'DELETE' })
    setTemplates((ts) => ts.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Templates by sequence */}
      {sequences.map((seq) => {
        const seqTemplates = templates.filter((t) => t.sequence === seq).sort((a, b) => a.step - b.step)
        return (
          <div key={seq}>
            <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-4">
              {seq} sequence
            </p>
            <div className="space-y-2">
              {seqTemplates.map((template, i) => (
                <div key={template.id} className="flex items-start gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${template.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                    {i < seqTemplates.length - 1 && (
                      <div className="w-0.5 h-full min-h-[40px] bg-gray-700 mt-1" />
                    )}
                  </div>
                  {/* Card */}
                  <div className="flex-1 bg-adm-surface border border-adm-border rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">Step {template.step}</span>
                          <span className="text-[10px] text-adm-subtle">+{template.delay_days}d</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${template.enabled ? 'bg-green-900 text-green-400' : 'bg-adm-surface text-adm-muted'}`}>
                            {template.enabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-adm-muted mt-1 truncate">{template.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleTemplate(template.id, !template.enabled)}
                          className="text-xs text-adm-muted hover:text-adm-muted transition-colors"
                        >
                          {template.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => setEditingTemplate(template)}
                          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Rules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest">Trigger Rules</p>
          <button
            onClick={() => setEditingRule('new')}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
          >
            + Add rule
          </button>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-adm-subtle">No rules configured.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-adm-surface border border-adm-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{rule.name}</p>
                  <p className="text-xs text-adm-muted">
                    {rule.trigger_type} · +{rule.delay_days}d
                    {rule.enabled ? '' : ' · disabled'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingRule(rule)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add template button */}
      <button
        onClick={() => setEditingTemplate('new')}
        className="text-sm text-brand-400 hover:text-brand-300 font-medium"
      >
        + Add template
      </button>

      {/* Modals */}
      {editingTemplate !== null && (
        <TemplateEditor
          template={editingTemplate === 'new' ? null : editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={refresh}
        />
      )}
      {editingRule !== null && (
        <RuleEditor
          rule={editingRule === 'new' ? null : editingRule}
          templates={templates}
          onClose={() => setEditingRule(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
