#!/usr/bin/env python3
"""Screenshots of the play redesign states (handoff ids) for visual review. Drives the in-browser play server; slow
network / offline are simulated through play/server.js `net`. Product photos come from the CDN, or, with --img-dir, from
local files (review-only stand-ins; the game itself always uses the catalog's images).

    python3 -m http.server 8765 &
    python3 tests/screens.py OUT_DIR [--img-dir DIR] [--sizes 390x844,360x640,430x932] [--full]
"""
import argparse, itertools, pathlib, re
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--base', default='http://localhost:8765/'); ap.add_argument('--img-dir')
ap.add_argument('--sizes', default='390x844,360x640,430x932'); ap.add_argument('--full', action='store_true', help='every state at every size')
a = ap.parse_args()
OUT = pathlib.Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
IMGS = sorted(pathlib.Path(a.img_dir).glob('*.webp')) if a.img_dir else []
CRITICAL = {'home', 'active', 'urgent', 'result', 'insufficient', 'payment-failed', 'checkpoint-20', 'record', 'daily', 'help', 'exit'}


def page_for(browser, w, h, patch=None):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
    if IMGS:
        cyc = itertools.cycle(IMGS)
        ctx.route(re.compile(r'https://dkstatics-public\.digikala\.com/.*'), lambda r: r.fulfill(status=200, content_type='image/webp', body=next(cyc).read_bytes()))
    if patch:
        def serve(route):
            body = route.fetch().text()
            for k, v in patch.items():
                body = body.replace(k, v)
            route.fulfill(status=200, content_type='text/javascript', body=body)
        ctx.route('**/play/server.js', serve)
    p = ctx.new_page()
    p.goto(a.base)
    return p


def rd(p): return p.evaluate("document.querySelector('#app').dataset.rd || ''")
def wait(p, *ids, t=20000): p.wait_for_function("ids => ids.some(i => (document.querySelector('#app').dataset.rd || '').startsWith(i))", arg=list(ids), timeout=t)
def srv(p, e): return p.evaluate(f"import('/play/server.js').then(m => {e})")
def home(p):
    wait(p, 'onboarding', 'home', 'daily')
    if rd(p) == 'onboarding': p.click('[data-act="onb-skip"]')
    p.wait_for_selector('[data-act="start"], [data-act="daily-close"], [data-countdown]')
    if rd(p) == 'daily': p.click('[data-act="daily-close"]'); p.wait_for_selector('[data-act="start"], [data-countdown]')


def go(p, w, h):
    seen = set()
    def shot(name, force=False):
        if not (a.full or force or (w, h) == (390, 844) or name in CRITICAL) or (name, w) in seen: return
        seen.add((name, w)); p.wait_for_timeout(350)
        p.screenshot(path=str(OUT / f'{w}x{h}-{name}.png'))
    def answer(right):
        wait(p, 'active', 'urgent'); c = srv(p, 'm.reviewer.correctChoice()')
        p.click(f'[data-act="ans-{c if right else ("lower" if c == "higher" else "higher")}"]')
    def reveal():
        wait(p, 'ready'); p.wait_for_timeout(600); p.click('[data-act="reveal"]'); wait(p, 'active', 'urgent')
    def right(n, cps=False):
        for _ in range(n):
            reveal(); answer(True); wait(p, 'correct'); p.click('[data-act="fb-next"]'); wait(p, 'ready'); p.wait_for_timeout(750)
            while rd(p).startswith(('checkpoint', 'record')):
                if cps: p.wait_for_timeout(500); shot(rd(p))
                p.wait_for_timeout(300); p.click('.q-cphost [data-act="cp-go"]'); p.wait_for_function("!document.querySelector('.q-cphost').innerHTML")
    home(p); shot('home-new')
    p.click('[data-act="guide"]'); wait(p, 'help'); shot('help'); p.click('.bottom-actions [data-act="guide-close"]'); wait(p, 'home')
    # run 1: ready, loading, active, urgent → exit; checking; correct; checkpoint-5; wrong; result (badge) …
    p.click('[data-act="start"]'); wait(p, 'ready'); shot('ready')
    srv(p, '(m.net.latencyMs = 3000)'); p.wait_for_timeout(600); p.click('[data-act="reveal"]'); wait(p, 'image-loading'); shot('image-loading')
    wait(p, 'active'); srv(p, '(m.net.latencyMs = 200)'); p.wait_for_timeout(1200); shot('active')
    p.click('[data-act="back"]'); wait(p, 'exit'); shot('exit'); p.keyboard.press('Escape')
    wait(p, 'urgent', t=12000); shot('urgent')
    srv(p, '(m.net.latencyMs = 3000)'); answer(True); wait(p, 'checking'); shot('checking'); wait(p, 'correct'); srv(p, '(m.net.latencyMs = 200)'); shot('correct')
    p.click('[data-act="fb-next"]'); right(4, True)
    reveal(); answer(False); wait(p, 'wrong'); shot('wrong'); p.click('[data-act="fb-next"]'); wait(p, 'result'); shot('result')
    # a confirmed failure keeps the offer only until the service's offer deadline (play: 10 s), so retry promptly
    srv(p, "(m.reviewer.script({op: 'charge', outcome: 'failed'}), m.net.latencyMs = 1600)"); p.click('[data-act="continue"]'); wait(p, 'payment-pending'); shot('payment-pending')
    wait(p, 'payment-failed', t=15000); srv(p, '(m.net.latencyMs = 200)'); shot('payment-failed')
    p.click('[data-act="continue"]'); wait(p, 'ready', t=20000)
    srv(p, '(m.net.offline = true, window.dispatchEvent(new Event("offline")))'); wait(p, 'offline'); shot('offline')
    srv(p, '(m.net.offline = false, m.net.latencyMs = 3000)'); p.click('[data-act="reconnect"]'); wait(p, 'reconnecting'); shot('reconnecting'); wait(p, 'ready'); srv(p, '(m.net.latencyMs = 200)')
    srv(p, '(m.net.offline = true)'); p.wait_for_timeout(600); p.click('[data-act="reveal"]'); wait(p, 'image-error', t=15000); shot('image-error'); srv(p, '(m.net.offline = false)')
    p.click('[data-act="reveal"]'); wait(p, 'active', 'urgent')
    wait(p, 'timeout', t=15000); shot('timeout'); p.click('[data-act="fb-next"]'); wait(p, 'result'); shot('result-final')
    p.click('.bottom-actions [data-act="loss-home"]'); home(p); p.wait_for_timeout(1200); shot('home')
    # run 2: low score, timeout → result-timeout (no badge); run 3: insufficient
    p.click('[data-act="start"]'); reveal(); wait(p, 'timeout', t=15000); p.click('[data-act="fb-next"]'); wait(p, 'result'); shot('result-timeout')
    p.click('.bottom-actions [data-act="loss-home"]'); home(p)
    srv(p, 'm.reviewer.setBalance(3)'); p.reload(); home(p)
    p.click('[data-act="start"]'); right(2); reveal(); answer(False); wait(p, 'wrong'); p.click('[data-act="fb-next"]'); wait(p, 'insufficient'); shot('insufficient')
    p.click('.bottom-actions [data-act="loss-home"]'); home(p); wait(p, 'home-zero'); p.wait_for_timeout(1000); shot('home-zero')
    # daily, then a new account for result-no-badge (wrong) and checkpoints 10–20 + record
    srv(p, 'm.reviewer.seedAttended(3)'); p.reload(); wait(p, 'daily', 'home'); shot('daily')


def go2(p, w, h):   # second account: result-no-badge, the remaining checkpoints and the record
    def shot(name):
        if not (a.full or (w, h) == (390, 844) or name in CRITICAL): return
        p.wait_for_timeout(350); p.screenshot(path=str(OUT / f'{w}x{h}-{name}.png'))
    home(p); srv(p, 'm.reviewer.setRecord(22)'); p.reload(); home(p)
    p.click('[data-act="start"]')
    for i in range(23):
        wait(p, 'ready'); p.wait_for_timeout(600); p.click('[data-act="reveal"]'); wait(p, 'active', 'urgent')
        c = srv(p, 'm.reviewer.correctChoice()')
        if i == 0 or i == 22:
            pass
        if i == 1:   # a miss at score 1 → result-no-badge, then continue
            p.click(f'[data-act="ans-{"lower" if c == "higher" else "higher"}"]'); wait(p, 'wrong'); p.click('[data-act="fb-next"]'); wait(p, 'result'); shot('result-no-badge')
            p.click('[data-act="continue"]'); continue
        p.click(f'[data-act="ans-{c}"]'); wait(p, 'correct'); p.click('[data-act="fb-next"]'); wait(p, 'ready'); p.wait_for_timeout(750)
        while rd(p).startswith(('checkpoint', 'record')):
            p.wait_for_timeout(500); shot(rd(p)); p.wait_for_timeout(300); p.click('.q-cphost [data-act="cp-go"]'); p.wait_for_function("!document.querySelector('.q-cphost').innerHTML")
    shot('ready-after-20')


with sync_playwright() as pw:
    b = pw.chromium.launch()
    for s in a.sizes.split(','):
        w, h = map(int, s.split('x'))
        p = page_for(b, w, h, {'latencyMs: 200': 'latencyMs: 4000'}); p.wait_for_function("document.querySelector('#app').dataset.rd === 'splash'"); p.wait_for_timeout(300)
        p.screenshot(path=str(OUT / f'{w}x{h}-splash.png')); p.context.close()
        p = page_for(b, w, h, {'offline: false': 'offline: true'}); wait(p, 'error'); p.screenshot(path=str(OUT / f'{w}x{h}-error.png')); p.context.close()
        p = page_for(b, w, h); go(p, w, h); p.context.close()
        p = page_for(b, w, h); go2(p, w, h); p.context.close()
        print('done', s, flush=True)
    b.close()
