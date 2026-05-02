import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

type RouteContext = { params: Promise<{ classId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  try {
    const { classId } = await params
    const body = await req.json().catch(() => ({}))
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ message: 'is_active must be a boolean.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('classrooms')
      .update({ is_active })
      .eq('id', classId)
      .select('id, name, is_active')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ message: 'Classroom not found.' }, { status: 404 })

    return NextResponse.json({ classroom: data })
  } catch (err) {
    console.error('[api/admin/classrooms/[classId] PATCH]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
