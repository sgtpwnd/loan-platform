import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Keep the API proxy in sync with the workflow API port. This prevents
// 404s like "Cannot PUT /api/workflows/..." when the API is started on a
// non-default port (e.g., WORKFLOW_API_PORT=5052 npm run api:dev).
const apiPort = process.env.WORKFLOW_API_PORT || "5050";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ["**/server/data/**"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
      "/uploads": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
