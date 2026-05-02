import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBookPDF } from '@/lib/services/pdf'
import type { GeneratedStory, StoryScene } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  // Internal route — verify shared secret (same token the status route uses to call the Edge Function)
  const authHeader = request.headers.get('authorization') ?? ''
  const secret = process.env.EDGE_FUNCTION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { requestId } = await params
  const adminSupabase = createAdminClient()

  try {
    // Idempotency — skip if a PDF was already assembled
    const { data: existingExport } = await adminSupabase
      .from('book_exports')
      .select('id')
      .eq('request_id', requestId)
      .eq('is_latest', true)
      .maybeSingle()

    if (existingExport) {
      return NextResponse.json({ requestId, status: 'already_exists' })
    }

    const { data: storyReq, error: reqErr } = await adminSupabase
      .from('story_requests')
      .select('plan_tier, closing_message, status')
      .eq('id', requestId)
      .single()

    if (reqErr || !storyReq) {
      return NextResponse.json({ message: 'Story request not found' }, { status: 404 })
    }

    // Free tier has no downloadable PDF
    if (storyReq.plan_tier === 'free') {
      return NextResponse.json({ requestId, status: 'skipped_free_tier' })
    }

    const { data: storyData, error: storyErr } = await adminSupabase
      .from('generated_stories')
      .select('*')
      .eq('request_id', requestId)
      .single()

    if (storyErr || !storyData) {
      return NextResponse.json({ message: 'Story content not found' }, { status: 404 })
    }

    const { data: scenes, error: scenesErr } = await adminSupabase
      .from('story_scenes')
      .select('*')
      .eq('request_id', requestId)
      .order('page_number', { ascending: true })

    if (scenesErr || !scenes) {
      return NextResponse.json({ message: 'Story scenes not found' }, { status: 404 })
    }

    // Build signed URLs for complete scenes (1-hour TTL — more than enough for generation)
    const completedPaths = scenes
      .filter(s => s.image_status === 'complete' && s.storage_path)
      .map(s => s.storage_path as string)

    const signedImageUrls = new Map<number, string>()
    if (completedPaths.length > 0) {
      const { data: signed } = await adminSupabase.storage
        .from('story-images')
        .createSignedUrls(completedPaths, 60 * 60)

      signed?.forEach(item => {
        if (item.signedUrl && item.path) {
          const scene = scenes.find(s => s.storage_path === item.path)
          if (scene) signedImageUrls.set(scene.page_number, item.signedUrl)
        }
      })
    }

    const { buffer, pageCount, renderTimeMs } = await generateBookPDF({
      story: storyData as unknown as GeneratedStory,
      scenes: scenes as unknown as StoryScene[],
      signedImageUrls,
      closingMessage: (storyReq as unknown as { closing_message: string | null }).closing_message ?? undefined,
    })

    const storagePath = `${requestId}/storybook.pdf`
    const { error: uploadError } = await adminSupabase.storage
      .from('book-exports')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`)

    await adminSupabase
      .from('book_exports')
      .insert({
        request_id: requestId,
        format: 'pdf',
        storage_path: storagePath,
        storage_bucket: 'book-exports',
        file_size_bytes: buffer.length,
        page_count: pageCount,
        render_time_ms: renderTimeMs,
        is_latest: true,
      })

    await adminSupabase
      .from('processing_logs')
      .insert({
        request_id: requestId,
        level: 'info',
        stage: 'pdf_assembled',
        message: `PDF assembled in Node.js (${pageCount} pages, ${buffer.length} bytes, ${renderTimeMs}ms)`,
        metadata: { storage_path: storagePath, file_size_bytes: buffer.length, page_count: pageCount, render_time_ms: renderTimeMs },
      })

    console.log(`[generate-pdf] ${requestId} — ${pageCount} pages, ${buffer.length} bytes, ${renderTimeMs}ms`)
    return NextResponse.json({ requestId, status: 'generated', pageCount, fileSizeBytes: buffer.length, renderTimeMs })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-pdf] error:', requestId, message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
