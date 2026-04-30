'use client'

import { useState } from 'react'
import Link from 'next/link'

interface UserDetailData {
  profile: Record<string, unknown>
  stories: {
    id: string
    child_name: string
    story_theme: string
    status: string
    created_at: string
    genre: string | null
    illustration_style: string
  }[]
  deliveryLogs: {
    id: string
    email_type: string | null
    status: string
    created_at: string
    request_id: string
  }[]
  dripLogs: {
    id: string
    sequence: string
    step: number
    created_at: string
  }[]
}

export default function UserDetailPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function load() {
    if (data) {
      setOpen(!open)
      return
    }
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={load}
        className="text-xs text-brand-400 hover:text-brand-300 font-medium whitespace-nowrap"
      >
        {open ? 'Hide details' : 'Details →'}
      </button>

      {open && (
        <div className="mt-3 bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-4">
          {loading ? (
            <p className="text-xs text-gray-500">Loading...</p>
          ) : data ? (
            <>
              {/* Stories */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Stories ({data.stories.length})
                </p>
                {data.stories.length === 0 ? (
                  <p className="text-xs text-gray-600">No stories.</p>
                ) : (
                  <div className="space-y-1">
                    {data.stories.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 text-xs">
                        <StatusDot status={s.status} />
                        <span className="text-gray-300 truncate flex-1">{s.child_name} — {s.story_theme}</span>
                        <span className="text-gray-600 shrink-0">{s.genre ?? ''}</span>
                        <span className="text-gray-600 shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
                        <Link href={`/admin/stories/${s.id}`} className="text-brand-400 hover:text-brand-300 shrink-0">View</Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email History */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Email History ({data.deliveryLogs.length})
                </p>
                {data.deliveryLogs.length === 0 ? (
                  <p className="text-xs text-gray-600">No emails sent.</p>
                ) : (
                  <div className="space-y-1">
                    {data.deliveryLogs.slice(0, 10).map((l) => (
                      <div key={l.id} className="flex items-center gap-3 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-gray-400 font-mono">{l.email_type ?? 'story_ready'}</span>
                        <span className="text-gray-600 flex-1">{new Date(l.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drip Progress */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Drip Progress
                </p>
                {data.dripLogs.length === 0 ? (
                  <p className="text-xs text-gray-600">No drip emails sent yet.</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {data.dripLogs.map((d) => (
                      <span key={d.id} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {d.sequence} step {d.step}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'complete' ? 'bg-green-400' : status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
}
