import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET() {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Fetch all courses with counts
    const { data: courses } = await admin
      .from('curriculum_courses')
      .select('id, grade, subject, title')
      .eq('is_active', true)
      .order('grade')
      .order('sort_order')

    // Fetch unit counts per course
    const { data: units } = await admin
      .from('curriculum_units')
      .select('id, course_id')
      .eq('is_active', true)

    // Fetch teaching guide counts per unit
    const { data: guides } = await admin
      .from('curriculum_teaching_guides')
      .select('id, unit_id')
      .eq('is_active', true)

    // Fetch content library stats per grade
    const { data: contentItems } = await admin
      .from('content_library')
      .select('id, grade, tool_type, content')
      .eq('is_active', true)
      .not('grade', 'is', null)

    // Fetch book counts per course
    const { data: books } = await admin
      .from('curriculum_books')
      .select('id, course_id')
      .eq('is_active', true)

    // Build grade summaries
    const courseList = courses ?? []
    const unitList = units ?? []
    const guideList = guides ?? []
    const contentList = contentItems ?? []
    const bookList = books ?? []

    // Map units to courses
    const unitsByCourse: Record<string, string[]> = {}
    for (const u of unitList) {
      if (!unitsByCourse[u.course_id]) unitsByCourse[u.course_id] = []
      unitsByCourse[u.course_id].push(u.id)
    }

    // Map guides to units
    const guidesByUnit: Record<string, number> = {}
    for (const g of guideList) {
      guidesByUnit[g.unit_id] = (guidesByUnit[g.unit_id] ?? 0) + 1
    }

    // Map books to courses
    const booksByCourse: Record<string, number> = {}
    for (const b of bookList) {
      booksByCourse[b.course_id] = (booksByCourse[b.course_id] ?? 0) + 1
    }

    // Build per-grade data
    const gradeMap: Record<number, {
      grade: number
      subjects: string[]
      courseCount: number
      unitCount: number
      guideCount: number
      bookCount: number
      contentTotal: number
      contentFilled: number
      contentEmpty: number
    }> = {}

    for (let g = 1; g <= 12; g++) {
      gradeMap[g] = {
        grade: g,
        subjects: [],
        courseCount: 0,
        unitCount: 0,
        guideCount: 0,
        bookCount: 0,
        contentTotal: 0,
        contentFilled: 0,
        contentEmpty: 0,
      }
    }

    for (const course of courseList) {
      const g = gradeMap[course.grade]
      if (!g) continue
      g.courseCount++
      g.subjects.push(course.subject)

      const courseUnits = unitsByCourse[course.id] ?? []
      g.unitCount += courseUnits.length
      g.bookCount += booksByCourse[course.id] ?? 0

      for (const unitId of courseUnits) {
        g.guideCount += guidesByUnit[unitId] ?? 0
      }
    }

    for (const item of contentList) {
      if (!item.grade) continue
      const g = gradeMap[item.grade]
      if (!g) continue
      g.contentTotal++
      const contentStr = JSON.stringify(item.content)
      if (contentStr === '{}' || contentStr === 'null') {
        g.contentEmpty++
      } else {
        g.contentFilled++
      }
    }

    const grades = Object.values(gradeMap).sort((a, b) => a.grade - b.grade)

    return NextResponse.json({ grades })
  } catch (err) {
    console.error('[admin/university/grades GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
