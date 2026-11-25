import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleApi } from "./server/index.js";

function hakiApiPlugin() {
  return {
    name: "haki-gemini-api",
    configureServer(viteServer) {
      viteServer.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        handleApi(req, res).catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), hakiApiPlugin()],
});
