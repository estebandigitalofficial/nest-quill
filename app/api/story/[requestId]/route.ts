import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NotFoundError, toApiError } from '@/lib/utils/errors'
import { COVER_BUCKET, pickCoverPath } from '@/lib/services/cover'
import { isSettingEnabled } from '@/lib/settings/gates'
import { deleteFailedStory, type StoryDeletionClient } from '@/lib/deletion/deleteFailedStory'
import { CUSTOMER_DELETION_FLAG_KEY, handleCustomerStoryDelete } from '@/lib/deletion/customerDeleteRoute'
import type { StoryRequest } from '@/types/database'
import type { StoryContentResponse } from '@/types/story'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const guestToken = request.cookies.get('guest_token')?.value

    const adminSupabase = createAdminClient()

    // Verify ownership via story_requests
    const { data: storyReqData, error: reqError } = await adminSupabase
      .from('story_requests')
      .select('id, user_id, guest_token, status')
      .eq('id', requestId)
      .single()

    if (reqError || !storyReqData) throw new NotFoundError('Story')

    const storyReq = storyReqData as unknown as Pick<StoryRequest, 'id' | 'user_id' | 'guest_token' | 'status'>

    const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim()).filter(Boolean)
    let isAdmin = !!user?.email && adminEmails.includes(user.email)
    if (!isAdmin && user) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (profile?.is_admin === true) isAdmin = true
    }
    const isOwner =
      isAdmin ||
      storyReq.status === 'complete' ||
      (user && storyReq.user_id === user.id) ||
      (guestToken && storyReq.guest_token === guestToken)

    if (!isOwner) throw new NotFoundError('Story')

    // Fetch the generated story
    const { data: story, error: storyError } = await adminSupabase
      .from('generated_stories')
      .select('*')
      .eq('request_id', requestId)
      .single()

    if (storyError || !story) throw new NotFoundError('Story content')

    // Fetch scenes ordered by page number
    const { data: scenes, error: scenesError } = await adminSupabase
      .from('story_scenes')
      .select('page_number, page_text, image_prompt, image_status, storage_path')
      .eq('request_id', requestId)
      .order('page_number', { ascending: true })

    if (scenesError) throw new NotFoundError('Story scenes')

    // Batch sign image URLs for all completed pages
    const imagePaths = (scenes ?? [])
      .filter(s => s.image_status === 'complete' && s.storage_path)
      .map(s => s.storage_path as string)

    const imageUrlMap: Record<string, string> = {}
    if (imagePaths.length > 0) {
      const { data: signed } = await adminSupabase.storage
        .from('story-images')
        .createSignedUrls(imagePaths, 60 * 60 * 24 * 7)
      signed?.forEach(item => {
        if (item.signedUrl && item.path) imageUrlMap[item.path] = item.signedUrl
      })
    }

    // Canonical cover artwork (Phase 1F): one signed URL, or null so the
    // reader keeps its typographic cover. Never a broken image.
    const coverPath = pickCoverPath(story as unknown as { cover_status?: string | null; cover_storage_path?: string | null })
    let coverUrl: string | null = null
    if (coverPath) {
      const { data: signedCover } = await adminSupabase.storage
        .from(COVER_BUCKET)
        .createSignedUrl(coverPath, 60 * 60 * 24 * 7)
      coverUrl = signedCover?.signedUrl ?? null
    }

    return NextResponse.json<StoryContentResponse>({
      requestId,
      title: story.title,
      subtitle: story.subtitle ?? null,
      authorLine: story.author_line ?? 'A Nest & Quill Original',
      dedication: story.dedication ?? null,
      synopsis: story.synopsis ?? null,
      coverUrl,
      pages: (scenes ?? []).map((s: Record<string, unknown>) => ({
        pageNumber: s.page_number as number,
        text: s.page_text as string,
        imagePrompt: s.image_prompt as string,
        imageStatus: s.image_status as string,
        storagePath: (s.storage_path as string | null) ?? null,
        imageUrl: imageUrlMap[(s.storage_path as string) ?? ''] ?? null,
      })),
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}

// DELETE /api/story/[requestId] — 3C-3. The signed-in owner of an ARCHIVED
// FAILED story asks for its permanent deletion. Everything destructive runs
// inside the 3C-2 service (lib/deletion/deleteFailedStory.ts) and the
// 20240074/20240075 SQL functions; this handler supplies only the session
// user id, the route id and the exposure gate. No body or query parameter is
// read, so nothing in the request can name a different user.
//
// Contract (lib/deletion/customerDeleteRoute.ts): 404 while the
// `customer_story_deletion_enabled` setting is off or for an unknown /
// malformed / another customer's id; 401 unauthenticated; 409 not eligible;
// 200 { ok, state: 'deleted' } for a fresh or repeated deletion; 202
// { ok, state: 'cleanup_pending' } when the rows are gone but storage
// cleanup did not finish (the daily 3C-6 sweep completes it); 500 generic.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params
  const { status, body } = await handleCustomerStoryDelete(
    {
      isEnabled: () => isSettingEnabled(CUSTOMER_DELETION_FLAG_KEY, false),
      getUserId: async () => {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id ?? null
      },
      // The any-typed admin client trips TS2589 against the structural service type.
      deleteStory: (input) => deleteFailedStory(createAdminClient() as unknown as StoryDeletionClient, input),
      log: (entry) => console.info('[story-delete]', JSON.stringify(entry)),
    },
    requestId,
  )
  return NextResponse.json(body, { status })
}
