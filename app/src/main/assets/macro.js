'use strict';
/* ======================================================================
   Economy: National Bank of Georgia (exchange rates, policy rate),
   Geostat statistical database (GDP growth, inflation, wages),
   World Bank (annual indicators).
   ====================================================================== */
const NBG_FX = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
const NBG_MPC = 'https://nbg.gov.ge/en/monetary-policy/committee-decisions';
const PX = 'https://pc-axis.geostat.ge/PXWeb/api/v1/en/Database/';
const PX_GDP = 'National Accounts/System of National Accounts 2008 (SNA 2008)/Gross Domestic Product (GDP)/06_Real_Growth.px';
const PX_CPI = 'Price Statistics/CPI/National Consumer Price Index/CPI_in_Georgia(same_month_of_the_previous_year=100_orenovani2.px';
const PX_WAGE = 'Social Statistics/Labour/Wages_Nace2.px';
const WB = 'https://api.worldbank.org/v2/country/GEO/indicator/';
const WB_IND = [
  ['NY.GDP.MKTP.KD.ZG', 'GDP growth', '%'], ['NY.GDP.PCAP.CD', 'GDP per person', '$'], ['FP.CPI.TOTL.ZG', 'Inflation', '%'],
  ['BX.TRF.PWKR.DT.GD.ZS', 'Remittances, share of GDP', '%'], ['SL.UEM.TOTL.ZS', 'Unemployment', '%'], ['SP.POP.TOTL', 'Population', 'n']
];
const MKEY = 'gcm_macro_v1';
let mac = {fx: {}, fxNow: null, gdp: null, cpi: null, wage: null, rate: null, wb: {}, imf: {}, updated: null};
try { const s0 = JSON.parse(localStorage.getItem(MKEY)); if (s0 && s0.fx) mac = Object.assign(mac, s0); } catch (e) {}
function mSave() { try { localStorage.setItem(MKEY, JSON.stringify(mac)); } catch (e) {} }
let mBusy = false, mErr = [];

async function getAny(url, post) {
  for (let i = 0; i < 3; i++) {
    const r = post ? await rawPost(url, post) : await rawGet(url);
    if (r.code === 200) return r.body.replace(/^﻿/, '');
    if (r.code >= 400 && r.code < 500) throw new Error('error ' + r.code);
    await sleep(1200);
  }
  throw new Error('not responding');
}
const pxUrl = (p) => PX + p.split('/').map(encodeURIComponent).join('/') + '/';
async function pxTable(path, query) {
  const url = pxUrl(path);
  const meta = JSON.parse(await getAny(url));
  const data = JSON.parse(await getAny(url, JSON.stringify({query, response: {format: 'json'}})));
  return {meta, data: data.data || []};
}
const txt = (meta, i, idx) => { const v = meta.variables[i]; const j = v.values.indexOf(idx); return j >= 0 ? v.valueTexts[j] : idx; };
const num = (s) => { const n = parseFloat(s); return isFinite(n) ? n : null; };
const ROMAN = {I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12};

async function macroSync(force) {
  if (mBusy) return;
  const age = mac.updated ? (Date.now() - new Date(mac.updated).getTime()) / 864e5 : 99;
  if (!force && age < 1) return;
  mBusy = true; mErr = [];
  const step = async (name, fn) => { try { setMStatus('Downloading ' + name + '…'); await fn(); mSave(); } catch (e) { mErr.push(name + ': ' + e.message); } };
  await step('exchange rates (NBG)', async () => {
    const now = JSON.parse(await getAny(NBG_FX + '?currencies=EUR&currencies=USD'));
    const r = {}; ((now[0] || {}).currencies || []).forEach((c) => { r[c.code] = c.rate / (c.quantity || 1); });
    mac.fxNow = {date: (now[0] || {}).date, USD: r.USD, EUR: r.EUR};
    const d = new Date(), ks = [];
    for (let i = 0; i <= 36; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); ks.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
    for (const k of ks) {
      if (mac.fx[k] && k !== ks[0]) continue;
      const j = JSON.parse(await getAny(NBG_FX + '?currencies=EUR&currencies=USD&date=' + k + '-01'));
      const o = {}; ((j[0] || {}).currencies || []).forEach((c) => { o[c.code] = c.rate / (c.quantity || 1); });
      if (o.USD) mac.fx[k] = o;
    }
  });
  await step('GDP growth (Geostat)', async () => {
    const t = await pxTable(PX_GDP, [{code: 'Activity', selection: {filter: 'item', values: ['23']}}]);
    mac.gdp = t.data.map((r) => [txt(t.meta, 1, r.key[1]).replace('*', '').trim(), num(r.values[0])])
      .filter((r) => r[1] != null && /^(I|II|III|IV) \d\d$/.test(r[0]))
      .map(([p, v]) => { const [q, yy] = p.split(' '); return ['Q' + ROMAN[q] + ' 20' + yy, +(v - 100).toFixed(1)]; });
  });
  await step('inflation (Geostat)', async () => {
    const t = await pxTable(PX_CPI, [{code: 'Region', selection: {filter: 'item', values: ['0']}}, {code: 'Groups', selection: {filter: 'item', values: ['0']}}]);
    mac.cpi = t.data.map((r) => [txt(t.meta, 2, r.key[2]), ROMAN[txt(t.meta, 3, r.key[3])] || +r.key[3] + 1, num(r.values[0])]).filter((r) => r[2] != null).map(([y, m, v]) => [y + String(m).padStart(2, '0'), +(v - 100).toFixed(1)]).sort((a, b) => a[0] < b[0] ? -1 : 1);
  });
  await step('wages (Geostat)', async () => {
    const t = await pxTable(PX_WAGE, [{code: 'Sex, Sectors', selection: {filter: 'item', values: ['0']}}, {code: 'Economic Activity', selection: {filter: 'item', values: ['0']}}]);
    mac.wage = t.data.map((r) => [txt(t.meta, 2, r.key[2]), txt(t.meta, 3, r.key[3]), num(r.values[0])]).filter((r) => r[2] != null && r[1] !== 'annual').map(([y, q, v]) => ['Q' + (ROMAN[q] || q) + ' ' + y, v, +y, ROMAN[q] || 0]);
  });
  if (!IS_WEB || RELAY) await step('policy rate (NBG)', async () => {
    const html = await getAny(NBG_MPC);
    const m = /"monetaryPolicyRates":(\[[^\]]*\])/.exec(html);
    if (!m) throw new Error('page format changed');
    mac.rate = JSON.parse(m[1]).map((r) => [String(r.date).slice(0, 10), +r.rate, +r.change || 0]).sort((a, b) => a[0] < b[0] ? 1 : -1);
  });
  await step('World Bank indicators', async () => {
    for (const [code] of WB_IND) {
      const j = JSON.parse(await getAny(WB + code + '?format=json&date=2015:2030&per_page=100'));
      mac.wb[code] = (j[1] || []).filter((r) => r.value != null).map((r) => [+r.date, r.value]).sort((a, b) => a[0] - b[0]);
    }
  });
  mac.updated = new Date().toISOString(); mSave();
  mBusy = false; setMStatus('');
  render();
}
function setMStatus(t) { const e = document.getElementById('mStatus'); if (e) e.textContent = t || mStatusText(); }
function mStatusText() {
  if (mBusy) return 'Downloading economic data…';
  const u = mac.updated ? 'Checked ' + new Date(mac.updated).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) + '.' : 'Not downloaded yet. Tap Refresh.';
  return u + (mErr.length ? ' Some sources failed: ' + mErr.join('; ') + '.' : '');
}

function fxAvgYear(y) { const v = Object.keys(mac.fx).filter((k) => k.slice(0, 4) === String(y)).map((k) => mac.fx[k].USD); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null; }
function renderMacro() {
  setMStatus();
  const fx = mac.fxNow, ks = Object.keys(mac.fx).sort();
  const yAgoK = (() => { const d = new Date(); return (d.getFullYear() - 1) + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  const yAgo = mac.fx[yAgoK];
  const gdpL = mac.gdp && mac.gdp.length ? mac.gdp[mac.gdp.length - 1] : null;
  const cpiL = mac.cpi && mac.cpi.length ? mac.cpi[mac.cpi.length - 1] : null;
  const cpiP = mac.cpi && mac.cpi.length > 12 ? mac.cpi[mac.cpi.length - 13] : null;
  const wL = mac.wage && mac.wage.length ? mac.wage[mac.wage.length - 1] : null;
  const wP = wL ? mac.wage.find((r) => r[2] === wL[2] - 1 && r[3] === wL[3]) : null;
  const rate = mac.rate && mac.rate[0];
  const remit = mac.wb['BX.TRF.PWKR.DT.GD.ZS'], remitL = remit && remit[remit.length - 1];
  const wUsd = wL && fx && fx.USD ? wL[1] / fx.USD : null;
  const k = [
    ['USD / GEL today', fx && fx.USD ? fx.USD.toFixed(4) : '–', {t: fx && yAgo ? chg(pct(fx.USD, yAgo.USD)).t + ' vs a year ago' : '', c: fx && yAgo ? (fx.USD < yAgo.USD ? 'up' : 'down') : 'flat'}],
    ['EUR / GEL today', fx && fx.EUR ? fx.EUR.toFixed(4) : '–', {t: fx && yAgo && yAgo.EUR ? chg(pct(fx.EUR, yAgo.EUR)).t + ' vs a year ago' : '', c: fx && yAgo && yAgo.EUR ? (fx.EUR < yAgo.EUR ? 'up' : 'down') : 'flat'}],
    ['Real GDP growth' + (gdpL ? ', ' + gdpL[0] : ''), gdpL ? (gdpL[1] > 0 ? '+' : '') + gdpL[1] + '%' : '–', {t: 'vs same quarter last year', c: 'flat'}],
    ['Inflation' + (cpiL ? ', ' + mLabel(cpiL[0]) : ''), cpiL ? cpiL[1].toFixed(1) + '%' : '–', {t: cpiP ? 'a year earlier ' + cpiP[1].toFixed(1) + '%' : '', c: 'flat'}],
    ['Average monthly salary' + (wL ? ', ' + wL[0] : ''), wL ? 'GEL ' + fN(wL[1]) : '–', chg(wP ? pct(wL[1], wP[1]) : null)],
    ['Salary in USD', wUsd ? '$' + fN(wUsd) : '–', {t: 'at today’s rate', c: 'flat'}],
    ['NBG policy rate', rate ? rate[1].toFixed(2) + '%' : '–', {t: rate ? 'decided ' + new Date(rate[0]).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : IS_WEB && !RELAY ? 'in the Android app' : '', c: 'flat'}],
    ['Money sent home' + (remitL ? ', ' + remitL[0] : ''), remitL ? remitL[1].toFixed(1) + '%' : '–', {t: 'of GDP (World Bank)', c: 'flat'}]
  ];
  document.getElementById('mKpis').replaceChildren(...k.map(([l, v, c]) => h('div', {cls: 'kpi'}, [h('div', {cls: 'l', text: l}), h('div', {cls: 'v', text: v}), h('div', {cls: 'c ' + c.c, text: c.t || ''})])));

  /* car affordability */
  const yw = typeof latestWindow === 'function' && hasAny() ? latestWindow() : null;
  const aff = document.getElementById('affTable');
  const rows = [];
  if (mac.wage) {
    const years = [...new Set(mac.wage.map((r) => r[2]))].sort().slice(-4);
    years.forEach((y) => {
      const ws = mac.wage.filter((r) => r[2] === y), wa = ws.reduce((a, r) => a + r[1], 0) / ws.length;
      const fxy = fxAvgYear(y) || (fx && y === new Date().getFullYear() ? fx.USD : null);
      let p = typeof yearData === 'function' ? yearData(y) : null; let lab = String(y);
      if (!p && yw && yw.year === y) { p = yw.cur; lab = yw.label; }
      const t = p ? tot(p, 'M') : null, price = t && t.q ? t.v / t.q : null;
      const wusd = fxy ? wa / fxy : null;
      rows.push(h('tr', null, [h('td', {text: lab}), h('td', {cls: 'n', text: 'GEL ' + fN(wa)}), h('td', {cls: 'n', text: wusd ? '$' + fN(wusd) : '–'}), h('td', {cls: 'n', text: price ? '$' + fN(price) : '–'}), h('td', {cls: 'n', text: price && wusd ? (price / wusd).toFixed(1) : '–'})]));
    });
  }
  aff.replaceChildren(h('tr', null, ['Year', 'Avg salary', 'In USD', 'Avg import price', 'Months of salary'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))), ...rows);

  /* charts */
  if (mac.gdp) { const g = mac.gdp.slice(-16); lineChart(document.getElementById('gdpChart'), g.map((r) => r[0].replace(' 20', ' ')), [{name: 'Real GDP growth', color: 'var(--accent)', values: g.map((r) => r[1])}], (v) => v.toFixed(1) + '%', {h: 180, zero: false, tick: (v) => v.toFixed(0) + '%'}); }
  if (mac.cpi) { const c = mac.cpi.slice(-36); lineChart(document.getElementById('cpiChart'), c.map((r) => MON[+r[0].slice(4) - 1] + ' ' + r[0].slice(2, 4)), [{name: 'Inflation', color: 'var(--bad)', values: c.map((r) => r[1])}], (v) => v.toFixed(1) + '%', {h: 180, zero: false, tick: (v) => v.toFixed(0) + '%'}); }
  if (ks.length > 1) {
    lineChart(document.getElementById('fxChart'), ks.map((k2) => MON[+k2.slice(5) - 1] + ' ' + k2.slice(2, 4)), [
      {name: 'USD', color: 'var(--accent)', values: ks.map((k2) => mac.fx[k2].USD)}, {name: 'EUR', color: 'var(--gold)', values: ks.map((k2) => mac.fx[k2].EUR || null)}
    ], (v) => 'GEL ' + v.toFixed(3), {h: 180, zero: false, tick: (v) => v.toFixed(2)});
  }
  if (mac.wage) { const w2 = mac.wage.slice(-12); lineChart(document.getElementById('wageChart'), w2.map((r) => r[3] ? 'Q' + r[3] + ' ' + String(r[2]).slice(2) : r[0]), [{name: 'Average salary', color: 'var(--ok)', values: w2.map((r) => r[1])}], (v) => 'GEL ' + fN(v), {h: 180, zero: false, tick: (v) => fK(v)}); }

  /* yearly growth and inflation (World Bank) */
  const gq = mac.wb['NY.GDP.MKTP.KD.ZG'] || [], iq = mac.wb['FP.CPI.TOTL.ZG'] || [];
  const fr = [...new Set(gq.map((r) => r[0]))].sort().slice(-6).reverse().map((y) => {
    const g = gq.find((r) => r[0] === y), p = iq.find((r) => r[0] === y);
    return h('tr', null, [h('td', {text: String(y)}), h('td', {cls: 'n', text: g ? g[1].toFixed(1) + '%' : '–'}), h('td', {cls: 'n', text: p ? p[1].toFixed(1) + '%' : '–'})]);
  });
  document.getElementById('imfTable').replaceChildren(h('tr', null, ['Year', 'GDP growth', 'Inflation'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))), ...fr);
  const wbYears = [...new Set(Object.values(mac.wb).flatMap((l) => l.map((r) => r[0])))].sort().slice(-5);
  const fmtWb = (u, v) => v == null ? '–' : u === '%' ? v.toFixed(1) + '%' : u === '$' ? '$' + fN(v) : fK(v);
  document.getElementById('wbTable').replaceChildren(h('tr', null, ['Indicator', ...wbYears].map((x, i) => h('th', {cls: i ? 'n' : '', text: String(x)}))),
    ...WB_IND.map(([code, name, u]) => h('tr', null, [h('td', {text: name}), ...wbYears.map((y) => { const r = (mac.wb[code] || []).find((x) => x[0] === y); return h('td', {cls: 'n', text: fmtWb(u, r ? r[1] : null)}); })])));
  document.getElementById('rateTable').replaceChildren(h('tr', null, ['Decision date', 'Rate', 'Change'].map((x, i) => h('th', {cls: i ? 'n' : '', text: x}))),
    ...(mac.rate || []).map((r) => h('tr', null, [h('td', {text: new Date(r[0]).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}), h('td', {cls: 'n', text: r[1].toFixed(2) + '%'}), h('td', {cls: 'n ' + (r[2] > 0 ? 'down' : r[2] < 0 ? 'up' : 'flat'), text: r[2] ? (r[2] > 0 ? '+' : '') + r[2].toFixed(2) + ' pp' : 'no change'})])));

  /* what it means */
  const pts = [];
  if (fx && yAgo) { const d = pct(fx.USD, yAgo.USD); pts.push(d < -1 ? 'The lari is ' + Math.abs(d).toFixed(1) + '% stronger against the dollar than a year ago: US and Japanese cars cost less in lari, which supports sales.' : d > 1 ? 'The lari is ' + d.toFixed(1) + '% weaker against the dollar than a year ago: imported cars cost more in lari, so keep stock turning fast.' : 'The lari is stable against the dollar compared with a year ago.'); }
  if (fx && yAgo && yAgo.EUR) { const d = pct(fx.EUR, yAgo.EUR); if (Math.abs(d) > 3) pts.push('The euro is ' + (d > 0 ? d.toFixed(1) + '% dearer' : Math.abs(d).toFixed(1) + '% cheaper') + ' in lari than a year ago, which matters for cars bought in Germany.'); }
  if (wL && wP) { const g = pct(wL[1], wP[1]), inf = cpiL ? cpiL[1] : 0; pts.push('Salaries grew ' + g.toFixed(1) + '% in a year' + (cpiL ? ' against ' + inf.toFixed(1) + '% inflation, so real buying power ' + (g > inf ? 'is rising: good for demand, including pricier cars.' : 'is falling: price-sensitive buyers, favour cheaper, popular models.') : '.')); }
  if (gdpL) pts.push('The economy grew ' + gdpL[1] + '% (' + gdpL[0] + ')' + (gdpL[1] >= 5 ? ': strong demand backdrop.' : gdpL[1] >= 2 ? ': moderate demand backdrop.' : ': weak demand backdrop, keep stock lean.'));
  if (rate) pts.push('Policy rate ' + rate[1].toFixed(2) + '%' + (rate[1] >= 8 ? ': car loans and leasing stay expensive, so cash buyers and lower price points dominate.' : ': credit is getting cheaper, which helps financed purchases.'));
  if (remitL) pts.push('Money sent home by Georgians abroad is ' + remitL[1].toFixed(1) + '% of GDP (' + remitL[0] + '): an important source of cash for car purchases.');
  document.getElementById('macroMeaning').replaceChildren(...(pts.length ? pts.map((p) => h('li', {text: p})) : [h('li', {text: 'Download the data to see the summary.'})]));
}
