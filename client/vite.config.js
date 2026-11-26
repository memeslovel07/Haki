import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleApi } from "./server/index.js";

function hakiApiPlugin() {
  return {
    name: "haki-local-api",
    configureServer(viteServer) {
      viteServer.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/") || req.url.startsWith("/api/v1/")) return next();
        handleApi(req, res).catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), hakiApiPlugin()],
  server: {
    proxy: {
      "/api/v1": {
        target: process.env.HAKI_API_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
