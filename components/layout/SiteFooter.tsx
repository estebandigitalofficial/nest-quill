import Image from 'next/image'
import Link from 'next/link'
import { getLaunchFlags } from '@/lib/launch/flags'
import { footerLinks } from '@/lib/launch/scope'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, navLabel, fill } from '@/lib/i18n'
import MobileTabBar from './MobileTabBar'

interface Props {
  /**
   * Render the mobile bottom tab bar (and its spacer) under the footer.
   * Every route except the homepage shows the tab bar; the homepage keeps
   * its own tab-bar decision (a separate approved task) and passes false.
   */
  tabBar?: boolean
}

/**
 * The one public footer (2026-10-15 footer standardization).
 *
 * This is the original compact horizontal bar: brand on the left, copyright
 * in the centre, launch-scoped links on the right, a few pixels tall on
 * desktop. Two things changed from the original:
 *  - background is the site's cream (bg-parchment) instead of navy, because
 *    several pages (homepage closing CTA, pricing) end in a navy section and
 *    a navy footer blended into it;
 *  - the brand is the gold quill mark + serif wordmark used by the header
 *    (the old CDN logo was a white-inverted asset for the dark bar), with the
 *    operator line "Operated by Digital Official & Huerta Group".
 *
 * Below md the same markup stacks: brand, links (wrapping), copyright. It is
 * never hidden on mobile any more; the tab bar sits under it. The right-hand
 * gutter below md keeps the content clear of the fixed ChatWidget button
 * (76px wide, 120px from sm), which sits just above the tab bar.
 */
export default async function SiteFooter({ tabBar = true }: Props = {}) {
  const [flags, lang] = await Promise.all([getLaunchFlags(), getServerLang()])
  const t = getDictionary(lang)
  const year = new Date().getFullYear()
  return (
    <>
    {/* Mobile bottom tab bar */}
    {tabBar && <MobileTabBar flags={flags} />}

    <footer className="bg-parchment border-t-2 border-oxford/15 pl-5 pr-24 sm:pl-6 sm:pr-32 md:pr-6 py-3 md:py-[5px] ls:py-2 text-xs text-charcoal-light">
      <div className="max-w-5xl mx-auto flex flex-col items-start gap-2 text-left md:flex-row md:items-center md:justify-between md:gap-4">
        {/* Brand: gold quill (the site's decorative feather) + wordmark + operator line */}
        <Link href="/" className="flex items-center gap-2 ls:hidden shrink-0">
          <Image src="/brand/fav.webp" alt="" width={32} height={32} className="w-7 h-7 md:w-6 md:h-6" />
          <span className="text-left">
            <span className="block font-serif font-bold text-oxford text-sm md:text-xs leading-tight">Nest &amp; Quill</span>
            <span className="block text-[11px] md:text-[10px] text-charcoal-light leading-tight mt-0.5">{t.footer.product}</span>
          </span>
        </Link>
        <p className="order-last md:order-none md:text-sm">{fill(t.footer.copyright, { year })}</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-3 gap-y-1 md:text-sm md:whitespace-nowrap">
          {/* Launch scope (Phase 2A): gated link set from lib/launch/scope */}
          {footerLinks(flags).map(l => (
            <Link key={l.href} href={l.href} className="hover:text-oxford transition-colors">{navLabel(lang, l.href, l.label)}</Link>
          ))}
        </nav>
      </div>
    </footer>

    {/* Spacer so the footer isn't hidden behind the fixed tab bar on mobile */}
    {tabBar && <div className="h-14 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />}
    </>
  )
}
