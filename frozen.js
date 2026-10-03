const q = new URLSearchParams(location.search);
const t = q.get("t") || "";
document.title = "Frozen: " + t;
document.getElementById("title").textContent = t;
const f = q.get("f");
if (f) document.getElementById("icon").src = f; else document.getElementById("icon").remove();
document.getElementById("go").onclick = () => browser.runtime.sendMessage("restore");
