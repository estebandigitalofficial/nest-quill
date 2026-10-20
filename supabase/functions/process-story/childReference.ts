// Explicit child reference selection (2026-10-20) — worker-side contract.
//
// Pure module: no Deno / Supabase / network. Mirrors lib/story/childReference.ts
// in the web app (the Edge Function cannot import from lib/); the Node test
// lib/story/childReference.test.ts pins the two copies equal.
//
// The parent chooses on the wizard how the main child is referred to. The
// submit route writes the choice into story_requests.custom_notes as a
// labelled line ("Refer to the child as: she/her"); parsePersonalization in
// prompt.ts reads it back. A row without the line (every story created
// before the feature) yields null, and null means "add nothing": the prompts
// and the visual bible stay exactly as they were, so no historical story is
// ever assigned pronouns or a gender after the fact.

export const CHILD_REFERENCES = ['he_him', 'she_her', 'they_them', 'name_only'] as const
export type ChildReference = (typeof CHILD_REFERENCES)[number]

export const CHILD_REFERENCE_LINE_LABEL = 'Refer to the child as'

export const CHILD_REFERENCE_TOKENS: Record<ChildReference, string> = {
  he_him: 'he/him',
  she_her: 'she/her',
  they_them: 'they/them',
  name_only: 'name only',
}

export function isChildReference(v: unknown): v is ChildReference {
  return typeof v === 'string' && (CHILD_REFERENCES as readonly string[]).includes(v)
}

/** Strict: only the four known tokens parse; anything else is null (never a guess). */
export function parseChildReferenceToken(value: unknown): ChildReference | null {
  const v = String(value ?? '').trim().toLowerCase()
  for (const key of CHILD_REFERENCES) if (CHILD_REFERENCE_TOKENS[key] === v) return key
  return null
}

/** Pronoun tag for character anchors in illustration prompts; empty for name-only and for rows without a selection. */
export function pronounTag(reference: ChildReference | null | undefined): string {
  switch (reference) {
    case 'he_him': return ' (he/him)'
    case 'she_her': return ' (she/her)'
    case 'they_them': return ' (they/them)'
    default: return ''
  }
}

/**
 * The instruction block the text prompts carry for a selection. English and
 * Spanish books need different grammar guidance: Spanish marks gender on
 * articles, adjectives and participles, so "by name only" and "they/them"
 * need explicit agreement rules, not just a pronoun swap.
 */
export function childReferenceInstruction(name: string, reference: ChildReference, language: string): { fact: string; rule: string; imageRule: string } {
  const es = language === 'es'
  const how = es
    ? {
        he_him: `with the pronoun "él" and masculine agreement for every article, adjective and participle that refers to ${name} ("el niño", "cansado", "listo")`,
        she_her: `with the pronoun "ella" and feminine agreement for every article, adjective and participle that refers to ${name} ("la niña", "cansada", "lista")`,
        they_them: `with the gender-neutral pronoun "elle" and -e endings on every adjective and participle that refers to ${name} ("cansade", "liste"); never "él" or "ella", and never a gendered noun such as "el niño" or "la niña" for ${name}. When a sentence would read awkwardly, use ${name}'s name or rephrase it`,
        name_only: `by name only: never "él", "ella" or "elle" for ${name}, and never a gendered noun such as "el niño" or "la niña". Adjectives and participles that refer to ${name} must not mark gender: prefer invariable forms ("feliz", "valiente", "fuerte", "alegre", "triste", "capaz") or rephrase with "tener", "sentir" or "estar" plus a noun ("tiene miedo", "siente alegría"). Keep it natural: vary the sentence subject, join short sentences and use the name at most once per sentence`,
      }[reference]
    : {
        he_him: `with he/him pronouns`,
        she_her: `with she/her pronouns`,
        they_them: `with they/them pronouns (singular "they" with plural verb forms: "they are", "they were")`,
        name_only: `by name only: never he, she or they for ${name}. Keep it natural: vary sentence subjects, join short sentences, use the name at most once per sentence and let actions carry the rest; possessives use the name ("${name}'s hat"); never substitute "the child", "the boy", "the girl" or any other gendered noun for the name`,
      }[reference]
  const factValue = reference === 'name_only' ? 'by name only (no pronouns)' : CHILD_REFERENCE_TOKENS[reference]
  return {
    fact: `Refer to ${name} as: ${factValue}`,
    rule: `Child reference: the family chose how ${name} is referred to — ${how}. Use exactly that on every page, in the text and in every image_description. This choice is explicit and is the only source for ${name}'s pronouns: never infer different pronouns or a gender from the name, the description or anything else. It says nothing about appearance: describe ${name} only with the appearance facts given and never add gender-typed hair, clothing or features.`,
    imageRule: reference === 'name_only'
      ? `In every image_description call the child "${name}" by name, never with a pronoun and never as "a boy" or "a girl"; describe only the listed appearance facts.`
      : `In every image_description call the child "${name}" by name with the same pronouns as the story, never as "a boy" or "a girl"; describe only the listed appearance facts.`,
  }
}
