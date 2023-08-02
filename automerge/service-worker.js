/*
 * ServiceWorker to make site function as a PWA (Progressive Web App)
 *
 * Based on https://glitch.com/~pwa by https://glitch.com/@PaulKinlan
 */

// Specify what we want added to the cache for offline use
self.addEventListener("install", (e) => {
  e.waitUntil(
    // Give the cache a name
    caches.open("automerge-progressive-webapp").then((cache) => {
      // Cache the homepage and stylesheets - add any assets you want to cache!
      return cache.addAll(["./", "./style.css", "./index.js", "./app.js"]);
    })
  );
});

// Network falling back to cache approach
self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request);
    })
  );
});
