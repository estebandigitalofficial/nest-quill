import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import StudyGuideGenerator from './StudyGuideGenerator'

export const metadata: Metadata = { title: 'Study Guide — Nest & Quill Learning Mode' }

type PageProps = { searchParams: Promise<{ assignmentId?: string; topic?: string; grade?: string; subject?: string }> }

export default async function StudyGuidePage({ searchParams }: PageProps) {
  const { assignmentId, topic, grade, subject } = await searchParams
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">{assignmentId ? '← Dashboard' : '← Learning Mode'}</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="text-4xl">📋</div>
            <h1 className="font-serif text-3xl text-oxford">Study Guide</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Enter a topic and get a complete study guide — key terms, main concepts, memory tips, and practice questions.</p>
          </div>
          <StudyGuideGenerator assignmentId={assignmentId} initialTopic={topic} initialGrade={grade ? parseInt(grade) : undefined} initialSubject={subject} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
