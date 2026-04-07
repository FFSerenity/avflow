import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  root: resolve(__dirname),
  base: '/library/',
  build: {
    outDir: resolve(__dirname, '../dist/library'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, '../src'),
    }
  }
})
