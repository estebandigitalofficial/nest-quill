import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const grade = url.searchParams.get('grade')
    const subject = url.searchParams.get('subject')
    const includeUnits = url.searchParams.get('units') === 'true'
    const includeBooks = url.searchParams.get('books') === 'true'

    const admin = createAdminClient()

    let selectParts = ['id', 'grade', 'subject', 'title', 'description', 'duration_weeks', 'sort_order']
    if (includeUnits) selectParts.push('curriculum_units(id, title, description, week_start, week_end, sort_order)')
    if (includeBooks) selectParts.push('curriculum_books(id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)')

    let query = admin
      .from('curriculum_courses')
      .select(selectParts.join(', '))
      .eq('is_active', true)
      .order('grade', { ascending: true })
      .order('sort_order', { ascending: true })

    if (grade) query = query.eq('grade', parseInt(grade))
    if (subject) query = query.ilike('subject', subject)

    const { data, error } = await query as { data: Record<string, unknown>[] | null; error: unknown }
    if (error) throw error

    if (data) {
      for (const course of data) {
        if (includeUnits) {
          const units = (course as Record<string, unknown>).curriculum_units as { sort_order: number }[] | undefined
          if (units) units.sort((a, b) => a.sort_order - b.sort_order)
        }
        if (includeBooks) {
          const books = (course as Record<string, unknown>).curriculum_books as { sort_order: number }[] | undefined
          if (books) books.sort((a, b) => a.sort_order - b.sort_order)
        }
      }
    }

    return NextResponse.json({ courses: data ?? [] })
  } catch (err) {
    console.error('[curriculum GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
