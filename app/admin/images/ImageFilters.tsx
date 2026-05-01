'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export default function ImageFilters({
  styles,
}: {
  styles: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`/admin/images?${params.toString()}`)
    })
  }

  return (
    <div className={`flex gap-3 flex-wrap items-center ${isPending ? 'opacity-60' : ''}`}>
      <select
        className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none"
        value={searchParams.get('style') ?? ''}
        onChange={(e) => update('style', e.target.value)}
      >
        <option value="">All styles</option>
        {styles.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Search theme..."
        className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none w-40"
        defaultValue={searchParams.get('theme') ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Enter') update('theme', (e.target as HTMLInputElement).value)
        }}
      />

      <input
        type="text"
        placeholder="Search tags..."
        className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none w-40"
        defaultValue={searchParams.get('tags') ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Enter') update('tags', (e.target as HTMLInputElement).value)
        }}
      />

      <input
        type="date"
        className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none"
        value={searchParams.get('from') ?? ''}
        onChange={(e) => update('from', e.target.value)}
      />
      <span className="text-xs text-adm-subtle">to</span>
      <input
        type="date"
        className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none"
        value={searchParams.get('to') ?? ''}
        onChange={(e) => update('to', e.target.value)}
      />
    </div>
  )
}
