import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import Link from 'next/link'
import GradeDashboard from './GradeDashboard'

interface PageProps {
  params: Promise<{ grade: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { grade } = await params
  return {
    title: `Grade ${grade} Homeschool Dashboard — Nest & Quill`,
    description: `Complete Grade ${grade} homeschool curriculum with lesson plans, materials, books, activities, and progress tracking.`,
  }
}

export default async function GradePage({ params }: PageProps) {
  const { grade: gradeStr } = await params
  const grade = parseInt(gradeStr)
  if (isNaN(grade) || grade < 1 || grade > 12) notFound()

  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader
        right={
          <Link href="/homeschool/courses" className="text-sm text-charcoal-light hover:text-oxford transition-colors">
            ← All Grades
          </Link>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <GradeDashboard grade={grade} />
      </main>
      <SiteFooter />
    </div>
  )
}
