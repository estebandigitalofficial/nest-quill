// Server-only: read the visitor's language from the cookie.
// Never import from a client component (next/headers).
import { cookies } from 'next/headers'
import { LANG_COOKIE, resolveLang, getDictionary, type Lang } from './index'

export async function getServerLang(): Promise<Lang> {
  try {
    const store = await cookies()
    return resolveLang(store.get(LANG_COOKIE)?.value)
  } catch {
    return 'en'
  }
}

export async function getServerDictionary() {
  const lang = await getServerLang()
  return { lang, t: getDictionary(lang) }
}

/** Language for a request row: the persisted locale, else English. */
export function langFromLocale(locale: unknown): Lang {
  return resolveLang(locale)
}
