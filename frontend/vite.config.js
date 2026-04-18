import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server — runs on http://localhost:5173
// Backend runs separately on http://localhost:3001
export default defineConfig({
  plugins: [react()],
});
