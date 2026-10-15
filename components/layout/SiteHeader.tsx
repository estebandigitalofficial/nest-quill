import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LearningDropdown from './LearningDropdown'
import MobileMenu from './MobileMenu'
import UserControls from './UserControls'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { getSetting } from '@/lib/settings/appSettings'
import { getLaunchFlags } from '@/lib/launch/flags'
import { navLinks } from '@/lib/launch/scope'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, navLabel } from '@/lib/i18n'

interface Props {
  right?: ReactNode
}

export default async function SiteHeader({ right }: Props) {
  // Note: we deliberately don't fetch the auth user here. SiteHeader is
  // rendered by server pages only; UserControls fetches the user itself.
  const [flags, maintenanceEnabled, maintenanceMessage, lang] = await Promise.all([
    getLaunchFlags(),
    getSetting<boolean>('maintenance_banner_enabled', false),
    getSetting<string>('maintenance_banner_message', ''),
    getServerLang(),
  ])

  const showBanner = maintenanceEnabled === true && typeof maintenanceMessage === 'string' && maintenanceMessage.trim().length > 0
  const t = getDictionary(lang)

  return (
    <header className="sticky top-0 bg-parchment border-b-2 border-oxford/15 shrink-0 z-40">
      {showBanner && (
        <div role="status" aria-live="polite" className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs sm:text-sm px-4 py-2 text-center">
          {maintenanceMessage}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand: the same full-colour Nest & Quill graphic the footer shows
            on its light surface (public/brand/logo.webp), as the Home link.
            The file is an 800px square whose artwork (nest, quill and the
            wordmark) sits in a 705x425 band with transparent padding above
            and below; object-cover inside a 5:3 box trims that padding so
            the artwork reads at full size inside the 60px header without
            distorting it. Branding only (Esteban, 2026-10-15): nav, auth
            and language controls are untouched. */}
        <Link href="/" aria-label={`Nest & Quill — ${t.nav.home}`} className="shrink-0 block h-12 w-20 sm:h-[52px] sm:w-[87px]">
          <Image src="/brand/logo.webp" alt="Nest & Quill" width={800} height={800} className="h-full w-full object-cover" priority />
        </Link>

        {/* Launch-scoped nav. Homepage typography (serif brand, semibold links). */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks(flags).map(l => (
            l.href === '/learning'
              ? <LearningDropdown key={l.href} />
              : <Link key={l.href} href={l.href} className="px-3 py-2 text-sm font-semibold text-oxford hover:text-brand-600 transition-colors whitespace-nowrap">{navLabel(lang, l.href, l.label)}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {right && <div className="flex items-center gap-2 sm:gap-4 min-w-0">{right}</div>}
          <LanguageSwitcher className="shrink-0" />
          <UserControls flags={flags} />
          <MobileMenu flags={flags} />
        </div>
      </div>
    </header>
  )
}
