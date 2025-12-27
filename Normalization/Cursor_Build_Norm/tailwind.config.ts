import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cisco: {
          blue: '#049FD9',
          navy: '#1B2C3E',
          green: '#6CC24A',
          red: '#E2231A',
          light: '#F4F5F7',
        },
        dark: {
          bg: '#0a1628',
          card: '#0d1b2a',
          border: '#1e3a5f',
        },
        light: {
          bg: '#f8f9fa',
          card: '#ffffff',
          border: '#e5e7eb',
        },
        accent: {
          cyan: '#049FD9', // Mapped to Cisco Blue
          blue: '#049FD9', // Mapped to Cisco Blue
        },
      },
    },
  },
  plugins: [],
}
export default config
