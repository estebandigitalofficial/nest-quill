import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata = { title: 'Contact — Nest & Quill' }

export default function ContactPage() {
  return (
    <div className="h-screen bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-3xl mx-auto px-6 py-16 w-full">
        <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 space-y-8">
          <div>
            <h1 className="font-serif text-3xl text-oxford mb-2">Get in touch</h1>
            <p className="text-charcoal-light text-sm leading-relaxed">
              Have a question, issue with a story, or just want to say hi? We&apos;d love to hear from you.
            </p>
          </div>

          <div className="space-y-5">
            <ContactCard
              icon="✉️"
              title="Email us"
              description="We typically respond within one business day."
              action={
                <a
                  href="mailto:contact@nestandquill.com"
                  className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  contact@nestandquill.com
                </a>
              }
            />

            <ContactCard
              icon="🐛"
              title="Report a problem"
              description="Story didn't generate? Something looks wrong? Let us know and we'll fix it."
              action={
                <a
                  href="mailto:contact@nestandquill.com?subject=Problem%20report"
                  className="text-sm text-brand-600 font-medium hover:text-brand-700"
                >
                  Send a report →
                </a>
              }
            />

            <ContactCard
              icon="💡"
              title="Feature requests"
              description="Have an idea that would make Nest & Quill better? We're all ears."
              action={
                <a
                  href="mailto:contact@nestandquill.com?subject=Feature%20request"
                  className="text-sm text-brand-600 font-medium hover:text-brand-700"
                >
                  Share your idea →
                </a>
              }
            />
          </div>

          <div className="border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-400 leading-relaxed">
              For billing or account issues, please include your account email in your message so we can
              look things up quickly.
            </p>
          </div>
        </div>
      </main>
      </div>
      <SiteFooter />
    </div>
  )
}

function ContactCard({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex gap-4 items-start p-5 rounded-xl border border-parchment-dark bg-parchment/50">
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="space-y-1 flex-1">
        <p className="font-semibold text-oxford text-sm">{title}</p>
        <p className="text-xs text-charcoal-light leading-relaxed">{description}</p>
        <div className="pt-1">{action}</div>
      </div>
    </div>
  )
}
