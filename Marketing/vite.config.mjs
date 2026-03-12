import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/latest.json': {
        target: 'https://server.nishiegroe.com',
        changeOrigin: true,
        rewrite: () => '/d/s/17O8FTJqXgRqxWSs5bvCoaBMjcfIUdSt/latest.json',
      },
    },
  },
});
