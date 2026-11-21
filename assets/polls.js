/* ============================================================
   EDPolls — live opinion polls for the next Slovak parliamentary
   election, read straight from Wikipedia's polling table.
   Works in any page (landing + desk). No dependencies.
   ============================================================ */
(function(g){
"use strict";
const PAGE = 'Opinion_polling_for_the_next_Slovak_parliamentary_election';
const API = 'https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&origin=*&prop=text&disableeditsection=1&redirects=1&page=' + PAGE;
const SOURCE_URL = 'https://en.wikipedia.org/wiki/' + PAGE;
const CK = 'edPolls1', TTL = 3*3600e3;

// column header text -> party slug used by the desk (NRSR 2023 roster)
const COLS = [
  // PS–Demokrati joint list must be matched before the single-party columns
  [/(^|\b)(ps|progressive)\b[^a-z]*(demokrat|democrat|dem\b)|ps\s*[–\-\/+]\s*dem/i, 'ps_demokrati'],
  [/^smer/i, 'smer_sd'], [/^ps$|progressive/i, 'ps'], [/^hlas/i, 'hlas_sd'],
  [/o[ľl]a?no|ordinary/i, 'olano_a_priatelia_ku_a_za_ludi'], [/^kdh|christian dem/i, 'kdh'],
  [/^sas$|freedom/i, 'sas'], [/^sns$|national party/i, 'sns'], [/^republika/i, 'republika'],
  [/hungarian alliance|aliancia|alliance|szövetség/i, 'szovetseg_aliancia'], [/democrats|demokrati/i, 'demokrati'],
  [/we are family|sme rodina/i, 'sme_rodina'], [/[ľl]sns|our slovakia/i, 'lsns']
];
const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

const clean = (s) => (s || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
function parseDate(txt){
  txt = clean(txt);
  const m = /(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?\s+(\d{4})\s*$/.exec(txt);
  if(!m) return null;
  const mo = MONTHS[m[2].slice(0,3).toLowerCase()]; if(mo == null) return null;
  return Date.UTC(+m[3], mo, m[1] ? +m[1] : 15);
}
function num(txt){
  const t = clean(txt).replace(',', '.').replace('%','');
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}
// expand colspan/rowspan into a rectangular grid of cells
function gridOf(rows){
  const grid = [];
  rows.forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.children).forEach(cell => {
      while(grid[r][c] !== undefined) c++;
      const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
      const rs = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10));
      for(let dr=0; dr<rs; dr++) for(let dc=0; dc<cs; dc++){
        (grid[r+dr] = grid[r+dr] || [])[c+dc] = cell;
      }
      c += cs;
    });
  });
  return grid;
}
function headText(cell){
  if(!cell) return '';
  let t = clean(cell.textContent);
  if(!t){ const img = cell.querySelector('img'); if(img) t = clean(img.getAttribute('alt')); }
  if(!t){ const a = cell.querySelector('[title]'); if(a) t = clean(a.getAttribute('title')); }
  return t;
}
function parseHtml(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table.wikitable'));
  for(const table of tables){
    const trs = Array.from(table.querySelectorAll('tr'));
    // header rows = leading rows without any <td>
    let hn = 0; while(hn < trs.length && !trs[hn].querySelector('td')) hn++;
    if(hn === 0 || hn === trs.length) continue;
    const hgrid = gridOf(trs.slice(0, hn));
    const ncol = Math.max.apply(null, hgrid.map(r => r.length));
    const cols = {}; let firmCol = -1, dateCol = -1, sampleCol = -1;
    for(let c=0; c<ncol; c++){
      const txts = hgrid.map(r => headText(r[c])).filter(Boolean);
      const label = txts.join(' ');
      if(/polling|firm|pollster/i.test(label) && firmCol < 0){ firmCol = c; continue; }
      if(/date|fieldwork/i.test(label) && dateCol < 0){ dateCol = c; continue; }
      if(/sample/i.test(label) && sampleCol < 0){ sampleCol = c; continue; }
      for(const t of txts){
        const hit = COLS.find(x => x[0].test(t));
        if(hit){ if(!Object.values(cols).includes(hit[1])) cols[c] = hit[1]; break; }
      }
    }
    if(Object.keys(cols).length < 6 || firmCol < 0 || dateCol < 0) continue;
    const dgrid = gridOf(trs.slice(hn));
    const rows = [];
    dgrid.forEach(cells => {
      if(!cells || cells.length < ncol - 3) return;
      const firm = clean(cells[firmCol] && cells[firmCol].textContent);
      if(!firm || /election|výsledok/i.test(firm)) return;
      const t = parseDate(cells[dateCol] && cells[dateCol].textContent);
      if(t == null) return;
      const v = {}; let n = 0, sum = 0, bad = false;
      Object.keys(cols).forEach(c => {
        const x = num(cells[c] && cells[c].textContent);
        if(x != null){ v[cols[c]] = x; n++; sum += x; if(x > 60) bad = true; }
      });
      if(n < 5 || bad || sum < 50 || sum > 101) return;   // skips seat tables / scenario rows
      rows.push({ firm, dateText: clean(cells[dateCol].textContent), t, n: num(cells[sampleCol] && cells[sampleCol].textContent), v });
    });
    if(rows.length >= 3){
      rows.sort((a,b) => b.t - a.t);
      return rows;
    }
  }
  return null;
}

let mem = null;
function readCache(){
  try{ const c = JSON.parse(localStorage.getItem(CK) || 'null'); return c && c.rows ? c : null; }catch(e){ return null; }
}
async function load(opts){
  opts = opts || {};
  if(mem && !opts.force) return mem;
  const c = readCache();
  if(c && !opts.force && (Date.now() - c.fetched) < TTL){ return mem = Object.assign({ source:'cache' }, c); }
  try{
    const r = await fetch(API);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const html = j && j.parse && j.parse.text;
    const rows = html ? parseHtml(html) : null;
    if(!rows) throw new Error('polling table not found');
    const out = { rows, fetched: Date.now(), source:'live' };
    try{ localStorage.setItem(CK, JSON.stringify({ rows, fetched: out.fetched })); }catch(e){}
    return mem = out;
  }catch(err){
    if(c) return mem = Object.assign({ source:'stale', error:String(err) }, c);
    throw err;
  }
}
// mean of the latest `k` polls that include each party
function average(rows, k){
  const sub = rows.slice(0, k || 6), out = {};
  const slugs = new Set(); sub.forEach(r => Object.keys(r.v).forEach(s => slugs.add(s)));
  slugs.forEach(s => {
    const xs = sub.map(r => r.v[s]).filter(x => x != null);
    if(xs.length) out[s] = xs.reduce((a,b) => a+b, 0) / xs.length;
  });
  return out;
}
function series(rows, slug, k){
  return rows.slice(0, k || 24).filter(r => r.v[slug] != null).reverse().map(r => ({ t:r.t, v:r.v[slug] }));
}

/* ============================================================
   Weighted estimate + cubic (tricube-kernel) smoothing + tracker
   ============================================================ */
const DAY = 864e5;
// PS–Demokrati: if the recent polls list a joint column, fold older PS + Demokrati rows into one bloc so the series are comparable
function prep(rows){
  const coal = rows.slice(0, Math.min(8, rows.length)).some(r => r.v.ps_demokrati != null);
  return rows.map(r => {
    const v = Object.assign({}, r.v);
    if(coal){
      if(v.ps_demokrati == null && (v.ps != null || v.demokrati != null)){ v.ps_demokrati = (v.ps || 0) + (v.demokrati || 0); delete v.ps; delete v.demokrati; }
    } else if(v.ps_demokrati != null){ v.ps = v.ps_demokrati; delete v.ps_demokrati; }
    return Object.assign({}, r, { v });
  });
}
const tricube = (u) => { u = Math.abs(u); return u >= 1 ? 0 : Math.pow(1 - u*u*u, 3); };
// local-linear regression with tricube weights (and sample-size weights), adaptive bandwidth
function smoothAt(pts, t, h0){
  if(!pts.length) return null;
  const d = pts.map(p => Math.abs(p.t - t)).sort((a, b) => a - b);
  const h = Math.max(h0, d[Math.min(6, d.length - 1)] * 1.0001, DAY);
  let S0 = 0, S1 = 0, S2 = 0, T0 = 0, T1 = 0, lo = 1e9, hi = -1e9;
  for(const p of pts){
    const w = tricube((p.t - t) / h) * p.w; if(w <= 0) continue;
    const x = (p.t - t) / DAY;
    S0 += w; S1 += w*x; S2 += w*x*x; T0 += w*p.v; T1 += w*x*p.v;
    if(p.v < lo) lo = p.v; if(p.v > hi) hi = p.v;
  }
  if(S0 <= 0) return null;
  const det = S0*S2 - S1*S1;
  let est = det > 1e-6 * S0 * S0 ? (T0*S2 - T1*S1) / det : T0 / S0;
  return Math.max(lo - 0.5, Math.min(hi + 0.5, est));
}
function trend(rows, o){
  o = o || {};
  const span = o.span || 400, step = o.step || 2, h0 = (o.bandwidth || 60) * DAY;
  const P = prep(rows), lastT = P[0].t, t0 = lastT - span * DAY;
  const slugs = new Set(); P.forEach(r => Object.keys(r.v).forEach(s => slugs.add(s)));
  const pts = {}, dots = {};
  slugs.forEach(s => {
    pts[s] = P.filter(r => r.v[s] != null).map(r => ({ t:r.t, v:r.v[s], w:Math.sqrt(Math.max(300, Math.min(3000, r.n || 1000)) / 1000), firm:r.firm }));
    dots[s] = pts[s].filter(p => p.t >= t0);
  });
  const t = []; for(let x = t0; x < lastT; x += step * DAY) t.push(x); t.push(lastT);
  const series = {}, latest = {}, prev = {};
  slugs.forEach(s => {
    series[s] = t.map(x => smoothAt(pts[s], x, h0));
    latest[s] = series[s][series[s].length - 1];
    prev[s] = smoothAt(pts[s], lastT - 30 * DAY, h0);
  });
  // drop parties that are not in the recent polls at all
  const order = Array.from(slugs).filter(s => latest[s] != null && pts[s].some(p => p.t >= lastT - 120 * DAY)).sort((a, b) => latest[b] - latest[a]);
  return { t, series, dots, latest, prev, order, lastT, t0, coalition: order.includes('ps_demokrati') };
}
function valuesAt(T, time){
  let i = 0; for(let k = 0; k < T.t.length; k++){ if(Math.abs(T.t[k] - time) < Math.abs(T.t[i] - time)) i = k; }
  const out = {}; T.order.forEach(s => { if(T.series[s][i] != null) out[s] = T.series[s][i]; });
  return { i, t:T.t[i], v:out };
}
// legacy-compatible: recency/sample weighted average of the latest polls (used where a quick number is enough)
function wavg(rows, k){
  const P = prep(rows).slice(0, k || 8), out = {}, wsum = {};
  P.forEach((r, i) => { const w = Math.pow(.82, i) * Math.sqrt(Math.max(300, Math.min(3000, r.n || 1000)) / 1000);
    Object.keys(r.v).forEach(s => { out[s] = (out[s] || 0) + r.v[s] * w; wsum[s] = (wsum[s] || 0) + w; }); });
  Object.keys(out).forEach(s => out[s] /= wsum[s]); return out;
}

/* ---------- tracker widget (shared by desk + landing) ---------- */
let cssDone = false;
function trackerCss(){
  if(cssDone) return; cssDone = true;
  const st = document.createElement('style');
  st.textContent = `.edtk{--ink:var(--tk-ink,#1b1f27);--mut:var(--tk-mut,#7b8494);--grid:var(--tk-grid,rgba(120,128,145,.22));font-family:inherit;color:var(--ink)}
  .edtk-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
  .edtk-bar button{font:600 11px 'JetBrains Mono',ui-monospace,monospace;padding:5px 9px;border-radius:8px;border:1px solid var(--grid);background:transparent;color:var(--ink);cursor:pointer;transition:.15s}
  .edtk-bar button:hover{border-color:var(--ink)} .edtk-bar button.on{background:var(--ink);color:var(--tk-bg,#fff);border-color:var(--ink)}
  .edtk-bar .sp{flex:1}
  .edtk-cv{position:relative;width:100%;height:var(--tk-h,260px);touch-action:pan-y}
  .edtk-cv canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
  .edtk-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
  .edtk-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;border:1px solid var(--grid);font-size:11.5px;cursor:pointer;user-select:none;transition:opacity .15s,border-color .15s}
  .edtk-chip i{width:8px;height:8px;border-radius:50%} .edtk-chip b{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;min-width:3.2ch;text-align:right}
  .edtk-chip.off{opacity:.38} .edtk-date{font:600 11px 'JetBrains Mono',ui-monospace,monospace;color:var(--mut);margin-left:6px}
  .edtk-note{font-size:10.5px;color:var(--mut);margin-top:8px;line-height:1.45}`;
  document.head.appendChild(st);
}
function mountTracker(el, o){
  trackerCss();
  const TXT = (sk, en) => (o.lang && o.lang() === 'en') ? en : sk;
  const st = { range:180, vis:null, cursor:null, playing:0 };
  let T = null;
  el.classList.add('edtk'); el.innerHTML = '';
  const bar = document.createElement('div'); bar.className = 'edtk-bar';
  const cv = document.createElement('div'); cv.className = 'edtk-cv';
  const canvas = document.createElement('canvas'); cv.appendChild(canvas);
  const chips = document.createElement('div'); chips.className = 'edtk-chips';
  const note = document.createElement('div'); note.className = 'edtk-note';
  el.append(bar, cv, chips, note);
  const ctx = canvas.getContext('2d');

  function build(){
    bar.innerHTML = '';
    [[90,'3M'],[180,'6M'],[365,'1Y']].forEach(([d, l]) => {
      const b = document.createElement('button'); b.textContent = l; b.className = st.range === d ? 'on' : '';
      b.onclick = () => { st.range = d; build(); draw(); }; bar.appendChild(b);
    });
    const play = document.createElement('button'); play.textContent = st.playing ? '❚❚ ' + TXT('Pauza','Pause') : '▶ ' + TXT('Prehrať','Replay');
    play.onclick = () => togglePlay(); bar.appendChild(play);
    const date = document.createElement('span'); date.className = 'edtk-date'; bar.appendChild(date); st._date = date;
    const sp = document.createElement('span'); sp.className = 'sp'; bar.appendChild(sp);
    if(o.onApply){
      const ap = document.createElement('button'); ap.textContent = TXT('Použiť tento dátum v simulátore','Apply this date in simulator');
      ap.onclick = () => { const x = valuesAt(T, st.cursor == null ? T.lastT : st.cursor); o.onApply(x.v, x.t, T); }; bar.appendChild(ap);
    }
    note.textContent = TXT(
      'Čiara = vyhladený trend (lokálna regresia s tricube jadrom, 60-dňové okno, váha podľa veľkosti vzorky). Body = jednotlivé prieskumy.',
      'Line = smoothed trend (local regression, tricube kernel, 60-day window, weighted by sample size). Dots = individual polls.');
    chipsRender();
  }
  function togglePlay(){
    if(st.playing){ cancelAnimationFrame(st.playing); st.playing = 0; build(); return; }
    const t0 = T.lastT - st.range * DAY, dur = 7000, start = performance.now();
    const step = (now) => {
      const f = Math.min(1, (now - start) / dur); st.cursor = t0 + (T.lastT - t0) * f; draw();
      if(f < 1) st.playing = requestAnimationFrame(step); else { st.playing = 0; st.cursor = null; build(); draw(); }
    };
    st.playing = requestAnimationFrame(step); build();
  }
  function chipsRender(){
    chips.innerHTML = '';
    const cur = valuesAt(T, st.cursor == null ? T.lastT : st.cursor).v;
    T.order.slice().sort((a, b) => (cur[b] || 0) - (cur[a] || 0)).forEach(s => {
      const c = document.createElement('span'); c.className = 'edtk-chip' + (st.vis.has(s) ? '' : ' off'); c.dataset.s = s;
      c.innerHTML = `<i style="background:${o.colorOf(s)}"></i>${o.nameOf(s)} <b>${cur[s] != null ? cur[s].toFixed(1) : '–'}</b>`;
      c.onclick = () => { st.vis.has(s) ? st.vis.delete(s) : st.vis.add(s); chipsRender(); draw(); };
      chips.appendChild(c);
    });
  }
  function draw(){
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, r.width), h = Math.max(120, r.height);
    if(canvas.width !== Math.round(w * dpr)){ canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const cs = getComputedStyle(el), ink = cs.getPropertyValue('--ink').trim() || '#222', mut = cs.getPropertyValue('--mut').trim() || '#888', grid = cs.getPropertyValue('--grid').trim() || '#ddd';
    const L = 30, R = 12, Tp = 10, B = 22, pw = w - L - R, ph = h - Tp - B;
    const t1 = T.lastT, t0 = t1 - st.range * DAY;
    let mx = 6; st.vis.forEach(s => T.series[s].forEach((v, i) => { if(v != null && T.t[i] >= t0 && v > mx) mx = v; }));
    mx = Math.ceil(mx / 5) * 5;
    const X = (t) => L + (t - t0) / (t1 - t0) * pw, Y = (v) => Tp + ph - v / mx * ph;
    ctx.font = '10px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
    for(let v = 0; v <= mx; v += 5){ ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke(); ctx.fillStyle = mut; ctx.textAlign = 'right'; ctx.fillText(v + '', L - 6, Y(v)); }
    // 5 % threshold
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#E5534B'; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(L, Y(5)); ctx.lineTo(w - R, Y(5)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    // month ticks
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const d = new Date(t0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const every = st.range > 200 ? 2 : 1; let k = 0;
    for(; d.getTime() < t1; d.setUTCMonth(d.getUTCMonth() + 1), k++){
      if(k % every) continue; const x = X(d.getTime());
      ctx.fillStyle = mut; ctx.fillText(d.toLocaleDateString(TXT('sk-SK','en-GB'), { month:'short', year:'2-digit', timeZone:'UTC' }), x, h - B + 6);
    }
    // dots then lines
    st.vis.forEach(s => { ctx.fillStyle = o.colorOf(s); ctx.globalAlpha = .42; (T.dots[s] || []).forEach(p => { if(p.t < t0) return; ctx.beginPath(); ctx.arc(X(p.t), Y(p.v), 2.2, 0, 7); ctx.fill(); }); });
    ctx.globalAlpha = 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    st.vis.forEach(s => {
      ctx.strokeStyle = o.colorOf(s); ctx.lineWidth = 2.4; ctx.beginPath(); let on = false;
      T.series[s].forEach((v, i) => { if(v == null || T.t[i] < t0) return; const x = X(T.t[i]), y = Y(v); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; });
      ctx.stroke();
    });
    const cur = st.cursor == null ? t1 : st.cursor, cx = X(cur);
    ctx.strokeStyle = ink; ctx.globalAlpha = .55; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, Tp); ctx.lineTo(cx, Tp + ph); ctx.stroke(); ctx.globalAlpha = 1;
    const vv = valuesAt(T, cur);
    st.vis.forEach(s => { const v = vv.v[s]; if(v == null) return; ctx.fillStyle = o.colorOf(s); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, Y(v), 4, 0, 7); ctx.fill(); ctx.stroke(); });
    if(st._date) st._date.textContent = new Date(vv.t).toLocaleDateString(TXT('sk-SK','en-GB'), { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
    st._geo = { L, pw, t0, t1 };
    // refresh the numbers in the chips without rebuilding them
    chips.querySelectorAll('.edtk-chip').forEach(c => { const v = vv.v[c.dataset.s]; c.querySelector('b').textContent = v != null ? v.toFixed(1) : '–'; });
  }
  function at(e){ const r = cv.getBoundingClientRect(), g = st._geo; const x = Math.max(0, Math.min(1, ((e.clientX - r.left) - g.L) / g.pw)); return g.t0 + x * (g.t1 - g.t0); }
  canvas.addEventListener('pointermove', e => { if(st.playing) return; st.cursor = at(e); draw(); });
  canvas.addEventListener('pointerleave', () => { if(st.playing) return; st.cursor = null; draw(); });
  canvas.addEventListener('click', e => { if(!st.playing) { st.cursor = at(e); draw(); } });
  const ro = new ResizeObserver(() => { if(T) draw(); }); ro.observe(cv);
  return {
    set(rows){
      T = trend(rows); const sel = new Set(T.order.slice(0, 6));
      st.vis = (st.vis && st.vis.size) ? new Set(Array.from(st.vis).filter(s => T.order.includes(s))) : sel; if(!st.vis.size) st.vis = sel;
      build(); draw(); return T;
    },
    redraw(){ if(T){ build(); draw(); } },
    trend: () => T
  };
}

g.EDPolls = { load, parseHtml, average, series, SOURCE_URL, COLS, prep, trend, valuesAt, wavg, mountTracker };
})(window);
