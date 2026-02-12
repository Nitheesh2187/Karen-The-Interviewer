import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy WebSocket and API requests to the FastAPI backend
    // This means in our frontend code we can just use "/ws/interview"
    // instead of "ws://localhost:8000/ws/interview"
    proxy: {
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true, // Enable WebSocket proxying
      },
      '/health': {
        target: 'http://localhost:8000',
      },
    },
  },
})
