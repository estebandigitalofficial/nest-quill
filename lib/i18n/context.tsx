'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { translations, type Lang } from './translations'

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: typeof translations['en']
}

const Ctx = createContext<LanguageCtx>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
})

const STORAGE_KEY = 'nq_lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (stored === 'en' || stored === 'es') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
    document.cookie = `${STORAGE_KEY}=${l};path=/;max-age=31536000;SameSite=Lax`
  }

  return (
    <Ctx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLanguage() {
  return useContext(Ctx)
}
