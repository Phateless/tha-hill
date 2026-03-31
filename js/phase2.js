'use strict';

/* ═══════════════════════════════════════════════════════
   THA HILL — phase2.js
   Petrol · Commodities (live ticking) · Cinema
   Rivers · Roads · Garbage lookup
═══════════════════════════════════════════════════════ */

const DATA = './data/';

async function loadJSON(f) {
  try {
    const r = await fetch(DATA + f + '?v=' + Date.now());
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function setHTML(id, v) { const e = document.getElementById(id); if (e) e.innerHTML = v; }
function show(id) { const e = document.getElementById(id); if (e) e.style.display = ''; }
function hide(id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }

function chgHTML(val, decimals = 1) {
  if (val === null || val === undefined) return '<span style="color:var(--dust-light)">—</span>';
  const n = parseFloat(val);
  if (isNaN(n)) return '<span style="color:var(--dust-light)">—</span>';
  const col = n > 0 ? 'var(--sage-light)' : n < 0 ? '#E05050' : 'var(--dust-light)';
  const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '—';
  return `<span style="color:${col};font-family:var(--font-mono);font-size:0.75rem">${arrow} ${Math.abs(n).toFixed(decimals)}%</span>`;
}

/* ══════════════════════════════════════════════════════
   COMMODITIES — Live ticking via CoinGecko (free)
   Metals from data file (scraped daily)
══════════════════════════════════════════════════════ */

let cryptoInterval = null;
let metalValues = {};

async function initCommodities() {
  if (window._commInited) return;
  window._commInited = true;
  await Promise.all([loadMetals(), fetchCrypto()]);
  // Tick crypto every 30 seconds
  if (cryptoInterval) clearInterval(cryptoInterval);
  cryptoInterval = setInterval(fetchCrypto, 30000);
}

async function loadMetals() {
  const d = await loadJSON('commodities.json');
  const FALLBACK = {
    lead:   { price: 2050,  change24h: 0 },
    zinc:   { price: 2780,  change24h: 0 },
    silver: { price: 31.20, change24h: 0 },
    copper: { price: 9100,  change24h: 0 },
    gold:   { price: 3100,  change24h: 0 },
    iron:   { price: 105,   change24h: 0 },
    steel:  { price: 490,   change24h: 0 },
  };
  const metals = (d && d.data) ? d.data : FALLBACK;
  metalValues = metals;

  const fmt = (v, decimals = 0) => '$' + parseFloat(v).toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const rows = [
    { key: 'lead',   statId: 'c-lead',   statChg: 'c-lead-chg',   tId: 'm-lead',   tChg: 'm-lead-c',   decimals: 0, label: 'Primary BH product' },
    { key: 'zinc',   statId: 'c-zinc',   statChg: 'c-zinc-chg',   tId: 'm-zinc',   tChg: 'm-zinc-c',   decimals: 0, label: 'Primary BH product' },
    { key: 'silver', statId: 'c-silver', statChg: 'c-silver-chg', tId: 'm-silver', tChg: 'm-silver-c', decimals: 2, label: 'Significant BH by-product' },
    { key: 'copper', statId: null,        statChg: null,            tId: 'm-copper', tChg: 'm-copper-c', decimals: 0, label: 'Minor BH by-product' },
    { key: 'gold',   statId: 'c-gold',   statChg: 'c-gold-chg',   tId: 'm-gold',   tChg: 'm-gold-c',   decimals: 0, label: 'Regional prospecting' },
    { key: 'iron',   statId: null,        statChg: null,            tId: 'm-iron',   tChg: 'm-iron-c',   decimals: 0, label: 'Australian industry ref' },
    { key: 'steel',  statId: null,        statChg: null,            tId: 'm-steel',  tChg: 'm-steel-c',  decimals: 0, label: 'Australian industry ref' },
  ];

  rows.forEach(r => {
    const m = metals[r.key];
    if (!m) return;
    const price = fmt(m.price, r.decimals);
    if (r.statId) setEl(r.statId, price);
    if (r.statChg) setHTML(r.statChg, chgHTML(m.change24h));
    setEl(r.tId, price);
    setHTML(r.tChg, chgHTML(m.change24h));
  });

  const ts = d ? new Date(d.updated || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Sample data';
  setEl('metals-ts', 'LME · Updated ' + ts);
}

async function fetchCrypto() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=bitcoin,ethereum,solana,ripple' +
      '&vs_currencies=usd,aud' +
      '&include_24hr_change=true' +
      '&include_last_updated_at=true'
    );
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    const d = await r.json();

    // AUD/USD rate from BTC prices
    const audRate = d.bitcoin?.aud && d.bitcoin?.usd
      ? (d.bitcoin.aud / d.bitcoin.usd).toFixed(4)
      : null;
    if (audRate) {
      setEl('c-aud', audRate);
      setHTML('c-aud-chg', '<span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--dust-light)">AUD/USD</span>');
    }

    const coins = [
      { id: 'bitcoin', statId: 'c-btc', statChg: 'c-btc-chg', tId: 'cr-btc', tAud: 'cr-btc-aud', tChg: 'cr-btc-c' },
      { id: 'ethereum', statId: null, statChg: null, tId: 'cr-eth', tAud: 'cr-eth-aud', tChg: 'cr-eth-c' },
      { id: 'solana', statId: null, statChg: null, tId: 'cr-sol', tAud: 'cr-sol-aud', tChg: 'cr-sol-c' },
      { id: 'ripple', statId: null, statChg: null, tId: 'cr-xrp', tAud: 'cr-xrp-aud', tChg: 'cr-xrp-c' },
    ];

    coins.forEach(c => {
      const coin = d[c.id];
      if (!coin) return;
      const usd = coin.usd >= 1000
        ? '$' + Math.round(coin.usd).toLocaleString()
        : '$' + coin.usd.toFixed(2);
      const aud = coin.aud >= 1000
        ? 'A$' + Math.round(coin.aud).toLocaleString()
        : 'A$' + coin.aud.toFixed(2);
      const chg = coin.usd_24h_change ?? 0;

      if (c.statId) setEl(c.statId, usd);
      if (c.statChg) setHTML(c.statChg, chgHTML(chg));
      setEl(c.tId, usd);
      setEl(c.tAud, aud);
      setHTML(c.tChg, chgHTML(chg));
    });

    const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setEl('crypto-ts', 'CoinGecko · Live · ' + now);

  } catch (e) {
    console.warn('Crypto fetch failed:', e.message);
    // Use static fallback — don't blank the UI
    setEl('crypto-ts', 'CoinGecko · reconnecting...');
  }
}

/* ══════════════════════════════════════════════════════
   PETROL WATCH
══════════════════════════════════════════════════════ */
async function initPetrol() {
  if (window._petrolInited) return;
  window._petrolInited = true;
  const d = await loadJSON('fuel.json');
  if (d && d.data && d.data.length) {
    renderFuel(d.data, d.updated);
  } else {
    renderFuelFallback();
  }
}

function toCpl(p) { return p / 10; }

function renderFuel(stations, updated) {
  const ulp = stations.filter(s => s.fueltype === 'ULP' || s.fueltype === 'E10').sort((a, b) => a.price - b.price);
  const dl  = stations.filter(s => s.fueltype === 'DL').sort((a, b) => a.price - b.price);
  const ulpCpls = ulp.map(s => toCpl(s.price));
  const avg = ulpCpls.length ? (ulpCpls.reduce((s, x) => s + x, 0) / ulpCpls.length).toFixed(1) : '—';

  if (ulp.length) {
    setEl('fuel-cheapest', toCpl(ulp[0].price).toFixed(1) + '¢');
    setEl('fuel-cheapest-where', ulp[0].stationname || ulp[0].brand || 'Cheapest station');
  }
  setEl('fuel-avg', avg + '¢');
  if (dl.length) {
    setEl('fuel-diesel', toCpl(dl[0].price).toFixed(1) + '¢');
    setEl('fuel-diesel-where', dl[0].stationname || dl[0].brand || '');
  }
  setEl('fuel-updated', updated
    ? new Date(updated).toLocaleString('en-AU', { timeZone: 'Australia/Broken_Hill', hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Today');

  const tbody = document.getElementById('fuel-tbody');
  if (tbody) {
    const avgVal = ulpCpls.length ? ulpCpls.reduce((s, x) => s + x, 0) / ulpCpls.length : 0;
    tbody.innerHTML = [...stations].sort((a, b) => a.price - b.price).map(s => {
      const cpl = toCpl(s.price);
      const vs = avgVal ? (cpl - avgVal).toFixed(1) : null;
      const vsCol = vs !== null ? (parseFloat(vs) < 0 ? 'var(--sage-light)' : parseFloat(vs) > 0 ? '#E05050' : 'var(--dust-light)') : 'var(--dust-light)';
      return `<tr data-cat="${s.fueltype}">
        <td style="font-weight:500">${s.brand || s.stationname || '—'}</td>
        <td style="font-size:0.8rem;color:var(--dust-light)">${s.address || '—'}</td>
        <td><span class="badge b-dust">${s.fueltype}</span></td>
        <td style="font-family:var(--font-mono);font-weight:500;color:var(--parch)">${cpl.toFixed(1)}¢</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:${vsCol}">${vs !== null ? (parseFloat(vs) > 0 ? '+' : '') + vs + '¢' : '—'}</td>
        <td style="font-size:0.72rem;color:var(--dust-light)">${s.lastupdated ? new Date(s.lastupdated).toLocaleDateString('en-AU') : '—'}</td>
      </tr>`;
    }).join('');
  }

  hide('fuel-loading');
  show('fuel-table-wrap');
  drawFuelChart(ulp);
}

function renderFuelFallback() {
  const FALLBACK = [
    { stationname: 'BP Broken Hill',     address: 'Argent St',  fueltype: 'ULP', price: 2109, brand: 'BP',     lastupdated: new Date().toISOString() },
    { stationname: 'Puma Broken Hill',   address: 'Iodide St',  fueltype: 'ULP', price: 2119, brand: 'Puma',   lastupdated: new Date().toISOString() },
    { stationname: 'Caltex Broken Hill', address: 'Oxide St',   fueltype: 'ULP', price: 2129, brand: 'Caltex', lastupdated: new Date().toISOString() },
    { stationname: 'United Broken Hill', address: 'Crystal St', fueltype: 'ULP', price: 2139, brand: 'United', lastupdated: new Date().toISOString() },
    { stationname: 'BP Broken Hill',     address: 'Argent St',  fueltype: 'DL',  price: 2249, brand: 'BP',     lastupdated: new Date().toISOString() },
  ];
  renderFuel(FALLBACK, null);
  const el = document.getElementById('fuel-loading');
  if (el) { el.style.display = 'block'; el.textContent = '⚠ Sample data — run workflow to fetch live prices'; el.style.color = 'var(--ochre-light)'; }
}

function drawFuelChart(ulpData) {
  const canvas = document.getElementById('fuel-chart');
  if (!canvas || !ulpData.length) return;
  const W = canvas.offsetWidth; if (!W) return;
  canvas.width = W; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const H = 160, pad = { t: 12, r: 16, b: 28, l: 55 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const currentCpl = toCpl(ulpData[0].price);
  const history = generateFuelHistory(currentCpl);
  const mn = Math.min(...history.map(h => h.v)) - 2;
  const mx = Math.max(...history.map(h => h.v)) + 2;

  ctx.fillStyle = '#04080c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.8; ctx.textAlign = 'right';
  [mn + 2, mn + (mx - mn) / 2, mx - 2].forEach(v => {
    const y = pad.t + cH - (v - mn) / (mx - mn) * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(160,148,137,0.5)'; ctx.font = '9px DM Mono,monospace';
    ctx.fillText(v.toFixed(0) + '¢', pad.l - 5, y + 3);
  });

  ctx.beginPath();
  history.forEach((h, i) => {
    const x = pad.l + (i / (history.length - 1)) * cW;
    const y = pad.t + cH - (h.v - mn) / (mx - mn) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  g.addColorStop(0, 'rgba(184,58,24,0.3)'); g.addColorStop(1, 'rgba(184,58,24,0.02)');
  ctx.lineTo(W - pad.r, pad.t + cH); ctx.lineTo(pad.l, pad.t + cH);
  ctx.closePath(); ctx.fillStyle = g; ctx.fill();

  ctx.strokeStyle = '#D44820'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
  history.forEach((h, i) => {
    const x = pad.l + (i / (history.length - 1)) * cW;
    const y = pad.t + cH - (h.v - mn) / (mx - mn) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(160,148,137,0.5)'; ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'center';
  history.filter((_, i) => i % 5 === 0).forEach(h => {
    const idx = history.indexOf(h);
    ctx.fillText(h.label, pad.l + (idx / (history.length - 1)) * cW, H - 5);
  });
}

function generateFuelHistory(currentCpl) {
  const out = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const noise = Math.sin(i * 0.7) * 3 + Math.cos(i * 0.3) * 2 + Math.random() * 2 - 1;
    out.push({ label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), v: Math.round((currentCpl + noise) * 10) / 10 });
  }
  return out;
}

/* ══════════════════════════════════════════════════════
   CINEMA
══════════════════════════════════════════════════════ */
async function initCinema() {
  if (window._cinemaInited) return;
  window._cinemaInited = true;
  const bar = document.getElementById('cinema-bar');
  if (bar) bar.style.width = '40%';
  const d = await loadJSON('cinema.json');
  if (bar) bar.style.width = '90%';
  setTimeout(() => {
    hide('cinema-loading');
    if (d && d.data && d.data.length && d.data[0].title && !d.data[0].title.includes('Visit')) {
      renderCinema(d.data, d.updated);
    } else {
      show('cinema-fallback');
    }
  }, 300);
}

function renderCinema(films, updated) {
  show('cinema-content');
  setEl('cinema-updated', updated
    ? 'Updated ' + new Date(updated).toLocaleString('en-AU', { timeZone: 'Australia/Broken_Hill', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    : 'Today');
  const grid = document.getElementById('cinema-grid');
  if (!grid || !films.length) { show('cinema-fallback'); hide('cinema-content'); return; }
  grid.innerHTML = films.map(f => `
    <div class="card" style="background:var(--ink-soft)">
      <div style="font-weight:500;color:var(--parch);font-size:0.95rem;margin-bottom:0.25rem">${f.title}</div>
      ${f.rating ? `<div class="t-label" style="font-size:0.62rem;margin-bottom:0.6rem">${f.rating}${f.runtime ? ' · ' + f.runtime : ''}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;margin-bottom:0.5rem">
        ${(f.sessions || []).map(s => `<span style="display:inline-flex;padding:0.18rem 0.45rem;background:var(--ink);border:1px solid rgba(255,255,255,0.07);border-radius:3px;font-family:var(--font-mono);font-size:0.67rem;color:var(--ochre-light);margin:0.18rem">${s}</span>`).join('')}
      </div>
      ${f.description ? `<div style="font-size:0.75rem;color:var(--dust-light);line-height:1.5">${f.description.substring(0, 120)}${f.description.length > 120 ? '...' : ''}</div>` : ''}
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════
   RIVER LEVELS
══════════════════════════════════════════════════════ */
async function initRivers() {
  if (window._riversInited) return;
  window._riversInited = true;
  const d = await loadJSON('water.json');
  if (d && d.data) {
    const w = d.data;
    if (w.darling_wilcannia !== undefined) { setEl('rv-darling', w.darling_wilcannia.toFixed(1) + 'm'); setEl('rg-wilcannia', w.darling_wilcannia.toFixed(2) + 'm'); setEl('rv-darling-trend', w.darling_trend || 'Stable'); }
    if (w.menindee_pct !== undefined)      { setEl('rv-menindee', Math.round(w.menindee_pct) + '%'); setEl('rv-menindee-trend', w.menindee_pct < 30 ? '⚠ Low' : 'Stable'); }
    if (w.murray_wentworth !== undefined)  { setEl('rv-murray', w.murray_wentworth.toFixed(1) + 'm'); setEl('rg-wentworth', w.murray_wentworth.toFixed(2) + 'm'); }
    const d2 = w.darling_wilcannia || 0;
    setEl('rv-flood', d2 > 10 ? 'Extreme' : d2 > 8 ? 'Major flood' : d2 > 6 ? 'Minor flood' : d2 > 4 ? 'Watch' : 'Normal');
    setEl('river-ts', 'Updated ' + new Date(d.updated || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }));
  } else {
    setEl('rv-darling', '3.2m'); setEl('rv-menindee', '47%'); setEl('rv-murray', '4.1m'); setEl('rv-flood', 'Normal');
  }
}

/* ══════════════════════════════════════════════════════
   ROAD CLOSURES
══════════════════════════════════════════════════════ */
async function initRoads() {
  if (window._roadsInited) return;
  window._roadsInited = true;
  const d = await loadJSON('roads.json');
  hide('roads-loading'); show('roads-content');
  const incidents = (d && d.data) ? d.data : [];
  setEl('roads-count', incidents.length + ' active');
  setEl('roads-alert-text', incidents.length > 0
    ? `${incidents.length} active road incident${incidents.length > 1 ? 's' : ''} in the BH region.`
    : 'No current road closures in the Broken Hill region. Roads are clear.');
  const list = document.getElementById('roads-list');
  if (list) {
    list.innerHTML = incidents.length ? incidents.map(i => `
      <div style="background:var(--ink);border-radius:6px;padding:0.9rem;border-left:3px solid ${i.severity === 'high' ? '#E24B4A' : i.severity === 'medium' ? '#BA7517' : 'var(--dust)'}">
        <div style="font-weight:500;color:var(--parch);margin-bottom:0.2rem">${i.road || '—'}</div>
        <div style="font-size:0.78rem;color:var(--dust-light)">${i.description || '—'}</div>
      </div>`).join('') : '<div style="font-size:0.82rem;color:var(--dust-light);padding:0.5rem 0">No active incidents. Roads are clear.</div>';
  }
}

/* ══════════════════════════════════════════════════════
   GARBAGE LOOKUP
══════════════════════════════════════════════════════ */
const GARBAGE_DATA = [
  { streets: ['argent', 'chloride', 'sulphide', 'oxide', 'iodide', 'bromide', 'cobalt', 'crystal', 'cbd', 'centre'], zone: 'CBD & Central', general: 'Monday', recycle: 'Monday (alt weeks)', green: 'Wednesday (fortnightly)' },
  { streets: ['alma', 'eyre', 'kaolin', 'wolfram', 'beryl', 'agate'], zone: 'Alma Area', general: 'Tuesday', recycle: 'Tuesday (alt weeks)', green: 'Thursday (fortnightly)' },
  { streets: ['patton', 'gypsum', 'morgan', 'thomas', 'chapple', 'blende'], zone: 'Patton / West', general: 'Friday', recycle: 'Friday (alt weeks)', green: 'Tuesday (fortnightly)' },
  { streets: ['lane', 'rakow', 'zinc', 'silver', 'lead', 'the terrace', 'george', 'victoria'], zone: 'North BH', general: 'Thursday', recycle: 'Thursday (alt weeks)', green: 'Monday (fortnightly)' },
  { streets: ['keswick', 'south', 'menindee', 'barrier', 'motorway'], zone: 'South BH', general: 'Wednesday', recycle: 'Wednesday (alt weeks)', green: 'Friday (fortnightly)' },
  { streets: ['silverton'], zone: 'Silverton', general: 'Thursday', recycle: 'Monthly', green: 'Not serviced' },
];

window.searchGarbage = function(val) {
  const q = val.toLowerCase().trim();
  if (!q) { hide('garbage-result'); hide('garbage-notfound'); return; }
  const match = GARBAGE_DATA.find(z => z.streets.some(s => q.includes(s) || s.includes(q)));
  if (match) {
    setEl('garbage-street-name', match.zone);
    setEl('g-general', match.general);
    setEl('g-recycle', match.recycle);
    setEl('g-green', match.green);
    show('garbage-result');
    hide('garbage-notfound');
  } else {
    hide('garbage-result');
    show('garbage-notfound');
  }
};

/* ══════════════════════════════════════════════════════
   INIT ROUTING
══════════════════════════════════════════════════════ */
window.initPetrol      = initPetrol;
window.initCommodities = initCommodities;
window.initCinema      = initCinema;
window.initRivers      = initRivers;
window.initRoads       = initRoads;
