'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'Queued' },
  { value: 'generating_text', label: 'Writing' },
  { value: 'generating_images', label: 'Illustrating' },
  { value: 'assembling_pdf', label: 'Assembling' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
]

export default function AdminFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [searchParams, router, pathname])

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <input
        type="search"
        placeholder="Search by email or child name…"
        defaultValue={q}
        onChange={e => update('q', e.target.value)}
        className="flex-1 bg-adm-surface border border-adm-border rounded-xl px-4 py-2.5 text-sm text-adm-text placeholder:text-adm-subtle focus:outline-none focus:border-brand-500 transition-colors"
      />
      <select
        defaultValue={status}
        onChange={e => update('status', e.target.value)}
        className="bg-adm-surface border border-adm-border rounded-xl px-4 py-2.5 text-sm text-adm-text focus:outline-none focus:border-brand-500 transition-colors"
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
