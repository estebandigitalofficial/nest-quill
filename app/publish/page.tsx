import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = { title: 'Publish Your Book — Nest & Quill' }

export default async function PublishPage() {
  const publishingEnabled = await getSetting('publishing_requests_enabled', false)

  if (!publishingEnabled) {
    return (
      <div className="h-dvh bg-parchment flex flex-col">
        <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Home</Link>} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-4">
            <p className="text-4xl">📖</p>
            <h1 className="font-serif text-2xl text-oxford">Publishing is unavailable</h1>
            <p className="text-sm text-charcoal-light leading-relaxed">
              The publishing request feature is not available right now. Check back soon.
            </p>
            <Link
              href="/"
              className="inline-block mt-2 bg-oxford hover:bg-oxford-light text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/account" className="text-sm text-charcoal-light hover:text-oxford">← My Stories</Link>} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">📬</p>
          <h1 className="font-serif text-2xl text-oxford">Publish Your Book</h1>
          <p className="text-sm text-charcoal-light leading-relaxed">
            Publishing requests are coming soon. We&apos;ll let you know when you can order a printed copy of your story.
          </p>
          <Link
            href="/account"
            className="inline-block mt-2 bg-oxford hover:bg-oxford-light text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            ← Back to My Stories
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
