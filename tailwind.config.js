/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
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