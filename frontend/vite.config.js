import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": "http://localhost:3000",
      "/matchmaking": "http://localhost:3000",
      "/matches": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});