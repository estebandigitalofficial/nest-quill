import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ContactForm from './ContactForm'
import { isSettingEnabled } from '@/lib/settings/gates'

export const metadata = { title: 'Contact — Nest & Quill' }
// Re-evaluate the support gate on every request so the admin toggle
// takes effect immediately.
export const dynamic = 'force-dynamic'

// Server component shell. SiteHeader / SiteFooter are async server
// components that read app settings via the admin Supabase client; they
// must NOT be imported into a 'use client' file (it would pull
// SUPABASE_SERVICE_ROLE_KEY into the browser bundle and crash on
// hydration). The interactive form lives in ./ContactForm.
export default async function ContactPage() {
  const supportOpen = await isSettingEnabled('support_tickets_enabled')

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-xl mx-auto px-6 py-16 w-full">
          {supportOpen ? (
            <ContactForm />
          ) : (
            <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 text-center space-y-3">
              <p className="text-3xl">📮</p>
              <h1 className="font-serif text-2xl text-oxford">Support intake is paused</h1>
              <p className="text-sm text-charcoal-light max-w-sm mx-auto">
                We&apos;re catching up on tickets. Please check back shortly — existing requests are still being answered.
              </p>
              <Link href="/" className="inline-block mt-2 text-sm text-brand-600 font-medium hover:text-brand-700">
                Back to home
              </Link>
            </div>
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
