// =============================================================
//  Account + play time
//
//  - Every player automatically gets a guest account (no sign-up needed).
//    It's remembered on this phone.
//  - While a game screen is open and in use, we count the time. When the
//    player leaves the game (or switches apps), one "play session" is saved:
//    which game, when it started, and how many seconds were played.
//  - Sessions wait on the phone if there's no internet and are sent later.
//    Each one has its own random id, so if it ever gets sent twice
//    (say, the phone closed the page before hearing back), the server
//    keeps just one copy.
//  - Everything goes to the Supabase project below. The rules in Supabase
//    only let each player add and read their OWN sessions.
//
//  Every game page loads this file. The home screen loads it too (to make
//  the guest account early), but doesn't record time itself.
// =============================================================

const Account = (function () {
  // ---------- Your Supabase project (these two are safe to be public) ----------
  const SUPABASE_URL = "https://bvrqyzgmecyxhxpqeyql.supabase.co";
  const SUPABASE_KEY = "sb_publishable_xZrzqR9Vt_a4gGDbm_ABtQ_Ds70o9AE";

  // ---------- Settings you can change ----------
  const IDLE_MS = 5 * 60 * 1000;   // no taps for 5 minutes = stop counting (phone left on the table)
  const MIN_SECONDS = 5;           // don't save sessions shorter than this
  const QUEUE_LIMIT = 200;         // most sessions kept waiting while offline
  const BATCH = 50;                // sessions sent at a time

  const AUTH_KEY = "games-auth";       // the guest account's sign-in tokens
  const QUEUE_KEY = "games-playlog";   // sessions waiting to be sent

  const load = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* phone won't save: fine */ } };
  const loadQueue = () => { const q = load(QUEUE_KEY, []); return Array.isArray(q) ? q.filter((s) => s && typeof s === "object") : []; };

  let lastProblem = "";   // the most recent thing that went wrong (for checking from the browser)

  // Which game is this? The folder right before the page, e.g.
  // /family-games/games/sudoku-sprout/index.html -> "sudoku-sprout"
  const match = location.pathname.match(/\/games\/([a-z0-9-]+)\/(?:index\.html)?$/);
  const GAME = match ? match[1] : null;

  // A random id for each session
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // ---------- Talking to Supabase ----------
  async function call(path, { body, token, prefer } = {}) {
    const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(SUPABASE_URL + path, { method: "POST", headers, body: JSON.stringify(body || {}), keepalive: true });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  function keep(data) {
    if (!data || !data.access_token) return null;
    const auth = {
      access: data.access_token,
      refresh: data.refresh_token,
      expires: Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user && data.user.id,
    };
    store(AUTH_KEY, auth);
    return auth;
  }

  // The sign-in we already have, if it's still good for at least a minute
  function validAuth() {
    const auth = load(AUTH_KEY, null);
    return auth && auth.access && auth.expires > Date.now() + 60000 ? auth : null;
  }

  // Only these answers mean "that guest account is truly gone"; anything else
  // (busy server, too many requests, no internet) means "try again later".
  const GONE = ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "user_not_found"];
  const accountGone = (r) => (r.status === 400 || r.status === 401 || r.status === 403) &&
    (GONE.includes(r.data.error_code) || r.data.error === "invalid_grant");

  // Several game tabs open at once? Only one at a time renews the sign-in,
  // so a player never accidentally ends up with two guest accounts.
  function oneAtATime(work) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request("games-auth", work);
    return work();
  }

  let signingIn = null;
  function session() {
    const ready = validAuth();
    if (ready) return Promise.resolve(ready);
    if (!signingIn) {
      signingIn = oneAtATime(async () => {
        try {
          const again = validAuth();            // another tab may have just done it
          if (again) return again;
          const auth = load(AUTH_KEY, null);
          if (auth && auth.refresh) {           // same player: renew the sign-in
            const r = await call("/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: auth.refresh } });
            if (r.ok) return keep(r.data);
            if (!accountGone(r)) { lastProblem = `renew failed (${r.status})`; return null; }
          }
          const r = await call("/auth/v1/signup", { body: { data: {} } });   // a brand-new guest account
          if (r.ok) return keep(r.data);
          lastProblem = `guest sign-in failed (${r.status} ${r.data.error_code || r.data.msg || ""})`.trim();
          return null;
        } catch (e) {
          lastProblem = "no internet";
          return null;
        }
      }).finally(() => { signingIn = null; });
    }
    return signingIn;
  }

  // ---------- Sending saved sessions ----------
  let sending = false;
  async function flush() {
    if (sending) return;
    let queue = loadQueue();
    if (!queue.length) return;
    // every session needs its id before it's sent
    if (queue.some((s) => !s.client_id)) { queue = queue.map((s) => (s.client_id ? s : { ...s, client_id: newId() })); store(QUEUE_KEY, queue); }
    sending = true;
    try {
      // With a good sign-in already saved, send right away (this also works
      // while the page is closing). Otherwise renew it first.
      const auth = validAuth() || (await session());
      if (!auth) return;
      const batch = queue.slice(0, BATCH);
      const r = await call("/rest/v1/play_sessions?on_conflict=client_id", {
        body: batch, token: auth.access, prefer: "return=minimal,resolution=ignore-duplicates",
      });
      const code = String(r.data.code || "");
      if (r.ok || /^2[23]/.test(code)) {
        // Saved (or the server says these can never be saved): take exactly those off the list
        if (!r.ok) lastProblem = `server refused some sessions (${code})`;
        const sent = new Set(batch.map((s) => s.client_id));
        const left = loadQueue().filter((s) => !sent.has(s.client_id));
        store(QUEUE_KEY, left);
        if (r.ok && left.length) setTimeout(flush, 500);
      } else if (r.status === 401) {
        store(AUTH_KEY, { ...auth, expires: 0 });   // sign-in ran out: renew next time
      } else {
        // Anything else (no permission, table missing, busy server): keep them and try later
        lastProblem = `couldn't save sessions (${r.status} ${code || r.data.message || ""})`.trim();
      }
    } catch (e) {
      lastProblem = "no internet";   // they'll go next time
    } finally {
      sending = false;
    }
  }

  function queueSession(s) {
    const queue = loadQueue();
    queue.push(s);
    store(QUEUE_KEY, queue.slice(-QUEUE_LIMIT));
  }

  // ---------- Counting play time on a game screen ----------
  let startedAt = null;   // when this stretch of play began
  let counted = 0;        // milliseconds played in this stretch
  let lastTick = 0;
  let lastActive = Date.now();

  const visible = () => document.visibilityState === "visible";
  function device() {
    const ua = navigator.userAgent;
    if (/; wv\)/.test(ua)) return "android-app";
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
    if (/iPhone|iPod/.test(ua)) return "iphone";
    if (/Android/.test(ua)) return "android-web";
    return "computer";
  }

  function tick() {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if (!visible() || now - lastActive > IDLE_MS || gap > 5000) return;   // away, idle, or the phone paused us
    if (!startedAt) startedAt = new Date(now - gap).toISOString();
    counted += gap;
  }

  // Close off this stretch of play and keep it to send.
  function endStretch() {
    tick();
    const seconds = Math.round(counted / 1000);
    if (GAME && startedAt && seconds >= MIN_SECONDS) {
      queueSession({ client_id: newId(), game: GAME, started_at: startedAt, seconds, device: device() });
    }
    startedAt = null;
    counted = 0;
  }

  function startCounting() {
    lastTick = Date.now();
    lastActive = Date.now();
    setInterval(tick, 1000);
    ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, () => {
      if (Date.now() - lastActive > IDLE_MS) { endStretch(); lastTick = Date.now(); }   // came back after a break: new stretch
      lastActive = Date.now();
    }, true));
    document.addEventListener("visibilitychange", () => {
      if (visible()) { lastTick = Date.now(); lastActive = Date.now(); flush(); }
      else { endStretch(); flush(); }   // switched apps or locked the phone
    });
    window.addEventListener("pagehide", () => { endStretch(); flush(); });   // left the game (house button)
  }

  // ---------- Start ----------
  if (GAME) startCounting();
  window.addEventListener("online", flush);
  setTimeout(() => { session(); flush(); }, 1500);   // make the guest account and send anything waiting

  return {
    // for checking things from the browser
    playerId: () => (load(AUTH_KEY, null) || {}).user || null,
    waiting: () => loadQueue().length,
    status: () => lastProblem || "ok",
    flush,
  };
})();
