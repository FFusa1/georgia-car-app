"""Builds snapshot.json for the web version of the app.

Web pages are not allowed to call UN Comtrade or the NBG policy-rate page directly,
so GitHub Actions downloads the same data the Android app downloads and publishes it
next to the web app. Usage: python snapshot.py <old snapshot or ''> <output file>
Data that fails to download is kept from the old snapshot.
"""
import json, re, sys, time, urllib.request, urllib.error
from datetime import date, datetime, timezone

API = 'https://comtradeapi.un.org/public/v1/preview/C/'
NAMES_URL = 'https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json'
NBG_MPC = 'https://nbg.gov.ge/en/monetary-policy/committee-decisions'
CODES = ['8703', '870321', '870322', '870323', '870324', '870331', '870332', '870333', '870340',
         '870350', '870360', '870370', '870380', '870390']
MAKERS = [156, 276, 392, 410, 842, 484, 724, 792, 203, 826]
MARKETS = [398, 417, 860, 31, 51, 762]


def get(url):
    for i in range(6):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (georgia-car-app snapshot)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode('utf-8')
            time.sleep(1.2)
            return body
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(3 + i * 2)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(3 + i * 2)
    raise RuntimeError('gave up on ' + url)


def rows(freq, periods, query):
    """The free Comtrade preview takes one period per request."""
    data = []
    for p in periods:
        j = json.loads(get(API + freq + '/HS?period=' + str(p) + query))
        if j.get('error'):
            raise RuntimeError(j['error'])
        data += j.get('data') or []
    return data


def by_period(data):
    out = {}
    for r in data:
        out.setdefault(str(r['period']), []).append(r)
    return out


def pack(rs):
    o = {'M': {}, 'X': {}}
    for r in rs:
        if r['flowCode'] in o:
            o[r['flowCode']][r['cmdCode']] = {'q': r.get('qty') or 0, 'v': r.get('primaryValue') or 0}
    return o


def has_data(p):
    t = p['M'].get('8703')
    return bool(t and t['v'] > 0)


def partner_rows(rs):
    return [{'f': r['flowCode'], 'c': r['partnerCode'], 'q': r.get('qty') or 0, 'v': r.get('primaryValue') or 0}
            for r in rs if r['partnerCode'] != 0 and r['flowCode'] in ('M', 'X')]


def chunks(xs, n):
    return [xs[i:i + n] for i in range(0, len(xs), n)]


def step(name, fn, errors):
    try:
        fn()
        print('ok  ', name)
    except Exception as e:  # keep going, old data stays
        print('FAIL', name, e)
        errors.append(name)


def main():
    old_path, out_path = sys.argv[1], sys.argv[2]
    snap = {}
    if old_path:
        try:
            with open(old_path, encoding='utf-8') as f:
                snap = json.load(f)
        except Exception:
            snap = {}
    st = snap.setdefault('store', {})
    for k in ('annual', 'monthly', 'partnersBy', 'partnersM'):
        st.setdefault(k, {})
    world = snap.setdefault('world', {})
    world.setdefault('exp', {})
    world.setdefault('imp', {})
    errors = []
    today = date.today()
    cy, cm = today.year, today.month
    years = list(range(2018, cy))
    months = []
    for y in range(cy - 3, cy + 1):
        for m in range(1, 13):
            if y == cy and m >= cm:
                break
            months.append(y * 100 + m)
    months = months[-36:]
    gq = '&reporterCode=268&flowCode=M,X'

    def annual():
        for p, rs in by_period(rows('A', years, gq + '&partnerCode=0&cmdCode=' + ','.join(CODES))).items():
            pk = pack(rs)
            if has_data(pk):
                st['annual'][p] = pk

    def monthly():
        for batch in chunks(months, 12):
            for p, rs in by_period(rows('M', batch, gq + '&partnerCode=0&cmdCode=' + ','.join(CODES))).items():
                pk = pack(rs)
                if has_data(pk):
                    st['monthly'][p] = pk

    def names():
        j = json.loads(get(NAMES_URL))
        st['names'] = {str(r['id']): {'n': r['text'], 'g': bool(r.get('isGroup'))} for r in j.get('results', [])}

    def partners_year():
        for batch in chunks(years[1:], 2):
            for p, rs in by_period(rows('A', batch, gq + '&cmdCode=8703')).items():
                lst = partner_rows(rs)
                if lst:
                    st['partnersBy'][p] = lst

    def partners_month():
        for batch in chunks(months, 3):
            for p, rs in by_period(rows('M', batch, gq + '&cmdCode=8703')).items():
                lst = partner_rows(rs)
                if lst:
                    st['partnersM'][p] = lst

    def world_side(kind, codes, flow):
        def run():
            q = '&reporterCode=' + ','.join(map(str, codes)) + '&flowCode=' + flow + '&partnerCode=0&cmdCode=8703,870380'
            for p, rs in by_period(rows('A', list(range(2019, cy)), q)).items():
                o = {}
                for r in rs:
                    o.setdefault(str(r['reporterCode']), {})[r['cmdCode']] = {'q': r.get('qty') or 0, 'v': r.get('primaryValue') or 0}
                if o:
                    world[kind][p] = o
        return run

    def rate():
        m = re.search(r'"monetaryPolicyRates":(\[[^\]]*\])', get(NBG_MPC))
        if not m:
            raise RuntimeError('page format changed')
        rs = [[str(r['date'])[:10], float(r['rate']), float(r.get('change') or 0)] for r in json.loads(m.group(1))]
        snap['rate'] = sorted(rs, key=lambda r: r[0], reverse=True)

    step('customs, yearly', annual, errors)
    step('customs, monthly', monthly, errors)
    step('country names', names, errors)
    step('countries, yearly', partners_year, errors)
    step('countries, monthly', partners_month, errors)
    step('world car exports', world_side('exp', MAKERS, 'X'), errors)
    step('re-export market imports', world_side('imp', MARKETS, 'M'), errors)
    step('NBG policy rate', rate, errors)

    now = datetime.now(timezone.utc).isoformat()
    if len(errors) < 8:
        snap['updated'] = now
    snap['failed'] = errors
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(snap, f, separators=(',', ':'))
    print('wrote', out_path, 'failed:', errors or 'none')


if __name__ == '__main__':
    main()
