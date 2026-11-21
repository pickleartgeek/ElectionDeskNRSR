(function(){
"use strict";
const D = window.EDLanding || [];
const BY = {}; D.forEach(p => BY[p.slug] = p);
const SHORT = {olano_a_priatelia_ku_a_za_ludi:'OĽaNO', szovetseg_aliancia:'Szövetség', sme_rodina:'Sme rodina', demokrati:'Demokrati', lsns:'ĽSNS', republika:'Republika'};
const COAL = 'ps_demokrati';
const nm = s => s === COAL ? 'PS–Demokrati' : (SHORT[s] || (BY[s] ? BY[s].name : s));
const colOf = s => s === COAL ? (BY.ps||{}).color || '#4FC3F7' : (BY[s]||{}).color || '#888';
const $ = (q, r) => (r||document).querySelector(q), $$ = (q, r) => Array.from((r||document).querySelectorAll(q));
let lang = 'sk';
try{ lang = localStorage.getItem('edLang') || ((navigator.language||'').startsWith('sk') ? 'sk' : 'en'); }catch(e){}

/* ---------- i18n ---------- */
function setLang(l){
  lang = l; document.documentElement.lang = l;
  $$('[data-sk]').forEach(el => { el.textContent = el.dataset[l] || el.dataset.sk; });
  $$('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  try{ localStorage.setItem('edLang', l); }catch(e){}
  renderPollMeta(); if(tracker) tracker.redraw();
}
$$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.l)));

/* ---------- nav ---------- */
const nav = $('#nav');
addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 10), {passive:true});

/* ---------- countdown (latest legal date) ---------- */
const END = new Date('2027-09-28T22:00:00+02:00').getTime();
function tick(){
  let d = Math.max(0, END - Date.now());
  const days = Math.floor(d/864e5); d -= days*864e5;
  const h = Math.floor(d/36e5); d -= h*36e5;
  const m = Math.floor(d/6e4); d -= m*6e4;
  $('#cd-d').textContent = days; $('#cd-h').textContent = String(h).padStart(2,'0');
  $('#cd-m').textContent = String(m).padStart(2,'0'); $('#cd-s').textContent = String(Math.floor(d/1e3)).padStart(2,'0');
}
tick(); setInterval(tick, 1000);

/* ---------- hero parallax ---------- */
const hm = $('#heroMap');
if(hm && matchMedia('(hover:hover)').matches){
  hm.parentElement.addEventListener('mousemove', e => {
    const r = hm.getBoundingClientRect(), x = (e.clientX - r.left)/r.width - .5, y = (e.clientY - r.top)/r.height - .5;
    hm.style.transform = `perspective(1100px) rotateY(${x*6}deg) rotateX(${-y*5}deg)`;
  });
  hm.parentElement.addEventListener('mouseleave', () => hm.style.transform = '');
}
if(D[0]) $('#chipWin').textContent = nm(D[0].slug);

/* ---------- seats (D'Hondt) ---------- */
function dhondt(shares, seats, thr){
  const el = Object.keys(shares).filter(s => shares[s] >= thr);
  const tot = el.reduce((a,s) => a + shares[s], 0), out = {}; el.forEach(s => out[s] = 0);
  for(let i=0; i<seats; i++){
    let best = null, bv = -1;
    el.forEach(s => { const q = shares[s]/tot/(out[s]+1); if(q > bv){ bv = q; best = s; } });
    out[best]++;
  }
  return out;
}

/* ---------- polls ---------- */
let pollState = null;
function paintPolls(avg, prev, meta){
  pollState = meta;
  const slugs = Object.keys(avg).sort((a,b) => avg[b]-avg[a]);
  const max = Math.max.apply(null, slugs.map(s => avg[s]));
  $('#pollBars').innerHTML = slugs.map((s,i) => {
    const c = colOf(s), d = prev && prev[s] != null ? avg[s]-prev[s] : null;
    return `<div class="pb" style="--w:${(avg[s]/max*100).toFixed(1)}%;transition-delay:${i*60}ms">
      <div class="fill" style="background:${c};transition-delay:${i*60}ms"></div><span class="dot" style="background:${c}"></span>
      <span class="nm">${nm(s)}</span><span></span><span class="v">${avg[s].toFixed(1)}</span>
      <span class="d ${d==null?'':d>=0?'up':'down'}">${d==null?'':(d>=0?'+':'')+d.toFixed(1)}</span></div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.pb').forEach(el => el.classList.add('in'))));
  const seats = dhondt(avg, 150, 5), ks = Object.keys(seats).sort((a,b) => seats[b]-seats[a]);
  $('#seatBar').innerHTML = ks.map(s => `<i style="background:${colOf(s)}" data-w="${seats[s]/150*100}" title="${nm(s)} ${seats[s]}"></i>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#seatBar i').forEach(i => i.style.width = i.dataset.w + '%')));
  $('#seatLegend').innerHTML = ks.map(s => `<span><i style="background:${colOf(s)}"></i>${nm(s)} <b>${seats[s]}</b></span>`).join('');
  renderPollMeta();
}
function renderPollMeta(){
  const el = $('#pollMeta'); if(!el || !pollState) return;
  const sk = lang === 'sk';
  if(pollState.live){
    const n = pollState.n, d = new Date(pollState.date).toLocaleDateString(sk ? 'sk-SK' : 'en-GB', {day:'numeric', month:'long', year:'numeric'});
    el.textContent = sk ? `Vážený, vyhladený trend z ${n} prieskumov · najnovší z ${d} · zdroj: Wikipédia` : `Weighted, smoothed trend of ${n} polls · latest ${d} · source: Wikipedia`;
  } else {
    el.textContent = sk ? 'Prieskumy sa nepodarilo načítať (offline?) — zobrazené sú výsledky volieb 2023.' : 'Could not load polls (offline?) — showing the 2023 election result instead.';
  }
}
function fallback(){
  const o = {}; D.forEach(p => o[p.slug] = p.pct); paintPolls(o, null, {live:false});
}
let tracker = null;
(async function(){
  if(!window.EDPolls){ fallback(); return; }
  try{
    const r = await EDPolls.load(), rows = r.rows, TR = EDPolls.trend(rows);
    const norm = (o) => { const ks = TR.order.filter(s => o[s] != null), tot = ks.reduce((a,s) => a + o[s], 0) || 1, out = {}; ks.forEach(s => out[s] = o[s]/tot*100); return out; };
    const avg = norm(TR.latest), pv = norm(TR.prev);
    paintPolls(avg, pv, {live:true, n:rows.length, date:rows[0].t});
    const tk = $('#pollTracker');
    if(tk){
      tracker = EDPolls.mountTracker(tk, { colorOf:colOf, nameOf:nm, lang:() => lang });
      tracker.set(rows);
    }
    const items = rows.slice(0,8).map(x => { const top = Object.keys(x.v).sort((a,b) => x.v[b]-x.v[a]).slice(0,3).map(s => `${nm(s)} ${x.v[s]}`).join(' · '); return `<span>${x.firm}<b>${top}</b></span>`; });
    $('#tickerMove').innerHTML = items.concat(items).join('');
  }catch(e){
    fallback();
    const a = D.slice(0,3).map(p => `${nm(p.slug)} ${p.pct.toFixed(1)}`).join(' · ');
    const t = `<span>NRSR 2023<b>${a}</b></span><span>${lang==='sk'?'Prieskumy nedostupné':'Polls unavailable'}</span>`;
    $('#tickerMove').innerHTML = t + t + t + t;
    const tk = $('#pollTracker'); if(tk) tk.style.display = 'none';
  }
})();

/* ---------- reveal ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), {threshold:.15});
$$('.reveal').forEach(el => io.observe(el));

/* ---------- carousel ---------- */
const car = $('#car'), dots = $('#carDots');
car.innerHTML = D.map((p,i) => `<a class="pc" style="--c:${p.color}" href="desk/index.html" data-i="${i}">
  <span class="rk">${String(i+1).padStart(2,'0')}</span>
  <img loading="lazy" draggable="false" src="assets/maps/${p.slug}.webp" alt="${nm(p.slug)} vote map">
  <div class="in"><h3>${nm(p.slug)}</h3><div class="st"><span><b>${p.pct.toFixed(1)} %</b></span><span><b>${p.seats}</b> ${lang==='sk'?'kresiel':'seats'}</span></div></div></a>`).join('');
dots.innerHTML = D.map((_,i) => `<button aria-label="${i+1}" data-i="${i}"></button>`).join('');
const cards = $$('.pc', car);
function active(){
  const mid = car.scrollLeft + car.clientWidth/2; let bi = 0, bd = 1e9;
  if(car.scrollLeft < 12){ cards.forEach((c,i) => c.classList.toggle('active', i === 0)); $$('button', dots).forEach((b,i) => b.classList.toggle('on', i === 0)); return 0; }
  cards.forEach((c,i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth/2 - mid); if(d < bd){ bd = d; bi = i; } });
  cards.forEach((c,i) => c.classList.toggle('active', i === bi));
  $$('button', dots).forEach((b,i) => b.classList.toggle('on', i === bi));
  return bi;
}
function go(i){ i = Math.max(0, Math.min(cards.length-1, i)); const c = cards[i]; car.scrollTo({left:c.offsetLeft + c.offsetWidth/2 - car.clientWidth/2, behavior:'smooth'}); }
car.addEventListener('scroll', () => requestAnimationFrame(active), {passive:true});
$('#cPrev').onclick = () => go(active()-1); $('#cNext').onclick = () => go(active()+1);
dots.addEventListener('click', e => { const b = e.target.closest('button'); if(b) go(+b.dataset.i); });
car.addEventListener('keydown', e => { if(e.key==='ArrowRight') go(active()+1); if(e.key==='ArrowLeft') go(active()-1); });
// drag to scroll
let down = false, sx = 0, sl = 0, moved = 0;
car.addEventListener('pointerdown', e => { if(e.pointerType!=='mouse') return; down = true; moved = 0; sx = e.clientX; sl = car.scrollLeft; });
addEventListener('pointermove', e => { if(!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if(moved > 5) car.classList.add('drag'); car.scrollLeft = sl - dx; });
addEventListener('pointerup', () => { down = false; car.classList.remove('drag'); });
car.addEventListener('click', e => { if(moved > 5){ e.preventDefault(); moved = 0; } });
active();

setLang(lang);
})();
