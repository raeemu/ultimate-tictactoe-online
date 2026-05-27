import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function keepSpaPageOnFrontend(req) {
  if (req.headers.accept?.includes("text/html")) {
    return "/index.html";
  }

  return null;
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:3000",
        bypass: keepSpaPageOnFrontend,
      },
      "/matchmaking": "http://localhost:3000",
      "/invites": "http://localhost:3000",
      "/leaderboard": "http://localhost:3000",
      "/matches": {
        target: "http://localhost:3000",
        ws: true,
      },
      "/profile": {
        target: "http://localhost:3000",
        bypass: keepSpaPageOnFrontend,
      },
    },
  },
});
