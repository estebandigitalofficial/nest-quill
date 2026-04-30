import type { Metadata } from 'next'
import QuizGenerator from './QuizGenerator'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Quiz Generator — Nest & Quill Learning Mode',
  description: 'Enter any topic and instantly generate a 5-question quiz for grades 1–8. Auto-graded with explanations.',
}

type PageProps = { searchParams: Promise<{ assignmentId?: string; topic?: string; grade?: string; subject?: string }> }

export default async function QuizPage({ searchParams }: PageProps) {
  const { assignmentId, topic, grade, subject } = await searchParams
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        <Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">
          {assignmentId ? '← Dashboard' : '← Learning Mode'}
        </Link>
      } />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <h1 className="font-serif text-3xl text-oxford">Quiz Generator</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">
              Enter any topic or paste homework content. We&apos;ll generate a 5-question quiz at exactly their grade level — instantly.
            </p>
          </div>
          <QuizGenerator
            assignmentId={assignmentId}
            initialTopic={topic}
            initialGrade={grade ? parseInt(grade) : undefined}
            initialSubject={subject}
          />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
