const m = document.getElementById("m");
browser.storage.local.get({ minutes: 5 }).then((s) => (m.value = s.minutes));
m.onchange = () => browser.storage.local.set({ minutes: Number(m.value) || 5 });
