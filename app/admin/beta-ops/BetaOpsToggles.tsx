'use client'

// Live toggles for the beta-ops control room. Boolean keys render as
// switches; string keys render as a single inline text input. Every
// change PATCHes /api/admin/app-settings and reflects optimistically.
// Failures revert the local value and surface a small inline error.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type AnyValue = boolean | string | number | null | unknown

interface SettingRow {
  key: string
  label: string
  value: AnyValue
}

// Which toggles are wired all the way through to enforcement today.
// Anything not in this set is shown with a "Display only" badge so the
// admin knows at a glance that flipping it won't change app behavior
// yet. Update as new gates ship.
const ENFORCED_KEYS = new Set([
  'beta_mode_enabled',
  'story_creation_enabled',
  'guest_story_creation_enabled',
  'learning_tools_enabled',
  'image_generation_enabled',
  'support_tickets_enabled',
  'guided_tours_enabled',
  'maintenance_banner_enabled',
  'maintenance_banner_message',
])

export default function BetaOpsToggles({ initial }: { initial: SettingRow[] }) {
  const [rows, setRows] = useState<SettingRow[]>(initial)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function patch(key: string, value: AnyValue) {
    setErrorKey(null)
    const res = await fetch('/api/admin/app-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErrorKey(`${key}: ${j.error ?? 'failed'}`)
      return false
    }
    return true
  }

  async function setBool(key: string, next: boolean) {
    const before = rows
    setRows(rs => rs.map(r => r.key === key ? { ...r, value: next } : r))
    const ok = await patch(key, next)
    if (!ok) {
      setRows(before)
      return
    }
    startTransition(() => router.refresh())
  }

  async function setText(key: string, next: string) {
    const before = rows
    setRows(rs => rs.map(r => r.key === key ? { ...r, value: next } : r))
    const ok = await patch(key, next)
    if (!ok) setRows(before)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm divide-y divide-white/5">
      {rows.map(row => {
        const isBool = typeof row.value === 'boolean'
        const isText = typeof row.value === 'string'
        return (
          <div key={row.key} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-white">{row.label}</p>
                {ENFORCED_KEYS.has(row.key) ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Enforced</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-adm-muted border border-white/10">Display</span>
                )}
              </div>
              <p className="text-[11px] text-adm-subtle font-mono mt-0.5">{row.key}</p>
            </div>
            {isBool && (
              <Toggle on={row.value as boolean} onChange={(next) => setBool(row.key, next)} />
            )}
            {isText && (
              <input
                type="text"
                defaultValue={row.value as string}
                onBlur={(e) => setText(row.key, e.target.value)}
                className="w-64 max-w-[60%] bg-adm-bg border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            )}
            {!isBool && !isText && (
              <span className="text-[11px] text-adm-subtle">edit in /admin/settings</span>
            )}
          </div>
        )
      })}
      {errorKey && (
        <p className="px-4 py-2 text-xs text-rose-300 bg-rose-500/10 border-t border-rose-500/30">{errorKey}</p>
      )}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-white/10'}`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}
