'use client'

import { useToggles } from '@/components/ThemeToggles'

export default function AdminHeaderToggles() {
  const { mounted, lang, setLang, cycleTheme, ThemeIcon } = useToggles()
  if (!mounted) return null

  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={lang === 'es'}
        onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
        title={lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
        className="text-xs font-bold text-gray-400 hover:text-gray-200 transition-colors"
      >
        {lang.toUpperCase()}
      </button>
      <button
        onClick={cycleTheme}
        title={`Theme — click to change`}
        className="text-gray-400 hover:text-gray-200 transition-colors flex items-center"
      >
        <ThemeIcon />
      </button>
    </div>
  )
}
