import type { Metadata } from 'next'
import LegalDocument from '@/components/legal/LegalDocument'
import { getSetting } from '@/lib/settings/appSettings'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n'
import { legal } from '@/lib/i18n/legal'

// Re-read beta_mode_enabled on every request so an admin toggle takes
// effect without a redeploy or page revalidation window.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  return { title: getDictionary(lang).meta.pages.terms }
}

export default async function TermsPage() {
  const [betaMode, lang] = await Promise.all([
    getSetting('beta_mode_enabled', false) as Promise<boolean>,
    getServerLang(),
  ])
  return <LegalDocument doc={legal[lang].terms} betaMode={betaMode} t={getDictionary(lang)} />
}
