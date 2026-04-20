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
        serif: ['Lora', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50:  '#fdf8f0',
          100: '#faefd8',
          200: '#f5ddb0',
          300: '#edc47e',
          400: '#e4a44a',
          500: '#dc8a28',
          600: '#c8711e',
          700: '#a5571b',
          800: '#84451e',
          900: '#6c3a1c',
        },
        forest: {
          50:  '#f0f7f0',
          100: '#dceddc',
          200: '#bbdabb',
          300: '#8ec08e',
          400: '#5f9e5f',
          500: '#3e7e3e',
          600: '#2e6530',
          700: '#265128',
          800: '#214122',
          900: '#1c361e',
        },
      },
    },
  },
  plugins: [],
}

export default config
