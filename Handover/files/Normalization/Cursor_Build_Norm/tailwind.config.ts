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
        // Landing page tokens (cream editorial)
        landing: {
          bg: '#F4F3EE',
          fg: '#0A0A0A',
          muted: '#6B6B66',
          border: '#E5E3DC',
        },
        // App tokens (cream — same family as landing)
        app: {
          bg: '#F4F3EE',
          surface: '#FFFFFF',
          hover: 'rgba(10,10,10,0.03)',
          'active-bg': 'rgba(10,10,10,0.07)',
          border: '#E5E3DC',
          'border-hover': '#D5D3CC',
          text: '#0A0A0A',
          muted: '#6B6B66',
          subtle: '#B5B3AC',
          accent: '#0A0A0A',
          'accent-hover': '#1F1F1F',
          warn: '#B8860B',
          'warn-bg': '#FDF8E8',
          'warn-border': '#E5D5A0',
        },
        // Legacy mappings (remapped to cream)
        obsidian: {
          base: '#F4F3EE',
          layer1: '#FFFFFF',
          layer2: '#F0EFEA',
          card: '#FFFFFF',
          hover: '#F0EFEA',
          border: '#E5E3DC',
          'border-hover': '#D5D3CC',
        },
        electric: {
          cyan: '#0A0A0A',
          'cyan-dark': '#1F1F1F',
          purple: '#6B6B66',
          'purple-dark': '#3A3A36',
        },
        neon: {
          green: '#2D8A56',
          red: '#C53030',
          yellow: '#B8860B',
          blue: '#2B6CB0',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
        serif: ['DM Serif Display', 'Georgia', 'serif'],
      },
      fontSize: {
        'micro': ['10px', '14px'],
        'tiny': ['11px', '16px'],
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'fade-down': 'fadeDown 0.7s ease-out forwards',
        'draw-line': 'drawLine 1s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          'from': { opacity: '0', transform: 'translateY(-12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        drawLine: {
          'to': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
