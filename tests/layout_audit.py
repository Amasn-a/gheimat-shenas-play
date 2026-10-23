"""Layout audit of the play redesign across device sizes: real game flow for live states, direct renders (redesign.js
with stress data: longest catalog title, largest price) for celebrations, result variants and system pages. Reports
horizontal overflow, clipping, screens that overflow (would scroll), small touch targets, cut text and an unreachable CTA.

    python3 -m http.server 8765 &
    python3 tests/layout_audit.py OUT_DIR [320x568,390x844,...]      # PE_IMG_DIR=dir of .webp stand-ins (optional)
"""
import base64, json, os, pathlib, re, sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8765/'
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
SIZES = [s for s in (sys.argv[2] if len(sys.argv) > 2 else
         '320x568,360x640,360x780,375x667,375x812,390x844,393x873,412x732,412x915,430x932,480x800,768x1024,1280x720').split(',')]
IMGS = [p.read_bytes() for p in sorted(pathlib.Path(os.environ.get('PE_IMG_DIR', '/nonexistent')).glob('*.webp')) if p.name != 'price-tags.webp'] or \
       [base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')]

CHECK = r"""(tag) => {
  const W = innerWidth, H = innerHeight, issues = [];
  const app = document.querySelector('#app').getBoundingClientRect();
  const root = document.querySelector('.q-cphost .rd') || document.querySelector('.q-screenhost .rd');
  if (!root) return ['no .rd root'];
  const scroller = e => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { if (p.classList.contains('screen')) continue; const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return p; } return null; };
  const vis = e => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]') && +s.opacity !== 0; };
  const name = e => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || e.tagName).toString().split(' ')[0] || e.tagName;
  for (const e of root.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg') && e.tagName !== 'svg') continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const sc = scroller(e);
    if (!sc && !e.closest('.history')) {
      if (r.right > app.right + 1 || r.left < app.left - 1) issues.push(`h-overflow ${name(e)} ${Math.round(r.left - app.left)}..${Math.round(r.right - app.left)}`);
      if (r.bottom > app.bottom + 1 && !e.closest('.sheet-layer') && !e.matches('.splash-circles,.splash-circles *,.badge-halo,.hero-backdrop'))
        issues.push(`clipped-bottom ${name(e)} bottom ${Math.round(r.bottom - app.top)} > ${Math.round(app.height)}`);
      if (r.top < app.top - 1 && !e.matches('.badge-halo,.hero-backdrop,.splash-circles')) issues.push(`clipped-top ${name(e)}`);
    }
    if (e.matches('button:not([disabled]), [role=button]') && (r.height < 44 || r.width < 44) && !e.matches('.link-btn,.daily-link'))
      issues.push(`small-target ${name(e)} ${Math.round(r.width)}x${Math.round(r.height)} "${e.innerText.trim().slice(0, 16)}"`);
    // single-line text overflowing its own box (not intended clamps)
    const cs = getComputedStyle(e);
    if (e.children.length === 0 && e.innerText && e.innerText.trim() && e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible' && !cs.webkitLineClamp?.match(/\d/))
      issues.push(`text-cut ${name(e)} "${e.innerText.trim().slice(0, 20)}"`);
  }
  for (const sc of root.querySelectorAll('.screen')) if (sc.scrollHeight > sc.clientHeight + 1) issues.push(`screen-overflows ${sc.className.split(' ')[1]} by ${sc.scrollHeight - sc.clientHeight}px`);
  // overlap of the main column blocks (direct children of .screen)
  const scr = root.querySelector('.screen');
  if (scr) {
    const kids = [...scr.children].filter(k => vis(k) && getComputedStyle(k).position !== 'absolute' && k.getBoundingClientRect().height);
    for (let i = 0; i + 1 < kids.length; i++) { const a = kids[i].getBoundingClientRect(), b = kids[i + 1].getBoundingClientRect();
      if (b.top < a.bottom - 1) issues.push(`overlap ${name(kids[i])}/${name(kids[i + 1])} ${Math.round(a.bottom - b.top)}px`); }
  }
  // primary action reachable
  const cta = root.querySelector('.bottom-actions .btn, .answer-buttons .answer');
  if (cta) { const r = cta.getBoundingClientRect(); if (r.bottom > app.bottom + 1) issues.push(`CTA below fold by ${Math.round(r.bottom - app.bottom)}px`); }
  return issues;
}"""


def run(pw, size):
    w, h = map(int, size.split('x'))
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
    i = [0]
    def img(route):
        i[0] += 1; route.fulfill(status=200, body=IMGS[i[0] % len(IMGS)])
    ctx.route(re.compile(r'https://dkstatics-public\.digikala\.com/.*'), img)
    p = ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(BASE)
    rd = lambda: p.evaluate("document.querySelector('#app').dataset.rd || ''")
    wait = lambda *ids, t=20000: p.wait_for_function("ids => ids.some(i => (document.querySelector('#app').dataset.rd || '').startsWith(i))", arg=list(ids), timeout=t)
    srv = lambda e: p.evaluate(f"import('/play/server.js').then(m => {e})")
    res = {}
    def check(tag):
        p.wait_for_timeout(300)
        res[tag] = p.evaluate(CHECK, tag)
        p.screenshot(path=str(OUT / f'{size}-{tag}.png'))
    def home():
        p.wait_for_selector('[data-act="start"], [data-act="daily-close"], [data-countdown]')
        if rd() == 'daily': p.click('[data-act="daily-close"]'); p.wait_for_selector('[data-act="start"], [data-countdown]')
    def reveal():
        wait('ready'); p.wait_for_timeout(600); p.click('[data-act="reveal"]'); wait('active', 'urgent')
    def ans(right):
        c = srv('m.reviewer.correctChoice()'); p.click(f'[data-act="ans-{c if right else ("lower" if c == "higher" else "higher")}"]')
    wait('onboarding'); p.click('[data-act="onb-skip"]'); wait('home'); home(); check('home-new')
    p.click('[data-act="guide"]'); wait('help'); check('help'); p.click('.bottom-actions [data-act="guide-close"]'); home()
    p.click('[data-act="start"]'); wait('ready'); check('ready')
    reveal(); p.wait_for_timeout(500); check('active')
    p.click('[data-act="back"]'); wait('exit'); check('exit'); p.keyboard.press('Escape')
    wait('urgent', t=12000); check('urgent')
    ans(True); wait('correct'); check('correct'); p.click('[data-act="fb-next"]')
    reveal(); ans(False); wait('wrong'); check('wrong'); p.click('[data-act="fb-next"]'); wait('result'); check('result-no-badge')
    p.click('.bottom-actions [data-act="loss-home"]'); home(); p.wait_for_timeout(1200); check('home')
    srv('m.reviewer.seedAttended(3)'); p.reload(); wait('daily'); check('daily'); p.click('[data-act="daily-close"]'); home()
    srv('m.reviewer.setBalance(3)'); p.reload(); home()
    p.click('[data-act="start"]'); wait('ready')
    srv('(m.net.offline = true, window.dispatchEvent(new Event("offline")))'); wait('offline'); check('offline')
    srv('(m.net.offline = false)'); p.click('[data-act="reconnect"]'); wait('ready')
    reveal(); ans(False); wait('wrong'); p.click('[data-act="fb-next"]'); wait('insufficient'); check('insufficient')
    p.click('.bottom-actions [data-act="loss-home"]'); home()
    # direct renders with stress data (longest catalog title, largest price, 3-digit score, 5-digit balance)
    stress = {'displayTitle': 'سشوار برس‌دار انزو پروفیشینال EN-4133 PRO ۱۵۰۰ وات', 'imageUrl': 'https://dkstatics-public.digikala.com/x.jpg', 'price': 472500000}
    renders = {
        'checkpoint-5': "R.checkpoint(cps[0], 0, null, cps[1])", 'checkpoint-10': "R.checkpoint(cps[1], 1, {amount:1,status:'succeeded'}, cps[2])",
        'checkpoint-20': "R.checkpoint(cps[3], 3, {amount:5,status:'delayed'}, null)", 'record': "R.record(127, {amount:1,status:'succeeded'})",
        'result-badge-stress': "R.result({reason:'wrong', score:127, best:127, cp:cps[3], cpIndex:3, fb:{product:P, revealedPrice:P.price, direction:'higher'}, balance:99999, cost:5, cont:'pay', alert:null})",
        'payment-failed-stress': "R.result({reason:'timeout', score:14, best:127, cp:cps[1], cpIndex:1, fb:{product:P, revealedPrice:P.price, direction:'lower'}, balance:99999, cost:5, cont:'failed', alert:{kind:'error',icon:'alert',html:'ادامه انجام نشد؛ دیجی‌کوینی کم نشد.<br>دوباره تلاش کن یا به صفحه اصلی برگرد.'}})",
        'payment-pending': "R.result({reason:'wrong', score:7, best:9, cp:cps[0], cpIndex:0, fb:{product:P, revealedPrice:P.price, direction:'lower'}, balance:120, cost:5, cont:'unknown', homeLocked:true, alert:{kind:'info',icon:'spin',html:'وضعیت درخواست هنوز مشخص نیست؛ داریم بررسی می‌کنیم.<br>درخواست تازه‌ای ثبت نمی‌شه.'}})",
        'active-stress': "R.game({st:'urgent', score:127, cps, target:130, ref:P, product:P, inputMs:10000, tm:{t:'۲٫۷', p:.27, label:''}, imgWait:false})",
        'wrong-stress': "R.game({st:'wrong', score:127, cps, target:130, ref:P, product:P, inputMs:10000, pick:'higher', revealedPrice:P.price, direction:'lower'})",
        'reconnecting': "R.system('reconnecting')", 'error': "R.system('error')",
    }
    for tag, expr in renders.items():
        p.evaluate(f"""async () => {{ const R = await import('/src/redesign.js'); const G = await import('/src/game.js');
          const cps = (G.S.boot.config || G.S.run.runConfig).checkpoints; const P = {json.dumps(stress)};
          document.querySelector('.q-cphost').innerHTML = {expr}; }}""")
        check(tag)
    b.close()
    return res, errs


with sync_playwright() as pw:
    report = {}
    for s in SIZES:
        try:
            report[s] = run(pw, s)
        except Exception as e:
            report[s] = ({'FLOW-FAILED': [str(e).splitlines()[0]]}, [])
        bad = {k: v for k, v in report[s][0].items() if v}
        print(f'== {s}: {sum(len(v) for v in bad.values())} issues in {len(bad)} states', flush=True)
        for k, v in bad.items():
            for x in sorted(set(v))[:8]: print(f'   {k}: {x}')
        if report[s][1]: print('   JS errors:', report[s][1][:3])
