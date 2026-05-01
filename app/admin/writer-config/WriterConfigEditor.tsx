'use client'

import { useState } from 'react'
import type { AiWriterConfig } from '@/types/database'

const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'Story Prompts',
    keys: [
      'story_role',
      'story_output_format',
      'story_page_rules',
      'story_language_rules',
      'story_sentence_rules',
      'story_image_desc_rules',
      'story_illustration_style_rule',
      'story_tone_rule',
      'story_ending_rule',
    ],
  },
  {
    title: 'Learning Mode',
    keys: ['learning_mode_instructions'],
  },
  {
    title: 'Quiz',
    keys: ['quiz_system_prompt', 'quiz_rules'],
  },
  {
    title: 'Adult Writer',
    keys: [
      'adult_story_role',
      'adult_story_language_rules',
      'adult_story_sentence_rules',
      'adult_story_ending_rule',
      'adult_image_safety_suffix',
      'adult_story_tone_rule',
    ],
  },
  {
    title: 'Image Styles',
    keys: [
      'image_safety_suffix',
      'image_style_watercolor',
      'image_style_cartoon',
      'image_style_storybook',
      'image_style_pencil_sketch',
      'image_style_digital_art',
    ],
  },
]

export default function WriterConfigEditor({
  initialConfigs,
}: {
  initialConfigs: AiWriterConfig[]
}) {
  const configMap = new Map(initialConfigs.map((c) => [c.key, c]))
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initialConfigs.map((c) => [c.key, c.value]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const hasChanges = initialConfigs.some((c) => values[c.key] !== c.value)

  async function handleSave() {
    setShowConfirm(false)
    setSaving(true)
    setMessage(null)

    const updates = initialConfigs
      .filter((c) => values[c.key] !== c.value)
      .map((c) => ({ key: c.key, value: values[c.key] }))

    if (updates.length === 0) {
      setMessage({ type: 'success', text: 'No changes to save.' })
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/admin/writer-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setMessage({ type: 'success', text: `${updates.length} setting${updates.length > 1 ? 's' : ''} saved.` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-4">
            {section.title}
          </p>
          <div className="space-y-4">
            {section.keys.map((key) => {
              const config = configMap.get(key)
              if (!config) return null
              const isLong = (values[key] ?? '').length > 120

              return (
                <div key={key} className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{key}</p>
                      {config.description && (
                        <p className="text-xs text-adm-muted mt-0.5">{config.description}</p>
                      )}
                    </div>
                    {values[key] !== config.value && (
                      <span className="text-[10px] font-semibold bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                        modified
                      </span>
                    )}
                  </div>
                  {isLong ? (
                    <textarea
                      className="w-full bg-adm-surface border border-adm-border rounded-lg px-3.5 py-2.5 text-sm text-adm-text font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none resize-y min-h-[100px]"
                      rows={Math.min(12, Math.ceil((values[key] ?? '').length / 80))}
                      value={values[key] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full bg-adm-surface border border-adm-border rounded-lg px-3.5 py-2.5 text-sm text-adm-text font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      value={values[key] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Save area */}
      <div className="sticky bottom-0 bg-adm-bg/90 backdrop-blur border-t border-adm-border py-4 flex items-center gap-4">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!hasChanges || saving}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-adm-surface border border-adm-border rounded-2xl px-8 py-6 max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Confirm changes</h3>
            <p className="text-sm text-adm-muted">
              Are you sure you want to change the Nest &amp; Quill writer settings? This will affect all future story generations.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm text-adm-muted hover:text-white px-4 py-2 rounded-lg border border-adm-border hover:border-adm-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg transition-colors"
              >
                Yes, save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
