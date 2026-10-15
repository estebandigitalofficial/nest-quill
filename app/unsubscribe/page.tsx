import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseSuppressionStore, unsubscribeWithToken, type UnsubscribeResult } from '@/lib/email/marketing'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, isLang, LANG_COOKIE, type Lang } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// Public landing for the unsubscribe link in marketing / drip emails.
//
// The signed token in ?t= is verified server-side and the normalized address
// is recorded in marketing_email_suppressions; the page then shows the
// result. It never shows the address, an id, an error detail, or whether the
// address is known. Opening the page again is harmless (idempotent).
//
// Language: the visitor's site language cookie wins when set; otherwise the
// language the email was sent in (carried by the token); otherwise English.

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.unsubscribe, robots: { index: false, follow: false } }
}

interface PageProps {
  searchParams: Promise<{ t?: string | string[] }>
}

async function performUnsubscribe(token: string | undefined): Promise<UnsubscribeResult> {
  if (!token) return { ok: false }
  try {
    return await unsubscribeWithToken(token, {
      store: createSupabaseSuppressionStore(createAdminClient()),
      source: 'unsubscribe_link',
    })
  } catch (err) {
    console.error('Unsubscribe page failed:', err)
    return { ok: false }
  }
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { t: raw } = await searchParams
  const token = Array.isArray(raw) ? raw[0] : raw
  const result = await performUnsubscribe(token)

  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value
  const lang: Lang = isLang(cookieLang) ? cookieLang : result.ok ? result.lang : 'en'
  const t = getDictionary(lang)
  const u = t.unsubscribe

  const title = !result.ok ? u.invalidTitle : result.alreadySuppressed ? u.alreadyTitle : u.successTitle
  const body = !result.ok ? u.invalidBody : result.alreadySuppressed ? u.alreadyBody : u.successBody

  return (
    <div className="min-h-dvh md:h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford whitespace-nowrap">{t.nav.back}</Link>} />

      <div className="flex-1 md:overflow-y-auto">
        <main className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full">
          <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 text-center space-y-3" data-unsubscribe-result={result.ok ? 'ok' : 'invalid'}>
            <p className="text-3xl" aria-hidden="true">{result.ok ? '✉️' : '🔗'}</p>
            <h1 className="font-serif text-2xl text-oxford">{title}</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto leading-relaxed">{body}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              {!result.ok && (
                <Link href="/contact" className="bg-brand-500 hover:bg-brand-600 text-oxford text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
                  {u.contact}
                </Link>
              )}
              <Link href="/" className={result.ok
                ? 'bg-brand-500 hover:bg-brand-600 text-oxford text-sm font-semibold px-6 py-3 rounded-xl transition-colors'
                : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold px-6 py-3 rounded-xl transition-colors'}>
                {u.home}
              </Link>
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
