const STORAGE_KEYS = {
  enabled: "steamtry_enabled",
  rate: "steamtry_rate",
  ts: "steamtry_rate_ts",
  error: "steamtry_last_error"
};

const RATE_CACHE_MS = 60 * 60 * 1000;
const PANEL_HOST_ID = "steamtry-panel-host";
const USD_PRICE_REGEX = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g;

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function now() {
  return Date.now();
}

function normalizeUsdDisplay(matchText) {
  return matchText.replace(/\s+/g, "");
}

function parseUsd(matchText) {
  const cleaned = matchText.replace("$", "").replace(/\s+/g, "").replace(/,/g, "");
  const v = Number.parseFloat(cleaned);
  return Number.isFinite(v) ? v : null;
}

function formatTry(amount) {
  return `₺${amount.toFixed(2)}`;
}

async function fetchUsdTryRate() {
  const endpoints = [
    {
      url: "https://open.er-api.com/v6/latest/USD",
      getRate: (json) => json?.rates?.TRY
    },
    {
      url: "https://api.exchangerate-api.com/v4/latest/USD",
      getRate: (json) => json?.rates?.TRY
    }
  ];

  let lastError = "";
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rate = ep.getRate(json);
      if (!Number.isFinite(rate)) throw new Error("Geçersiz kur");
      return { rate, error: "" };
    } catch (e) {
      lastError = e?.message ? String(e.message) : "Kur alınamadı";
    }
  }

  return { rate: null, error: lastError || "Kur alınamadı" };
}

async function getRate({ force } = { force: false }) {
  const data = await storageGet([STORAGE_KEYS.rate, STORAGE_KEYS.ts, STORAGE_KEYS.error]);
  const cachedRate = typeof data[STORAGE_KEYS.rate] === "number" ? data[STORAGE_KEYS.rate] : null;
  const cachedTs = typeof data[STORAGE_KEYS.ts] === "number" ? data[STORAGE_KEYS.ts] : null;
  const cachedFresh = cachedRate && cachedTs && now() - cachedTs < RATE_CACHE_MS;

  if (!force && cachedFresh) {
    return { rate: cachedRate, ts: cachedTs, lastError: data[STORAGE_KEYS.error] || "" };
  }

  const { rate, error } = await fetchUsdTryRate();
  if (rate && Number.isFinite(rate)) {
    const ts = now();
    await storageSet({ [STORAGE_KEYS.rate]: rate, [STORAGE_KEYS.ts]: ts, [STORAGE_KEYS.error]: "" });
    return { rate, ts, lastError: "" };
  }

  if (cachedRate && Number.isFinite(cachedRate)) {
    await storageSet({ [STORAGE_KEYS.error]: error || "Kur alınamadı (cache kullanılıyor)" });
    return { rate: cachedRate, ts: cachedTs, lastError: error || "Kur alınamadı (cache kullanılıyor)" };
  }

  const fallbackRate = 32.0;
  const ts = now();
  await storageSet({ [STORAGE_KEYS.rate]: fallbackRate, [STORAGE_KEYS.ts]: ts, [STORAGE_KEYS.error]: error || "Fallback kur kullanılıyor" });
  return { rate: fallbackRate, ts, lastError: error || "Fallback kur kullanılıyor" };
}

function ensureInPageStyles() {
  if (document.getElementById("steamtry-inpage-styles")) return;
  const style = document.createElement("style");
  style.id = "steamtry-inpage-styles";
  style.textContent = `
@keyframes steamtryFade { from { opacity: 0.0; } to { opacity: 1.0; } }
.steamtry-price { color: #a7f3d0; font-variant-numeric: tabular-nums; }
.steamtry-fade { animation: steamtryFade 180ms ease-out; }
`;
  document.documentElement.appendChild(style);
}

function createPanelHost() {
  if (document.getElementById(PANEL_HOST_ID)) return document.getElementById(PANEL_HOST_ID);
  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  host.style.position = "fixed";
  host.style.top = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "auto";
  document.documentElement.appendChild(host);
  return host;
}

function buildPanelShadowUI({ onToggle, onRefresh }) {
  const host = createPanelHost();
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
  while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("styles.css");

  const wrap = document.createElement("div");
  wrap.setAttribute("data-steamtry-panel", "1");
  wrap.className = "steamtry-panel bg-slate-900 text-slate-100 border border-slate-700 rounded-xl shadow-lg p-3 flex flex-col gap-2";
  wrap.style.width = "280px";

  const header = document.createElement("div");
  header.className = "steamtry-panel-header flex items-center justify-between gap-2";

  const titleWrap = document.createElement("div");
  titleWrap.className = "steamtry-panel-title-wrap min-w-0";

  const title = document.createElement("div");
  title.className = "steamtry-panel-title text-sm font-semibold";
  title.textContent = "USD → TRY";

  const sub = document.createElement("div");
  sub.className = "steamtry-panel-subtitle text-xs text-slate-300";
  sub.textContent = "Steam fiyat çevirici";

  titleWrap.appendChild(title);
  titleWrap.appendChild(sub);

  const toggle = document.createElement("div");
  toggle.className = "steamtry-switch";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("tabindex", "0");
  toggle.dataset.on = "0";

  const knob = document.createElement("div");
  knob.className = "steamtry-switch-knob";
  toggle.appendChild(knob);

  header.appendChild(titleWrap);
  header.appendChild(toggle);

  const rateBox = document.createElement("div");
  rateBox.className = "steamtry-panel-rate bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-col gap-1";

  const rateRow = document.createElement("div");
  rateRow.className = "steamtry-panel-rate-row flex items-center justify-between";
  const rateLabel = document.createElement("div");
  rateLabel.className = "steamtry-panel-rate-label text-sm font-semibold";
  rateLabel.textContent = "Güncel kur";
  const rateText = document.createElement("div");
  rateText.className = "steamtry-panel-rate-value text-sm text-emerald-300 font-semibold";
  rateText.textContent = "—";
  rateRow.appendChild(rateLabel);
  rateRow.appendChild(rateText);

  const rateMeta = document.createElement("div");
  rateMeta.className = "steamtry-panel-rate-meta text-xs text-slate-400";
  rateMeta.textContent = "—";

  rateBox.appendChild(rateRow);
  rateBox.appendChild(rateMeta);

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-2";

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "steamtry-btn w-full";
  refreshBtn.textContent = "Kuru yenile";

  actions.appendChild(refreshBtn);

  wrap.appendChild(header);
  wrap.appendChild(rateBox);
  wrap.appendChild(actions);

  shadow.appendChild(link);
  shadow.appendChild(wrap);

  toggle.addEventListener("click", () => onToggle());
  toggle.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onToggle();
  });

  refreshBtn.addEventListener("click", () => onRefresh(refreshBtn));

  return {
    setEnabled(enabled) {
      toggle.dataset.on = enabled ? "1" : "0";
      toggle.setAttribute("aria-checked", enabled ? "true" : "false");
    },
    setRate({ rate, ts, lastError }) {
      rateText.textContent = rate && Number.isFinite(rate) ? `1 USD = ₺${rate.toFixed(4)}` : "—";
      const parts = [];
      if (ts) {
        const d = new Date(ts);
        const pad = (n) => String(n).padStart(2, "0");
        parts.push(`Güncellendi: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
      }
      if (lastError) parts.push(`Hata: ${lastError}`);
      rateMeta.textContent = parts.length ? parts.join(" • ") : "—";
    },
    setRefreshing(isRefreshing) {
      refreshBtn.disabled = Boolean(isRefreshing);
      refreshBtn.textContent = isRefreshing ? "Yenileniyor…" : "Kuru yenile";
    }
  };
}

let enabled = true;
let usdTryRate = null;
let rateTs = null;
let lastError = "";
let observer = null;
let scheduled = false;
let panelUI = null;

function isSkippableTextNode(node) {
  if (!node?.nodeValue) return true;
  if (!node.nodeValue.includes("$")) return true;
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName ? parent.tagName.toLowerCase() : "";
  if (tag === "script" || tag === "style" || tag === "noscript") return true;
  if (parent.closest("span[data-steamtry-converted='1']")) return true;
  if (parent.closest(`#${PANEL_HOST_ID}`)) return true;
  return false;
}

function replacePricesInTextNode(textNode) {
  const text = textNode.nodeValue;
  if (!text || !USD_PRICE_REGEX.test(text)) return 0;
  USD_PRICE_REGEX.lastIndex = 0;

  let replaced = 0;
  let lastIndex = 0;
  const frag = document.createDocumentFragment();

  const matches = [...text.matchAll(USD_PRICE_REGEX)];
  for (const m of matches) {
    const matchText = m[0];
    const start = m.index ?? -1;
    if (start < 0) continue;
    const end = start + matchText.length;

    const usd = parseUsd(matchText);
    if (usd == null) continue;

    if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));

    const usdDisplay = normalizeUsdDisplay(matchText);
    const tryValue = usdTryRate ? usd * usdTryRate : null;
    const span = document.createElement("span");
    span.setAttribute("data-steamtry-converted", "1");
    span.setAttribute("data-usd", usdDisplay);
    span.setAttribute("data-usd-value", String(usd));
    span.className = "steamtry-price steamtry-fade";
    span.textContent = tryValue ? `${formatTry(tryValue)} (${usdDisplay})` : usdDisplay;
    frag.appendChild(span);

    lastIndex = end;
    replaced += 1;
  }

  if (!replaced) return 0;
  if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  textNode.parentNode.replaceChild(frag, textNode);
  return replaced;
}

function convertInRoot(rootNode) {
  if (!enabled) return;
  if (!usdTryRate || !Number.isFinite(usdTryRate)) return;

  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isSkippableTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) replacePricesInTextNode(n);
}

function updateConvertedSpans() {
  if (!usdTryRate || !Number.isFinite(usdTryRate)) return;
  const spans = document.querySelectorAll("span[data-steamtry-converted='1']");
  for (const span of spans) {
    const usdValue = Number.parseFloat(span.getAttribute("data-usd-value") || "");
    const usdDisplay = span.getAttribute("data-usd") || "";
    if (!Number.isFinite(usdValue) || !usdDisplay) continue;
    const tryValue = usdValue * usdTryRate;
    span.classList.remove("steamtry-fade");
    void span.offsetWidth;
    span.classList.add("steamtry-fade");
    span.textContent = `${formatTry(tryValue)} (${usdDisplay})`;
  }
}

function revertAllConverted() {
  const spans = document.querySelectorAll("span[data-steamtry-converted='1']");
  for (const span of spans) {
    const usdDisplay = span.getAttribute("data-usd") || span.textContent || "";
    span.replaceWith(document.createTextNode(usdDisplay));
  }
}

function scheduleConvert(node) {
  if (!enabled) return;
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    convertInRoot(node || document.body || document.documentElement);
  }, 120);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    let shouldRun = false;
    for (const m of mutations) {
      if (m.type === "characterData") {
        shouldRun = true;
        break;
      }
      if (m.type === "childList" && (m.addedNodes?.length || 0) > 0) {
        shouldRun = true;
        break;
      }
    }
    if (!shouldRun) return;
    scheduleConvert(document.body || document.documentElement);
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

async function setEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
  await storageSet({ [STORAGE_KEYS.enabled]: enabled });
  panelUI?.setEnabled(enabled);
  if (!enabled) {
    stopObserver();
    revertAllConverted();
    return;
  }
  if (!usdTryRate) {
    const res = await getRate({ force: false });
    usdTryRate = res.rate;
    rateTs = res.ts;
    lastError = res.lastError || "";
  }
  panelUI?.setRate({ rate: usdTryRate, ts: rateTs, lastError });
  convertInRoot(document.body || document.documentElement);
  startObserver();
}

async function refreshRate() {
  const res = await getRate({ force: true });
  usdTryRate = res.rate;
  rateTs = res.ts;
  lastError = res.lastError || "";
  panelUI?.setRate({ rate: usdTryRate, ts: rateTs, lastError });
  if (enabled) updateConvertedSpans();
  return { rate: usdTryRate, ts: rateTs, lastError, enabled };
}

async function init() {
  ensureInPageStyles();

  const settings = await storageGet([STORAGE_KEYS.enabled]);
  enabled = settings[STORAGE_KEYS.enabled] !== false;

  const rateRes = await getRate({ force: false });
  usdTryRate = rateRes.rate;
  rateTs = rateRes.ts;
  lastError = rateRes.lastError || "";

  panelUI = buildPanelShadowUI({
    onToggle: async () => {
      await setEnabled(!enabled);
    },
    onRefresh: async () => {
      panelUI?.setRefreshing(true);
      try {
        await refreshRate();
      } finally {
        panelUI?.setRefreshing(false);
      }
    }
  });

  panelUI.setEnabled(enabled);
  panelUI.setRate({ rate: usdTryRate, ts: rateTs, lastError });

  if (enabled) {
    convertInRoot(document.body || document.documentElement);
    startObserver();
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return;
  if (msg.type === "STEAMTRY_SET_ENABLED") {
    setEnabled(Boolean(msg.enabled)).then(() => sendResponse({ ok: true, enabled, rate: usdTryRate, ts: rateTs, lastError }));
    return true;
  }
  if (msg.type === "STEAMTRY_REFRESH_RATE") {
    refreshRate().then((res) => sendResponse(res));
    return true;
  }
  if (msg.type === "STEAMTRY_GET_STATUS") {
    sendResponse({ enabled, rate: usdTryRate, ts: rateTs, lastError });
    return;
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
