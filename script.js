/* ==========
   User-first Travel UI (Modified for XML Showcase)
   - data.xml  : data source
   - parse     : XML -> Model
   - render    : Model -> UI
   ========== */

const state = {
  xmlText: "",
  meta: { updated: "", title: "", subtitle: "" },
  spots: [],
  filtered: [],
  activeFilterKey: null,
};

const els = {
  grid: document.getElementById("grid"),
  region: document.getElementById("region"),
  sort: document.getElementById("sort"),
  resultMeta: document.getElementById("resultMeta"),
  updatedText: document.getElementById("updatedText"),

  btnTheme: document.getElementById("btnTheme"),

  // Quick open chips
  quickChips: document.getElementById("quickChips"),

  // XML Viewer UI (Now active for all users)
  btnXml: document.getElementById("btnXml"),
  modalXml: document.getElementById("modalXml"),
  xmlPretty: document.getElementById("xmlPretty"),

  // Details modal
  modalDetails: document.getElementById("modalDetails"),
  modalBody: document.getElementById("modalBody"),

  // Travel inspiration panel
  btnSurprise: document.getElementById("btnSurprise"),
  btnReset: document.getElementById("btnReset"),
};

// 保留 debug 參數供進階開發使用，但 XML 檢視器現在對所有用戶開放
const isDebug = new URLSearchParams(location.search).has("debug");

init().catch((err) => {
  console.error(err);
  if (els.resultMeta) {
    els.resultMeta.textContent =
      "載入失敗：請用 http://localhost 方式開啟，並確認 data.xml 正確。";
  }
});

async function init() {
  applySavedTheme();
  bindEvents();

  // 1. 載入 XML
  const { xmlText, xmlDoc } = await loadXml("data.xml");
  state.xmlText = xmlText;

  // 2. 解析 XML
  const model = parseXmlToModel(xmlDoc);
  state.meta = model.meta;
  state.spots = model.spots;

  if (els.updatedText) els.updatedText.textContent = `資料更新：${state.meta.updated || "未知"}`;

  // ✅ 修改：不再檢查 isDebug，直接將 XML 內容填入檢視器
  if (els.xmlPretty) {
    els.xmlPretty.textContent = prettyXml(xmlText);
  }

  // 3. 建立快速選單
  buildQuickChips();

  // 4. 初始渲染
  state.filtered = [...state.spots];
  render();
}

/* =======================
   Event binding
   ======================= */

function bindEvents() {
  const onChange = () => {
    applyFilters();
    render();
  };

  els.region?.addEventListener("change", onChange);
  els.sort?.addEventListener("change", onChange);

  els.btnTheme?.addEventListener("click", toggleTheme);

  // ✅ 修改：不再檢查 isDebug，直接綁定「原始資料」按鈕點擊事件
  if (els.btnXml && els.modalXml) {
    els.btnXml.addEventListener("click", () => els.modalXml.showModal());
  }

  // Chips click (Quick Filter)
  document.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = (btn.getAttribute("data-tag") || btn.getAttribute("data-q") || btn.textContent || "").trim();
      if (!key) return;

      if (state.activeFilterKey === key) {
        state.activeFilterKey = null;
      } else {
        state.activeFilterKey = key;
      }

      updateChipActiveState();
      applyFilters();
      render();
      document.getElementById("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Surprise pick
  els.btnSurprise?.addEventListener("click", () => {
    if (!state.spots.length) return;
    applyFilters();
    const pool = state.filtered.length ? state.filtered : state.spots;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openDetails(pick);
  });

  // Reset
  els.btnReset?.addEventListener("click", () => {
    if (els.region) els.region.value = "all";
    if (els.sort) els.sort.value = "recommended";
    state.activeFilterKey = null;
    updateChipActiveState();
    applyFilters();
    render();
  });
}

function updateChipActiveState() {
  document.querySelectorAll(".chip").forEach((btn) => {
    const key = (btn.getAttribute("data-tag") || btn.getAttribute("data-q") || btn.textContent || "").trim();
    btn.classList.toggle("is-active", !!key && key === state.activeFilterKey);
  });
}

/* =======================
   Quick-open chips
   ======================= */

function buildQuickChips() {
  if (!els.quickChips) return;
  els.quickChips.innerHTML = "";

  const frag = document.createDocumentFragment();
  state.spots.forEach((spot) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quickchip";
    b.textContent = spot.name;
    b.addEventListener("click", () => openDetails(spot));
    frag.appendChild(b);
  });

  els.quickChips.appendChild(frag);
}

/* =======================
   Filtering & sorting
   ======================= */

function applyFilters() {
  const region = els.region?.value || "all";
  const sort = els.sort?.value || "recommended";

  let list = [...state.spots];

  // region
  if (region !== "all") {
    list = list.filter((s) => s.region === region);
  }

  // quick filter key
  if (state.activeFilterKey) {
    list = list.filter((s) => matchQuickFilter(s, state.activeFilterKey));
  }

  // sort
  list = sortSpots(list, sort);

  state.filtered = list;
}

function matchQuickFilter(spot, key) {
  const tags = new Set(spot.tags || []);
  const name = spot.name || "";
  const pref = spot.prefecture || "";

  switch (key) {
    case "世界遺產":
      return tags.has("世界遺產");
    case "鳥居隧道":
      return tags.has("千本鳥居") || name.includes("伏見");
    case "古城美學":
      return tags.has("現存天守") || name.includes("城");
    case "京都":
    case "京都名勝":
      return pref.includes("京都");
    case "海上":
    case "海景/海上鳥居":
      return tags.has("海上鳥居") || tags.has("潮汐景觀") || name.includes("宮島") || name.includes("嚴島");
    case "紅葉":
      return (spot.bestTime || "").includes("秋");
    default:
      return tags.has(key);
  }
}

function sortSpots(list, mode) {
  if (mode === "recommended") return list;

  const byName = (a, b) => (a.name || "").localeCompare(b.name || "", "zh-Hant");
  const byYearAsc = (a, b) => (a.establishedYear ?? 999999) - (b.establishedYear ?? 999999);
  const byYearDesc = (a, b) => (b.establishedYear ?? -1) - (a.establishedYear ?? -1);

  const copy = [...list];
  switch (mode) {
    case "nameAsc":
      return copy.sort(byName);
    case "establishedAsc":
      return copy.sort(byYearAsc);
    case "establishedDesc":
      return copy.sort(byYearDesc);
    default:
      return list;
  }
}

/* =======================
   Rendering
   ======================= */

function render() {
  const total = state.spots.length;
  const shown = state.filtered.length;

  const region = els.region?.value || "all";
  const regionText = region === "all" ? "全部地區" : region;
  const filterText = state.activeFilterKey ? `｜篩選：${state.activeFilterKey}` : "";
  if (els.resultMeta) els.resultMeta.textContent = `顯示 ${shown} / ${total}（${regionText}${filterText}）`;


  if (!els.grid) return;
  els.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  state.filtered.forEach((spot) => frag.appendChild(renderCard(spot)));
  els.grid.appendChild(frag);
}

function renderCard(spot) {
  const card = el("article", "card");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `${spot.name} 景點卡片`);

  // Media
  const media = el("div", "media");
  const img = new Image();
  img.className = "media__img";
  img.loading = "lazy";
  img.alt = `${spot.name} 圖片`;
  img.referrerPolicy = "no-referrer";
  img.src = withWidth(spot.hero, 1200);

  img.addEventListener("load", () => img.classList.add("is-loaded"));
  img.addEventListener("error", () => {
    img.classList.add("is-loaded");
    img.src = makeFallbackDataUrl(spot.name);
  });

  const shade = el("div", "media__shade");
  const badges = el("div", "badges");
  const b1 = badge(`${spot.region || "—"}`, false);
  const b2 = badge(`${spot.bestTime || "全年皆宜"}`, true);
  badges.append(b1, b2);

  media.append(img, shade, badges);

  // Body
  const body = el("div", "card__body");
  const title = el("h3", "card__title", spot.name);
  const meta = el("div", "card__meta");
  meta.append(
    spanText(spot.prefecture || "—"),
    metaDot(),
    spanText(`建成年：${spot.establishedYear || "—"}`),
    metaDot(),
    spanText(spot.era || "—")
  );

  const summary = el("p", "card__summary", spot.summary || "");
  const tagrow = el("div", "tagrow");
  (spot.tags || []).slice(0, 3).forEach((t) => tagrow.appendChild(el("span", "tag", t)));

  const actions = el("div", "card__actions");
  const btnDetails = button("btn btn--mini btn--primary", "查看詳情");
  const btnMap = linkButton(spot.map, "開啟地圖");

  btnDetails.addEventListener("click", () => openDetails(spot));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetails(spot);
    }
  });

  actions.append(btnDetails, btnMap);
  body.append(title, meta, summary, tagrow, actions);
  card.append(media, body);

  return card;
}

/* =======================
   Details modal
   ======================= */

function openDetails(spot) {
  if (!els.modalDetails || !els.modalBody) return;
  els.modalBody.innerHTML = "";
  els.modalBody.appendChild(renderDetails(spot));
  els.modalDetails.showModal();
}

function renderDetails(spot) {
  const wrap = el("div", "details");

  const left = el("div", "details__img");
  const img = new Image();
  img.alt = `${spot.name} 大圖`;
  img.loading = "eager";
  img.referrerPolicy = "no-referrer";
  img.src = withWidth(spot.hero, 1600);
  img.addEventListener("error", () => (img.src = makeFallbackDataUrl(spot.name)));
  left.appendChild(img);

  const right = el("div", "details__right");
  const kicker = el("div", "details__kicker");
  kicker.append(
    spanText(spot.prefecture || "—"),
    metaDot(),
    spanText(`${spot.region || "—"}`),
    metaDot(),
    spanText(`建成年：${spot.establishedYear || "—"}`)
  );

  const name = el("h2", "details__name", spot.name);
  const story = el("p", "details__text", spot.story || "");

  const hlTitle = el("h3", "modal__title", "亮點");
  const hlList = el("ul", "details__list");
  (spot.highlights || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    hlList.appendChild(li);
  });

  const tipsTitle = el("h3", "modal__title", "小提醒");
  const tipsList = el("ul", "details__list");
  (spot.tips || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsList.appendChild(li);
  });

  const access = el("p", "details__text", `交通：${spot.access || "—"}`);
  const bestTime = el("p", "details__text", `推薦季節：${spot.bestTime || "—"}`);

  const creditText = spot.credit ? `圖片來源：${spot.credit}` : `圖片來源：${spot.source || "Wikimedia Commons"}`;
  const credit = el("p", "details__text", creditText);

  const cta = el("div", "details__cta");
  cta.append(
    linkButton(spot.map, "Google Maps"),
    makeMiniButton("複製景點資訊", () => copyText(makeSpotText(spot)))
  );

  // Debug 按鈕（針對單一景點），這裡保留檢查 isDebug，只在開發模式顯示
  if (isDebug && els.modalXml && els.xmlPretty) {
    cta.append(
      makeMiniButton("Debug: 檢視此點 XML", () => {
        els.modalDetails?.close();
        els.modalXml?.showModal();
        scrollToXmlId(spot.id);
      })
    );
  }

  right.append(kicker, name, story, hlTitle, hlList, tipsTitle, tipsList, access, bestTime, credit, cta);
  wrap.append(left, right);
  return wrap;
}

/* =======================
   XML Load + Parse
   ======================= */

async function loadXml(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load XML: ${res.status}`);
  const xmlText = await res.text();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");
  const errNode = xmlDoc.querySelector("parsererror");
  if (errNode) throw new Error("XML 解析失敗。");

  return { xmlText, xmlDoc };
}

function parseXmlToModel(xmlDoc) {
  const meta = {
    updated: xmlDoc.documentElement.getAttribute("updated") || "",
    title: text(xmlDoc.querySelector("meta > title")),
    subtitle: text(xmlDoc.querySelector("meta > subtitle")),
  };

  const spots = [...xmlDoc.querySelectorAll("spots > spot")].map((node) => {
    const establishedNode = node.querySelector("established");
    const year = establishedNode ? parseInt(establishedNode.getAttribute("year") || "", 10) : null;
    const tags = [...node.querySelectorAll("tags > tag")].map((n) => n.textContent.trim());
    const highlights = [...node.querySelectorAll("highlights > item")].map((n) => n.textContent.trim());
    const tips = [...node.querySelectorAll("tips > item")].map((n) => n.textContent.trim());
    const heroNode = node.querySelector("images > hero");
    const hero = heroNode ? heroNode.textContent.trim() : "";
    const credit = heroNode ? (heroNode.getAttribute("credit") || "").trim() : "";
    const map = text(node.querySelector("links > map"));
    const source = text(node.querySelector("links > source")) || "Wikimedia Commons";

    return {
      id: node.getAttribute("id") || "",
      name: text(node.querySelector("name")),
      prefecture: text(node.querySelector("prefecture")),
      region: text(node.querySelector("region")),
      establishedYear: Number.isFinite(year) ? year : null,
      era: text(node.querySelector("era")),
      summary: text(node.querySelector("summary")),
      story: text(node.querySelector("story")),
      highlights,
      tips,
      access: text(node.querySelector("access")),
      bestTime: text(node.querySelector("bestTime")),
      tags,
      hero,
      credit,
      map,
      source,
    };
  });

  return { meta, spots };
}

function text(node) {
  return node ? node.textContent.trim() : "";
}

/* =======================
   Theme & Utilities
   ======================= */

function setTheme(mode) {
  const root = document.documentElement;
  const body = document.body;
  if (mode === "light") {
    root.setAttribute("data-theme", "light");
    body && body.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
    document.getElementById("btnTheme")?.setAttribute("aria-pressed", "true");
  } else {
    root.removeAttribute("data-theme");
    body && body.removeAttribute("data-theme");
    localStorage.setItem("theme", "dark");
    document.getElementById("btnTheme")?.setAttribute("aria-pressed", "false");
  }
}

function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  setTheme(saved === "light" ? "light" : "dark");
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  setTheme(isLight ? "dark" : "light");
}

/* Helpers */
function el(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof textContent === "string") node.textContent = textContent;
  return node;
}
function spanText(t) { return el("span", "", t); }
function metaDot() { return el("span", "meta-dot", ""); }
function badge(text, ok) {
  const b = el("span", "badge" + (ok ? " badge--ok" : ""), text);
  return b;
}
function button(className, text) { return el("button", className, text); }
function linkButton(href, text) {
  const a = el("a", "linkbtn", text);
  a.href = href || "#";
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  if (!href) {
    a.addEventListener("click", (e) => e.preventDefault());
    a.style.opacity = "0.6";
  }
  return a;
}
function makeMiniButton(text, onClick) {
  const b = button("btn btn--mini", text);
  b.addEventListener("click", onClick);
  return b;
}
function withWidth(url, w) {
  if (!url) return "";
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set("width", String(w));
    return u.toString();
  } catch { return url; }
}

/* Pretty XML */
function prettyXml(xml) {
  const PADDING = "  ";
  const reg = /(>)(<)(\/*)/g;
  let formatted = "";
  let pad = 0;
  xml = xml.replace(/\r\n/g, "\n").replace(reg, "$1\n$2$3");
  xml.split("\n").forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) indent = 0;
    else if (node.match(/^<\/\w/)) { if (pad !== 0) pad -= 1; }
    else if (node.match(/^<\w([^>]*[^/])?>.*$/)) indent = 1;
    formatted += PADDING.repeat(pad) + node.trim() + "\n";
    pad += indent;
  });
  return formatted.trim();
}

function scrollToXmlId(id) {
  if (!els.xmlPretty) return;
  const txt = els.xmlPretty.textContent || "";
  const idx = txt.indexOf(`spot id="${id}"`);
  if (idx < 0) return;
  const before = txt.slice(0, idx);
  const line = before.split("\n").length;
  const approxTop = Math.max(0, line - 6) * 18;
  els.xmlPretty.scrollTop = approxTop;
  els.xmlPretty.focus();
}

/* Fallback Image */
function makeFallbackDataUrl(title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.35"/><stop offset="0.55" stop-color="#f472b6" stop-opacity="0.25"/><stop offset="1" stop-color="#34d399" stop-opacity="0.18"/></linearGradient></defs><rect width="1200" height="750" fill="url(#g)"/><rect x="55" y="55" width="1090" height="640" rx="28" fill="rgba(0,0,0,0.24)" stroke="rgba(255,255,255,0.22)"/><text x="600" y="370" text-anchor="middle" font-size="44" font-family="system-ui" fill="rgba(255,255,255,0.92)" font-weight="700">${escapeXml(title)}</text><text x="600" y="430" text-anchor="middle" font-size="20" font-family="system-ui" fill="rgba(255,255,255,0.75)">圖片載入失敗</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;",
  }[c]));
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); flashMeta("已複製 ✅"); }
  catch {
    const ta = document.createElement("textarea"); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    flashMeta("已複製 ✅");
  }
}
function flashMeta(msg) {
  if (!els.resultMeta) return;
  const old = els.resultMeta.textContent;
  els.resultMeta.textContent = msg;
  setTimeout(() => { if (els.resultMeta) els.resultMeta.textContent = old || ""; }, 1200);
}
function makeSpotText(s) {
  return [s.name, `地點：${s.prefecture}`, `亮點：${(s.highlights || []).join("；")}`].join("\n");
}