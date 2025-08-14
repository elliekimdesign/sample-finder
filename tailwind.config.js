/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        notoSerif: ['"Noto Serif"', 'serif'],
        jost: ['"Jost"', 'sans-serif'],
        libreCaslon: ['"Libre Caslon Text"', 'serif'],
      },
      animation: {
        'textGlow': 'textGlow 5s ease-in-out infinite',
      },
      keyframes: {
        textGlow: {
          '0%, 100%': {
            opacity: '0.3',
            filter: 'blur(2px)',
            transform: 'scale(0.95)',
          },
          '25%': {
            opacity: '0.6',
            filter: 'blur(1px)',
            transform: 'scale(0.98)',
          },
          '50%': {
            opacity: '1',
            filter: 'blur(0px)',
            transform: 'scale(1)',
          },
          '75%': {
            opacity: '0.8',
            filter: 'blur(0.5px)',
            transform: 'scale(1.02)',
          },
        },
      },
    },
  },
  plugins: [],
} 