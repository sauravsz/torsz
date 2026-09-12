import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "lucide-react", "clsx", "tailwind-merge"],
          monaco: ["monaco-editor", "@monaco-editor/react"],
          spreadsheet: ["xlsx", "papaparse"],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
