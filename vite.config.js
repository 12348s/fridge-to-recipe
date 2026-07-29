import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app talks to /api/*, which Vite proxies to our local Express
// server in dev. In prod, deploy server/index.js (or its route logic) as
// whatever serverless function / small backend your host uses, and point
// this same /api/recipe path at it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
