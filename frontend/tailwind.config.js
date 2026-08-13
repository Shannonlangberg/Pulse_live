/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        fc: {
          midnight: '#1C1C16',
          cream: '#FAF9F4',
          cream2: '#F0EDE4',
          copper: '#C45236',
          teal: '#4A8FA8',
          violet: '#5D1FEC',
          gold: '#C4A44A',
          olive: '#639922',
          thistle: '#C5C6A4',
          brown: '#50482E',
          wash: {
            mint: '#E4F0DC',
            sky: '#DCE9F1',
            butter: '#F2EAD0',
            peach: '#F2D8CB',
            thistle: '#EEEEE4',
            violet: '#EFE7FF',
            'mint-border': '#B8D8A8',
            'sky-border': '#A8C8DC',
            'butter-border': '#DCC888',
            'peach-border': '#DCA890',
            'thistle-border': '#C4C4A8',
          },
          dark: {
            bg: '#090C06',
            elevated: '#131507',
            bg2: '#1A1C10',
            text: '#F4F1E6',
          },
        },
      },
      fontFamily: {
        display: ['"Rhymes Display"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Gal Gothic"', '"DM Sans"', 'system-ui', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 5px rgba(0,0,0,0.06)',
        'card-hover': '0 6px 18px rgba(0,0,0,0.08)',
        pop: '0 8px 24px rgba(28,28,22,0.10)',
      },
      borderRadius: {
        xl2: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} 