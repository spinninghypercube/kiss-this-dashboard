import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8788',
      '/icons': 'http://127.0.0.1:8788',
      '/health': 'http://127.0.0.1:8788',
      '/startpage-default-config.json': 'http://127.0.0.1:8788'
    }
  }
});
