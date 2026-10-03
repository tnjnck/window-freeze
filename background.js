// Per window: when it was last focused. Missing = focused now.
const unfocusedSince = new Map();
// placeholder tabId -> original tabId
const placeholders = new Map();
const PREFIX = "Frozen: ";
let minutes = 5;

async function loadSettings() {
  const s = await browser.storage.local.get({ minutes: 5 });
  minutes = Number(s.minutes) || 5;
}
loadSettings();
browser.storage.onChanged.addListener(loadSettings);

async function init() {
  const focused = await browser.windows.getLastFocused();
  for (const w of await browser.windows.getAll()) {
    if (w.id !== focused.id) unfocusedSince.set(w.id, Date.now());
  }
}
init();

browser.windows.onFocusChanged.addListener(async (windowId) => {
  const now = Date.now();
  for (const w of await browser.windows.getAll()) {
    if (w.id === windowId) unfocusedSince.delete(w.id);
    else if (!unfocusedSince.has(w.id)) unfocusedSince.set(w.id, now);
  }
  if (windowId !== browser.windows.WINDOW_ID_NONE) await unfreeze(windowId);
});

browser.windows.onRemoved.addListener((id) => unfocusedSince.delete(id));
browser.tabs.onRemoved.addListener((id) => placeholders.delete(id));

browser.alarms.create("check", { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener(async () => {
  const cutoff = Date.now() - minutes * 60 * 1000;
  for (const [windowId, since] of unfocusedSince) {
    if (since <= cutoff) await freeze(windowId);
  }
});

function skip(tab) {
  return !tab || tab.discarded || tab.audible || placeholders.has(tab.id) ||
    !/^(https?|file):/.test(tab.url || "");
}

async function freeze(windowId) {
  const [tab] = await browser.tabs.query({ windowId, active: true });
  if (skip(tab)) return;
  const url = browser.runtime.getURL("frozen.html") +
    "?t=" + encodeURIComponent(tab.title || tab.url) + "&f=" + encodeURIComponent(tab.favIconUrl || "");
  const ph = await browser.tabs.create({ windowId, url, active: true, index: tab.index + 1 });
  placeholders.set(ph.id, tab.id);
  try {
    await browser.tabs.discard(tab.id);
  } catch (e) {
    // discard refused (e.g. beforeunload): leave the placeholder, the tab stays loaded
  }
}

async function unfreeze(windowId) {
  const [active] = await browser.tabs.query({ windowId, active: true });
  if (!active || !placeholders.has(active.id)) return;
  await restore(active.id);
}

async function restore(placeholderId) {
  const orig = placeholders.get(placeholderId);
  placeholders.delete(placeholderId);
  try {
    await browser.tabs.get(orig);
    await browser.tabs.update(orig, { active: true });
    await browser.tabs.remove(placeholderId);
  } catch (e) {
    // original tab is gone; keep the placeholder so the window survives
  }
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg === "restore" && sender.tab) return restore(sender.tab.id);
});
