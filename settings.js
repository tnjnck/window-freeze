// Shared by background, frozen page and options. Loaded as a plain script.
const DEFAULTS = {
  minutes: 5,            // unfocused minutes before a window freezes
  dwell: 2,              // focused seconds before a frozen window thaws (0 = at once)
  preload: true,         // start loading the page behind the placeholder as soon as the window is focused
  visibleIsActive: false, // a window that is on screen counts as in use: it is not frozen, and a frozen one thaws
  idleMinutes: 30,       // unload a background tab unseen for this long (0 = never)
  unloadedPrefix: "💤 ", // put in front of an unloaded tab's title ("" = none)
  titleTemplate: "Frozen: {title}",
  style: "blur",         // blur | dim | solid
  blur: 10,              // px, blur mode
  dim: 45,               // % darkening, blur and dim modes
  color: "#1e1e24",      // solid mode, and behind a missing screenshot
  showFavicon: true,
  showLabel: true,
  labelTemplate: "{title}",
  exclude: "",           // one pattern per line; * is a wildcard; no * = substring
  wholeWindow: true,     // also unload the window's other tabs when it freezes
  skipPinned: true,      // never unload pinned tabs
  protectForms: true,    // never unload a tab with an edited input or textarea
  pausedUntil: 0,
};

function getSettings() {
  return browser.storage.local.get(DEFAULTS);
}

function renderTemplate(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in ctx ? ctx[k] : m));
}

function templateContext(title, url, when) {
  let host = "";
  try { host = new URL(url).host; } catch (e) {}
  const d = when ? new Date(Number(when)) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    title, url, host,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function excluded(url, patterns) {
  for (let p of (patterns || "").split("\n")) {
    p = p.trim();
    if (!p || p.startsWith("#")) continue;
    if (!p.includes("*")) { if (url.includes(p)) return true; continue; }
    const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
    if (re.test(url)) return true;
  }
  return false;
}
