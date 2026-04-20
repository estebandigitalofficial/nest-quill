/**
 * STORY TEXT GENERATION SERVICE
 *
 * Uses OpenAI GPT-4o to generate a structured children's story.
 * Called by the Supabase Edge Function (process-story) during the pipeline.
 *
 * STATUS: STUB — logic filled in during Phase 4
 */

import OpenAI from 'openai'
import type { StoryRequest } from '@/types/database'
import type { GeneratedStoryJSON } from '@/types/story'

// Lazy-initialize so the client isn't created at import time
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export async function generateStoryText(
  request: Pick<
    StoryRequest,
    | 'child_name'
    | 'child_age'
    | 'child_description'
    | 'story_theme'
    | 'story_length'
    | 'illustration_style'
    | 'dedication_text'
    | 'custom_notes'
  >
): Promise<GeneratedStoryJSON> {
  // STUB — Phase 4 implementation goes here
  // Will:
  // 1. Build a structured system prompt describing the story format
  // 2. Build a user prompt from the request fields
  // 3. Call gpt-4o with response_format: { type: 'json_object' }
  // 4. Parse and validate the JSON response with Zod
  // 5. Return typed GeneratedStoryJSON

  throw new Error('generateStoryText: not yet implemented — Phase 4')
}
