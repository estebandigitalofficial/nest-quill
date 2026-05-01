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
        // parchment and charcoal are CSS-variable-driven so they flip with the theme
        parchment: {
          DEFAULT: 'rgb(var(--parchment) / <alpha-value>)',
          dark:    'rgb(var(--parchment-dark) / <alpha-value>)',
        },
        charcoal: {
          DEFAULT: 'rgb(var(--charcoal) / <alpha-value>)',
          light:   'rgb(var(--charcoal-light) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}

export default config
