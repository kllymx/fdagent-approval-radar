import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8788" },
    fs: {
      deny: [".env", ".env.*", "**/.git/**", "**/.cache/**", "**/.runtime/**"],
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
