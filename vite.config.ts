import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        // Keep lazy tool modules from importing the worker entry itself.
        // WebKit can instantiate that entry again, splitting locale/error identity.
        manualChunks(id) {
          if (id.replace(/\\/g, "/").includes("/src/i18n/"))
            return "worker-i18n";
        },
      },
    },
  },
});
