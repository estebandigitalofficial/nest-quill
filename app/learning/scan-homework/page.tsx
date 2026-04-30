import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ScanHomeworkClient from './ScanHomeworkClient'

export const metadata: Metadata = {
  title: 'Scan Homework — Nest & Quill',
  description: 'Take a photo of any homework or worksheet and instantly get flashcards, explanations, study guides, spelling practice, or trivia.',
}

export default function ScanHomeworkPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning</Link>} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl text-oxford">Scan Homework</h1>
            </div>
            <p className="text-sm text-charcoal-light">
              Take a photo of any worksheet, textbook page, or notes — then pick how to study it.
            </p>
          </div>

          <ScanHomeworkClient />

        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
