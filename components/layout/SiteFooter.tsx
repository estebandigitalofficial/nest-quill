import Image from 'next/image'
import Link from 'next/link'
import { getSetting } from '@/lib/settings/appSettings'
import { getLaunchFlags } from '@/lib/launch/flags'
import { footerLinks } from '@/lib/launch/scope'
import MobileTabBar from './MobileTabBar'

export default async function SiteFooter() {
  const [flags, footerLogoUrl] = await Promise.all([
    getLaunchFlags(),
    getSetting('branding_footer_logo_url', 'https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp'),
  ])
  return (
    <>
    {/* Mobile bottom tab bar */}
    <MobileTabBar flags={flags} />
    {/* Spacer so content isn't hidden behind the tab bar on mobile */}
    <div className="h-14 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />

    <footer className="hidden md:block bg-oxford-dark py-4 sm:py-5 md:py-[5px] ls:py-2.5 px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 md:gap-1.5 text-xs sm:text-sm text-white/55 sm:flex-row sm:justify-between">
        {/* Brand block — hidden on portrait mobile and landscape phones */}
        <div className="hidden sm:flex ls:hidden items-center gap-2 md:gap-1.5 text-left">
          <Image
            src={footerLogoUrl}
            alt="Nest & Quill"
            width={140}
            height={42}
            className="brightness-0 invert md:w-[100px]"
          />
          <div>
            <p className="font-serif text-white/90 font-semibold md:text-xs">Nest &amp; Quill</p>
            <p className="text-xs text-white/40 mt-0.5 md:text-[10px]">A product of Bright Tale Books</p>
          </div>
        </div>
        <p className="order-first sm:order-none">© {new Date().getFullYear()} Bright Tale Books</p>
        <div className="flex items-center justify-center gap-3 md:gap-3 whitespace-nowrap">
          {/* Launch scope (Phase 2A): gated link set from lib/launch/scope */}
          {footerLinks(flags).map(l => (
            <Link key={l.href} href={l.href} className="hover:text-white/90 transition-colors">{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
    </>
  )
}
