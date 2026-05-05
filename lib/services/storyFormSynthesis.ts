// Folds the new structured wizard fields (traits/setting/conflict/goal) into
// the existing string fields the generation pipeline already understands.
// This keeps the API/DB contract stable — no migration is required and older
// clients that don't send the new fields still work.

import type { Setting, Conflict, Goal, Trait } from '@/lib/validators/story-form'

const SETTING_PHRASES: Record<Setting, string> = {
  jungle: 'a lush jungle full of hidden paths and curious creatures',
  space: 'a journey through space among stars, moons, and distant planets',
  ocean: 'an underwater adventure beneath the waves',
  school: 'a busy day at school with classmates and teachers',
  fantasy_kingdom: 'a fantasy kingdom of castles, knights, and magic',
  city: 'a bustling city full of streets, parks, and people',
}

const CONFLICT_PHRASES: Record<Conflict, string> = {
  lost_something: 'something important has been lost and must be found',
  save_someone: 'someone needs help and only the hero can save them',
  solve_mystery: 'a mystery needs to be unraveled, clue by clue',
  overcome_fear: 'a fear must be faced and overcome',
  win_challenge: 'a difficult challenge must be won through effort and heart',
}

const GOAL_PHRASES: Record<Goal, string> = {
  learn_lesson: 'learning an important lesson along the way',
  complete_mission: 'completing the mission no matter the obstacles',
  help_others: 'helping others and making a difference',
  discover_something: 'discovering something amazing and new',
}

const TRAIT_LABELS: Record<Trait, string> = {
  brave: 'brave',
  curious: 'curious',
  funny: 'funny',
  shy: 'shy',
  leader: 'a natural leader',
  adventurous: 'adventurous',
}

export interface StructuredSelections {
  traits?: readonly string[]
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
 * Trait phrase, e.g. "Hero is brave, curious, and a natural leader." Returns
 * null when no traits selected.
 */
export function synthesizeTraitsLine(traits?: readonly string[]): string | null {
  if (!traits || traits.length === 0) return null
  const labels = traits
    .filter((t): t is Trait => t in TRAIT_LABELS)
    .map(t => TRAIT_LABELS[t])
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
