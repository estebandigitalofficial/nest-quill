import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — fetch curriculum courses, optionally with units
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const grade = url.searchParams.get('grade')
    const subject = url.searchParams.get('subject')
    const includeUnits = url.searchParams.get('units') === 'true'

    const admin = createAdminClient()

    const selectStr = includeUnits
      ? 'id, grade, subject, title, description, duration_weeks, sort_order, curriculum_units(id, title, description, week_start, week_end, sort_order)'
      : 'id, grade, subject, title, description, duration_weeks, sort_order'

    let query = admin
      .from('curriculum_courses')
      .select(selectStr)
      .eq('is_active', true)
      .order('grade', { ascending: true })
      .order('sort_order', { ascending: true })

    if (grade) query = query.eq('grade', parseInt(grade))
    if (subject) query = query.ilike('subject', subject)

    const { data, error } = await query as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) throw error

    // Sort units by sort_order if included
    if (includeUnits && data) {
      for (const course of data) {
        const units = (course as Record<string, unknown>).curriculum_units as { sort_order: number }[] | undefined
        if (units) {
          units.sort((a, b) => a.sort_order - b.sort_order)
        }
      }
    }

    return NextResponse.json({ courses: data ?? [] })
  } catch (err) {
    console.error('[curriculum GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
