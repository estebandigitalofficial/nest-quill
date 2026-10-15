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
 * surface="light" (parchment, #fbf9f4, with a 2px oxford/15 top rule that
 * mirrors SiteHeader's bottom rule) because its navy closing section sits
 * directly above the footer and the two blended together. Esteban,
 * 2026-10-15: "footer can stay dark on any screens other than home page".
 *
 * It renders on phones too (stacked and centred, same pieces) so the legal
 * links stay reachable on mobile now that the homepage has no footer of
 * its own. The bottom tab bar is unchanged.
 *
 * The navy surface keeps its original brand image: the admin-configured
 * branding_footer_logo_url, forced to a white silhouette, exactly as
 * before. That silhouette has no legible form on parchment, so the light
 * surface uses SiteHeader's lockup instead (local gold quill mark + serif
 * wordmark).
 */
type Surface = 'dark' | 'light'

const SURFACE: Record<Surface, { footer: string; text: string; brand: string; product: string; link: string }> = {
  dark:  { footer: 'bg-oxford-dark', text: 'text-white/55', brand: 'text-white/90', product: 'text-white/40', link: 'hover:text-white/90' },
  light: { footer: 'bg-parchment border-t-2 border-oxford/15', text: 'text-charcoal-light', brand: 'text-oxford', product: 'text-charcoal-light', link: 'hover:text-oxford' },
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

    <footer className={`${c.footer} py-3 sm:py-4 md:py-[5px] ls:py-2.5 px-5 sm:px-6`}>
      <div className={`max-w-5xl mx-auto flex flex-col items-center gap-2 md:gap-1.5 text-xs sm:text-sm ${c.text} sm:flex-row sm:justify-between`}>
        <div className="flex ls:hidden items-center gap-2 md:gap-1.5 text-left">
          {surface === 'dark'
            ? <Image src={footerLogoUrl} alt="Nest & Quill" width={140} height={42} className="brightness-0 invert w-14 md:w-[100px] shrink-0" />
            : <Image src="/brand/fav.webp" alt="" width={32} height={32} className="w-8 h-8 md:w-7 md:h-7 shrink-0" />}
          <div>
            <p className={`font-serif ${c.brand} font-semibold leading-tight md:text-xs`}>Nest &amp; Quill</p>
            <p className={`text-[11px] mt-0.5 md:text-[10px] ${c.product}`}>{t.footer.product}</p>
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
