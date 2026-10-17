import { defineConfig } from "vite";
export default defineConfig({
  root: "app/client",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: { charts: ["recharts"] },
      },
    },
  },
  server: { host: "127.0.0.1" },
});
