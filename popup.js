function fmt(until) {
  if (!until) return "";
  if (until === Infinity || until > 8e15) return "until cleared";
  const m = Math.round((until - Date.now()) / 60000);
  return m >= 90 ? `for ${Math.round(m / 60)} h` : `for ${m} min`;
}
async function refresh() {
  const s = await browser.runtime.sendMessage({ type: "state" });
  document.getElementById("wstate").textContent = s.exemptUntil ? "not frozen " + fmt(s.exemptUntil) : "";
  document.getElementById("gstate").textContent =
    (s.pausedUntil > Date.now() ? "paused " + fmt(s.pausedUntil) + " · " : "") + `${s.frozen} frozen`;
}
for (const b of document.querySelectorAll("button")) {
  b.onclick = async () => {
    const ms = b.dataset.ms === "inf" ? "inf" : Number(b.dataset.ms || 0);
    await browser.runtime.sendMessage({ type: b.dataset.act, ms });
    if (b.dataset.act === "freeze-now") window.close(); else refresh();
  };
}
refresh();
