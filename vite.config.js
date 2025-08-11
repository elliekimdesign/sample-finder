import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Allow overriding the base path via env so Vercel can use '/'
// and GitHub Pages can use '/sample-finder/'
const basePath = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
})
