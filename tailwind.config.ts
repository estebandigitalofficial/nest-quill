import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
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
        parchment: {
          DEFAULT: '#F8F5EC',
          dark:    '#ede9dc',
        },
        charcoal: {
          DEFAULT: '#2E2E2E',
          light:   '#4a4a4a',
        },
      },
    },
  },
  plugins: [],
}

export default config
