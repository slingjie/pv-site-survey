/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope;

// Precache static assets (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// Tailwind CDN — CacheFirst
registerRoute(
  ({ url }) => url.hostname === "cdn.tailwindcss.com",
  new CacheFirst({ cacheName: "tailwind-cdn", plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 7 * 24 * 3600 })] }),
);

// API images — CacheFirst (immutable)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/images/"),
  new CacheFirst({ cacheName: "api-images", plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 })] }),
);

// Other API calls — NetworkOnly (data handled by IndexedDB)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);
