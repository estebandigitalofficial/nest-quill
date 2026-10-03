import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBookPDF } from '@/lib/services/pdf'
import { runClaimedOnce } from '@/lib/limits/idempotency'
import { COVER_BUCKET, pickCoverPath } from '@/lib/services/cover'
import { exportIsCurrent, idsToDemote, pdfClaimKey } from '@/lib/services/pdfExports'
import type { GeneratedStory, StoryScene } from '@/types/database'
import { pdfEntitledFor } from '@/lib/entitlements/policy'

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
    const { data: storyReq, error: reqErr } = await adminSupabase
      .from('story_requests')
      .select('plan_tier, closing_message, status, completed_at, entitlement_source, pdf_entitled')
      .eq('id', requestId)
      .single()

    if (reqErr || !storyReq) {
      return NextResponse.json({ message: 'Story request not found' }, { status: 404 })
    }

    const completedAt = (storyReq as unknown as { completed_at: string | null }).completed_at

    // Idempotency — skip if a PDF for THIS completion was already assembled.
    // An export older than completed_at belongs to a previous generation of
    // the text and is replaced below.
    const { data: existingExport } = await adminSupabase
      .from('book_exports')
      .select('id, created_at')
      .eq('request_id', requestId)
      .eq('is_latest', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingExport && exportIsCurrent(existingExport as { created_at: string }, completedAt)) {
      return NextResponse.json({ requestId, status: 'already_exists' })
    }

    // Authoritative PDF entitlement (snapshot for new rows, legacy label rule
    // for rows that predate the entitlement model). Never the bare label.
    if (!pdfEntitledFor(storyReq as unknown as { entitlement_source?: string | null; pdf_entitled?: boolean | null; plan_tier?: string | null })) {
      return NextResponse.json({ requestId, status: 'not_entitled' })
    }

    // Only assemble for a finished story.
    if (storyReq.status !== 'complete') {
      return NextResponse.json({ requestId, status: 'not_complete' }, { status: 409 })
    }

    // One claim per (story, completion) so two concurrent polls (or a poll
    // racing an admin action) can never render and upload two PDFs for the
    // same story. The claim is KEPT after a successful render and RELEASED
    // after a failed one, so a transient render/upload/insert failure never
    // strands the PDF — the next poll simply tries again.
    const run = await runClaimedOnce(pdfClaimKey(requestId, completedAt), 'pdf_assembly', requestId, async () => {
      const { data: storyData, error: storyErr } = await adminSupabase
        .from('generated_stories')
        .select('*')
        .eq('request_id', requestId)
        .single()

      if (storyErr || !storyData) throw new Error('Story content not found')

      const { data: scenes, error: scenesErr } = await adminSupabase
        .from('story_scenes')
        .select('*')
        .eq('request_id', requestId)
        .order('page_number', { ascending: true })

      if (scenesErr || !scenes) throw new Error('Story scenes not found')

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

      // Canonical cover artwork (Phase 1F), signed for the render only.
      let coverImageUrl: string | null = null
      const coverPath = pickCoverPath(storyData as unknown as { cover_status?: string | null; cover_storage_path?: string | null })
      if (coverPath) {
        const { data: signedCover } = await adminSupabase.storage.from(COVER_BUCKET).createSignedUrl(coverPath, 60 * 60)
        coverImageUrl = signedCover?.signedUrl ?? null
      }

      const { buffer, pageCount, renderTimeMs } = await generateBookPDF({
        story: storyData as unknown as GeneratedStory,
        scenes: scenes as unknown as StoryScene[],
        signedImageUrls,
        coverImageUrl,
        closingMessage: (storyReq as unknown as { closing_message: string | null }).closing_message ?? undefined,
      })

      const storagePath = `${requestId}/storybook.pdf`
      const { error: uploadError } = await adminSupabase.storage
        .from('book-exports')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

      if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`)

      const { data: inserted, error: insertError } = await adminSupabase
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
        .select('id')
        .single()

      if (insertError || !inserted) throw new Error(`book_exports insert failed: ${insertError?.message ?? 'no row'}`)

      // Exactly one latest export per story: demote every older row.
      const { data: others } = await adminSupabase
        .from('book_exports')
        .select('id, created_at, is_latest')
        .eq('request_id', requestId)
      const demote = idsToDemote((others ?? []) as { id: string; created_at: string; is_latest: boolean | null }[], inserted.id as string)
      if (demote.length > 0) {
        await adminSupabase.from('book_exports').update({ is_latest: false }).in('id', demote)
      }

      await adminSupabase
        .from('processing_logs')
        .insert({
          request_id: requestId,
          level: 'info',
          stage: 'pdf_assembled',
          message: `PDF assembled in Node.js (${pageCount} pages, ${buffer.length} bytes, ${renderTimeMs}ms)`,
          metadata: { storage_path: storagePath, file_size_bytes: buffer.length, page_count: pageCount, render_time_ms: renderTimeMs, demoted_exports: demote.length },
        })

      return { pageCount, fileSizeBytes: buffer.length, renderTimeMs }
    })

    if (run.outcome === 'already_claimed') {
      return NextResponse.json({ requestId, status: 'already_claimed' })
    }

    if (run.outcome === 'failed') {
      const message = run.error instanceof Error ? run.error.message : String(run.error)
      console.error('[generate-pdf] error:', requestId, message, run.released ? '(claim released)' : '(claim NOT released)')
      await adminSupabase
        .from('processing_logs')
        .insert({
          request_id: requestId,
          level: 'warning',
          stage: 'pdf_assembly_failed',
          message: `PDF assembly failed (will retry on next poll): ${message.slice(0, 200)}`,
          metadata: { claim_released: run.released },
        })
      return NextResponse.json({ message, claimReleased: run.released }, { status: 500 })
    }

    console.log(`[generate-pdf] ${requestId} — ${run.result.pageCount} pages, ${run.result.fileSizeBytes} bytes, ${run.result.renderTimeMs}ms`)
    return NextResponse.json({ requestId, status: 'generated', ...run.result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-pdf] error:', requestId, message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
