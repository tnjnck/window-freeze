const q = new URLSearchParams(location.search);
const ctx = templateContext(q.get("t") || "", q.get("u") || "", q.get("d"));
const preview = q.has("preview");
const nav = q.has("nav");
const shotEl = document.getElementById("shot");
const labelEl = document.getElementById("label");
const iconEl = document.getElementById("icon");
const titleEl = document.getElementById("title");
const readerEl = document.getElementById("reader");
const riconEl = document.getElementById("ricon");
const rtitleEl = document.getElementById("rtitle");
const rbodyEl = document.getElementById("rbody");
const f = q.get("f");
if (f) { iconEl.src = f; riconEl.src = f; } else { iconEl.remove(); riconEl.remove(); }
document.getElementById("rtime").textContent = ctx.date + " " + ctx.time;

const SAMPLE = "<h1>An example article</h1><p>A placeholder article standing in for the page's text. The reader style " +
  "keeps headings, paragraphs, lists, quotes, code and tables, and drops everything else: images, scripts, menus, sidebars.</p>" +
  "<h2>Why text</h2><p>A screenshot shows what the page looked like; text can be read and scrolled while the tab stays unloaded. " +
  "Links such as <a href=\"https://example.org/\">this one</a> thaw the window and take the page there.</p>" +
  "<ul><li>Scrolling and the arrow keys do not thaw.</li><li>A click or any other key does.</li></ul>" +
  "<blockquote><p>Pages with little text, such as apps, fall back to the screenshot.</p></blockquote>" +
  "<p>" + "The rest of the article continues below. ".repeat(40) + "</p>";

let settings = null;
let snap = null;      // {html, scrollFrac, chars} or null
let rendered = false;

function readerActive(s) {
  return s.style === "reader" && !!snap && snap.chars >= 200;
}

function renderReader() {
  // the stored HTML was produced by readerExtract; run it through the same whitelist again
  const doc = new DOMParser().parseFromString(snap.html, "text/html");
  rbodyEl.innerHTML = readerExtract(Infinity, doc.body).html;
  rendered = true;
  requestAnimationFrame(() => {
    readerEl.scrollTop = (snap.scrollFrac || 0) * readerEl.scrollHeight;
    if (!preview) readerEl.focus({ preventScroll: true });
  });
}

function apply(s) {
  document.title = renderTemplate(s.titleTemplate, ctx);
  const label = renderTemplate(s.labelTemplate, ctx);
  titleEl.textContent = label;
  rtitleEl.textContent = label;
  titleEl.style.display = s.showLabel ? "" : "none";
  rtitleEl.style.visibility = s.showLabel ? "" : "hidden";
  iconEl.style.display = riconEl.style.display = s.showFavicon ? "" : "none";
  document.body.style.background = s.color;
  const reader = readerActive(s);
  const dark = `brightness(${1 - Number(s.dim) / 100})`;
  shotEl.style.display = s.style === "solid" || reader ? "none" : "";
  shotEl.style.filter = s.style === "blur" ? `blur(${Number(s.blur)}px) ${dark} saturate(.7)` : dark;
  labelEl.style.display = reader ? "none" : "";
  readerEl.style.display = reader ? "block" : "none";
  if (reader && !rendered) renderReader();
}
function refresh() { getSettings().then((all) => { settings = settingsFor(ctx.url, all); apply(settings); }); }
refresh();
browser.storage.onChanged.addListener(refresh);

const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const resume = () => nav ? history.back() : browser.runtime.sendMessage("restore");

if (preview) {
  // stand-in for a screenshot: a page-like pattern drawn on a canvas
  const c = document.createElement("canvas"); c.width = 800; c.height = 500;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f4f6"; g.fillRect(0, 0, 800, 500);
  g.fillStyle = "#3b5bdb"; g.fillRect(0, 0, 800, 56);
  g.fillStyle = "#222";
  for (let y = 100; y < 480; y += 28) { g.fillRect(60, y, 300 + (y * 7) % 380, 12); }
  shotEl.style.backgroundImage = `url(${c.toDataURL()})`;
  snap = { html: SAMPLE, scrollFrac: 0, chars: SAMPLE.length };
  if (settings) apply(settings);
  rbodyEl.addEventListener("click", (e) => { if (e.target.closest("a")) e.preventDefault(); });
} else {
  browser.runtime.sendMessage("snapshot").then((shot) => {
    if (shot) shotEl.style.backgroundImage = `url(${shot})`;
  });
  browser.runtime.sendMessage("reader").then((r) => {
    if (r && r.html) { snap = r; if (settings) apply(settings); }
  });
  const report = () => browser.runtime.sendMessage({ type: "visible", visible: document.visibilityState === "visible" });
  addEventListener("visibilitychange", report);
  report();
  addEventListener("mousedown", (e) => {
    if (readerActive(settings || DEFAULTS)) {
      if (e.target.closest("a")) return;                                       // handled on click
      if (e.target === readerEl && e.clientX >= readerEl.clientWidth) return;  // scrollbar
    }
    resume();
  });
  rbodyEl.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || e.button !== 0) return;
    e.preventDefault();
    browser.runtime.sendMessage({ type: "restore-to", url: a.href });
  });
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (NAV_KEYS.has(e.key) && readerActive(settings || DEFAULTS)) return;
    resume();
  });
}
