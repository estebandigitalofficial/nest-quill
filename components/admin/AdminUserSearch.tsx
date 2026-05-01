'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'

export default function AdminUserSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  return (
    <input
      type="search"
      placeholder="Search by email…"
      defaultValue={defaultValue}
      onChange={e => {
        const val = e.target.value
        startTransition(() => {
          router.push(val ? `${pathname}?q=${encodeURIComponent(val)}` : pathname)
        })
      }}
      className="w-full sm:max-w-sm bg-adm-surface border border-adm-border rounded-xl px-4 py-2.5 text-sm text-adm-text placeholder:text-adm-subtle focus:outline-none focus:border-brand-500 transition-colors"
    />
  )
}
