import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev talks to the API on the same origin, so nothing needs CORS locally.
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: true },
})
