const fields = [...document.querySelectorAll("[data-k]")];
const frame = document.getElementById("frame");
const purl = document.getElementById("purl");
const rerr = document.getElementById("rerr");
const sampleCtx = templateContext("An example article — Example Site", "https://example.org/article", Date.now());

// the sample page, or the URL typed into "Preview as URL" with its host as title
function previewCtx() {
  const u = purl.value.trim();
  if (!u) return sampleCtx;
  let host = u;
  try { host = new URL(u).host || u; } catch (e) {}
  return templateContext(host, u, Date.now());
}
function setFrame() {
  const c = previewCtx();
  frame.src = browser.runtime.getURL("frozen.html") + "?preview&t=" + encodeURIComponent(c.title) +
    "&u=" + encodeURIComponent(c.url) + "&d=" + Date.now() + "&f=" + encodeURIComponent(browser.runtime.getURL("icon.svg"));
}
setFrame();

function showTitle(s) {
  const c = previewCtx();
  document.getElementById("ptitle").textContent = renderTemplate(settingsFor(c.url, s).titleTemplate, c);
}
function showErrors(text) {
  rerr.textContent = parseRules(text).errors.map((e) => `line ${e.line}: ${e.message}`).join("\n");
}
function load() {
  getSettings().then((s) => {
    for (const el of fields) {
      if (el === document.activeElement) continue;
      if (el.type === "checkbox") el.checked = !!s[el.dataset.k]; else el.value = s[el.dataset.k];
    }
    showTitle(s);
    showErrors(s.rules);
    document.getElementById("rdef").textContent = defaultsAsRule(s);
  });
}
load();
browser.storage.onChanged.addListener(load); // e.g. "Never freeze this site" from the menu
for (const el of fields) {
  el.addEventListener("input", async () => {
    const v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    if (el.dataset.k === "rules") showErrors(v);
    await browser.storage.local.set({ [el.dataset.k]: v });
    showTitle(await getSettings());
  });
}
purl.addEventListener("input", async () => { setFrame(); showTitle(await getSettings()); });
