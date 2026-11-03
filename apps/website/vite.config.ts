import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the build works from any path (e.g. GitHub Pages under /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // The app chunk holds React, the formatters it uses and the time zone data (~190 KB gzipped);
  // locale packs are separate chunks loaded on demand.
  build: { chunkSizeWarningLimit: 800 },
});
