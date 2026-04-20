/**
 * IMAGE GENERATION SERVICE
 *
 * Abstraction layer over image generation providers.
 * Phase 1 implementation: OpenAI DALL-E 3.
 * Swap providers by changing IMAGE_PROVIDER env var — nothing else changes.
 *
 * STATUS: STUB — logic filled in during Phase 4
 */

import type { IllustrationStyle } from '@/types/story'

export interface ImageOptions {
  style: IllustrationStyle
  size?: '1024x1024' | '1792x1024'
  quality?: 'standard' | 'hd'
}

export interface ImageResult {
  url: string
  revisedPrompt?: string
  model: string
}

export async function generateImage(
  prompt: string,
  options: ImageOptions
): Promise<ImageResult> {
  const provider = process.env.IMAGE_PROVIDER ?? 'openai'

  switch (provider) {
    case 'openai':
      return generateWithOpenAI(prompt, options)
    default:
      throw new Error(`Unknown IMAGE_PROVIDER: ${provider}`)
  }
}

// ─── OpenAI DALL-E 3 ─────────────────────────────────────────────────────────

async function generateWithOpenAI(
  prompt: string,
  options: ImageOptions
): Promise<ImageResult> {
  // STUB — Phase 4 implementation goes here
  // Will:
  // 1. Import OpenAI and call images.generate with the prompt
  // 2. Download the image buffer from the temporary CDN URL
  //    (OpenAI image URLs expire in 1 hour — must download immediately)
  // 3. Return { url, revisedPrompt, model }

  throw new Error('generateWithOpenAI: not yet implemented — Phase 4')
}
