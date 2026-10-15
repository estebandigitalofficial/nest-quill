import Image from 'next/image'
import Link from 'next/link'
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
 * Two deliberate changes from the navy original:
 *  - Surface: parchment (#fbf9f4, the homepage's --bg) with a 2px
 *    oxford/15 top rule that mirrors SiteHeader's bottom rule. A navy
 *    footer blended into a navy closing section right above it.
 *  - It renders on phones too (stacked and centred, same pieces) so the
 *    legal links stay reachable on mobile now that the homepage no longer
 *    has its own footer. The bottom tab bar is unchanged.
 *
 * The brand lockup reuses SiteHeader's: the local quill mark plus the serif
 * wordmark. The old white-silhouette CDN logo only worked on a dark
 * background.
 */
export default async function SiteFooter({ tabBar = true }: { tabBar?: boolean }) {
  const [flags, lang] = await Promise.all([getLaunchFlags(), getServerLang()])
  const t = getDictionary(lang)
  return (
    <>
    {/* Mobile bottom tab bar (fixed). Not rendered on the homepage. */}
    {tabBar && <MobileTabBar flags={flags} />}

    <footer className="bg-parchment border-t-2 border-oxford/15 py-3 sm:py-4 md:py-[5px] ls:py-2.5 px-5 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 md:gap-1.5 text-xs sm:text-sm text-charcoal-light sm:flex-row sm:justify-between">
        <div className="flex ls:hidden items-center gap-2 md:gap-1.5 text-left">
          <Image src="/brand/fav.webp" alt="" width={32} height={32} className="w-8 h-8 md:w-7 md:h-7 shrink-0" />
          <div>
            <p className="font-serif text-oxford font-semibold leading-tight md:text-xs">Nest &amp; Quill</p>
            <p className="text-[11px] mt-0.5 md:text-[10px]">{t.footer.product}</p>
          </div>
        </div>
        <p className="order-last sm:order-none text-center">{fill(t.footer.copyright, { year: new Date().getFullYear() })}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 whitespace-nowrap">
          {/* Launch scope (Phase 2A): gated link set from lib/launch/scope */}
          {footerLinks(flags).map(l => (
            <Link key={l.href} href={l.href} className="hover:text-oxford transition-colors">{navLabel(lang, l.href, l.label)}</Link>
          ))}
        </div>
      </div>
    </footer>

    {/* Spacer so the fixed tab bar never covers the footer on phones. */}
    {tabBar && <div className="h-14 md:hidden bg-parchment" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />}
    </>
  )
}
