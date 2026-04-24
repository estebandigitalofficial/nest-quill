import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: rewards } = await admin
      .from('student_story_rewards')
      .select('id, milestone_number, awarded_at, story_request_id')
      .eq('student_id', user.id)
      .order('awarded_at', { ascending: false })

    if (!rewards || rewards.length === 0) return NextResponse.json({ stories: [] })

    const requestIds = rewards.map((r: { story_request_id: string }) => r.story_request_id)

    const { data: requests } = await admin
      .from('story_requests')
      .select('id, status, child_name, created_at')
      .in('id', requestIds)

    const completeIds = (requests ?? [])
      .filter((r: { status: string }) => r.status === 'complete')
      .map((r: { id: string }) => r.id)

    const { data: generatedStories } = completeIds.length > 0
      ? await admin
          .from('generated_stories')
          .select('request_id, title')
          .in('request_id', completeIds)
      : { data: [] }

    const requestMap = Object.fromEntries(
      (requests ?? []).map((r: { id: string; status: string; child_name: string }) => [r.id, r])
    )
    const storyMap = Object.fromEntries(
      (generatedStories ?? []).map((s: { request_id: string; title: string }) => [s.request_id, s])
    )

    const stories = rewards.map((r: { id: string; milestone_number: number; awarded_at: string; story_request_id: string }) => ({
      id: r.id,
      milestone: r.milestone_number,
      awardedAt: r.awarded_at,
      requestId: r.story_request_id,
      status: requestMap[r.story_request_id]?.status ?? 'queued',
      title: storyMap[r.story_request_id]?.title ?? null,
    }))

    return NextResponse.json({ stories })
  } catch (err) {
    console.error('[student/stories GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
