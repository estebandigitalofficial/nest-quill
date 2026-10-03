import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { LEGAL_CONTACT, type LegalDoc, type LegalSection } from '@/lib/i18n/legal'
import type { Dictionary } from '@/lib/i18n'

/**
 * Renders a Terms / Privacy document from lib/i18n/legal.ts. Beta-only
 * sections and bullets appear only while Beta Mode is on, exactly as the
 * original JSX did.
 */
export default function LegalDocument({ doc, betaMode, t }: { doc: LegalDoc; betaMode: boolean; t: Dictionary }) {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford whitespace-nowrap">{t.nav.back}</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14 space-y-8 sm:space-y-10 w-full">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">{doc.title}</h1>
          <p className="text-sm text-charcoal-light">{doc.updated}</p>
          <p className="text-sm text-charcoal-light mt-1">{doc.operator}</p>
        </div>

        {doc.sections.filter(s => !s.beta || betaMode).map(section => (
          <Section key={section.title} section={section} betaMode={betaMode} />
        ))}
      </main>
      </div>
      <SiteFooter />
    </div>
  )
}

function Section({ section, betaMode }: { section: LegalSection; betaMode: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl text-oxford">{section.title}</h2>
      <div className="text-sm text-charcoal leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-brand-600 [&_a]:hover:text-brand-700 [&_a]:break-all">
        {section.blocks.map((block, i) => {
          if ('p' in block) return <p key={i}>{block.p}</p>
          if ('strong' in block) return <p key={i}><strong>{block.strong}</strong></p>
          if ('contact' in block) {
            return (
              <p key={i}>
                {block.contact}{' '}
                <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.
              </p>
            )
          }
          const items = betaMode && section.betaBullet && i === 0 ? [block.ul[0], section.betaBullet, ...block.ul.slice(1)] : block.ul
          return (
            <ul key={i}>
              {items.map(item => <li key={item}>{item}</li>)}
            </ul>
          )
        })}
      </div>
    </section>
  )
}
