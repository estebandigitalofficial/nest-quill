/**
 * Localization core (pure — safe for Node tests, server and client).
 *
 * One dictionary per language (dict/en.ts is the source of truth, dict/es.ts
 * is typed against it). The chosen language lives in the `nq_lang` cookie so
 * server components, client components and emails all read the same value,
 * signed in or not. English is the default.
 */
import { en, type Dictionary } from './dict/en.ts'
import { es } from './dict/es.ts'

export type Lang = 'en' | 'es'
export const LANGS: readonly Lang[] = ['en', 'es']
export const DEFAULT_LANG: Lang = 'en'
export const LANG_COOKIE = 'nq_lang'
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const dictionaries: Record<Lang, Dictionary> = { en, es }
export type { Dictionary }

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'es'
}

/** Any stored/received value → a supported language, defaulting to English. */
export function resolveLang(v: unknown): Lang {
  return isLang(v) ? v : DEFAULT_LANG
}

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang] ?? en
}

/** Fill {placeholders}. Unknown placeholders are left untouched, never thrown. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/**
 * Look up a dynamic key (e.g. a nav href or an error code) in a record and
 * fall back to the English value, then to the supplied fallback. Customers
 * never see a raw key.
 */
export function pick(lang: Lang, select: (d: Dictionary) => Record<string, string>, key: string, fallback: string): string {
  const v = select(getDictionary(lang))[key] ?? select(en)[key]
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

/** Nav / footer label for an href, in the current language. */
export function navLabel(lang: Lang, href: string, fallback: string): string {
  return pick(lang, d => d.nav.links, href, fallback)
}

/** Plural helper for the few counted nouns the UI shows. */
export function plural(lang: Lang, forms: { one: string; other: string }, n: number): string {
  const d = n === 1 ? forms.one : forms.other
  return fill(d, { n })
}

/** The HTML lang attribute value. */
export function htmlLang(lang: Lang): string {
  return lang === 'es' ? 'es' : 'en'
}

/** Customer-facing message for a server error code, in the current language. */
export function errorMessage(lang: Lang, code: string | null | undefined, serverMessage?: string | null): string {
  const d = getDictionary(lang)
  if (code && d.wizard.errors.codes[code]) return d.wizard.errors.codes[code]
  if (serverMessage && lang === 'en') return serverMessage
  return d.wizard.errors.generic
}
