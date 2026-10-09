import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages: the faculty map (index.html), the curriculum map (curriculum/), the staff review page (review/) and
// the list of sustainability programs (programs/).
// Relative base so the build works from any folder (e.g. GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        faculty: resolve(import.meta.dirname, 'index.html'),
        curriculum: resolve(import.meta.dirname, 'curriculum/index.html'),
        review: resolve(import.meta.dirname, 'review/index.html'),
        explore: resolve(import.meta.dirname, 'explore/index.html'),
        programs: resolve(import.meta.dirname, 'programs/index.html'),
      },
    },
  },
})
