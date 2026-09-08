import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The API runs separately in development (`npm run serve` at the repo root).
    // Proxying keeps the client on one origin, so no CORS handling is needed.
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
