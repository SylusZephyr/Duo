import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Plugin order matters. Tailwind and the path resolver run first so that
 * TanStack Start sees resolved imports; Start generates the route tree and the
 * server entry; Nitro bundles that output for the deploy target; and the React
 * plugin runs last so it transforms everything the others produced.
 */
export default defineConfig(async ({ command, mode }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect Start's bundled server entry to src/server.ts, our SSR error wrapper.
      server: { entry: "server" },
      // Keep server-only modules out of the client bundle. Importing one is a
      // build error rather than a secret quietly shipped to the browser.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
  ];

  // Nitro only participates in builds; `vite dev` serves through Start directly.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        preset: process.env["NITRO_PRESET"] || "cloudflare-module",
        cloudflare: { nodeCompat: true, deployConfig: true },
      }),
    );
  }

  plugins.push(viteReact());

  /**
   * Vite only substitutes `import.meta.env.VITE_*` in client code. The Supabase
   * client is also constructed during SSR, so without this the server build
   * reads undefined and throws at the first request. Inlining the values makes
   * both halves agree.
   */
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    define,
    resolve: {
      // A second copy of React or the query client breaks hooks and the cache
      // in ways that surface as confusing runtime errors, not build errors.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: { port: 8080 },
  };
});
