'use strict';
/* ======================================================================
   Geostat vehicle statistics (automobile.geostat.ge, data service
   autoapi.geostat.ge): first registrations in Georgia by brand, model,
   fuel, body, engine, age, colour and region, the vehicle fleet, vehicle
   imports/exports (new vs used) and fuel prices.
   "table=true" = registered during the period, quarter 99 = whole year.
   ====================================================================== */
const GEO = 'https://autoapi.geostat.ge/mobile/';
const GKEY = 'gcm_geo_v1';
const G_FIRST = 2017;
let geo = {p: {}, trade: null, fleet: null, fuelPrice: null, fleetMix: null, updated: null};
try { const s0 = JSON.parse(localStorage.getItem(GKEY)); if (s0 && s0.p) geo = Object.assign(geo, s0); } catch (e) {}
function gSave() { try { localStorage.setItem(GKEY, JSON.stringify(geo)); } catch (e) {} }
let gBusy = false, gErr = '', gProgress = '';
let gSel = {mode: 'ytd'};
try { const v = JSON.parse(localStorage.getItem('gcm_gperiod')); if (v && v.mode) gSel = v; } catch (e) {}
let gBrand = null, mQuery = '';

async function gGet(path) {
  for (let i = 0; i < 3; i++) {
    const r = await rawGet(GEO + path);
    if (r.code === 200) { await sleep(80); return JSON.parse(r.body); }
    if (r.code === -1 && i === 2) throw new Error('No connection to Geostat');
    if (r.code >= 400 && r.code < 500) throw new Error('Geostat error ' + r.code);
    await sleep(1500);
  }
  throw new Error('Geostat is not responding. Try Refresh later.');
}
function gName(n) { n = String(n == null ? '' : n).trim(); return n === 'დანარჩენი' ? 'Other' : n; }
function lst(j) {
  const a = Array.isArray(j) && j.length && j[0] && Array.isArray(j[0].data) ? j[0].data : j;
  if (!Array.isArray(a)) return [];
  const m = {};
  a.forEach((x) => { if (x && x.name != null) { const k = gName(x.name); m[k] = (m[k] || 0) + (+x.value || 0); } });
  return Object.entries(m);
}
function normTm(tm) {
  const out = {};
  Object.keys(tm || {}).forEach((b) => {
    const bn = gName(b), models = {}, seen = {};
    Object.keys(tm[b] || {}).forEach((m) => {
      let mn = gName(m); const key = canon(mn);
      if (seen[key]) mn = seen[key]; else seen[key] = mn;
      models[mn] = (models[mn] || 0) + (+tm[b][m] || 0);
    });
    if (!out[bn]) out[bn] = {};
    Object.keys(models).forEach((m) => { out[bn][m] = (out[bn][m] || 0) + models[m]; });
  });
  return out;
}
async function gFetchSet(y, q) {
  const qs = 'lang=en&year=' + y + '&quarter=' + q + '&table=true';
  const tm = await gGet('treemap?' + qs);
  if (!tm || typeof tm !== 'object' || !Object.keys(tm).length) return null;
  const o = {tm: normTm(tm)};
  o.fuel = lst(await gGet('fuels?' + qs));
  o.body = lst(await gGet('body?' + qs));
  o.engine = lst(await gGet('engine?' + qs));
  o.age = lst(await gGet('vehicle-age?' + qs));
  o.color = lst(await gGet('colors?' + qs));
  const rm = await gGet('regional-map?' + qs);
  const reg = {};
  (Array.isArray(rm) ? rm : []).forEach((r) => { const n = r.regionCl ? r.regionCl.name : String(r.region); reg[n] = (reg[n] || 0) + (+r.quantity || 0); });
  o.region = Object.entries(reg);
  return o;
}
const G_FUELS = [[1, 'Petrol'], [2, 'Diesel'], [3, 'Electric'], [4, 'Hybrid']];
async function gFetchTrade() {
  const t = {start: null, I: {}, E: {}, all: {}};
  for (const e of ['I', 'E']) {
    for (const [f] of G_FUELS) for (const v of [1, 2]) {
      gProgress = 'Geostat: vehicle ' + (e === 'I' ? 'imports' : 'exports') + '…'; setGStatus();
      const j = await gGet('area-quantity?lang=en&e_i=' + e + '&fuel=' + f + '&vehicle=' + v + '&currency=false&type=1');
      t.start = j.pointStart; t[e][f + '_' + (v === 1 ? 'new' : 'used')] = j.data || [];
    }
    const a = await gGet('area-quantity?lang=en&e_i=' + e + '&fuel=&vehicle=&currency=false&type=3');
    t.all[e] = {start: a.pointStart, data: a.data || []};
  }
  return t;
}
async function geoSync(force) {
  if (gBusy) return;
  const age = geo.updated ? (Date.now() - new Date(geo.updated).getTime()) / 864e5 : 99;
  if (!force && age < 3 && Object.keys(geo.p).length) return;
  gBusy = true; gErr = '';
  const cy = new Date().getFullYear();
  const jobs = [];
  for (let y = G_FIRST; y <= cy - 1; y++) if (!geo.p[y] || (force && y >= cy - 1) || (y === cy - 1 && age >= 3)) jobs.push({y, q: 99});
  for (let y = cy - 2; y <= cy; y++) for (let q = 1; q <= 4; q++) {
    const k = y + 'Q' + q;
    if (!geo.p[k] || (y === cy && (force || age >= 3)) || (y === cy - 1 && q === 4 && age >= 3)) jobs.push({y, q});
  }
  let done = 0;
  try {
    let stopYear = null;
    for (const j of jobs) {
      if (stopYear === j.y && j.q !== 99) continue;
      gProgress = 'Geostat: registrations ' + (j.q === 99 ? j.y : 'Q' + j.q + ' ' + j.y) + '… (' + (++done) + '/' + jobs.length + ')';
      setGStatus();
      const set = await gFetchSet(j.y, j.q);
      const k = j.q === 99 ? String(j.y) : j.y + 'Q' + j.q;
      if (set) geo.p[k] = set; else { delete geo.p[k]; if (j.q !== 99) stopYear = j.y; }
      gSave();
      if (done % 7 === 0) render();
    }
    gProgress = 'Geostat: fleet and fuel prices…'; setGStatus();
    const fl = await gGet('vehicle-dual?lang=en&v_type=0');
    geo.fleet = (Array.isArray(fl) ? fl : []).map((r) => [r.name, r.data1, r.data2]);
    const fp = await gGet('fuel-line?lang=en');
    geo.fuelPrice = fp && fp.data ? {start: fp.pointStart, series: fp.data.map((s) => [s.name, s.data])} : null;
    const fy = gLatestFullYear();
    if (fy) {
      const qs = 'lang=en&year=' + fy + '&quarter=99&table=false';
      geo.fleetMix = {year: fy, fuel: lst(await gGet('fuels?' + qs)), age: lst(await gGet('vehicle-age?' + qs)), body: lst(await gGet('body?' + qs))};
    }
    geo.trade = await gFetchTrade();
    geo.updated = new Date().toISOString();
    gSave();
  } catch (e) { gErr = e.message; }
  gBusy = false; gProgress = '';
  render();
}
function setGStatus() { const e = document.getElementById('gStatus'); if (e) e.textContent = gStatusText(); }
function gStatusText() {
  if (gBusy) return gProgress || 'Downloading Geostat data…';
  if (gErr) return 'Geostat download stopped (' + gErr + '). Tap Refresh to try again.' + (Object.keys(geo.p).length ? ' Showing saved data.' : '');
  const lq = gLatestQ();
  return lq ? 'Geostat registrations to Q' + lq.q + ' ' + lq.y + (geo.updated ? ' · checked ' + new Date(geo.updated).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) : '') : 'No Geostat data yet.';
}

/* ---------- periods ---------- */
function gLatestQ() {
  let best = null;
  Object.keys(geo.p).forEach((k) => { const m = /^(\d{4})Q(\d)$/.exec(k); if (m) { const y = +m[1], q = +m[2]; if (!best || y * 10 + q > best.y * 10 + best.q) best = {y, q}; } });
  return best;
}
function gLatestFullYear() { const cy = new Date().getFullYear(); for (let y = cy - 1; y >= G_FIRST; y--) if (geo.p[y]) return y; return null; }
function mergeSets(sets) {
  const o = {tm: {}, fuel: [], body: [], engine: [], age: [], color: [], region: []};
  sets.forEach((s0) => {
    Object.keys(s0.tm).forEach((b) => { const ob = o.tm[b] || (o.tm[b] = {}); Object.keys(s0.tm[b]).forEach((m) => { ob[m] = (ob[m] || 0) + s0.tm[b][m]; }); });
    ['fuel', 'body', 'engine', 'age', 'color', 'region'].forEach((f) => {
      (s0[f] || []).forEach(([n, v]) => { const e = o[f].find((x) => x[0] === n); if (e) e[1] += v; else o[f].push([n, v]); });
    });
  });
  return o;
}
function gSetFor(keys) { if (!keys.length || keys.some((k) => !geo.p[k])) return null; return keys.length === 1 ? geo.p[keys[0]] : mergeSets(keys.map((k) => geo.p[k])); }
const QN = ['', 'Q1', 'Q2', 'Q3', 'Q4'];
const QSPAN = ['', 'Jan–Mar', 'Jan–Jun', 'Jan–Sep', 'Jan–Dec'];
function ytdWindow() {
  const lq = gLatestQ();
  if (!lq) { const fy = gLatestFullYear(); return fy ? yearWindowG(fy) : null; }
  if (lq.q === 4 && geo.p[lq.y]) return yearWindowG(lq.y);
  const ks = [], pk = [];
  for (let q = 1; q <= lq.q; q++) { ks.push(lq.y + 'Q' + q); pk.push((lq.y - 1) + 'Q' + q); }
  return {label: QSPAN[lq.q] + ' ' + lq.y, prevLabel: QSPAN[lq.q] + ' ' + (lq.y - 1), cur: gSetFor(ks), prev: gSetFor(pk), year: lq.y, partial: true};
}
function yearWindowG(y) { return {label: String(y), prevLabel: String(y - 1), cur: geo.p[y] || null, prev: geo.p[y - 1] || null, year: y, partial: false}; }
function gWindow() {
  if (gSel.mode === 'year' && geo.p[gSel.year]) return yearWindowG(gSel.year);
  if (gSel.mode === 'q' && geo.p[gSel.k]) {
    const y = +gSel.k.slice(0, 4), q = +gSel.k.slice(5);
    return {label: QN[q] + ' ' + y, prevLabel: QN[q] + ' ' + (y - 1), cur: geo.p[gSel.k], prev: geo.p[(y - 1) + 'Q' + q] || null, year: y, partial: true};
  }
  return ytdWindow();
}
function fillGPeriod() {
  const ps = document.getElementById('gPeriodSel'); if (!ps) return;
  const yw = ytdWindow();
  const opts = [['ytd', 'Latest: ' + (yw ? yw.label : '–')]];
  const cy = new Date().getFullYear();
  for (let y = cy; y >= cy - 2; y--) for (let q = 4; q >= 1; q--) if (geo.p[y + 'Q' + q]) opts.push(['q' + y + 'Q' + q, QN[q] + ' ' + y + ' only']);
  for (let y = cy - 1; y >= G_FIRST; y--) if (geo.p[y]) opts.push(['y' + y, 'Year ' + y]);
  const sig = opts.map((o) => o.join(':')).join('|');
  if (ps.dataset.sig !== sig) { ps.replaceChildren(...opts.map(([v, t]) => new Option(t, v))); ps.dataset.sig = sig; }
  ps.value = gSel.mode === 'year' ? 'y' + gSel.year : gSel.mode === 'q' ? 'q' + gSel.k : 'ytd';
  if (ps.selectedIndex < 0) ps.value = 'ytd';
}
document.getElementById('gPeriodSel').addEventListener('change', (e) => {
  const v = e.target.value;
  gSel = v === 'ytd' ? {mode: 'ytd'} : v.charAt(0) === 'y' ? {mode: 'year', year: +v.slice(1)} : {mode: 'q', k: v.slice(1)};
  try { localStorage.setItem('gcm_gperiod', JSON.stringify(gSel)); } catch (e2) {}
  render();
});

/* ---------- data helpers ---------- */
const sumL = (l) => (l || []).reduce((a, x) => a + x[1], 0);
const getL = (l, n) => { const e = (l || []).find((x) => x[0] === n); return e ? e[1] : 0; };
function brandTotals(set) {
  if (!set) return [];
  return Object.keys(set.tm).map((b) => ({b, v: Object.values(set.tm[b]).reduce((a, x) => a + x, 0)})).sort((a, b) => b.v - a.v);
}
function tmTotal(set) { return set ? brandTotals(set).reduce((a, x) => a + x.v, 0) : 0; }
function brandValue(set, b) { return set && set.tm[b] ? Object.values(set.tm[b]).reduce((a, x) => a + x, 0) : 0; }
function modelList(set) {
  const out = [];
  if (!set) return out;
  Object.keys(set.tm).forEach((b) => { if (b === 'Other') return; const lw = b.split(' ').pop() + ' '; Object.keys(set.tm[b]).forEach((m) => { if (m !== 'Other') out.push({b, m, k: b + '|' + m, name: b + ' ' + (b.indexOf(' ') > 0 && m.indexOf(lw) === 0 ? m.slice(lw.length) : m), v: set.tm[b][m]}); }); });
  return out.sort((a, c) => c.v - a.v);
}
/* Geostat sometimes spells one model differently between periods ("LAND CRUISER 250" / "LAND CRUISER LC 250", "E 350" / "E350"). */
function canon(m) { return String(m).toUpperCase().replace(/\bLC\s?(?=\d)/g, '').replace(/[\s\-.]+/g, ''); }
function brandModelVal(models, m) {
  if (!models) return 0;
  if (models[m]) return models[m];
  const c = canon(m); let v = 0;
  Object.keys(models).forEach((x) => { if (canon(x) === c) v += models[x]; });
  return v;
}
function modelValue(set, k) { if (!set) return 0; const [b, m] = k.split('|'); return brandModelVal(set.tm[b], m); }
function nice(n) { return String(n).toLowerCase().replace(/(^|[\s-])([a-z])/g, (x, p, c) => p + c.toUpperCase()).replace(/\bBmw\b/, 'BMW').replace(/\bVaz\b/, 'VAZ').replace(/\bGaz\b/, 'GAZ').replace(/\bUaz\b/, 'UAZ').replace(/\bByd\b/, 'BYD').replace(/\bMg\b/, 'MG').replace(/\bGmc\b/, 'GMC').replace(/\bKia\b/, 'Kia').replace(/\bDaf\b/, 'DAF').replace(/\bMan\b/, 'MAN'); }
function yearSeries(fn) {
  const cy = new Date().getFullYear(), cats = [], vals = [], faded = [];
  const yw = ytdWindow();
  for (let y = G_FIRST; y <= cy; y++) {
    let set = geo.p[y], lab = String(y), part = false;
    if (!set && yw && yw.partial && yw.year === y) { set = yw.cur; lab = y + '*'; part = true; }
    if (!set) continue;
    cats.push(lab); vals.push(fn(set)); faded.push(part);
  }
  return {cats, vals, faded, note: yw && yw.partial ? '* = ' + yw.label + ' only.' : ''};
}
const PALETTE = ['#1f77b4', '#d08a2a', '#2e8b57', '#c0392b', '#7d5ba6', '#17a2b8', '#8c6d31', '#e377c2'];
function isGreenModel(name) { return /HYBRID|\bHV\b|PRIUS|AQUA|PHEV|PLUG|ELECTRIC|\bEV\b|E-TRON|\bID\.|IONIQ|LEAF|TESLA|BYD|ZEEKR|BZ4X|NIRO|POLESTAR|MODEL [3SXY]/.test(name); }

/* ---------- generic UI ---------- */
function mixTable(tbl, cur, prev, opts) {
  opts = opts || {};
  const total = sumL(cur) || 1, ptotal = sumL(prev) || 0;
  const rows = (cur || []).slice().sort((a, b) => b[1] - a[1]);
  tbl.replaceChildren(h('tr', null, [opts.head || 'Type', 'Cars', 'Share', 'vs prev', 'Share Δ'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))),
    ...rows.map(([n, v]) => {
      const pv = getL(prev, n), c = chg(prev && pv ? pct(v, pv) : null);
      const sh = v / total * 100, psh = ptotal ? pv / ptotal * 100 : null, sc = chg(psh == null ? null : sh - psh, ' pp');
      return h('tr', null, [h('td', {text: n}), h('td', {cls: 'n', text: fN(v)}), h('td', {cls: 'n', text: sh.toFixed(1) + '%'}),
        h('td', {cls: 'n ' + c.c, text: c.t || '–'}), h('td', {cls: 'n ' + sc.c, text: sc.t || '–'})]);
    }));
}
function legendOf(box, items) { box.replaceChildren(...items.map(([n, c]) => h('span', null, [h('i', {style: 'background:' + c}), document.createTextNode(n)]))); }
function shareStack(box, cats, rows, keys, colors) {
  box.replaceChildren();
  if (!cats.length) { box.appendChild(h('div', {cls: 'empty', text: 'No data yet.'})); return; }
  const W = Math.max(280, box.clientWidth), bh = 20, gap = 9, L = 50, H = cats.length * (bh + gap);
  const svg = s('svg', {viewBox: `0 0 ${W} ${H}`, height: H, role: 'img'}, box);
  const tip = tipper(box);
  rows.forEach((r, i) => {
    const total = keys.reduce((a, k) => a + (r[k] || 0), 0) || 1, yy = i * (bh + gap);
    st(svg, 0, yy + bh / 2 + 4, cats[i]);
    let acc = 0;
    keys.forEach((k, j) => {
      const v = r[k] || 0; if (!v) return;
      const w = (W - L) * v / total, sh = v / total * 100;
      const rect = s('rect', {x: L + acc, y: yy, width: Math.max(0, w - 1), height: bh, fill: colors[j]}, svg);
      bind(rect, tip, cats[i] + ' · ' + k, [sh.toFixed(1) + '%', fN(v) + ' vehicles']);
      if (w > 30) { const t = st(svg, L + acc + w / 2, yy + bh / 2 + 4, Math.round(sh) + '%', 'val', 'middle'); t.setAttribute('style', 'fill:#fff;pointer-events:none'); }
      acc += w;
    });
  });
}

/* ---------- render ---------- */
function renderGeo() {
  setGStatus();
  fillGPeriod();
  const w = gWindow();
  const note = document.getElementById('gPeriodNote');
  if (!w || !w.cur) {
    note.textContent = gBusy ? 'Downloading Geostat registration data…' : 'Geostat data not downloaded yet. Tap Refresh.';
    ['brandTable', 'modelTable', 'fuelRegTable'].forEach((id) => { const t = document.getElementById(id); if (t) t.replaceChildren(); });
    return;
  }
  note.textContent = 'Vehicles registered for the first time in Georgia, ' + w.label + (w.prev ? ', compared with ' + w.prevLabel : '') + '. All vehicle types (cars, vans, trucks). Source: Geostat.';
  renderBrands(w); renderModels(w); renderMix(w);
}

function renderBrands(w) {
  const tot = tmTotal(w.cur), ptot = tmTotal(w.prev);
  const brands = brandTotals(w.cur).filter((x) => x.b !== 'Other');
  const evC = getL(w.cur.fuel, 'Electric'), evP = w.prev ? getL(w.prev.fuel, 'Electric') : null;
  const hyC = getL(w.cur.fuel, 'Hybrid'), hyP = w.prev ? getL(w.prev.fuel, 'Hybrid') : null;
  const suv = getL(w.cur.body, 'Off-road'), suvP = w.prev ? getL(w.prev.body, 'Off-road') : null;
  const ftot = sumL(w.cur.fuel) || 1, pftot = w.prev ? sumL(w.prev.fuel) || 1 : 1, btot = sumL(w.cur.body) || 1, pbtot = w.prev ? sumL(w.prev.body) || 1 : 1;
  const growers = brands.filter((x) => x.v >= 500 && brandValue(w.prev, x.b) >= 200).map((x) => ({b: x.b, g: pct(x.v, brandValue(w.prev, x.b))})).sort((a, b) => b.g - a.g);
  const top = brands[0];
  const k = [
    ['Registrations', fN(tot), chg(w.prev ? pct(tot, ptot) : null)],
    ['Top brand', top ? nice(top.b) : '–', {t: top ? (top.v / tot * 100).toFixed(1) + '% share' : '', c: 'flat'}],
    ['Fastest-growing brand', growers[0] ? nice(growers[0].b) : '–', chg(growers[0] ? growers[0].g : null)],
    ['Electric', fN(evC), chg(evP ? pct(evC, evP) : null)],
    ['Electric share', (evC / ftot * 100).toFixed(1) + '%', chg(evP == null ? null : evC / ftot * 100 - evP / pftot * 100, ' pp')],
    ['Hybrid share', (hyC / ftot * 100).toFixed(1) + '%', chg(hyP == null ? null : hyC / ftot * 100 - hyP / pftot * 100, ' pp')],
    ['SUV / off-road share', (suv / btot * 100).toFixed(1) + '%', chg(suvP == null ? null : suv / btot * 100 - suvP / pbtot * 100, ' pp')],
    ['Top-2 brand gap', top && brands[1] ? fN(top.v - brands[1].v) : '–', {t: brands[1] ? 'ahead of ' + nice(brands[1].b) : '', c: 'flat'}]
  ];
  document.getElementById('gKpis').replaceChildren(...k.map(([l, v, c]) => h('div', {cls: 'kpi'}, [h('div', {cls: 'l', text: l + ', ' + w.label}), h('div', {cls: 'v', text: v}), h('div', {cls: 'c ' + c.c, text: c.t ? c.t + (/share|ahead/.test(c.t) ? '' : ' vs ' + w.prevLabel) : ''})])));

  if (!gBrand || !w.cur.tm[gBrand]) gBrand = top ? top.b : null;
  const t = document.getElementById('brandTable');
  t.replaceChildren(h('tr', null, ['#', 'Brand', 'Cars', 'Share', 'vs prev', 'Share Δ', 'Top model'].map((x, i) => h('th', {cls: i && i < 6 ? 'n' : '', text: x}))),
    ...brands.map((x, i) => {
      const pv = brandValue(w.prev, x.b), c = chg(w.prev && pv ? pct(x.v, pv) : null);
      const sh = x.v / tot * 100, sc = chg(w.prev && ptot ? sh - pv / ptot * 100 : null, ' pp');
      const tm = Object.entries(w.cur.tm[x.b]).filter(([m]) => m !== 'Other').sort((a, b) => b[1] - a[1])[0];
      const tr = h('tr', {cls: 'click' + (x.b === gBrand ? ' sel' : '')}, [h('td', {cls: 'n', text: String(i + 1)}), h('td', {text: nice(x.b)}), h('td', {cls: 'n', text: fN(x.v)}),
        h('td', {cls: 'n', text: sh.toFixed(1) + '%'}), h('td', {cls: 'n ' + c.c, text: c.t || 'new'}), h('td', {cls: 'n ' + sc.c, text: sc.t || '–'}), h('td', {text: tm ? nice(tm[0]) : ''})]);
      tr.addEventListener('click', () => { gBrand = x.b; render(); document.getElementById('brandDetail').scrollIntoView({behavior: 'smooth', block: 'start'}); });
      return tr;
    }));

  /* brand detail */
  const bd = document.getElementById('brandDetailTitle');
  if (gBrand) {
    bd.textContent = nice(gBrand) + ': registrations per year';
    const ys = yearSeries((set) => brandValue(set, gBrand));
    document.getElementById('brandDetailNote').textContent = 'Tap another brand in the table to switch. ' + ys.note;
    barChart(document.getElementById('brandYearChart'), ys.cats, [{name: nice(gBrand), color: 'var(--accent)', values: ys.vals, faded: ys.faded, labelTop: true}], (v) => fN(v) + ' vehicles');
    const bm = w.cur.tm[gBrand], pm = w.prev && w.prev.tm[gBrand] ? w.prev.tm[gBrand] : {};
    const bt = Object.values(bm).reduce((a, x) => a + x, 0) || 1;
    const rows = Object.entries(bm).sort((a, b) => (a[0] === 'Other') - (b[0] === 'Other') || b[1] - a[1]);
    document.getElementById('brandModels').replaceChildren(h('tr', null, ['Model', 'Cars', 'Of brand', 'vs prev'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))),
      ...rows.map(([m, v]) => { const pv = brandModelVal(pm, m), c = chg(w.prev && pv ? pct(v, pv) : null); return h('tr', null, [h('td', {text: m === 'Other' ? 'Other models' : nice(m)}), h('td', {cls: 'n', text: fN(v)}), h('td', {cls: 'n', text: (v / bt * 100).toFixed(0) + '%'}), h('td', {cls: 'n ' + c.c, text: c.t || (w.prev ? 'new' : '–')})]); }));
  }

  /* top brands trend */
  const fy = gLatestFullYear();
  const topB = brandTotals(fy ? geo.p[fy] : w.cur).filter((x) => x.b !== 'Other').slice(0, 6).map((x) => x.b);
  const yrs = yearSeries(() => 0).cats;
  legendOf(document.getElementById('brandTrendLegend'), topB.map((b, i) => [nice(b), PALETTE[i]]));
  lineChart(document.getElementById('brandTrend'), yrs, topB.map((b, i) => ({name: nice(b), color: PALETTE[i], values: yearSeries((set) => brandValue(set, b)).vals})), (v) => fN(v) + ' vehicles');
  document.getElementById('brandTrendNote').textContent = 'Top 6 brands of ' + (fy || w.label) + ', first registrations per year. ' + yearSeries(() => 0).note;
}

function renderModels(w) {
  const list = modelList(w.cur), tot = tmTotal(w.cur) || 1;
  const q = mQuery.trim().toUpperCase();
  const shown = (q ? list.filter((x) => x.name.indexOf(q) >= 0) : list).slice(0, q ? 80 : 50);
  document.getElementById('modelTitle').textContent = 'Top models, ' + w.label;
  document.getElementById('modelTable').replaceChildren(h('tr', null, ['#', 'Model', 'Cars', 'Share', 'vs prev'].map((x, i) => h('th', {cls: i !== 1 ? 'n' : '', text: x}))),
    ...shown.map((x) => {
      const pv = modelValue(w.prev, x.k), c = chg(w.prev && pv ? pct(x.v, pv) : null);
      return h('tr', null, [h('td', {cls: 'n', text: String(list.indexOf(x) + 1)}), h('td', {text: nice(x.name)}), h('td', {cls: 'n', text: fN(x.v)}), h('td', {cls: 'n', text: (x.v / tot * 100).toFixed(2) + '%'}), h('td', {cls: 'n ' + c.c, text: c.t || (w.prev ? 'new' : '–')})]);
    }));
  if (!shown.length) document.getElementById('modelTable').appendChild(h('tr', null, [h('td', {cls: 'empty', text: 'No model matches “' + mQuery + '”.'})]));

  const withPrev = w.prev ? list.map((x) => ({...x, p: modelValue(w.prev, x.k)})) : [];
  const risers = withPrev.filter((x) => x.v >= 200 && x.p >= 50).map((x) => ({...x, g: pct(x.v, x.p)})).sort((a, b) => b.g - a.g).slice(0, 10);
  const prevList = w.prev ? modelList(w.prev) : [];
  const fallers = prevList.filter((x) => x.v >= 300).map((x) => ({...x, c: modelValue(w.cur, x.k)})).filter((x) => x.c > 0).map((x) => ({...x, g: pct(x.c, x.v)})).sort((a, b) => a.g - b.g).slice(0, 10);
  const fresh = withPrev.filter((x) => x.v >= 100 && !x.p).slice(0, 10);
  const mk2 = (rows, cols) => [h('tr', null, cols.map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))), ...rows];
  document.getElementById('risers').replaceChildren(...(risers.length ? mk2(risers.map((x) => h('tr', null, [h('td', {text: nice(x.name)}), h('td', {cls: 'n', text: fN(x.p)}), h('td', {cls: 'n', text: fN(x.v)}), h('td', {cls: 'n up', text: chg(x.g).t})])), ['Model', w.prevLabel, w.label, 'Change']) : [h('tr', null, [h('td', {cls: 'empty', text: 'Needs a comparison period.'})])]));
  document.getElementById('fallers').replaceChildren(...(fallers.length ? mk2(fallers.map((x) => { const c = chg(x.g); return h('tr', null, [h('td', {text: nice(x.name)}), h('td', {cls: 'n', text: fN(x.v)}), h('td', {cls: 'n', text: fN(x.c)}), h('td', {cls: 'n ' + c.c, text: c.t})]); }), ['Model', w.prevLabel, w.label, 'Change']) : [h('tr', null, [h('td', {cls: 'empty', text: 'Needs a comparison period.'})])]));
  document.getElementById('freshModels').replaceChildren(...(fresh.length ? mk2(fresh.map((x) => h('tr', null, [h('td', {text: nice(x.name)}), h('td', {cls: 'n', text: fN(x.v)})])), ['Model', w.label]) : [h('tr', null, [h('td', {cls: 'empty', text: 'No new models in the top lists this period.'})])]));

  const fy = gLatestFullYear();
  const top = modelList(fy ? geo.p[fy] : w.cur).slice(0, 6);
  legendOf(document.getElementById('modelTrendLegend'), top.map((x, i) => [nice(x.name), PALETTE[i]]));
  const ys = yearSeries(() => 0);
  lineChart(document.getElementById('modelTrend'), ys.cats, top.map((x, i) => ({name: nice(x.name), color: PALETTE[i], values: yearSeries((set) => modelValue(set, x.k)).vals})), (v) => fN(v) + ' vehicles');
  document.getElementById('modelTrendNote').textContent = 'Top 6 models of ' + (fy || w.label) + ', first registrations per year. ' + ys.note;
}

const FUEL_COL = {Petrol: 'var(--c-pet)', Gasoline: 'var(--c-pet)', Diesel: 'var(--c-dsl)', Hybrid: 'var(--c-hev)', Electric: 'var(--c-ev)', 'Gasoline-gas': '#b0894f', Gas: '#d6b27c', Others: 'var(--c-oth)'};
function renderMix(w) {
  const fix = (l) => (l || []).map(([n, v]) => [n === 'Gasoline' ? 'Petrol' : n === 'Gasoline-gas' ? 'Petrol + gas' : n, v]);
  document.getElementById('mixTitle').textContent = 'What Georgia registered, ' + w.label;
  mixTable(document.getElementById('fuelRegTable'), fix(w.cur.fuel), w.prev ? fix(w.prev.fuel) : null, {head: 'Fuel'});
  mixTable(document.getElementById('bodyTable'), w.cur.body, w.prev ? w.prev.body : null, {head: 'Body'});
  mixTable(document.getElementById('engineTable'), w.cur.engine.map(([n, v]) => [n === 'Unknown' ? n : n + ' cm³', v]), w.prev ? w.prev.engine.map(([n, v]) => [n === 'Unknown' ? n : n + ' cm³', v]) : null, {head: 'Engine'});
  const ageName = (n) => ({'<=2': '0–2 years', '(2-5]': '3–5 years', '(5-10]': '6–10 years', '>10': 'Over 10 years'}[n] || n);
  mixTable(document.getElementById('ageTable'), w.cur.age.map(([n, v]) => [ageName(n), v]), w.prev ? w.prev.age.map(([n, v]) => [ageName(n), v]) : null, {head: 'Age at registration'});
  mixTable(document.getElementById('colorTable'), w.cur.color, w.prev ? w.prev.color : null, {head: 'Colour'});
  mixTable(document.getElementById('regionTable'), w.cur.region, w.prev ? w.prev.region : null, {head: 'Region'});

  /* fuel share per year */
  const keys = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Petrol + gas', 'Others'];
  const cols = [FUEL_COL.Petrol, FUEL_COL.Diesel, FUEL_COL.Hybrid, FUEL_COL.Electric, FUEL_COL['Gasoline-gas'], FUEL_COL.Others];
  const ys = yearSeries((set) => { const r = {}; fix(set.fuel).forEach(([n, v]) => { r[keys.indexOf(n) >= 0 ? n : 'Others'] = (r[keys.indexOf(n) >= 0 ? n : 'Others'] || 0) + v; }); return r; });
  legendOf(document.getElementById('fuelYearLegend'), keys.map((k, i) => [k, cols[i]]));
  shareStack(document.getElementById('fuelYearChart'), ys.cats, ys.vals, keys, cols);
  const bodyKeys = ['Sedan', 'Off-road', 'Hatchback', 'Universal', 'Minivan', 'Others'];
  const bcols = ['#1f77b4', '#2e8b57', '#d08a2a', '#7d5ba6', '#17a2b8', 'var(--c-oth)'];
  const yb = yearSeries((set) => { const r = {}; (set.body || []).forEach(([n, v]) => { const k = bodyKeys.indexOf(n) >= 0 ? n : 'Others'; r[k] = (r[k] || 0) + v; }); return r; });
  legendOf(document.getElementById('bodyYearLegend'), bodyKeys.map((k, i) => [k === 'Off-road' ? 'SUV / off-road' : k, bcols[i]]));
  shareStack(document.getElementById('bodyYearChart'), yb.cats, yb.vals, bodyKeys, bcols);

  /* fleet */
  if (geo.fleet && geo.fleet.length) {
    const f = geo.fleet.filter((r) => r[0] >= 2010);
    lineChart(document.getElementById('fleetChart'), f.map((r) => String(r[0])), [{name: 'Vehicles registered (thousand)', color: 'var(--accent)', values: f.map((r) => r[1])}], (v) => fN(v * 1000) + ' vehicles', {zero: false, tick: (v) => fK(v) + 'k'});
    const last = f[f.length - 1], prev = f[f.length - 2];
    document.getElementById('fleetNote').textContent = 'End of ' + last[0] + ': ' + fN(last[1] * 1000) + ' vehicles (' + chg(prev ? pct(last[1], prev[1]) : null).t + ' in a year), ' + last[2] + ' per 1,000 people.';
  }
  if (geo.fleetMix) {
    document.getElementById('fleetMixTitle').textContent = 'All registered vehicles at end of ' + geo.fleetMix.year;
    mixTable(document.getElementById('fleetFuelTable'), fix(geo.fleetMix.fuel), null, {head: 'Fuel'});
    mixTable(document.getElementById('fleetAgeTable'), geo.fleetMix.age.map(([n, v]) => [ageName(n), v]), null, {head: 'Vehicle age'});
  }
  /* new vs used imports */
  const t = geo.trade;
  if (t && t.start) {
    const n = (t.I['1_new'] || []).length, last = n - 1, yl = t.start + last;
    const rows = G_FUELS.map(([f, name]) => {
      const nw = (t.I[f + '_new'] || [])[last] || 0, us = (t.I[f + '_used'] || [])[last] || 0;
      const pn = (t.I[f + '_new'] || [])[last - 1] || 0, pu = (t.I[f + '_used'] || [])[last - 1] || 0;
      const c = chg(pct(nw + us, pn + pu));
      return h('tr', null, [h('td', {text: name}), h('td', {cls: 'n', text: fN(nw)}), h('td', {cls: 'n', text: fN(us)}), h('td', {cls: 'n', text: ((nw / ((nw + us) || 1)) * 100).toFixed(0) + '%'}), h('td', {cls: 'n ' + c.c, text: c.t || '–'})]);
    });
    document.getElementById('nuTitle').textContent = 'Passenger cars imported in ' + yl + ': new vs used';
    document.getElementById('nuTable').replaceChildren(h('tr', null, ['Fuel', 'New', 'Used', 'New share', 'vs ' + (yl - 1)].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))), ...rows);
    const labs = []; for (let i = 0; i < n; i++) labs.push(String(t.start + i));
    lineChart(document.getElementById('nuChart'), labs, [
      {name: 'Electric (all)', color: 'var(--c-ev)', values: labs.map((x, i) => (t.I['3_new'][i] || 0) + (t.I['3_used'][i] || 0))},
      {name: 'Hybrid (all)', color: 'var(--c-hev)', values: labs.map((x, i) => (t.I['4_new'][i] || 0) + (t.I['4_used'][i] || 0))},
      {name: 'New cars, any fuel', color: 'var(--gold)', values: labs.map((x, i) => G_FUELS.reduce((a, [f]) => a + ((t.I[f + '_new'] || [])[i] || 0), 0))}
    ], (v) => fN(v) + ' cars');
  }
  if (geo.fuelPrice) {
    const fp = geo.fuelPrice, labs = fp.series[0][1].map((x, i) => String(fp.start + i));
    const col = {Gasoline: 'var(--c-pet)', Diesel: 'var(--c-dsl)', Gas: '#d6b27c'};
    lineChart(document.getElementById('fuelPriceChart'), labs, fp.series.map(([n, d]) => ({name: n === 'Gasoline' ? 'Petrol' : n, color: col[n] || 'var(--accent)', values: d})), (v) => 'GEL ' + v.toFixed(2) + ' per litre', {h: 180, tick: (v) => v.toFixed(1)});
  }
}

/* ---------- stock signals from registrations ---------- */
function geoAdvice() {
  const box = document.getElementById('modelSignals'); if (!box) return;
  const w = gWindow();
  if (!w || !w.cur || !w.prev) { box.replaceChildren(h('div', {cls: 'empty', text: gBusy ? 'Downloading Geostat data…' : 'Needs Geostat registration data with a comparison period.'})); return; }
  document.getElementById('modelSignalsNote').textContent = 'Based on first registrations in Georgia (real local demand), ' + w.label + ' vs ' + w.prevLabel + '. Add = at least 150 registrations and growing 20%+. Reduce = falling 20%+ from at least 300. Green models (hybrid/electric) get lower excise.';
  const list = modelList(w.cur).map((x) => ({...x, p: modelValue(w.prev, x.k)}));
  const adds = list.filter((x) => x.v >= 150 && x.p > 0 && pct(x.v, x.p) >= 20).map((x) => ({...x, g: pct(x.v, x.p), sc: (x.v - x.p) * (isGreenModel(x.name) ? 1.3 : 1)})).sort((a, b) => b.sc - a.sc).slice(0, 12);
  const holds = list.filter((x) => x.v >= 800 && x.p > 0 && Math.abs(pct(x.v, x.p)) < 20).slice(0, 6).map((x) => ({...x, g: pct(x.v, x.p)}));
  const reds = modelList(w.prev).filter((x) => x.v >= 300).map((x) => ({...x, c: modelValue(w.cur, x.k)})).filter((x) => x.c > 0).map((x) => ({...x, g: pct(x.c, x.v)})).filter((x) => x.g <= -20).sort((a, b) => (a.c - a.v) - (b.c - b.v)).slice(0, 8);
  const color = {Add: 'var(--ok)', Hold: 'var(--warn)', Reduce: 'var(--bad)'};
  const item = (sig, name, txt) => h('div', {cls: 'sig'}, [h('div', {cls: 'h'}, [h('span', {cls: 'pill', style: 'color:' + color[sig], text: sig}), document.createTextNode(nice(name))]), h('p', {text: txt})]);
  box.replaceChildren(
    ...adds.map((x) => item('Add', x.name, fN(x.p) + ' → ' + fN(x.v) + ' registrations (' + chg(x.g).t + ')' + (isGreenModel(x.name) ? ' · hybrid/electric: lower excise' : '') + '.')),
    ...holds.map((x) => item('Hold', x.name, 'Steady best-seller: ' + fN(x.v) + ' registrations (' + (chg(x.g).t || '0%') + '). Safe volume, keep normal stock.')),
    ...reds.map((x) => item('Reduce', x.name, fN(x.v) + ' → ' + fN(x.c) + ' registrations (' + chg(x.g).t + ').'))
  );
  /* brands */
  const bb = document.getElementById('brandSignals');
  const brands = brandTotals(w.cur).filter((x) => x.b !== 'Other').map((x) => ({...x, p: brandValue(w.prev, x.b)})).filter((x) => x.p > 0).map((x) => ({...x, g: pct(x.v, x.p)}));
  const bAdd = brands.filter((x) => x.g >= 15 && x.v >= 500).sort((a, b) => b.g - a.g).slice(0, 6);
  const bRed = brands.filter((x) => x.g <= -15).sort((a, b) => a.g - b.g).slice(0, 5);
  bb.replaceChildren(...bAdd.map((x) => item('Add', x.b, fN(x.p) + ' → ' + fN(x.v) + ' (' + chg(x.g).t + ').')), ...bRed.map((x) => item('Reduce', x.b, fN(x.p) + ' → ' + fN(x.v) + ' (' + chg(x.g).t + ').')));
  if (!bAdd.length && !bRed.length) bb.replaceChildren(h('div', {cls: 'empty', text: 'No brand moved more than 15% this period.'}));
}
document.getElementById('mSearch').addEventListener('input', (e) => { mQuery = e.target.value; const w = gWindow(); if (w && w.cur) renderModels(w); });
