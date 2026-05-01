'use client'

import { usePathname } from 'next/navigation'
import { useToggles } from './ThemeToggles'

const btnClass = `
  w-9 h-9 rounded-full flex items-center justify-center
  bg-oxford/10 dark:bg-white/10 backdrop-blur-sm
  border border-oxford/20 dark:border-white/15
  text-oxford dark:text-gray-200
  shadow-sm hover:shadow-md hover:scale-110 transition-all
`.trim()

export default function FloatingToggles() {
  const { mounted, lang, setLang, cycleTheme, ThemeIcon } = useToggles()
  const pathname = usePathname()

  if (!mounted) return null

  // On admin pages, hide on desktop — the header has its own toggles
  const adminDesktopHide = pathname.startsWith('/admin') ? 'sm:hidden' : ''

  return (
    <div className={`fixed top-[68px] right-3 z-40 flex flex-row gap-1.5 ${adminDesktopHide}`}>
      <button
        role="switch"
        aria-checked={lang === 'es'}
        onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
        title={lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
        className={`${btnClass} text-[11px] font-bold`}
      >
        {lang.toUpperCase()}
      </button>

      <button
        onClick={cycleTheme}
        title={`Theme: ${mounted ? 'click to change' : ''}`}
        className={btnClass}
      >
        <ThemeIcon />
      </button>
    </div>
  )
}
