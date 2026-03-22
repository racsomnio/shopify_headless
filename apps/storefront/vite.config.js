import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server only. Production storefront URL (this project): https://oscarslab.dev
 * — deploy the built `dist/` there; point Shopify Headless / Customer Account callback URIs at that host.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Serve index.html for all unknown paths so React handles /auth/callback
    historyApiFallback: true,
    // Allow all ngrok tunnel hostnames (required since Shopify mandates HTTPS)
    allowedHosts: true,
    // Proxy API calls to backend in dev (localhost:3000). In prod, API lives on your host (e.g. api.oscarslab.dev or same origin as https://oscarslab.dev).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        /** Forwards BACKEND_API_KEY when VITE_BACKEND_API_KEY matches (dev only) */
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const key = process.env.VITE_BACKEND_API_KEY;
            if (key) proxyReq.setHeader('X-API-Key', key);
          });
        },
      },
    },
  },
});
