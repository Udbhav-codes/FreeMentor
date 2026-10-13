import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Local only, by design — the panel is never hosted.
 *
 * `host` stays on localhost rather than 0.0.0.0: this thing lists learners and
 * mints discount codes, so it should not be reachable from the LAN even by
 * accident. The API is proxied so the browser makes same-origin requests and
 * CORS never enters the picture.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.ADMIN_API_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
