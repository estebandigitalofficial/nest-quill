'use client'

import React, { useState, useEffect } from 'react'
import NotificationToggles from './NotificationToggles'

// ─── Icons ────────────────────────────────────────────────────────────────────

function BellIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function LayersIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>)
}
function FlagIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>)
}
function BookOpenIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>)
}
function FileTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>)
}
function MailIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>)
}
function GlobeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>)
}
function ShieldIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>)
}
function GridIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
}
function PaletteIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Item = { label: string; hint: string; key?: string; group?: string }

type SectionDef = {
  id: string
  label: string
  description: string
  Icon: (props: { className?: string }) => React.ReactElement
  live: boolean
  items?: Item[]
  /** Use a 2-col grid for items */
  columns?: boolean
}

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  {
    id: 'branding',
    label: 'Branding & Identity',
    description: 'Logos, colors, contact info — controls the look and feel of the entire site.',
    Icon: PaletteIcon,
    live: false,
    columns: true,
    items: [
      { label: 'Favicon URL',       hint: 'Browser tab icon (.webp, .png, or .ico)',                     key: 'branding_favicon_url',    group: 'Assets' },
      { label: 'Header Logo URL',   hint: 'Logo shown in the public site header',                        key: 'branding_header_logo_url', group: 'Assets' },
      { label: 'Footer Logo URL',   hint: 'Logo shown in the footer (light version for dark bg)',         key: 'branding_footer_logo_url', group: 'Assets' },
      { label: 'Contact Email',     hint: 'Public-facing contact email',                                 key: 'contact_email',           group: 'Contact Info' },
      { label: 'Support Email',     hint: 'Customer support inquiries',                                  key: 'support_email',           group: 'Contact Info' },
      { label: 'Stories From Email', hint: 'Sender address for story emails',                             key: 'stories_from_email',      group: 'Contact Info' },
      { label: 'Admin Alert Email', hint: 'Receives admin notifications',                                key: 'admin_alert_email',       group: 'Contact Info' },
      { label: 'Phone Number',      hint: 'Displayed on contact page',                                   key: 'phone_number',            group: 'Contact Info' },
      { label: 'Brand Primary',     hint: 'Buttons, links, accents',                                     key: 'color_brand_primary',     group: 'Light Mode Colors' },
      { label: 'Oxford Navy',       hint: 'Headings and dark text',                                      key: 'color_oxford',            group: 'Light Mode Colors' },
      { label: 'Parchment',         hint: 'Main background',                                             key: 'color_parchment',         group: 'Light Mode Colors' },
      { label: 'Charcoal',          hint: 'Body text',                                                   key: 'color_charcoal',          group: 'Light Mode Colors' },
      { label: 'Brand Primary',     hint: 'Accent color',                                                key: 'color_dark_brand_primary', group: 'Dark Mode Colors' },
      { label: 'Background',        hint: 'Main background',                                             key: 'color_dark_bg',           group: 'Dark Mode Colors' },
      { label: 'Surface',           hint: 'Card/surface background',                                     key: 'color_dark_surface',      group: 'Dark Mode Colors' },
      { label: 'Text',              hint: 'Primary text',                                                key: 'color_dark_text',         group: 'Dark Mode Colors' },
      { label: 'Muted Text',        hint: 'Secondary text',                                              key: 'color_dark_muted',        group: 'Dark Mode Colors' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email alerts for system events.',
    Icon: BellIcon,
    live: true,
  },
  {
    id: 'plans',
    label: 'Plans & Limits',
    description: 'Story quotas and tier access controls.',
    Icon: LayersIcon,
    live: false,
    columns: true,
    items: [
      { label: 'Guest story limit',     hint: 'Max stories before login required', key: 'guest_story_limit' },
      { label: 'Free user story limit', hint: 'Monthly cap for free accounts',     key: 'free_user_story_limit' },
      { label: 'Max pages per tier',    hint: 'Page ceiling by plan level' },
      { label: 'PDF & dedication access', hint: 'Which tiers unlock PDF and dedication' },
      { label: 'Pricing copy',          hint: 'Plan names and CTAs' },
    ],
  },
  {
    id: 'flags',
    label: 'Feature Flags',
    description: 'Enable or disable features site-wide.',
    Icon: FlagIcon,
    live: false,
    columns: true,
    items: [
      { label: 'Scan Homework',       hint: 'Upload and scan homework',          key: 'scan_homework_enabled' },
      { label: 'Classroom',           hint: 'Educator flows and class management', key: 'classroom_enabled' },
      { label: 'Publishing Requests', hint: 'User publishing request form',      key: 'publishing_requests_enabled' },
      { label: 'Trivia Mode',         hint: 'Quiz mode on completed stories',    key: 'trivia_enabled' },
      { label: 'PDF Download',        hint: 'Download stories as PDF',           key: 'pdf_download_enabled' },
      { label: 'Maintenance Mode',    hint: 'Take site offline',                 key: 'maintenance_mode_enabled' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning Tools',
    description: 'Learning section modes and defaults.',
    Icon: BookOpenIcon,
    live: false,
    columns: true,
    items: [
      { label: 'Think First mode',       hint: 'Think First prompting default',   key: 'think_first_enabled' },
      { label: 'Teach Back mode',         hint: 'Teach Back exercises default',    key: 'teach_back_enabled' },
      { label: 'Nudges',                  hint: 'In-session encouragement',        key: 'learning_nudges_enabled' },
      { label: 'Spelling sentence mode',  hint: 'Sentence generation default',    key: 'spelling_sentence_mode_default' },
      { label: 'Rate limits',             hint: 'Max requests per session/day' },
      { label: 'Grade range',             hint: 'Supported grade levels' },
    ],
  },
  {
    id: 'site-copy',
    label: 'Site Copy',
    description: 'Editable text across the public site.',
    Icon: FileTextIcon,
    live: false,
    items: [
      { label: 'Homepage headline',   hint: 'Hero heading and subheadline' },
      { label: 'Pricing copy',        hint: 'Pricing page descriptions' },
      { label: 'Story helper text',   hint: 'Wizard guidance text' },
      { label: 'Limit messages',      hint: 'Quota/tier limit text' },
      { label: 'Classroom copy',      hint: 'Classroom labels and CTAs' },
    ],
  },
  {
    id: 'email',
    label: 'Email Settings',
    description: 'Sender identity, copy, and timing.',
    Icon: MailIcon,
    live: false,
    items: [
      { label: 'Sender name',            hint: 'Display name in outgoing emails' },
      { label: 'Story ready email copy', hint: 'Completion notification copy' },
      { label: 'Admin recipients',       hint: 'Admin alert email addresses' },
      { label: 'Drip timing',            hint: 'Drip sequence delays' },
    ],
  },
  {
    id: 'publishing',
    label: 'Publishing',
    description: 'Publishing request flow options.',
    Icon: GlobeIcon,
    live: false,
    items: [
      { label: 'Request form options', hint: 'Publishing form fields' },
      { label: 'Intent dropdowns',     hint: 'User intent options' },
      { label: 'Status options',       hint: 'Request status values' },
      { label: 'Confirmation message', hint: 'Post-submission text' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Guardrails',
    description: 'Content safety and input limits.',
    Icon: ShieldIcon,
    live: false,
    columns: true,
    items: [
      { label: 'School-safe mode',         hint: 'Conservative content filtering', key: 'strict_school_safe_mode' },
      { label: 'Political clarification',  hint: 'Sensitive topic detection',      key: 'political_clarification_enabled' },
      { label: 'Max pasted text',          hint: 'Character limit for inputs',     key: 'max_pasted_text_length' },
      { label: 'Max image upload (MB)',    hint: 'File size ceiling',              key: 'max_image_upload_mb' },
      { label: 'Image uploads per tool',   hint: 'Per-session upload limit' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Admin dashboard cards and thresholds.',
    Icon: GridIcon,
    live: false,
    columns: true,
    items: [
      { label: 'Stuck-story threshold',  hint: 'Minutes before flagged as stuck', key: 'stuck_story_threshold_minutes' },
      { label: 'Visible cards',           hint: 'Stat cards on admin home' },
      { label: 'Alert thresholds',        hint: 'Error rate / queue depth alerts' },
    ],
  },
]

// ─── Save-state indicator ─────────────────────────────────────────────────────

function SaveDot({ status }: { status: SaveStatus }) {
  if (status === 'idle')   return null
  if (status === 'saving') return <span className="text-[11px] text-adm-muted animate-pulse">Saving…</span>
  if (status === 'saved')  return <span className="text-[11px] text-green-500 font-medium">Saved</span>
  return                          <span className="text-[11px] text-red-400  font-medium">Failed</span>
}

// ─── Row components ───────────────────────────────────────────────────────────

function BooleanRow({ settingKey, value, status, label, hint, onSave }: {
  settingKey: string; value: boolean; status: SaveStatus; label: string; hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-adm-text">{label}</p>
        <p className="text-[11px] text-adm-muted mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <SaveDot status={status} />
        <button
          type="button"
          onClick={() => onSave(settingKey, !value, value)}
          disabled={status === 'saving'}
          aria-pressed={value}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${value ? 'bg-brand-500' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}

function NumericRow({ settingKey, value, status, label, hint, onSave }: {
  settingKey: string; value: number; status: SaveStatus; label: string; hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const isDirty = Number(draft) !== value && Number.isFinite(Number(draft))
  function handleSave() {
    const n = Number(draft)
    if (Number.isFinite(n) && n !== value) onSave(settingKey, n, value)
    else setDraft(String(value))
  }
  return (
    <div className={`flex items-center justify-between gap-4 bg-adm-bg/50 border rounded-xl px-4 py-3.5 ${isDirty ? 'border-brand-500/50' : 'border-adm-border'}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-adm-text">{label}</p>
        <p className="text-[11px] text-adm-muted mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SaveDot status={status} />
        <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={status === 'saving'}
          className="w-20 text-center text-sm bg-adm-bg border border-adm-border rounded-lg px-2 py-1.5 text-adm-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50" />
        {isDirty && (
          <button onClick={handleSave} disabled={status === 'saving'}
            className="shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            Save
          </button>
        )}
      </div>
    </div>
  )
}

function StringRow({ settingKey, value, status, label, hint, onSave }: {
  settingKey: string; value: string; status: SaveStatus; label: string; hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const isDirty = draft !== value
  function handleSave() { if (isDirty) onSave(settingKey, draft, value) }
  return (
    <div className={`bg-adm-bg/50 border rounded-xl px-4 py-3.5 ${isDirty ? 'border-brand-500/50' : 'border-adm-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-adm-text">{label}</p>
          <p className="text-[11px] text-adm-muted mt-0.5">{hint}</p>
        </div>
        <SaveDot status={status} />
      </div>
      <div className="flex gap-2">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={status === 'saving'}
          className="flex-1 min-w-0 text-sm bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-adm-text focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 font-mono" />
        {isDirty && (
          <button onClick={handleSave} disabled={status === 'saving'}
            className="shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors">
            Save
          </button>
        )}
      </div>
    </div>
  )
}

function ColorRow({ settingKey, value, status, label, hint, onSave }: {
  settingKey: string; value: string; status: SaveStatus; label: string; hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const isDirty = draft !== value
  function handleSave() { if (isDirty) onSave(settingKey, draft, value) }
  return (
    <div className={`flex items-center justify-between gap-3 bg-adm-bg/50 border rounded-xl px-4 py-3.5 ${isDirty ? 'border-brand-500/50' : 'border-adm-border'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <input type="color" value={draft.startsWith('#') ? draft : '#000000'} onChange={e => setDraft(e.target.value)} disabled={status === 'saving'}
          className="w-9 h-9 rounded-lg border border-adm-border cursor-pointer disabled:opacity-50 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-adm-text">{label}</p>
          <p className="text-[11px] text-adm-muted mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SaveDot status={status} />
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={status === 'saving'}
          className="w-24 text-center text-xs bg-adm-bg border border-adm-border rounded-lg px-2 py-1.5 text-adm-text font-mono focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50" />
        {isDirty && (
          <button onClick={handleSave} disabled={status === 'saving'}
            className="shrink-0 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            Save
          </button>
        )}
      </div>
    </div>
  )
}

function PlaceholderRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-adm-bg/30 border border-dashed border-adm-border rounded-xl px-4 py-3.5 opacity-60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-adm-text">{label}</p>
        <p className="text-[11px] text-adm-muted mt-0.5">{hint}</p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold tracking-wide uppercase text-adm-subtle border border-adm-border rounded px-1.5 py-0.5">
        Soon
      </span>
    </div>
  )
}

function SkeletonRow() {
  return <div className="h-[60px] bg-adm-bg border border-adm-border rounded-xl animate-pulse" />
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { initialSettings: Record<string, boolean> }

export default function SettingsHub({ initialSettings }: Props) {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)
  const [appSettings, setAppSettings] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})

  useEffect(() => {
    fetch('/api/admin/app-settings')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then((data: { settings: Record<string, { key: string; value: unknown }[]> }) => {
        const flat: Record<string, unknown> = {}
        for (const rows of Object.values(data.settings ?? {})) {
          for (const row of rows) flat[row.key] = row.value
        }
        setAppSettings(flat)
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false))
  }, [])

  async function saveSetting(key: string, next: unknown, prev: unknown) {
    setAppSettings(s => ({ ...s, [key]: next }))
    setSaveStatus(s => ({ ...s, [key]: 'saving' }))
    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setSaveStatus(s => ({ ...s, [key]: 'saved' }))
      setTimeout(() => setSaveStatus(s => s[key] === 'saved' ? { ...s, [key]: 'idle' } : s), 2000)
    } catch {
      setAppSettings(s => ({ ...s, [key]: prev }))
      setSaveStatus(s => ({ ...s, [key]: 'error' }))
    }
  }

  function renderItem(item: Item) {
    if (!item.key) return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />
    if (isLoading) return <SkeletonRow key={item.label} />
    if (loadFailed || !(item.key in appSettings)) return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />

    const value = appSettings[item.key]
    const status = saveStatus[item.key] ?? 'idle'

    if (typeof value === 'boolean') return <BooleanRow key={item.key} settingKey={item.key} value={value} status={status} label={item.label} hint={item.hint} onSave={saveSetting} />
    if (typeof value === 'number') return <NumericRow key={item.key} settingKey={item.key} value={value} status={status} label={item.label} hint={item.hint} onSave={saveSetting} />
    if (typeof value === 'string') {
      if (item.key.startsWith('color_')) return <ColorRow key={item.key} settingKey={item.key} value={value} status={status} label={item.label} hint={item.hint} onSave={saveSetting} />
      return <StringRow key={item.key} settingKey={item.key} value={value} status={status} label={item.label} hint={item.hint} onSave={saveSetting} />
    }
    return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />
  }

  function renderGroupedItems(items: Item[], columns?: boolean) {
    // Group items by their group field
    const groups: { name: string | null; items: Item[] }[] = []
    let current: { name: string | null; items: Item[] } | null = null
    for (const item of items) {
      const g = item.group ?? null
      if (!current || current.name !== g) {
        current = { name: g, items: [] }
        groups.push(current)
      }
      current.items.push(item)
    }

    return (
      <div className="space-y-6">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.name && (
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest whitespace-nowrap">{group.name}</p>
                <div className="flex-1 h-px bg-adm-border" />
              </div>
            )}
            <div className={columns ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'}>
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const activeSec = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0]
  const hasLiveItems = activeSec.items?.some(i => i.key) ?? false
  const showComingSoon = !activeSec.live && !hasLiveItems

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
      {/* Sidebar navigation */}
      <nav className="lg:w-56 shrink-0">
        {/* Mobile: horizontal scroll tabs */}
        <div className="flex lg:hidden overflow-x-auto gap-1 pb-2 -mx-1 px-1">
          {SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveId(sec.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeId === sec.id
                  ? 'bg-brand-500 text-white'
                  : 'text-adm-muted hover:text-adm-text hover:bg-adm-bg'
              }`}
            >
              <sec.Icon className="w-3.5 h-3.5" />
              {sec.label}
            </button>
          ))}
        </div>

        {/* Desktop: vertical sidebar */}
        <div className="hidden lg:flex flex-col gap-0.5 bg-adm-surface border border-adm-border rounded-xl p-2 sticky top-20">
          {SECTIONS.map(sec => {
            const active = activeId === sec.id
            const sectionHasLive = sec.live || sec.items?.some(i => i.key)
            return (
              <button
                key={sec.id}
                onClick={() => setActiveId(sec.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-brand-500/10 text-brand-500'
                    : 'text-adm-muted hover:text-adm-text hover:bg-adm-bg'
                }`}
              >
                <sec.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-500' : ''}`} />
                <span className="text-sm font-medium truncate">{sec.label}</span>
                {!sectionHasLive && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-adm-subtle opacity-60">Soon</span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="px-6 py-5 border-b border-adm-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 shrink-0">
                <activeSec.Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-adm-text flex items-center gap-2">
                  {activeSec.label}
                  {showComingSoon && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-adm-subtle border border-adm-border bg-adm-bg rounded px-1.5 py-0.5">
                      Coming soon
                    </span>
                  )}
                </h2>
                <p className="text-xs text-adm-muted mt-0.5">{activeSec.description}</p>
              </div>
            </div>
          </div>

          {/* Section content */}
          <div className="px-6 py-5">
            {activeSec.live
              ? <NotificationToggles initialSettings={initialSettings} />
              : renderGroupedItems(activeSec.items ?? [], activeSec.columns)
            }
          </div>
        </div>
      </div>
    </div>
  )
}
