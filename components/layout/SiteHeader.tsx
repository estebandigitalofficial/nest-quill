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
  const [flags, headerLogoUrl, maintenanceEnabled, maintenanceMessage, lang] = await Promise.all([
    getLaunchFlags(),
    getSetting('branding_header_logo_url', 'https://nestandquill.b-cdn.net/Nest%20and%20Quill%20Full%20Color.webp'),
    getSetting<boolean>('maintenance_banner_enabled', false),
    getSetting<string>('maintenance_banner_message', ''),
    getServerLang(),
  ])

  // Banner: only renders when admins flip it on AND a non-empty message
  // is configured. Admin pages render their own header so this is
  // naturally absent there.
  const showBanner = maintenanceEnabled === true && typeof maintenanceMessage === 'string' && maintenanceMessage.trim().length > 0

  return (
    <header className="sticky top-0 bg-parchment/95 backdrop-blur border-b border-parchment-dark shrink-0 z-40">
      {showBanner && (
        <div role="status" aria-live="polite" className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs sm:text-sm px-4 py-2 text-center">
          {maintenanceMessage}
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-[58px] md:h-[60px] flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <Image
            src={headerLogoUrl}
            alt="Nest & Quill"
            width={320}
            height={96}
            className="h-16 sm:h-20 w-auto"
            priority
          />
        </Link>

        {/* Launch scope (Phase 2A): links come from lib/launch/scope so hidden
            product areas never appear until their flag is on. Labels follow
            the site language. */}
        <nav className="hidden md:flex items-center gap-4">
          {navLinks(flags).map(l => (
            l.href === '/learning'
              ? <LearningDropdown key={l.href} />
              : <Link key={l.href} href={l.href} className="text-sm text-charcoal-light hover:text-oxford transition-colors whitespace-nowrap">{navLabel(lang, l.href, l.label)}</Link>
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
