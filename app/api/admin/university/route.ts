import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

// GET — fetch content library with filters
export async function GET(req: NextRequest) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const toolType = url.searchParams.get('tool_type')
    const grade = url.searchParams.get('grade')
    const subject = url.searchParams.get('subject')
    const quality = url.searchParams.get('quality')
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const offset = (page - 1) * limit

    const admin = createAdminClient()

    let query = admin
      .from('content_library')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (toolType) query = query.eq('tool_type', toolType)
    if (grade) query = query.eq('grade', parseInt(grade))
    if (subject) query = query.ilike('subject', `%${subject}%`)
    if (quality) query = query.eq('quality', quality)
    if (search) query = query.or(`topic.ilike.%${search}%,title.ilike.%${search}%`)

    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // Fetch summary stats
    const [
      { count: totalCount },
      { count: quizCount },
      { count: flashcardCount },
      { count: studyGuideCount },
    ] = await Promise.all([
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'quiz').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'flashcards').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'study-guide').eq('is_active', true),
    ])

    // Fetch curriculum stats
    const [
      { count: courseCount },
      { count: unitCount },
      { count: lessonCount },
    ] = await Promise.all([
      admin.from('curriculum_courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('curriculum_units').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('curriculum_lessons').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      page,
      limit,
      stats: {
        totalContent: totalCount ?? 0,
        quizzes: quizCount ?? 0,
        flashcards: flashcardCount ?? 0,
        studyGuides: studyGuideCount ?? 0,
        courses: courseCount ?? 0,
        units: unitCount ?? 0,
        lessons: lessonCount ?? 0,
      },
    })
  } catch (err) {
    console.error('[admin/university GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// PATCH — update a content library item
export async function PATCH(req: NextRequest) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ message: 'ID required.' }, { status: 400 })

    const admin = createAdminClient()

    const allowedFields = ['title', 'topic', 'subject', 'grade', 'tags', 'quality', 'difficulty', 'standards', 'content', 'is_active']
    const filtered: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in updates) filtered[key] = updates[key]
    }

    const { data, error } = await admin
      .from('content_library')
      .update(filtered)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (err) {
    console.error('[admin/university PATCH]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// DELETE — soft-delete a content item
export async function DELETE(req: NextRequest) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ message: 'ID required.' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('content_library')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/university DELETE]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
