// what to cache for offline use
self.addEventListener("install", (e) => {
  e.waitUntil(
    // Give the cache a name
    caches.open("glitch-hello-installable-cache").then((cache) => {
      // Cache the homepage and stylesheets - add any assets you want to cache!
      return cache.addAll(["/", "style.css", "wiki.js", "glitch-pwa.js"]);
    })
  );
});

// network first, with cache as backup
self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request);
    })
  );
});
