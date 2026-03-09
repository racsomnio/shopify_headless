import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Serve index.html for all unknown paths so React handles /auth/callback
    historyApiFallback: true,
    // Allow all ngrok tunnel hostnames (required since Shopify mandates HTTPS)
    allowedHosts: true,
    // Proxy API calls to backend in dev so we avoid CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
