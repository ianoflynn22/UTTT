// Minimal service worker: registering it makes the app installable.
// All requests pass straight through to the network so the app is always current.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
