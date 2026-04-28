import { NextRequest, NextResponse } from 'next/server'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { extractTextFromImage } from '@/lib/learning/imageExtraction'

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'extract-image')
  if (limited) return limited

  try {
    const { imageBase64, mimeType, mode } = await request.json() as {
      imageBase64: string
      mimeType?: string
      mode?: 'general' | 'spelling'
    }

    if (!imageBase64) {
      return NextResponse.json({ message: 'No image provided.' }, { status: 400 })
    }

    const text = await extractTextFromImage(imageBase64, mimeType ?? 'image/jpeg', mode ?? 'general')
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[extract-image] error:', err)
    return NextResponse.json({ message: 'Failed to extract image content.' }, { status: 500 })
  }
}
