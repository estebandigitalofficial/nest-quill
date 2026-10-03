import type { Metadata } from 'next'
import Link from 'next/link'
import { WIZARD_PLANS } from '@/lib/plans/config'
import { getLaunchFlags } from '@/lib/launch/flags'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PlanCard from '@/components/pricing/PlanCard'
import { getSetting } from '@/lib/settings/appSettings'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.pricing }
}

export default async function PricingPage() {
  const [betaMode, imagesPaused, flags, lang] = await Promise.all([
    getSetting('beta_mode_enabled', false) as Promise<boolean>,
    getSetting<unknown>('image_generation_enabled', true).then(v => v === false),
    getLaunchFlags(),
    getServerLang(),
  ])
  const t = getDictionary(lang)
  const p = t.pricing

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford whitespace-nowrap">{t.nav.back}</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-12 sm:space-y-14 w-full">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-4xl sm:text-5xl text-oxford">{p.title}</h1>
          <p className="text-charcoal-light max-w-md mx-auto">
            {betaMode ? (imagesPaused ? p.betaSubPaused : p.betaSub) : p.steadySub}
          </p>
        </div>

        {/* Plan cards — shared with the homepage so copy can't drift. */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WIZARD_PLANS.map((tier) => (
            <PlanCard key={tier} tier={tier} betaMode={betaMode} lang={lang} />
          ))}
        </div>

        {/* Classroom callout — launch scope (Phase 2A): only while Classroom is public.
            Hidden-product copy stays English; it never renders while the flag is off. */}
        {flags.classroom && (
        <div className="bg-oxford rounded-2xl px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-brand-300 uppercase tracking-widest mb-1">For Educators</p>
              <h3 className="font-serif text-xl text-white mb-1">Free classroom tools for teachers.</h3>
              <p className="text-sm text-parchment/70 max-w-md">
                Assign quizzes, flashcards, and study guides to your class. Track completions and scores in real time. No paid plan required — free for teachers, always.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Link href="/classroom" className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors whitespace-nowrap">
              Try Classroom free →
            </Link>
          </div>
        </div>
        )}

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-serif text-2xl text-oxford text-center">{p.faq.title}</h2>
          <div className="space-y-4">
            {p.faq.items.map((item) => (
              <div key={item.q} className="border-b border-parchment-dark pb-4">
                <p className="font-medium text-oxford text-sm mb-1">{item.q}</p>
                <p className="text-sm text-charcoal-light leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      </div>
      <SiteFooter />
    </div>
  )
}
