/**
 * SUPABASE STORAGE HELPERS
 *
 * Handles uploading images and PDFs to Supabase Storage.
 * Returns permanent storage paths (not the temporary OpenAI CDN URLs).
 */

import { createAdminClient } from '@/lib/supabase/admin'

const STORY_IMAGES_BUCKET = 'story-images'
const BOOK_EXPORTS_BUCKET = 'book-exports'

/**
 * Uploads an image buffer to Supabase Storage.
 * Returns the storage path (not a signed URL — call createSignedUrl separately).
 */
export async function uploadStoryImage(
  requestId: string,
  pageNumber: number,
  imageBuffer: Buffer
): Promise<string> {
  const supabase = createAdminClient()
  const path = `${requestId}/${pageNumber}.png`

  const { error } = await supabase.storage
    .from(STORY_IMAGES_BUCKET)
    .upload(path, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  return path
}

/**
 * Uploads a PDF buffer to Supabase Storage.
 * Returns the storage path.
 */
export async function uploadBookPDF(
  requestId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const supabase = createAdminClient()
  const path = `${requestId}/book.pdf`

  const { error } = await supabase.storage
    .from(BOOK_EXPORTS_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) throw new Error(`Failed to upload PDF: ${error.message}`)

  return path
}

/**
 * Creates a time-limited signed URL for a file in private storage.
 * Default: 7 days (suitable for email delivery links).
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`)
  }

  return data.signedUrl
}
