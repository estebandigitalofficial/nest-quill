import type { PlanTier, StoryStatus } from './database'

// ─── Story form data ─────────────────────────────────────────────────────────
// This is what the user fills out in the multi-step form.
// Matches the Zod schema in lib/validators/story-form.ts exactly.

export interface StoryFormData {
  // Step 1 — About the child
  childName: string
  childAge: number
  childDescription?: string

  // Step 2 — Story details
  storyTheme: string
  storyTone: string[]
  storyMoral?: string
  storyLength: 8 | 16 | 24 | 32
  illustrationStyle: IllustrationStyle
  customNotes?: string

  // Step 3 — Personal touches (some gated by plan)
  dedicationText?: string

  // Step 4 — Contact & plan
  userEmail: string
  planTier: PlanTier
}

// ─── Illustration styles ─────────────────────────────────────────────────────
export type IllustrationStyle =
  | 'watercolor'
  | 'cartoon'
  | 'storybook'
  | 'pencil_sketch'
  | 'digital_art'

export const ILLUSTRATION_STYLES: Record<IllustrationStyle, { label: string; description: string }> = {
  watercolor: {
    label: 'Watercolor',
    description: 'Soft, painterly illustrations with warm washes of color',
  },
  cartoon: {
    label: 'Cartoon',
    description: 'Bold outlines, bright colors, playful and expressive',
  },
  storybook: {
    label: 'Classic Storybook',
    description: "Timeless style reminiscent of beloved children's books",
  },
  pencil_sketch: {
    label: 'Pencil Sketch',
    description: 'Detailed hand-drawn look with gentle shading',
  },
  digital_art: {
    label: 'Digital Art',
    description: 'Modern, vibrant, polished digital illustrations',
  },
}

// ─── Story themes ─────────────────────────────────────────────────────────────
export const STORY_THEMES = [
  'Adventure in the forest',
  'Discovering a hidden treasure',
  'Making a new friend',
  'A magical birthday',
  'Helping someone in need',
  'A journey to outer space',
  'Life under the ocean',
  'Learning to be brave',
  'A day on the farm',
  'Custom theme...',
] as const

// ─── API response types ──────────────────────────────────────────────────────

export interface SubmitStoryResponse {
  requestId: string
  status: StoryStatus
  requiresPayment: boolean
  checkoutUrl?: string
}

export interface StoryStatusResponse {
  requestId: string
  status: StoryStatus
  progressPct: number
  statusMessage: string
  childName: string
  planTier: string
  signedUrl?: string
  completedAt?: string
}

export interface StoryContentPage {
  pageNumber: number
  text: string
  imagePrompt: string
  imageStatus: string
  storagePath: string | null
  imageUrl: string | null
}

export interface StoryContentResponse {
  requestId: string
  title: string
  subtitle: string | null
  authorLine: string
  dedication: string | null
  synopsis: string | null
  pages: StoryContentPage[]
}

// ─── Generated story structure ───────────────────────────────────────────────

export interface GeneratedStoryJSON {
  title: string
  subtitle: string
  synopsis: string
  dedication?: string
  pages: GeneratedPage[]
}

export interface GeneratedPage {
  page: number
  text: string
  image_description: string
}