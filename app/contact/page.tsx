import Link from 'next/link'

export const metadata = { title: 'Contact — Nest & Quill' }

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-gray-900">
            Nest &amp; Quill
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 space-y-8">
          <div>
            <h1 className="font-serif text-3xl text-gray-900 mb-2">Get in touch</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
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
    <div className="flex gap-4 items-start p-5 rounded-xl border border-gray-100 bg-gray-50">
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="space-y-1 flex-1">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        <div className="pt-1">{action}</div>
      </div>
    </div>
  )
}
