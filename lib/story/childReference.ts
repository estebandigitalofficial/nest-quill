// Explicit child reference selection (2026-10-20).
//
// The parent chooses, on the child step of the wizard, how the main child is
// referred to throughout the story: he/him, she/her, they/them, or by name
// only. The choice is explicit and authoritative. Nothing in the app or in
// the generation pipeline infers pronouns or gender from the child's name,
// appearance or any other personalization input, and there is deliberately
// no "let the story decide" option.
//
// Storage: the selection travels in story_requests.custom_notes as one more
// labelled line, exactly like the traits / conflict / goal lines the submit
// route already folds in (lib/services/storyFormSynthesis.ts):
//
//   Refer to the child as: she/her
//
// The worker parses it back out (supabase/functions/process-story/prompt.ts
// → parsePersonalization). No schema change, no migration, and a row that
// carries no such line (every story created before this feature) keeps the
// behaviour it always had: the prompts receive no reference instruction and
// no pronoun is ever assigned to it after the fact.
//
// The token strings below are mirrored in the worker (CHILD_REFERENCE_TOKENS
// in prompt.ts); lib/story/childReference.test.ts pins both copies equal.

export const CHILD_REFERENCES = ['he_him', 'she_her', 'they_them', 'name_only'] as const
export type ChildReference = (typeof CHILD_REFERENCES)[number]

/** Label of the custom_notes line. Case-insensitive on parse. */
export const CHILD_REFERENCE_LINE_LABEL = 'Refer to the child as'

/** The exact value written after the label for each selection. */
export const CHILD_REFERENCE_TOKENS: Record<ChildReference, string> = {
  he_him: 'he/him',
  she_her: 'she/her',
  they_them: 'they/them',
  name_only: 'name only',
}

export function isChildReference(v: unknown): v is ChildReference {
  return typeof v === 'string' && (CHILD_REFERENCES as readonly string[]).includes(v)
}

/**
 * The labelled custom_notes line for a selection, or null when the form
 * carried none (legacy clients). Never invents a value.
 */
export function synthesizeChildReferenceLine(reference: unknown): string | null {
  if (!isChildReference(reference)) return null
  return `${CHILD_REFERENCE_LINE_LABEL}: ${CHILD_REFERENCE_TOKENS[reference]}`
}

/** Strict inverse of the line value: only the four known tokens parse; anything else is null. */
export function parseChildReferenceToken(value: unknown): ChildReference | null {
  const v = String(value ?? '').trim().toLowerCase()
  for (const key of CHILD_REFERENCES) if (CHILD_REFERENCE_TOKENS[key] === v) return key
  return null
}
