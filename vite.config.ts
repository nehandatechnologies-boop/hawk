// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      // Offline-capable console: HAWKTRACE must stay usable off-network.
      // Registration itself lives in src/lib/offline/sw.ts (guarded).
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        // Client assets are emitted to dist/client; the worker must ship there
        // too or it is never served at /sw.js.
        outDir: "dist/client",

        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "HAWKTRACE — Security Operations Center",
          short_name: "HAWKTRACE",
          description:
            "HAWKTRACE by NEHANDA Systems — lawful CCTV facial-recognition tracking and alerting console.",
          start_url: "/dashboard",
          scope: "/",
          display: "standalone",
          background_color: "#0b1017",
          theme_color: "#0b1017",
          icons: [
            { src: "/hawktrace-icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/hawktrace-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/dashboard",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "hawktrace-pages", networkTimeoutSeconds: 5 },
            },
            {
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                ["style", "script", "worker", "image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "hawktrace-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Face-recognition models are served from a CDN; cache them so
              // recognition still runs while air-gapped.
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@vladmandic\/face-api\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "hawktrace-face-models",
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/[a-z]+\.basemaps\.cartocdn\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "hawktrace-map-tiles",
                expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
