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
import { navLabel } from '@/lib/i18n'

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

  return (
    <header className="sticky top-0 bg-parchment border-b-2 border-oxford/15 shrink-0 z-40">
      {showBanner && (
        <div role="status" aria-live="polite" className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs sm:text-sm px-4 py-2 text-center">
          {maintenanceMessage}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand — quill mark + Source Serif wordmark, matching the homepage. */}
        <Link href="/" className="shrink-0 flex items-center gap-2 font-serif font-bold text-oxford text-xl sm:text-[22px]">
          <Image src="/brand/fav.webp" alt="" width={32} height={32} className="w-8 h-8" priority />
          <span>Nest &amp; Quill</span>
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
          <UserControls />
          <MobileMenu flags={flags} />
        </div>
      </div>
    </header>
  )
}
