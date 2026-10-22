#!/usr/bin/env python3
"""Behavioural checks of the play redesign against the in-browser play server (play/server.js). No real wallet, no
Digikala service: DigiCoin is the play server's simulation. Product photos are answered with a 1×1 image so the run does
not depend on the CDN. Reviewer shortcuts (play/server.js `reviewer`) seed data and read the correct choice; the player
itself never sees them.

    python3 -m http.server 8765            # from the repository root
    python3 tests/play_redesign_test.py [http://localhost:8765/] [-k name]
"""
import base64, re, sys, time
from playwright.sync_api import sync_playwright

ARGS = [a for a in sys.argv[1:]]
ONLY = ARGS[ARGS.index('-k') + 1] if '-k' in ARGS else None
BASE = next((a for a in ARGS if a.startswith('http')), 'http://localhost:8765/')
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')
FA = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')
RESULTS = []


# ------------------------------------------------------------------------------------------------ helpers
class G:
    def __init__(self, page):
        self.p = page

    def rd(self):
        return self.p.evaluate("document.querySelector('#app').dataset.rd || ''")

    def wait(self, *ids, timeout=20000):
        js = "ids => ids.some(i => (document.querySelector('#app').dataset.rd || '').startsWith(i))"
        try:
            self.p.wait_for_function(js, arg=list(ids), timeout=timeout)
        except Exception:
            raise AssertionError(f'expected {ids}, still {self.rd()} / {self.view()}')
        return self.rd()

    def view(self):
        return self.p.evaluate("document.querySelector('#app').dataset.view || ''")

    def srv(self, expr):   # play server reviewer API (same module instance as the page's)
        return self.p.evaluate(f"import('/play/server.js').then(m => {expr})")

    def S(self, expr):     # read-only look at the controller store
        return self.p.evaluate(f"import('/src/game.js').then(m => {expr})")

    def click(self, sel):
        self.p.locator(sel).first.click()

    def text(self, sel):
        return self.p.locator(sel).first.inner_text()

    def count_calls(self):
        self.p.evaluate("""() => { if (window.__calls) return; window.__calls = []; const f = window.fetch;
          window.fetch = (i, o = {}) => { const u = typeof i === 'string' ? i : i.url; window.__calls.push((o.method || 'GET') + ' ' + u.replace(/^.*price-expert/, '')); return f(i, o); }; }""")

    def calls(self, pat):
        return len([c for c in self.p.evaluate('window.__calls || []') if re.search(pat, c)])

    def balance(self):
        return self.srv('m.reviewer.balance()')

    def answer(self, right=True):
        self.wait('active', 'urgent')
        c = self.srv('m.reviewer.correctChoice()')
        d = c if right else ('lower' if c == 'higher' else 'higher')
        self.click(f'[data-act="ans-{d}"]')
        return d

    def reveal(self):
        self.wait('ready')
        self.p.wait_for_timeout(500)   # the guard after a promotion / celebration ignores an immediate tap
        self.click('[data-act="reveal"]')
        return self.wait('active', 'urgent')

    def play_right(self, n, overlays=None):
        """n correct answers; returns the celebrations seen (closing each)."""
        seen = []
        for _ in range(n):
            self.reveal()
            self.answer(True)
            self.wait('correct')
            self.click('[data-act="fb-next"]')
            self.wait('ready', 'checkpoint', 'record')
            self.p.wait_for_timeout(750)   # a celebration mounts just after the promotion
            while self.rd().startswith(('checkpoint', 'record')):
                seen.append(self.rd())
                if overlays is not None:
                    overlays.append((self.rd(), self.p.locator('.q-cphost').inner_text()))
                self.p.wait_for_timeout(700)
                self.click('.q-cphost [data-act="cp-go"]')
                self.p.wait_for_function("!document.querySelector('.q-cphost').innerHTML")
                self.p.wait_for_timeout(100)
        return seen

    def miss(self, right_after=False):
        self.reveal()
        self.answer(False)
        self.wait('wrong')
        self.click('[data-act="fb-next"]')
        return self.wait('result', 'insufficient')


def fresh(browser, w=390, h=844, seed=None):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, locale='fa-IR')
    ctx.route(re.compile(r'https://dkstatics-public\.digikala\.com/.*'), lambda r: r.fulfill(status=200, content_type='image/png', body=PNG))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE)
    g = G(page)
    g.errors = errors
    g.wait('onboarding', 'home', 'daily')
    if g.rd() == 'onboarding':
        g.click('[data-act="onb-skip"]')
        g.wait('home')
    if seed:
        seed(g)
        page.reload()
        g.wait('home', 'daily')
    g.count_calls()
    return g


def test(fn):
    if ONLY and ONLY not in fn.__name__:
        return fn
    t0 = time.time()
    try:
        fn()
        RESULTS.append((fn.__name__, 'PASS', f'{time.time() - t0:.1f}s'))
    except Exception as e:   # report and go on with the next scenario
        RESULTS.append((fn.__name__, 'FAIL', f'{type(e).__name__}: {e}'))
    print(*RESULTS[-1], flush=True)
    return fn


# ------------------------------------------------------------------------------------------------ scenarios
with sync_playwright() as pw:
    browser = pw.chromium.launch()

    @test
    def onboarding_preserved_then_home_new():   # Q02, Q03
        ctx = browser.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.goto(BASE)
        g = G(page)
        g.wait('onboarding')
        assert page.locator('.q-onb').count() == 1, 'existing onboarding markup (q-onb) must be kept'
        assert page.locator('.rd').count() == 0, 'onboarding must not use the redesign'
        g.click('[data-act="onb-skip"]')
        assert g.wait('home-new') == 'home-new'
        assert page.locator('.history-item').count() == 0 and 'کالاهای اولین دستت' in g.text('.empty-history')
        assert page.locator('.record-card svg.badge').count() == 0, 'no borrowed badge on an empty home'
        assert g.text('.record-card .number').translate(FA) == '0'
        assert page.locator('.daily-link').count() == 0, 'no daily link without a reward'
        ctx.close()

    @test
    def start_once_on_double_tap():   # Q05
        g = fresh(browser)
        g.p.locator('[data-act="start"]').dblclick()
        g.wait('ready')
        st = g.p.evaluate("JSON.parse(localStorage.getItem('pe.play.state.v1'))")
        assert len(st['runs']) == 1, f"runs {len(st['runs'])}"
        assert sum(x['playsUsed'] for x in st['part'].values()) == 1
        assert g.calls(r'POST /runs$') == 1
        g.p.context.close()

    @test
    def ready_needs_the_tap_and_exit_sheet_keeps_time():   # Q06, Q08, Q24
        g = fresh(browser)
        g.click('[data-act="start"]'); g.wait('ready')
        g.p.wait_for_timeout(1500)
        assert g.rd() == 'ready' and g.S('m.S.q') is None, 'no question without «نمایش کالا»'
        g.reveal()
        qid, dl = g.S('m.S.q.questionId'), g.S('m.S.q.inputDeadline')
        g.click('[data-act="back"]')
        assert g.wait('exit') == 'exit'
        assert g.p.locator('.under [data-st="active"], .under [data-st="urgent"]').count() == 1, 'sheet over the real question, not over ready'
        assert g.p.evaluate("document.activeElement && document.activeElement.dataset.act") == 'leave-no', 'focus moves into the sheet'
        t1 = g.text('.under .timer .time'); g.p.wait_for_timeout(1300); t2 = g.text('.under .timer .time')
        assert t1 != t2, 'time keeps running under the sheet'
        g.p.keyboard.press('Tab'); g.p.keyboard.press('Tab'); g.p.keyboard.press('Tab')
        assert g.p.evaluate("!!document.activeElement.closest('.sheet')"), 'focus stays in the sheet'
        g.p.keyboard.press('Escape')
        g.wait('active', 'urgent')
        assert g.S('m.S.q.questionId') == qid and g.S('m.S.q.inputDeadline') == dl, 'same question, same deadline'
        g.click('[data-act="back"]'); g.wait('exit')
        g.click('[data-act="leave-yes"]')
        g.wait('home')
        assert g.calls(r'POST /runs/\w+/leave') == 1
        g.p.context.close()

    @test
    def one_answer_one_point():   # Q09, Q11, Q12
        g = fresh(browser)
        g.click('[data-act="start"]'); g.reveal()
        c = g.srv('m.reviewer.correctChoice()')
        b = g.p.locator(f'[data-act="ans-{c}"]')
        b.click(); b.click(force=True)
        g.wait('correct')
        assert g.calls(r'POST /questions/\w+/answer') == 1
        assert g.S('m.S.run.score') == 1
        assert 'good' in b.get_attribute('class') and b.get_attribute('aria-pressed') == 'true'
        assert 'درست گفتی' in g.text('.decision-head')
        assert g.p.locator('.product-stage .reveal-price').count() == 1, 'price revealed only after the verdict'
        g.p.evaluate("() => { const b = document.querySelector('[data-act=\"fb-next\"]'); b.click(); b.click(); }")   # link + hold race
        g.wait('ready')
        g.p.wait_for_timeout(1600)   # past the automatic hold: still one ready, no second promotion
        assert g.rd() == 'ready'
        assert g.S('m.S.run.score') == 1
        g.p.context.close()

    @test
    def miss_result_no_badge_continue_once_then_final():   # Q16, Q18, Q19, Q21, R result-final
        g = fresh(browser)
        g.click('[data-act="start"]')
        g.play_right(1)
        d = g.miss()
        assert d == 'result-no-badge', d
        assert g.p.locator('.result-main svg.badge').count() == 0 and 'هنوز عنوانی نگرفتی' in g.text('.stats')
        assert 'این دست ۱ جواب درست دادی' in g.text('.ranking-line')
        assert 'اینجا باختی' in g.text('.comparison-recap')
        assert g.p.locator('.timer.urgent, [data-offer-left]').count() == 0, 'no countdown on the result'
        assert g.calls(r'/offer$') == 0, 'the offer is not opened before the tap'
        run_id, bal = g.S('m.S.run.runId'), g.balance()
        g.p.locator('[data-act="continue"]').dblclick()
        g.wait('ready', timeout=15000)
        assert g.S('m.S.run.runId') == run_id and g.S('m.S.run.score') == 1, 'same run, same score'
        assert g.balance() == bal - 5, f'one 5-coin debit, got {bal} → {g.balance()}'
        assert g.calls(r'/continue$') == 1 and g.calls(r'/offer$') == 1
        assert g.miss() == 'result-final'
        assert 'فرصت ادامه این دست رو استفاده کردی' in g.text('.bottom-actions')
        assert g.p.locator('[data-act="continue"]').count() == 0
        g.click('.bottom-actions [data-act="loss-home"]')
        g.p.wait_for_selector('[data-act="start"], [data-act="daily-close"]')
        if g.rd() == 'daily':   # the finished run made today's reward claimable: its page opens once
            g.click('[data-act="daily-close"]')
        g.p.wait_for_selector('.history-item.lost', timeout=5000)   # the latest run's products, the loss marked
        g.p.context.close()

    @test
    def timeout_path_and_result_timeout():   # Q10, Q17, R urgent/timeout
        g = fresh(browser)
        g.click('[data-act="start"]'); g.reveal()
        g.wait('urgent', timeout=12000)
        assert g.p.locator('.timer.urgent').count() == 1 and g.p.locator('[data-urgent]:not([hidden])').count() == 1
        g.wait('timeout', timeout=12000)
        assert g.p.locator('.answer.bad, .answer.good, .answer.selected').count() == 0, 'no invented choice on a timeout'
        g.click('[data-act="fb-next"]')
        assert g.wait('result-timeout') == 'result-timeout'
        assert 'زمانت تموم شد' in g.text('.result-top') and 'زمانت روی این کالا تموم شد' in g.text('.comparison-recap')
        g.p.context.close()

    @test
    def insufficient_balance():   # Q18, Q27
        g = fresh(browser, seed=lambda g: g.srv('m.reviewer.setBalance(3)'))
        g.click('[data-act="start"]')
        assert g.miss() == 'insufficient'
        b = g.p.locator('.bottom-actions .btn:not(.secondary)').first
        assert b.is_disabled()
        alert = g.text('.bottom-actions .inline-alert')
        assert '۵' in alert and '۳' in alert, alert
        assert g.p.locator('.result-main .inline-alert').count() == 0, 'financial alert outside the scrolling body'
        g.click('.bottom-actions [data-act="loss-home"]'); g.wait('home')
        assert g.calls(r'/leave$') == 1 and g.calls(r'/continue$') == 0
        g.p.context.close()

    @test
    def payment_failed_then_retry():   # Q22
        g = fresh(browser, seed=lambda g: g.srv("m.reviewer.script({op: 'charge', outcome: 'failed'})"))
        g.click('[data-act="start"]')
        g.miss()
        bal = g.balance()
        g.click('[data-act="continue"]')
        assert g.wait('payment-failed', timeout=15000) == 'payment-failed'
        assert 'دیجی‌کوینی کم نشد' in g.text('.bottom-actions .inline-alert') and g.balance() == bal
        g.click('[data-act="continue"]')
        g.wait('ready', timeout=15000)
        assert g.balance() == bal - 5
        g.p.context.close()

    @test
    def payment_unknown_recovers_same_operation():   # Q20
        g = fresh(browser, seed=lambda g: g.srv("m.reviewer.script({op: 'charge', outcome: 'unknown_applied'})"))
        g.click('[data-act="start"]')
        g.miss()
        bal = g.balance()
        g.click('[data-act="continue"]')
        g.wait('payment-pending')
        assert g.p.locator('.bottom-actions [data-act="loss-home"]').count() == 0 or g.p.locator('.bottom-actions .btn.secondary').is_disabled(), 'home locked while pending'
        assert 'دیجی‌کوینی کم نشد' not in g.text('.bottom-actions')
        g.wait('ready', timeout=60000)
        st = g.p.evaluate("JSON.parse(localStorage.getItem('pe.play.state.v1'))")
        charges = [o for o in st['ops'].values() if o['type'] == 'CHARGE']
        assert len(charges) == 1 and g.balance() == bal - 5, (len(charges), bal, g.balance())
        g.p.context.close()

    @test
    def checkpoints_and_record_once():   # Q13, Q14, Q15
        g = fresh(browser, seed=lambda g: g.srv('m.reviewer.setRecord(22)'))
        bal = g.balance()
        g.click('[data-act="start"]')
        ov = []
        seen = g.play_right(22, ov)
        assert seen == ['checkpoint-5', 'checkpoint-10', 'checkpoint-15', 'checkpoint-20', 'record'], seen
        txt = dict(ov)
        assert 'بازاری تازه‌کار' in txt['checkpoint-5'] and '۵۰٪' in txt['checkpoint-5'] and 'جایزه' not in txt['checkpoint-5']
        assert '۱ دیجی‌کوین' in txt['checkpoint-10'] and '۳ دیجی‌کوین' in txt['checkpoint-15'] and '۵ دیجی‌کوین' in txt['checkpoint-20']
        assert 'قیمت‌شناس اعظم' in txt['checkpoint-20'] and '۲۲' in txt['record'] and 'جایزه رکورد' in txt['record']
        g.p.wait_for_timeout(2500)
        assert g.balance() == bal + 10, f'0+1+3+5 checkpoint + 1 record = 10; got {g.balance() - bal}'
        g.p.reload(); g.wait('ready', 'active', 'reconnecting'); g.wait('ready')
        assert g.p.locator('.q-cphost').inner_html() == '', 'a reload does not replay a celebration'
        g.p.context.close()

    @test
    def progress_after_20_targets_frozen_record():   # Q15 (no fifth checkpoint, no 27)
        g = fresh(browser, seed=lambda g: g.srv('m.reviewer.setRecord(24)'))
        g.click('[data-act="start"]')
        g.play_right(21)
        s = g.text('.progress-summary')
        assert '۳ پاسخ' in s and 'رکوردت' in s, s
        assert g.p.locator('.milestone').count() == 4
        g.p.context.close()

    @test
    def daily_page_once_per_session_and_claim():   # Q23
        g = fresh(browser, seed=lambda g: g.srv('m.reviewer.seedAttended(3)'))
        assert g.wait('daily') == 'daily'
        assert g.p.locator('.week .day').count() == 7 and g.p.locator('.week .day.today').count() == 1
        assert g.p.locator('.week .day.done').count() >= 1
        g.click('[data-act="daily-close"]'); g.wait('home')
        assert 'جایزه امروزت آماده‌ست' in g.text('.daily-link')
        g.click('[data-act="start"]'); g.wait('ready'); g.click('[data-act="back"]'); g.wait('exit'); g.click('[data-act="leave-yes"]')
        g.wait('home'); g.p.wait_for_timeout(600)
        assert g.rd().startswith('home'), 'no automatic reopening in the same session'
        bal = g.balance()
        g.click('[data-act="daily-open"]'); g.wait('daily')
        amount = int(g.text('.daily-value strong').translate(FA))   # the server's amount (rewards waiting for the claim)
        g.p.locator('[data-act="daily-claim"]').dblclick()
        g.wait('home', timeout=15000)
        g.p.wait_for_timeout(1500)
        assert g.calls(r'POST /player/daily-reward/claim') == 1
        assert g.balance() == bal + amount, (bal, amount, g.balance())
        assert 'گرفتی' in g.text('.daily-link')
        g.p.context.close()

    @test
    def reload_mid_question_keeps_deadline():   # Q25
        g = fresh(browser)
        g.click('[data-act="start"]'); g.reveal()
        dl = g.S('m.S.q.inputDeadline')
        g.p.wait_for_timeout(2500)
        g.p.reload()
        g.wait('active', 'urgent', 'checking', 'timeout', timeout=15000)
        if g.rd() in ('active', 'urgent'):
            assert g.S('m.S.q.inputDeadline') == dl, 'reload never restarts the question'
            assert float(g.text('.timer .time').translate(FA).replace('٫', '.')) < 8.5
        g.p.context.close()

    @test
    def offline_between_questions():   # R offline / reconnecting
        g = fresh(browser)
        g.click('[data-act="start"]'); g.wait('ready')
        g.srv("(m.net.offline = true, window.dispatchEvent(new Event('offline')))")
        assert g.wait('offline') == 'offline'
        g.click('[data-act="reconnect"]'); g.p.wait_for_timeout(800)
        assert g.rd() == 'offline', 'still offline: no fake success'
        g.click('[data-act="leave-ask"]'); g.wait('exit'); g.p.keyboard.press('Escape'); g.wait('offline')
        g.srv('(m.net.offline = false)')
        g.click('[data-act="reconnect"]')
        assert g.wait('ready') == 'ready'
        g.p.context.close()

    @test
    def help_page_spends_nothing():
        g = fresh(browser)
        g.click('[data-act="guide"]'); assert g.wait('help') == 'help'
        assert g.p.locator('.help-checkpoints svg.badge').count() == 4
        ids = g.p.evaluate("[...document.querySelectorAll('svg linearGradient')].map(e => e.id)")
        assert len(ids) == len(set(ids)), 'unique gradient ids'
        g.p.locator('.help-scroll').evaluate('e => e.scrollTop = e.scrollHeight')
        assert g.p.locator('.help-screen .bottom-actions .btn').is_visible()
        g.click('.bottom-actions [data-act="guide-close"]'); g.wait('home')
        st = g.p.evaluate("JSON.parse(localStorage.getItem('pe.play.state.v1'))")
        assert len(st['runs']) == 0
        g.p.context.close()

    @test
    def home_zero_after_three_plays():   # Q04
        g = fresh(browser)
        for _ in range(3):
            g.p.wait_for_selector('[data-act="start"], [data-act="daily-close"]')
            if g.rd() == 'daily':   # a finished run makes today's daily reward claimable: its page opens once
                g.click('[data-act="daily-close"]')
            g.click('[data-act="start"]'); g.wait('ready')
            g.click('[data-act="back"]'); g.wait('exit'); g.click('[data-act="leave-yes"]')
        assert g.wait('home-zero') == 'home-zero'
        assert g.p.locator('[data-act="start"]').count() == 0
        assert re.fullmatch(r'\d\d:\d\d:\d\d', g.text('[data-countdown]').translate(FA))
        g.p.context.close()

    @test
    def layout_three_sizes():   # Q26, Q27, Q29
        for w, h in ((360, 640), (390, 844), (430, 932)):
            g = fresh(browser, w, h, seed=lambda g: g.srv('m.reviewer.setBalance(3)'))
            def check(tag):
                bad = g.p.evaluate("""() => [...document.querySelectorAll('.rd *')].filter(e => { const r = e.getBoundingClientRect();
                  return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.history'); }).map(e => e.className.baseVal ?? e.className).slice(0, 5)""")
                assert not bad, f'{w}x{h} {tag}: horizontal overflow {bad}'
                for sel in ('.bottom-actions .btn', '.answer'):
                    for b in g.p.locator(sel).all():
                        if b.is_visible():
                            r = b.bounding_box()
                            assert r['y'] + r['height'] <= h + 0.5 and r['height'] >= 44, f'{w}x{h} {tag}: {sel} {r}'
            check('home')
            g.click('[data-act="start"]'); g.wait('ready'); check('ready')
            g.click('[data-act="reveal"]'); g.wait('active', 'urgent'); check('active')
            a = [b.bounding_box() for b in g.p.locator('.answer').all()]
            assert abs(a[0]['width'] - a[1]['width']) < 1 and abs(a[0]['height'] - a[1]['height']) < 1, 'equal answers'
            g.answer(False); g.wait('wrong'); g.click('[data-act="fb-next"]'); g.wait('insufficient'); check('insufficient')
            assert not g.errors, g.errors
            g.p.context.close()

    browser.close()

fails = [r for r in RESULTS if r[1] != 'PASS']
print(f'\n{len(RESULTS) - len(fails)}/{len(RESULTS)} scenarios passed')
sys.exit(1 if fails else 0)
