import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Прокси на services/api в dev: работает и при запуске на хосте (дефолт — хост-порт
      // sgn-api из docker-compose), и в dev-контейнере через dwh-net при переопределении
      // VITE_API_PROXY_TARGET на http://sgn-api:8000.
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:33010",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
})
