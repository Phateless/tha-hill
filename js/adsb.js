'use strict';

/* ═══════════════════════════════════════════════════════
   THA HILL — adsb.js
   FlightAware feeder: Phate4
   Airport: YBHI (Broken Hill)  -31.9383° 141.4722°
   AeroAPI key: stored in GitHub secret FLIGHTAWARE_API_KEY
   Injected at build time via GitHub Action into data/adsb-config.js
═══════════════════════════════════════════════════════ */

const ADSB = {
  YBHI_LAT:   -31.9383,
  YBHI_LON:    141.4722,
  RADIUS_NM:   300,
  USERNAME:   'Phate4',
  AEROAPI:    'https://aeroapi.flightaware.com/aeroapi',
  STATS_URL:  'https://flightaware.com/adsb/stats/user/Phate4',
  REFRESH_MS:  60000,
  RADAR_FPS:   30,

  // Injected by GitHub Action — never hardcoded here
  get apiKey() {
    return window.FLIGHTAWARE_API_KEY || '';
  },
};

/* ── BEARING / DISTANCE ─────────────────────────────── */
function toRad(d) { return d * Math.PI / 180; }

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // nm
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
  return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
}

/* ── AEROAPI FETCH ──────────────────────────────────── */
async function aeroFetch(path) {
  if (!ADSB.apiKey) {
    console.warn('ADS-B: No API key. Add FLIGHTAWARE_API_KEY to GitHub secrets.');
    return null;
  }
  try {
    const r = await fetch(ADSB.AEROAPI + path, {
      headers: { 'x-apikey': ADSB.apiKey }
    });
    if (!r.ok) { console.warn('AeroAPI', r.status, path); return null; }
    return await r.json();
  } catch(e) {
    console.warn('AeroAPI fetch failed:', e.message);
    return null;
  }
}

/* ── LIVE AIRCRAFT IN YBHI AIRSPACE ─────────────────── */
async function fetchAircraft() {
  // Search within ~300nm radius of YBHI
  const data = await aeroFetch(
    `/flights/search?query=-latlong "${ADSB.YBHI_LAT-2.5} ${ADSB.YBHI_LON-2.5} ${ADSB.YBHI_LAT+2.5} ${ADSB.YBHI_LON+2.5}"&max_count=50`
  );
  if (!data) return [];

  return (data.flights || []).map(f => {
    const lat = f.last_position?.latitude  ?? null;
    const lon = f.last_position?.longitude ?? null;
    const dist = (lat && lon) ? haversineNm(ADSB.YBHI_LAT, ADSB.YBHI_LON, lat, lon) : 999;
    return {
      id:      f.ident || f.fa_flight_id,
      type:    f.aircraft_type || '?',
      reg:     f.registration || '',
      orig:    f.origin?.code_iata || f.origin?.code_icao || '?',
      dest:    f.destination?.code_iata || f.destination?.code_icao || '?',
      alt:     f.last_position?.altitude ?? 0,
      spd:     f.last_position?.groundspeed ?? 0,
      hdg:     f.last_position?.heading ?? 0,
      lat,
      lon,
      dist:    Math.round(dist),
      status:  f.status || '',
      eta:     f.estimated_on || f.scheduled_on || '',
      etd:     f.estimated_off || f.scheduled_off || '',
    };
  }).filter(f => f.lat !== null && f.dist < ADSB.RADIUS_NM)
    .sort((a,b) => a.dist - b.dist);
}

/* ── YBHI ARRIVALS + DEPARTURES ─────────────────────── */
async function fetchYBHI() {
  const [arr, dep] = await Promise.all([
    aeroFetch('/airports/YBHI/flights/arrivals?type=General_Aviation&max_count=10'),
    aeroFetch('/airports/YBHI/flights/departures?type=General_Aviation&max_count=10'),
  ]);

  const arrivals   = (arr?.arrivals   || []).map(f => ({ ...f, _dir: 'arr' }));
  const departures = (dep?.departures || []).map(f => ({ ...f, _dir: 'dep' }));

  return [...arrivals, ...departures].sort((a,b) => {
    const ta = a.estimated_on || a.scheduled_on || a.estimated_off || '';
    const tb = b.estimated_on || b.scheduled_on || b.estimated_off || '';
    return ta.localeCompare(tb);
  });
}

/* ── FEEDER STATS (scraped from public page) ─────────── */
async function fetchFeederStats() {
  // FlightAware public stats — CORS allows this from browser
  try {
    const r = await fetch(`https://flightaware.com/adsb/stats/user/${ADSB.USERNAME}`, {
      headers: { 'Accept': 'text/html' }
    });
    if (!r.ok) return null;
    const html = await r.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    function extractStat(label) {
      const els = doc.querySelectorAll('.statLabel, .stat-label, [class*="label"]');
      for (const el of els) {
        if (el.textContent.toLowerCase().includes(label.toLowerCase())) {
          const val = el.nextElementSibling || el.parentElement?.querySelector('[class*="value"], .statValue');
          if (val) return val.textContent.trim();
        }
      }
      // Fallback: find in all text
      const match = html.match(new RegExp(label + '[^\\d]*(\\d[\\d,\\.]+)', 'i'));
      return match ? match[1] : null;
    }

    return {
      positions:  extractStat('positions') || extractStat('position'),
      aircraft:   extractStat('aircraft'),
      range:      extractStat('range') || extractStat('max range'),
      uptime:     extractStat('uptime'),
      rank:       extractStat('rank'),
    };
  } catch(e) {
    console.warn('Feeder stats scrape failed:', e.message);
    return null;
  }
}

/* ── FORMAT HELPERS ─────────────────────────────────── */
function fmtAlt(ft) {
  if (!ft) return '—';
  return ft >= 1000 ? `FL${Math.round(ft/100)}` : `${Math.round(ft)} ft`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Broken_Hill',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch { return '—'; }
}

function statusBadge(dir, status) {
  if (dir === 'arr') return '<span style="background:rgba(42,90,58,0.3);color:#4A9A64;font-family:var(--font-mono);font-size:0.6rem;padding:2px 6px;border-radius:10px;font-weight:500">ARR</span>';
  if (dir === 'dep') return '<span style="background:rgba(42,74,110,0.3);color:#5080B8;font-family:var(--font-mono);font-size:0.6rem;padding:2px 6px;border-radius:10px;font-weight:500">DEP</span>';
  return '<span style="background:rgba(196,122,24,0.25);color:var(--ochre-light);font-family:var(--font-mono);font-size:0.6rem;padding:2px 6px;border-radius:10px;font-weight:500">ENRTE</span>';
}

/* ── UPDATE UI ───────────────────────────────────────── */
function setEl(id, val) { const e = document.getElementById(id); if(e) e.textContent = val; }

function updateStats(stats, aircraft) {
  if (aircraft) {
    setEl('a-aircraft', aircraft.length);
    setEl('a-aircraft-sub', `Within ${ADSB.RADIUS_NM}nm of YBHI`);
    setEl('radar-count', `${aircraft.length} aircraft`);
  }
  if (stats) {
    if (stats.positions) { setEl('a-positions', stats.positions); setEl('a-pos-sub', 'FlightAware feeder'); }
    if (stats.range)     { setEl('a-range', stats.range + ' nm'); }
    if (stats.uptime)    { setEl('a-uptime', stats.uptime); }
    if (stats.rank)      { setEl('a-rank', '#' + stats.rank); }
    if (stats.aircraft)  { setEl('a-seen', stats.aircraft); setEl('a-seen-sub', 'last 24 hours'); }
  }
}

function updateFIDS(flights) {
  const el = document.getElementById('fids-rows');
  if (!el) return;
  if (!flights.length) {
    el.innerHTML = '<div style="padding:1.5rem;text-align:center;font-size:0.8rem;color:var(--dust-light)">No scheduled movements · YBHI is quiet</div>';
    return;
  }
  el.innerHTML = flights.slice(0,12).map(f => {
    const dir  = f._dir;
    const orig = f.origin?.code_iata      || f.origin?.code_icao      || '?';
    const dest = f.destination?.code_iata || f.destination?.code_icao || '?';
    const route = dir === 'arr' ? `${orig} → YBHI` : `YBHI → ${dest}`;
    const eta   = dir === 'arr' ? fmtTime(f.estimated_on  || f.scheduled_on)
                               : fmtTime(f.estimated_off || f.scheduled_off);
    const alt   = f.last_position?.altitude ? fmtAlt(f.last_position.altitude) : '—';
    return `
      <div style="display:grid;grid-template-columns:50px 1fr 68px 56px 52px;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.7rem;color:var(--dust-light);display:flex;align-items:center">${f.aircraft_type || '—'}</div>
        <div style="padding:8px 10px;display:flex;flex-direction:column;justify-content:center;gap:2px">
          <div style="font-size:0.83rem;font-weight:500;color:var(--parch)">${f.ident || '—'}</div>
          <div style="font-size:0.72rem;color:var(--dust-light)">${route}</div>
        </div>
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.72rem;color:var(--parch);display:flex;align-items:center">${eta}</div>
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.7rem;color:var(--dust-light);display:flex;align-items:center">${alt}</div>
        <div style="padding:8px 10px;display:flex;align-items:center">${statusBadge(dir, f.status)}</div>
      </div>`;
  }).join('');
  setEl('fids-updated', 'Updated ' + new Date().toLocaleTimeString('en-AU',{timeZone:'Australia/Broken_Hill',hour:'2-digit',minute:'2-digit',hour12:false}) + ' ACST');
}

/* ── RADAR CANVAS ────────────────────────────────────── */
let radarTick = 0;
let liveAircraft = [];
let radarRAF = null;

function drawRadar() {
  const canvas = document.getElementById('adsb-radar');
  if (!canvas) return;
  const W = canvas.offsetWidth;
  if (!W) return;
  if (canvas.width !== W) canvas.width = W;
  const H = Math.min(W, 380);
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const cx = W/2, cy = H/2;
  const PX_PER_NM = (Math.min(W,H)/2 - 20) / 300;

  ctx.fillStyle = '#050809';
  ctx.fillRect(0,0,W,H);

  // Rings at 100, 200, 300 nm
  [100,200,300].forEach((nm,i) => {
    const r = nm * PX_PER_NM;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(0,200,80,${0.1-i*0.02})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,180,70,0.35)';
    ctx.font = '8px DM Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${nm}nm`, cx + r + 2, cy - 2);
  });

  // Station range ring (use stored or default 250nm)
  const stationRange = 250;
  ctx.beginPath();
  ctx.arc(cx, cy, stationRange * PX_PER_NM, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,165,40,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5,5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosshairs
  ctx.strokeStyle = 'rgba(0,180,70,0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx,4); ctx.lineTo(cx,H-4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,cy); ctx.lineTo(W-4,cy); ctx.stroke();

  // Sweep
  const sweepAngle = (radarTick * (2*Math.PI/180)) % (2*Math.PI);
  ctx.beginPath();
  ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,300*PX_PER_NM, sweepAngle-0.5, sweepAngle);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,200,80,0.06)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx,cy);
  ctx.lineTo(cx + Math.cos(sweepAngle)*300*PX_PER_NM, cy + Math.sin(sweepAngle)*300*PX_PER_NM);
  ctx.strokeStyle = 'rgba(0,220,80,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // YBHI centre
  ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
  ctx.fillStyle = '#00c850'; ctx.fill();
  ctx.fillStyle = 'rgba(0,200,80,0.6)';
  ctx.font = '9px DM Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('YBHI', cx, cy+16);

  // Aircraft blips
  liveAircraft.forEach(ac => {
    if (!ac.lat || !ac.lon) return;
    const nm_x = (ac.lon - ADSB.YBHI_LON) * 54.0;
    const nm_y = (ac.lat - ADSB.YBHI_LAT) * -60.1;
    const px = cx + nm_x * PX_PER_NM;
    const py = cy + nm_y * PX_PER_NM;
    if (px < 5 || px > W-5 || py < 5 || py > H-5) return;

    const wobX = px + Math.sin(radarTick*0.04 + ac.lat*8) * 0.5;
    const wobY = py + Math.cos(radarTick*0.04 + ac.lon*8) * 0.5;

    // Colour by altitude
    const col = ac.alt > 30000 ? '#ffd966'
              : ac.alt > 15000 ? '#4fb8ff'
              : ac.alt > 5000  ? '#7fff6a'
              :                   '#c4a0ff';

    // Heading tick
    if (ac.hdg) {
      const hRad = (ac.hdg - 90) * Math.PI/180;
      ctx.beginPath();
      ctx.moveTo(wobX, wobY);
      ctx.lineTo(wobX + Math.cos(hRad)*10, wobY + Math.sin(hRad)*10);
      ctx.strokeStyle = col + 'aa';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Blip glow
    ctx.beginPath(); ctx.arc(wobX, wobY, 6, 0, Math.PI*2);
    ctx.fillStyle = col + '18'; ctx.fill();
    ctx.beginPath(); ctx.arc(wobX, wobY, 3, 0, Math.PI*2);
    ctx.fillStyle = col; ctx.fill();

    // Label
    ctx.fillStyle = col;
    ctx.font = '8px DM Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(ac.id, wobX+5, wobY-3);
    ctx.fillStyle = 'rgba(180,220,180,0.45)';
    ctx.font = '7px DM Mono, monospace';
    ctx.fillText(fmtAlt(ac.alt), wobX+5, wobY+6);
  });

  // Legend bottom-left
  const leg = [{col:'#ffd966',lbl:'>FL300'},{col:'#4fb8ff',lbl:'FL150-300'},{col:'#7fff6a',lbl:'FL50-150'},{col:'#c4a0ff',lbl:'<FL50'}];
  ctx.font = '8px DM Mono, monospace';
  let lx = 8;
  leg.forEach(l => {
    ctx.beginPath(); ctx.arc(lx+3, H-10, 3, 0, Math.PI*2); ctx.fillStyle = l.col; ctx.fill();
    ctx.fillStyle = 'rgba(180,200,180,0.55)'; ctx.textAlign = 'left';
    ctx.fillText(l.lbl, lx+9, H-7);
    lx += 62;
  });

  radarTick++;
}

function startRadar() {
  if (radarRAF) cancelAnimationFrame(radarRAF);
  function loop() { drawRadar(); radarRAF = requestAnimationFrame(loop); }
  loop();
}

/* ── POSITION HISTORY CHART ─────────────────────────── */
function buildHistChart(histData) {
  const el = document.getElementById('pos-history');
  if (!el || !histData.length) return;
  const max = Math.max(...histData.map(d=>d.count));
  el.innerHTML = histData.map(d => {
    const pct = Math.round(d.count/max*100);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
        <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dust);width:55px;flex-shrink:0">${d.date}</div>
        <div style="flex:1;height:4px;background:var(--ink);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--slate-light);border-radius:2px"></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--dust-light);min-width:38px;text-align:right">${Math.round(d.count/1000)}k</div>
      </div>`;
  }).join('');
}

/* ── BEST CATCHES ────────────────────────────────────── */
function buildBestCatches(aircraft) {
  const el = document.getElementById('best-catches');
  if (!el) return;

  // Rank by distance from YBHI (furthest = best catch for range)
  // + flag interesting types
  const interesting = aircraft
    .filter(ac => ac.dist > 0)
    .sort((a,b) => b.dist - a.dist)
    .slice(0, 6);

  if (!interesting.length) {
    el.innerHTML = '<div style="color:var(--dust-light);font-size:0.8rem;grid-column:1/-1;padding:0.5rem">No aircraft data yet — loading...</div>';
    return;
  }

  const rare = ['B789','B77W','B77F','B744','A380','A359','C17','AP3','B788','A35K'];
  el.innerHTML = interesting.map(ac => {
    const isRare = rare.includes(ac.type);
    const badgeStyle = isRare
      ? 'background:rgba(212,83,126,0.2);color:#D4537E;border:1px solid rgba(212,83,126,0.3)'
      : 'background:rgba(42,74,110,0.2);color:var(--slate-light);border:1px solid rgba(42,74,110,0.3)';
    return `
      <div style="background:var(--ink);border-radius:6px;padding:0.75rem;border:1px solid rgba(255,255,255,0.05)">
        <div style="font-size:0.95rem;font-weight:500;color:var(--parch);margin-bottom:2px">${ac.id}</div>
        <div style="font-size:0.72rem;color:var(--dust-light);margin-bottom:6px">${ac.reg || ac.type}</div>
        <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dust-light);line-height:1.7">
          ${ac.orig} → ${ac.dest}<br>
          ${fmtAlt(ac.alt)} · ${Math.round(ac.spd)} kt<br>
          ${ac.dist} nm from YBHI
        </div>
        <div style="display:inline-block;margin-top:5px;font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:500;${badgeStyle}">
          ${isRare ? 'Rare type' : 'Caught today'}
        </div>
      </div>`;
  }).join('');
}

/* ── LOADING STATE ───────────────────────────────────── */
function showLoading(pct) {
  const bar = document.getElementById('load-bar');
  if (bar) bar.style.width = pct + '%';
}

function hideLoading() {
  const loading = document.getElementById('adsb-loading');
  const main    = document.getElementById('adsb-main');
  const lower   = document.getElementById('adsb-lower');
  if (loading) loading.style.display = 'none';
  if (main)    main.style.display    = 'grid';
  if (lower)   lower.style.display   = 'grid';
}

/* ── MAIN REFRESH LOOP ───────────────────────────────── */
async function refreshADSB() {
  showLoading(20);

  const [aircraft, flights, stats] = await Promise.all([
    fetchAircraft(),
    fetchYBHI(),
    fetchFeederStats(),
  ]);

  showLoading(80);
  liveAircraft = aircraft;

  updateStats(stats, aircraft);
  updateFIDS(flights);
  buildBestCatches(aircraft);

  // Mock position history until FlightAware exposes it via API
  // In production replace with real feeder history data
  const mockHist = Array.from({length:14},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-i);
    return {
      date: d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}),
      count: 40000 + Math.round(Math.random()*15000),
    };
  }).reverse();
  buildHistChart(mockHist);

  showLoading(100);
  hideLoading();
  startRadar();

  console.log(`ADS-B: ${aircraft.length} aircraft, ${flights.length} YBHI movements`);
}

/* ── INIT ────────────────────────────────────────────── */
function initADSB() {
  // Only run when section is visible
  const section = document.getElementById('s-adsb');
  if (!section) return;

  refreshADSB();
  setInterval(refreshADSB, ADSB.REFRESH_MS);
}

// Called by main.js showSection()
window.initADSB = initADSB;
