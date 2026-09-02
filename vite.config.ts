import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(({ isSsrBuild }) => ({
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
  ...(isSsrBuild
    ? {}
    : {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: "react-runtime",
                    test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                    priority: 4,
                  },
                  {
                    name: "supabase-client",
                    test: /node_modules[\\/]@supabase[\\/]/,
                    priority: 3,
                  },
                  {
                    name: "notifications",
                    test: /node_modules[\\/]sonner[\\/]/,
                    priority: 1,
                  },
                ],
              },
            },
          },
        },
      }),
}));
