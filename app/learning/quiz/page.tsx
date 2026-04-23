import type { Metadata } from 'next'
import QuizGenerator from './QuizGenerator'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Quiz Generator — Nest & Quill Learning Mode',
  description: 'Enter any topic and instantly generate a 5-question quiz for grades 1–8. Auto-graded with explanations.',
}

export default function QuizPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        <Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning Mode</Link>
      } />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="text-4xl">🧠</div>
            <h1 className="font-serif text-3xl text-oxford">Quiz Generator</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">
              Enter any topic or paste homework content. We&apos;ll generate a 5-question quiz at exactly their grade level — instantly.
            </p>
          </div>
          <QuizGenerator />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
