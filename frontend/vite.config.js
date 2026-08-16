import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Dev-only proxy so the browser talks to the API on the same origin.
  const target = env.VITE_DEV_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: parseInt(env.VITE_PORT || '5173', 10),
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
    preview: { host: true, port: 4173 },
    build: { outDir: 'dist', sourcemap: false },
  };
});
