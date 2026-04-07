import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  root: resolve(__dirname),               // root = library-dev/
  resolve: {
    alias: {
      // make ../src imports resolve cleanly
      '@src': resolve(__dirname, '../src'),
    }
  }
})
