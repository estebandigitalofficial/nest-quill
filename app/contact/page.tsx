import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ContactForm from './ContactForm'

export const metadata = { title: 'Contact — Nest & Quill' }

// Server component shell. SiteHeader / SiteFooter are async server
// components that read app settings via the admin Supabase client; they
// must NOT be imported into a 'use client' file (it would pull
// SUPABASE_SERVICE_ROLE_KEY into the browser bundle and crash on
// hydration). The interactive form lives in ./ContactForm.
export default function ContactPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-xl mx-auto px-6 py-16 w-full">
          <ContactForm />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
