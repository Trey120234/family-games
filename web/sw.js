// =============================================================
//  Offline helper ("service worker").
//
//  Keeps a copy of every game file on the phone, so the games work
//  without internet, and fetches the newest files whenever the
//  phone is online - that is how updates reach her automatically.
//
//  files.json (the list of files to keep) is made automatically by
//  the publisher on GitHub - you never edit it. You shouldn't need
//  to change this file either.
// =============================================================

const CACHE = "games";

// Adds a unique tag (like ?fresh=1696262400000) to an address, so no cache
// anywhere can hand back an old copy. The website ignores the tag.
function fresh(url) {
  const u = new URL(url, self.location);
  u.searchParams.set("fresh", Date.now());
  return u.href;
}
const NETWORK_WAIT_MS = 4000;   // how long to wait for the internet before using the saved copy

// Download every file listed in files.json into the phone's saved copy.
async function saveAllFiles() {
  const response = await fetch(fresh("files.json"), { cache: "no-store" });
  const list = await response.json();
  const cache = await caches.open(CACHE);
  await Promise.all(
    list.files.map((file) =>
      fetch(fresh(file), { cache: "no-store" })
        .then((r) => (r.ok ? cache.put(file, r) : null))
        .catch(() => null)
    )
  );
}

// First install: save everything, then take over right away.
self.addEventListener("install", (event) => {
  event.waitUntil(saveAllFiles().catch(() => null).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The app asks for a refresh each time it opens, so games she hasn't
// opened lately are still up to date when she's offline.
self.addEventListener("message", (event) => {
  if (event.data === "refresh") event.waitUntil(saveAllFiles().catch(() => null));
});

// Every file request: try the internet first (newest version),
// fall back to the saved copy if offline or too slow.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    const fromNetwork = fetch(fresh(request.url), { cache: "no-store" }).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });

    const tooSlow = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS));

    try {
      const winner = await Promise.race([fromNetwork, tooSlow]);
      if (winner) return winner;                     // internet answered in time
    } catch (e) {
      // offline - use the saved copy below
    }

    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    return fromNetwork;                              // nothing saved yet - keep waiting for the internet
  })());
});
