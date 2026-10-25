// Player state controller: one authoritative store drives the DOM. Explicit view states with transition guards; run,
// question and operation identities plus a generation counter make stale responses and timers harmless. The server
// decides timing, results, money and rewards; this file only renders what the server said and sends guarded intents.
// Redesign 2026-10-21: splash → (onboarding) → home; the loss screen is the one surface for a miss and the continue
// of the same run; checkpoint rewards are registered with the answer that crosses them, the celebration only continues.
import { api, ApiError, newKey } from './api.js';
import * as clock from './clock.js';
import * as host from './host.js';
import * as motion from './motion.js';
import { DUR } from './durations.js';
import * as V from './views.js';
import { createShareCard, GAME_URL } from './share.js';
import { DEMO_FIRST, DEMO_SECOND } from './demo.js';
import { fa, untilInstant, title, esc } from './fmt.js';

const $ = (s, r = document) => r.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const S = {
  view: 'G00.SPLASH',
  boot: null, balance: null,
  run: null,          // last run view from the server
  ref: null,          // first product card
  q: null,            // open question { questionId, product, t0, inputDeadline, acceptDeadline, imgReady, imgSlow, pick, key, locked }
  fb: null,           // feedback { kind, choice, direction, revealedPrice, product, equal }
  offer: null, op: null,
  result: null, ended: null,
  home: { runId: null, products: null, state: 'none', positioned: null, scroll: null, page: 0 },   // «کالاهای دست قبلی»
  ui: { toast: null, leave: false, cp: null, offline: !navigator.onLine, resuming: false, queued: null, morph: null,
        guardUntil: 0, codeState: null, afterContinue: false, noOffer: null, cpShown: new Set(), lossReason: null,
        onb: null, daily: null, slowSettle: false, offerOver: false, guideFrom: null, recordToast: null },
  keys: {},           // one Idempotency-Key per intent, reused for its retries
  gen: 0,
};

let root = null, screenEl = null, cpEl = null;
const now = () => performance.now();
function later(ms, fn) { const g = S.gen; return setTimeout(() => { if (g === S.gen) fn(); }, ms); }
/** Per-run transient UI, cleared in one place whenever a run ends, is replaced, or a new one starts or boots. */
function resetRunUi() {
  Object.assign(S.ui, { leave: false, cpDue: null, queued: null, resuming: false, afterContinue: false, noOffer: null, guardUntil: 0,
    offerEnded: false, offerOver: false, slowSettle: false, cpShown: new Set(), lossReason: null, recordToast: null, codeState: null });
  unmountCp();
}
const cfg = () => (S.run && S.run.runConfig) || (S.boot && S.boot.config) || { checkpoints: [], continueRule: { enabled: false, cost: 0, cap: 0 }, inputMs: 10000, acceptMs: 12500, offerMs: 10000, offerAcceptMs: 15000 };
const inRun = v => /^G03\.|^G04\.|^G05\.|^G06\./.test(v) && v !== 'G03.NO_PRODUCTS_LEFT';
const isLoss = v => /^G05\.|^G06\./.test(v) && v !== 'G06.SUCCESS';
/** A01 switch of the run's (or, before a run, the active) configuration; on when an older server sends none. */
const feat = k => { const f = cfg().features; return !f || f[k] !== false; };
const haptic = kind => { if (feat('haptics')) host.haptic(kind); };
const cpIndex = c => cfg().checkpoints.findIndex(x => x.checkpointId === c.checkpointId);
const nextCp = score => cfg().checkpoints.find(x => x.requiredCorrect > score) || null;

// ------------------------------------------------------------------------------------------------ rendering
function screen() {
  const v = S.view;
  if (v === 'G00.SPLASH' || v === 'G00.ERROR') return V.vSplash(v === 'G00.ERROR');
  if (v.startsWith('G01.')) return homeScreen();
  if (v === 'G02.GUIDE') return V.vGuide({ config: cfg(), demo: !!S.ui.guideTour, still: motion.reducedMotion() });
  if (v === 'G12.DEALS') return dealsScreen();
  if (v === 'G13.COINS') return V.vCoins({ ...(S.coins || { state: 'loading', items: [] }), balance: S.balance, toast: S.ui.toast });
  if (v === 'G02.ONBOARDING') return onboardScreen();
  if (v === 'G03.LOADING') return loadingRun();
  if (['G03.READY', 'G03.PREPARING', 'G03.COUNTDOWN', 'G03.PREPARE_FAILED', 'G06.SUCCESS'].includes(v)) return ready();
  if (v === 'G03.QUESTION_ACTIVE' || v === 'G03.ANSWER_PENDING') return question();
  if (['G03.CORRECT_FEEDBACK', 'G03.WRONG_FEEDBACK', 'G03.TIMEOUT'].includes(v)) return feedback();
  if (isLoss(v)) return lossScreen();
  return V.vSystem(v, { toast: S.ui.toast, ended: S.ended, playerMessage: S.boot && S.boot.access ? S.boot.access.message : null });
}

function homeScreen() {
  const b = S.boot;
  return V.vHome(S.view, {
    boot: b, balance: S.balance, toast: S.ui.toast, offline: S.ui.offline,
    untilReset: untilInstant(clock.ms(b.quota.resetsAt) - clock.serverNow()),
    historyPage: S.home.page, productsOn: feat('products'), products: S.home.products, historyState: S.home.state,
    modal: S.ui.daily && b.dailyReward ? V.dailyModal(b.dailyReward, S.ui.daily) : '',
  });
}

const top = () => V.gameTop(S.run.score, !!S.op || S.view === 'G03.ANSWER_PENDING');
const trk = () => V.track(S.run.score, cfg().checkpoints);
const leave = () => V.leaveSheet({ leave: S.ui.leave, score: S.run.score, checkpoint: S.run.highestCheckpoint, questionOpen: ['G03.QUESTION_ACTIVE', 'G03.ANSWER_PENDING'].includes(S.view) });

function loadingRun() {
  return V.game(V.gameTop(0, true), V.track(0, cfg().checkpoints), V.timer({ mode: 'idle' }),
    '<article class="q-ref q-skel" aria-busy="true" aria-label="کالای اول در راهه"></article>' + V.revealCard('wait'), '', '', S.ui.toast);
}

function connPill() {
  if (S.ui.resuming) return V.pill('در حال اتصال دوباره…', 'refresh');
  return '';
}

function ready() {
  const v = S.view, off = S.ui.offline;
  const st = v === 'G03.COUNTDOWN' && S.q ? 'count' : v === 'G03.PREPARE_FAILED' ? 'failed' : off ? 'off' : 'wait';
  const lead = connPill();                                    // after a continue the toast says so; no extra row that could push the button off
  const t0 = st === 'count' ? clock.ms(S.q.t0) : 0, left = Math.max(0, t0 - clock.serverNow());
  return V.game(top(), trk(), V.timer({ mode: 'idle' }), lead + V.refCard(S.ref, false) + V.revealCard(st, { total: S.ui.leadTotal || 5000, left }), '', leave(), S.ui.toast);
}

/** Visible countdown of the open question: whole seconds from the server-anchored deadline (never a decremented counter). */
function timerNow() {
  const total = cfg().inputMs, q = S.q;
  const rem = Math.max(0, Math.min(total, clock.ms(q.inputDeadline) - clock.serverNow()));
  return { rem, t: fa(Math.ceil(rem / 1000)), p: (rem / total).toFixed(3), low: rem <= 3000 };
}

function question() {
  const q = S.q, pend = !!q.pick, off = S.ui.offline, tn = timerNow(), over = !pend && (q.locked || tn.rem <= 0);
  let lead = off ? V.pill('اتصال قطع شد؛ تا برگرده نمی‌شه جواب داد و زمان ادامه داره.', 'wifi') : connPill();
  if (S.ui.slowSettle) lead = V.pill(pend ? 'پاسخت ثبت شده؛ نتیجه‌اش هنوز نرسیده.' : 'نتیجه هنوز نرسیده.', 'refresh', '<button class="q-pill__btn" data-act="recheck-answer">بررسی دوباره</button>');
  const tm = pend ? V.timer({ mode: 'busy' }) : over ? V.timer({ mode: 'zero' }) : V.timer({ mode: tn.low ? 'low' : 'run', t: tn.t, p: tn.p });
  return V.game(top(), trk(), tm, lead + V.refCard(S.ref, true) + V.cmpCard(q.product, 'hidden', 0, q.imgSlow && !q.imgReady),
    V.decide(pend ? 'pending' : off || over ? 'off' : 'on', q.pick, '', S.ref.price), leave(), S.ui.toast);
}

/** The server's verdict in the place the player acted: same cards, same buttons, same sizes (§8). */
function feedback() {
  const fb = S.fb;
  if (!fb) return ready();
  const dir = V.dirOf(fb.direction), truthW = V.DIRW[dir];
  let tm, card, dec;
  if (fb.kind === 'correct') {
    const pop = S.ui.popped !== fb.questionId; S.ui.popped = fb.questionId;   // the check pops once per confirmed question, not on re-renders
    tm = V.timer({ mode: 'verdict', kind: 'ok', title: 'درست گفتی!', sub: fb.equal ? 'قیمت‌ها برابر بود؛ هر دو جواب درسته' : `${truthW} بود`, pop });
    card = V.cmpCard(fb.product, 'ok', fb.revealedPrice);
    dec = V.decide('ok', fb.choice, '');
  } else if (fb.kind === 'wrong') {
    tm = V.timer({ mode: 'verdict', kind: 'no', title: 'جوابت درست نبود', sub: `${truthW} بود` });
    card = V.cmpCard(fb.product, 'no', fb.revealedPrice);
    dec = V.decide('no', fb.choice, '');
  } else {   // timeout: no answer is shown as the player's
    tm = V.timer({ mode: 'verdict', kind: 'time', title: 'زمان تموم شد', sub: `${truthW} بود` });
    card = V.cmpCard(fb.product, 'time', fb.revealedPrice);
    dec = V.decide('truth', fb.direction === 'higher' ? 'higher' : 'lower', '');
  }
  return V.game(top(), trk(), tm, connPill() + V.refCard(S.ref, true) + card, dec, leave(), S.ui.toast);
}

/** G05/G06 (owner 2026-10-25). While the continue is open or being paid: the game screen with the revealed price under the
 *  offer modal (end screen 1). Once the run is over: the result screen (end screen 2). */
const OFFER_STATE = { 'G05.LOADING': 'loading', 'G05.OFFER': 'offer', 'G06.PENDING': 'pending', 'G06.UNKNOWN': 'unknown', 'G06.FAILED_RETRY': 'failed' };
function lossScreen() {
  const v = S.view;
  const st = v === 'G05.OFFER' && S.ui.offerOver ? 'ending' : OFFER_STATE[v];
  if (!st) return endScreen();
  const left = S.offer && S.offer.deadline ? fa(Math.max(0, Math.ceil((clock.ms(S.offer.deadline) - clock.serverNow()) / 1000))) : null;
  const under = (S.fb ? feedback() : S.ref && S.run ? ready() : '').replace('<div class="q-page', '<div inert class="q-page');
  return under + V.offerModal({ cost: S.offer ? S.offer.cost : cfg().continueRule.cost, balance: S.balance, state: S.ui.skipping ? 'ending' : st, left });
}
function endScreen() {
  const v = S.view, run = S.run, score = run ? run.score : 0, cost = S.offer ? S.offer.cost : cfg().continueRule.cost;
  const before = (S.boot && S.boot.record) || 0, newRecord = score > 0 && score > before;
  const cp = run ? run.highestCheckpoint : null;
  const note = { 'G06.FAILED_END': V.status('no', 'پرداخت انجام نشد و کوینی کسر نشد؛ ادامه انجام نشد.', 'alert', false, true),
    'G06.FAILED_END.UNCONFIRMED': V.status('no', 'پرداخت به‌موقع تأیید نشد و ادامه انجام نشد؛ اگه مبلغی کسر شده باشه، خودکار برمی‌گرده.', 'alert'),
    'G06.REFUNDED': V.status('ok', `ادامه ممکن نشد؛ ${fa(cost)} دیجی‌کوین به حسابت برگشت.`, 'check') }[v] || '';
  const R = S.result, code = R && R.campaignCode && R.campaignCode.status !== 'sold_out' ? V.codeCard(R.campaignCode, S.ui.codeState === 'copied') : '';
  const best = Math.max(R ? R.record : 0, before, score);   // a first run's score is the record
  const cps = cfg().checkpoints, bi = cps.map(c => c.requiredCorrect <= best).lastIndexOf(true);   // the best badge so far (all-time, like the record)
  return V.vEnd({ title: newRecord ? 'رکوردتو زدی!' : cp ? 'ترکوندی!' : 'باختی!', score, best, newRecord,
    badge: bi >= 0 ? cps[bi] : null, badgeIndex: bi, better: cp && cp.comparisonPercent != null ? cp.comparisonPercent : null,   // the checkpoint's own comparisonPercent (config: 50/70/90/99)
    deals: V.dealsOf(S.end && S.end.products), dealsState: S.end ? S.end.state : 'loading',
    note, code, shareable: feat('share'), balance: S.balance, toast: S.ui.toast });
}
/** G12.DEALS: the seen products from the result screen's run, or from the latest finished run when opened from home. */
function dealsScreen() {
  const fromEnd = S.ui.dealsSrc === 'end';
  const src = fromEnd ? S.end : { state: { ready: 'ready', none: 'ready', error: 'error' }[S.home.state] || 'loading', products: S.home.products };
  return V.vDeals({ deals: V.dealsOf(src && src.products), state: src ? src.state : 'ready', played: fromEnd || !!(S.boot && S.boot.lastRunId), toast: S.ui.toast });
}
async function loadEndDeals(runId) {
  S.end = { runId, state: 'loading', products: null };
  try { const list = await api.products(runId); if (S.end && S.end.runId === runId) Object.assign(S.end, { state: 'ready', products: list }); }
  catch (e) { if (S.end && S.end.runId === runId) S.end.state = 'error'; }
  if (isLoss(S.view) || S.view === 'G12.DEALS') render();
}
function openDeals(src) {
  S.ui.dealsFrom = S.view; S.ui.dealsSrc = src;
  host.setBackHandler(() => { if (S.view === 'G12.DEALS') { closeDeals(); return true; } return false; });
  go('G12.DEALS');
}
/** G13.COINS: the DigiCoin history, read fresh each time it opens (simulated ledger in Play). */
async function openCoins() {
  if (S.view !== 'G13.COINS') S.ui.coinsFrom = S.view;
  S.coins = { state: 'loading', items: [] };
  host.setBackHandler(() => { if (S.view === 'G13.COINS') { closeCoins(); return true; } return false; });
  go('G13.COINS');
  try { const r = await api.coinHistory(); S.coins = { state: 'ready', items: r.items || [] }; if (r.balance != null) S.balance = r.balance; }
  catch (e) { S.coins = { state: 'error', items: [] }; }
  if (S.view === 'G13.COINS') render();
}
function closeCoins() { host.setBackHandler(null); const v = S.ui.coinsFrom || 'G01.READY'; S.ui.coinsFrom = null; go(v); }
function closeDeals() {
  const v = S.ui.dealsFrom || 'G01.READY'; S.ui.dealsFrom = null;
  host.setBackHandler(isLoss(v) ? LOSS_BACK : null);
  go(v);
}
// ------------------------------------------------------------------------------------------------ onboarding (§14)
function onboardScreen() { const o = S.ui.onb; return V.vOnboard({ busy: o.busy, error: o.error }, motion.reducedMotion()); }
/**
 * Animated tour controller (owner 2026-10-25): the beats play by themselves; the view is rendered once and only data-beat
 * changes, so CSS moves the camera. A re-render (toast, offline) resumes the same beat where it was. Holding a finger on
 * the stage pauses it. Nothing here touches the server.
 */
const BEAT_MS = 3400;
// what the camera frames in each beat (1–6), and the parts that dim around it; beat 5 and the end card show the whole screen
const TOUR_FOCUS = [null, '.q-ref', '.q-tour__cmp', '.q-tour__tm', '.q-tour__dec', null, '.q-tour__trk', null];
const TOUR_PARTS = ['.q-hdr', '.q-tour__trk', '.q-tour__tm', '.q-ref', '.q-tour__cmp', '.q-tour__dec'];
let tourTimer = 0;
function runTour() {
  clearTimeout(tourTimer);
  const el = root.querySelector('.q-tour'); if (!el) return;
  const t = S.ui.tour ||= { beat: 1, left: BEAT_MS, paused: false };
  if (t.at && !t.paused) t.left = Math.max(250, t.left - (performance.now() - t.at));   // a re-render mid-beat keeps its place
  const stage = el.querySelector('.q-tour__stage'), cam = el.querySelector('.q-tour__cam'), scr = el.querySelector('.q-tour__screen');
  const still = motion.reducedMotion();
  const frame = () => {
    const sw = stage.clientWidth, sh = stage.clientHeight, W = scr.offsetWidth, H = scr.offsetHeight;
    if (!sw || !W) return;
    const fit = Math.min(sw / W, sh / H);
    let z = fit, cx = W / 2, cy = H / 2;
    const tg = TOUR_FOCUS[t.beat] && scr.querySelector(TOUR_FOCUS[t.beat]);
    if (tg && !still) {
      let x = 0, y = 0, n = tg; while (n && n !== scr) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      z = Math.max(fit * 1.18, Math.min(fit * 2.2, sw * .94 / tg.offsetWidth, sh * .78 / tg.offsetHeight));   // full-width parts still get a visible push-in
      cx = x + tg.offsetWidth / 2; cy = y + tg.offsetHeight / 2;
    }
    const tx = Math.min(0, Math.max(sw - W * z, sw / 2 - cx * z)), ty = Math.min(Math.max(0, (sh - H * z) / 2), Math.max(sh - H * z, sh / 2 - cy * z));
    cam.style.transform = `translate(${W * z <= sw ? (sw - W * z) / 2 : tx}px, ${ty}px) scale(${z})`;
    for (const sel of TOUR_PARTS) { const p = scr.querySelector(sel); if (p) p.toggleAttribute('data-dim', !!tg && p !== tg && !p.contains(tg) && t.beat <= V.TOUR.length); }
  };
  const show = () => { el.dataset.beat = t.beat; el.style.setProperty('--beat-ms', BEAT_MS + 'ms'); el.style.setProperty('--beat-done', (BEAT_MS - t.left) + 'ms'); frame(); root.dataset.view = stateId(); };
  const schedule = () => {
    if (t.beat > V.TOUR.length) return;
    t.at = performance.now();
    tourTimer = setTimeout(() => { if (!root.contains(el)) return; t.beat++; t.left = BEAT_MS; show(); schedule(); }, t.left);
  };
  const hold = el.querySelector('[data-tour-hold]');
  hold.addEventListener('pointerdown', () => { if (t.paused || t.beat > V.TOUR.length) return; t.paused = true; clearTimeout(tourTimer); t.left = Math.max(250, t.left - (performance.now() - t.at)); el.classList.add('is-held'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hold.addEventListener(ev, () => { if (!t.paused) return; t.paused = false; el.classList.remove('is-held'); schedule(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(frame).observe(stage);
  show();
  if (!t.paused) schedule();
}
function startOnboarding() {
  S.ui.daily = null;
  S.ui.onb = { busy: false, error: null }; S.ui.tour = null;
  host.setBackHandler(() => !!S.ui.onb);   // Back does not leave the first-visit tour; «رد کردن» does
  go('G02.ONBOARDING');
}
/** Finishing or skipping is stored on the account (one request, same key on retry); the home follows. No play is spent. */
async function finishOnboarding() {
  const o = S.ui.onb; if (!o || o.busy) return;
  o.busy = true; o.error = null; render();
  const key = S.keys.onboarding ||= newKey(), g = S.gen;
  for (let i = 0; i < 2; i++) {
    try {
      await api.onboarding(key);
      if (g !== S.gen) return;
      S.keys.onboarding = null; S.boot.firstVisit = false; S.ui.onb = null; host.setBackHandler(null);
      return routeHome();
    } catch (e) {
      if (g !== S.gen) return;
      if (!(e instanceof ApiError) || !e.network || i === 1) break;
      await sleep(800);
    }
  }
  Object.assign(o, { busy: false, error: 'ذخیره نشد؛ اتصال رو بررسی کن و دوباره بزن.' }); render();
}

export function render() {
  if (!root) return;
  const ms = S.view.startsWith('G11.') ? 0 : S.ui.morph != null ? S.ui.morph : motion.running() ? Math.max(160, motion.remaining()) : 0;
  S.ui.morph = null;
  const before = ms && !motion.reducedMotion() ? motion.snapshot(root) : null;
  const hs = root.querySelector('[data-hscroll]');
  if (hs && S.home.positioned) S.home.scroll = hs.scrollLeft;   // a re-render never resets the player's own scrolling
  motion.end();
  const active = document.activeElement?.closest('[data-act]');
  const focusAct = active?.dataset.act, focusStep = active?.dataset.step;
  screenEl.innerHTML = screen();
  if (S.ui.share) { screenEl.querySelector('.q-page')?.setAttribute('inert',''); screenEl.insertAdjacentHTML('beforeend',V.shareModal(S.ui.share)); }
  const same = focusAct && [...screenEl.querySelectorAll('[data-act]')].find(e=>e.dataset.act===focusAct && e.dataset.step===focusStep && !e.disabled);
  if (same) same.focus({preventScroll:true});
  // the answered buttons are gone, so focus would fall to <body>: hand it to «نشان بده» so a keyboard player can continue
  else if (!S.ui.cp && (!document.activeElement || document.activeElement === document.body)) screenEl.querySelector('[data-act="reveal"]:not([disabled])')?.focus({preventScroll:true});
  const dialog = root.querySelector('[role="dialog"]');
  if (dialog && !dialog.contains(document.activeElement)) requestAnimationFrame(()=>dialog.querySelector('button:not([disabled])')?.focus({preventScroll:true}));
  root.dataset.view = stateId();
  scheduleAuto();
  wireImages();
  if (before) motion.morph(root, before, ms, () => { const q = S.ui.queued; S.ui.queued = null; if (q === 'reveal') setTimeout(reveal, 0); });
  if (root.querySelector('[data-countdown],[data-offer-left]')) tickLoop();
  clearTimeout(tourTimer);
  if (root.querySelector('.q-tour')) runTour();
  if (S.view.startsWith('G01.')) afterHomeRender();
}

/** Fine-grained state id (as in the handoff state index) for analytics, tests and reviewers. */
export function stateId() {
  const v = S.view;
  if (S.ui.cp && (v === 'G03.READY' || v === 'G06.SUCCESS')) return 'G04.REACHED';
  if (S.ui.resuming && inRun(v)) return 'G10.RESUMING';
  if (v === 'G02.ONBOARDING' && S.ui.onb) { const b = S.ui.tour ? S.ui.tour.beat : 1; return 'G02.ONBOARDING.' + (S.ui.onb.busy ? 'SAVING' : S.ui.onb.error ? 'ERROR' : b > V.TOUR.length ? 'END' : 'BEAT' + b); }
  if (v === 'G02.GUIDE' && S.ui.guideTour) { const b = S.ui.tour ? S.ui.tour.beat : 1; return 'G02.GUIDE.TOUR.' + (b > V.TOUR.length ? 'END' : 'BEAT' + b); }
  if (v.startsWith('G01.') && S.ui.daily) return 'G01.DAILY_REWARD.' + S.ui.daily.phase.toUpperCase();
  if (v === 'G03.QUESTION_ACTIVE' && S.q) {
    if (S.ui.offline) return 'G10.OFFLINE_AFTER_RELEASE';
    if (S.q.locked || timerNow().rem <= 0) return 'G03.TIME_UP_PENDING';
    if (S.q.imgSlow && !S.q.imgReady) return 'G03.QUESTION_ACTIVE.IMAGE_SLOW';
    if (timerNow().low) return 'G03.QUESTION_ACTIVE.LOW_TIME';
  }
  if (v === 'G03.ANSWER_PENDING' && S.ui.offline) return 'G10.OFFLINE_AFTER_RELEASE';
  if (v === 'G03.ANSWER_PENDING' && S.ui.slowSettle) return 'G03.ANSWER_PENDING.RECOVERY';
  if (v === 'G03.READY' && S.ui.offline) return 'G10.OFFLINE_BEFORE_RELEASE';
  if (v === 'G03.CORRECT_FEEDBACK' && S.fb && S.fb.equal) return 'G03.CORRECT_FEEDBACK.EQUAL';
  if (v === 'G05.OFFER' && S.ui.offerOver) return 'G05.OFFER.TIME_UP';
  if (v === 'G05.LOSS' && S.ui.noOffer === 'limit_used') return 'G05.LOSS.LIMIT_USED';
  if (v === 'G01.READY' && S.boot) {
    const b = S.boot;
    if (S.ui.offline) return 'G01.READY.OFFLINE';
    if (b.activeRun && !b.activeRun.onThisDevice) return 'G01.READY.OTHER_DEVICE_RUN';
    if (b.campaign) return 'G01.READY.CAMPAIGN';
    if (!b.record && !b.lastRunId) return 'G01.READY.NEW_PLAYER';
  }
  if (S.ui.leave && inRun(v)) return 'G03.LEAVE_CONFIRM';
  return v;
}

function wireImages() {
  const im = root.querySelector('img[data-onload="q"]');
  if (!im || !S.q) return;
  const qid = S.q.questionId;
  const done = () => { if (S.q && S.q.questionId === qid && !S.q.imgReady) { S.q.imgReady = true; if (S.q.imgSlow) render(); } };
  if (im.complete && im.naturalWidth) done(); else { im.addEventListener('load', done, { once: true }); im.addEventListener('error', () => {}, { once: true }); }
}

function go(view) { S.view = view; render(); }
/** Ready for the next product and nothing in the way (checkpoint, offline): ask for it, which starts the 5 s lead. */
let autoT = 0;
function scheduleAuto() {
  clearTimeout(autoT);
  if (!S.run || S.ui.cp || S.ui.cpDue || S.ui.offline || S.ui.leave || !['G03.READY', 'G06.SUCCESS'].includes(S.view)) return;
  autoT = setTimeout(() => { if (['G03.READY', 'G06.SUCCESS'].includes(S.view)) reveal(); }, Math.max(0, S.ui.guardUntil - now()) + 60);
}
function toast(text, no, id) {
  S.ui.toast = { text, no, id, at: now() };
  const t = S.ui.toast; setTimeout(() => { if (S.ui.toast === t) { S.ui.toast = null; render(); } }, DUR.toastMs);
}

// ------------------------------------------------------------------------------------------------ errors → screens
function handleError(e, context) {
  if (!(e instanceof ApiError)) { console.error(e); return go('G11.SERVICE_ERROR'); }
  if (e.status === 401) return go('G11.AUTH_ERROR');
  if (e.code === 'PLAYER_BLOCKED') return go('G11.BLOCKED');
  if (e.code === 'RUN_REPLACED') { S.ended = endedFrom(e.state); return go('G11.OTHER_DEVICE'); }
  if (e.code === 'GAME_UNAVAILABLE') { if (e.state && e.state.state === 'FINISHED') return finished(e.state); return go('G11.GAME_OFF'); }
  if (e.state) return applyRun(e.state, context);
  if (e.network) { S.ui.offline = !navigator.onLine || S.ui.offline; return context === 'boot' ? go('G00.ERROR') : render(); }
  if (e.status >= 500) return go(context === 'boot' ? 'G00.ERROR' : 'G11.SERVICE_ERROR');
  console.warn('unhandled', e.code); return go('G11.SERVICE_ERROR');
}
const endedFrom = st => st ? { score: st.score, checkpoint: st.highestCheckpoint, runId: st.runId } : (S.run ? { score: S.run.score, checkpoint: S.run.highestCheckpoint, runId: S.run.runId } : null);

// ------------------------------------------------------------------------------------------------ splash, home
/**
 * Splash (§3): shown only on the first entry. It waits for the essential data (configuration, authentication, the
 * player's state) — no invented progress or forced delay. A new account goes to the onboarding, others to the home.
 * A run in progress on this device comes first (its deadlines keep running).
 */
/** The launch splash waits for this: one event per boot attempt, ok when a real screen (not a boot error) is showing. */
function bootDone(ok) { root?.dispatchEvent(new CustomEvent('qs:boot', { detail: { ok } })); }
const BOOT_FAILED = ['G00.ERROR', 'G11.SERVICE_ERROR', 'G11.AUTH_ERROR'];
export async function boot() {
  const ok = await bootInner();
  bootDone(!BOOT_FAILED.includes(S.view));
  return ok;
}
async function bootInner() {
  S.gen++; motion.end();
  Object.assign(S, { run: null, ref: null, q: null, fb: null, offer: null, op: null, result: null, keys: {} });
  resetRunUi();
  Object.assign(S.ui, { toast: null, onb: null, daily: null });
  host.setBackHandler(null);
  if (!S.boot) go('G00.SPLASH');
  else go('G01.REFRESHING');                                   // back home between runs: no splash again (§3)
  try { S.boot = await api.bootstrap(); }
  catch (e) { return handleError(e, S.view === 'G00.SPLASH' ? 'boot' : 'home'); }
  const b = S.boot; S.balance = b.balance;
  if (b.access.status === 'blocked') return go('G11.BLOCKED');
  if (b.access.status === 'game_off') return go('G11.GAME_OFF');
  loadHistory(b.lastRunId);
  if (b.activeRun && b.activeRun.onThisDevice && b.activeRun.state === 'PAYMENT_PENDING') { go('G01.OPERATION_PENDING'); return pollPendingAtStart(b.activeRun); }
  if (b.firstVisit && !(b.activeRun && b.activeRun.onThisDevice)) return startOnboarding();
  routeHome();
}

/** Home in the state the server described, with the daily reward modal on top when a reward waits for its claim. */
function routeHome() {
  const b = S.boot;
  if (b.activeRun && b.activeRun.onThisDevice) return go('G01.ACTIVE_RUN');
  const d = b.dailyReward;
  if (d && (d.state === 'claimable' || d.state === 'processing')) {
    S.ui.daily = { phase: d.state === 'processing' ? 'processing' : 'claimable' };
    if (d.state === 'processing') pollDaily();
  }
  go(b.quota.playsLeft > 0 ? 'G01.READY' : 'G01.QUOTA_EXHAUSTED');
  if (S.ui.daily) focusModal();
}
function focusModal() { requestAnimationFrame(() => { const d = root.querySelector('.q-daily'); if (d) d.focus({ preventScroll: true }); }); }   // the dialog, not its button: no focus ring on «دریافت» (owner 2026-10-25); Tab reaches the button

/** «کالاهای دست قبلی»: only the products shown in the player's latest finished run (§5), loaded once per run id. */
async function loadHistory(runId) {
  if (!feat('products')) return;
  if (!runId) { Object.assign(S.home, { runId: null, products: null, state: 'none' }); return; }
  if (S.home.runId === runId && S.home.state === 'ready') return;
  Object.assign(S.home, { runId, products: null, state: 'loading', positioned: null, scroll: null, page: 0 });
  try {
    const list = await api.products(runId);
    if (S.home.runId !== runId) return;
    S.home.products = list; S.home.state = 'ready';
  } catch (e) { if (S.home.runId === runId) S.home.state = 'error'; }
  if (S.view.startsWith('G01.')) render();
}
/** Restore the player's own scroll; once per run, bring the card of the last loss into view. */
function afterHomeRender() {
  const sc = root.querySelector('[data-hscroll="history"]'); if (!sc) return;
  const runId = S.home.runId;
  if (S.home.positioned === runId && S.home.scroll != null) sc.scrollLeft = S.home.scroll;
  sc.addEventListener('scroll', () => { if (S.home.positioned === runId) S.home.scroll = sc.scrollLeft; }, { passive: true });
  if (S.home.positioned === runId) return;
  requestAnimationFrame(() => {
    const s2 = root.querySelector('[data-hscroll="history"]'); if (!s2 || S.home.positioned === runId) return;
    const t = s2.querySelector('[data-loss]');
    if (t) s2.scrollLeft += t.getBoundingClientRect().left + t.offsetWidth / 2 - (s2.getBoundingClientRect().left + s2.clientWidth / 2);   // centre, RTL-safe
    S.home.positioned = runId; S.home.scroll = s2.scrollLeft;
  });
}

async function pollPendingAtStart(active) {   // 1 s backing off to 2 s while the server still waits for the payment
  const g = S.gen; let delay = 1000;
  while (g === S.gen) {
    await sleep(delay); delay = Math.min(2000, delay + 500);
    if (g !== S.gen) return;
    try {
      const run = await api.run(active.runId);
      if (run.state !== 'PAYMENT_PENDING') { S.boot.activeRun = run.state === 'FINISHED' ? null : { ...active, state: run.state }; return run.state === 'FINISHED' ? boot() : go('G01.ACTIVE_RUN'); }
    } catch (e) { if (!(e instanceof ApiError) || !e.network) return handleError(e); }
  }
}

// ------------------------------------------------------------------------------------------------ daily reward (G01.DAILY_REWARD)
/** One claim per tap; the first success closes the modal and shows the home (no second «دریافت» surface, §10, §15). */
async function claimDaily() {
  const d = S.ui.daily; if (!d || ['claiming', 'processing'].includes(d.phase)) return;
  d.phase = 'claiming'; render();
  const key = S.keys.daily ||= newKey(), g = S.gen;
  try {
    const v = await api.claimDaily(key);
    if (g !== S.gen) return;
    S.keys.daily = null;
    applyDaily(v);
  } catch (e) {
    if (g !== S.gen) return;
    if (e instanceof ApiError && e.network) { Object.assign(S.ui.daily, { phase: 'error', message: null }); return render(); }   // same key on retry
    if (e instanceof ApiError && e.code === 'REQUEST_IN_PROGRESS') { S.ui.daily.phase = 'processing'; render(); return pollDaily(); }
    S.keys.daily = null;
    if (e instanceof ApiError && (e.code === 'PLAYER_BLOCKED' || e.status === 401)) { S.ui.daily = null; return handleError(e); }
    Object.assign(S.ui.daily, { phase: 'error', message: 'جایزه الان ثبت نشد؛ جایزه‌ات محفوظه. دوباره امتحان کن.' }); render();
  }
}
function applyDaily(v) {
  if (!S.ui.daily || !S.boot) return;
  S.boot.dailyReward = v;
  if (v.state === 'processing') { S.ui.daily.phase = 'processing'; render(); return pollDaily(); }
  if (v.state === 'claimable') { S.ui.daily.phase = 'claimable'; render(); return focusModal(); }
  S.ui.daily = null;                                            // claimed (or delayed: recorded, paid later): straight on to the home
  if (v.state === 'delayed') toast('جایزه‌ات ثبت شد؛ واریزش کمی طول می‌کشه.');
  render();
  refreshBalance();
}
async function refreshBalance() {   // the home's balance after a credit: the server's number only, never a local sum
  const g = S.gen;
  try { const b = await api.bootstrap(); if (g !== S.gen || !S.view.startsWith('G01.')) return; S.boot = { ...S.boot, ...b, dailyReward: S.boot.dailyReward }; S.balance = b.balance; render(); } catch (e) { /* the old number stays */ }
}
async function pollDaily() {   // every 1 s for 8 s, then the recovery state with «بررسی دوباره»
  if (S.ui.dailyPolling) return;
  S.ui.dailyPolling = true;
  const g = S.gen;
  try {
    for (let i = 0; i < 8; i++) {
      await sleep(1000);
      if (g !== S.gen || !S.ui.daily || S.ui.daily.phase !== 'processing') return;
      try { const v = await api.dailyReward(); if (g !== S.gen || !S.ui.daily) return; if (v.state !== 'processing') return applyDaily(v); }
      catch (e) { /* stays processing; the recovery state follows */ }
    }
    if (g === S.gen && S.ui.daily && S.ui.daily.phase === 'processing') { S.ui.daily.phase = 'slow'; render(); }
  } finally { S.ui.dailyPolling = false; }
}
async function checkDaily() {
  const g = S.gen;
  if (!S.ui.daily) return;
  S.ui.daily.phase = 'processing'; render();
  try { const v = await api.dailyReward(); if (g === S.gen) { if (v.state === 'processing') { S.ui.daily.phase = 'slow'; render(); } else applyDaily(v); } }
  catch (e) { if (g === S.gen && S.ui.daily) { S.ui.daily.phase = 'slow'; render(); } }
}

// ------------------------------------------------------------------------------------------------ guide (G02.GUIDE)
function openGuide() {
  S.ui.guideFrom = S.view; S.ui.daily = null;
  host.setBackHandler(() => { if (S.view === 'G02.GUIDE') { closeGuide(); return true; } return false; });
  go('G02.GUIDE');
}
function closeGuide() { host.setBackHandler(null); const v = S.ui.guideFrom || 'G01.READY'; S.ui.guideFrom = null; go(v); }   // opening and closing creates nothing

// ------------------------------------------------------------------------------------------------ start / resume
export async function startRun() {
  if (S.view !== 'G01.READY' || S.ui.offline) return;
  go('G01.STARTING');
  const key = S.keys.start ||= newKey();
  try {
    const st = await api.start(key);
    S.keys.start = null;
    S.gen++;
    S.result = null; S.ended = null;
    resetRunUi();
    S.run = st.run; S.ref = st.run.reference;
    host.setBackHandler(onBack);
    go('G03.READY');
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'ACTIVE_RUN_EXISTS') { S.keys.start = null; return resume(e.body.run_id); }
      if (e.code === 'OPERATION_PENDING') { S.keys.start = null; go('G01.OPERATION_PENDING'); return pollPendingAtStart({ runId: e.body.run_id }); }
      if (e.code === 'DAILY_QUOTA_EXHAUSTED') { S.keys.start = null; return boot(); }
    }
    // a failed request spends nothing: the same key is reused, so a retry never takes a second play (§5)
    if (e instanceof ApiError && e.network) { toast('اتصال برقرار نشد؛ دوباره امتحان کن.', true); return go('G01.READY'); }
    S.keys.start = null;
    handleError(e);
  }
}

export async function resume(runId) {
  go('G10.RESUMING');
  const g = S.gen;
  try { const run = await api.run(runId); if (g !== S.gen) return; host.setBackHandler(onBack); applyRun(run, 'resume'); }
  catch (e) { if (g === S.gen) handleError(e); }
}

/** Rebuilds the view from an authoritative run view (resume, reconnect, any 409 with state). Deadlines never restart. */
function applyRun(run, context) {
  S.ui.resuming = false;
  const q = S.q, settled = q && run.state !== 'QUESTION_OPEN' ? answerFromRun(run, q) : null;
  if (settled) return onAnswer(settled, q);   // settled while its response was outstanding (e.g. a reconnect read): the verdict shows once, in place
  const prev = S.run;
  S.run = run; S.ref = run.reference;
  if (run.state === 'FINISHED') {
    if (S.op && S.op.operationId && run.finishReason === 'continue_failed' && ['G06.PENDING', 'G06.UNKNOWN'].includes(S.view))
      return api.operation(S.op.operationId).then(o => onOperation(o, true)).catch(() => finished(run));
    if (S.view.startsWith('G06.FAILED_END') || S.view === 'G06.REFUNDED') { S.offer = null; return render(); }   // the message stays; «صفحه اصلی» leads on
    return finished(run);
  }
  if (run.state === 'READY') {
    if (['G03.CORRECT_FEEDBACK'].includes(S.view) && context !== 'resume') return render();   // the promotion will land here anyway; drop the reconnect pill
    S.q = null; S.fb = null; S.offer = null; S.op = null;
    return go(S.view === 'G06.SUCCESS' ? 'G06.SUCCESS' : 'G03.READY');
  }
  if (run.state === 'QUESTION_OPEN') {
    const q = run.question;
    if (!S.q || S.q.questionId !== q.questionId) S.q = { ...q, imgReady: false, imgSlow: false, pick: null, key: null };
    else Object.assign(S.q, { t0: q.t0, inputDeadline: q.inputDeadline, acceptDeadline: q.acceptDeadline });
    if (S.view !== 'G03.ANSWER_PENDING' && !S.q.pick && clock.ms(S.q.t0) > clock.serverNow() + 150) return countdown(S.q);   // resumed inside the lead
    if (S.view !== 'G03.ANSWER_PENDING') go('G03.QUESTION_ACTIVE'); else render();
    return tickLoop();
  }
  const lr = run.lastResult;
  if (lr && (!S.fb || S.fb.questionId !== lr.questionId)) {
    const product = S.q && S.q.questionId === lr.questionId ? S.q.product : (prev && prev.question && prev.question.questionId === lr.questionId ? prev.question.product : S.fb ? S.fb.product : null);
    S.fb = { questionId: lr.questionId, kind: lr.result, choice: lr.choice, direction: lr.direction, revealedPrice: lr.revealedPrice, equal: lr.equalPrices,
      product: product || { displayTitle: 'کالای بعدی', imageUrl: '' } };
  }
  if (lr) S.ui.lossReason = lr.result === 'timeout' ? 'timeout' : 'wrong';
  S.q = null;
  if (run.state === 'AWAITING_OFFER') { go('G05.LOADING'); return later(context === 'resume' ? 300 : 0, activateOffer); }
  if (run.state === 'OFFER_OPEN') {
    if (!S.offer || S.offer.offerId !== run.offer.offerId) S.ui.offerOver = false;
    if (S.op && !S.op.operationId && S.offer && S.offer.offerId === run.offer.offerId && ['G06.PENDING', 'G06.UNKNOWN'].includes(S.view)) { S.offer = run.offer; return render(); }
    S.offer = run.offer; S.op = null;
    if (['G06.FAILED_END'].includes(S.view)) return render();
    go('G05.OFFER'); return tickLoop();
  }
  if (run.state === 'PAYMENT_PENDING') {
    S.offer = run.offer;
    if (!S.op || S.op.operationId !== (run.operation && run.operation.operationId)) S.op = { operationId: run.operation ? run.operation.operationId : null, status: 'pending', since: now() };
    go(S.view === 'G06.UNKNOWN' ? 'G06.UNKNOWN' : 'G06.PENDING'); return pollOperation();
  }
}

// ------------------------------------------------------------------------------------------------ reveal / answer
export async function reveal() {
  if (!S.run || S.ui.offline) return;
  if (S.view === 'G03.COUNTDOWN') return showNow();
  if (!['G03.READY', 'G06.SUCCESS', 'G03.PREPARE_FAILED'].includes(S.view) || S.ui.cp || S.ui.cpDue) return;
  if (now() < S.ui.guardUntil) return;                         // a tap falling through from closing the checkpoint
  if (motion.running()) { S.ui.queued = 'reveal'; return; }
  S.ui.toast = null; S.ui.afterContinue = false;
  go('G03.PREPARING');
  const runId = S.run.runId, key = S.keys.reveal ||= newKey(), g = S.gen;
  try {
    let run;
    try { run = await api.reveal(runId, key); }
    catch (e) { if (e instanceof ApiError && e.network) run = await api.reveal(runId, key); else throw e; }   // one retry, same key
    if (g !== S.gen) return;
    S.keys.reveal = null;
    S.run = run;
    if (run.state === 'FINISHED' && run.finishReason === 'no_products') { S.ended = endedFrom(run); host.setBackHandler(null); return go('G03.NO_PRODUCTS_LEFT'); }
    if (run.state !== 'QUESTION_OPEN') return applyRun(run);
    S.q = { ...run.question, imgReady: false, imgSlow: false, pick: null, key: null, buzz: 0 };
    countdown(S.q);
  } catch (e) {
    if (g !== S.gen) return;
    if (e instanceof ApiError && e.network) return go('G03.PREPARE_FAILED');   // keep the key: a retry returns the same question
    S.keys.reveal = null;
    if (e instanceof ApiError && e.code === 'PREPARE_FAILED') return go('G03.PREPARE_FAILED');
    handleError(e);
  }
}

/**
 * The 5 s between questions (owner 2026-10-26): the server sends the next product with a release time 5 s ahead; its photo
 * loads now, hidden, and the question opens by itself at that time (the 10 s answer window starts there). A tap on
 * «نشان بده» asks the server to release it at once.
 */
function countdown(q) {
  const left = clock.ms(q.t0) - clock.serverNow();
  if (left <= 150) return release(q);
  if (q.product && q.product.imageUrl) { const im = new Image(); im.decoding = 'async'; im.src = q.product.imageUrl; im.decode?.().then(() => { if (S.q === q) q.imgReady = true; }).catch(() => {}); }
  S.ui.leadTotal = Math.max(left, S.ui.leadTotal && S.view === 'G03.COUNTDOWN' ? S.ui.leadTotal : 0, 5000);
  go('G03.COUNTDOWN');
  later(left, () => release(q));
}
function release(q) {
  if (S.q !== q || q.pick || !['G03.COUNTDOWN', 'G03.PREPARING', 'G03.READY', 'G06.SUCCESS'].includes(S.view)) return;
  S.ui.morph = DUR.verdictMs; S.ui.leadTotal = 0;
  go('G03.QUESTION_ACTIVE');
  later(DUR.imageSlowMs, () => { if (S.q === q && !q.imgReady) { q.imgSlow = true; render(); } });
  tickLoop();
}
async function showNow() {
  const q = S.q, g = S.gen;
  if (!q || S.ui.showingNow) return;
  S.ui.showingNow = true;
  try {
    const run = await api.reveal(S.run.runId, newKey(), true);
    if (g !== S.gen || S.q !== q) return;
    if (run.state === 'QUESTION_OPEN' && run.question.questionId === q.questionId) Object.assign(q, { t0: run.question.t0, inputDeadline: run.question.inputDeadline, acceptDeadline: run.question.acceptDeadline });
    if (clock.ms(q.t0) <= clock.serverNow() + 150) release(q);
  } catch (e) { /* the release time stands; the question still opens by itself */ }
  finally { S.ui.showingNow = false; }
}

/**
 * The selection is recorded synchronously (both answers lock, the picked one shows its spinner, the timer gives way to
 * «در حال بررسی پاسخ...») and sent at once. From then on the local timer has no say: reaching its zero neither cancels
 * the answer nor shows a loss; only the server's settled result moves the screen. A tap after the visible zero is ignored.
 */
export async function answer(choice) {
  const q = S.q;
  if (!q || q.pick || q.locked || S.view !== 'G03.QUESTION_ACTIVE' || S.ui.offline) return;
  if (clock.serverNow() >= clock.ms(q.inputDeadline)) { lockQuestion(q); return; }
  q.pick = choice; q.key ||= newKey();
  S.ui.morph = 0; go('G03.ANSWER_PENDING');
  const g = S.gen;
  for (let i = 0; i < 3; i++) {   // retry after 1.5 s with the same key, up to 2 times; the server keeps the first
    try {
      const ans = await Promise.race([api.answer(q.questionId, choice, q.key), sleep(1500 + i * 1000).then(() => { throw new ApiError(0, 'SLOW'); })]);
      if (g !== S.gen || S.q !== q) return;
      return onAnswer(ans, q);
    } catch (e) {
      if (g !== S.gen || S.q !== q) return;
      if (e instanceof ApiError && (e.network || e.code === 'REQUEST_IN_PROGRESS')) continue;
      if (e instanceof ApiError && e.code === 'QUESTION_EXPIRED' && e.state) return applyMissFromState(e.state, q);
      return handleError(e);
    }
  }
  return awaitSettlement(q);
}
function lockQuestion(q) { if (q.locked || q.pick) return; q.locked = true; render(); awaitSettlement(q); }

/** An answer the server accepted but whose response was lost is shown from the run's lastResult, never as a loss. */
function answerFromRun(run, q) {
  const lr = run.lastResult;
  if (!lr || lr.questionId !== q.questionId) return null;
  const cp = run.highestCheckpoint;
  return { result: lr.result, choice: lr.choice, direction: lr.direction, revealedPrice: lr.revealedPrice, equalPrices: lr.equalPrices, run,
    noOfferReason: run.noOfferReason, runFinished: run.state === 'FINISHED',
    checkpointReached: lr.result === 'correct' && cp && cp.requiredCorrect === run.score ? cp : null };
}
function applyMissFromState(run, q) {
  if (run.state === 'QUESTION_OPEN' && run.question && run.question.questionId === q.questionId) { S.run = run; return awaitSettlement(q); }
  S.ui.resuming = false; S.ui.slowSettle = false;
  const ans = answerFromRun(run, q);
  if (ans) return onAnswer(ans, q);
  applyRun(run);
}

/**
 * One reader for a question whose outcome is the server's to settle (an answer in flight or lost, or the visible zero
 * reached without one). A timeout cannot be settled before the arrival deadline, so it waits for that first; then it
 * reads the run every 700 ms for 12 reads and with a backoff capped at 10 s after that, showing «بررسی دوباره».
 */
async function awaitSettlement(q) {
  if (q.polling) return;
  q.polling = true;
  const g = S.gen;
  try {
    const wait = clock.ms(q.acceptDeadline) + 300 - clock.serverNow();
    if (!q.pick && wait > 0) await sleep(wait);
    for (let i = 0; g === S.gen && S.q === q; i++) {
      if (i === 12 && !S.ui.slowSettle) { S.ui.slowSettle = true; render(); }
      if (await readSettlement(q, g)) return;
      await sleep(i < 12 ? 700 : Math.min(10000, 700 * 2 ** (i - 11)));
    }
  } finally { q.polling = false; }
}
async function readSettlement(q, g) {
  try {
    const run = await api.run(S.run.runId);
    if (g !== S.gen || S.q !== q) return true;
    if (run.state !== 'QUESTION_OPEN' || run.question.questionId !== q.questionId) { S.ui.slowSettle = false; applyMissFromState(run, q); return true; }
  } catch (e) { if (!(e instanceof ApiError) || !e.network) { handleError(e); return true; } }
  return false;
}

function onAnswer(ans, q) {
  S.run = ans.run; S.ui.slowSettle = false;
  S.fb = { questionId: q.questionId, kind: ans.result, choice: ans.choice, direction: ans.direction, revealedPrice: ans.revealedPrice, equal: ans.equalPrices, product: q.product };
  S.q = null;
  S.ui.morph = DUR.verdictMs;
  S.ui.noOffer = ans.noOfferReason;
  if (ans.result === 'correct') {
    haptic('correct');
    go('G03.CORRECT_FEEDBACK');
    const reached = ans.checkpointReached, fb = S.fb, reward = ans.checkpointReward || null;
    if (ans.recordReward) S.ui.recordToast = `به رکوردت رسیدی؛ ${fa(ans.recordReward.amount)} دیجی‌کوین جایزه.`;   // a short, secondary note (§13)
    later(DUR.correctHoldMs, () => {                           // readable verdict first, then the promotion
      if (S.fb !== fb) return;
      S.ref = { displayTitle: fb.product.displayTitle, imageUrl: fb.product.imageUrl, price: fb.revealedPrice };
      S.fb = null;
      if (ans.runFinished) return finished(S.run);
      S.ui.cpDue = reached || null;
      S.ui.morph = DUR.promoteMs; go('G03.READY');             // the answered card moves into the first product's place
      if (reached) later(DUR.promoteMs + 60, () => { if (S.ui.cpDue === reached) openCp(reached, reward); });
      else showRecordToast();
    });
    return;
  }
  haptic('wrong');
  S.ui.lossReason = ans.result === 'timeout' ? 'timeout' : 'wrong';
  go(ans.result === 'timeout' ? 'G03.TIMEOUT' : 'G03.WRONG_FEEDBACK');
  afterFeedback(S.run);
}
function showRecordToast() { const t = S.ui.recordToast; if (t) { S.ui.recordToast = null; toast(t); render(); } }

/** After a miss: the verdict stays readable in place, then the loss screen opens once (§8). */
function afterFeedback(run) {
  const fb = S.fb;
  later(DUR.missHoldMs, () => {
    if (S.fb !== fb) return;
    if (run.state === 'AWAITING_OFFER') { go('G05.LOADING'); return activateOffer(); }
    if (run.state === 'OFFER_OPEN') { S.offer = run.offer; go('G05.OFFER'); return tickLoop(); }
    finished(run);
  });
}

async function activateOffer() {
  if (!S.run) return;
  const runId = S.run.runId, intent = 'offer:' + runId + ':' + (S.run.lastResult ? S.run.lastResult.questionId : ''), key = S.keys[intent] ||= newKey(), g = S.gen;
  try {
    let act;
    try { act = await api.activateOffer(runId, key); }
    catch (e) { if (e instanceof ApiError && e.network) act = await api.activateOffer(runId, key); else throw e; }
    if (g !== S.gen) return;
    delete S.keys[intent];
    S.run = act.run;
    if (act.balance != null) S.balance = act.balance;
    if (act.offer && (act.run.state === 'OFFER_OPEN' || act.run.state === 'PAYMENT_PENDING')) { S.offer = act.offer; S.ui.offerOver = false; go('G05.OFFER'); return tickLoop(); }
    S.ui.noOffer = act.noOfferReason;
    if (act.noOfferReason === 'no_funds') return finished(act.run, 'G05.NO_FUNDS');   // the same surface explains the shortfall (§12)
    finished(act.run);
  } catch (e) { if (g === S.gen) handleError(e); }
}

// ------------------------------------------------------------------------------------------------ continue / home / leave
/**
 * Extra-life purchase from the loss screen: one tap locks the button before the request leaves; the request is admitted
 * by its arrival time (offer start + 15 s). The game resumes only after the server confirms the charge; a lost response
 * is recovered by the operation's own id, never by a second purchase (§12: one 5-coin debit, one continue).
 */
export async function continueOffer() {
  if (!S.offer || S.op || S.ui.offline || S.ui.offerOver) return;
  if (S.offer.deadline && clock.serverNow() >= clock.ms(S.offer.deadline)) return offerTimeUp();
  const offerId = S.offer.offerId;
  S.op = { key: S.keys['continue:' + offerId] ||= newKey(), status: 'pending', since: now(), operationId: null };
  go('G06.PENDING');
  const g = S.gen;
  try {
    let opv;
    try { opv = await api.continueOffer(offerId, S.op.key); }
    catch (e) { if (e instanceof ApiError && e.network) opv = await api.continueOffer(offerId, S.op.key); else throw e; }
    if (g !== S.gen) return;
    onOperation(opv);
  } catch (e) {
    if (g !== S.gen) return;
    if (e instanceof ApiError && (e.network || e.code === 'REQUEST_IN_PROGRESS')) { go('G06.UNKNOWN'); return pollOperation(); }
    S.op = null;
    if (e instanceof ApiError && e.code === 'OFFER_EXPIRED') return e.state ? applyRun(e.state) : reconcileRun();
    handleError(e);
  }
}

function onOperation(opv, fromPoll = false) {
  const op = S.op || {};
  if (op.operationId && opv.operationId !== op.operationId) return;   // a late response of another operation
  Object.assign(op, { operationId: opv.operationId, status: opv.status, chargeStatus: opv.chargeStatus, refundStatus: opv.refundStatus });
  S.op = op;
  if (opv.balance != null) S.balance = opv.balance;
  S.run = opv.run;
  if (opv.status === 'succeeded') {
    S.op = null; S.offer = null; S.fb = null; S.ui.afterContinue = true;
    toast(`ادامه ثبت شد؛ ${fa(cfg().continueRule.cost)} دیجی‌کوین کسر شد`);
    return go('G06.SUCCESS');                                  // same run, same first product, score and checkpoints kept (R-07)
  }
  if (opv.status === 'failed') {
    delete S.keys['continue:' + (S.offer && S.offer.offerId)];  // a retry after a rejected debit is a new request, not a replay
    S.op = null;
    if (S.offer && (!S.offer.deadline || clock.serverNow() < clock.ms(S.offer.deadline)) && opv.run.state === 'OFFER_OPEN') { go('G06.FAILED_RETRY'); return tickLoop(); }
    go('G06.FAILED_END');
    if (opv.run.state !== 'FINISHED') later(1000, reconcileRun);
    return;
  }
  if (opv.status === 'refunded') return go('G06.REFUNDED');
  if (opv.status === 'expired_unconfirmed') { go('G06.FAILED_END.UNCONFIRMED'); return watchRefund(opv.operationId); }
  if (S.view !== 'G06.UNKNOWN') go('G06.PENDING');
  if (!fromPoll) pollOperation();
}

async function pollOperation() {   // 1 s backing off to 5 s; G06.UNKNOWN (with «بررسی دوباره») after 5 s; until the server settles
  if (S.ui.polling) return;
  S.ui.polling = true;
  const g = S.gen; let delay = 1000;
  try {
    while (g === S.gen && S.op && ['G06.PENDING', 'G06.UNKNOWN'].includes(S.view)) {
      await sleep(delay); delay = Math.min(5000, delay * 1.6);
      if (g !== S.gen || !S.op) return;
      if (S.view === 'G06.PENDING' && now() - S.op.since > 5000) go('G06.UNKNOWN');
      if (!S.op.operationId) { await resendPurchase(g); continue; }
      const opId = S.op.operationId;
      try { const o = await api.operation(opId); if (g !== S.gen || !S.op) return; if (S.op.operationId !== opId) continue; onOperation(o, true); }
      catch (e) { if (g !== S.gen) return; if (!(e instanceof ApiError) || !e.network) return handleError(e); }
    }
  } finally { S.ui.polling = false; }
}

/** The purchase response was lost: the same request (same key) is sent again while it could still arrive in time. */
async function resendPurchase(g) {
  const op = S.op, offer = S.offer;
  if (!op || !offer || (offer.acceptDeadline || offer.deadline) && clock.serverNow() > clock.ms(offer.acceptDeadline || offer.deadline)) return reconcileRun();
  try { const opv = await api.continueOffer(offer.offerId, op.key); if (g === S.gen && S.op === op) onOperation(opv, true); }
  catch (e) {
    if (g !== S.gen || S.op !== op) return;
    if (e instanceof ApiError && (e.network || e.code === 'REQUEST_IN_PROGRESS')) return;
    S.op = null;
    if (e instanceof ApiError && e.state) return applyRun(e.state);
    handleError(e);
  }
}

/** A late-confirmed debit is refunded by the server; while its message is shown, look for the refund for 2 minutes. */
async function watchRefund(operationId) {
  const g = S.gen;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    if (g !== S.gen || S.view !== 'G06.FAILED_END.UNCONFIRMED') return;
    try { const o = await api.operation(operationId); if (o.balance != null) S.balance = o.balance; if (o.status === 'refunded') { S.op = { ...S.op, ...o }; return go('G06.REFUNDED'); } }
    catch (e) { /* the message stays */ }
  }
}

async function reconcileRun() {
  if (!S.run) return;
  const g = S.gen, runId = S.run.runId;
  try { const run = await api.run(runId); if (g === S.gen && S.run && S.run.runId === runId) applyRun(run); }
  catch (e) { if (g === S.gen && (!(e instanceof ApiError) || !e.network)) handleError(e); }
}

/** The visible offer window is over and nothing was bought: continue disappears; the server ends the offer at its arrival deadline. */
function offerTimeUp() {
  if (S.ui.offerOver || S.view !== 'G05.OFFER') return;
  S.ui.offerOver = true; render();
  const g = S.gen, until = S.offer ? clock.ms(S.offer.acceptDeadline || S.offer.deadline) + 1500 : 0;
  (async () => {
    while (g === S.gen && S.view === 'G05.OFFER' && S.ui.offerOver) {
      await sleep(clock.serverNow() < until ? Math.max(300, until - clock.serverNow()) : 1500);
      if (g !== S.gen || S.view !== 'G05.OFFER') return;
      await reconcileRun();
    }
  })();
}

/**
 * «صفحه اصلی» and back on the loss screen (§11, §12): the run ends once — an open offer is declined with its own key —
 * and the home opens without any old decision modal. Locked while a payment or the offer activation is in flight.
 */
const LOSS_BACK = () => { if (isLoss(S.view)) { lossHome(); return true; } return false; };
/** «رد کردن» or ✕ on the offer (end screen 1): the offer is declined once with its own key; the run then ends and the result shows. */
async function skipOffer() {
  if (!S.offer || S.op || S.ui.skipping || S.ui.offerOver || !['G05.OFFER', 'G06.FAILED_RETRY'].includes(S.view)) return;
  const offerId = S.offer.offerId, key = S.keys['skip:' + offerId] ||= newKey(), g = S.gen;
  S.ui.skipping = true; render();
  try { await api.skip(offerId, key); }
  catch (e) {
    if (g !== S.gen) return;
    S.ui.skipping = false;
    if (e instanceof ApiError && (e.network || e.status >= 500)) { toast('اتصال برقرار نشد؛ دوباره امتحان کن.', true); return render(); }
  }
  if (g !== S.gen) return;
  S.ui.skipping = false;
  reconcileRun();
}
async function lossHome() {
  if (['G05.LOADING', 'G06.PENDING', 'G06.UNKNOWN'].includes(S.view)) return;
  const r = S.run;
  if (r && r.state === 'OFFER_OPEN' && S.offer && !S.op) {
    const offerId = S.offer.offerId, key = S.keys['skip:' + offerId] ||= newKey();
    try { await api.skip(offerId, key); } catch (e) { if (e instanceof ApiError && (e.network || e.status >= 500)) { toast('اتصال برقرار نشد؛ دوباره امتحان کن.', true); return render(); } }
  }
  boot();
}

function onBack() {
  if (!S.run) return false;
  if (S.ui.cp) return true;                                   // the celebration closes with its own button only
  if (S.op || S.view === 'G03.ANSWER_PENDING') return true;   // back is blocked while an answer or a payment is in flight
  if (isLoss(S.view)) { lossHome(); return true; }
  if (inRun(S.view)) { S.ui.leave = true; render(); return true; }
  return false;
}

export async function leaveConfirmed() {
  if (!S.run) return;
  S.ui.leave = false;
  const key = S.keys['leave:' + S.run.runId] ||= newKey();
  try { await api.leave(S.run.runId, key); boot(); } catch (e) { handleError(e); }   // leaving is not losing: straight home
}

// ------------------------------------------------------------------------------------------------ checkpoint (G04)
/**
 * Mounted ONCE per (run, checkpoint) into its own host that render() never touches, so a re-render, a replayed answer or
 * a recovered run cannot replay it. The reward was registered by the server with the crossing answer; the only control
 * is «ادامه بده» (no countdown, no automatic continue, no second «دریافت»).
 */
let cpToken = 0, cpTimers = [];
function openCp(c, reward) {
  const k = S.run.runId + ':' + c.checkpointId;
  if (S.ui.cpShown.has(k)) return;
  S.ui.cpShown.add(k);
  const token = ++cpToken;
  S.ui.cp = c; S.ui.cpDue = null; S.ui.cpAt = now();
  haptic('checkpoint');
  cpEl.innerHTML = V.cpOverlay(c, cpIndex(c), reward, nextCp(c.requiredCorrect));
  screenEl.inert = true;
  root.dataset.view = stateId();
  cpTimers.push(later(DUR.cpGuardMs, () => { if (cpToken !== token) return; const b = $('.q-cp [data-act="cp-go"]', cpEl); if (b) b.focus({ preventScroll: true }); }));
}
function unmountCp() {
  cpToken++;
  cpTimers.forEach(clearTimeout); cpTimers = [];
  S.ui.cp = null;
  if (cpEl) cpEl.innerHTML = '';
  if (screenEl) screenEl.inert = false;
}
export function closeCp() {
  if (!S.ui.cp) return;
  if (now() < S.ui.cpAt + DUR.cpGuardMs) return;               // the earning tap or a double tap cannot dismiss it
  unmountCp();
  S.ui.guardUntil = now() + DUR.afterCpGuardMs;
  render();
  showRecordToast();
}

// ------------------------------------------------------------------------------------------------ timers
let raf = 0, quotaTry = { at: null, n: 0, next: 0 };
/**
 * The next chance's time was reached on the home: ask the server; the start only becomes available when it confirms
 * (a local zero is never permission to play). Retried every 2 s, at most 5 times per reset instant.
 */
async function quotaReset() {
  if (!S.boot) return;
  const at = S.boot.quota.resetsAt;
  if (quotaTry.at !== at) quotaTry = { at, n: 0, next: 0 };
  if (quotaTry.n >= 5 || now() < quotaTry.next) return;
  quotaTry.n++; quotaTry.next = now() + 2000;
  if (S.view === 'G01.QUOTA_EXHAUSTED') go('G01.QUOTA_CHECKING');
  const g = S.gen;
  try {
    const b = await api.bootstrap();
    if (g !== S.gen || !S.view.startsWith('G01.')) return;
    S.boot = b; S.balance = b.balance; routeHome();
  } catch (e) { /* stays «در حال بررسی شانس بعدی...»; tried again */ }
}
function tickLoop() {
  if (raf) return;
  const step = () => {
    raf = 0;
    const v = S.view;
    if ((v === 'G03.QUESTION_ACTIVE' || v === 'G03.ANSWER_PENDING') && S.q) {
      const q = S.q, n = timerNow();
      if (!q.pick && !q.locked) {
        const tm = $('[data-timer]', root);
        if (tm) {
          tm.style.setProperty('--p', n.p);
          if (tm.classList.contains('is-low') !== n.low) { tm.classList.toggle('is-low', n.low); tm.classList.toggle('is-run', !n.low); const l = tm.querySelector('.q-timer__l'); if (l) l.textContent = n.low ? 'وقت داره تموم می‌شه' : 'زمان باقی‌مانده:'; }
          const b = tm.querySelector('.q-timer__n'); if (b && b.textContent !== n.t) { b.textContent = n.t; tm.setAttribute('aria-label', `زمان باقی‌مانده: ${n.t} ثانیه`); }
        }
        // two short warnings at 3 s and 1 s, only through the host's haptics (§7); the visual emphasis works without them
        if (n.rem <= 3000 && q.buzz < 1) { q.buzz = 1; haptic('warning'); }
        if (n.rem <= 1000 && q.buzz < 2) { q.buzz = 2; haptic('warning'); }
        if (n.rem <= 0) lockQuestion(q);
      }
      if (root.dataset.view !== stateId()) root.dataset.view = stateId();
      raf = requestAnimationFrame(step); return;
    }
    if (['G05.OFFER', 'G06.FAILED_RETRY'].includes(v) && S.offer?.deadline) {
      const rem = Math.max(0, clock.ms(S.offer.deadline) - clock.serverNow()), el = $('[data-offer-left]', root);
      if (el) { const s = fa(Math.ceil(rem / 1000)); if (el.textContent !== s) el.textContent = s; }
      if (rem <= 0) {
        if (v === 'G05.OFFER') offerTimeUp();
        else if (!S.ui.offerEnded) { S.ui.offerEnded = true; go('G06.FAILED_END'); later(300, () => { S.ui.offerEnded = false; reconcileRun(); }); }
      }
      raf = requestAnimationFrame(step); return;
    }
    const cd = $('[data-countdown]', root);
    if (cd && S.boot) {
      const rem = clock.ms(S.boot.quota.resetsAt) - clock.serverNow(), s = untilInstant(rem);
      if (cd.textContent !== s) cd.textContent = s;
      if (rem <= 0) quotaReset();
      raf = requestAnimationFrame(step);
    }
  };
  raf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------------------------------------ run end
/**
 * A finished run: a miss shows the loss screen (once, without a continue when none is possible); leaving goes home;
 * the other endings have their own screens. The result is read quietly for the all-time record and a campaign code.
 */
function finished(run, view = 'G05.LOSS') {
  S.gen++;
  S.run = run; S.q = null; S.offer = null; S.op = null;
  const ui = { lossReason: S.ui.lossReason, noOffer: S.ui.noOffer };
  resetRunUi(); Object.assign(S.ui, ui);
  S.ended = endedFrom(run);
  host.setBackHandler(null);
  const r = run.finishReason;
  if (r === 'inactive') return go('G10.INACTIVITY_END');
  if (r === 'replaced') return go('G11.OTHER_DEVICE');
  if (r === 'blocked') return go('G11.BLOCKED');
  if (r === 'game_off') return go('G11.GAME_OFF');
  if (r === 'left') return boot();
  if (r === 'no_products') return go('G03.NO_PRODUCTS_LEFT');
  if (!S.ui.lossReason && run.lastResult) S.ui.lossReason = run.lastResult.result === 'timeout' ? 'timeout' : 'wrong';
  host.setBackHandler(LOSS_BACK);
  go(view);
  loadResult(run.runId);
  loadEndDeals(run.runId);
}
async function loadResult(runId, polls = 0) {
  const g = S.gen;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await api.result(runId); if (g !== S.gen) return; S.result = r; if (S.boot) S.boot.quota = r.quota; if (r.balance != null) S.balance = r.balance;
      // a campaign code is issued shortly after the run ends: read again (every 2 s, at most 10 times) until it is no longer pending
      if (r.campaignCode && r.campaignCode.status === 'pending' && polls < 10) later(2000, () => loadResult(runId, polls + 1));
      return render();
    }
    catch (e) { if (!(e instanceof ApiError) || !(e.network || e.status >= 500)) return; await sleep(600 * (i + 1)); }
  }
}

export async function openProduct(link) {
  const ok = await host.openProduct(link);
  if (!ok) { toast('صفحه کالا باز نشد. دوباره امتحان کن.', true, 'G01.LINK_FAILED'); render(); }
}

export async function copyCode() {
  const R = S.result; if (!R || !R.campaignCode || !R.campaignCode.code) return;
  const ok = await host.copy(R.campaignCode.code);
  if (S.result !== R) return;
  if (!ok) { S.ui.codeState = null; toast('کپی نشد. کد رو نگه دار و دستی کپی کن.', true, 'G05.CAMPAIGN_CODE.COPY_FAILED'); return render(); }
  S.ui.codeState = 'copied'; render();
  setTimeout(() => { if (S.result && S.result.runId === R.runId && S.ui.codeState === 'copied') { S.ui.codeState = null; render(); } }, DUR.copiedMs);
}

// ------------------------------------------------------------------------------------------------ connectivity & lifecycle
function setOffline(off) {
  S.ui.offline = off;
  if (off) return render();
  if (S.run && inRun(S.view)) {
    S.ui.resuming = true; render();
    const g = S.gen;
    api.run(S.run.runId).then(run => { if (g !== S.gen) return; S.ui.resuming = false; applyRun(run); })
      .catch(e => { if (g !== S.gen) return; S.ui.resuming = false; render(); if (!(e instanceof ApiError) || !e.network) handleError(e); });
  } else if (S.view.startsWith('G01.')) boot();               // stale home: refresh before a start is allowed
  else render();
}

export function init(el) {
  root = el;
  root.innerHTML = '<div class="q-screenhost"></div><div class="q-cphost"></div>';
  screenEl = root.firstElementChild; cpEl = root.lastElementChild;
  window.addEventListener('online', () => setOffline(false));
  window.addEventListener('offline', () => setOffline(true));
  document.addEventListener('visibilitychange', () => {       // backgrounding is not leaving; revalidate on return
    if (document.visibilityState !== 'visible') return;
    clock.resetAfterSleep();
    if (['G01.READY', 'G01.QUOTA_EXHAUSTED', 'G01.QUOTA_CHECKING'].includes(S.view) && !S.ui.daily) return boot();   // chances re-synced with the server
    if (S.run && inRun(S.view) && !S.ui.cp && !['G03.CORRECT_FEEDBACK', 'G03.WRONG_FEEDBACK', 'G03.TIMEOUT'].includes(S.view)) reconcileRun();
  });
  root.addEventListener('click', onClick);
  // a product photo that fails (offline CDN, 404) becomes a neutral tile; the title, price and controls stay as they are
  root.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && im.closest('.q-img')) { im.closest('.q-img').classList.add('q-img--none', 'is-failed'); im.remove(); } }, true);
  // a badge image that fails leaves a quiet tile; its real title below stays (never an unexplained blank)
  root.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && im.closest('.q-badgecard__art')) { im.closest('.q-badgecard__art').classList.add('is-failed'); im.remove(); } }, true);
  // the four small badge images are fetched right after start, so their first screen (onboarding, home, checkpoint) is ready
  setTimeout(() => V.BADGES.forEach(id => { const im = new Image(); im.decoding = 'async'; im.src = V.BADGE_SRC(id); im.decode?.().catch(() => {}); }), 0);
  document.addEventListener('keydown', e => {
    const dialog = root.querySelector('[role="dialog"]');
    if (dialog && e.key === 'Escape') {   // safe dismissals only: exit sheet, daily reward, share preview (never a checkpoint or a payment)
      const x = dialog.querySelector('[data-act="leave-no"]:not([disabled]),[data-act="daily-close"]:not([disabled]),[data-act="share-close"]:not([disabled])');
      if (x) { e.preventDefault(); x.click(); }
      return;
    }
    if (!dialog || e.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length);
    if (!focusable.length) {e.preventDefault();return;}
    const i = focusable.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); focusable.at(-1).focus(); }
    else if (!e.shiftKey && (i === -1 || i === focusable.length-1)) { e.preventDefault(); focusable[0].focus(); }
  });
  boot();
}

/** Focus returns to the control that opened a dismissed dialog (or the screen's main action). */
const refocus = sel => requestAnimationFrame(() => { const t = root.querySelector(sel); if (t && !t.disabled) t.focus({ preventScroll: true }); });
function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const a = el.dataset.act;
  const acts = {
    boot, home: boot, start: startRun, reveal, continue: continueOffer, 'ans-higher': () => answer('higher'), 'ans-lower': () => answer('lower'),
    'guide-demo': () => { S.ui.guideTour = true; S.ui.tour = null; render(); },
    'guide-rules': () => { S.ui.guideTour = false; S.ui.tour = null; render(); },
    'tour-replay': () => { S.ui.tour = null; render(); },
    guide: () => { S.ui.guideTour = false; openGuide(); }, 'guide-close': () => { S.ui.guideTour = false; closeGuide(); },
    'onb-skip': finishOnboarding,
    'onb-start': finishOnboarding,   // owner 2026-10-25 evening: the tour ends on the home page, never straight into a run
    'onb-rules': () => { S.ui.guideTour = false; openGuide(); },
    'offer-skip': skipOffer, 'end-close': lossHome, 'end-home': lossHome,
    coins: openCoins, 'coins-retry': openCoins, 'coins-close': closeCoins, 'coins-guide': () => { closeCoins(); S.ui.guideTour = false; openGuide(); },
    deals: () => openDeals('home'), 'deals-end': () => openDeals('end'), 'deals-close': closeDeals,
    'deals-retry': () => { if (S.ui.dealsSrc === 'end' && S.end) { loadEndDeals(S.end.runId); render(); } else { const id = S.home.runId || (S.boot && S.boot.lastRunId); S.home.runId = null; S.home.state = 'loading'; render(); loadHistory(id); } },
    'daily-claim': claimDaily, 'daily-check': checkDaily, 'daily-close': () => { S.ui.daily = null; render(); refocus('[data-act="start"],[data-act="guide"]'); },
    resume: () => resume(S.boot.activeRun.runId),
    back: () => onBack(),
    'leave-no': () => { S.ui.leave = false; render(); refocus('[data-act="back"]'); },
    'leave-yes': leaveConfirmed,
    'loss-home': lossHome,
    'cp-go': closeCp,
    recheck: () => { if (S.op && S.op.operationId) api.operation(S.op.operationId).then(o => onOperation(o, true)).catch(() => {}); else if (S.op) resendPurchase(S.gen); else reconcileRun(); },
    'recheck-answer': () => { if (S.q) readSettlement(S.q, S.gen); },
    'history-retry': () => { const id = S.home.runId; S.home.runId = null; S.home.state = 'loading'; render(); loadHistory(id); },
    'open-product': () => openProduct(el.dataset.link),
    'history-prev': () => { S.home.page = Math.max(0,(S.home.page || 0)-1); render(); },
    'history-next': () => { S.home.page = Math.min(Math.ceil((S.home.products?.items.length || 0)/2)-1,(S.home.page || 0)+1); render(); },
    'share-result': shareResult,
    'share-close': () => {if(S.ui.share?.url)URL.revokeObjectURL(S.ui.share.url);S.ui.share=null;render();refocus('[data-act="share-result"]');},
    'share-send': async () => {if(S.ui.share?.blob){const result=await host.share(S.ui.share.blob,`نتیجهٔ من در قیمت‌شناس: این دست ${fa(S.run?.score || 0)} جواب درست دادم\n${GAME_URL}`);if(result==='unsupported'){toast('اشتراک‌گذاری در این مرورگر در دسترس نیست؛ تصویر رو ذخیره کن.',true);render();}}},
    copy: copyCode,
    'exit-app': () => host.close(),
  };
  if (acts[a]) acts[a]();
}

async function shareResult() {
  if (!S.run || S.ui.share?.busy) return;
  const run = S.run, cp = run.highestCheckpoint;
  S.ui.share = {busy:true}; render();
  try {
    const blob = await createShareCard({score:run.score,title:cp?.title || '',badgeAssetId:cp?.badgeAssetId});
    if (S.run !== run || !S.ui.share) return;
    S.ui.share = {blob,url:URL.createObjectURL(blob)}; render();
  } catch(e) {S.ui.share=null;toast('تصویر آماده نشد؛ دوباره امتحان کن.',true);render();}
}
