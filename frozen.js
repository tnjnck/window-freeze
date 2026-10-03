const q = new URLSearchParams(location.search);
const t = q.get("t") || "";
document.title = "Frozen: " + t;
document.getElementById("title").textContent = t;
const f = q.get("f");
if (f) document.getElementById("icon").src = f; else document.getElementById("icon").remove();
browser.runtime.sendMessage("snapshot").then((shot) => {
  if (shot) document.getElementById("shot").style.backgroundImage = `url(${shot})`;
});
const resume = () => browser.runtime.sendMessage("restore");
addEventListener("mousedown", resume);
addEventListener("keydown", (e) => { if (!e.ctrlKey && !e.altKey && !e.metaKey) resume(); });
