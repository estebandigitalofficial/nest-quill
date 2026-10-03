import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { AREA_LABELS, type ProductArea } from '@/lib/launch/scope'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, fill } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.comingLater, robots: { index: false } }
}

const SLUGS: Record<string, ProductArea> = { classroom: 'classroom', homeschool: 'homeschool', learning: 'learningTools', writer: 'writerStudio', publishing: 'publishing' }

/**
 * Launch scope (Phase 2A): the public landing for a deferred product area.
 * ProductGate redirects here so the hidden area's pages never render at all.
 */
export default async function ComingLaterPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params
  const key = SLUGS[area]
  if (!key) notFound()
  const lang = await getServerLang()
  const t = getDictionary(lang)
  const label = t.comingLater.areas[key] ?? AREA_LABELS[key]
  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford whitespace-nowrap">{t.nav.backHome}</Link>} />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md text-center space-y-4">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">{t.comingLater.label}</p>
          <h1 className="font-serif text-2xl text-oxford">{fill(t.comingLater.title, { area: label })}</h1>
          <p className="text-sm text-charcoal-light">{fill(t.comingLater.body, { area: label })}</p>
          <Link href="/create" className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors">
            {t.comingLater.cta}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
