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

/* ══════════════════════════════════════════════════════
   BUSINESS DIRECTORY
══════════════════════════════════════════════════════ */

const BUSINESSES = [
  // Food & Drink
  { name:'Palace Hotel', cat:'food', addr:'227 Argent St', phone:'08 8088 1699', hours:'Daily 10am–late', desc:'Historic pub with Pro Hart murals. Bistro lunch & dinner. Beer garden.', lat:-31.9571, lon:141.4671 },
  { name:'Broken Earth Café', cat:'food', addr:'Argent St', phone:'08 8087 5885', hours:'Mon–Sat 7am–3pm', desc:'Popular café for breakfast and lunch. Great coffee. BYO friendly.', lat:-31.9568, lon:141.4668 },
  { name:'Musicians Club', cat:'food', addr:'276 Crystal St', phone:'08 8087 3699', hours:'Daily lunch & dinner', desc:'Club dining, bistro meals, meat tray nights, live entertainment.', lat:-31.9555, lon:141.4650 },
  { name:'Demo Club (BSDC)', cat:'food', addr:'218 Argent St', phone:'08 8087 3877', hours:'Lunch Mon–Fri, Dinner daily', desc:'Barrier Social Democratic Club. Counter meals, cheap eats, members bar.', lat:-31.9572, lon:141.4660 },
  { name:'Barrier Club', cat:'food', addr:'218 Argent St', phone:'08 8087 2311', hours:'Daily 10am–late', desc:'Members club with bistro, bar, pokies. Regular raffles and meat trays.', lat:-31.9574, lon:141.4662 },
  { name:'Silverton Hotel', cat:'food', addr:'Silverton', phone:'08 8088 5313', hours:'Daily 10am–late', desc:'Famous outback pub in Silverton ghost town. Mad Max memorabilia. Camel racing.', lat:-31.8866, lon:141.2194 },
  // Trades & Services
  { name:'BH Plumbing & Gas', cat:'trades', addr:'Bromide St', phone:'08 8087 XXXX', hours:'Mon–Fri 7am–5pm', desc:'Licensed plumbers and gas fitters. Emergency callouts available.', lat:-31.9560, lon:141.4680 },
  { name:'Silver City Electrical', cat:'trades', addr:'Iodide St', phone:'08 8087 XXXX', hours:'Mon–Fri 7:30am–5pm', desc:'Residential and commercial electrical. Solar installations. Emergency service.', lat:-31.9562, lon:141.4690 },
  { name:'Broken Hill Tyres', cat:'trades', addr:'Oxide St', phone:'08 8087 2455', hours:'Mon–Fri 8am–5pm, Sat 8am–12pm', desc:'All tyre brands, wheel alignments, balancing. Truck and 4WD specialists.', lat:-31.9558, lon:141.4700 },
  { name:'BH Auto Repairs', cat:'trades', addr:'Crystal St', phone:'08 8087 3311', hours:'Mon–Fri 8am–5pm', desc:'Log book servicing, mechanical repairs, roadworthy inspections.', lat:-31.9550, lon:141.4695 },
  // Retail & Shopping
  { name:'Woolworths Broken Hill', cat:'retail', addr:'Argent St', phone:'08 8088 1200', hours:'Mon–Sun 7am–9pm', desc:'Full supermarket. Online ordering available.', lat:-31.9565, lon:141.4655 },
  { name:'Coles Broken Hill', cat:'retail', addr:'Sulphide St', phone:'08 8087 9600', hours:'Mon–Sun 7am–9pm', desc:'Supermarket. Click & Collect available.', lat:-31.9548, lon:141.4672 },
  { name:'Kmart Broken Hill', cat:'retail', addr:'Argent St', phone:'08 8087 4100', hours:'Mon–Wed 8am–6pm, Thu–Fri 8am–9pm, Sat 8am–6pm, Sun 10am–5pm', desc:'General merchandise, clothing, homewares, electronics.', lat:-31.9563, lon:141.4648 },
  { name:'Harvey Norman BH', cat:'retail', addr:'Chloride St', phone:'08 8087 7400', hours:'Mon–Fri 9am–5:30pm, Sat 9am–5pm, Sun 10am–4pm', desc:'Electronics, appliances, furniture, bedding. Interest free finance available.', lat:-31.9556, lon:141.4678 },
  // Health & Medical
  { name:'Broken Hill Base Hospital', cat:'health', addr:'Thomas St', phone:'08 8080 1333', hours:'24 hours', desc:'Public hospital. Emergency department 24/7. Specialist outreach clinics.', lat:-31.9610, lon:141.4688 },
  { name:'Broken Hill Medical Centre', cat:'health', addr:'Argent St', phone:'08 8087 3855', hours:'Mon–Fri 8am–5pm', desc:'General practice. Bulk billing available. Multiple GPs.', lat:-31.9567, lon:141.4665 },
  { name:'Far West Primary Health', cat:'health', addr:'Wolfram St', phone:'08 8080 1200', hours:'Mon–Fri 8:30am–5pm', desc:'Primary health network. Allied health, chronic disease management.', lat:-31.9590, lon:141.4670 },
  { name:'BH Dental Clinic', cat:'health', addr:'Chloride St', phone:'08 8087 3421', hours:'Mon–Fri 8:30am–5pm', desc:'General and preventive dentistry. CDBS and DVA accepted.', lat:-31.9552, lon:141.4675 },
  // Professional Services
  { name:'LJ Hooker Broken Hill', cat:'professional', addr:'Argent St', phone:'08 8087 3033', hours:'Mon–Fri 9am–5pm, Sat 9am–12pm', desc:'Real estate sales, property management, rentals.', lat:-31.9569, lon:141.4663 },
  { name:'First National BH', cat:'professional', addr:'Argent St', phone:'08 8087 5555', hours:'Mon–Fri 9am–5pm', desc:'Real estate agency. Residential and rural sales.', lat:-31.9571, lon:141.4661 },
  { name:'Far West Community Legal', cat:'professional', addr:'Beryl St', phone:'08 8088 2600', hours:'Mon–Fri 9am–4:30pm', desc:'Free legal advice for eligible clients. Family law, tenancy, criminal matters.', lat:-31.9580, lon:141.4660 },
  { name:'Broken Hill City Council', cat:'professional', addr:'Blende St', phone:'08 8080 3300', hours:'Mon–Fri 8:30am–5pm', desc:'Council offices. Rates, planning, building approvals, waste services.', lat:-31.9585, lon:141.4645 },
  // Mining & Industry
  { name:'Perilya South Mine', cat:'mining', addr:'South Mine Rd', phone:'08 8080 7000', hours:'24/7 operation', desc:'Active Pb-Zn-Ag mine. Largest employer in BH. Tours not available.', lat:-31.9800, lon:141.4600 },
  { name:'CBH Resources (Rasp Mine)', cat:'mining', addr:'Racecourse Rd', phone:'08 8087 XXXX', hours:'24/7 operation', desc:'Active Pb-Zn-Ag mine. CBH Resources. Opened 2012.', lat:-31.9650, lon:141.4580 },
  { name:'BH Equipment Hire', cat:'mining', addr:'Iodide St', phone:'08 8087 4488', hours:'Mon–Fri 7am–5pm, Sat 7am–12pm', desc:'Equipment hire for mining, construction, civil. Large fleet.', lat:-31.9555, lon:141.4705 },
  // Accommodation
  { name:'Lodge Motel Broken Hill', cat:'accommodation', addr:'Oxide St', phone:'08 8088 2722', hours:'24hrs reception', desc:'Motel rooms, self-contained units. Pool. Pet friendly. Close to CBD.', lat:-31.9545, lon:141.4710 },
  { name:'Broken Hill Tourist Lodge', cat:'accommodation', addr:'Argent St', phone:'08 8087 7744', hours:'24hrs reception', desc:'Budget accommodation. Dorms and private rooms. Kitchen facilities.', lat:-31.9570, lon:141.4658 },
  { name:'Royal Exchange Hotel', cat:'accommodation', addr:'Argent St', phone:'08 8087 2308', hours:'Daily', desc:'Historic pub accommodation. Centrally located. Character rooms.', lat:-31.9568, lon:141.4656 },
  { name:'Desert Wind Motel', cat:'accommodation', addr:'Menindee Rd', phone:'08 8087 6600', hours:'24hrs', desc:'Modern motel rooms. Close to town. Free parking. Breakfast available.', lat:-31.9620, lon:141.4720 },
  // Entertainment & Leisure
  { name:'Silver City Cinema', cat:'entertainment', addr:'Argent St', phone:'08 8087 XXXX', hours:'Session times vary', desc:"Broken Hill's own cinema. New release films, special events.", lat:-31.9566, lon:141.4654 },
  { name:'Broken Hill Speedway', cat:'entertainment', addr:'Rakow St', phone:'08 8087 XXXX', hours:'Race nights only', desc:'Dirt track speedway. Season opener March. Regular events April–October.', lat:-31.9700, lon:141.4750 },
  { name:'Pro Hart Gallery', cat:'entertainment', addr:'108 Wyman St', phone:'08 8087 2441', hours:'Mon–Sat 9am–5pm', desc:"Australia's greatest outback artist. Thousands of original works.", lat:-31.9540, lon:141.4625 },
  { name:'Living Desert Reserve', cat:'entertainment', addr:'Living Desert Rd', phone:'', hours:'Sunrise–sunset', desc:'Sculpture park, wildlife, stunning sunset views. Free entry.', lat:-31.9250, lon:141.4500 },
];

const CAT_COLORS = {
  food:'#D44820', trades:'#BA7517', retail:'#5080B8', health:'#4A9A64',
  professional:'#7F77DD', mining:'#E08C24', accommodation:'#D4537E', entertainment:'#1D9E75'
};

const CAT_LABELS = {
  food:'Food & Drink', trades:'Trades & Services', retail:'Retail & Shopping',
  health:'Health & Medical', professional:'Professional Services', mining:'Mining & Industry',
  accommodation:'Accommodation', entertainment:'Entertainment'
};

let activeBizCat = 'all';
let bizSearchTerm = '';
let bizMapTick = 0;
let bizRAF = null;

function getFilteredBiz() {
  return BUSINESSES.filter(b => {
    const matchCat = activeBizCat === 'all' || b.cat === activeBizCat;
    const q = bizSearchTerm.toLowerCase();
    const matchSearch = !q || b.name.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) || b.addr.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

function renderBizGrid(businesses) {
  const grid = document.getElementById('biz-grid');
  const count = document.getElementById('biz-count');
  if (!grid) return;
  if (count) count.textContent = `Showing ${businesses.length} of ${BUSINESSES.length} businesses`;
  setEl('biz-map-count', businesses.length + ' locations');

  grid.innerHTML = businesses.map(b => {
    const col = CAT_COLORS[b.cat] || 'var(--dust)';
    return `<div class="card" style="border-left:3px solid ${col};transition:all 0.15s;cursor:default" onmouseover="highlightMapBiz('${b.name}')" onmouseout="highlightMapBiz(null)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem">
        <div style="font-weight:500;color:var(--parch);font-size:0.9rem;flex:1;margin-right:0.5rem">${b.name}</div>
        <span style="background:${col}22;color:${col};border:1px solid ${col}44;font-family:var(--font-mono);font-size:0.58rem;padding:2px 6px;border-radius:3px;white-space:nowrap;flex-shrink:0">${CAT_LABELS[b.cat]||b.cat}</span>
      </div>
      <div style="font-size:0.76rem;color:var(--dust-light);margin-bottom:0.5rem;line-height:1.5">${b.desc}</div>
      <div style="display:flex;flex-direction:column;gap:0.2rem;font-size:0.73rem">
        <div style="color:var(--dust-light)">📍 ${b.addr}</div>
        ${b.phone ? `<div style="color:var(--rust-light);font-family:var(--font-mono)">${b.phone}</div>` : ''}
        ${b.hours ? `<div style="color:var(--dust-light)">🕐 ${b.hours}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

let hoveredBiz = null;
window.highlightMapBiz = function(name) { hoveredBiz = name; };

function drawBizMap(businesses) {
  const canvas = document.getElementById('biz-map');
  if (!canvas) return;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  if (!W || !H) return;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');

  // BH bounding box
  const LAT_MIN = -32.05, LAT_MAX = -31.88;
  const LON_MIN = 141.38, LON_MAX = 141.55;
  const pad = 24;

  function project(lat, lon) {
    const x = pad + (lon - LON_MIN) / (LON_MAX - LON_MIN) * (W - pad * 2);
    const y = pad + (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (H - pad * 2);
    return { x, y };
  }

  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const x = pad + i * (W - pad*2) / 4;
    const y = pad + i * (H - pad*2) / 4;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
  }

  // Main roads (approximate)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
  const roads = [
    [[-31.957,141.430],[-31.957,141.510]], // Argent St (E-W)
    [[-31.940,141.470],[-32.000,141.470]], // North-South main
  ];
  roads.forEach(road => {
    ctx.beginPath();
    road.forEach(([lat,lon], i) => {
      const p = project(lat, lon);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  });

  // Compass
  ctx.fillStyle = 'rgba(160,148,137,0.4)'; ctx.font = '10px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('N ↑', W - 18, pad + 14);

  // Business pins
  businesses.forEach(b => {
    const p = project(b.lat, b.lon);
    const col = CAT_COLORS[b.cat] || '#888';
    const isHovered = hoveredBiz === b.name;
    const r = isHovered ? 8 : 5;

    // Glow on hover
    if (isHovered) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2);
      ctx.fillStyle = col + '30'; ctx.fill();
    }

    // Pin dot
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = '#0d1117'; ctx.lineWidth = 1.5; ctx.stroke();

    // Label on hover
    if (isHovered) {
      ctx.font = '10px DM Mono,monospace'; ctx.textAlign = 'left';
      const lbl = b.name.length > 20 ? b.name.substring(0,18)+'…' : b.name;
      const tw = ctx.measureText(lbl).width;
      let lx = p.x + 10, ly = p.y - 6;
      if (lx + tw > W - 8) lx = p.x - tw - 10;
      ctx.fillStyle = col; ctx.fillText(lbl, lx, ly);
    }
  });

  // Category legend
  const cats = [...new Set(businesses.map(b => b.cat))].slice(0, 6);
  cats.forEach((cat, i) => {
    const col = CAT_COLORS[cat] || '#888';
    const lx = pad + 2, ly = H - pad - (cats.length - 1 - i) * 16 - 4;
    ctx.beginPath(); ctx.arc(lx + 4, ly, 4, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(160,148,137,0.6)'; ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'left';
    ctx.fillText(CAT_LABELS[cat] || cat, lx + 12, ly + 3);
  });

  bizMapTick++;
}

// Tooltip on canvas hover
function initBizMapTooltip() {
  const canvas = document.getElementById('biz-map');
  const tip = document.getElementById('biz-map-tip');
  if (!canvas || !tip) return;

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const pad = 24;
    const LAT_MIN = -32.05, LAT_MAX = -31.88, LON_MIN = 141.38, LON_MAX = 141.55;

    const filtered = getFilteredBiz();
    let closest = null, minDist = 20;
    filtered.forEach(b => {
      const x = pad + (b.lon - LON_MIN) / (LON_MAX - LON_MIN) * (W - pad*2);
      const y = pad + (1-(b.lat-LAT_MIN)/(LAT_MAX-LAT_MIN)) * (H - pad*2);
      const dist = Math.sqrt((mx-x)**2 + (my-y)**2);
      if (dist < minDist) { minDist = dist; closest = b; }
    });

    if (closest) {
      tip.innerHTML = `<strong style="color:var(--parch)">${closest.name}</strong><br><span style="color:var(--dust-light);font-size:0.7rem">${closest.addr}</span>${closest.phone ? `<br><span style="color:var(--rust-light);font-family:var(--font-mono);font-size:0.7rem">${closest.phone}</span>` : ''}`;
      tip.style.display = 'block';
      tip.style.left = (mx + 14) + 'px';
      tip.style.top = (my - 10) + 'px';
      highlightMapBiz(closest.name);
    } else {
      tip.style.display = 'none';
      highlightMapBiz(null);
    }
  });

  canvas.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    highlightMapBiz(null);
  });
}

function startBizMap() {
  if (bizRAF) cancelAnimationFrame(bizRAF);
  function loop() {
    drawBizMap(getFilteredBiz());
    bizRAF = requestAnimationFrame(loop);
  }
  loop();
}

window.bizFilter = function(cat, btn) {
  activeBizCat = cat;
  document.querySelectorAll('#biz-filter-bar .fbtn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderBizGrid(getFilteredBiz());
};

window.bizSearch = function() {
  bizSearchTerm = document.getElementById('biz-search')?.value || '';
  renderBizGrid(getFilteredBiz());
};

function initBizDir() {
  if (window._bizdirInited) return;
  window._bizdirInited = true;
  renderBizGrid(BUSINESSES);
  setTimeout(() => {
    startBizMap();
    initBizMapTooltip();
  }, 100);
}

window.initBizDir = initBizDir;

/* ══════════════════════════════════════════════════════
   HISTORIC PHOTOS
   Curated collection + live Trove API search
══════════════════════════════════════════════════════ */

const CURATED_PHOTOS = [
  { id:'p001', title:'North Mine headframe, Broken Hill', year:1895, era:'1880s', tags:['mining','infrastructure'], src:'https://trove.nla.gov.au/proxy?url=https://nla.gov.au/nla.pic-an23478091-v', thumb:'https://nla.gov.au/nla.pic-an23478091-v', trove:'https://trove.nla.gov.au/work/23478091', source:'National Library of Australia · nla.pic-an23478091', desc:'The iconic North Mine headframe shortly after sinking. The structure dominated the BH skyline for over 100 years until closure in 2006.' },
  { id:'p002', title:'Argent Street looking east, 1895', year:1895, era:'1880s', tags:['streets','cbd'], src:'https://trove.nla.gov.au/proxy?url=https://nla.gov.au/nla.pic-an23300512-v', thumb:'https://nla.gov.au/nla.pic-an23300512-v', trove:'https://trove.nla.gov.au/work/23300512', source:'State Library NSW', desc:'Argent Street in its early years. Unpaved road, timber buildings and a handful of residents. The town was barely a decade old.' },
  { id:'p003', title:'BHP mine workers, Broken Hill c.1910', year:1910, era:'1900s', tags:['mining','people','workers'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+mine+workers+1910', source:'National Library of Australia', desc:'A crew of BHP miners photographed at the surface. Working conditions in the early years were extremely dangerous — lead dust, heat, and no safety equipment.' },
  { id:'p004', title:'Broken Hill from the air, 1930s', year:1935, era:'1930s', tags:['aerial','streets'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+aerial+1930s', source:'State Library NSW', desc:'One of the earliest aerial photographs of Broken Hill, showing the grid layout of streets and the proximity of the mine to the town centre.' },
  { id:'p005', title:'Strike meeting at the Domain, 1919', year:1919, era:'1900s', tags:['people','history','strikes'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+strike+1919', source:'Barrier Miner', desc:'The famous 1919 35-hour week strike — a landmark in Australian labour history. BH miners won the 35-hour week, the first in Australia.' },
  { id:'p006', title:'Silverton township, 1885', year:1885, era:'1880s', tags:['silverton','streets'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=silverton+nsw+1885', source:'National Library of Australia', desc:'Silverton at its peak population of over 3,000. The town pre-dates Broken Hill and was once expected to be the region\'s major centre.' },
  { id:'p007', title:'Royal Flying Doctor Service base, 1950s', year:1955, era:'1930s', tags:['rfds','people','infrastructure'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+flying+doctor+1950s', source:'RFDS Archives', desc:'The Broken Hill RFDS base was established in 1936. This photograph shows the early fleet and staff who provided medical care across remote western NSW.' },
  { id:'p008', title:'School of the Air broadcasting, 1956', year:1956, era:'1930s', tags:['education','people'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+school+of+the+air', source:'State Library NSW', desc:'The world\'s first School of the Air began broadcasting from Broken Hill in 1951. Children on remote stations received lessons via two-way radio.' },
  { id:'p009', title:'Bells Milk Bar interior, 1950s', year:1952, era:'1930s', tags:['people','streets','culture'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=bells+milk+bar+broken+hill', source:'BH City Library', desc:'Bells Milk Bar on Oxide Street — preserved almost intact since it opened. A perfectly preserved piece of 1950s Australian street life.' },
  { id:'p010', title:'Pro Hart in his studio, 1968', year:1968, era:'1960s', tags:['art','people','culture'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=pro+hart+broken+hill', source:'National Library of Australia', desc:'Kevin "Pro" Hart at work in his Wyman Street studio. By this time his reputation was growing nationally, though he never left Broken Hill.' },
  { id:'p011', title:'Mundi Mundi Plains, 1970s', year:1972, era:'1960s', tags:['landscape','outback'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=mundi+mundi+plains', source:'State Library NSW', desc:'The vast Mundi Mundi Plains west of Broken Hill. Later made famous as a filming location for Mad Max 2 (1981) and Priscilla Queen of the Desert (1994).' },
  { id:'p012', title:'BHP smelter stack demolition, 1972', year:1972, era:'1960s', tags:['mining','infrastructure'], src:'', thumb:'', trove:'https://trove.nla.gov.au/search/category/images?keyword=broken+hill+smelter+demolition', source:'BH Historical Society', desc:'The demolition of the old smelter stack marked the end of an era. Lead smelting had been a defining feature of Broken Hill since the 1890s.' },
];

let photoEraFilter = 'all';
let photoSearchTerm = '';

function getFilteredPhotos() {
  return CURATED_PHOTOS.filter(p => {
    const matchEra = photoEraFilter === 'all' || p.era === photoEraFilter || p.tags.includes(photoEraFilter);
    const q = photoSearchTerm.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || String(p.year).includes(q);
    return matchEra && matchSearch;
  });
}

function renderPhotoGrid(photos) {
  const grid = document.getElementById('photo-grid');
  const count = document.getElementById('photo-count');
  if (!grid) return;
  if (count) count.textContent = `Showing ${photos.length} photos`;

  grid.innerHTML = photos.map(p => `
    <div class="card" style="padding:0;overflow:hidden;cursor:pointer" onclick="openLightbox('${p.id}')">
      <div style="position:relative;background:var(--ink);height:160px;display:flex;align-items:center;justify-content:center;overflow:hidden">
        ${p.thumb ? `<img src="${p.thumb}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;filter:sepia(40%) contrast(0.9)" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:0.5rem\\'><div style=\\'font-size:2.5rem;opacity:0.2\\'>📷</div><div style=\\'font-size:0.68rem;color:var(--dust);font-family:var(--font-mono)\\'>${p.year}</div></div>'">`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:0.5rem">
             <div style="font-size:2.5rem;opacity:0.2">📷</div>
             <div style="font-size:0.68rem;color:var(--dust);font-family:var(--font-mono)">${p.year}</div>
           </div>`}
        <div style="position:absolute;top:0.5rem;left:0.5rem;background:rgba(0,0,0,0.65);color:var(--ochre-light);font-family:var(--font-mono);font-size:0.62rem;padding:2px 7px;border-radius:3px">${p.year}</div>
      </div>
      <div style="padding:0.75rem">
        <div style="font-weight:500;color:var(--parch);font-size:0.85rem;margin-bottom:0.2rem;line-height:1.3">${p.title}</div>
        <div style="font-size:0.72rem;color:var(--dust-light);line-height:1.5;margin-bottom:0.5rem">${p.desc.substring(0,80)}${p.desc.length>80?'...':''}</div>
        <div style="font-size:0.65rem;font-family:var(--font-mono);color:var(--dust)">${p.source}</div>
      </div>
    </div>`).join('');
}

window.photoEra = function(era, btn) {
  photoEraFilter = era;
  document.querySelectorAll('[data-era]').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderPhotoGrid(getFilteredPhotos());
};

window.filterPhotos = function() {
  photoSearchTerm = document.getElementById('photo-search')?.value || '';
  renderPhotoGrid(getFilteredPhotos());
};

window.openLightbox = function(id) {
  const p = CURATED_PHOTOS.find(x => x.id === id);
  if (!p) return;
  const lb = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const src = document.getElementById('lightbox-source');
  if (!lb) return;
  img.src = p.thumb || p.src || '';
  img.alt = p.title;
  cap.innerHTML = `<strong style="color:var(--parch)">${p.title}</strong> · ${p.year}<br>${p.desc}`;
  src.innerHTML = `Source: ${p.source}${p.trove ? ` · <a href="${p.trove}" target="_blank" style="color:var(--slate-light)">View on Trove →</a>` : ''}`;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeLightbox = function() {
  const lb = document.getElementById('photo-lightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
};

// Close lightbox on escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeLightbox(); });

/* ── Trove live search ── */
async function searchTrovePhotos() {
  const apiKey = window.TROVE_API_KEY || '';
  const grid   = document.getElementById('trove-photo-grid');
  const loading = document.getElementById('trove-photo-loading');
  const error   = document.getElementById('trove-photo-error');
  const ts      = document.getElementById('trove-photo-ts');

  if (!apiKey) {
    if (loading) loading.innerHTML = '<span style="color:var(--ochre-light)">Add TROVE_API_KEY to GitHub secrets to enable live Trove search</span>';
    return;
  }

  try {
    const r = await fetch(
      `https://api.trove.nla.gov.au/v3/result?q=broken+hill&category=image&l-decade=190,191,192,193,194,195,196&encoding=json&n=20&key=${apiKey}`
    );
    if (!r.ok) throw new Error('Trove API ' + r.status);
    const d = await r.json();
    const items = d.category?.[0]?.records?.item || [];

    if (!items.length) throw new Error('No results');

    if (loading) loading.style.display = 'none';
    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = items.slice(0, 12).map(item => {
        const thumb = item.identifier?.find(i => i.linktype === 'thumbnail')?.value || '';
        const title = item.title || 'Untitled';
        const date  = item.date || '';
        const troveUrl = `https://trove.nla.gov.au/work/${item.id}`;
        return `
          <div style="background:var(--ink);border-radius:6px;overflow:hidden;cursor:pointer" onclick="window.open('${troveUrl}','_blank')">
            <div style="height:140px;background:var(--ink-soft);display:flex;align-items:center;justify-content:center;overflow:hidden">
              ${thumb ? `<img src="${thumb}" alt="${title}" style="width:100%;height:100%;object-fit:cover;filter:sepia(30%)" onerror="this.style.display='none'">` : '<div style="font-size:2rem;opacity:0.2">📷</div>'}
            </div>
            <div style="padding:0.6rem">
              <div style="font-size:0.78rem;font-weight:500;color:var(--parch);margin-bottom:0.2rem;line-height:1.3">${title.substring(0,60)}${title.length>60?'...':''}</div>
              <div style="font-size:0.65rem;font-family:var(--font-mono);color:var(--dust-light)">${date} · Trove</div>
            </div>
          </div>`;
      }).join('');
    }

    if (ts) ts.textContent = `${items.length} results · Trove API`;

  } catch(e) {
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'block';
    if (ts) ts.textContent = 'Trove offline';
    console.warn('Trove photos:', e.message);
  }
}

function initPhotos() {
  if (window._photosInited) return;
  window._photosInited = true;
  renderPhotoGrid(CURATED_PHOTOS);
  searchTrovePhotos();
}

window.initPhotos = initPhotos;
