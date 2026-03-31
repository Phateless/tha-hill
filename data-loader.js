'use strict';

const DATA_BASE = './data/';

async function loadJSON(file) {
  try {
    const r = await fetch(DATA_BASE + file + '?v=' + Date.now());
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── WEATHER ──────────────────────────────────────────────────
async function loadWeatherData() {
  const d = await loadJSON('weather.json');
  if (!d) return;
  const cur = d.data.current;
  const daily = d.data.daily;
  if (!cur) return;

  const temp  = Math.round(cur.temperature_2m);
  const hi    = Math.round(daily.temperature_2m_max[0]);
  const lo    = Math.round(daily.temperature_2m_min[0]);
  const humid = Math.round(cur.relative_humidity_2m);
  const wind  = Math.round(cur.wind_speed_10m);

  const codes = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',61:'Rain',80:'Showers',95:'Thunderstorm'};
  const icons  = {0:'☀',1:'🌤',2:'⛅',3:'☁',61:'🌧',80:'🌦',95:'⛈'};
  const desc   = codes[cur.weather_code] || 'Clear';
  const icon   = icons[cur.weather_code] || '☀';

  // Sidebar
  const sTemp = document.querySelector('.weather-temp');
  if (sTemp) sTemp.textContent = temp + '°';
  const sDet = document.querySelector('.weather-detail');
  if (sDet) sDet.textContent = `${icon} ${desc} · BOM Station`;
  const sSub = document.querySelector('.weather-sub');
  if (sSub) sSub.textContent = `High ${hi}° · Low ${lo}° · Humidity ${humid}%`;

  // Home stats
  document.querySelectorAll('.stat.ochre .stat-val').forEach(e => e.textContent = hi + '°');

  // 3-day mini
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();
  [0,1,2].forEach(i => {
    const el = document.getElementById('mini-day-' + i);
    if (!el) return;
    const d2 = new Date(now); d2.setDate(now.getDate() + i);
    const hiD = Math.round(daily.temperature_2m_max[i]);
    const hot  = hiD >= 40;
    el.innerHTML = `
      <div style="font-family:var(--font-display);font-size:1.2rem;color:${hot?'#E05050':'var(--rust-light)'}">${hiD}°</div>
      <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--dust);letter-spacing:0.08em">${i===0?'TODAY':dayNames[d2.getDay()].toUpperCase()}</div>`;
    el.style.border = hot ? '1px solid rgba(224,80,80,0.3)' : '1px solid rgba(255,255,255,0.04)';
  });

  // 7-day forecast
  buildForecastStrip(daily);
  console.log('Weather loaded from data/weather.json');
}

function buildForecastStrip(daily) {
  const container = document.getElementById('forecast-strip');
  if (!container) return;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const icons = {0:'☀',1:'🌤',2:'⛅',3:'☁',61:'🌧',80:'🌦',95:'⛈'};
  const now = new Date();
  container.innerHTML = daily.temperature_2m_max.slice(0,7).map((hi,i) => {
    const d = new Date(now); d.setDate(now.getDate()+i);
    const hiR = Math.round(hi);
    const lo  = Math.round(daily.temperature_2m_min[i]);
    const rain = parseFloat(daily.precipitation_sum[i]).toFixed(0);
    const ico  = icons[daily.weather_code[i]] || '☀';
    const hot  = hiR >= 40;
    const label = i===0?'Today':days[d.getDay()];
    return `<div style="background:var(--ink);border-radius:6px;padding:0.7rem 0.5rem;text-align:center;border:1px solid ${hot?'rgba(224,80,80,0.3)':'rgba(255,255,255,0.05)'}">
      <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--dust);margin-bottom:0.3rem">${label.toUpperCase()}</div>
      <div style="font-size:1rem;margin-bottom:0.2rem">${ico}</div>
      <div style="font-family:var(--font-display);font-size:1.1rem;color:${hot?'#E05050':'var(--rust-light)'}">${hiR}°</div>
      <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--dust-light)">${lo}°</div>
      ${parseFloat(rain)>0?`<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--slate-light);margin-top:0.2rem">${rain}mm</div>`:''}
    </div>`;
  }).join('');
}

// ── AQI ───────────────────────────────────────────────────────
async function loadAQIData() {
  const d = await loadJSON('aqi.json');
  if (!d || !d.data) return;
  const aqi = d.data.aqi || 35;
  const cat = aqi < 33 ? 'Good' : aqi < 67 ? 'Moderate' : 'Poor';
  const cls = aqi < 33 ? 'aqi-good' : aqi < 67 ? 'aqi-mod' : 'aqi-poor';

  document.querySelectorAll('.aqi-pill').forEach(el => {
    el.className = 'aqi-pill ' + cls;
    el.innerHTML = `<span class="aqi-dot"></span> AQI ${aqi} — ${cat}`;
  });
  console.log(`AQI loaded: ${aqi} (${cat})`);
}

// ── WATER ─────────────────────────────────────────────────────
async function loadWaterData() {
  const d = await loadJSON('water.json');
  if (!d || !d.data) return;
  const men = d.data.menindee_pct;
  const ste = d.data.stephens_creek_pct;

  // Menindee gauge
  const gauge = document.querySelector('.water-fill[data-pct]');
  if (gauge) {
    gauge.dataset.pct = men;
    gauge.style.height = men + '%';
    const label = gauge.parentElement.querySelector('.water-pct');
    if (label) label.textContent = Math.round(men) + '%';
  }

  // Home stat
  document.querySelectorAll('.stat.warn .stat-val').forEach(e => e.textContent = Math.round(men) + '%');
  document.querySelectorAll('.stat.warn .stat-chg').forEach(e => e.textContent = men < 30 ? '⚠ Getting low' : 'Monitoring');
  console.log(`Water loaded: Menindee ${men}%`);
}

// ── REAL ESTATE ───────────────────────────────────────────────
async function loadRealEstateData() {
  const d = await loadJSON('realestate.json');
  if (!d || !d.data || !d.data.length) return;

  const grid = document.getElementById('prop-grid');
  if (!grid) return;

  const listings = d.data.slice(0, 6);
  const typeIcons = { sale: '⌂', rent: '🔑', commercial: '🏢' };
  const typeBadge = { sale: 'b-rust', rent: 'b-slate', commercial: 'b-ochre' };
  const typeLabel = { sale: 'For Sale', rent: 'For Rent', commercial: 'Commercial' };

  grid.innerHTML = listings.map(l => `
    <div class="prop-card" data-cat="${l.type}">
      <div class="prop-thumb">
        <div style="font-size:2rem;opacity:0.2">${typeIcons[l.type]||'⌂'}</div>
        <div style="position:absolute;top:0.65rem;left:0.65rem">
          <span class="badge ${typeBadge[l.type]||'b-dust'}">${typeLabel[l.type]||l.type}</span>
        </div>
      </div>
      <div class="prop-body">
        <div class="prop-price">${l.price || 'Contact agent'}</div>
        <div class="prop-addr">${l.address}</div>
        <div class="prop-agent">${l.source}</div>
        <div class="prop-specs">
          ${l.bedrooms ? '<span>🛏 ' + l.bedrooms + '</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
  console.log(`Real estate loaded: ${listings.length} listings`);
}

// ── POLICE RELEASES ───────────────────────────────────────────
async function loadPoliceData() {
  const d = await loadJSON('police.json');
  if (!d || !d.data || !d.data.length) return;

  const container = document.getElementById('police-releases');
  if (!container) return;

  container.innerHTML = d.data.slice(0,4).map(r => `
    <div style="border-bottom:1px solid rgba(255,255,255,0.04);padding-bottom:0.7rem;margin-bottom:0.7rem">
      <div style="font-size:0.83rem;font-weight:500;color:var(--parch);margin-bottom:0.15rem">${r.title}</div>
      <div style="font-size:0.77rem;color:var(--dust-light)">${r.summary}</div>
      <div class="t-label" style="font-size:0.6rem;margin-top:0.25rem">${r.date} · Far West Police District</div>
    </div>
  `).join('');
  console.log(`Police releases loaded: ${d.data.length}`);
}

// ── GUMTREE ───────────────────────────────────────────────────
async function loadGumtreeData() {
  const d = await loadJSON('gumtree.json');
  if (!d || !d.data || !d.data.length) return;

  const container = document.getElementById('buysell-grid');
  if (!container) return;

  container.innerHTML = d.data.slice(0,8).map(item => `
    <div class="card" data-cat="all">
      <div style="font-weight:500;color:var(--parch);margin-bottom:0.2rem">${item.title}</div>
      <div class="t-display" style="font-size:1.3rem;color:var(--ochre-light)">${item.price || 'POA'}</div>
      <div style="display:flex;justify-content:space-between;margin-top:0.5rem">
        <span class="badge b-dust">Gumtree</span>
        ${item.url ? `<a href="${item.url}" target="_blank" style="font-size:0.72rem;color:var(--slate-light)">View →</a>` : ''}
      </div>
    </div>
  `).join('');
  console.log(`Gumtree loaded: ${d.data.length} items`);
}

// ── TROVE ON THIS DAY ─────────────────────────────────────────
async function loadTroveData() {
  const d = await loadJSON('trove_otd.json');
  if (!d || !d.data || !d.data.length) return;

  const container = document.getElementById('otd-stories');
  if (!container) return;

  container.innerHTML = d.data.map(s => `
    <div class="otd-card">
      <div class="tl-date" style="margin-bottom:0.5rem">This day, ${s.year} — ${new Date().getFullYear() - s.year} years ago</div>
      <div class="otd-headline">"${s.title}"</div>
      <div style="font-size:0.78rem;color:var(--dust-light);margin-top:0.5rem">${s.snippet}</div>
      <div class="t-label" style="font-size:0.58rem;margin-top:0.7rem">${s.newspaper}</div>
      <div class="otd-year">${s.year}</div>
    </div>
  `).join('');
  console.log(`Trove OTD loaded: ${d.data.length} stories`);
}

// ── COUNCIL EVENTS ────────────────────────────────────────────
async function loadCouncilEvents() {
  const d = await loadJSON('events_council.json');
  if (!d || !d.data || !d.data.length) return;
  console.log(`Council events loaded: ${d.data.length}`);
}

// ── MASTER LOADER ─────────────────────────────────────────────
async function loadAllData() {
  console.log('Loading live data...');
  await Promise.allSettled([
    loadWeatherData(),
    loadAQIData(),
    loadWaterData(),
    loadRealEstateData(),
    loadPoliceData(),
    loadGumtreeData(),
    loadTroveData(),
    loadCouncilEvents(),
  ]);
  console.log('All data sources checked.');
}

window.addEventListener('load', () => {
  setTimeout(loadAllData, 500);
});

window.loadAllData = loadAllData;
