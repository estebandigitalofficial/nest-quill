import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'student-avatars'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

// POST — upload (or replace) the current student's avatar photo.
// Stored in the public student-avatars bucket; the public URL is saved on
// student_profiles.avatar_url so the dashboard can render it directly.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'No file uploaded.' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ message: 'Use a PNG, JPG, or WebP image.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'Image must be 2 MB or smaller.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    // Cache-bust by including a timestamp so the dashboard picks up the new
    // photo immediately even when the URL is otherwise stable.
    const path = `${user.id}/avatar-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })
    if (uploadErr) {
      console.error('[student/avatar POST] upload error:', uploadErr)
      return NextResponse.json({ message: 'Failed to save photo.' }, { status: 500 })
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = pub.publicUrl

    // Delete any older avatars for this user so the bucket doesn't grow forever.
    const { data: existing } = await admin.storage.from(BUCKET).list(user.id, { limit: 100 })
    const stale = (existing ?? [])
      .map(f => `${user.id}/${f.name}`)
      .filter(p => p !== path)
    if (stale.length > 0) {
      await admin.storage.from(BUCKET).remove(stale)
    }

    const { data: profile, error: updateErr } = await admin
      .from('student_profiles')
      .upsert({ student_id: user.id, avatar_url: avatarUrl }, { onConflict: 'student_id' })
      .select()
      .single()
    if (updateErr) throw updateErr

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[student/avatar POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// DELETE — remove the avatar photo. Profile falls back to color + initials.
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: existing } = await admin.storage.from(BUCKET).list(user.id, { limit: 100 })
    if (existing && existing.length > 0) {
      await admin.storage.from(BUCKET).remove(existing.map(f => `${user.id}/${f.name}`))
    }

    const { data: profile, error } = await admin
      .from('student_profiles')
      .upsert({ student_id: user.id, avatar_url: null }, { onConflict: 'student_id' })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[student/avatar DELETE]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
