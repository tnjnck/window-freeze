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
  rules: "",             // per-site overrides; format in parseRules
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

function matchesPattern(url, p) {
  if (!p.includes("*")) return url.includes(p);
  const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
  return re.test(url);
}

function excluded(url, patterns) {
  for (let p of (patterns || "").split("\n")) {
    p = p.trim();
    if (!p || p.startsWith("#")) continue;
    if (matchesPattern(url, p)) return true;
  }
  return false;
}

// --- per-site rules
// Blocks separated by blank lines: one or more pattern lines (never-freeze
// syntax), then "key = value" lines. "#" lines are comments. The first rule
// whose patterns match a URL overrides the global settings for that page.
const RULE_KEYS = {
  style: "style", blur: "number", dim: "number", color: "string", showfavicon: "boolean", showlabel: "boolean",
  titletemplate: "string", labeltemplate: "string", minutes: "number", dwell: "number", idleminutes: "number",
  protectforms: "boolean", skippinned: "boolean", wholewindow: "boolean", preload: "boolean",
  readermaxchars: "number", unloadedprefix: "string", freeze: "freeze",
};
const RULE_ALIASES = { colour: "color", favicon: "showfavicon", label: "showlabel", title: "titletemplate" };
const RULE_NAMES = {};  // lower-case key -> DEFAULTS key
for (const k of Object.keys(DEFAULTS)) RULE_NAMES[k.toLowerCase()] = k;
RULE_NAMES.freeze = "freeze";
const STYLES = ["blur", "dim", "solid", "reader"];
const BOOLS = { true: true, yes: true, on: true, 1: true, false: false, no: false, off: false, 0: false };

function parseRuleValue(type, v) {
  switch (type) {
    case "number": { const n = Number(v); return v === "" || Number.isNaN(n) ? undefined : n; }
    case "boolean": return BOOLS[v.toLowerCase()];
    case "style": return STYLES.includes(v) ? v : undefined;
    case "freeze": return ["never", "normal"].includes(v.toLowerCase()) ? v.toLowerCase() : undefined;
    default:
      // "quoted" keeps leading/trailing spaces, which trimming would drop
      if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch (e) { return undefined; } }
      return v;
  }
}

function parseRules(text) {
  const rules = [], errors = [];
  let cur = null;
  const end = () => { if (cur && cur.patterns.length) rules.push(cur); cur = null; };
  (text || "").split("\n").forEach((raw, i) => {
    const line = i + 1, t = raw.trim();
    if (!t) return end();
    if (t.startsWith("#")) return;
    const eq = t.indexOf("=");
    if (eq < 0) {
      if (cur && Object.keys(cur.overrides).length) return errors.push({ line, message: "expected key = value" });
      if (!cur) cur = { patterns: [], overrides: {}, line };
      cur.patterns.push(t);
      return;
    }
    if (!cur) return errors.push({ line, message: "no pattern line above" });
    let key = t.slice(0, eq).trim().toLowerCase();
    const v = t.slice(eq + 1).trim();
    key = RULE_ALIASES[key] || key;
    const type = RULE_KEYS[key];
    if (!type) return errors.push({ line, message: "unknown key " + JSON.stringify(t.slice(0, eq).trim()) });
    const val = parseRuleValue(type, v);
    if (val === undefined) return errors.push({ line, message: "bad value for " + RULE_NAMES[key] + ": " + JSON.stringify(v) });
    cur.overrides[RULE_NAMES[key]] = val;
  });
  end();
  return { rules, errors };
}

let rulesCache = { text: null, parsed: null };
function specificity(p) { return p.replace(/\*/g, "").length; }

// Matching rules, least specific first: specificity is the number of non-*
// characters in the matched pattern (the most specific one if several match);
// ties keep text order. Each entry is { rule, pattern, specificity }.
function matchingRules(url, S) {
  const text = S.rules || "";
  if (rulesCache.text !== text) rulesCache = { text, parsed: parseRules(text) };
  const out = [];
  for (const rule of rulesCache.parsed.rules) {
    let best = null;
    for (const p of rule.patterns) {
      if (matchesPattern(url || "", p) && (!best || specificity(p) > specificity(best))) best = p;
    }
    if (best) out.push({ rule, pattern: best, specificity: specificity(best) });
  }
  return out.sort((a, b) => a.specificity - b.specificity);
}

// The most specific matching pattern, or "".
function ruleFor(url, S) {
  const m = matchingRules(url, S);
  return m.length ? m[m.length - 1].pattern : "";
}

// S with every matching rule applied in turn, least specific first; .freeze is
// "never" or "normal". A "*" block is the base layer over the form settings.
function settingsFor(url, S) {
  const out = { ...S, freeze: "normal" };
  for (const m of matchingRules(url, S)) Object.assign(out, m.rule.overrides);
  return out;
}

// The global settings written in rule syntax under "*", for the options page.
function defaultsAsRule(S) {
  const keys = ["style", "blur", "dim", "color", "showFavicon", "showLabel", "titleTemplate", "labelTemplate", "minutes",
    "dwell", "idleMinutes", "protectForms", "skipPinned", "wholeWindow", "preload", "readerMaxChars", "unloadedPrefix"];
  const show = (v) => typeof v === "string" && v !== v.trim() ? JSON.stringify(v) : String(v);
  return ["*", ...keys.map((k) => k + " = " + show(S[k]))].join("\n");
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
