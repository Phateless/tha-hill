'use strict';

/* ═══════════════════════════════════════════════════════
   THA HILL — adsb.js  v2
   FlightAware feeder : Phate4  (your station)
   Network coverage   : All FlightAware feeders globally
   Airport            : YBHI  -31.9383° 141.4722°
   Map scale          : 700nm radius — ADL/MEL/MLD/SYD all visible
   AeroAPI key        : window.FLIGHTAWARE_API_KEY (injected at deploy)
═══════════════════════════════════════════════════════ */

const ADSB = {
  /* ── Centre ── */
  BH_LAT:  -31.9383,
  BH_LON:   141.4722,

  /* ── Map ── */
  MAP_RADIUS_NM: 700,   // ADL ~330nm, MEL ~510nm, MLD ~160nm, SYD ~730nm (just clipped)

  /* ── Coverage ── */
  SEARCH_DEG: 6.0,      // ±6° lat/lon search box from BH centre (~700nm box)

  /* ── Your station ── */
  PHATE4_RANGE_NM: 250, // approximate — orange ring on radar

  /* ── Refresh ── */
  REFRESH_MS: 300000,   // 5 min — stays within FA free tier (1000 calls/month)

  get apiKey() { return window.FLIGHTAWARE_API_KEY || ''; },
};

/* ── Cities & airports to mark on radar ─────────────── */
const CITY_MARKERS = [
  { name: 'Adelaide',  lat: -34.93, lon: 138.60, icao: 'YPAD', col: '#5080B8' },
  { name: 'Melbourne', lat: -37.81, lon: 144.96, icao: 'YMML', col: '#4A9A64' },
  { name: 'Mildura',   lat: -34.18, lon: 142.15, icao: 'YMIA', col: '#E08C24' },
  { name: 'Sydney',    lat: -33.87, lon: 151.21, icao: 'YSSY', col: '#7F77DD' },
];

/* ── Rough air corridors for the radar ──────────────── */
const CORRIDORS = [
  { from: { lat: ADSB.BH_LAT, lon: ADSB.BH_LON }, to: { lat: -34.93, lon: 138.60 }, label: 'BH–ADL' },
  { from: { lat: ADSB.BH_LAT, lon: ADSB.BH_LON }, to: { lat: -37.81, lon: 144.96 }, label: 'BH–MEL' },
  { from: { lat: ADSB.BH_LAT, lon: ADSB.BH_LON }, to: { lat: -34.18, lon: 142.15 }, label: 'BH–MLD' },
  { from: { lat: -34.93, lon: 138.60 },            to: { lat: -33.87, lon: 151.21 }, label: 'ADL–SYD overfly' },
  { from: { lat: -37.81, lon: 144.96 },            to: { lat: -33.87, lon: 151.21 }, label: 'MEL–SYD overfly' },
];

/* ── Maths ───────────────────────────────────────────── */
function toRad(d) { return d * Math.PI / 180; }

function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Equirectangular project onto canvas ─────────────── */
function project(canvas, lat, lon) {
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const scale = Math.min(W,H)/2 / ADSB.MAP_RADIUS_NM;
  const nx = (lon - ADSB.BH_LON) * 54.0;   // rough nm east
  const ny = (lat - ADSB.BH_LAT) * -60.1;   // rough nm north
  return { x: cx + nx*scale, y: cy + ny*scale };
}

/* ── AeroAPI fetch ───────────────────────────────────── */
async function aeroFetch(path) {
  if (!ADSB.apiKey) { console.warn('ADS-B: no API key'); return null; }
  try {
    const r = await fetch('https://aeroapi.flightaware.com/aeroapi' + path, {
      headers: { 'x-apikey': ADSB.apiKey }
    });
    if (!r.ok) { console.warn('AeroAPI', r.status, path); return null; }
    return await r.json();
  } catch(e) { console.warn('AeroAPI failed:', e.message); return null; }
}

/* ── Fetch all aircraft in the BH region ────────────── */
async function fetchRegionAircraft() {
  const latMin = ADSB.BH_LAT - ADSB.SEARCH_DEG;
  const latMax = ADSB.BH_LAT + ADSB.SEARCH_DEG;
  const lonMin = ADSB.BH_LON - ADSB.SEARCH_DEG;
  const lonMax = ADSB.BH_LON + ADSB.SEARCH_DEG;

  // AeroAPI search/flights endpoint with bounding box
  const data = await aeroFetch(
    `/flights/search?query=-latlong "${latMin} ${lonMin} ${latMax} ${lonMax}"&max_count=80`
  );
  if (!data) return [];

  return (data.flights || []).map(f => ({
    id:     f.ident || f.fa_flight_id || '?',
    type:   f.aircraft_type || '?',
    reg:    f.registration || '',
    orig:   f.origin?.code_iata      || f.origin?.code_icao      || '?',
    dest:   f.destination?.code_iata || f.destination?.code_icao || '?',
    lat:    f.last_position?.latitude  ?? null,
    lon:    f.last_position?.longitude ?? null,
    alt:    f.last_position?.altitude  ?? 0,
    spd:    f.last_position?.groundspeed ?? 0,
    hdg:    f.last_position?.heading   ?? 0,
    status: f.status || 'En route',
    eta:    f.estimated_on  || f.scheduled_on  || '',
    etd:    f.estimated_off || f.scheduled_off || '',
    dist:   0,
  })).filter(f => f.lat !== null).map(f => ({
    ...f,
    dist: Math.round(haversineNm(ADSB.BH_LAT, ADSB.BH_LON, f.lat, f.lon)),
  })).sort((a,b) => a.dist - b.dist);
}

/* ── YBHI arrivals + departures ──────────────────────── */
async function fetchYBHI() {
  const [arrData, depData] = await Promise.all([
    aeroFetch('/airports/YBHI/flights/arrivals?max_count=8'),
    aeroFetch('/airports/YBHI/flights/departures?max_count=8'),
  ]);
  const arr = (arrData?.arrivals   || []).map(f => ({ ...f, _dir: 'arr' }));
  const dep = (depData?.departures || []).map(f => ({ ...f, _dir: 'dep' }));
  return [...arr, ...dep].sort((a,b) => {
    const ta = a.estimated_on || a.scheduled_on || a.estimated_off || '';
    const tb = b.estimated_on || b.scheduled_on || b.estimated_off || '';
    return ta.localeCompare(tb);
  });
}

/* ── Format helpers ──────────────────────────────────── */
function fmtAlt(ft) {
  if (!ft || ft === 0) return '—';
  return ft >= 10000 ? `FL${Math.round(ft/100)}` : `${ft.toLocaleString()}ft`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Broken_Hill',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return '—'; }
}

function altColour(ft) {
  if (ft > 35000) return '#ffd966';
  if (ft > 20000) return '#4fb8ff';
  if (ft >  8000) return '#7fff6a';
  return '#c4a0ff';
}

function statusBadge(dir) {
  if (dir === 'arr') return '<span style="background:rgba(42,90,58,0.3);color:#4A9A64;font-family:var(--font-mono);font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:500">ARR</span>';
  if (dir === 'dep') return '<span style="background:rgba(42,74,110,0.3);color:#5080B8;font-family:var(--font-mono);font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:500">DEP</span>';
  return '<span style="background:rgba(196,122,24,0.25);color:var(--ochre-light);font-family:var(--font-mono);font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:500">ENRTE</span>';
}

/* ── DOM helpers ─────────────────────────────────────── */
function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

/* ── Update stat boxes ───────────────────────────────── */
function updateStats(aircraft, flights) {
  setEl('a-aircraft', aircraft.length);
  setEl('a-aircraft-sub', `In ${ADSB.MAP_RADIUS_NM}nm of YBHI · FlightAware network`);
  setEl('radar-count', `${aircraft.length} aircraft`);

  const ybhi  = aircraft.filter(a => a.dist < 60);
  const maxAlt = aircraft.reduce((m,a) => Math.max(m, a.alt), 0);
  const maxSpd = aircraft.reduce((m,a) => Math.max(m, a.spd), 0);
  setEl('a-overhead', ybhi.length);
  setEl('a-max-alt', fmtAlt(maxAlt));
  setEl('a-max-spd', Math.round(maxSpd) + ' kt');
  setEl('a-arrivals', flights.filter(f=>f._dir==='arr').length);
  setEl('a-departures', flights.filter(f=>f._dir==='dep').length);
}

/* ── FIDS board ──────────────────────────────────────── */
function updateFIDS(flights) {
  const el = document.getElementById('fids-rows');
  if (!el) return;
  if (!flights.length) {
    el.innerHTML = '<div style="padding:1.5rem;text-align:center;font-size:0.8rem;color:var(--dust-light)">No current movements at YBHI</div>';
    return;
  }
  el.innerHTML = flights.slice(0, 14).map(f => {
    const orig  = f.origin?.code_iata      || f.origin?.code_icao      || '?';
    const dest  = f.destination?.code_iata || f.destination?.code_icao || '?';
    const route = f._dir === 'arr' ? `${orig} → YBHI` : `YBHI → ${dest}`;
    const time  = f._dir === 'arr'
      ? fmtTime(f.estimated_on  || f.scheduled_on)
      : fmtTime(f.estimated_off || f.scheduled_off);
    const alt   = f.last_position?.altitude ? fmtAlt(f.last_position.altitude) : '—';
    return `
      <div style="display:grid;grid-template-columns:50px 1fr 68px 56px 52px;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.7rem;color:var(--dust-light);display:flex;align-items:center">${f.aircraft_type || '—'}</div>
        <div style="padding:8px 10px;display:flex;flex-direction:column;justify-content:center;gap:2px">
          <span style="font-size:0.83rem;font-weight:500;color:var(--parch)">${f.ident || '—'}</span>
          <span style="font-size:0.72rem;color:var(--dust-light)">${route}</span>
        </div>
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.72rem;color:var(--parch);display:flex;align-items:center">${time}</div>
        <div style="padding:8px 10px;font-family:var(--font-mono);font-size:0.7rem;color:var(--dust-light);display:flex;align-items:center">${alt}</div>
        <div style="padding:8px 10px;display:flex;align-items:center">${statusBadge(f._dir)}</div>
      </div>`;
  }).join('');

  setEl('fids-updated',
    'Updated ' + new Date().toLocaleTimeString('en-AU',{timeZone:'Australia/Broken_Hill',hour:'2-digit',minute:'2-digit',hour12:false}) + ' ACST'
  );
}

/* ── Overhead list (aircraft within ~60nm of YBHI) ───── */
function updateOverhead(aircraft) {
  const el = document.getElementById('overhead-list');
  if (!el) return;
  const local = aircraft.filter(a => a.dist < 60).slice(0, 8);
  if (!local.length) {
    el.innerHTML = '<div style="font-size:0.78rem;color:var(--dust-light);padding:0.5rem 0">No aircraft within 60nm</div>';
    return;
  }
  el.innerHTML = local.map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-weight:500;font-size:0.83rem;color:var(--parch)">${a.id}</span>
        <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--dust-light)">${a.type}</span>
        <span style="font-size:0.68rem;color:var(--dust-light)">${a.orig}→${a.dest}</span>
      </div>
      <div style="text-align:right;font-family:var(--font-mono);font-size:0.68rem;color:var(--dust-light)">
        ${fmtAlt(a.alt)} · ${Math.round(a.spd)}kt · ${a.dist}nm
      </div>
    </div>`).join('');
}

/* ── Best catches ────────────────────────────────────── */
function updateBestCatches(aircraft) {
  const el = document.getElementById('best-catches');
  if (!el) return;
  const RARE = ['B789','B77W','B77F','B744','A380','A359','C17','AP3','B788','A35K','B748','A225'];
  const sorted = [...aircraft].sort((a,b) => b.dist - a.dist);
  const top = sorted.slice(0, 6);
  if (!top.length) {
    el.innerHTML = '<div style="color:var(--dust-light);font-size:0.8rem;padding:0.5rem">Loading aircraft data...</div>';
    return;
  }
  el.innerHTML = top.map(a => {
    const isRare = RARE.includes(a.type);
    const badgeStyle = isRare
      ? 'background:rgba(212,83,126,0.2);color:#D4537E;border:1px solid rgba(212,83,126,0.3)'
      : 'background:rgba(42,74,110,0.2);color:var(--slate-light);border:1px solid rgba(42,74,110,0.3)';
    return `
      <div style="background:var(--ink);border-radius:6px;padding:0.75rem;border:1px solid rgba(255,255,255,0.05)">
        <div style="font-size:0.95rem;font-weight:500;color:var(--parch);margin-bottom:1px">${a.id}</div>
        <div style="font-size:0.72rem;color:var(--dust-light);margin-bottom:6px">${a.reg || a.type}</div>
        <div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--dust-light);line-height:1.7">
          ${a.orig} → ${a.dest}<br>
          ${fmtAlt(a.alt)} · ${Math.round(a.spd)} kt<br>
          ${a.dist} nm from YBHI
        </div>
        <span style="display:inline-block;margin-top:5px;font-size:0.6rem;padding:2px 7px;border-radius:10px;font-weight:500;${badgeStyle}">
          ${isRare ? 'Rare type' : 'In range today'}
        </span>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   RADAR CANVAS
══════════════════════════════════════════════════════ */
let radarTick  = 0;
let liveAC     = [];
let radarRAF   = null;

function drawRadar() {
  const canvas = document.getElementById('adsb-radar');
  if (!canvas) return;
  const W = canvas.offsetWidth;
  if (!W) return;
  if (canvas.width !== W) canvas.width = W;
  const H = canvas.height = Math.round(W * 0.85);
  const ctx = canvas.getContext('2d');
  const cx = W/2, cy = H/2;
  const scale = Math.min(W,H)/2 / ADSB.MAP_RADIUS_NM;

  ctx.fillStyle = '#04080c';
  ctx.fillRect(0,0,W,H);

  /* ── Range rings ── */
  [200, 400, 600].forEach((nm, i) => {
    const r = nm * scale;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(0,180,70,${0.09-i*0.025})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,160,60,0.3)';
    ctx.font = '8px DM Mono,monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${nm}nm`, cx+r+2, cy-2);
  });

  /* ── Crosshairs ── */
  ctx.strokeStyle = 'rgba(0,160,60,0.08)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx,4); ctx.lineTo(cx,H-4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,cy); ctx.lineTo(W-4,cy); ctx.stroke();

  /* ── Sweep ── */
  const ang = (radarTick * Math.PI/90) % (Math.PI*2);
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.arc(cx,cy,600*scale, ang-0.45, ang);
  ctx.closePath(); ctx.fillStyle='rgba(0,200,70,0.05)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(ang)*600*scale, cy+Math.sin(ang)*600*scale);
  ctx.strokeStyle='rgba(0,220,70,0.45)'; ctx.lineWidth=1.2; ctx.stroke();

  /* ── Air corridors ── */
  CORRIDORS.forEach(c => {
    const p1 = project(canvas, c.from.lat, c.from.lon);
    const p2 = project(canvas, c.to.lat,   c.to.lon);
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.8; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
  });

  /* ── City markers ── */
  CITY_MARKERS.forEach(city => {
    const p = project(canvas, city.lat, city.lon);
    if (p.x<4||p.x>W-4||p.y<4||p.y>H-4) return;
    // Halo
    ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2);
    ctx.fillStyle=city.col+'12'; ctx.fill();
    // Dot
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2);
    ctx.fillStyle=city.col+'88'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2);
    ctx.fillStyle=city.col; ctx.fill();
    // Name
    ctx.fillStyle=city.col; ctx.font='9px DM Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(city.name, p.x, p.y-9);
    const d = Math.round(haversineNm(ADSB.BH_LAT,ADSB.BH_LON,city.lat,city.lon));
    ctx.fillStyle='rgba(160,180,160,0.4)'; ctx.font='7px DM Mono,monospace';
    ctx.fillText(`${city.icao} · ${d}nm`, p.x, p.y+15);
  });

  /* ── Phate4 station range ring ── */
  const stR = ADSB.PHATE4_RANGE_NM * scale;
  ctx.beginPath(); ctx.arc(cx,cy,stR,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,165,40,0.22)'; ctx.lineWidth=1;
  ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,165,40,0.45)'; ctx.font='8px DM Mono,monospace'; ctx.textAlign='right';
  ctx.fillText(`Phate4 ~${ADSB.PHATE4_RANGE_NM}nm`, cx - stR*0.72, cy - stR*0.72 - 2);

  /* ── Aircraft blips ── */
  liveAC.forEach(ac => {
    if (!ac.lat || !ac.lon) return;
    const p = project(canvas, ac.lat, ac.lon);
    if (p.x<4||p.x>W-4||p.y<4||p.y>H-4) return;

    const wobX = p.x + Math.sin(radarTick*0.03+ac.lat*5)*0.4;
    const wobY = p.y + Math.cos(radarTick*0.03+ac.lon*5)*0.4;
    const col  = altColour(ac.alt);

    // Heading tick
    const hRad = (ac.hdg - 90) * Math.PI/180;
    ctx.beginPath(); ctx.moveTo(wobX,wobY);
    ctx.lineTo(wobX+Math.cos(hRad)*9, wobY+Math.sin(hRad)*9);
    ctx.strokeStyle=col+'99'; ctx.lineWidth=1; ctx.stroke();

    // Glow + blip
    ctx.beginPath(); ctx.arc(wobX,wobY,5,0,Math.PI*2);
    ctx.fillStyle=col+'1a'; ctx.fill();
    ctx.beginPath(); ctx.arc(wobX,wobY,2.5,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();

    // Label (only show if not too crowded — show for YBHI-related or close)
    if (ac.dist < 250 || ac.orig === 'BHQ' || ac.dest === 'BHQ') {
      ctx.fillStyle=col; ctx.font='8px DM Mono,monospace'; ctx.textAlign='left';
      ctx.fillText(ac.id, wobX+5, wobY-2);
      ctx.fillStyle='rgba(180,210,180,0.4)'; ctx.font='7px DM Mono,monospace';
      ctx.fillText(fmtAlt(ac.alt), wobX+5, wobY+7);
    }
  });

  /* ── YBHI centre ── */
  ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2);
  ctx.fillStyle='rgba(0,200,70,0.15)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2);
  ctx.fillStyle='#00c850'; ctx.fill();
  ctx.fillStyle='rgba(0,200,70,0.7)'; ctx.font='9px DM Mono,monospace'; ctx.textAlign='center';
  ctx.fillText('YBHI · Broken Hill', cx, cy+17);

  /* ── Legend ── */
  const leg=[{col:'#ffd966',lbl:'>FL350'},{col:'#4fb8ff',lbl:'FL200-350'},{col:'#7fff6a',lbl:'FL80-200'},{col:'#c4a0ff',lbl:'<FL80'}];
  ctx.font='8px DM Mono,monospace'; let lx=8;
  leg.forEach(l => {
    ctx.beginPath(); ctx.arc(lx+3,H-10,3,0,Math.PI*2); ctx.fillStyle=l.col; ctx.fill();
    ctx.fillStyle='rgba(180,200,180,0.5)'; ctx.textAlign='left';
    ctx.fillText(l.lbl, lx+9, H-7); lx+=80;
  });
  ctx.fillStyle='rgba(255,165,40,0.55)';
  ctx.fillText('-- Phate4 range', lx+4, H-7);

  radarTick++;
}

function startRadar() {
  if (radarRAF) cancelAnimationFrame(radarRAF);
  function loop() { drawRadar(); radarRAF = requestAnimationFrame(loop); }
  loop();
}

/* ── Loading state ───────────────────────────────────── */
function showLoading(pct) {
  const b = document.getElementById('load-bar');
  if (b) b.style.width = pct + '%';
}

function hideLoading() {
  const l = document.getElementById('adsb-loading');
  const m = document.getElementById('adsb-main');
  const w = document.getElementById('adsb-lower');
  if (l) l.style.display = 'none';
  if (m) { m.style.display = 'grid'; }
  if (w) { w.style.display = 'grid'; }
}

/* ══════════════════════════════════════════════════════
   MAIN REFRESH
══════════════════════════════════════════════════════ */
async function refreshADSB() {
  showLoading(15);
  const [aircraft, flights] = await Promise.all([
    fetchRegionAircraft(),
    fetchYBHI(),
  ]);
  showLoading(85);

  liveAC = aircraft;

  updateStats(aircraft, flights);
  updateFIDS(flights);
  updateOverhead(aircraft);
  updateBestCatches(aircraft);

  showLoading(100);
  hideLoading();
  startRadar();

  console.log(`ADS-B: ${aircraft.length} aircraft in region, ${flights.length} YBHI movements`);
}

/* ── Init (called by main.js when section opens) ─────── */
function initADSB() {
  const sec = document.getElementById('s-adsb');
  if (!sec) return;
  refreshADSB();
  setInterval(refreshADSB, ADSB.REFRESH_MS);
}

window.initADSB = initADSB;
