import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Prevent Vite from trying to bundle the classic script
        return html.replace(
          '<script src="funasr-client.js">',
          '<script src="funasr-client.js" data-vite-ignore>'
        );
      },
    },
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});