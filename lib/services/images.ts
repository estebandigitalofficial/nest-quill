import OpenAI from 'openai'
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

const STYLE_HINTS: Record<IllustrationStyle, string> = {
  watercolor: "soft watercolor illustration, gentle washes of color, children's picture book style",
  cartoon: "bright cartoon illustration, bold outlines, vibrant colors, fun and playful children's book style",
  storybook: "classic storybook illustration, warm and detailed, fairy-tale aesthetic, painted children's book style",
  pencil_sketch: "detailed pencil sketch illustration, hand-drawn, soft shading, charming children's book style",
  digital_art: "clean digital illustration, polished artwork, colorful, modern children's book style",
}

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function generateImage(prompt: string, options: ImageOptions): Promise<ImageResult> {
  const provider = process.env.IMAGE_PROVIDER ?? 'openai'
  switch (provider) {
    case 'openai':
      return generateWithOpenAI(prompt, options)
    default:
      throw new Error(`Unknown IMAGE_PROVIDER: ${provider}`)
  }
}

async function generateWithOpenAI(prompt: string, options: ImageOptions): Promise<ImageResult> {
  const openai = getOpenAI()
  const styleHint = STYLE_HINTS[options.style] ?? STYLE_HINTS.storybook
  const fullPrompt = `${styleHint}. ${prompt}. Child-safe, no text, no words in image.`

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: fullPrompt,
    n: 1,
    size: options.size ?? '1024x1024',
    quality: options.quality ?? 'standard',
    response_format: 'url',
  })

  const image = response.data?.[0]
  const url = image?.url
  if (!url) throw new Error('DALL-E returned no image URL')

  return {
    url,
    revisedPrompt: image?.revised_prompt ?? undefined,
    model: 'dall-e-3',
  }
}
