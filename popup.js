const STORAGE_KEYS = {
  enabled: "steamtry_enabled",
  rate: "steamtry_rate",
  ts: "steamtry_rate_ts",
  error: "steamtry_last_error"
};

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function formatRate(rate) {
  if (!rate || !Number.isFinite(rate)) return "—";
  return `1 USD = ₺${rate.toFixed(4)}`;
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}

function setToggleUI(enabled) {
  const toggle = document.getElementById("toggle");
  toggle.dataset.on = enabled ? "1" : "0";
  toggle.setAttribute("aria-checked", enabled ? "true" : "false");
}

function setStatusText(text) {
  document.getElementById("statusText").textContent = text;
}

function setRateUI(rate, ts, lastError) {
  document.getElementById("rateText").textContent = formatRate(rate);
  const metaParts = [];
  if (ts) metaParts.push(`Güncellendi: ${formatTime(ts)}`);
  if (lastError) metaParts.push(`Hata: ${lastError}`);
  document.getElementById("rateMeta").textContent = metaParts.length ? metaParts.join(" • ") : "—";
}

function setMetaUI() {
  const manifest = chrome.runtime.getManifest();
  const makerText = document.getElementById("makerText");
  const versionText = document.getElementById("versionText");
  if (makerText) makerText.textContent = "@ygtdmrlp";
  if (versionText) versionText.textContent = manifest?.version ? `v${manifest.version}` : "—";
}

function requestUpdateCheck() {
  return new Promise((resolve) => {
    if (!chrome.runtime.requestUpdateCheck) {
      resolve({ status: "unsupported" });
      return;
    }
    chrome.runtime.requestUpdateCheck((status, details) => resolve({ status, details }));
  });
}

function setUpdateText(text) {
  const el = document.getElementById("updateText");
  if (el) el.textContent = text;
}

async function refreshFromStorage() {
  const { [STORAGE_KEYS.enabled]: enabled, [STORAGE_KEYS.rate]: rate, [STORAGE_KEYS.ts]: ts, [STORAGE_KEYS.error]: err } =
    await storageGet([STORAGE_KEYS.enabled, STORAGE_KEYS.rate, STORAGE_KEYS.ts, STORAGE_KEYS.error]);
  setToggleUI(Boolean(enabled));
  setRateUI(typeof rate === "number" ? rate : null, ts || null, err || "");
}

async function init() {
  const refreshBtn = document.getElementById("refreshBtn");
  const toggle = document.getElementById("toggle");
  const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");

  setMetaUI();
  await refreshFromStorage();

  const status = await sendToActiveTab({ type: "STEAMTRY_GET_STATUS" });
  const tab = await getActiveTab();
  const isSteam = /^https:\/\/store\.steampowered\.com\//.test(tab?.url || "");

  if (!isSteam) {
    setStatusText("Steam Store sayfasına geçin.");
    refreshBtn.disabled = true;
    return;
  }

  if (status?.enabled != null) {
    setToggleUI(Boolean(status.enabled));
    setRateUI(status.rate || null, status.ts || null, status.lastError || "");
    setStatusText(status.enabled ? "Çeviri aktif" : "Çeviri pasif");
  } else {
    setStatusText("Sayfayı yenileyin (content script yüklenmedi).");
  }

  async function setEnabled(enabled) {
    await storageSet({ [STORAGE_KEYS.enabled]: enabled });
    setToggleUI(enabled);
    setStatusText(enabled ? "Çeviri aktif" : "Çeviri pasif");
    await sendToActiveTab({ type: "STEAMTRY_SET_ENABLED", enabled });
  }

  toggle.addEventListener("click", async () => {
    const enabled = toggle.dataset.on !== "1";
    await setEnabled(enabled);
  });

  toggle.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const enabled = toggle.dataset.on !== "1";
    await setEnabled(enabled);
  });

  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    setStatusText("Kur yenileniyor…");
    const res = await sendToActiveTab({ type: "STEAMTRY_REFRESH_RATE" });
    if (res?.rate) setRateUI(res.rate, res.ts || null, res.lastError || "");
    setStatusText(res?.enabled ? "Çeviri aktif" : "Çeviri pasif");
    refreshBtn.disabled = false;
  });

  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener("click", async () => {
      checkUpdatesBtn.disabled = true;
      setUpdateText("Kontrol ediliyor…");
      try {
        const { status, details } = await requestUpdateCheck();
        if (status === "update_available") {
          const nextVersion = details?.version ? `v${details.version}` : "yeni sürüm";
          setUpdateText(`Güncelleme mevcut: ${nextVersion}.`);
        } else if (status === "no_update") {
          setUpdateText("Güncelleme yok.");
        } else if (status === "throttled") {
          setUpdateText("Çok sık kontrol edildi. Bir süre sonra tekrar deneyin.");
        } else {
          setUpdateText("Güncelleme kontrolü desteklenmiyor.");
        }
      } finally {
        checkUpdatesBtn.disabled = false;
      }
    });
  }
}

init();
