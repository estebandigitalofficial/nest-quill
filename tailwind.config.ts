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
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50:  '#fdf9ec',
          100: '#f9f0cc',
          200: '#f2e099',
          300: '#e8c95c',
          400: '#ddb328',
          500: '#C99700',
          600: '#AE9142',
          700: '#8a6700',
          800: '#6b4f00',
          900: '#4d3900',
        },
        oxford: {
          DEFAULT: '#0C2340',
          light:   '#1a3a60',
          dark:    '#071828',
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
          DEFAULT: '#F8F5EC',
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
