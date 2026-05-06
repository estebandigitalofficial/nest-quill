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

// POST — generate a previewable assignment payload WITHOUT persisting an
// assignments row. Used so the educator can review AI output before exposing
// it to students. The same generator runs as the real create endpoint, so the
// preview is the actual payload that will be stored if the educator commits.
//
// For quiz/reading types, this still creates a quiz_sessions row server-side
// (correct answers must live there, not on the client). Sessions auto-expire
// in 4 hours per the existing migration, so abandoned previews self-clean.
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
      type?: string
      source?: string
      topic?: string
      material?: string
      grade?: number
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

    try {
      const generated = await generateAssignmentContent(admin, {
        type,
        source,
        topic: body.topic,
        material: body.material,
        grade: body.grade,
      }, ipAddress)
      return NextResponse.json({ content: generated.content, config: generated.config })
    } catch (err) {
      if (err instanceof AssignmentGenerationError) {
        return NextResponse.json({ message: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (err) {
    console.error('[classroom/assignments/preview POST]', err)
    return NextResponse.json({ message: 'Could not preview the assignment.' }, { status: 500 })
  }
}
