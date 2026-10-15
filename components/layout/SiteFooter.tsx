import Image from 'next/image'
import Link from 'next/link'
import { getSetting } from '@/lib/settings/appSettings'
import { getLaunchFlags } from '@/lib/launch/flags'
import { footerLinks } from '@/lib/launch/scope'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, navLabel, fill } from '@/lib/i18n'
import MobileTabBar from './MobileTabBar'

/**
 * The one public footer (founder decision, 2026-10-15).
 *
 * This is the compact horizontal footer that /privacy, /terms, /pricing,
 * /contact and /create always rendered: brand lockup on the left, copyright
 * in the middle, the launch-scoped links on the right, one row tall on
 * desktop. It is now the canonical footer for every public route; the
 * homepage's tall multi-column footer (ModernHome, PR #12/#14) was retired
 * in favour of it.
 *
 * Surface: navy (the original) by default. The homepage passes
 * surface="light" (parchment, #fbf9f4) because its navy closing section
 * sits directly above the footer and the two blended together. Esteban,
 * 2026-10-15: "footer can stay dark on any screens other than home page"
 * and "home page footer needs to be the same as footer for all other
 * pages, just the cream color and not navy": identical markup and
 * dimensions, only the colours differ.
 *
 * It renders on phones too (stacked and centred, same pieces) so the legal
 * links stay reachable on mobile now that the homepage has no footer of
 * its own. The bottom tab bar is unchanged.
 *
 * Scale is the original's: a 100px brand logo beside the wordmark and
 * operator line, about 110px tall on desktop (Esteban, 2026-10-15: "not a
 * 50px utility bar"). The navy surface keeps its original brand image, the
 * admin-configured branding_footer_logo_url forced to a white silhouette.
 * That silhouette has no legible form on parchment, so the light surface
 * shows the full-colour local logo (public/brand/logo.webp) at the same
 * size. Phones get the same lockup at 80px.
 */
type Surface = 'dark' | 'light'

const SURFACE: Record<Surface, { footer: string; text: string; brand: string; product: string; link: string }> = {
  dark:  { footer: 'bg-oxford-dark', text: 'text-white/55', brand: 'text-white/90', product: 'text-white/40', link: 'hover:text-white/90' },
  light: { footer: 'bg-parchment', text: 'text-charcoal-light', brand: 'text-oxford', product: 'text-charcoal-light', link: 'hover:text-oxford' },
}

export default async function SiteFooter({ tabBar = true, surface = 'dark' }: { tabBar?: boolean; surface?: Surface }) {
  const [flags, footerLogoUrl, lang] = await Promise.all([
    getLaunchFlags(),
    getSetting('branding_footer_logo_url', 'https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp'),
    getServerLang(),
  ])
  const t = getDictionary(lang)
  const c = SURFACE[surface]
  return (
    <>
    {/* Mobile bottom tab bar (fixed). Not rendered on the homepage. */}
    {tabBar && <MobileTabBar flags={flags} />}

    <footer className={`${c.footer} py-4 md:py-2 ls:py-2 px-5 sm:px-6`}>
      <div className={`max-w-5xl mx-auto flex flex-col items-center gap-3 md:gap-2 text-xs sm:text-sm ${c.text} sm:flex-row sm:justify-between`}>
        {/* Brand lockup at the original scale: 100px logo beside the wordmark and operator line. */}
        <div className="flex ls:hidden items-center gap-3 text-left">
          {surface === 'dark'
            ? <Image src={footerLogoUrl} alt="Nest & Quill" width={100} height={100} className="brightness-0 invert w-20 md:w-[100px] h-auto shrink-0" />
            : <Image src="/brand/logo.webp" alt="Nest & Quill" width={100} height={100} className="w-20 md:w-[100px] h-auto shrink-0" />}
          <div>
            <p className={`font-serif ${c.brand} font-semibold text-base leading-tight`}>Nest &amp; Quill</p>
            <p className={`text-xs mt-0.5 ${c.product}`}>{t.footer.product}</p>
          </div>
        </div>
        <p className="order-last sm:order-none text-center">{fill(t.footer.copyright, { year: new Date().getFullYear() })}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 whitespace-nowrap">
          {/* Launch scope (Phase 2A): gated link set from lib/launch/scope */}
          {footerLinks(flags).map(l => (
            <Link key={l.href} href={l.href} className={`${c.link} transition-colors`}>{navLabel(lang, l.href, l.label)}</Link>
          ))}
        </div>
      </div>
    </footer>

    {/* Spacer so the fixed tab bar never covers the footer on phones. */}
    {tabBar && <div className="h-14 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />}
    </>
  )
}
