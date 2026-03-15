import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/kings_wood/' : '/',
  plugins: [react(), cesium()],
}))
