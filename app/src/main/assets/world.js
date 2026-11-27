'use strict';
/* ======================================================================
   International market: car exports of the main car-making countries and
   car imports of Georgia's re-export markets (UN Comtrade), EU new-car
   registrations by fuel (Eurostat), and the largest carmakers worldwide
   (company reports, fixed values).
   ====================================================================== */
const MAKERS = [[156, 'China'], [276, 'Germany'], [392, 'Japan'], [410, 'South Korea'], [842, 'USA'], [484, 'Mexico'], [724, 'Spain'], [792, 'Türkiye'], [203, 'Czechia'], [826, 'United Kingdom']];
const MARKETS = [[398, 'Kazakhstan'], [417, 'Kyrgyzstan'], [860, 'Uzbekistan'], [31, 'Azerbaijan'], [51, 'Armenia'], [762, 'Tajikistan']];
const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/road_eqr_carpda?format=JSON&lang=EN&geo=EU27_2020&unit=NR&sinceTimePeriod=2017';
const WKEY = 'gcm_world_v1';
let world = {exp: {}, imp: {}, eu: null, tried: {}, updated: null};
try { const s0 = JSON.parse(localStorage.getItem(WKEY)); if (s0 && s0.exp) world = Object.assign(world, s0); } catch (e) {}
function wSave() { try { localStorage.setItem(WKEY, JSON.stringify(world)); } catch (e) {} }
let wBusy = false, wErr = '', wTriedNow = new Set();

function wYears() { const cy = new Date().getFullYear(); const out = []; for (let y = 2019; y <= cy - 1; y++) out.push(y); return out; }
function wPack(rows) {
  const o = {};
  rows.forEach((r) => { const a = o[r.reporterCode] || (o[r.reporterCode] = {}); a[r.cmdCode] = {q: r.qty || 0, v: r.primaryValue || 0}; });
  return o;
}
async function worldSync(force) {
  if (wBusy || busy) return;
  const cy = new Date().getFullYear();
  const jobs = [];
  wYears().forEach((y) => {
    const recent = y >= cy - 2;
    if ((!world.exp[y] || (force && recent)) && !wTriedNow.has('e' + y)) jobs.push({k: 'e', y});
    if ((!world.imp[y] || (force && recent)) && !wTriedNow.has('i' + y)) jobs.push({k: 'i', y});
  });
  const euAge = world.updated ? (Date.now() - new Date(world.updated).getTime()) / 864e5 : 99;
  const wantEu = !world.eu || force || euAge > 7;
  if (!jobs.length && !wantEu) return;
  wBusy = true; wErr = '';
  try {
    for (const j of jobs) {
      wTriedNow.add(j.k + j.y);
      setWStatus('Downloading ' + (j.k === 'e' ? 'world car exports' : 're-export market imports') + ' for ' + j.y + '…');
      const codes = (j.k === 'e' ? MAKERS : MARKETS).map((x) => x[0]).join(',');
      const url = API + 'A/HS?reporterCode=' + codes + '&period=' + j.y + '&flowCode=' + (j.k === 'e' ? 'X' : 'M') + '&partnerCode=0&cmdCode=8703,870380';
      const res = await getJson(url);
      if (res.error) throw new Error(res.error);
      const p = wPack(res.data || []);
      if (Object.keys(p).length) (j.k === 'e' ? world.exp : world.imp)[j.y] = p;
      wSave();
      renderWorld();
    }
    if (wantEu) {
      setWStatus('Downloading EU registrations (Eurostat)…');
      const r = await rawGet(EUROSTAT);
      if (r.code !== 200) throw new Error('Eurostat error ' + r.code);
      const d = JSON.parse(r.body);
      const fuels = Object.keys(d.dimension.mot_nrg.category.index), times = Object.keys(d.dimension.time.category.index);
      const fi = d.dimension.mot_nrg.category.index, ti = d.dimension.time.category.index, nT = times.length;
      const eu = {};
      times.forEach((t) => { eu[t] = {}; fuels.forEach((f) => { const v = d.value[fi[f] * nT + ti[t]]; if (v != null) eu[t][f] = v; }); });
      world.eu = eu; world.updated = new Date().toISOString(); wSave();
    }
  } catch (e) { wErr = e.message; }
  wBusy = false;
  renderWorld();
}
function setWStatus(t) { const e = document.getElementById('wStatus'); if (e) e.textContent = t; }

function renderWorld() {
  const visible = !document.getElementById('world').hidden;
  if (IS_WEB && !RELAY) { setWStatus('Most of this page uses UN Comtrade data, which is in the Android app only for now. EU registrations below are live.'); if (visible && !wBusy && !world.eu) { wTriedNow = new Set(wYears().flatMap((y) => ['e' + y, 'i' + y])); worldSync(false); } }
  else if (visible && !wBusy && !busy && !wErr) worldSync(false);
  if (!(IS_WEB && !RELAY)) setWStatus(wBusy ? document.getElementById('wStatus').textContent : wErr ? 'Download stopped (' + wErr + '). Tap Refresh to try again.' : busy ? 'Waiting for the customs download to finish…' : 'UN Comtrade and Eurostat data, about 6–12 months behind.');
  const ys = wYears().filter((y) => world.exp[y]);
  const ly = ys[ys.length - 1];

  /* exporters */
  const et = document.getElementById('expTable');
  if (ly) {
    document.getElementById('expTitle').textContent = 'Car exports by the main car-making countries, ' + ly;
    const rows = MAKERS.map(([c, n]) => {
      const a = (world.exp[ly][c] || {})['8703'], p = world.exp[ly - 1] ? (world.exp[ly - 1][c] || {})['8703'] : null, ev = (world.exp[ly][c] || {})['870380'];
      return {n, a, p, ev};
    }).filter((r) => r.a).sort((x, y2) => (y2.a.q - x.a.q) || (y2.a.v - x.a.v));
    et.replaceChildren(h('tr', null, ['Country', 'Cars', 'vs ' + (ly - 1), 'Value', 'Avg price', 'Electric'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))),
      ...rows.map((r) => {
        const q = r.a.q > 0, c = chg(q && r.p && r.p.q ? pct(r.a.q, r.p.q) : r.p && r.p.v ? pct(r.a.v, r.p.v) : null);
        return h('tr', null, [h('td', {text: r.n}), h('td', {cls: 'n', text: q ? fK(r.a.q) : 'n/a'}), h('td', {cls: 'n ' + c.c, text: c.t ? c.t + (q ? '' : ' (value)') : '–'}), h('td', {cls: 'n', text: fUsd(r.a.v)}),
          h('td', {cls: 'n', text: q ? '$' + fN(r.a.v / r.a.q) : '–'}), h('td', {cls: 'n', text: r.ev ? (q && r.ev.q ? (r.ev.q / r.a.q * 100).toFixed(0) : (r.ev.v / (r.a.v || 1) * 100).toFixed(0)) + '%' : '–'})]);
      }));
    et.appendChild(h('tr', null, [h('td', {cls: 'note', colspan: '6', text: 'n/a = this country reports export value but not the number of cars. Electric share is then by value.'})]));
    const top5 = MAKERS.slice(0, 5);
    legendOf(document.getElementById('expLegend'), top5.map(([, n], i) => [n, PALETTE[i]]));
    lineChart(document.getElementById('expChart'), ys.map(String), top5.map(([c, n], i) => ({name: n, color: PALETTE[i], values: ys.map((y) => { const a = (world.exp[y][c] || {})['8703']; return a && a.q > 0 ? a.q : null; })})), (v) => fN(v) + ' cars');
    legendOf(document.getElementById('expEvLegend'), top5.map(([, n], i) => [n, PALETTE[i]]));
    lineChart(document.getElementById('expEvChart'), ys.map(String), top5.map(([c, n], i) => ({name: n, color: PALETTE[i], values: ys.map((y) => { const a = (world.exp[y][c] || {})['8703'], e = (world.exp[y][c] || {})['870380']; return a && e && a.q > 0 ? e.q / a.q * 100 : null; })})), (v) => v.toFixed(1) + '% electric', {h: 180, tick: (v) => Math.round(v) + '%'});
  } else et.replaceChildren(h('tr', null, [h('td', {cls: 'empty', text: IS_WEB && !RELAY ? 'UN Comtrade data: in the Android app only for now.' : wBusy || busy ? 'Downloading…' : 'Open this tab while online to download.'})]));

  /* re-export markets */
  const yi = wYears().filter((y) => world.imp[y]), li = yi[yi.length - 1];
  const mt = document.getElementById('mktTable');
  if (li) {
    document.getElementById('mktTitle').textContent = 'Car imports of Georgia’s re-export markets, ' + li;
    mt.replaceChildren(h('tr', null, ['Country', 'Cars', 'vs ' + (li - 1), 'Avg price', 'Electric'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))),
      ...MARKETS.map(([c, n]) => {
        const a = (world.imp[li][c] || {})['8703'], p = world.imp[li - 1] ? (world.imp[li - 1][c] || {})['8703'] : null, ev = (world.imp[li][c] || {})['870380'];
        if (!a) return h('tr', null, [h('td', {text: n}), h('td', {cls: 'n', text: 'not reported'}), h('td'), h('td'), h('td')]);
        const ch = chg(p ? pct(a.q, p.q) : null);
        return h('tr', null, [h('td', {text: n}), h('td', {cls: 'n', text: fN(a.q)}), h('td', {cls: 'n ' + ch.c, text: ch.t || '–'}), h('td', {cls: 'n', text: '$' + fN(a.v / (a.q || 1))}), h('td', {cls: 'n', text: ev ? (ev.q / (a.q || 1) * 100).toFixed(0) + '%' : '–'})]);
      }));
    legendOf(document.getElementById('mktLegend'), MARKETS.slice(0, 5).map(([, n], i) => [n, PALETTE[i]]));
    lineChart(document.getElementById('mktChart'), yi.map(String), MARKETS.slice(0, 5).map(([c, n], i) => ({name: n, color: PALETTE[i], values: yi.map((y) => { const a = (world.imp[y][c] || {})['8703']; return a ? a.q : null; })})), (v) => fN(v) + ' cars');
  } else mt.replaceChildren(h('tr', null, [h('td', {cls: 'empty', text: IS_WEB && !RELAY ? 'UN Comtrade data: in the Android app only for now.' : wBusy || busy ? 'Downloading…' : 'Open this tab while online to download.'})]));

  /* EU */
  if (world.eu) {
    const yrs = Object.keys(world.eu).filter((y) => world.eu[y].TOTAL).sort();
    const keys = [['p', 'Petrol'], ['d', 'Diesel'], ['h', 'Hybrid'], ['pi', 'Plug-in'], ['e', 'Electric'], ['o', 'Other']];
    const cols = ['var(--c-pet)', 'var(--c-dsl)', 'var(--c-hev)', 'var(--c-phev)', 'var(--c-ev)', 'var(--c-oth)'];
    const rows = yrs.map((y) => {
      const e = world.eu[y], r = {};
      r.Petrol = e.PET_X_HYB || 0; r.Diesel = e.DIE_X_HYB || 0; r.Hybrid = (e.ELC_PET_HYB || 0) + (e.ELC_DIE_HYB || 0);
      r['Plug-in'] = (e.ELC_PET_PI || 0) + (e.ELC_DIE_PI || 0); r.Electric = e.ELC || 0;
      r.Other = Math.max(0, e.TOTAL - r.Petrol - r.Diesel - r.Hybrid - r['Plug-in'] - r.Electric);
      return r;
    });
    legendOf(document.getElementById('euLegend'), keys.map(([, n], i) => [n, cols[i]]));
    shareStack(document.getElementById('euChart'), yrs, rows, keys.map((k) => k[1]), cols);
    const l = yrs[yrs.length - 1], p = yrs[yrs.length - 2];
    document.getElementById('euNote').textContent = l ? 'New passenger cars registered in the EU in ' + l + ': ' + fN(world.eu[l].TOTAL) + (p ? ' (' + chg(pct(world.eu[l].TOTAL, world.eu[p].TOTAL)).t + ' vs ' + p + ')' : '') + '. Source: Eurostat.' : '';
  }
}
