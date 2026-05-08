'use client'

import { useState } from 'react'
import type { AiWriterConfig } from '@/types/database'
import { cn } from '@/lib/utils/cn'

/* ── Section definitions ─────────────────────────────────────────────── */

interface Section {
  title: string
  subtitle?: string
  keys: string[]
  /** Display keys as a 2-col grid on md+ */
  grid?: boolean
}

/* ── Shared / legacy config sections ─────────────────────────────────── */

const CHILDREN_WRITER: Section = {
  title: "Children's Writer (Shared)",
  subtitle: 'Base prompts and rules shared across all children\u2019s age bands. Band-specific overrides (below) take priority.',
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
}

const ADULT_WRITER: Section = {
  title: 'Adult Writer (Shared)',
  subtitle: 'Base prompts for adult stories. Band-specific overrides in the Adult (18+) tab take priority.',
  keys: [
    'adult_story_role',
    'adult_story_language_rules',
    'adult_story_sentence_rules',
    'adult_story_tone_rule',
    'adult_story_ending_rule',
    'adult_image_safety_suffix',
  ],
}

const LEARNING: Section = {
  title: 'Learning Mode',
  subtitle: 'Instructions injected when a story is created in learning mode.',
  keys: ['learning_mode_instructions'],
}

const QUIZ: Section = {
  title: 'Quiz Generator',
  subtitle: 'System prompt and rules for auto-generated quizzes.',
  keys: ['quiz_system_prompt', 'quiz_rules'],
}

const IMAGE_STYLES: Section = {
  title: 'Image Styles',
  subtitle: 'DALL-E style hints and safety suffix appended to every image prompt.',
  keys: [
    'image_safety_suffix',
    'image_style_watercolor',
    'image_style_cartoon',
    'image_style_storybook',
    'image_style_pencil_sketch',
    'image_style_digital_art',
  ],
  grid: true,
}

/* ── Per-age-band config sections ─────────────────────────────────────── */

const BAND_KEYS = [
  'system_role',
  'words_per_page',
  'vocabulary_rules',
  'pacing_rules',
  'tone_guidance',
  'ending_rules',
  'moral_rules',
  'page_count',
  'image_style_hint',
  'image_safety_suffix',
] as const

function bandSection(band: string, label: string, ageRange: string): Section {
  return {
    title: `${label} (${ageRange})`,
    subtitle: `All AI writer settings for ${label.toLowerCase()} readers. These override the shared defaults when generating stories for this age group.`,
    keys: BAND_KEYS.map((k) => `band_${band}_${k}`),
  }
}

const BAND_YOUNG  = bandSection('young',  'Young',  'Ages 1\u20137')
const BAND_MIDDLE = bandSection('middle', 'Middle', 'Ages 8\u201311')
const BAND_TEEN   = bandSection('teen',   'Teen',   'Ages 12\u201317')
const BAND_ADULT  = bandSection('adult',  'Adult',  '18+')

/* ── Tabs ─────────────────────────────────────────────────────────────── */

const TABS = [
  { label: 'Young (1\u20137)',   sections: [BAND_YOUNG] },
  { label: 'Middle (8\u201311)', sections: [BAND_MIDDLE] },
  { label: 'Teen (12\u201317)', sections: [BAND_TEEN] },
  { label: 'Adult (18+)',       sections: [BAND_ADULT] },
  { label: 'Shared Defaults',   sections: [CHILDREN_WRITER, ADULT_WRITER] },
  { label: 'Learning & Quiz',   sections: [LEARNING, QUIZ] },
  { label: 'Image Styles',      sections: [IMAGE_STYLES] },
]

/* ── Friendly labels for config keys ──────────────────────────────────── */

const KEY_LABELS: Record<string, string> = {
  // Shared children's
  story_role: 'System role',
  story_output_format: 'Output JSON format',
  story_page_rules: 'Page count rule',
  story_language_rules: 'Language & age rules',
  story_sentence_rules: 'Length per page (legacy)',
  story_image_desc_rules: 'Image description rules',
  story_illustration_style_rule: 'Illustration style rule',
  story_tone_rule: 'Tone rule',
  story_ending_rule: 'Ending rule',
  // Shared adult
  adult_story_role: 'System role',
  adult_story_language_rules: 'Language rules',
  adult_story_sentence_rules: 'Length per page (legacy)',
  adult_story_tone_rule: 'Tone rule',
  adult_story_ending_rule: 'Ending rule',
  adult_image_safety_suffix: 'Image safety suffix',
  // Learning & quiz
  learning_mode_instructions: 'Learning mode prompt',
  quiz_system_prompt: 'Quiz system prompt',
  quiz_rules: 'Quiz rules',
  // Image styles
  image_safety_suffix: 'Safety suffix (all images)',
  image_style_watercolor: 'Watercolor',
  image_style_cartoon: 'Cartoon',
  image_style_storybook: 'Classic Storybook',
  image_style_pencil_sketch: 'Pencil Sketch',
  image_style_digital_art: 'Digital Art',
}

// Auto-generate labels for band keys
for (const band of ['young', 'middle', 'teen', 'adult']) {
  const bandLabels: Record<string, string> = {
    system_role: 'System role',
    words_per_page: 'Words per page',
    vocabulary_rules: 'Vocabulary & complexity',
    pacing_rules: 'Pacing & structure',
    tone_guidance: 'Tone guidance',
    ending_rules: 'Ending rules',
    moral_rules: 'Moral & theme handling',
    page_count: 'Page count range',
    image_style_hint: 'Image style hint',
    image_safety_suffix: 'Image safety suffix',
  }
  for (const [suffix, label] of Object.entries(bandLabels)) {
    KEY_LABELS[`band_${band}_${suffix}`] = label
  }
}

/* ── Component ───────────────────────────────────────────────────────── */

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
  const [activeTab, setActiveTab] = useState(0)

  // Collect all keys referenced by any section so we can detect new keys
  const allSectionKeys = TABS.flatMap((t) => t.sections.flatMap((s) => s.keys))
  const originalValues: Record<string, string> = Object.fromEntries(
    initialConfigs.map((c) => [c.key, c.value])
  )

  const hasChanges = allSectionKeys.some((k) => (values[k] ?? '') !== (originalValues[k] ?? ''))
  const changedCount = allSectionKeys.filter((k) => (values[k] ?? '') !== (originalValues[k] ?? '')).length

  async function handleSave() {
    setShowConfirm(false)
    setSaving(true)
    setMessage(null)

    // Include both modified existing keys and newly filled keys
    const updates = allSectionKeys
      .filter((k) => (values[k] ?? '') !== (originalValues[k] ?? ''))
      .map((k) => ({ key: k, value: values[k] ?? '' }))

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

  const currentSections = TABS[activeTab].sections

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-adm-surface border border-adm-border rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === i
                ? 'bg-brand-500 text-adm-text'
                : 'text-adm-muted hover:text-adm-text hover:bg-adm-text/5'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sections for active tab */}
      {currentSections.map((section) => (
        <div key={section.title}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-adm-text">{section.title}</h2>
            {section.subtitle && (
              <p className="text-xs text-adm-muted mt-0.5">{section.subtitle}</p>
            )}
          </div>

          <div className={cn(
            section.grid
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'space-y-4'
          )}>
            {section.keys.map((key) => {
              const config = configMap.get(key)
              const currentVal = values[key] ?? ''
              const originalVal = config?.value ?? ''
              const isModified = currentVal !== originalVal
              const isNew = !config
              const isLong = currentVal.length > 120

              return (
                <div
                  key={key}
                  className={cn(
                    'bg-adm-surface border rounded-xl px-5 py-4',
                    isModified ? 'border-amber-500/40' : 'border-adm-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-adm-text">
                        {KEY_LABELS[key] ?? key}
                        {isNew && (
                          <span className="ml-2 text-[10px] font-semibold bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">
                            not set
                          </span>
                        )}
                      </p>
                      {config?.description && (
                        <p className="text-xs text-adm-muted mt-0.5 line-clamp-2">{config.description}</p>
                      )}
                    </div>
                    {isModified && (
                      <span className="text-[10px] font-semibold bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                        modified
                      </span>
                    )}
                  </div>
                  {isLong ? (
                    <textarea
                      className="w-full bg-adm-bg border border-adm-border rounded-lg px-3.5 py-2.5 text-sm text-adm-text font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none resize-y min-h-[100px]"
                      rows={Math.min(10, Math.ceil((values[key] ?? '').length / 80))}
                      value={values[key] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full bg-adm-bg border border-adm-border rounded-lg px-3.5 py-2.5 text-sm text-adm-text font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-adm-text text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : `Save changes${changedCount > 0 ? ` (${changedCount})` : ''}`}
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
            <h3 className="text-lg font-semibold text-adm-text">Confirm changes</h3>
            <p className="text-sm text-adm-muted">
              Are you sure you want to change {changedCount} writer setting{changedCount > 1 ? 's' : ''}? This will affect all future story generations.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm text-adm-muted hover:text-adm-text px-4 py-2 rounded-lg border border-adm-border hover:border-adm-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-sm font-semibold text-adm-text bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg transition-colors"
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
