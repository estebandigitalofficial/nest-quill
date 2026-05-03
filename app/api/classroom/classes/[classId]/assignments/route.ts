import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateAssignmentContent,
  AssignmentGenerationError,
  ASSIGNMENT_TYPES,
  type AssignmentType,
  type ContentSource,
} from '@/lib/services/assignmentContent'

type RouteContext = { params: Promise<{ classId: string }> }

// POST — create an assignment in a class (educator only). Generates the
// content server-side and stores it on the row, so students render the
// educator's authored work and never produce their own.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: classroom } = await admin
      .from('classrooms')
      .select('id')
      .eq('id', classId)
      .eq('educator_id', user.id)
      .single()
    if (!classroom) return NextResponse.json({ message: 'Class not found.' }, { status: 404 })

    const body = await request.json() as {
      title?: string
      type?: string
      source?: string
      topic?: string
      material?: string
      grade?: number
      dueAt?: string
    }

    const title = body.title?.trim()
    if (!title) return NextResponse.json({ message: 'Title is required.' }, { status: 400 })
    if (title.length < 2 || title.length > 120) {
      return NextResponse.json({ message: 'Title must be 2-120 characters.' }, { status: 400 })
    }

    const type = body.type as AssignmentType
    if (!ASSIGNMENT_TYPES.includes(type)) {
      return NextResponse.json({ message: 'Pick a valid assignment type.' }, { status: 400 })
    }

    const source = body.source as ContentSource
    if (source !== 'topic' && source !== 'material') {
      return NextResponse.json({ message: 'Choose how to provide the content.' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    let generated
    try {
      generated = await generateAssignmentContent(admin, {
        type,
        source,
        topic: body.topic,
        material: body.material,
        grade: body.grade,
      }, ipAddress)
    } catch (err) {
      if (err instanceof AssignmentGenerationError) {
        return NextResponse.json({ message: err.message }, { status: err.status })
      }
      throw err
    }

    const { data, error } = await admin
      .from('assignments')
      .insert({
        classroom_id: classId,
        created_by: user.id,
        title,
        tool: type,
        config: generated.config,
        content: generated.content,
        due_at: body.dueAt ?? null,
      })
      .select('id, title, tool, config, content, due_at, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ assignment: data }, { status: 201 })
  } catch (err) {
    console.error('[classroom/assignments POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
