import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ConceptExplainer from './ConceptExplainer'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = { title: 'Concept Explainer — Nest & Quill Learning Mode' }

type PageProps = { searchParams: Promise<{ assignmentId?: string; topic?: string; grade?: string }> }

export default async function ExplainPage({ searchParams }: PageProps) {
  const [{ assignmentId, topic, grade }, thinkFirstEnabled, teachBackEnabled, nudgesEnabled] = await Promise.all([
    searchParams,
    getSetting('think_first_enabled', true),
    getSetting('teach_back_enabled', true),
    getSetting('learning_nudges_enabled', true),
  ])
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href={assignmentId ? '/classroom/student' : '/learning'} className="text-sm text-charcoal-light hover:text-oxford">{assignmentId ? '← Dashboard' : '← Learning Mode'}</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <h1 className="font-serif text-3xl text-oxford">Concept Explainer</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Ask about anything they&apos;re learning. We&apos;ll explain it simply, with a real-world analogy and something to try at home.</p>
          </div>
          <ConceptExplainer assignmentId={assignmentId} initialTopic={topic} initialGrade={grade ? parseInt(grade) : undefined} thinkFirstEnabled={thinkFirstEnabled} teachBackEnabled={teachBackEnabled} nudgesEnabled={nudgesEnabled} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
