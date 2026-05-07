// Folds the structured wizard fields (traits/setting/conflict/goal) into the
// existing string fields the generation pipeline already understands. The DB
// CHECK on story_requests.story_theme was widened to 280 chars in
// 20240047_relax_story_theme_check.sql; phrases below are tight regardless
// to keep the synthesized sentence readable.

import type { Setting, Conflict, Goal, Trait } from '@/lib/validators/story-form'

const SETTING_PHRASES: Record<Setting, string> = {
  jungle: 'a lush jungle of hidden paths and curious creatures',
  space: 'a journey across stars and distant planets',
  ocean: 'an underwater adventure beneath the waves',
  school: 'a busy day at school with classmates and teachers',
  fantasy_kingdom: 'a fantasy kingdom of castles, knights, and magic',
  city: 'a bustling city of streets, parks, and neighbors',
}

const CONFLICT_PHRASES: Record<Conflict, string> = {
  lost_something:    'something important must be found',
  save_someone:      'someone needs help and only the hero can save them',
  solve_mystery:     'a mystery must be unraveled clue by clue',
  overcome_fear:     'a fear must be faced and overcome',
  win_challenge:     'a hard challenge must be won through effort',
  make_new_friend:   'a new friend is waiting to be made',
  face_a_bully:      'a bully must be stood up to with kindness',
  protect_home:      'home and family must be kept safe',
  survive_storm:     'a storm must be weathered together',
  cross_a_journey:   'a long journey must be crossed',
  mend_a_friendship: 'a broken friendship must be mended',
  learn_a_truth:     'a hidden truth must come to light',
}

const GOAL_PHRASES: Record<Goal, string> = {
  learn_lesson:        'learning a lesson along the way',
  complete_mission:    'finishing the mission no matter what',
  help_others:         'helping others and making a difference',
  discover_something:  'discovering something amazing',
  find_courage:        'finding the courage inside',
  find_belonging:      'finding where one belongs',
  become_a_hero:       'rising to become the hero of the day',
  protect_someone:     'protecting someone they love',
  restore_balance:     'restoring balance to the world',
  celebrate_together:  'celebrating together at the end',
}

const TRAIT_LABELS: Record<Trait, string> = {
  brave:         'brave',
  curious:       'curious',
  funny:         'funny',
  shy:           'shy',
  leader:        'a natural leader',
  adventurous:   'adventurous',
  loyal:         'loyal',
  clever:        'clever',
  creative:      'creative',
  determined:    'determined',
  kind:          'kind',
  energetic:     'energetic',
  calm:          'calm',
  mischievous:   'mischievous',
  thoughtful:    'thoughtful',
  imaginative:   'imaginative',
  athletic:      'athletic',
  optimistic:    'optimistic',
  resilient:     'resilient',
  compassionate: 'compassionate',
}

export interface StructuredSelections {
  traits?: readonly string[]
  /** Free-text trait the user typed. Trimmed and length-capped before use. */
  customTrait?: string | null
  setting?: string
  conflict?: string
  goal?: string
}

/**
 * Build a story-theme sentence from the structured choices. Used when the
 * user hasn't typed a custom theme. Returns null when there's nothing to
 * synthesize (caller falls back to the existing storyTheme value).
 */
export function synthesizeTheme(s: StructuredSelections): string | null {
  const setting = s.setting ? SETTING_PHRASES[s.setting as Setting] : null
  const conflict = s.conflict ? CONFLICT_PHRASES[s.conflict as Conflict] : null
  const goal = s.goal ? GOAL_PHRASES[s.goal as Goal] : null

  if (!setting && !conflict && !goal) return null

  const parts: string[] = []
  if (setting) parts.push(`A story set in ${setting}`)
  if (conflict) parts.push(`where ${conflict}`)
  if (goal) parts.push(goal)
  return parts.join(', ') + '.'
}

/**
 * Trait phrase, e.g. "Main character is brave, curious, and creative." A
 * single user-typed customTrait gets appended to the list when present.
 * Returns null when neither traits nor a custom trait were provided.
 */
export function synthesizeTraitsLine(traits?: readonly string[], customTrait?: string | null): string | null {
  const labels: string[] = []
  for (const t of traits ?? []) {
    if (t in TRAIT_LABELS) labels.push(TRAIT_LABELS[t as Trait])
  }
  const custom = customTrait?.trim()
  if (custom) labels.push(custom.toLowerCase().slice(0, 40))
  if (labels.length === 0) return null
  if (labels.length === 1) return `Main character is ${labels[0]}.`
  if (labels.length === 2) return `Main character is ${labels[0]} and ${labels[1]}.`
  return `Main character is ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}.`
}

/**
 * Append non-empty extras to an existing customNotes string without
 * clobbering it. Caller passes the current text + a list of additions.
 */
export function mergeIntoCustomNotes(existing: string | null | undefined, additions: (string | null | undefined)[]): string | undefined {
  const lines = [existing?.trim(), ...additions.map(a => a?.trim())]
    .filter((s): s is string => !!s && s.length > 0)
  if (lines.length === 0) return undefined
  return lines.join('\n').slice(0, 500)
}
