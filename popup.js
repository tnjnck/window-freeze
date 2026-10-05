function fmt(until) {
  if (!until) return "";
  if (until === Infinity || until > 8e15) return "until cleared";
  const m = Math.round((until - Date.now()) / 60000);
  return m >= 90 ? `for ${Math.round(m / 60)} h` : `for ${m} min`;
}
async function refresh() {
  const s = await browser.runtime.sendMessage({ type: "state" });
  document.getElementById("wstate").textContent =
    [s.exemptUntil ? "not freezing " + fmt(s.exemptUntil) : "", s.kept ? "active tab kept: " + s.kept : ""].filter(Boolean).join(" · ");
  document.getElementById("gstate").textContent =
    (s.pausedUntil > Date.now() ? "paused " + fmt(s.pausedUntil) + "\n" : "") +
    `${s.frozen} of ${s.windows} windows frozen · ${s.discarded} of ${s.tabs} tabs unloaded`;
}
for (const b of document.querySelectorAll("button[data-act]")) {
  b.onclick = async () => {
    await browser.runtime.sendMessage({ type: "command", name: b.dataset.act });
    if (b.dataset.act.startsWith("freeze")) window.close(); else refresh();
  };
}
document.getElementById("opts").onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
refresh();
