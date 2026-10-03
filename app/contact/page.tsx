import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ContactForm from './ContactForm'
import { isSettingEnabled } from '@/lib/settings/gates'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.contact }
}

// Server component shell. The interactive form lives in ./ContactForm.
export default async function ContactPage() {
  const [supportOpen, lang] = await Promise.all([isSettingEnabled('support_tickets_enabled'), getServerLang()])
  const t = getDictionary(lang)
  const c = t.contact

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford whitespace-nowrap">{t.nav.back}</Link>} />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full">
          {supportOpen ? (
            <ContactForm />
          ) : (
            <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 text-center space-y-3">
              <p className="text-3xl">📮</p>
              <h1 className="font-serif text-2xl text-oxford">{c.pausedTitle}</h1>
              <p className="text-sm text-charcoal-light max-w-sm mx-auto">{c.pausedBody}</p>
              <Link href="/" className="inline-block mt-2 text-sm text-brand-600 font-medium hover:text-brand-700">
                {c.backHome}
              </Link>
            </div>
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
