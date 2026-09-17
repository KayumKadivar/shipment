import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://nico-api.nicedesert-4da8ecd2.centralus.azurecontainerapps.io',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
