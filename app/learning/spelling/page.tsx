import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import SpellingPractice from './SpellingPractice'

export const metadata: Metadata = { title: 'Spelling Practice — Nest & Quill Learning Mode' }

type PageProps = { searchParams: Promise<{ assignmentId?: string }> }

export default async function SpellingPage({ searchParams }: PageProps) {
  const { assignmentId } = await searchParams
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">{assignmentId ? '← Dashboard' : '← Learning Mode'}</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <h1 className="font-serif text-3xl text-oxford">Spelling Practice</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Paste your spelling word list and practice one word at a time. Type it, check it, track your score.</p>
          </div>
          <SpellingPractice assignmentId={assignmentId} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
