import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app at https://pedrolaino.github.io/Atrapalabras/
  base: '/Atrapalabras/',
})
