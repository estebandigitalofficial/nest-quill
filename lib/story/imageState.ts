/**
 * Image-state semantics shared by the admin Command Center, the story status
 * route, the reader and the admin story detail page (Phase 2C).
 *
 * Pure: no Supabase, no React. Everything here is derived from fields that
 * already exist on story_scenes / processing_logs / app_settings, so legacy
 * rows need no migration.
 *
 * Vocabulary (never collapse one into another):
 *   complete  — an image exists for the scene
 *   pending   — image work has not completed (or was never attempted)
 *   failed    — generation was attempted and failed
 *   skipped   — generation was intentionally not attempted (flag / worker env)
 *   unknown   — a finished story with no images and no evidence either way
 */

// ── Operator-level state (Command Center, Beta Ops) ─────────────────────────

export interface ImageGenerationInputs {
  /** app_settings.image_generation_enabled (missing row counts as enabled). */
  imageGenEnabled: boolean
  /** SKIP_IMAGE_GENERATION === 'true' on the web host — mirrors the worker secret only if set here too. */
  skipEnv?: boolean
  /** Present only so callers can prove it is ignored: Beta Mode never affects images. */
  betaMode?: boolean
}

export type ImageGenerationState =
  | { state: 'active'; reason: null }
  | { state: 'disabled'; reason: 'flag' | 'worker_env' }

export function imageGenerationState(input: ImageGenerationInputs): ImageGenerationState {
  if (!input.imageGenEnabled) return { state: 'disabled', reason: 'flag' }
  if (input.skipEnv) return { state: 'disabled', reason: 'worker_env' }
  return { state: 'active', reason: null }
}

/** Short, provider-neutral tile copy for the Command Center. */
export function imageGenerationLabel(s: ImageGenerationState): { value: string; hint: string; tone: 'green' | 'amber' } {
  if (s.state === 'active') {
    return { value: 'Active', hint: 'Illustrations and covers are generated for new stories. Beta Mode has no effect on images.', tone: 'green' }
  }
  if (s.reason === 'flag') {
    return { value: 'Disabled (flag)', hint: 'image_generation_enabled is off — new stories complete text-only. Turn it on in Beta Ops.', tone: 'amber' }
  }
  return { value: 'Disabled (worker env)', hint: 'SKIP_IMAGE_GENERATION is set — new stories complete text-only until it is unset.', tone: 'amber' }
}

// ── Scene-level state ───────────────────────────────────────────────────────

export interface SceneImageFields {
  image_status?: string | null
  storage_path?: string | null
  last_error?: string | null
  generation_attempts?: number | null
}

export type SceneImageState = 'complete' | 'pending' | 'failed'

/**
 * A scene is complete only when the row says so AND an asset path exists;
 * a 'complete' row without a path (legacy inconsistency) is treated as
 * pending rather than inventing an image.
 */
export function sceneImageState(scene: SceneImageFields): SceneImageState {
  if (scene.image_status === 'complete' && scene.storage_path) return 'complete'
  if (scene.image_status === 'failed') return 'failed'
  return 'pending'
}

// ── Story-level state ───────────────────────────────────────────────────────

export type StoryImagesState =
  | 'complete'   // every scene has an image
  | 'partial'    // some scenes have images, the rest are pending or failed
  | 'pending'    // story still processing, images not finished
  | 'failed'     // story finished; generation was attempted and nothing/none succeeded
  | 'skipped'    // story finished; worker logged an intentional skip
  | 'unknown'    // story finished with no images and no evidence either way (legacy)
  | 'none'       // no scenes at all

export interface StoryImagesSummary {
  state: StoryImagesState
  total: number
  complete: number
  failed: number
  pending: number
}

export interface ProcessingLogLike { stage?: string | null; message?: string | null }

/** True when the worker recorded that it intentionally did not generate images. */
export function hasImageSkipEvidence(logs: ReadonlyArray<ProcessingLogLike> | null | undefined): boolean {
  if (!logs) return false
  return logs.some(l => l.stage === 'generate_images' && /^Image generation skipped/i.test(l.message ?? ''))
}

export function storyImagesSummary(input: {
  storyStatus: string
  scenes: ReadonlyArray<SceneImageFields>
  /** Pass the story's processing logs (or just the generate_images ones) when available. */
  logs?: ReadonlyArray<ProcessingLogLike> | null
}): StoryImagesSummary {
  const total = input.scenes.length
  let complete = 0, failed = 0, pending = 0
  for (const s of input.scenes) {
    const st = sceneImageState(s)
    if (st === 'complete') complete++
    else if (st === 'failed') failed++
    else pending++
  }
  const base = { total, complete, failed, pending }
  if (total === 0) return { state: 'none', ...base }
  if (complete === total) return { state: 'complete', ...base }
  if (complete > 0) return { state: 'partial', ...base }
  if (input.storyStatus !== 'complete' && input.storyStatus !== 'failed') return { state: 'pending', ...base }
  // Finished story, zero images:
  if (hasImageSkipEvidence(input.logs)) return { state: 'skipped', ...base }
  const attempted = failed > 0 || input.scenes.some(s => (s.generation_attempts ?? 0) > 0 || !!s.last_error)
  if (attempted) return { state: 'failed', ...base }
  return { state: 'unknown', ...base }
}

// ── Copy ────────────────────────────────────────────────────────────────────

/** Customer-facing placeholder for a page without an image. Never includes provider errors. */
export function readerPlaceholder(page: { imageUrl?: string | null; imageStatus?: string | null }, story: StoryImagesState): string | null {
  if (page.imageUrl) return null
  if (story === 'skipped') return 'Illustrations are not available for this book.'
  if (page.imageStatus === 'failed') return 'Illustration unavailable.'
  return 'Illustration unavailable.'
}

/** Admin chip suffix for the story detail header. */
export function adminImagesSuffix(summary: StoryImagesSummary): string {
  switch (summary.state) {
    case 'complete': return ''
    case 'partial': return summary.failed > 0 ? ' · some failed' : ' · some pending'
    case 'pending': return ' · pending'
    case 'failed': return ' · failed'
    case 'skipped': return ' · skipped (disabled)'
    case 'unknown': return ' · not generated'
    case 'none': return ''
  }
}

export function adminImagesTitle(summary: StoryImagesSummary): string {
  switch (summary.state) {
    case 'complete': return 'Every scene has an illustration.'
    case 'partial': return `${summary.complete}/${summary.total} illustrated · ${summary.failed} failed · ${summary.pending} pending.`
    case 'pending': return 'Illustrations are still being generated.'
    case 'failed': return 'Image generation was attempted and failed — see per-scene errors below.'
    case 'skipped': return 'The worker intentionally skipped illustrations (image_generation_enabled=false or SKIP_IMAGE_GENERATION) — see the generate_images log entry.'
    case 'unknown': return 'Completed without illustrations and no record of why (legacy run). Use "Generate illustrations" to backfill.'
    case 'none': return 'No scenes recorded.'
  }
}
