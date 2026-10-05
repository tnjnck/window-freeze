const fields = [...document.querySelectorAll("[data-k]")];
const frame = document.getElementById("frame");
const sampleCtx = templateContext("An example article — Example Site", "https://example.org/article", Date.now());
frame.src = browser.runtime.getURL("frozen.html") + "?preview&t=" + encodeURIComponent(sampleCtx.title) +
  "&u=" + encodeURIComponent(sampleCtx.url) + "&d=" + Date.now() + "&f=" + encodeURIComponent(browser.runtime.getURL("icon.svg"));

function showTitle(s) {
  document.getElementById("ptitle").textContent = renderTemplate(s.titleTemplate, sampleCtx);
}
function load() {
  getSettings().then((s) => {
    for (const el of fields) {
      if (el === document.activeElement) continue;
      if (el.type === "checkbox") el.checked = !!s[el.dataset.k]; else el.value = s[el.dataset.k];
    }
    showTitle(s);
  });
}
load();
browser.storage.onChanged.addListener(load); // e.g. "Never freeze this site" from the menu
for (const el of fields) {
  el.addEventListener("input", async () => {
    const v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    await browser.storage.local.set({ [el.dataset.k]: v });
    showTitle(await getSettings());
  });
}
