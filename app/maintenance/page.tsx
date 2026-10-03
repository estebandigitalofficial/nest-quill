import type { Metadata } from 'next'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.maintenance }
}

export default async function MaintenancePage() {
  const lang = await getServerLang()
  const m = getDictionary(lang).maintenance
  return (
    <div className="h-dvh bg-parchment flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-4xl">🔧</p>
        <h1 className="font-serif text-2xl text-oxford">{m.title}</h1>
        <p className="text-sm text-charcoal-light leading-relaxed">{m.body}</p>
      </div>
    </div>
  )
}
