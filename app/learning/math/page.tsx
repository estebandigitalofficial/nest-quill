import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import MathPractice from './MathPractice'

export const metadata: Metadata = { title: 'Math Practice — Nest & Quill Learning Mode' }

export default function MathPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning Mode</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="text-4xl">🔢</div>
            <h1 className="font-serif text-3xl text-oxford">Math Practice</h1>
            <p className="text-sm text-charcoal-light max-w-sm mx-auto">Pick a topic and grade, get 8 practice problems with step-by-step solutions revealed after each answer.</p>
          </div>
          <MathPractice />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
