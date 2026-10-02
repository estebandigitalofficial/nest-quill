import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { AREA_LABELS, type ProductArea } from '@/lib/launch/scope'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Coming later — Nest & Quill', robots: { index: false } }

const SLUGS: Record<string, ProductArea> = { classroom: 'classroom', homeschool: 'homeschool', learning: 'learningTools', writer: 'writerStudio', publishing: 'publishing' }

/**
 * Launch scope (Phase 2A): the public landing for a deferred product area.
 * ProductGate redirects here so the hidden area's pages never render at all
 * (not even into the page payload). Not gated itself, so there is no loop.
 */
export default async function ComingLaterPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params
  const key = SLUGS[area]
  if (!key) notFound()
  const label = AREA_LABELS[key]
  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Home</Link>} />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md text-center space-y-4">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest">Coming later</p>
          <h1 className="font-serif text-2xl text-oxford">{label} isn&apos;t available yet.</h1>
          <p className="text-sm text-charcoal-light">
            Right now Nest &amp; Quill is all about personalized, illustrated children&apos;s books. {label} will open in a later release.
          </p>
          <Link href="/create" className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors">
            Create a personalized story →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
