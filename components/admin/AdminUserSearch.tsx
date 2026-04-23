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
      className="w-full sm:max-w-sm bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
    />
  )
}
