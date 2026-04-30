import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 💡 Pour un déploiement GitHub Pages sous https://user.github.io/NOM_REPO/,
//    remplacez base par : base: '/NOM_REPO/',
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
