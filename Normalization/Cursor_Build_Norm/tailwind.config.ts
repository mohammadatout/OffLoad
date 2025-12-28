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
        // Cisco Brand Colors
        cisco: {
          blue: '#049FD9',
          navy: '#1B2C3E',
          green: '#6CC24A',
          red: '#E2231A',
          light: '#F4F5F7',
        },
        // Obsidian Theme Colors
        obsidian: {
          base: '#000000',
          layer1: '#0A0A0A',
          layer2: '#121212',
          card: '#1A1A1A',
          hover: '#242424',
          border: '#2A2A2A',
          'border-hover': '#3A3A3A',
        },
        // Electric Accent Colors
        electric: {
          cyan: '#00E5FF',
          'cyan-dark': '#00B8D4',
          purple: '#7C4DFF',
          'purple-dark': '#651FFF',
        },
        // Semantic Colors
        neon: {
          green: '#00E676',
          red: '#FF5252',
          yellow: '#FFD740',
          blue: '#448AFF',
        },
        // Legacy mappings
        dark: {
          bg: '#000000',
          card: '#1A1A1A',
          border: '#2A2A2A',
        },
        light: {
          bg: '#FAFAFA',
          card: '#FFFFFF',
          border: '#E5E7EB',
        },
        accent: {
          cyan: '#00E5FF',
          blue: '#00E5FF',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'micro': ['10px', '14px'],
        'tiny': ['11px', '16px'],
      },
      borderRadius: {
        'obsidian': '4px',
      },
      boxShadow: {
        'electric': '0 0 20px rgba(0, 229, 255, 0.3)',
        'electric-lg': '0 0 40px rgba(0, 229, 255, 0.4)',
        'purple': '0 0 20px rgba(124, 77, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 229, 255, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
