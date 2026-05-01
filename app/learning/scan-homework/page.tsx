import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ScanHomeworkClient from './ScanHomeworkClient'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = {
  title: 'Scan Homework — Nest & Quill',
  description: 'Take a photo of any homework or worksheet and instantly get flashcards, explanations, study guides, spelling practice, or trivia.',
}

export default async function ScanHomeworkPage() {
  const [enabled, triviaEnabled, thinkFirstEnabled, teachBackEnabled, nudgesEnabled] = await Promise.all([
    getSetting('scan_homework_enabled', true),
    getSetting('trivia_enabled', true),
    getSetting('think_first_enabled', true),
    getSetting('teach_back_enabled', true),
    getSetting('learning_nudges_enabled', true),
  ])

  if (!enabled) {
    return (
      <div className="h-dvh bg-parchment flex flex-col">
        <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning</Link>} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-4">
            <p className="text-4xl">📚</p>
            <h1 className="font-serif text-2xl text-oxford">Scan Homework is unavailable</h1>
            <p className="text-sm text-charcoal-light leading-relaxed">
              This tool is temporarily disabled. Check back soon, or try one of the other learning tools.
            </p>
            <Link
              href="/learning"
              className="inline-block mt-2 bg-oxford hover:bg-oxford-light text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              ← Back to Learning
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

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

          <ScanHomeworkClient triviaEnabled={triviaEnabled} thinkFirstEnabled={thinkFirstEnabled} teachBackEnabled={teachBackEnabled} nudgesEnabled={nudgesEnabled} />

        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
