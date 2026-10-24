import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  publicDir: '.cache/public',
  plugins: [reactRouter()],
  // Use the same IPv4 loopback for the prerender server and its HTTP requests.
  preview: { host: '127.0.0.1' },
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
});
