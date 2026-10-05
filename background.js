const PREFIX = "Frozen: ";
const PAGE = browser.runtime.getURL("frozen.html");

// windowId -> when it lost focus. Absent = focused now.
const unfocusedSince = new Map();
// placeholder tabId -> original tabId
const placeholders = new Map();
// windowId -> timestamp until which it must not be frozen (Infinity = until cleared)
const exempt = new Map();
const dwellTimers = new Map();

let minutes = 5;
let dwell = 2;
let pausedUntil = 0; // global; persisted

async function loadSettings() {
  const s = await browser.storage.local.get({ minutes: 5, dwell: 2, pausedUntil: 0 });
  minutes = Number(s.minutes) || 5;
  dwell = Math.max(0, Number(s.dwell) || 0);
  pausedUntil = Number(s.pausedUntil) || 0;
  updateBadge();
}
browser.storage.onChanged.addListener(loadSettings);

function updateBadge() {
  const paused = pausedUntil > Date.now();
  browser.browserAction.setBadgeText({ text: paused ? "II" : "" });
  browser.browserAction.setBadgeBackgroundColor({ color: "#777" });
}

// --- startup: rebuild the placeholder map from per-tab session values, which
// survive restarts (tab ids do not). Original tabs come back lazy from the
// session restore, so nothing loads here.
async function init() {
  await loadSettings();
  const focused = await browser.windows.getLastFocused().catch(() => null);
  for (const w of await browser.windows.getAll()) {
    if (!focused || w.id !== focused.id) unfocusedSince.set(w.id, Date.now());
  }
  const tabs = await browser.tabs.query({});
  const byToken = new Map();
  for (const t of tabs) {
    const tok = await browser.sessions.getTabValue(t.id, "wf-orig").catch(() => null);
    if (tok) byToken.set(tok, t.id);
  }
  for (const t of tabs) {
    if (!t.url.startsWith(PAGE)) continue;
    const tok = new URL(t.url).searchParams.get("k");
    const orig = byToken.get(tok);
    if (orig !== undefined && orig !== t.id) placeholders.set(t.id, orig);
  }
}
init();

// --- focus tracking
browser.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  for (const w of await browser.windows.getAll()) {
    if (w.id === windowId) unfocusedSince.delete(w.id);
    else if (!unfocusedSince.has(w.id)) unfocusedSince.set(w.id, now);
  }
  for (const [id, t] of dwellTimers) { clearTimeout(t); dwellTimers.delete(id); }
  if (windowId === browser.windows.WINDOW_ID_NONE) return;
  if (dwell === 0) return unfreeze(windowId);
  dwellTimers.set(windowId, setTimeout(() => { dwellTimers.delete(windowId); unfreeze(windowId); }, dwell * 1000));
});
browser.windows.onRemoved.addListener((id) => { unfocusedSince.delete(id); exempt.delete(id); });
browser.tabs.onRemoved.addListener((id) => { placeholders.delete(id); browser.storage.local.remove("shot:" + id); });

browser.alarms.create("check", { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener(async () => {
  if (pausedUntil > Date.now()) return;
  if (pausedUntil) { pausedUntil = 0; browser.storage.local.set({ pausedUntil: 0 }); }
  const cutoff = Date.now() - minutes * 60 * 1000;
  for (const [windowId, since] of unfocusedSince) {
    if ((exempt.get(windowId) || 0) > Date.now()) continue;
    if (since <= cutoff) await freeze(windowId);
  }
});

// --- freeze / unfreeze
function skip(tab) {
  return !tab || tab.discarded || tab.audible || placeholders.has(tab.id) ||
    !/^(https?|file):/.test(tab.url || "");
}

async function freeze(windowId) {
  // Tabless (popup / web-app) windows: creating a tab there is intercepted by
  // the web-app extensions and spawns stray windows. Leave them alone.
  const win = await browser.windows.get(windowId).catch(() => null);
  if (!win || win.type !== "normal") return;
  const [tab] = await browser.tabs.query({ windowId, active: true });
  if (skip(tab)) return;
  console.log("freeze", windowId, tab.title);
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await browser.sessions.setTabValue(tab.id, "wf-orig", token);
  // Screenshot first, while the tab is still the visible one.
  const shot = await browser.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 70 }).catch(() => null);
  const url = PAGE + "?t=" + encodeURIComponent(tab.title || tab.url) +
    "&f=" + encodeURIComponent(tab.favIconUrl || "") + "&k=" + token;
  const ph = await browser.tabs.create({ windowId, url, active: true, index: tab.index + 1 });
  placeholders.set(ph.id, tab.id);
  if (shot) browser.storage.local.set({ ["shot:" + ph.id]: shot });
  try {
    await browser.tabs.discard(tab.id);
  } catch (e) {
    // discard refused (e.g. beforeunload): the placeholder stays, the tab stays loaded
  }
}

async function unfreeze(windowId) {
  const [active] = await browser.tabs.query({ windowId, active: true });
  if (!active || !placeholders.has(active.id)) return;
  await restore(active.id);
}

async function restore(placeholderId) {
  const orig = placeholders.get(placeholderId);
  if (orig === undefined) return;
  console.log("restore", placeholderId, "->", orig);
  placeholders.delete(placeholderId);
  try {
    await browser.tabs.get(orig);
    await browser.sessions.removeTabValue(orig, "wf-orig");
    await browser.tabs.update(orig, { active: true });
    await browser.tabs.remove(placeholderId);
  } catch (e) {
    // original tab is gone; keep the placeholder so the window survives
  }
}

// --- commands: toolbar popup buttons and keyboard shortcuts share these
const H = 3600000;
async function command(name) {
  const w = await browser.windows.getLastFocused();
  switch (name) {
    case "freeze-now":   exempt.delete(w.id); return freeze(w.id);
    case "exempt-1h":    exempt.set(w.id, Date.now() + H); return;
    case "exempt-never": exempt.set(w.id, Infinity); return;
    case "exempt-clear": exempt.delete(w.id); return;
    case "pause-1h":     return setPause(Date.now() + H);
    case "pause":        return setPause(Infinity);
    case "resume":       return setPause(0);
  }
}
async function setPause(until) {
  pausedUntil = until;
  await browser.storage.local.set({ pausedUntil: until === Infinity ? 8.64e15 : until });
  updateBadge();
}
browser.commands.onCommand.addListener(command);

// --- messages from the frozen page and the toolbar popup
browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (typeof msg === "string") msg = { type: msg };
  switch (msg.type) {
    case "restore":
      if (sender.tab) return restore(sender.tab.id);
      return;
    case "snapshot":
      if (!sender.tab) return null;
      return (await browser.storage.local.get("shot:" + sender.tab.id))["shot:" + sender.tab.id] || null;
    case "state": {
      const w = await browser.windows.getLastFocused();
      const tabs = await browser.tabs.query({});
      return { windowId: w.id, exemptUntil: exempt.get(w.id) || 0, pausedUntil,
               frozen: placeholders.size, tabs: tabs.length,
               discarded: tabs.filter((t) => t.discarded).length };
    }
    case "command":
      return command(msg.name);
  }
});
