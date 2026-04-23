import { z } from 'zod'

const ILLUSTRATION_STYLES = [
  'watercolor',
  'cartoon',
  'storybook',
  'pencil_sketch',
  'digital_art',
] as const

const PLAN_TIERS = ['free', 'single', 'story_pack', 'story_pro', 'educator'] as const
const STORY_LENGTHS = [8, 16, 24, 32] as const

export const STORY_TONES = [
  'adventurous',
  'magical',
  'funny',
  'heartwarming',
  'educational',
  'brave',
] as const

export type StoryTone = (typeof STORY_TONES)[number]

export const storyFormSchema = z.object({
  // ── Plan ──────────────────────────────────────────────────────────────────
  planTier: z.enum(PLAN_TIERS).default('free'),

  // ── Child details ─────────────────────────────────────────────────────────
  childName: z
    .string()
    .min(1, "Please enter the child's name")
    .max(80, 'Name must be 80 characters or less')
    .trim(),

  childAge: z
    .number({ required_error: 'Please select an age group', invalid_type_error: 'Please select an age group' })
    .int()
    .min(1)
    .max(12),

  childDescription: z
    .string()
    .max(400, 'Description must be 400 characters or less')
    .trim()
    .optional(),

  // ── Story details ─────────────────────────────────────────────────────────
  storyTheme: z
    .string()
    .min(3, 'Please choose or describe a theme')
    .max(100, 'Theme must be 100 characters or less')
    .trim(),

  storyTone: z
    .array(z.enum(STORY_TONES))
    .min(1, 'Please choose at least one tone')
    .max(3, 'Choose up to 3 tones'),

  storyLength: z
    .number()
    .refine(
      (val): val is 8 | 16 | 24 | 32 => STORY_LENGTHS.includes(val as 8 | 16 | 24 | 32),
      { message: 'Please choose a story length' }
    ),

  storyMoral: z
    .string()
    .max(120, 'Must be 120 characters or less')
    .trim()
    .optional(),

  // ── Style & extras ────────────────────────────────────────────────────────
  illustrationStyle: z.enum(ILLUSTRATION_STYLES, {
    errorMap: () => ({ message: 'Please choose an illustration style' }),
  }),

  dedicationText: z
    .string()
    .max(300, 'Dedication must be 300 characters or less')
    .trim()
    .optional(),

  supportingCharacters: z
    .string()
    .max(300, 'Must be 300 characters or less')
    .trim()
    .optional(),

  authorName: z
    .string()
    .max(80, 'Must be 80 characters or less')
    .trim()
    .optional(),

  closingMessage: z
    .string()
    .max(200, 'Must be 200 characters or less')
    .trim()
    .optional(),

  customNotes: z
    .string()
    .max(500, 'Notes must be 500 characters or less')
    .trim()
    .optional(),

  // ── Delivery ──────────────────────────────────────────────────────────────
  userEmail: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
})

export type StoryFormValues = z.infer<typeof storyFormSchema>

// Server-side helper
export function validateStoryForm(data: unknown): StoryFormValues {
  const result = storyFormSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.errors[0]
    throw new Error(
      firstError
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Invalid form data'
    )
  }
  return result.data
}