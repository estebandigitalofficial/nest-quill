import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'ls': { raw: '(orientation: landscape) and (max-height: 500px)' },
      },
      // Modernized type pairing (design_handoff_nestandquill_modernized),
      // loaded via next/font in app/layout.tsx. Mapped through CSS variables
      // so the whole site adopts Source Serif 4 (headings) + Archivo (body).
      fontFamily: {
        sans: ['var(--font-body)', 'Nunito', 'system-ui', 'sans-serif'],
        serif: ['var(--font-heading)', '"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Softened corners — middle ground between the handoff's radius-0 and
        // the old brand's pill/rounded-2xl look.
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '16px',
      },
      colors: {
        // Gold ramp aligned to the modernized handoff (#c59a00 primary).
        brand: {
          50:  '#fcf7e8',
          100: '#f8f0d6',
          200: '#efdfa8',
          300: '#e3c96f',
          400: '#d4b030',
          500: '#c59a00',
          600: '#a88300',
          700: '#866800',
          800: '#634d00',
          900: '#433400',
        },
        oxford: {
          DEFAULT: '#0f2140',
          light:   '#1a3a60',
          dark:    '#071826',
        },
        // admin panel — CSS-variable-driven, flips with theme
        adm: {
          bg:      'rgb(var(--adm-bg)      / <alpha-value>)',
          surface: 'rgb(var(--adm-surface) / <alpha-value>)',
          border:  'rgb(var(--adm-border)  / <alpha-value>)',
          text:    'rgb(var(--adm-text)    / <alpha-value>)',
          muted:   'rgb(var(--adm-muted)   / <alpha-value>)',
          subtle:  'rgb(var(--adm-subtle)  / <alpha-value>)',
        },
        parchment: {
          DEFAULT: '#fbf9f4',
          dark:    '#EDE9DC',
        },
        charcoal: {
          DEFAULT: '#2E2E2E',
          light:   '#4A4A4A',
        },
      },
    },
  },
  plugins: [],
}

export default config
