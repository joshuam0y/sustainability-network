import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two pages from one site: the faculty map (index.html) and the curriculum map (curriculum/index.html).
// Relative base so the build works from any folder (e.g. GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        faculty: resolve(import.meta.dirname, 'index.html'),
        curriculum: resolve(import.meta.dirname, 'curriculum/index.html'),
      },
    },
  },
})
