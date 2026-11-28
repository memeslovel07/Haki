import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.dirname(fileURLToPath(import.meta.url)), "");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api/v1": {
          target: env.HAKI_API_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
