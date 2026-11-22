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
  if(lastPaint) paintPolls.apply(null, lastPaint); else renderPollMeta(); if(tracker) tracker.redraw();
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
const LEADER = { smer_sd:'Robert Fico', ps:'Michal Šimečka', ps_demokrati:'Michal Šimečka', hlas_sd:'Matúš Šutaj Eštok', olano_a_priatelia_ku_a_za_ludi:'Igor Matovič',
  sas:'Branislav Gröhling', sns:'Andrej Danko', republika:'Milan Uhrík', sme_rodina:'Boris Kollár', lsns:'Marian Kotleba', szovetseg_aliancia:'Krisztián Forró', demokrati:'Eduard Heger', kdh:'Milan Majerský' };
const PHOTO = {}, LOGO = {};
const WTS = { smer_sd:['Direction – Social Democracy','Smer–SD'], ps:['Progressive Slovakia'], ps_demokrati:['Progressive Slovakia'], hlas_sd:['Voice – Social Democracy','Hlas–SD'], olano_a_priatelia_ku_a_za_ludi:['Ordinary People and Independent Personalities','OĽaNO'],
  kdh:['Christian Democratic Movement','Christian Democratic Movement (Slovakia)','Kresťanskodemokratické hnutie'], sas:['Freedom and Solidarity'], sns:['Slovak National Party'],
  republika:['Republika Movement','Republika (political party)','Republika (Slovak political party)','Hnutie Republika'], szovetseg_aliancia:['Hungarian Alliance (Slovak political party)','Alliance (Slovak political party)'],
  sme_rodina:['We Are Family (Slovakia)','We Are Family (political party)','Sme rodina'], lsns:['People\'s Party Our Slovakia','Kotleba – People\'s Party Our Slovakia'], demokrati:['Democrats (Slovak political party)','Democrats (Slovakia)'] };
const WT = {}; Object.keys(WTS).forEach(k => WT[k] = WTS[k][0]);
async function loadLogos(slugs){
  const want = slugs.filter(sl => WTS[sl] && !(sl in LOGO)); if(!want.length) return;
  want.forEach(sl => LOGO[sl] = null);
  const titles = Array.from(new Set([].concat.apply([], want.map(sl => WTS[sl]))));
  try{
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=pageprops|pageimages&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=300&pilicense=any&redirects=1&titles=' + encodeURIComponent(titles.join('|')));
    const j = await r.json(), q = j.query || {}, nm = {}, rd = {}, by = {};
    (q.normalized||[]).forEach(x => nm[x.from] = x.to); (q.redirects||[]).forEach(x => rd[x.from] = x.to); (q.pages||[]).forEach(p => by[p.title] = p);
    const pageOf = t => { let n = nm[t] || t; n = rd[n] || n; return by[n]; };
    const noImg = [];
    want.forEach(sl => { for(const t of WTS[sl]){ const p = pageOf(t); if(p && p.thumbnail){ LOGO[sl] = p.thumbnail.source; return; } } noImg.push(sl); });
    // fallback: Wikidata logo for pages that exist but carry no page image
    const ids = {}; noImg.forEach(sl => { for(const t of WTS[sl]){ const p = pageOf(t); if(p && p.pageprops && p.pageprops.wikibase_item){ ids[sl] = p.pageprops.wikibase_item; return; } } });
    const idl = Array.from(new Set(Object.values(ids)));
    if(idl.length){
      const w = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=' + idl.join('|'))).json();
      Object.keys(ids).forEach(sl => { const c = ((w.entities||{})[ids[sl]]||{}).claims || {}; const k = (c.P154 || c.P8972 || [])[0]; const v = k && k.mainsnak && k.mainsnak.datavalue && k.mainsnak.datavalue.value;
        if(v) LOGO[sl] = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(v.replace(/ /g, '_')) + '?width=320'; });
    }
  }catch(e){}
}
const logoOf = s => LOGO[s] || null;
async function loadPhotos(names){
  const need = names.filter(n => !(n in PHOTO)); if(!need.length) return;
  try{
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=240&redirects=1&titles=' + encodeURIComponent(need.join('|')));
    const j = await r.json(), q = j.query || {}, norm = {}, red = {}, by = {};
    (q.normalized||[]).forEach(x => norm[x.from] = x.to); (q.redirects||[]).forEach(x => red[x.from] = x.to); (q.pages||[]).forEach(p => by[p.title] = p);
    need.forEach(n => { let t = norm[n] || n; t = red[t] || t; const p = by[t]; PHOTO[n] = p && p.thumbnail ? p.thumbnail.source : null; });
  }catch(e){ need.forEach(n => PHOTO[n] = null); }
}
let lastPaint = null;
function paintPolls(avg, prev, meta){
  pollState = meta; lastPaint = [avg, prev, meta];
  const slugs = Object.keys(avg).sort((a,b) => avg[b]-avg[a]);
  const max = Math.max.apply(null, slugs.map(s => avg[s]));
  const seats = dhondt(avg, 150, 5), ks = Object.keys(seats).sort((a,b) => seats[b]-seats[a]);
  const dlt = s => { const d = prev && prev[s] != null ? avg[s]-prev[s] : null; return d==null ? '' : `<em class="${d>=0?'up':'down'}">${d>=0?'+':'−'}${Math.abs(d).toFixed(1)}</em>`; };
  const big = slugs.slice(0,3), rest = slugs.slice(3);
  const ofv = lang === 'sk' ? 'HLASOV' : 'OF THE VOTE', st = lang === 'sk' ? 'MANDÁTY' : 'SEATS';
  $('#pollBars').innerHTML = big.map((s,i) => {
    const c = colOf(s), ph = PHOTO[LEADER[s]];
    return `<div class="pcard" style="--c:${c};transition-delay:${i*90}ms"><div class="pc-ph">${ph ? `<img src="${ph}" alt="" loading="lazy">` : `<b>${nm(s).slice(0,2).toUpperCase()}</b>`}</div>
      ${logoOf(s) ? `<img class="pc-wm" src="${logoOf(s)}" alt="" loading="lazy">` : ''}<div class="pc-body"><h4>${nm(s)} ${logoOf(s) ? `<span class="pc-lg"><img src="${logoOf(s)}" alt="" loading="lazy"></span>` : ''} ${dlt(s)}</h4><div class="pc-nums"><div><strong>${seats[s]||0}</strong><small>${st}</small></div><div><strong class="pct">${avg[s].toFixed(1)}%</strong><small>${ofv}</small></div></div></div></div>`;
  }).join('') + rest.map((s,i) => {
    const c = colOf(s), ph = PHOTO[LEADER[s]];
    return `<div class="prow" style="--c:${c};--w:${(avg[s]/max*100).toFixed(1)}%;transition-delay:${(i+3)*60}ms"><span class="pr-ph">${ph ? `<img src="${ph}" alt="" loading="lazy">` : nm(s).slice(0,3).toUpperCase()}</span>
      ${logoOf(s) ? `<img class="pr-wm" src="${logoOf(s)}" alt="" loading="lazy">` : ''}<span class="pr-b"><span class="pr-n">${nm(s)} ${logoOf(s) ? `<span class="pc-lg sm"><img src="${logoOf(s)}" alt="" loading="lazy"></span>` : ''} ${dlt(s)}</span><i class="pr-bar"></i></span><span class="pr-s">${seats[s]||0}<small>${avg[s].toFixed(1)}%</small></span></div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.pcard,.prow').forEach(el => el.classList.add('in'))));
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
    const avg = Object.assign({}, TR.latest), pv = Object.assign({}, TR.prev);
    paintPolls(avg, pv, {live:true, n:rows.length, date:rows[0].t});
    Promise.all([loadPhotos(Array.from(new Set(Object.keys(avg).map(k => LEADER[k]).filter(Boolean)))), loadLogos(Object.keys(avg))]).then(() => paintPolls(avg, pv, {live:true, n:rows.length, date:rows[0].t}));
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
