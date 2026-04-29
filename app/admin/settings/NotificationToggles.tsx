'use client'

import { useState } from 'react'
import type { AdminNotificationType } from '@/lib/services/adminNotifications'

const NOTIFICATION_TYPES: { id: AdminNotificationType; label: string; desc: string; defaultOn: boolean }[] = [
  { id: 'story_completed',          label: 'Story Completed',       desc: 'A story finishes generating successfully',   defaultOn: true  },
  { id: 'story_failed',             label: 'Story Failed',          desc: 'A story fails during generation',            defaultOn: true  },
  { id: 'new_user_signed_up',       label: 'New User Signed Up',    desc: 'A new account is created',                  defaultOn: false },
  { id: 'new_guest_story_submitted','label': 'Guest Story Submitted', desc: 'A guest submits a story without an account', defaultOn: false },
  { id: 'new_classroom_created',    label: 'New Classroom Created', desc: 'An educator creates a new classroom',        defaultOn: false },
  { id: 'assignment_completed',     label: 'Assignment Completed',  desc: 'A student completes a classroom assignment', defaultOn: false },
]

interface Props {
  initialSettings: Record<string, boolean>
}

export default function NotificationToggles({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Record<string, boolean>>(initialSettings)
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  async function toggle(type: AdminNotificationType) {
    const next = !settings[type]
    setSettings(s => ({ ...s, [type]: next }))
    setSaving(type)
    setErrors(e => ({ ...e, [type]: false }))

    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_type: type, enabled: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setSettings(s => ({ ...s, [type]: !next }))
      setErrors(e => ({ ...e, [type]: true }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      {NOTIFICATION_TYPES.map(({ id, label, desc }) => {
        const enabled = settings[id] ?? false
        const isSaving = saving === id
        const hasError = errors[id]

        return (
          <div key={id} className="flex items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-100">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              {hasError && <p className="text-xs text-red-400 mt-1">Failed to save — try again</p>}
            </div>
            <button
              onClick={() => toggle(id)}
              disabled={isSaving}
              aria-pressed={enabled}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${enabled ? 'bg-brand-500' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
