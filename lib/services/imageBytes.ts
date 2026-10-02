// Byte-level image format detection for the Next.js side (PDF embedding).
// Mirrors supabase/functions/process-story/imageProvider.ts: decide from
// the bytes, never from a filename, so legacy PNG assets and new JPEG
// assets both embed correctly.

export type ImageFormat = 'png' | 'jpeg'

export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'png'
  return null
}
