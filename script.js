const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const ledgerTabs = Array.from(document.querySelectorAll(".ledger-tab"));
if (ledgerTabs.length) {
  const ledgerPanels = Array.from(document.querySelectorAll(".ledger-panel"));
  ledgerTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.ledgerTab;
      ledgerTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      ledgerPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.ledgerPanel === target);
      });
    });
  });
}

const caseStudySearch = document.getElementById("caseStudySearch");
const sectorFilter = document.getElementById("sectorFilter");
const sectorFilterBtn = document.getElementById("sectorFilterBtn");
const sectorFilterLabel = document.getElementById("sectorFilterLabel");
const sectorOptions = Array.from(document.querySelectorAll(".sector-option"));
const caseItems = Array.from(document.querySelectorAll(".case-study-item"));

if (caseStudySearch && sectorFilter && caseItems.length) {
  let sectorValue = sectorFilter.dataset.value || "all";

  const filterCases = () => {
    const q = caseStudySearch.value.trim().toLowerCase();
    const sector = sectorValue;

    caseItems.forEach((item) => {
      const itemSector = item.dataset.sector || "";
      const haystack = ((item.dataset.search || "") + " " + item.textContent).toLowerCase();
      const sectorPass = sector === "all" || itemSector === sector;
      const textPass = !q || haystack.includes(q);
      item.style.display = sectorPass && textPass ? "flex" : "none";
    });
  };

  if (sectorFilterBtn && sectorOptions.length && sectorFilterLabel) {
    sectorFilterBtn.addEventListener("click", () => {
      const expanded = sectorFilter.classList.toggle("open");
      sectorFilterBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });

    sectorOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        sectorValue = opt.dataset.value || "all";
        sectorFilter.dataset.value = sectorValue;
        sectorFilterLabel.textContent = opt.textContent || "All Sectors";
        sectorOptions.forEach((o) => {
          const active = o === opt;
          o.classList.toggle("active", active);
          o.setAttribute("aria-selected", active ? "true" : "false");
        });
        sectorFilter.classList.remove("open");
        sectorFilterBtn.setAttribute("aria-expanded", "false");
        filterCases();
      });
    });

    document.addEventListener("click", (e) => {
      if (!sectorFilter.contains(e.target)) {
        sectorFilter.classList.remove("open");
        sectorFilterBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  caseStudySearch.addEventListener("input", filterCases);
  filterCases();
}

const chartCanvas = document.getElementById("portfolioChart");
if (chartCanvas) {
  const WEB_DATA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOM_8q53x61Mu-boSaObNiYSF1orAF1uJC46W_yZf34gEl2CrG4Vj4dgFb_JJ_c-fe_fws8Joqte7E/pub?gid=748707544&single=true&output=csv";
  const PERF_HISTORY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOM_8q53x61Mu-boSaObNiYSF1orAF1uJC46W_yZf34gEl2CrG4Vj4dgFb_JJ_c-fe_fws8Joqte7E/pub?gid=1046705098&single=true&output=csv";
  const chartWrap = document.getElementById("trackerChartWrap");
  const crosshair = document.getElementById("chartCrosshair");
  const tooltip = document.getElementById("chartTooltip");
  const valueEl = document.getElementById("trackerValue");
  const updatedEl = document.getElementById("trackerUpdated");
  const holdingsPanel = document.querySelector('[data-ledger-panel="holdings"]');
  const rangeButtons = Array.from(document.querySelectorAll(".range-btn"));
  const ctx = chartCanvas.getContext("2d");

  const fallbackSeries = {
    d: [15420, 15445, 15438, 15460, 15495, 15520, 15540, 15530, 15544, 15568, 15590, 15610, 15600, 15585, 15630, 15655, 15620, 15642, 15688, 15705, 15698, 15720, 15735, 15760],
    w: [14920, 14970, 15010, 15020, 14995, 15040, 15110, 15140, 15190, 15210, 15170, 15240, 15280, 15320, 15305, 15360, 15420, 15470, 15445, 15490, 15535, 15510, 15580, 15620, 15605, 15650, 15692, 15715],
    m: [14150, 14210, 14190, 14270, 14310, 14295, 14385, 14430, 14510, 14545, 14605, 14570, 14660, 14720, 14795, 14820, 14905, 14960, 15040, 15100, 15155, 15215, 15290, 15310, 15405, 15470, 15520, 15590, 15640, 15710],
    y: [11200, 11320, 11410, 11590, 11700, 11840, 11920, 12040, 12230, 12310, 12480, 12620, 12710, 12880, 13020, 13100, 13340, 13420, 13610, 13700, 13880, 13950, 14120, 14260, 14390, 14510, 14630, 14790, 14920, 15040, 15170, 15295, 15410, 15520, 15630, 15780]
  };
  let series = { ...fallbackSeries };

  let currentRange = "d";
  let activeData = series[currentRange];
  let dragging = false;
  let chartPoints = [];
  const HOLDINGS_CACHE_KEY = "ae_holdings_cache_v1";
  const HOLDINGS_ORDER_CACHE_KEY = "ae_holdings_order_v1";
  const lastGoodHoldings = new Map();
  let lastHoldingsOrder = [];

  const loadHoldingsCache = () => {
    try {
      const rawMap = localStorage.getItem(HOLDINGS_CACHE_KEY);
      const rawOrder = localStorage.getItem(HOLDINGS_ORDER_CACHE_KEY);
      if (!rawMap || !rawOrder) return;
      const parsedMap = JSON.parse(rawMap);
      const parsedOrder = JSON.parse(rawOrder);
      if (!Array.isArray(parsedMap) || !Array.isArray(parsedOrder)) return;
      parsedMap.forEach((entry) => {
        if (!entry || !entry.ticker) return;
        lastGoodHoldings.set(entry.ticker, entry);
      });
      lastHoldingsOrder = parsedOrder.filter((t) => lastGoodHoldings.has(t));
    } catch (err) {
      console.warn("Holdings cache load failed:", err);
    }
  };

  const saveHoldingsCache = () => {
    try {
      const list = Array.from(lastGoodHoldings.values());
      localStorage.setItem(HOLDINGS_CACHE_KEY, JSON.stringify(list));
      localStorage.setItem(HOLDINGS_ORDER_CACHE_KEY, JSON.stringify(lastHoldingsOrder));
    } catch (err) {
      console.warn("Holdings cache save failed:", err);
    }
  };

  const fmt = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = (n) => `${(n * 100).toFixed(2)}%`;

  const toNum = (raw) => {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim();
    if (!s) return NaN;
    const hasPercent = s.includes("%");
    const normalized = s.replaceAll(",", "").replaceAll("$", "").replaceAll("%", "");
    const n = Number(normalized);
    if (!Number.isFinite(n)) return NaN;
    return hasPercent ? n / 100 : n;
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && next === "\n") i += 1;
        row.push(value);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        value = "";
      } else {
        value += c;
      }
    }

    if (value.length || row.length) {
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    }

    return rows;
  };

  const parseWebData = (csvText) => {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return [];

    const rawHeaders = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const normalizeHeader = (h) => String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = rows[0].map(normalizeHeader);
    const findIdx = (candidates) => {
      for (const candidate of candidates) {
        const i = headers.indexOf(candidate);
        if (i !== -1) return i;
      }
      return -1;
    };
    const findRawIdx = (predicate) => rawHeaders.findIndex(predicate);
    const idx = {
      ticker: findIdx(["ticker"]),
      shares: findIdx(["shares"]),
      marketValue: findIdx(["marketvalue"]),
      pnlPct: findIdx(["pnlpct", "unrealizedpnl"]),
      price: findIdx(["price", "currentprice"]),
      pnlDollar: findIdx(["pnldollar", "unrealizedpnl"]),
      costBasis: findIdx(["costbasis"])
    };

    // Fallbacks for common WebData layouts:
    // A=ticker D=shares F=current price G=market value H=cost basis I=pnl$ J=pnl%
    if (idx.ticker === -1) idx.ticker = findRawIdx((h) => h.includes("ticker")) !== -1 ? findRawIdx((h) => h.includes("ticker")) : 0;
    if (idx.shares === -1) idx.shares = findRawIdx((h) => h.includes("shares")) !== -1 ? findRawIdx((h) => h.includes("shares")) : 3;
    if (idx.price === -1) idx.price = findRawIdx((h) => h.includes("current") && h.includes("price")) !== -1
      ? findRawIdx((h) => h.includes("current") && h.includes("price"))
      : 5;
    if (idx.marketValue === -1) idx.marketValue = findRawIdx((h) => h.includes("market") && h.includes("value")) !== -1
      ? findRawIdx((h) => h.includes("market") && h.includes("value"))
      : 6;
    if (idx.costBasis === -1) idx.costBasis = findRawIdx((h) => h.includes("cost") && h.includes("basis")) !== -1
      ? findRawIdx((h) => h.includes("cost") && h.includes("basis"))
      : 7;
    if (idx.pnlDollar === -1) idx.pnlDollar = findRawIdx((h) => h.includes("p&l") && (h.includes("$") || h.includes("dollar"))) !== -1
      ? findRawIdx((h) => h.includes("p&l") && (h.includes("$") || h.includes("dollar")))
      : 8;
    if (idx.pnlPct === -1 || idx.pnlPct === idx.pnlDollar) {
      const pctIdx = findRawIdx((h) => h.includes("p&l") && (h.includes("%") || h.includes("percent") || h.includes("pct")));
      idx.pnlPct = pctIdx !== -1 ? pctIdx : 9;
    }

    return rows.slice(1).map((r) => ({
      ticker: idx.ticker !== -1 ? (r[idx.ticker] || "").trim() : "",
      shares: idx.shares !== -1 ? toNum(r[idx.shares]) : NaN,
      marketValue: idx.marketValue !== -1 ? toNum(r[idx.marketValue]) : NaN,
      pnlPct: idx.pnlPct !== -1 ? toNum(r[idx.pnlPct]) : NaN,
      price: idx.price !== -1 ? toNum(r[idx.price]) : NaN,
      pnlDollar: idx.pnlDollar !== -1 ? toNum(r[idx.pnlDollar]) : NaN,
      costBasis: idx.costBasis !== -1 ? toNum(r[idx.costBasis]) : NaN
    })).map((r) => ({
      ticker: r.ticker,
      shares: r.shares,
      marketValue: Number.isFinite(r.marketValue)
        ? r.marketValue
        : (Number.isFinite(r.shares) && Number.isFinite(r.price) ? r.shares * r.price : NaN),
      pnlPct: Number.isFinite(r.pnlPct)
        ? r.pnlPct
        : (Number.isFinite(r.pnlDollar) && Number.isFinite(r.costBasis) && r.costBasis !== 0
            ? r.pnlDollar / r.costBasis
            : NaN)
    })).filter((r) => r.ticker);
  };

  const mergeWithLastGoodHoldings = (incomingHoldings) => {
    if (incomingHoldings.length) {
      const merged = incomingHoldings.map((h) => {
        const prev = lastGoodHoldings.get(h.ticker) || {};
        const next = {
          ticker: h.ticker,
          shares: Number.isFinite(h.shares) ? h.shares : prev.shares,
          marketValue: Number.isFinite(h.marketValue) ? h.marketValue : prev.marketValue,
          pnlPct: Number.isFinite(h.pnlPct) ? h.pnlPct : prev.pnlPct
        };
        lastGoodHoldings.set(h.ticker, next);
        return next;
      });
      lastHoldingsOrder = merged.map((h) => h.ticker);
      saveHoldingsCache();
      return merged;
    }

    if (lastHoldingsOrder.length) {
      return lastHoldingsOrder.map((ticker) => lastGoodHoldings.get(ticker)).filter(Boolean);
    }

    return [];
  };

  const parsePerfHistory = (csvText) => {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const idxTs = headers.indexOf("timestamp");
    const idxVal = headers.indexOf("portfoliovalue");
    if (idxTs === -1 || idxVal === -1) return [];

    return rows.slice(1).map((r) => {
      const ts = new Date(r[idxTs]);
      const value = toNum(r[idxVal]);
      return { ts, value };
    }).filter((p) => !Number.isNaN(p.ts.getTime()) && Number.isFinite(p.value))
      .sort((a, b) => a.ts - b.ts);
  };

  const pointsForWindow = (points, msWindow) => {
    if (!points.length) return [];
    const end = points[points.length - 1].ts.getTime();
    const start = end - msWindow;
    const filtered = points.filter((p) => p.ts.getTime() >= start).map((p) => p.value);
    if (filtered.length >= 2) return filtered;
    if (points.length >= 2) return points.slice(-Math.min(24, points.length)).map((p) => p.value);
    return [points[0].value, points[0].value];
  };

  const rebuildSeriesFromHistory = (points) => {
    if (!points.length) return;
    series = {
      d: pointsForWindow(points, 24 * 60 * 60 * 1000),
      w: pointsForWindow(points, 7 * 24 * 60 * 60 * 1000),
      m: pointsForWindow(points, 30 * 24 * 60 * 60 * 1000),
      y: pointsForWindow(points, 365 * 24 * 60 * 60 * 1000)
    };
    activeData = series[currentRange] || series.d;
  };

  const renderHoldings = (holdings) => {
    if (!holdingsPanel) return;
    holdingsPanel.querySelectorAll(".ledger-row").forEach((el) => el.remove());

    holdings.forEach((h) => {
      const row = document.createElement("div");
      row.className = "ledger-row";

      const ticker = document.createElement("span");
      ticker.className = "ticker";
      ticker.textContent = h.ticker;

      const shares = document.createElement("span");
      shares.className = "shares";
      shares.textContent = Number.isFinite(h.shares) ? h.shares.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "-";

      const value = document.createElement("span");
      const isPos = Number.isFinite(h.pnlPct) ? h.pnlPct >= 0 : true;
      value.className = `value ${isPos ? "positive" : "negative"}`;
      value.textContent = Number.isFinite(h.marketValue) ? fmt(h.marketValue) : "-";

      const change = document.createElement("span");
      change.className = `change ${isPos ? "positive" : "negative"}`;
      change.textContent = Number.isFinite(h.pnlPct) ? `${h.pnlPct >= 0 ? "+" : ""}${fmtPct(h.pnlPct)}` : "-";

      row.append(ticker, shares, value, change);
      holdingsPanel.appendChild(row);
    });
  };

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = chartWrap.clientWidth;
    const height = chartWrap.clientHeight;
    chartCanvas.width = Math.floor(width * dpr);
    chartCanvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  };

  const drawChart = () => {
    const w = chartWrap.clientWidth;
    const h = chartWrap.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 24, right: 24, bottom: 28, left: 24 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const min = Math.min(...activeData);
    const max = Math.max(...activeData);
    const span = Math.max(max - min, 1);

    ctx.strokeStyle = "rgba(198, 226, 255, 0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = pad.top + (chartH * i) / 5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    chartPoints = activeData.map((v, i) => {
      const x = pad.left + (chartW * i) / (activeData.length - 1);
      const y = pad.top + ((max - v) / span) * chartH;
      return { x, y, v };
    });

    const areaGrad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    areaGrad.addColorStop(0, "rgba(149, 211, 255, 0.34)");
    areaGrad.addColorStop(1, "rgba(149, 211, 255, 0.03)");

    ctx.beginPath();
    ctx.moveTo(chartPoints[0].x, h - pad.bottom);
    chartPoints.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(chartPoints[chartPoints.length - 1].x, h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    ctx.beginPath();
    chartPoints.forEach((p, i) => {
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.strokeStyle = "rgba(203, 238, 255, 0.95)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  const setActivePoint = (clientX) => {
    const rect = chartWrap.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    let best = chartPoints[0];
    let dist = Math.abs(best.x - x);

    for (let i = 1; i < chartPoints.length; i += 1) {
      const d = Math.abs(chartPoints[i].x - x);
      if (d < dist) {
        dist = d;
        best = chartPoints[i];
      }
    }

    crosshair.style.opacity = "1";
    crosshair.style.left = `${best.x}px`;
    tooltip.style.opacity = "1";
    tooltip.style.left = `${best.x}px`;
    tooltip.textContent = fmt(best.v);
    valueEl.textContent = fmt(best.v);
  };

  chartWrap.addEventListener("pointerdown", (e) => {
    dragging = true;
    setActivePoint(e.clientX);
  });

  chartWrap.addEventListener("pointermove", (e) => {
    if (dragging || e.pointerType === "mouse") {
      setActivePoint(e.clientX);
    }
  });

  const endPointer = () => {
    dragging = false;
    crosshair.style.opacity = "0";
    tooltip.style.opacity = "0";
    valueEl.textContent = fmt(activeData[activeData.length - 1]);
  };

  chartWrap.addEventListener("pointerup", endPointer);
  chartWrap.addEventListener("pointerleave", endPointer);

  rangeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentRange = btn.dataset.range;
      activeData = series[currentRange];
      rangeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      valueEl.textContent = fmt(activeData[activeData.length - 1]);
      drawChart();
    });
  });

  const refreshFromSheets = async () => {
    try {
      const bust = `t=${Date.now()}`;
      const webUrl = `${WEB_DATA_CSV_URL}&${bust}`;
      const perfUrl = `${PERF_HISTORY_CSV_URL}&${bust}`;
      const [webResp, perfResp] = await Promise.all([
        fetch(webUrl, { cache: "no-store" }),
        fetch(perfUrl, { cache: "no-store" })
      ]);
      const [webCsv, perfCsv] = await Promise.all([webResp.text(), perfResp.text()]);
      const holdings = mergeWithLastGoodHoldings(parseWebData(webCsv));
      const history = parsePerfHistory(perfCsv);

      if (holdings.length) {
        renderHoldings(holdings);
        const total = holdings.reduce((sum, h) => sum + (Number.isFinite(h.marketValue) ? h.marketValue : 0), 0);
        if (total > 0) valueEl.textContent = fmt(total);
      }

      if (history.length) {
        rebuildSeriesFromHistory(history);
        if (activeData.length) valueEl.textContent = fmt(activeData[activeData.length - 1]);
        drawChart();
      }

      if (updatedEl) {
        updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
      }
    } catch (err) {
      if (updatedEl) {
        updatedEl.textContent = `Last updated: failed at ${new Date().toLocaleTimeString()}`;
      }
      console.error("Portfolio data refresh failed:", err);
    }
  };

  window.addEventListener("resize", resizeCanvas);
  loadHoldingsCache();
  const cachedHoldings = mergeWithLastGoodHoldings([]);
  if (cachedHoldings.length) {
    renderHoldings(cachedHoldings);
  }
  valueEl.textContent = fmt(activeData[activeData.length - 1]);
  resizeCanvas();
  refreshFromSheets();
  setInterval(refreshFromSheets, 60000);
}
