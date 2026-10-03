const m = document.getElementById("m");
const d = document.getElementById("d");
browser.storage.local.get({ minutes: 5, dwell: 2 }).then((s) => { m.value = s.minutes; d.value = s.dwell; });
m.onchange = () => browser.storage.local.set({ minutes: Number(m.value) || 5 });
d.onchange = () => browser.storage.local.set({ dwell: Math.max(0, Number(d.value) || 0) });
