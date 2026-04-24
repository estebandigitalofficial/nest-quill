import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ classId: string }> }

// POST — create an assignment in a class (educator only)
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify educator owns this class
    const { data: classroom } = await admin
      .from('classrooms')
      .select('id')
      .eq('id', classId)
      .eq('educator_id', user.id)
      .single()

    if (!classroom) return NextResponse.json({ message: 'Class not found.' }, { status: 404 })

    const { title, tool, config, dueAt } = await request.json() as {
      title: string
      tool: string
      config: Record<string, unknown>
      dueAt?: string
    }

    if (!title?.trim()) return NextResponse.json({ message: 'Title is required.' }, { status: 400 })
    const validTools = ['quiz', 'flashcards', 'explain', 'study-guide', 'math', 'reading', 'spelling']
    if (!validTools.includes(tool)) return NextResponse.json({ message: 'Invalid tool.' }, { status: 400 })

    const { data, error } = await admin
      .from('assignments')
      .insert({
        classroom_id: classId,
        created_by: user.id,
        title: title.trim(),
        tool,
        config: config ?? {},
        due_at: dueAt ?? null,
      })
      .select('id, title, tool, config, due_at, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ assignment: data }, { status: 201 })
  } catch (err) {
    console.error('[classroom/assignments POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
