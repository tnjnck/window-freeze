const q = new URLSearchParams(location.search);
const ctx = templateContext(q.get("t") || "", q.get("u") || "", q.get("d"));
const preview = q.has("preview");
const shotEl = document.getElementById("shot");
const iconEl = document.getElementById("icon");
const titleEl = document.getElementById("title");
const f = q.get("f");
if (f) iconEl.src = f; else iconEl.remove();

function apply(s) {
  document.title = renderTemplate(s.titleTemplate, ctx);
  titleEl.textContent = renderTemplate(s.labelTemplate, ctx);
  titleEl.style.display = s.showLabel ? "" : "none";
  iconEl.style.display = s.showFavicon ? "" : "none";
  document.body.style.background = s.color;
  const dark = `brightness(${1 - Number(s.dim) / 100})`;
  shotEl.style.display = s.style === "solid" ? "none" : "";
  shotEl.style.filter = s.style === "blur" ? `blur(${Number(s.blur)}px) ${dark} saturate(.7)` : dark;
}
getSettings().then(apply);
browser.storage.onChanged.addListener(() => getSettings().then(apply));

if (preview) {
  // stand-in for a screenshot: a page-like pattern drawn on a canvas
  const c = document.createElement("canvas"); c.width = 800; c.height = 500;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f4f6"; g.fillRect(0, 0, 800, 500);
  g.fillStyle = "#3b5bdb"; g.fillRect(0, 0, 800, 56);
  g.fillStyle = "#222";
  for (let y = 100; y < 480; y += 28) { g.fillRect(60, y, 300 + (y * 7) % 380, 12); }
  shotEl.style.backgroundImage = `url(${c.toDataURL()})`;
} else {
  browser.runtime.sendMessage("snapshot").then((shot) => {
    if (shot) shotEl.style.backgroundImage = `url(${shot})`;
  });
  const resume = () => q.has("nav") ? history.back() : browser.runtime.sendMessage("restore");
  addEventListener("mousedown", resume);
  addEventListener("keydown", (e) => { if (!e.ctrlKey && !e.altKey && !e.metaKey) resume(); });
}
