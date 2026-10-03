'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getDictionary, LANG_COOKIE, LANG_COOKIE_MAX_AGE, resolveLang, htmlLang, type Dictionary, type Lang } from './index'

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Dictionary
}

const Ctx = createContext<LanguageCtx>({
  lang: 'en',
  setLang: () => {},
  t: getDictionary('en'),
})

const STORAGE_KEY = LANG_COOKIE

/**
 * The server reads the cookie and passes `initialLang`, so the first paint
 * is already in the right language (no flash, no hydration mismatch).
 * Switching writes the cookie, mirrors it to localStorage for older tabs,
 * updates <html lang>, and refreshes server components in place.
 */
export function LanguageProvider({ children, initialLang = 'en' }: { children: ReactNode; initialLang?: Lang }) {
  const router = useRouter()
  const [lang, setLangState] = useState<Lang>(resolveLang(initialLang))

  const setLang = useCallback((l: Lang) => {
    const next = resolveLang(l)
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch { /* storage may be unavailable */ }
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=${LANG_COOKIE_MAX_AGE};SameSite=Lax`
    document.documentElement.lang = htmlLang(next)
    router.refresh()
  }, [router])

  return (
    <Ctx.Provider value={{ lang, setLang, t: getDictionary(lang) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLanguage() {
  return useContext(Ctx)
}
