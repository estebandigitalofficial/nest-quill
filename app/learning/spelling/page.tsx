import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import SpellingPractice from './SpellingPractice'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = { title: 'Spelling Practice — Nest & Quill Learning Mode' }

type PageProps = { searchParams: Promise<{ assignmentId?: string }> }

export default async function SpellingPage({ searchParams }: PageProps) {
  const [{ assignmentId }, initialSentenceMode, nudgesEnabled, maxImageMb] = await Promise.all([
    searchParams,
    getSetting('spelling_sentence_mode_default', false),
    getSetting('learning_nudges_enabled', true),
    getSetting('max_image_upload_mb', 5),
  ])
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">{assignmentId ? '← Dashboard' : '← Learning Mode'}</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <h1 className="font-serif text-3xl text-oxford">Spelling Practice</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Paste your spelling word list and practice one word at a time. Type it, check it, track your score.</p>
          </div>
          <SpellingPractice assignmentId={assignmentId} initialSentenceMode={initialSentenceMode} nudgesEnabled={nudgesEnabled} maxImageMb={maxImageMb} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
