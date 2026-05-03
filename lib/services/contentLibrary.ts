import { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Content Library — cache-first content retrieval & storage
// ============================================================================

export type ToolType = 'quiz' | 'flashcards' | 'study-guide' | 'explain' | 'reading' | 'spelling' | 'math'
export type ContentSource = 'ai' | 'scan' | 'educator' | 'admin' | 'community'
export type ContentQuality = 'auto' | 'reviewed' | 'approved' | 'featured'

export interface ContentLibraryItem {
  id: string
  tool_type: ToolType
  grade: number | null
  subject: string | null
  topic: string
  title: string
  content: Record<string, unknown>
  tags: string[]
  source: ContentSource
  quality: ContentQuality
  difficulty: string | null
  standards: string[]
  use_count: number
  avg_score: number | null
  total_attempts: number
  total_correct: number
  created_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface LookupParams {
  toolType: ToolType
  topic: string
  grade?: number | null
  subject?: string | null
}

interface StoreParams {
  toolType: ToolType
  topic: string
  title: string
  content: Record<string, unknown>
  grade?: number | null
  subject?: string | null
  tags?: string[]
  source?: ContentSource
  createdBy?: string | null
}

/**
 * Look up existing content in the library.
 * Returns the best match (featured > approved > reviewed > auto, then by use_count).
 */
export async function findContent(
  admin: SupabaseClient,
  params: LookupParams
): Promise<ContentLibraryItem | null> {
  const { toolType, topic, grade, subject } = params

  // Normalize topic for matching
  const normalizedTopic = topic.trim().toLowerCase()

  let query = admin
    .from('content_library')
    .select('*')
    .eq('tool_type', toolType)
    .eq('is_active', true)
    .ilike('topic', normalizedTopic)

  if (grade) query = query.eq('grade', grade)
  if (subject) query = query.ilike('subject', subject.trim())

  // Prefer higher quality and more-used content
  const { data } = await query
    .order('quality', { ascending: false })
    .order('use_count', { ascending: false })
    .limit(1)

  return (data?.[0] as ContentLibraryItem) ?? null
}

/**
 * Search the library with flexible text matching.
 * Used when exact topic match fails — finds similar content.
 */
export async function searchContent(
  admin: SupabaseClient,
  params: LookupParams
): Promise<ContentLibraryItem | null> {
  const { toolType, topic, grade } = params
  const words = topic.trim().split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return null

  // Use text search for fuzzy matching
  const tsQuery = words.join(' & ')

  let query = admin
    .from('content_library')
    .select('*')
    .eq('tool_type', toolType)
    .eq('is_active', true)
    .textSearch('topic', tsQuery, { config: 'english' })

  if (grade) query = query.eq('grade', grade)

  const { data } = await query
    .order('use_count', { ascending: false })
    .limit(1)

  return (data?.[0] as ContentLibraryItem) ?? null
}

/**
 * Record that content was served to a user. Increments use_count.
 */
export async function recordUsage(
  admin: SupabaseClient,
  contentId: string,
  opts?: { userId?: string | null; classroomId?: string | null; toolType?: string; score?: number; completed?: boolean; ip?: string | null }
) {
  // Increment use count via fetch + update
  const { data: current } = await admin
    .from('content_library')
    .select('use_count')
    .eq('id', contentId)
    .single()

  if (current) {
    await admin
      .from('content_library')
      .update({
        use_count: (current.use_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
  }

  // Log usage
  if (opts) {
    await admin.from('content_usage').insert({
      content_id: contentId,
      user_id: opts.userId ?? null,
      classroom_id: opts.classroomId ?? null,
      tool_type: opts.toolType ?? 'unknown',
      score: opts.score ?? null,
      completed: opts.completed ?? false,
      ip_address: opts.ip ?? null,
    })
  }
}

/**
 * Record a score against a content item. Updates running averages.
 */
export async function recordScore(
  admin: SupabaseClient,
  contentId: string,
  score: number,
  total: number
) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const isCorrect = pct >= 70 ? 1 : 0

  // Fetch current stats
  const { data } = await admin
    .from('content_library')
    .select('total_attempts, total_correct, avg_score')
    .eq('id', contentId)
    .single()

  if (data) {
    const newAttempts = (data.total_attempts ?? 0) + 1
    const newCorrect = (data.total_correct ?? 0) + isCorrect
    const oldAvg = data.avg_score ?? pct
    const newAvg = Math.round(((oldAvg * (newAttempts - 1)) + pct) / newAttempts)

    await admin
      .from('content_library')
      .update({
        total_attempts: newAttempts,
        total_correct: newCorrect,
        avg_score: newAvg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
  }
}

/**
 * Store new content in the library.
 */
export async function storeContent(
  admin: SupabaseClient,
  params: StoreParams
): Promise<ContentLibraryItem | null> {
  const { toolType, topic, title, content, grade, subject, tags, source, createdBy } = params

  // Auto-generate tags from topic and subject
  const autoTags = [
    ...(tags ?? []),
    toolType,
    ...(subject ? [subject.toLowerCase()] : []),
    ...(grade ? [`grade-${grade}`] : []),
  ]

  const { data, error } = await admin
    .from('content_library')
    .insert({
      tool_type: toolType,
      topic: topic.trim().toLowerCase(),
      title,
      content,
      grade: grade ?? null,
      subject: subject ?? null,
      tags: [...new Set(autoTags)],
      source: source ?? 'ai',
      created_by: createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[contentLibrary.storeContent]', error)
    return null
  }

  return data as ContentLibraryItem
}

/**
 * The main cache-first function. Checks library, returns existing or null.
 * Caller is responsible for generating + storing if null.
 */
export async function getOrNull(
  admin: SupabaseClient,
  params: LookupParams
): Promise<ContentLibraryItem | null> {
  // Try exact match first
  const exact = await findContent(admin, params)
  if (exact) return exact

  // Try fuzzy search
  const fuzzy = await searchContent(admin, params)
  if (fuzzy) return fuzzy

  return null
}
