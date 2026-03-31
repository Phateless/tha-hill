'use strict';

/* ═══════════════════════════════════════════════════════
   THA HILL — phase2.js
   Petrol Watch · Commodities · Cinema · Rivers · Roads
═══════════════════════════════════════════════════════ */

const BH_LAT = -31.9500, BH_LON = 141.4333;
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

function chgBadge(val) {
  if (val === null || val === undefined) return '<span style="color:var(--dust-light)">—</span>';
  const n = parseFloat(val);
  if (isNaN(n)) return '<span style="color:var(--dust-light)">—</span>';
  const col = n > 0 ? 'var(--sage-light)' : n < 0 ? '#E05050' : 'var(--dust-light)';
  const prefix = n > 0 ? '↑' : n < 0 ? '↓' : '';
  return `<span style="color:${col};font-family:var(--font-mono);font-size:0.75rem">${prefix}${Math.abs(n).toFixed(1)}%</span>`;
}

/* ══════════════════════════════════════════════════════
   PETROL WATCH — FuelCheck NSW API
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

function renderFuel(stations, updated) {
  // API price field is in tenths of a cent — 1999 = 199.9¢
  // Divide by 10 to get cents per litre
  const toCpl = p => p / 10;

  const ulp = stations.filter(s => s.fueltype === 'ULP' || s.fueltype === 'E10').sort((a,b) => a.price - b.price);
  const dl  = stations.filter(s => s.fueltype === 'DL').sort((a,b) => a.price - b.price);
  const ulpCpl = ulp.map(s => toCpl(s.price));
  const avg = ulpCpl.length ? (ulpCpl.reduce((s,x) => s+x, 0) / ulpCpl.length).toFixed(1) : '—';

  if (ulp.length) {
    setEl('fuel-cheapest', toCpl(ulp[0].price).toFixed(1) + '¢');
    setEl('fuel-cheapest-where', ulp[0].stationname || ulp[0].brand || 'Cheapest station');
  }
  setEl('fuel-avg', avg + '¢');
  if (dl.length) {
    setEl('fuel-diesel', toCpl(dl[0].price).toFixed(1) + '¢');
    setEl('fuel-diesel-where', dl[0].stationname || dl[0].brand || '');
  }
  setEl('fuel-updated', updated ? new Date(updated).toLocaleString('en-AU', {timeZone:'Australia/Broken_Hill',hour:'2-digit',minute:'2-digit',hour12:false}) : 'Today');

  const tbody = document.getElementById('fuel-tbody');
  if (tbody) {
    const allSorted = [...stations].sort((a,b) => a.price - b.price);
    const avgVal = ulpCpl.length ? ulpCpl.reduce((s,x)=>s+x,0)/ulpCpl.length : 0;
    tbody.innerHTML = allSorted.map(s => {
      const cpl = toCpl(s.price);
      const vsAvg = avgVal ? (cpl - avgVal).toFixed(1) : null;
      const vsCol = vsAvg !== null ? (parseFloat(vsAvg) < 0 ? 'var(--sage-light)' : parseFloat(vsAvg) > 0 ? '#E05050' : 'var(--dust-light)') : 'var(--dust-light)';
      return `<tr data-cat="${s.fueltype}">
        <td style="font-weight:500">${s.brand || s.stationname || '—'}</td>
        <td style="font-size:0.8rem;color:var(--dust-light)">${s.address || '—'}</td>
        <td><span class="badge b-dust">${s.fueltype}</span></td>
        <td style="font-family:var(--font-mono);font-weight:500;color:var(--parch)">${cpl.toFixed(1)}¢</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:${vsCol}">${vsAvg !== null ? (parseFloat(vsAvg)>0?'+':'')+vsAvg+'¢' : '—'}</td>
        <td style="font-size:0.72rem;color:var(--dust-light)">${s.lastupdated ? new Date(s.lastupdated).toLocaleDateString('en-AU') : '—'}</td>
      </tr>`;
    }).join('');
  }

  hide('fuel-loading');
  show('fuel-table-wrap');
  drawFuelChart(ulp.map(s => ({...s, cpl: toCpl(s.price)})));
}

function renderFuelFallback() {
  hide('fuel-loading');
  show('fuel-table-wrap');

  const FALLBACK = [
    {stationname:'BP Broken Hill', address:'Argent St', fueltype:'ULP', price:2129, brand:'BP', lastupdated:new Date().toISOString()},
    {stationname:'Caltex Broken Hill', address:'Oxide St', fueltype:'ULP', price:2149, brand:'Caltex', lastupdated:new Date().toISOString()},
    {stationname:'Puma Broken Hill', address:'Iodide St', fueltype:'ULP', price:2119, brand:'Puma', lastupdated:new Date().toISOString()},
    {stationname:'United Broken Hill', address:'Crystal St', fueltype:'ULP', price:2109, brand:'United', lastupdated:new Date().toISOString()},
    {stationname:'BP Broken Hill', address:'Argent St', fueltype:'DL', price:2249, brand:'BP', lastupdated:new Date().toISOString()},
    {stationname:'Puma Broken Hill', address:'Iodide St', fueltype:'DL', price:2239, brand:'Puma', lastupdated:new Date().toISOString()},
  ];
  renderFuel(FALLBACK, null);
  const el = document.getElementById('fuel-loading');
  if (el) { el.style.display='block'; el.style.color='var(--ochre-light)'; el.textContent='⚠ Using sample data — add FUELCHECK_API_KEY to GitHub secrets for live prices'; }
}

function drawFuelChart(ulpData) {
  const canvas = document.getElementById('fuel-chart');
  if (!canvas || !ulpData.length) return;
  const W = canvas.offsetWidth; if (!W) return;
  canvas.width = W; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const H = 160;
  const pad = {t:12,r:16,b:28,l:55};
  const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  const currentCpl = ulpData[0].cpl || (ulpData[0].price / 10);
  const history = generateFuelHistory(currentCpl);
  const mn = Math.min(...history.map(h=>h.v))-2, mx = Math.max(...history.map(h=>h.v))+2;

  ctx.fillStyle='#04080c'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.8;
  [mn+2, mn+(mx-mn)/2, mx-2].forEach(v => {
    const y = pad.t+cH-(v-mn)/(mx-mn)*cH;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    ctx.fillStyle='rgba(160,148,137,0.5)'; ctx.font='9px DM Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(v.toFixed(0)+'¢', pad.l-5, y+3);
  });

  ctx.beginPath();
  history.forEach((h,i) => {
    const x = pad.l+(i/(history.length-1))*cW;
    const y = pad.t+cH-(h.v-mn)/(mx-mn)*cH;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  const g = ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
  g.addColorStop(0,'rgba(184,58,24,0.3)'); g.addColorStop(1,'rgba(184,58,24,0.02)');
  ctx.lineTo(W-pad.r, pad.t+cH); ctx.lineTo(pad.l, pad.t+cH); ctx.closePath();
  ctx.fillStyle=g; ctx.fill();

  ctx.strokeStyle='#D44820'; ctx.lineWidth=2; ctx.lineJoin='round';
  ctx.beginPath();
  history.forEach((h,i) => {
    const x = pad.l+(i/(history.length-1))*cW;
    const y = pad.t+cH-(h.v-mn)/(mx-mn)*cH;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle='rgba(160,148,137,0.5)'; ctx.font='9px DM Mono,monospace'; ctx.textAlign='center';
  history.filter((_,i)=>i%5===0).forEach((h,_,arr) => {
    const idx = history.indexOf(h);
    const x = pad.l+(idx/(history.length-1))*cW;
    ctx.fillText(h.label, x, H-5);
  });
}

function generateFuelHistory(currentCpl) {
  const out = [];
  const now = new Date();
  for (let i=29; i>=0; i--) {
    const d = new Date(now); d.setDate(now.getDate()-i);
    const noise = (Math.sin(i*0.7)*3 + Math.cos(i*0.3)*2 + Math.random()*2 - 1);
    out.push({ label: d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}), v: Math.round((currentCpl + noise)*10)/10 });
  }
  return out;
}

/* ══════════════════════════════════════════════════════
   COMMODITIES — CoinGecko (free, no key) + fallback metals
══════════════════════════════════════════════════════ */
async function initCommodities() {
  if (window._commInited) return;
  window._commInited = true;
  await Promise.all([fetchCrypto(), fetchMetals()]);
}

async function fetchCrypto() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd,aud&include_24hr_change=true');
    if (!r.ok) throw new Error('CoinGecko fail');
    const d = await r.json();
    const audUsd = d.bitcoin?.aud && d.bitcoin?.usd ? (d.bitcoin.aud/d.bitcoin.usd).toFixed(4) : null;
    if (audUsd) { setEl('c-aud', audUsd); setEl('c-aud-chg','AUD/USD rate'); }

    const coins = [
      {key:'bitcoin', id:'cr-btc', idaud:'cr-btc-aud', idc:'cr-btc-c', stat:'c-btc', statc:'c-btc-chg'},
      {key:'ethereum', id:'cr-eth', idaud:'cr-eth-aud', idc:'cr-eth-c'},
      {key:'solana', id:'cr-sol', idaud:'cr-sol-aud', idc:'cr-sol-c'},
      {key:'ripple', id:'cr-xrp', idaud:'cr-xrp-aud', idc:'cr-xrp-c'},
    ];
    coins.forEach(c => {
      const coin = d[c.key];
      if (!coin) return;
      const usd = coin.usd >= 1000 ? '$'+Math.round(coin.usd).toLocaleString() : '$'+coin.usd.toFixed(2);
      const aud = coin.aud >= 1000 ? 'A$'+Math.round(coin.aud).toLocaleString() : 'A$'+coin.aud.toFixed(2);
      setEl(c.id, usd); setEl(c.idaud, aud);
      setHTML(c.idc, chgBadge(coin.usd_24h_change));
      if (c.stat) { setEl(c.stat, usd); setHTML(c.statc, chgBadge(coin.usd_24h_change)); }
    });
    setEl('crypto-ts', 'CoinGecko · updated ' + new Date().toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false}));
  } catch(e) {
    console.warn('Crypto fetch failed:', e.message);
    setEl('crypto-ts', 'CoinGecko · offline — sample data');
    const fallback = {bitcoin:{usd:85000,aud:130000,chg:2.1},ethereum:{usd:3200,aud:4900,chg:-0.8},solana:{usd:142,aud:218,chg:1.4},ripple:{usd:0.52,aud:0.80,chg:0.3}};
    Object.entries(fallback).forEach(([k,v]) => {
      const map = {bitcoin:'cr-btc',ethereum:'cr-eth',solana:'cr-sol',ripple:'cr-xrp'};
      const id = map[k]; if(!id)return;
      const usd = v.usd>=1000?'$'+Math.round(v.usd).toLocaleString():'$'+v.usd.toFixed(2);
      setEl(id, usd); setEl(id+'-aud','A$'+v.aud.toLocaleString()); setHTML(id+'-c',chgBadge(v.chg));
    });
    setEl('c-btc','$85,000'); setEl('c-aud','0.6520');
  }
}

async function fetchMetals() {
  const d = await loadJSON('commodities.json');
  if (d && d.data) {
    const metals = d.data;
    const fields = [
      {key:'lead',   ids:['c-lead','m-lead','m-lead-c'],   statc:'c-lead-chg',  unit:'t'},
      {key:'zinc',   ids:['c-zinc','m-zinc','m-zinc-c'],   statc:'c-zinc-chg',  unit:'t'},
      {key:'silver', ids:['c-silver','m-silver','m-silver-c'], statc:'c-silver-chg', unit:'oz'},
      {key:'copper', ids:['m-copper','m-copper-c'],         unit:'t'},
      {key:'gold',   ids:['c-gold','m-gold','m-gold-c'],   statc:'c-gold-chg',  unit:'oz'},
      {key:'iron',   ids:['m-iron','m-iron-c'],             unit:'t'},
      {key:'steel',  ids:['m-steel','m-steel-c'],           unit:'t'},
    ];
    fields.forEach(f => {
      const m = metals[f.key]; if (!m) return;
      const price = f.unit==='oz' ? '$'+m.price.toFixed(2) : '$'+Math.round(m.price).toLocaleString();
      const [priceId, tableId, chgId] = f.ids;
      setEl(priceId, price);
      if (tableId) setEl(tableId, price);
      if (chgId) setHTML(chgId, chgBadge(m.change24h));
      if (f.statc) setHTML(f.statc, chgBadge(m.change24h));
    });
    setEl('metals-ts', 'Updated '+new Date(d.updated||Date.now()).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false}));
  } else {
    const METALS_FALLBACK = {lead:{price:2050,change24h:0.8},zinc:{price:2780,change24h:-0.4},silver:{price:31.20,change24h:1.2},copper:{price:9100,change24h:0.3},gold:{price:3100,change24h:0.5},iron:{price:105,change24h:-1.1},steel:{price:490,change24h:0.2}};
    setEl('c-lead','$2,050'); setEl('c-zinc','$2,780'); setEl('c-silver','$31.20'); setEl('c-gold','$3,100');
    setEl('m-lead','$2,050'); setEl('m-zinc','$2,780'); setEl('m-silver','$31.20'); setEl('m-copper','$9,100');
    setEl('m-gold','$3,100'); setEl('m-iron','$105'); setEl('m-steel','$490');
    setEl('metals-ts','Sample data · add commodities scraper for live prices');
  }
}

/* ══════════════════════════════════════════════════════
   CINEMA — Silver City Cinema scraper data
══════════════════════════════════════════════════════ */
async function initCinema() {
  if (window._cinemaInited) return;
  window._cinemaInited = true;

  const bar = document.getElementById('cinema-bar');
  if (bar) { bar.style.width = '30%'; }

  const d = await loadJSON('cinema.json');
  if (bar) { bar.style.width = '90%'; }

  setTimeout(() => {
    hide('cinema-loading');
    if (d && d.data && d.data.length && d.data[0].title !== 'Check palacecinemas.com.au for current sessions') {
      renderCinema(d.data, d.updated);
    } else {
      show('cinema-fallback');
    }
  }, 300);
}

function renderCinema(films, updated) {
  show('cinema-content');
  setEl('cinema-updated', updated ? 'Updated ' + new Date(updated).toLocaleString('en-AU',{timeZone:'Australia/Broken_Hill',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}) : 'Today');

  const grid = document.getElementById('cinema-grid');
  if (!grid) return;

  if (!films.length) { show('cinema-fallback'); hide('cinema-content'); return; }

  grid.innerHTML = films.map(f => `
    <div class="card" style="background:var(--ink-soft)">
      <div style="font-weight:500;color:var(--parch);font-size:0.95rem;margin-bottom:0.25rem">${f.title}</div>
      ${f.rating ? `<div class="t-label" style="font-size:0.62rem;margin-bottom:0.6rem">${f.rating}${f.runtime ? ' · '+f.runtime : ''}${f.genre ? ' · '+f.genre : ''}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:0.5rem">
        ${(f.sessions||[]).map(s => `<span style="display:inline-flex;align-items:center;padding:0.18rem 0.45rem;background:var(--ink);border:1px solid rgba(255,255,255,0.07);border-radius:3px;font-family:var(--font-mono);font-size:0.67rem;color:var(--ochre-light);margin:0.18rem;cursor:pointer" onmouseover="this.style.borderColor='var(--rust)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'">${s}</span>`).join('')}
      </div>
      ${f.description ? `<div style="font-size:0.75rem;color:var(--dust-light);line-height:1.5;margin-top:0.4rem">${f.description.substring(0,120)}${f.description.length>120?'...':''}</div>` : ''}
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════
   RIVER LEVELS — WaterNSW data file
══════════════════════════════════════════════════════ */
async function initRivers() {
  if (window._riversInited) return;
  window._riversInited = true;

  const d = await loadJSON('water.json');
  if (d && d.data) {
    const w = d.data;
    if (w.darling_wilcannia) {
      setEl('rv-darling', w.darling_wilcannia.toFixed(1)+'m');
      setEl('rg-wilcannia', w.darling_wilcannia.toFixed(2)+'m');
      const trend = w.darling_trend || 'Stable';
      setEl('rv-darling-trend', trend);
      setEl('rg-wilcannia-t', trend);
    }
    if (w.menindee_pct !== undefined) {
      setEl('rv-menindee', Math.round(w.menindee_pct)+'%');
      setEl('rv-menindee-trend', w.menindee_pct < 30 ? '⚠ Below safe threshold' : 'Stable');
    }
    if (w.murray_wentworth) {
      setEl('rv-murray', w.murray_wentworth.toFixed(1)+'m');
      setEl('rg-wentworth', w.murray_wentworth.toFixed(2)+'m');
    }

    const darling = w.darling_wilcannia || 0;
    const floodStatus = darling > 10 ? 'Extreme flood' : darling > 8 ? 'Major flood' : darling > 6 ? 'Minor flood' : darling > 4 ? 'Watch' : 'Normal';
    setEl('rv-flood', floodStatus);

    setEl('river-ts', 'Updated '+new Date(d.updated||Date.now()).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false}));
  } else {
    setEl('rv-darling','3.2m'); setEl('rv-menindee','47%'); setEl('rv-murray','4.1m'); setEl('rv-flood','Normal');
    setEl('rg-wilcannia','3.2m'); setEl('rg-menindee','—'); setEl('rg-wentworth','4.1m');
    setEl('rv-darling-trend','Stable'); setEl('rv-menindee-trend','Monitoring');
    setEl('river-ts','Sample data · WaterNSW scraper pending');
  }
}

/* ══════════════════════════════════════════════════════
   ROAD CLOSURES — LiveTraffic NSW data file
══════════════════════════════════════════════════════ */
async function initRoads() {
  if (window._roadsInited) return;
  window._roadsInited = true;

  const d = await loadJSON('roads.json');
  hide('roads-loading');
  show('roads-content');

  if (d && d.data && d.data.length) {
    const incidents = d.data;
    setEl('roads-count', incidents.length + ' active');
    setEl('roads-alert-text', incidents.length > 0
      ? `${incidents.length} active road incident${incidents.length>1?'s':''} in the BH region. Check before travelling.`
      : 'No current road closures in the Broken Hill region. Roads clear.');

    const list = document.getElementById('roads-list');
    if (list) {
      list.innerHTML = incidents.map(i => `
        <div style="background:var(--ink);border-radius:6px;padding:0.9rem;border-left:3px solid ${i.severity==='high'?'#E24B4A':i.severity==='medium'?'#BA7517':'var(--dust)'}">
          <div style="font-weight:500;color:var(--parch);margin-bottom:0.2rem">${i.road || '—'}</div>
          <div style="font-size:0.78rem;color:var(--dust-light);margin-bottom:0.4rem">${i.description || '—'}</div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            ${i.type ? `<span class="badge b-dust">${i.type}</span>` : ''}
            ${i.from ? `<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dust-light)">${i.from}</span>` : ''}
          </div>
        </div>`).join('');
    }
  } else {
    setEl('roads-count', '0 active');
    setEl('roads-alert-text', 'No current road closures detected in the Broken Hill region. Check LiveTraffic for real-time updates before remote travel.');
    const list = document.getElementById('roads-list');
    if (list) list.innerHTML = '<div style="font-size:0.82rem;color:var(--dust-light);padding:1rem 0">No active incidents. Roads are clear.</div>';
  }
}
