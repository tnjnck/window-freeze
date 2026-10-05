// Shared by background, frozen page and options. Loaded as a plain script.
const DEFAULTS = {
  minutes: 5,            // unfocused minutes before a window freezes
  dwell: 2,              // focused seconds before a frozen window thaws (0 = at once)
  preload: true,         // start loading the page behind the placeholder as soon as the window is focused
  visibleIsActive: false, // a window that is on screen counts as in use: it is not frozen, and a frozen one thaws
  idleMinutes: 30,       // unload a background tab unseen for this long (0 = never)
  unloadedPrefix: "💤 ", // put in front of an unloaded tab's title ("" = none)
  titleTemplate: "Frozen: {title}",
  style: "blur",         // blur | dim | solid | reader
  readerMaxChars: 200000, // reader mode: cap on the extracted HTML
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

// Text-only copy of a page for the reader placeholder: whitelisted tags, no
// attributes except an absolute href on links. Self-contained because the
// background injects it with executeScript as readerExtract.toString().
// Without root it reads the live document and its scroll position; with root
// (frozen page re-sanitising a stored snapshot) it serialises that subtree.
function readerExtract(max, root) {
  const KEEP = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "tr", "td", "th", "strong", "em", "b", "i", "br", "hr"]);
  const DROP = new Set(["script", "style", "noscript", "iframe", "img", "picture", "video", "audio", "canvas", "svg",
    "math", "object", "embed", "input", "textarea", "select", "button", "nav", "aside", "footer", "template", "link",
    "meta", "dialog"]);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const live = !root;
  let scrollFrac = 0;
  if (live) {
    const main = document.querySelector("main, article, [role=main]");
    root = main && main.textContent.replace(/\s+/g, " ").trim().length > 500 ? main : document.body;
    scrollFrac = (window.scrollY || 0) / Math.max(1, document.documentElement.scrollHeight);
  }
  const out = [];
  let len = 0, chars = 0, full = false;
  const push = (s) => { out.push(s); len += s.length; if (len >= max) full = true; };
  const hidden = (el) => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    if (!live) return false;
    const cs = getComputedStyle(el);
    return cs.display === "none" || cs.visibility === "hidden";
  };
  function walk(node, pre) {
    if (full) return;
    if (node.nodeType === 3) {
      const t = pre ? node.data : node.data.replace(/\s+/g, " ");
      if (!t) return;
      chars += t.trim().length;
      push(esc(t));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (DROP.has(tag) || hidden(node)) return;
    // site chrome; a header inside an article is its title block
    if (tag === "header" && !node.closest("article, main")) return;
    if (tag === "br" || tag === "hr") { push("<" + tag + ">"); return; }
    if (!node.textContent.trim()) return;
    let open = "", close = "";
    if (tag === "a") {
      const href = node.href;
      if (/^https?:/.test(href)) { open = '<a href="' + esc(href) + '">'; close = "</a>"; }
    } else if (KEEP.has(tag)) { open = "<" + tag + ">"; close = "</" + tag + ">"; }
    if (open) push(open);
    for (const c of node.childNodes) { if (full) break; walk(c, pre || tag === "pre"); }
    if (close) push(close);
  }
  if (root) walk(root, false);
  return { html: out.join(""), scrollFrac, chars };
}
