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
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function FlagIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  )
}

function BookOpenIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

function FileTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function MailIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function GlobeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function ShieldIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function GridIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

function ChevronDown({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// key links an item to a row in app_settings; absent = not yet wired
type Item = { label: string; hint: string; key?: string }

type SectionDef = {
  id: string
  label: string
  description: string
  Icon: (props: { className?: string }) => React.ReactElement
  live: boolean
  items?: Item[]
}

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email alerts for system events. Settings are per-admin account.',
    Icon: BellIcon,
    live: true,
  },
  {
    id: 'plans',
    label: 'Plans & Limits',
    description: 'Story quotas, tier access controls, and pricing copy displayed to users.',
    Icon: LayersIcon,
    live: false,
    items: [
      { label: 'Guest story limit',     hint: 'Max stories a guest can request before login is required', key: 'guest_story_limit' },
      { label: 'Free user story limit', hint: 'Monthly cap for free-tier accounts',                       key: 'free_user_story_limit' },
      { label: 'Max pages per tier',    hint: 'Page and image ceiling by plan level' },
      { label: 'PDF & dedication access', hint: 'Which plan tiers unlock PDF download and dedication pages' },
      { label: 'Pricing copy',          hint: 'Plan names, taglines, and call-to-action text' },
    ],
  },
  {
    id: 'flags',
    label: 'Feature Flags',
    description: 'Enable or disable product features site-wide without a code deployment.',
    Icon: FlagIcon,
    live: false,
    items: [
      { label: 'Scan Homework',         hint: 'Allow users to upload and scan homework documents',      key: 'scan_homework_enabled' },
      { label: 'Classroom',             hint: 'Show Classroom section and educator flows',               key: 'classroom_enabled' },
      { label: 'Publishing Requests',   hint: 'Enable user-facing publishing request form',              key: 'publishing_requests_enabled' },
      { label: 'Trivia Mode',           hint: 'Enable trivia / quiz mode on completed stories',          key: 'trivia_enabled' },
      { label: 'PDF Download',          hint: 'Allow users to download stories as PDF',                  key: 'pdf_download_enabled' },
      { label: 'Maintenance Mode',      hint: 'Take the site offline and show a maintenance message',    key: 'maintenance_mode_enabled' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning Tool Settings',
    description: 'Configuration for the Learning section — rate limits, modes, and defaults.',
    Icon: BookOpenIcon,
    live: false,
    items: [
      { label: 'Rate limits',              hint: 'Max requests per user per session or day' },
      { label: 'Grade range',              hint: 'Supported grade levels for learning tools' },
      { label: 'Think First mode',         hint: 'Default on/off for Think First prompting',           key: 'think_first_enabled' },
      { label: 'Teach Back mode',          hint: 'Default on/off for Teach Back exercises',             key: 'teach_back_enabled' },
      { label: 'Nudges',                   hint: 'Enable in-session encouragement nudges',              key: 'learning_nudges_enabled' },
      { label: 'Spelling sentence mode',   hint: 'Default mode for spelling sentence generation',       key: 'spelling_sentence_mode_default' },
    ],
  },
  {
    id: 'site-copy',
    label: 'Site Copy',
    description: 'Editable text shown across the public site — headlines, helper text, and limit messages.',
    Icon: FileTextIcon,
    live: false,
    items: [
      { label: 'Homepage headline',   hint: 'Main hero heading and subheadline' },
      { label: 'Pricing copy',        hint: 'Descriptions shown on the pricing page' },
      { label: 'Story helper text',   hint: 'Guidance shown during the story creation wizard' },
      { label: 'Limit messages',      hint: 'Text shown when a user hits a quota or tier limit' },
      { label: 'Classroom copy',      hint: 'Labels, descriptions, and CTAs in the Classroom section' },
    ],
  },
  {
    id: 'email',
    label: 'Email Settings',
    description: 'Transactional email behavior — sender identity, copy, and delivery timing.',
    Icon: MailIcon,
    live: false,
    items: [
      { label: 'Sender name',            hint: 'Display name used in outgoing emails' },
      { label: 'Story ready email copy', hint: 'Subject and body for story completion notifications' },
      { label: 'Admin recipients',       hint: 'Email addresses that receive admin alert emails' },
      { label: 'Drip timing',            hint: 'Delays between automated drip sequence emails' },
    ],
  },
  {
    id: 'publishing',
    label: 'Publishing Settings',
    description: 'Options and copy for the user-facing publishing request flow.',
    Icon: GlobeIcon,
    live: false,
    items: [
      { label: 'Request form options', hint: 'Fields and choices shown on the publishing request form' },
      { label: 'Intent dropdowns',     hint: 'Publishing intent options users can select' },
      { label: 'Status options',       hint: 'Allowed status values for publishing requests' },
      { label: 'Confirmation message', hint: 'Text shown after a publishing request is submitted' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety / Guardrails',
    description: 'Content safety thresholds, input limits, and school-safe mode controls.',
    Icon: ShieldIcon,
    live: false,
    items: [
      { label: 'Strict school-safe mode',  hint: 'Enforce conservative content filtering across all tools', key: 'strict_school_safe_mode' },
      { label: 'Political clarification',  hint: 'Behavior when politically sensitive topics are detected',  key: 'political_clarification_enabled' },
      { label: 'Max pasted text length',   hint: 'Character limit for user-pasted content',                  key: 'max_pasted_text_length' },
      { label: 'Max image upload size (MB)', hint: 'File size ceiling for image uploads',                    key: 'max_image_upload_mb' },
      { label: 'Image uploads per tool',   hint: 'How many images a user can upload per tool session' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Admin Dashboard Settings',
    description: 'Control which cards appear on the admin home dashboard and alert thresholds.',
    Icon: GridIcon,
    live: false,
    items: [
      { label: 'Visible dashboard cards',        hint: 'Which stat cards are shown on the admin home page' },
      { label: 'Stuck-story threshold (minutes)', hint: 'Minutes before a generating story is flagged as stuck', key: 'stuck_story_threshold_minutes' },
      { label: 'Alert thresholds',               hint: 'Error rate or queue depth values that trigger dashboard warnings' },
    ],
  },
]

// ─── Save-state indicator ─────────────────────────────────────────────────────

function SaveDot({ status }: { status: SaveStatus }) {
  if (status === 'idle')   return null
  if (status === 'saving') return <span className="text-[11px] text-adm-muted">Saving…</span>
  if (status === 'saved')  return <span className="text-[11px] text-green-500 font-medium">Saved</span>
  return                          <span className="text-[11px] text-red-400  font-medium">Failed</span>
}

// ─── Boolean toggle row ───────────────────────────────────────────────────────

function BooleanRow({
  settingKey, value, status, label, hint, onSave,
}: {
  settingKey: string
  value: boolean
  status: SaveStatus
  label: string
  hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-adm-text">{label}</p>
        <p className="text-xs text-adm-muted mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <SaveDot status={status} />
        <button
          type="button"
          onClick={() => onSave(settingKey, !value, value)}
          disabled={status === 'saving'}
          aria-pressed={value}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${value ? 'bg-brand-500' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}

// ─── Numeric input row ────────────────────────────────────────────────────────

function NumericRow({
  settingKey, value, status, label, hint, onSave,
}: {
  settingKey: string
  value: number
  status: SaveStatus
  label: string
  hint: string
  onSave: (key: string, next: unknown, prev: unknown) => void
}) {
  const [draft, setDraft] = useState(String(value))

  // Sync if the external value changes (revert on error, or updated externally)
  useEffect(() => { setDraft(String(value)) }, [value])

  function handleBlur() {
    const n = Number(draft)
    if (Number.isFinite(n) && n !== value) {
      onSave(settingKey, n, value)
    } else {
      setDraft(String(value))  // reset if invalid or unchanged
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-adm-text">{label}</p>
        <p className="text-xs text-adm-muted mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <SaveDot status={status} />
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          disabled={status === 'saving'}
          className="w-24 text-center text-sm bg-adm-bg border border-adm-border rounded-lg px-2 py-1.5 text-adm-text focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50"
        />
      </div>
    </div>
  )
}

// ─── Placeholder row (not yet wired to app_settings) ─────────────────────────

function PlaceholderRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 bg-adm-bg border border-adm-border rounded-lg px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-adm-text">{label}</p>
        <p className="text-xs text-adm-muted mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <span className="shrink-0 mt-0.5 text-[10px] font-semibold tracking-wide uppercase text-adm-subtle border border-adm-border rounded px-1.5 py-0.5 whitespace-nowrap">
        Not wired
      </span>
    </div>
  )
}

// ─── Skeleton row shown while app_settings are loading ───────────────────────

function SkeletonRow() {
  return <div className="h-16 bg-adm-bg border border-adm-border rounded-xl animate-pulse" />
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialSettings: Record<string, boolean>
}

export default function SettingsHub({ initialSettings }: Props) {
  const [openMap,    setOpenMap]    = useState<Record<string, boolean>>({ notifications: true })
  const [appSettings, setAppSettings] = useState<Record<string, unknown>>({})
  const [isLoading,  setIsLoading]  = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})

  // Fetch all app_settings once on mount and flatten into key → value map
  useEffect(() => {
    fetch('/api/admin/app-settings')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
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
    setAppSettings(s => ({ ...s, [key]: next }))           // optimistic
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
      setAppSettings(s => ({ ...s, [key]: prev }))         // revert
      setSaveStatus(s => ({ ...s, [key]: 'error' }))
    }
  }

  function renderItems(items: Item[]) {
    return (
      <div className="space-y-2">
        {items.map(item => {
          // No key → always a placeholder
          if (!item.key) {
            return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />
          }

          // Key present but still fetching
          if (isLoading) {
            return <SkeletonRow key={item.label} />
          }

          // Fetch failed — fall back gracefully
          if (loadFailed || !(item.key in appSettings)) {
            return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />
          }

          const value  = appSettings[item.key]
          const status = saveStatus[item.key] ?? 'idle'

          if (typeof value === 'boolean') {
            return (
              <BooleanRow
                key={item.key}
                settingKey={item.key}
                value={value}
                status={status}
                label={item.label}
                hint={item.hint}
                onSave={saveSetting}
              />
            )
          }

          if (typeof value === 'number') {
            return (
              <NumericRow
                key={item.key}
                settingKey={item.key}
                value={value}
                status={status}
                label={item.label}
                hint={item.hint}
                onSave={saveSetting}
              />
            )
          }

          // String or unhandled JSONB type — not wired yet
          return <PlaceholderRow key={item.label} label={item.label} hint={item.hint} />
        })}
      </div>
    )
  }

  function toggleSection(id: string) {
    setOpenMap(m => ({ ...m, [id]: !m[id] }))
  }

  return (
    <div className="space-y-3">
      {SECTIONS.map(sec => {
        const isOpen       = !!openMap[sec.id]
        const hasLiveItems = sec.items?.some(i => i.key) ?? false
        const showComingSoon = !sec.live && !hasLiveItems

        return (
          <div key={sec.id} className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(sec.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-adm-bg transition-colors"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-adm-bg border border-adm-border flex items-center justify-center text-adm-muted">
                <sec.Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-adm-text">{sec.label}</span>
                  {showComingSoon && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-adm-subtle border border-adm-border bg-adm-bg rounded px-1.5 py-0.5">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-adm-muted mt-0.5 leading-relaxed">{sec.description}</p>
              </div>
              <ChevronDown
                className={`shrink-0 w-4 h-4 text-adm-subtle transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-adm-border px-5 py-4">
                {sec.live
                  ? <NotificationToggles initialSettings={initialSettings} />
                  : renderItems(sec.items ?? [])
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
