import type { Metadata } from 'next'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link'
import CurriculumBrowser from './CurriculumBrowser'

export const metadata: Metadata = {
  title: 'Course Catalog — Nest & Quill Homeschool',
  description: 'Browse all courses, units, and lessons across grades 1–8.',
}

export default function CoursesPage() {
  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader
        right={
          <Link href="/homeschool" className="text-sm text-charcoal-light hover:text-oxford">
            ← Homeschool
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <section className="bg-oxford py-12 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-3xl mx-auto relative space-y-3">
            <h1 className="font-serif text-3xl sm:text-4xl text-white">
              Course Catalog
            </h1>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Browse all grades, subjects, and units. Pick a grade to see the full curriculum.
            </p>
          </div>
        </section>

        <CurriculumBrowser />
      </main>

      <SiteFooter />
    </div>
  )
}
