import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  server: {
    port: 3000,          // stays at 3000
    proxy: {
      // any request starting with /api will be forwarded to your Go backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,   // if you ever use HTTPS on :8080, set this to true
      },
    },
  },
})
