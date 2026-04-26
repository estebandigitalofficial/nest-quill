import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import FlashcardGenerator from './FlashcardGenerator'

export const metadata: Metadata = { title: 'Flashcards — Nest & Quill Learning Mode' }

type PageProps = { searchParams: Promise<{ assignmentId?: string; topic?: string; grade?: string }> }

export default async function FlashcardsPage({ searchParams }: PageProps) {
  const { assignmentId, topic, grade } = await searchParams
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">{assignmentId ? '← Dashboard' : '← Learning Mode'}</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="text-4xl">🃏</div>
            <h1 className="font-serif text-3xl text-oxford">Flashcards</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Enter any topic and we&apos;ll generate 10 study cards. Tap each card to flip it.</p>
          </div>
          <FlashcardGenerator assignmentId={assignmentId} initialTopic={topic} initialGrade={grade ? parseInt(grade) : undefined} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
