'use strict';
/* ======================================================================
   Dealer opportunities: rising car brands with no official importer in
   Georgia, ranked for a dealer who wants to apply as official distributor.
   Live part: first registrations per brand and year in Georgia (Geostat,
   compare-line service, full years from 2017). Fixed part: research done in
   November 2026 (global sales, Georgian and regional presence, how to apply).
   ====================================================================== */
const DKEY = 'gcm_dealer_v1';
/* g: global momentum 0-25, f: product fit for Georgia 0-20, a: how open the seat is 0-20 */
const D_BRANDS = [
  {id: 'lynk', name: 'Lynk & Co', geo: ['LYNK&CO'], grp: 'Geely group, China', sales: 'Part of Geely Auto: 3.02M in 2025 (+39%)', exp: 'Geely exports ~0.9M Jan–Oct 2026', pt: 'Hybrid, plug-in hybrid, electric', pos: 'Upper-mid', models: '08 / 06 EM-P plug-in SUVs, 900 (est. $35–50k)',
    ge: 'No official dealer found. Tegeta Cars holds Geely and Zeekr, so it may claim Lynk & Co first.', reg: 'Not confirmed in Armenia, Azerbaijan or Türkiye.', apply: 'No public form: Geely picks partners by negotiation. Contact Lynk & Co International (Geely export).', risk: 'Lynk & Co is being merged into Zeekr; check who signs overseas deals.', g: 15, f: 16, a: 10},
  {id: 'avatr', name: 'Avatr', geo: ['AVATR'], grp: 'Changan / CATL / Huawei, China', sales: 'Part of Changan: 2.91M in 2025 (+8.5%)', exp: 'Changan exports 637k in 2025 (+19%)', pt: 'Range-extender, electric', pos: 'Premium', models: 'Avatr 11, 12, 07 (est. $40–60k)',
    ge: 'No official dealer found. SR Auto Georgia holds Changan and Deepal and may have first right.', reg: 'Changan official in Armenia (Ciar Auto) and Kazakhstan.', apply: 'Ask Changan International / Avatr overseas; check SR Auto’s contract first.', risk: 'Changan’s China sales down in 2026; premium price.', g: 14, f: 13, a: 10},
  {id: 'leap', name: 'Leapmotor', geo: ['LEAPMOTOR'], grp: 'Leapmotor, China (Stellantis partner)', sales: '596,555 in 2025 (+103%)', exp: '181k Jan–Oct 2026 (+308%)', pt: 'Electric, range-extender', pos: 'Budget–mid', models: 'T03 (~€18k), B10 (~€30k), C10 (~€35k)',
    ge: 'Open. Exports run through Leapmotor International (Stellantis), so the Georgian Stellantis importer is the likely route.', reg: 'Official in Türkiye via Stellantis.', apply: 'Through Stellantis / Leapmotor International (its international site redirects to stellantis.com).', risk: 'No petrol models; you depend on Stellantis’ choice of partner.', g: 23, f: 15, a: 14},
  {id: 'xpeng', name: 'Xpeng', geo: ['XPENG', 'XIAOPENG'], grp: 'Xpeng, China', sales: '429,445 in 2025 (+126%)', exp: '45,008 in 2025 (+96%)', pt: 'Electric (range-extender coming)', pos: 'Mid–premium', models: 'G6 (€42–48k), G9 (€55–65k), Mona M03',
    ge: 'Open: only grey imports.', reg: 'No confirmed distributor in the region.', apply: 'No public form. Contact Xpeng International (Amsterdam / Guangzhou).', risk: 'Electric only; 2026 sales −6%.', g: 19, f: 12, a: 16},
  {id: 'omoda', name: 'Omoda & Jaecoo', geo: ['OMODA', 'JAECOO'], grp: 'Chery group, China', sales: 'Over 800k (brand figure), almost all abroad', exp: 'Chery group exports 1.34M in 2025 (+17%)', pt: 'Petrol, plug-in hybrid, electric', pos: 'Budget–mid', models: 'Omoda 5 (€25–30k), Jaecoo 7 plug-in (€33–38k)',
    ge: 'Unclear: Sena Auto Group is Chery’s exclusive distributor and may already hold these brands.', reg: 'Official in Türkiye; likely in Kazakhstan and Uzbekistan.', apply: 'Chery International recruits through country distributors: ask whether Georgia is free.', risk: 'Probably covered by the Chery contract.', g: 22, f: 17, a: 6},
  {id: 'exeed', name: 'Exeed', geo: ['EXEED'], grp: 'Chery group, China', sales: '120,369 in 2025', exp: 'n/a', pt: 'Petrol, plug-in hybrid', pos: 'Upper-mid', models: 'RX, VX, TXL SUVs (est. $35–45k)',
    ge: 'Unclear: may be part of Sena Auto Group’s Chery rights.', reg: 'Reported in Azerbaijan, Kazakhstan, Uzbekistan.', apply: 'Chery International.', risk: 'Low brand awareness; probably covered by the Chery contract.', g: 12, f: 14, a: 6},
  {id: 'gac', name: 'GAC (Aion, Hyptec)', geo: ['AION', 'GAC', 'HYPTEC'], grp: 'GAC Group, China (state-owned)', sales: '1.72M in 2025 (−14%)', exp: '~130k in 2025 (+45%)', pt: 'Petrol, hybrid, plug-in hybrid, electric', pos: 'Mid', models: 'GS3 ($17–20k), GS8 hybrid ($35–40k), Aion V',
    ge: 'Unclear: an “Aion Motors Georgia” shop exists, but no proof GAC authorised it. GAC lists Georgia without a partner.', reg: 'Official in Kazakhstan (Allur).', apply: 'Public form: gacgroup.com/en/become-a-partner', risk: 'First loss since 2010 (RMB 8.8bn in 2025).', g: 11, f: 15, a: 12},
  {id: 'voyah', name: 'Voyah', geo: ['VOYAH'], grp: 'Dongfeng, China (state-owned)', sales: '150,169 in 2025 (+87%)', exp: 'Dongfeng exports +97% in H1 2026', pt: 'Plug-in hybrid, range-extender, electric', pos: 'Premium', models: 'Free (~€60k), Dream MPV (~€70k)',
    ge: 'Open: no Georgian dealer found.', reg: 'Entered Azerbaijan; reported in Kazakhstan and Uzbekistan.', apply: 'No public form. Contact Dongfeng / Voyah overseas.', risk: 'Premium price in a price-sensitive market; missed its 200k target.', g: 15, f: 11, a: 16},
  {id: 'baic', name: 'BAIC', geo: ['BAIC'], grp: 'BAIC Group, China (state-owned)', sales: '1.75M in 2025 (+3–6%)', exp: '308k in 2025 (+14–26%)', pt: 'Petrol, diesel, plug-in hybrid, electric', pos: 'Budget–mid', models: 'BJ40 off-roader ($30–35k), X55 ($18–25k)',
    ge: 'Open. Georgia’s government invited BAIC to build an EV assembly plant (Apr 2026).', reg: 'Arcfox (BAIC) official in Armenia via E-auto.', apply: 'BAIC International; ask about the Georgian plant talks.', risk: 'Weak brand and dealer support abroad.', g: 10, f: 14, a: 16},
  {id: 'dong', name: 'Dongfeng (cars)', geo: ['DONGFENG'], grp: 'Dongfeng, China (state-owned)', sales: '1.90M in 2025 (flat, incl. Voyah)', exp: '~295k', pt: 'Petrol, plug-in hybrid, electric', pos: 'Budget', models: 'Mage, Shine, Box EV (est. $15–25k)',
    ge: 'No dealer for passenger cars found (Forthing, a Dongfeng brand, is with E-Motors Georgia).', reg: 'Reported in Kazakhstan, Uzbekistan, Türkiye.', apply: 'Dongfeng overseas.', risk: 'State-owned restructuring; many scattered brands.', g: 8, f: 12, a: 13},
  {id: 'nio', name: 'NIO', geo: ['NIO'], grp: 'NIO, China', sales: '326,028 in 2025 (+47%)', exp: 'Small', pt: 'Electric (battery swap)', pos: 'Premium', models: 'ET5 (€47–55k), ES6, Onvo L60',
    ge: 'Open.', reg: 'Official in Armenia (N-Motors) and Azerbaijan (Green Car).', apply: 'No public form. NIO already works with Caucasus importers: contact them or NIO International.', risk: 'Lost RMB 14.9bn in 2025; battery swap needs its own stations.', g: 9, f: 8, a: 16},
  {id: 'xiaomi', name: 'Xiaomi', geo: ['XIAOMI'], grp: 'Xiaomi, China', sales: 'Over 410k in 2025', exp: 'None yet (first exports Nov 2026, UAE)', pt: 'Electric', pos: 'Mid–premium', models: 'SU7 ($30–42k), YU7 ($36–45k)',
    ge: 'Open. Georgia’s government invited Xiaomi to build an assembly plant (talks only).', reg: 'Not in the region yet.', apply: 'Not appointing dealers in Europe/Caucasus before ~2027.', risk: 'Cannot get supply before 2027.', g: 18, f: 12, a: 3},
  {id: 'denza', name: 'Denza', geo: ['DENZA'], grp: 'BYD group, China', sales: 'Part of BYD (4.6M, +8%)', exp: 'BYD exports 1.51M Jan–Oct 2026 (+94%)', pt: 'Plug-in hybrid, electric', pos: 'Premium', models: 'D9 MPV, Z9 GT',
    ge: 'Likely GT Group (BYD’s exclusive dealer tested Denza in May 2026).', reg: 'Follows BYD’s importers.', apply: 'Through BYD overseas; GT Group probably first.', risk: 'Probably goes to the BYD dealer.', g: 12, f: 11, a: 4},
  {id: 'aito', name: 'Seres / AITO', geo: ['AITO', 'SERES'], grp: 'Seres with Huawei, China', sales: 'AITO over 420k in 2025', exp: 'Very small', pt: 'Range-extender, electric', pos: 'Premium', models: 'M7 ($40–50k), M9 ($65–80k)',
    ge: 'Open.', reg: 'Official in Türkiye.', apply: 'Seres overseas; no export programme for the Caucasus yet.', risk: 'No real export programme.', g: 12, f: 10, a: 6},
  {id: 'vinfast', name: 'VinFast', geo: ['VINFAST'], grp: 'Vingroup, Vietnam', sales: '196,919 in 2025 (+102%)', exp: '~22k (est.)', pt: 'Electric', pos: 'Budget–mid', models: 'VF5 (~$20k), VF6 ($25–30k)',
    ge: 'Open.', reg: 'Not in the region.', apply: 'VinFast dealer programme (vinfastauto.com).', risk: 'Lost about $3.9bn in 2025.', g: 8, f: 11, a: 14},
  {id: 'polestar', name: 'Polestar', geo: ['POLESTAR'], grp: 'Geely / Volvo, Sweden–China', sales: 'Small, falling', exp: 'n/a', pt: 'Electric', pos: 'Premium', models: 'Polestar 2, 3, 4',
    ge: 'No dealer found (Tegeta holds Volvo, Geely, Zeekr).', reg: 'n/a', apply: 'Polestar sells mostly direct or via Volvo partners.', risk: 'Weak finances; Volvo partner has first claim.', g: 6, f: 9, a: 8},
  {id: 'togg', name: 'Togg', geo: ['TOGG'], grp: 'Togg, Türkiye', sales: '~39,000 in 2025', exp: '144 cars delivered in Germany', pt: 'Electric', pos: 'Mid', models: 'T10X, T10F (~€37–40k)',
    ge: 'Open.', reg: 'Türkiye only (plus Germany).', apply: 'Togg export team.', risk: 'Very small capacity; exports just starting.', g: 5, f: 9, a: 4}
];
const D_TAKEN = [
  ['BYD', ['BYD'], 'GT Group (exclusive, 2026)'], ['Chery', ['CHERY'], 'Sena Auto Group (2025)'], ['JAC', ['JAC'], 'Sena Auto Group'],
  ['Jetour', ['JETOUR'], 'E-Motors Georgia (2023)'], ['Geely', ['GEELY'], 'Tegeta Cars (2023)'], ['Zeekr', ['ZEEKR'], 'Tegeta Cars (2024)'],
  ['Changan, Deepal', ['CHANGAN', 'DEEPAL'], 'SR Auto Georgia'], ['GWM: Haval, Tank, ORA', ['HAVAL', 'TANK', 'GWM', 'GREAT WALL', 'ORA'], 'GWM Georgia, gwm.ge (2026)'],
  ['Li Auto', ['LIXIANG', 'LI'], 'DMG Group (exclusive, 2025)'], ['MG', ['MG'], 'Strada Group'], ['Hongqi', ['HONGQI'], 'E-auto (Armenia, 2026)'], ['Forthing', ['FORTHING'], 'E-Motors Georgia']
];
let dealer = {s: {}, start: 2017, updated: null};
try { const s0 = JSON.parse(localStorage.getItem(DKEY)); if (s0 && s0.s) dealer = Object.assign(dealer, s0); } catch (e) {}
let dBusy = false, dErr = '', dSel = null, dPicked = false, dTried = false;

function dNames() { const all = ['TESLA']; D_BRANDS.forEach((b) => all.push(...b.geo)); D_TAKEN.forEach((t) => all.push(...t[1])); return [...new Set(all)]; }
async function dealerSync(force) {
  const age = dealer.updated ? (Date.now() - new Date(dealer.updated).getTime()) / 864e5 : 99;
  if (dBusy || (!force && (age < 7 || dTried))) return;
  dBusy = true; dErr = ''; dTried = true;
  const names = dNames(), s = {};
  try {
    for (let i = 0; i < names.length; i += 2) {
      setDStatus('Downloading brand registrations from Geostat… ' + Math.round(i / names.length * 100) + '%');
      const a = names[i], b = names[i + 1] || 'TOYOTA';
      const j = await gGet('compare-line?brand1=' + encodeURIComponent(a) + '&brand2=' + encodeURIComponent(b) + '&model1=&model2=');
      if (j && j.pointStart) dealer.start = j.pointStart;
      ((j && j.data) || []).forEach((x) => { s[String(x.name).trim()] = x.data.map((v) => +v || 0); });
    }
    dealer.s = s; dealer.updated = new Date().toISOString();
    try { localStorage.setItem(DKEY, JSON.stringify(dealer)); } catch (e) {}
  } catch (e) { dErr = e.message; }
  dBusy = false;
  renderDealer();
}
function setDStatus(t) { const e = document.getElementById('dStatus'); if (e) e.textContent = t; }
function dSeries(geoNames) {
  const len = Math.max(0, ...Object.values(dealer.s).map((a) => a.length));
  const out = new Array(len).fill(0);
  geoNames.forEach((n) => (dealer.s[n] || []).forEach((v, i) => { out[i] += v; }));
  return out;
}
function dScore(b) {
  const s = dSeries(b.geo), n = s[s.length - 1] || 0, p = s[s.length - 2] || 0;
  const demand = Math.min(25, 7 * Math.log10(1 + n));
  let mom = 0;
  if (p >= 5) mom = Math.max(-5, Math.min(10, (n / p - 1) * 5)); else if (n >= 10) mom = 8;
  return {n, p, demand, mom, total: Math.round(demand + mom + b.g + b.f + b.a)};
}
function dVerdict(t) { return t >= 60 ? ['Strong', 'up'] : t >= 50 ? ['Good', 'acc'] : t >= 40 ? ['Watch', 'flat'] : ['Weak', 'down']; }

function renderDealer() {
  const sec = document.getElementById('dealer');
  if (!sec) return;
  const visible = !sec.hidden;
  if (visible) dealerSync(false);
  const have = Object.keys(dealer.s).length > 0;
  const ly = have ? dealer.start + Math.max(0, ...Object.values(dealer.s).map((a) => a.length)) - 1 : null;
  if (!dBusy) setDStatus(dErr ? 'Download stopped (' + dErr + '). Tap Refresh to try again.' : have ? 'Georgian registrations to ' + ly + ' (Geostat, full years) · global and dealer facts researched Nov 2026.' : 'Open this tab while online to download Georgian registrations.');

  const rows = D_BRANDS.map((b) => Object.assign({b}, dScore(b))).sort((x, y) => y.total - x.total);
  if (!dPicked) dSel = rows[0].b.id;
  const t = document.getElementById('dTable');
  t.replaceChildren(h('tr', null, ['Brand', 'Score', 'Cars ' + (ly || ''), 'vs ' + (ly ? ly - 1 : 'prev'), ''].map((x, i) => h('th', {cls: i && i < 4 ? 'n' : '', text: x}))),
    ...rows.map((r, i) => {
      const c = chg(r.p ? pct(r.n, r.p) : null), v = dVerdict(r.total);
      const tr = h('tr', {cls: 'click' + (r.b.id === dSel ? ' sel' : '')}, [h('td', {text: r.b.name}), h('td', {cls: 'n', text: String(r.total)}),
        h('td', {cls: 'n', text: have ? fN(r.n) : '…'}), h('td', {cls: 'n ' + c.c, text: c.t || (r.n ? 'new' : '–')}), h('td', null, [h('span', {cls: 'pill ' + v[1], text: v[0]})])]);
      tr.addEventListener('click', () => { dSel = r.b.id; dPicked = true; renderDealer(); document.getElementById('dDetail').scrollIntoView({behavior: 'smooth', block: 'start'}); });
      return tr;
    }));

  /* detail */
  const r = rows.find((x) => x.b.id === dSel), b = r.b;
  document.getElementById('dDetailTitle').textContent = b.name + ': score ' + r.total + ' / 100 (' + dVerdict(r.total)[0].toLowerCase() + ')';
  const facts = [['Group', b.grp], ['Global sales', b.sales], ['Exports', b.exp], ['Powertrains', b.pt], ['Price level', b.pos], ['Key models (prices est.)', b.models],
    ['In Georgia', b.ge], ['Nearby markets', b.reg], ['How to apply', b.apply], ['Main risk', b.risk]];
  document.getElementById('dFacts').replaceChildren(...facts.map(([k, v]) => h('tr', null, [h('td', {cls: 'k', text: k}), h('td', {text: v})])));
  const parts = [['Georgian demand (live)', r.demand, 25], ['Georgian growth (live)', r.mom, 10], ['Global momentum', b.g, 25], ['Fit for Georgia', b.f, 20], ['Seat open', b.a, 20]];
  document.getElementById('dParts').replaceChildren(...parts.map(([k, v, m]) => h('tr', null, [h('td', {text: k}), h('td', {cls: 'n ' + (v < 0 ? 'down' : ''), text: (Math.round(v * 10) / 10) + ' / ' + m})])));
  if (have) {
    const s = dSeries(b.geo), cats = s.map((_, i) => String(dealer.start + i));
    const from = Math.max(0, cats.length - 6);
    barChart(document.getElementById('dChart'), cats.slice(from), [{name: b.name, color: 'var(--accent)', values: s.slice(from), labelTop: true}], (v) => fN(v) + ' cars registered');
  }

  /* trend of the top candidates */
  if (have) {
    const top = rows.slice(0, 5), s0 = dSeries(top[0].b.geo), from = Math.max(0, s0.length - 5);
    const cats = s0.slice(from).map((_, i) => String(dealer.start + from + i));
    legendOf(document.getElementById('dTrendLegend'), top.map((x, i) => [x.b.name, PALETTE[i]]));
    lineChart(document.getElementById('dTrend'), cats, top.map((x, i) => ({name: x.b.name, color: PALETTE[i], values: dSeries(x.b.geo).slice(from)})), (v) => fN(v) + ' cars');
  }

  /* taken */
  document.getElementById('dTaken').replaceChildren(h('tr', null, ['Brand', 'Official dealer', 'Cars ' + (ly || ''), 'vs prev'].map((x, i) => h('th', {cls: i > 1 ? 'n' : '', text: x}))),
    ...D_TAKEN.map(([n, g, d]) => ({n, d, s: dSeries(g)})).sort((x, y) => (y.s[y.s.length - 1] || 0) - (x.s[x.s.length - 1] || 0)).map((x) => {
      const a = x.s[x.s.length - 1] || 0, p = x.s[x.s.length - 2] || 0, c = chg(p ? pct(a, p) : null);
      return h('tr', null, [h('td', {text: x.n}), h('td', {text: x.d}), h('td', {cls: 'n', text: have ? fN(a) : '…'}), h('td', {cls: 'n ' + c.c, text: c.t || '–'})]);
    }));
  const ts = dSeries(['TESLA']), tn = ts[ts.length - 1] || 0, tp = ts[ts.length - 2] || 0;
  document.getElementById('dTesla').textContent = have ? 'Tesla: ' + fN(tn) + ' cars registered in Georgia in ' + ly + (tp ? ' (' + chg(pct(tn, tp)).t + ')' : '') + ', all imported privately. Tesla sells direct and does not appoint dealers, so it is not on the list, but it shows how strong demand for electric cars is.' : '';
}
