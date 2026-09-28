/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0d14', // Base viewport background
          1: '#111622', // Card background
          2: '#182030', // Elevated / hover / nested
          3: '#1e293b', // Modal / dropdown / overlay
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
        severity: {
          critical: {
            text: '#f87171',
            bg: 'rgba(239, 68, 68, 0.12)',
            border: 'rgba(239, 68, 68, 0.30)',
            glow: 'rgba(239, 68, 68, 0.20)',
          },
          high: {
            text: '#fb923c',
            bg: 'rgba(249, 115, 22, 0.12)',
            border: 'rgba(249, 115, 22, 0.30)',
            glow: 'rgba(249, 115, 22, 0.20)',
          },
          medium: {
            text: '#facc15',
            bg: 'rgba(234, 179, 8, 0.12)',
            border: 'rgba(234, 179, 8, 0.30)',
            glow: 'rgba(234, 179, 8, 0.20)',
          },
          low: {
            text: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.30)',
            glow: 'rgba(56, 189, 248, 0.20)',
          },
          clean: {
            text: '#34d399',
            bg: 'rgba(16, 185, 129, 0.12)',
            border: 'rgba(16, 185, 129, 0.30)',
            glow: 'rgba(16, 185, 129, 0.20)',
          },
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-sky': '0 0 25px -5px rgba(56, 189, 248, 0.25)',
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.25)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.25)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.6), 0 0 15px -3px rgba(56, 189, 248, 0.15)',
      },
      borderColor: {
        subtle: 'rgba(255, 255, 255, 0.07)',
        prominent: 'rgba(255, 255, 255, 0.14)',
      },
    },
  },
  plugins: [],
}
