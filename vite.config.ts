import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    netlify({
      dev: {
        edgeFunctions: {
          enabled: false,
        },
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: [
      "@supabase/supabase-js",
      "@radix-ui/react-label",
      "@radix-ui/react-dialog",
      "@radix-ui/react-slot",
      "cmdk",
      "recharts",
      "sonner",
      "lucide-react",
    ],
  },
});
