
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vite doesn't include 'process' by default. This shims it so 'process.env.API_KEY' works.
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
