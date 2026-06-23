import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        'jfb-noir':      '#1a1a1a',
        'jfb-noir-doux': '#2e2e2e',
        'jfb-rose':      '#FF3399',
        'jfb-rose-dk':   '#CC0070',
        'jfb-beige':     '#F5F0E8',
        'jfb-beige-dk':  '#E8E0D0',
        'jfb-gris':      '#5a5a5a',
        'jfb-gris-cl':   '#909090',
        'jfb-bordure':   '#e8e8e8',
        'jfb-subtil':    '#f9f9f7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    }
  },
  plugins: []
}
