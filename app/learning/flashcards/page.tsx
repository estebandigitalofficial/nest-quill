import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import FlashcardGenerator from './FlashcardGenerator'

export const metadata: Metadata = { title: 'Flashcards — Nest & Quill Learning Mode' }

export default function FlashcardsPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning Mode</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="text-4xl">🃏</div>
            <h1 className="font-serif text-3xl text-oxford">Flashcards</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Enter any topic and we&apos;ll generate 10 study cards. Tap each card to flip it.</p>
          </div>
          <FlashcardGenerator />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
