/* ═══════════════════════════════════════
   THA HILL — main.js
   Navigation · Charts · Maps · Filters
═══════════════════════════════════════ */

'use strict';

// ── SECTION TITLES ──────────────────────────────────────────
const SECTION_TITLES = {
  home:      ['Overview', 'Tha Hill Dashboard'],
  council:   ['Investigations', 'Council Finance Audit'],
  mining:    ['City & Region', 'Mining & Geology'],
  events:    ['Community', 'Events Calendar'],
  realestate:['City & Region', 'Real Estate'],
  weather:   ['City & Region', 'Weather & Climate'],
  crime:     ['Investigations', 'Crime & Courts'],
  buysell:   ['Community', 'Buy / Swap / Sell'],
  tourism:   ['Community', 'Tourism & History'],
  film:      ['Community', 'Film History'],
  radio:     ['Community', 'Local Radio'],
  oral:      ['Community', 'Oral History Archive'],
  bizob:     ['Community', 'Business Obituaries'],
  water:     ['City & Region', 'Water & Energy'],
  otd:       ['Community', 'On This Day'],
  dust:      ['City & Region', 'Dust & Air Quality'],
  adsb:      ['Aviation', 'ADS-B & Aviation'],
};

// ── NAVIGATION ───────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById('s-' + id);
  if (sec) sec.classList.add('active');

  const nav = document.querySelector(`[data-sec="${id}"]`);
  if (nav) nav.classList.add('active');

  const [crumb, title] = SECTION_TITLES[id] || ['', id];
  const el = document.getElementById('tb-section');
  const cr = document.getElementById('tb-crumb');
  if (el) el.textContent = title;
  if (cr) cr.textContent = crumb;

  // Draw charts on demand
  setTimeout(() => initCharts(id), 60);
}

// ── CLOCK ────────────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  const now = new Date();
  const t = now.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Broken_Hill',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const d = now.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Broken_Hill',
    weekday: 'short', day: 'numeric', month: 'short'
  });
  el.textContent = `${d} · ${t} ACST`;
}
setInterval(tickClock, 1000);
tickClock();

// ── CANVAS CHART HELPERS ─────────────────────────────────────
function setSize(canvas) {
  const w = canvas.offsetWidth;
  if (!w) return false;
  canvas.width = w;
  return true;
}

function drawGrid(ctx, pad, chartW, chartH, steps, maxVal, unit = '') {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 0.8;
  ctx.fillStyle = 'rgba(160,148,137,0.6)';
  ctx.font = '10px DM Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i++) {
    const y = pad.t + chartH - (i / steps) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + chartW, y); ctx.stroke();
    ctx.fillText(`${unit}${((i / steps) * maxVal).toFixed(0)}`, pad.l - 6, y + 3);
  }
}

function drawLine(ctx, data, years, pad, chartW, chartH, maxVal, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * chartW;
    const y = pad.t + chartH - (v / maxVal) * chartH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  // Dots
  data.forEach((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * chartW;
    const y = pad.t + chartH - (v / maxVal) * chartH;
    ctx.beginPath(); ctx.arc(x, y, width === 2 ? 2.5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  });
}

function fillUnder(ctx, data, pad, chartW, chartH, maxVal, colorTop, colorBot) {
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * chartW;
    const y = pad.t + chartH - (v / maxVal) * chartH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.l + chartW, pad.t + chartH);
  ctx.lineTo(pad.l, pad.t + chartH);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  g.addColorStop(0, colorTop); g.addColorStop(1, colorBot);
  ctx.fillStyle = g; ctx.fill();
}

function xLabels(ctx, labels, pad, chartW, H) {
  ctx.fillStyle = 'rgba(160,148,137,0.6)';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = pad.l + (i / (labels.length - 1)) * chartW;
    ctx.fillText(l, x, H - 5);
  });
}

// ── COUNCIL CHART ────────────────────────────────────────────
function drawCouncilChart() {
  const c = document.getElementById('council-chart');
  if (!c || !setSize(c)) return;
  const W = c.width, H = c.height = 280;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 16, r: 16, b: 36, l: 52 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const yrs = ['2014','2015','2016','2017','2018','2019','2020','2021','2022','2023'];
  const maxV = 10;

  const series = [
    { key: 'admin',    col: '#D44820', w: 2,   data: [4.2,4.5,4.8,5.1,5.8,6.2,5.9,6.8,7.2,7.9] },
    { key: 'roads',    col: '#5080B8', w: 1.5, data: [3.1,3.4,3.2,3.8,3.5,3.9,4.1,3.7,4.5,4.8] },
    { key: 'services', col: '#4A9A64', w: 1.5, data: [2.8,2.9,3.1,3.3,3.4,3.6,3.5,3.8,4.1,4.3] },
    { key: 'legal',    col: '#E05050', w: 2.5, data: [0.42,0.38,0.55,0.89,1.24,0.98,1.45,0.87,1.12,1.38] },
    { key: 'travel',   col: '#E08C24', w: 1.5, data: [0.18,0.22,0.31,0.28,0.45,0.51,0.12,0.38,0.62,0.71] },
  ];

  drawGrid(ctx, pad, cW, cH, 5, maxV, '$');
  xLabels(ctx, yrs, pad, cW, H);

  series.forEach(s => {
    fillUnder(ctx, s.data, pad, cW, cH, maxV, s.col + '18', s.col + '03');
    drawLine(ctx, s.data, yrs, pad, cW, cH, maxV, s.col, s.w);
  });

  // Anomaly marker on legal 2020 (index 6)
  const ax = pad.l + (6 / 9) * cW;
  const ay = pad.t + cH - (1.45 / maxV) * cH;
  ctx.strokeStyle = 'rgba(224,80,80,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(ax, ay - 8); ctx.lineTo(ax, ay - 36); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(160,32,32,0.18)';
  ctx.strokeStyle = 'rgba(224,80,80,0.45)';
  ctx.lineWidth = 1;
  const lbl = '⚠ +47%';
  ctx.font = '9px DM Mono, monospace';
  const lw = ctx.measureText(lbl).width;
  ctx.fillRect(ax - lw / 2 - 4, ay - 54, lw + 8, 16);
  ctx.strokeRect(ax - lw / 2 - 4, ay - 54, lw + 8, 16);
  ctx.fillStyle = '#E05050';
  ctx.textAlign = 'center';
  ctx.fillText(lbl, ax, ay - 43);
}

// ── DONUT CHART ──────────────────────────────────────────────
function drawDonut() {
  const c = document.getElementById('donut-chart');
  if (!c) return;
  const sz = 180; c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  const cx = sz / 2, cy = sz / 2, R = 72, ri = 46;

  const slices = [
    { val: 34, col: '#D44820' },
    { val: 21, col: '#5080B8' },
    { val: 18, col: '#4A9A64' },
    { val: 11, col: '#E05050' },
    { val: 7,  col: '#E08C24' },
    { val: 9,  col: '#5C5247' },
  ];

  let a = -Math.PI / 2;
  slices.forEach(s => {
    const sweep = (s.val / 100) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a, a + sweep);
    ctx.closePath(); ctx.fillStyle = s.col; ctx.fill();
    a += sweep;
  });

  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = '#1C1812'; ctx.fill();

  ctx.fillStyle = '#EAE0CC';
  ctx.font = 'bold 18px Bebas Neue, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('10 YRS', cx, cy - 6);
  ctx.fillStyle = '#7A6E63';
  ctx.font = '8px DM Mono, monospace';
  ctx.fillText('SPEND MIX', cx, cy + 10);
}

// ── PRICE CHART ──────────────────────────────────────────────
function drawPriceChart() {
  const c = document.getElementById('price-chart');
  if (!c || !setSize(c)) return;
  const W = c.width, H = c.height = 200;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 12, r: 12, b: 32, l: 55 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const yrs = ['2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'];
  const med = [165,172,178,185,192,205,235,268,285,298];
  const rnt = [210,218,225,235,245,255,270,295,318,340];
  const maxV = 380;

  drawGrid(ctx, pad, cW, cH, 4, maxV, '$');
  ctx.fillStyle = 'rgba(160,148,137,0.5)';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'right';
  [100,200,300].forEach(v => {
    const y = pad.t + cH - (v / maxV) * cH;
    ctx.fillText(`$${v}k`, pad.l - 6, y + 3);
  });

  xLabels(ctx, yrs, pad, cW, H);
  fillUnder(ctx, med, pad, cW, cH, maxV, 'rgba(212,72,32,0.22)', 'rgba(212,72,32,0.02)');
  drawLine(ctx, med, yrs, pad, cW, cH, maxV, '#D44820', 2);
  drawLine(ctx, rnt, yrs, pad, cW, cH, maxV, '#E08C24', 1.5, [6, 4]);

  // Legend inline
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#D44820';
  ctx.fillRect(pad.l + 8, pad.t + 6, 16, 2);
  ctx.fillText('Median sale', pad.l + 28, pad.t + 10);
  ctx.setLineDash([4,3]);
  ctx.strokeStyle = '#E08C24'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l + 100, pad.t + 8); ctx.lineTo(pad.l + 116, pad.t + 8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#E08C24';
  ctx.fillText('Wkly rent ×k', pad.l + 120, pad.t + 10);
}

// ── WEATHER CHART ────────────────────────────────────────────
function drawWeatherChart() {
  const c = document.getElementById('weather-chart');
  if (!c || !setSize(c)) return;
  const W = c.width, H = c.height = 180;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const pad = { t: 12, r: 10, b: 28, l: 38 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const hi = [32,32,29,24,18,14,13,15,19,24,28,31];
  const lo = [19,19,16,11,7,4,3,4,7,12,15,18];
  const rain = [22,25,31,18,21,22,18,19,21,24,21,22];
  const maxV = 45;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [10,20,30,40].forEach(v => {
    const y = pad.t + cH - (v / maxV) * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(160,148,137,0.55)';
    ctx.font = '9px DM Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${v}°`, pad.l - 4, y + 3);
  });

  // Temp band
  ctx.beginPath();
  hi.forEach((v, i) => {
    const x = pad.l + (i / (months.length - 1)) * cW;
    const y = pad.t + cH - (v / maxV) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  for (let i = months.length - 1; i >= 0; i--) {
    const x = pad.l + (i / (months.length - 1)) * cW;
    const y = pad.t + cH - (lo[i] / maxV) * cH;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  g.addColorStop(0, 'rgba(212,72,32,0.3)'); g.addColorStop(1, 'rgba(42,74,110,0.25)');
  ctx.fillStyle = g; ctx.fill();

  // Rainfall bars
  const bw = cW / months.length * 0.45;
  rain.forEach((v, i) => {
    const x = pad.l + (i / (months.length - 1)) * cW - bw / 2;
    const bh = (v / 40) * cH * 0.5;
    ctx.fillStyle = 'rgba(80,128,184,0.35)';
    ctx.fillRect(x, pad.t + cH - bh, bw, bh);
  });

  // Month labels
  ctx.fillStyle = 'rgba(160,148,137,0.65)';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  months.forEach((m, i) => {
    const x = pad.l + (i / (months.length - 1)) * cW;
    ctx.fillText(m, x, H - 5);
  });
}

// ── OVERVIEW SPARKLINE ───────────────────────────────────────
function drawSparkline() {
  const c = document.getElementById('sparkline');
  if (!c || !setSize(c)) return;
  const W = c.width, H = c.height = 100;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const data = [21.8,21.5,21.2,20.9,20.6,20.4,20.3,20.1,19.9,19.8,19.7,19.6];
  const pad = { t: 8, r: 8, b: 8, l: 8 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const mn = Math.min(...data), mx = Math.max(...data);

  fillUnder(ctx, data.map(v => v - mn), pad, cW, cH, mx - mn, 'rgba(212,72,32,0.25)', 'rgba(212,72,32,0.02)');
  drawLine(ctx, data.map(v => v - mn), null, pad, cW, cH, mx - mn, '#D44820', 2);
}

// ── AIR QUALITY MINI CHART ───────────────────────────────────
function drawAQIChart() {
  const c = document.getElementById('aqi-chart');
  if (!c || !setSize(c)) return;
  const W = c.width, H = c.height = 120;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const aqi  = [18, 22, 35, 28, 42, 67, 31]; // µg/m³ PM2.5
  const maxV = 80;
  const bw = (W - 40) / days.length * 0.65;
  const bStep = (W - 40) / days.length;

  days.forEach((d, i) => {
    const v = aqi[i];
    const bh = (v / maxV) * (H - 36);
    const x = 20 + i * bStep + bStep * 0.175;
    const y = H - 20 - bh;
    const col = v < 25 ? '#4A9A64' : v < 50 ? '#E08C24' : '#E05050';
    ctx.fillStyle = col + 'AA';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, bw, 2);

    ctx.fillStyle = 'rgba(160,148,137,0.6)';
    ctx.font = '8px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d, x + bw / 2, H - 6);
    ctx.fillStyle = v < 25 ? '#4A9A64' : v < 50 ? '#E08C24' : '#E05050';
    ctx.fillText(v, x + bw / 2, y - 3);
  });
}

// ── INIT CHARTS (call per-section) ───────────────────────────
const drawn = new Set();

function initCharts(sectionId) {
  if (sectionId === 'home')       { drawSparkline(); }
  if (sectionId === 'council')    { if (!drawn.has('council'))    { drawCouncilChart(); drawDonut(); drawn.add('council'); } }
  if (sectionId === 'realestate') { if (!drawn.has('re'))         { drawPriceChart();              drawn.add('re'); } }
  if (sectionId === 'weather')    { if (!drawn.has('weather'))    { drawWeatherChart();             drawn.add('weather'); } }
  if (sectionId === 'dust')       { if (!drawn.has('dust'))       { drawAQIChart();                 drawn.add('dust'); } }
  if (sectionId === 'adsb')       { if (window.initADSB) window.initADSB(); }
}

window.addEventListener('resize', () => {
  drawn.clear();
  const active = document.querySelector('.section.active');
  if (active) initCharts(active.id.replace('s-', ''));
});

// ── FILTER BUTTONS ───────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.fbtn');
  if (!btn) return;
  const bar = btn.closest('.filter-bar');
  if (!bar) return;
  bar.querySelectorAll('.fbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');

  const filter = btn.dataset.f;
  const scope = btn.dataset.scope;
  const container = scope
    ? document.querySelector(scope)
    : btn.closest('.section') || document;

  if (container) {
    container.querySelectorAll('[data-cat]').forEach(el => {
      el.style.display = (filter === 'all' || el.dataset.cat === filter) ? '' : 'none';
    });
  }
});

// ── MINE MAP INTERACTIVITY ───────────────────────────────────
function initMineMap() {
  const dots = document.querySelectorAll('.mine-dot');
  const tip  = document.getElementById('map-tip');
  const panel = document.getElementById('mine-panel');

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      if (!panel) return;
      const d = dot.dataset;
      const isActive = d.status === 'Active';
      const stateBadge = isActive
        ? '<span class="badge b-sage">● Active</span>'
        : d.status === 'Prospect'
          ? '<span class="badge b-ochre">Prospect</span>'
          : '<span class="badge b-dust">Historic</span>';

      panel.innerHTML = `
        <div style="margin-bottom:0.9rem">
          <div style="font-family:var(--font-display);font-size:1.15rem;color:var(--parch);margin-bottom:0.35rem;letter-spacing:0.04em">${d.name}</div>
          ${stateBadge}
        </div>
        <div style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.8rem">
          <div style="display:flex;justify-content:space-between;padding-bottom:0.4rem;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:var(--dust-light)">Minerals</span>
            <span style="font-family:var(--font-mono);color:var(--ochre-light)">${d.minerals}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-bottom:0.4rem;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:var(--dust-light)">Years</span>
            <span style="font-family:var(--font-mono);color:var(--parch)">${d.years}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-bottom:0.4rem;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="color:var(--dust-light)">Depth</span>
            <span style="font-family:var(--font-mono);color:var(--parch)">${d.depth}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--dust-light)">Operator</span>
            <span style="font-family:var(--font-mono);color:var(--parch)">${d.op}</span>
          </div>
        </div>
        <div style="margin-top:0.9rem;font-size:0.72rem;color:var(--dust);font-style:italic">
          Source: NSW DPIE MINVIEW · Geoscience Australia
        </div>
      `;
    });

    dot.addEventListener('mouseenter', () => {
      if (tip) { tip.textContent = dot.dataset.name; tip.style.display = 'block'; }
    });
    dot.addEventListener('mousemove', e => {
      if (!tip) return;
      const rect = e.target.closest('.mine-map-wrap').getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 14) + 'px';
      tip.style.top  = (e.clientY - rect.top  - 8)  + 'px';
    });
    dot.addEventListener('mouseleave', () => {
      if (tip) tip.style.display = 'none';
    });
  });
}

// ── WATER GAUGE ANIMATION ────────────────────────────────────
function initWaterGauges() {
  document.querySelectorAll('.water-fill[data-pct]').forEach(el => {
    const pct = parseFloat(el.dataset.pct);
    setTimeout(() => { el.style.height = pct + '%'; }, 200);
  });
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
  showSection('home');
  initMineMap();
  setTimeout(initWaterGauges, 400);
});
