import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesPath = path.resolve(__dirname, '../../packages')

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@core': path.resolve(packagesPath, 'core'),
      '@ui': path.resolve(packagesPath, 'ui'),
      '@/lib': path.resolve(packagesPath, 'core/lib'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3003,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
  },
})
