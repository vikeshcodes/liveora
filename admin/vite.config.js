import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/admin/",
  plugins: [
    {
      name: "liveora-admin-dev-routes",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/admin") {
            req.url = "/admin/";
          }
          if (req.url === "/setup") {
            req.url = "/admin/";
          }
          next();
        });
      }
    },
    react()
  ]
});
