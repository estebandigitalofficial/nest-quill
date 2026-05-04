import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ grade: string }> }
) {
  try {
    const { grade: gradeStr } = await params
    const grade = parseInt(gradeStr)
    if (isNaN(grade) || grade < 1 || grade > 12) {
      return NextResponse.json({ message: 'Invalid grade' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch courses with units, books, and teaching guides
    const { data: courses, error } = await admin
      .from('curriculum_courses')
      .select(`
        id, grade, subject, title, description, duration_weeks, sort_order,
        curriculum_units (
          id, title, description, week_start, week_end, sort_order,
          curriculum_teaching_guides (
            id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes
          )
        ),
        curriculum_books (
          id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order
        )
      `)
      .eq('grade', grade)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    // Sort nested data
    for (const course of (courses ?? [])) {
      const c = course as Record<string, unknown>
      const units = c.curriculum_units as { sort_order: number; curriculum_teaching_guides?: unknown[] }[] | undefined
      if (units) {
        units.sort((a, b) => a.sort_order - b.sort_order)
      }
      const books = c.curriculum_books as { sort_order: number }[] | undefined
      if (books) books.sort((a, b) => a.sort_order - b.sort_order)
    }

    // Aggregate all materials across all teaching guides
    const allMaterials = new Set<string>()
    for (const course of (courses ?? [])) {
      const c = course as Record<string, unknown>
      const units = c.curriculum_units as { curriculum_teaching_guides?: { materials?: string[] }[] }[] | undefined
      if (units) {
        for (const unit of units) {
          for (const guide of (unit.curriculum_teaching_guides ?? [])) {
            for (const mat of (guide.materials ?? [])) {
              allMaterials.add(mat)
            }
          }
        }
      }
    }

    // Fetch content library stats for this grade
    const [
      { count: quizCount },
      { count: flashcardCount },
      { count: studyGuideCount },
    ] = await Promise.all([
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('grade', grade).eq('tool_type', 'quiz').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('grade', grade).eq('tool_type', 'flashcards').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('grade', grade).eq('tool_type', 'study-guide').eq('is_active', true),
    ])

    return NextResponse.json({
      grade,
      courses: courses ?? [],
      materials: [...allMaterials].sort(),
      stats: {
        quizzes: quizCount ?? 0,
        flashcards: flashcardCount ?? 0,
        studyGuides: studyGuideCount ?? 0,
        totalCourses: (courses ?? []).length,
      },
    })
  } catch (err) {
    console.error('[homeschool/grade GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
