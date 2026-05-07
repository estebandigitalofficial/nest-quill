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

// ── Tier-aware tones ──────────────────────────────────────────
// Existing tones stay in CHILD so legacy clients keep working.
// TEEN extends CHILD; ADULT adds darker / mature options that are
// only selectable when ageTier === 'adult' && adultConsent === true.
export const CHILD_TONES = [
  'adventurous',
  'magical',
  'funny',
  'heartwarming',
  'educational',
  'brave',
  'calm',
  'inspiring',
  'silly',
  'emotional',
] as const

export const TEEN_TONES = [
  'adventurous',
  'inspiring',
  'funny',
  'emotional',
  'dramatic',
  'suspenseful',
  'romantic',
] as const

export const ADULT_TONES = [
  'dark',
  'romantic',
  'suspenseful',
  'dramatic',
  'psychological',
  'mature_humor',
] as const

export const ADULT_ONLY_TONES = ['dark', 'psychological', 'mature_humor'] as const

export const STORY_TONES = Array.from(
  new Set([...CHILD_TONES, ...TEEN_TONES, ...ADULT_TONES])
) as readonly string[]

export type StoryTone = (typeof STORY_TONES)[number]

// ── Structured story selections ───────────────────────────────
export const AGE_TIERS = ['child', 'teen', 'adult'] as const

// Trait list expanded from 6 → 20. Internal field name stays `traits`;
// per-trait label lives in the cards module so wording can drift without
// touching the schema.
export const TRAITS = [
  'brave', 'curious', 'funny', 'shy', 'leader', 'adventurous',
  'loyal', 'clever', 'creative', 'determined', 'kind', 'energetic',
  'calm', 'mischievous', 'thoughtful', 'imaginative', 'athletic',
  'optimistic', 'resilient', 'compassionate',
] as const

// `setting` field name kept for back-compat with prompts/synthesis;
// user-facing copy throughout the wizard reads "theme" instead.
export const SETTINGS = ['jungle', 'space', 'ocean', 'school', 'fantasy_kingdom', 'city'] as const

// Conflicts expanded with more variety so users have meaningful choices
// without typing.
export const CONFLICTS = [
  'lost_something', 'save_someone', 'solve_mystery', 'overcome_fear', 'win_challenge',
  'make_new_friend', 'face_a_bully', 'protect_home', 'survive_storm',
  'cross_a_journey', 'mend_a_friendship', 'learn_a_truth',
] as const

// Goals widened with more emotional and adventure-shaped options.
export const GOALS = [
  'learn_lesson', 'complete_mission', 'help_others', 'discover_something',
  'find_courage', 'find_belonging', 'become_a_hero', 'protect_someone',
  'restore_balance', 'celebrate_together',
] as const

export type AgeTier = (typeof AGE_TIERS)[number]
export type Trait = (typeof TRAITS)[number]
export type Setting = (typeof SETTINGS)[number]
export type Conflict = (typeof CONFLICTS)[number]
export type Goal = (typeof GOALS)[number]

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
    .max(99),

  childDescription: z
    .string()
    .max(400, 'Description must be 400 characters or less')
    .trim()
    .optional(),

  // ── Story details ─────────────────────────────────────────────────────────
  // Theme supports either a free-form user phrase or a synthesized sentence
  // built from theme + conflict + goal. 280 char ceiling matches the DB
  // CHECK constraint relaxed in 20240047_relax_story_theme_check.sql and
  // gives synthesis comfortable headroom without truncation.
  storyTheme: z
    .string()
    .min(3, 'Please choose or describe a theme')
    .max(280, 'Theme must be 280 characters or less')
    .trim(),

  storyTone: z
    .array(z.string())
    .min(1, 'Please choose at least one tone')
    .max(3, 'Choose up to 3 tones')
    .refine(
      (tones) => tones.every(t => (STORY_TONES as readonly string[]).includes(t)),
      { message: 'Unknown tone selected' }
    ),

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

  // ── Learning mode ─────────────────────────────────────────────────────────
  learningMode: z.boolean().optional().default(false),

  learningSubject: z.string().max(60).trim().optional(),

  learningGrade: z.number().int().min(1).max(12).optional(),

  learningTopic: z
    .string()
    .max(200, 'Topic must be 200 characters or less')
    .trim()
    .optional(),

  // ── Structured selections (all optional — derived for the prompt) ────────
  ageTier: z.enum(AGE_TIERS).optional(),
  traits: z.array(z.enum(TRAITS)).max(3, 'Pick up to 3 traits').optional(),
  customTrait: z.string().max(40, 'Keep custom trait short').trim().optional(),
  setting: z.enum(SETTINGS).optional(),
  conflict: z.enum(CONFLICTS).optional(),
  goal: z.enum(GOALS).optional(),

  // ── Adult consent ────────────────────────────────────────────────────────
  adultConsent: z.boolean().optional(),

  // ── Delivery ──────────────────────────────────────────────────────────────
  userEmail: z
    .string()
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
}).superRefine((data, ctx) => {
  // Adult-only tones require adult tier + explicit consent. Learning
  // mode never gets adult tones.
  const adultOnly = ADULT_ONLY_TONES as readonly string[]
  const usesAdultTone = data.storyTone.some(t => adultOnly.includes(t))
  if (usesAdultTone) {
    if (data.learningMode) {
      ctx.addIssue({
        path: ['storyTone'],
        code: z.ZodIssueCode.custom,
        message: 'Adult tones are not available for learning stories.',
      })
    }
    if (data.ageTier !== 'adult' || data.adultConsent !== true) {
      ctx.addIssue({
        path: ['storyTone'],
        code: z.ZodIssueCode.custom,
        message: 'Adult-only tones require the Adult (18+) tier and consent.',
      })
    }
  }
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