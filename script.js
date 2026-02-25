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

const chartCanvas = document.getElementById("portfolioChart");
if (chartCanvas) {
  const chartWrap = document.getElementById("trackerChartWrap");
  const crosshair = document.getElementById("chartCrosshair");
  const tooltip = document.getElementById("chartTooltip");
  const valueEl = document.getElementById("trackerValue");
  const rangeButtons = Array.from(document.querySelectorAll(".range-btn"));
  const ctx = chartCanvas.getContext("2d");

  const series = {
    d: [15420, 15445, 15438, 15460, 15495, 15520, 15540, 15530, 15544, 15568, 15590, 15610, 15600, 15585, 15630, 15655, 15620, 15642, 15688, 15705, 15698, 15720, 15735, 15760],
    w: [14920, 14970, 15010, 15020, 14995, 15040, 15110, 15140, 15190, 15210, 15170, 15240, 15280, 15320, 15305, 15360, 15420, 15470, 15445, 15490, 15535, 15510, 15580, 15620, 15605, 15650, 15692, 15715],
    m: [14150, 14210, 14190, 14270, 14310, 14295, 14385, 14430, 14510, 14545, 14605, 14570, 14660, 14720, 14795, 14820, 14905, 14960, 15040, 15100, 15155, 15215, 15290, 15310, 15405, 15470, 15520, 15590, 15640, 15710],
    y: [11200, 11320, 11410, 11590, 11700, 11840, 11920, 12040, 12230, 12310, 12480, 12620, 12710, 12880, 13020, 13100, 13340, 13420, 13610, 13700, 13880, 13950, 14120, 14260, 14390, 14510, 14630, 14790, 14920, 15040, 15170, 15295, 15410, 15520, 15630, 15780]
  };

  let currentRange = "d";
  let activeData = series[currentRange];
  let dragging = false;
  let chartPoints = [];

  const fmt = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  window.addEventListener("resize", resizeCanvas);
  valueEl.textContent = fmt(activeData[activeData.length - 1]);
  resizeCanvas();
}
