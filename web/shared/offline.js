// =============================================================
//  Turns on the offline helper (../sw.js) for every screen.
//  Every page includes this file. It only runs on the real website
//  (https), so testing with Live Server on your computer is unaffected.
// =============================================================

(function () {
  if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;

  // The site's main folder is one level up from this "shared" folder.
  const root = new URL("../", document.currentScript.src);

  navigator.serviceWorker
    .register(new URL("sw.js", root), { scope: root.pathname })
    .then((registration) => {
      // Ask it to refresh the saved copy of every game in the background.
      if (registration.active) registration.active.postMessage("refresh");
    })
    .catch(() => {
      // If it can't start, the games still work - just not offline.
    });
})();
