import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Page not found' }

export default async function NotFound() {
  const lang = await getServerLang()
  const n = getDictionary(lang).notFound
  return (
    <div className="h-dvh bg-parchment flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-4xl text-oxford mb-3">{n.title}</h1>
      <p className="text-charcoal-light text-sm max-w-xs leading-relaxed mb-8">{n.body}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          {n.home}
        </Link>
        <Link
          href="/create"
          className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          {n.create}
        </Link>
      </div>
    </div>
  )
}
