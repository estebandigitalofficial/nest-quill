import { createAdminClient } from '@/lib/supabase/admin'

interface ProfileData {
  display_name: string
  level: number
}

interface AssignmentConfig {
  topic?: string
  grade?: number
  subject?: string
}

interface AssignmentData {
  id: string
  tool: string
  classroom_id: string
  config: AssignmentConfig | null
}

async function triggerPipeline(requestId: string): Promise<void> {
  const baseUrl = process.env.EDGE_FUNCTION_BASE_URL
  if (!baseUrl) return
  await fetch(`${baseUrl}/process-story`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ requestId }),
  })
}

export async function triggerStoryReward(
  studentId: string,
  profile: ProfileData,
  assignment: AssignmentData,
  milestone: number
): Promise<string[]> {
  const admin = createAdminClient()
  const newBadges: string[] = []

  const topic: string = assignment.config?.topic ?? 'amazing adventures'
  const grade: number = assignment.config?.grade ?? 4
  const childAge = Math.max(6, Math.min(14, grade + 5))

  const { data: req } = await admin
    .from('story_requests')
    .insert({
      user_id: studentId,
      plan_tier: 'free',
      child_name: profile.display_name || 'Hero',
      child_age: childAge,
      story_theme: 'adventure',
      story_tone: 'fun and playful',
      story_moral: 'Hard work and curiosity make you unstoppable',
      story_length: 6,
      illustration_style: 'cartoon',
      learning_mode: true,
      learning_subject: assignment.tool,
      learning_topic: topic,
      user_email: '',
      status: 'queued',
      progress_pct: 0,
      status_message: 'Your story reward is being created...',
    })
    .select('id')
    .single()

  if (!req) return newBadges

  await admin.from('student_story_rewards').insert({
    student_id: studentId,
    story_request_id: req.id,
    milestone_number: milestone,
  })

  // Award story_hero badge on first story reward
  if (milestone === 3) {
    const { data: badge } = await admin.from('badges').select('id').eq('slug', 'story_hero').single()
    if (badge) {
      const { error } = await admin
        .from('student_badges')
        .insert({ student_id: studentId, badge_id: badge.id })
      if (!error) newBadges.push('story_hero')
    }
  }

  // Fire pipeline non-blocking — story generates in background
  triggerPipeline(req.id).catch(err =>
    console.error('[storyReward] Pipeline trigger failed', req.id, err)
  )

  return newBadges
}
