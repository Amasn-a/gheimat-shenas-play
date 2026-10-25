// Screen markup of the redesign of 2026-10-21 (white base, Digikala red actions, badge family). Views are pure functions
// of the view model: they never read the network or the clock. All text from data goes through esc()/title().
// Direction rules (§2): back/close sit at the physical right (first in RTL DOM order) and point right. Inside a button the
// icon is written before the label, so it sits at the label's right; the play triangle is mirrored to point at the label (owner 2026-10-25).
import { I } from './icons.js';
import { fa, money, esc, title } from './fmt.js';
import { DEMO_FIRST, DEMO_SECOND } from './demo.js';
const DEMO_MUG = DEMO_FIRST.art, DEMO_HEADPHONES = DEMO_SECOND.art;

const L = ' disabled aria-disabled="true"';
const ICO = (k, s = 20) => I[k].replace('width="24" height="24"', `width="${s}" height="${s}"`);
const SPIN = '<span class="q-spin" aria-hidden="true"></span>';
/** Official DigiCoin asset downloaded from Digikala's own static asset endpoint. */
export const COIN = '<img class="q-coin" src="assets/digicoin-game.svg" width="24" height="23" alt="" aria-hidden="true">';
export const TAG = '<img class="q-logomark" src="assets/game-logo.webp" width="40" height="56" alt="" aria-hidden="true">';
// ?v=2: the 2026-10-25 artwork reuses the old file names, so a cached old badge is never mistaken for the new one
export const BADGE_SRC = id => `assets/badges/${encodeURIComponent(id)}.webp?v=2`;
export const BADGES = ['badge_5', 'badge_10', 'badge_15', 'badge_20'];
/** A checkpoint's badge image; an unknown id (a checkpoint added later in A02) gets the badge of its position. */
export const badgeId = (c, i) => BADGES.includes(c.badgeAssetId) ? c.badgeAssetId : BADGES[Math.min(BADGES.length - 1, Math.max(0, i))];
export const TIER = [['#087f73', '#edf9f5'], ['#3457d5', '#eff3ff'], ['#b96813', '#fff6e9'], ['#7950bf', '#f6f0ff']];   // badge manifest accents
/** Badge card (handoff 2026-10-25): text-free emblem above, the exact title as real text below, one shared frame for all
 *  tiers. The square art slot is reserved before the image loads; a failed image leaves a quiet tile, the title stays. */
export function badge(c, i, cls = '', threshold = false) {
  const [a, t] = TIER[Math.min(TIER.length - 1, Math.max(0, i))];
  return `<figure class="q-badgecard ${cls}" style="--badge-accent:${a};--badge-tint:${t}"><span class="q-badgecard__art"><img src="${BADGE_SRC(badgeId(c, i))}" width="512" height="512" alt="" decoding="async"></span>` +
    `<figcaption><b>${esc(c.title)}</b>${threshold ? `<span>${fa(c.requiredCorrect)} جواب درست</span><span class="q-badgecard__reward${c.rewardAmount > 0 ? ' is-coin' : ''}">${c.rewardAmount > 0 ? `${fa(c.rewardAmount)} دیجی‌کوین جایزه` : 'فقط نشان'}</span>` : ''}</figcaption></figure>`;
}


export const Q_PROMPT = 'این کالا از کالای اول گرون‌تره یا ارزون‌تر؟';   // names both items, so the buttons cannot be misread
export const DIRW = { up: 'گرون‌تر', down: 'ارزون‌تر', eq: 'قیمت برابر' };
export const dirOf = d => d === 'higher' ? 'up' : d === 'lower' ? 'down' : 'eq';

// ---------------------------------------------------------------- primitives
export const keyOf = card => 'p' + hash(card.imageUrl || card.displayTitle || '');
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const mk = (k, fx) => k ? ` data-m="${k}" data-mfx="${fx}"` : '';
export function img(card, keyed, onload) {
  const key = keyed ? mk('img:' + keyOf(card), 'box') : '';
  if (card.art) return `<span class="q-img"${key}>${card.art}</span>`;   // onboarding demo: drawn art, never a catalog product
  if (!card.imageUrl) return `<span class="q-img q-img--none"${key}></span>`;
  return `<span class="q-img"${key}><img src="${esc(card.imageUrl)}" alt="" decoding="async"${onload ? ` data-onload="${onload}"` : ''}></span>`;
}
/** Price with its unit; the number is isolated LTR so digits, separators and «تومان» are read in the right place. */
export const price = (n, cls = '', attrs = '') => `<p class="q-price${cls}"${attrs}><b dir="ltr">${money(n)}</b><small>تومان</small></p>`;
const ICON = icon => icon ? `<i class="q-btn__i${icon === I.play ? ' q-btn__i--play' : ''}">${icon}</i>` : '';
export const BTN = (cls, label, a = '', icon = '') => `<button class="q-btn ${cls}"${a}>${ICON(icon)}<span>${label}</span></button>`;
export const PRIMARY = (label, a, icon) => BTN('q-btn--primary', label, a, icon);
export const BUSY = (label, cls = 'q-btn--primary') => `<button class="q-btn ${cls}" disabled aria-disabled="true" aria-busy="true"><i class="q-btn__i">${SPIN}</i><span>${label}</span></button>`;
export const SECONDARY = (label, a, icon) => BTN('q-btn--secondary', label, a, icon);
export function status(kind, text, icon, spin, alert) {
  const lead = spin ? SPIN : icon ? ICO(icon, 18) : '';
  return `<p class="q-status${kind ? ' q-status--' + kind : ''}" role="${alert ? 'alert' : 'status'}">${lead ? `<span class="q-status__i" aria-hidden="true">${lead}</span>` : ''}<span>${text}</span></p>`;
}
export function toastHTML(t) {
  if (!t) return '';
  return `<div class="q-toast${t.no ? ' q-toast--no' : ''}" role="${t.no ? 'alert' : 'status'}">${ICO(t.no ? 'alert' : 'check', 18)}<span>${t.text}</span></div>`;
}
/** Page header: back/close at the physical right, title, an optional end slot at the left. */
export function hdr(t, act, label, end = '', cls = '') {
  return `<header class="q-hdr${cls}"><button class="q-iconbtn" data-act="${act}" aria-label="${label}">${I.back}</button>${t ? `<h1 class="q-hdr__t">${t}</h1>` : '<span></span>'}<div class="q-hdr__end">${end}</div></header>`;
}
// a modal on top makes the page behind it inert (focus, taps, screen readers)
export const page = (cls, inner, extra = '') => `<div class="q-page ${cls}"${/q-modal/.test(extra) ? ' inert' : ''}>${inner}</div>${extra}`;
export function sheet(t, text, body, btns, icon) {
  const lead = icon ? `<span class="q-sheet__icon q-sheet__icon--${icon[0]}" aria-hidden="true">${ICO(icon[1], 26)}</span>` : '';
  return `<div class="q-scrim q-modal"><section class="q-sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">${lead}<h2 id="sh-t">${t}</h2>${text ? `<p>${text}</p>` : ''}${body || ''}<div class="q-sheet__btns">${btns}</div></section></div>`;
}
export const statecard = (ic, kind, t, text, actions) => `<div class="q-state"><span class="q-state__i${kind ? ' q-state__i--' + kind : ''}" aria-hidden="true">${ICO(ic, 30)}</span><h2>${t}</h2>${text ? `<p>${text}</p>` : ''}<div class="q-state__a">${actions}</div></div>`;

// ---------------------------------------------------------------- G00 splash (§3)
export function vSplash(error) {
  if (!error) return '<div class="q-page q-entry" aria-label="قیمت‌شناس"></div>';
  return page('q-sys', statecard('wifi', 'no', 'بازی باز نشد', 'اتصال اینترنت رو بررسی کن و دوباره امتحان کن.', PRIMARY('تلاش دوباره', ' data-act="boot"', I.refresh)));
}

// ---------------------------------------------------------------- G01 home (§4, §5)
export function balance(b) {
  if (b == null) return '<span class="q-bal is-unknown" aria-label="موجودی دیجی‌کوین نامعلوم">' + COIN + '<b>—</b></span>';
  return `<span class="q-bal" role="img" aria-label="موجودی: ${fa(b)} دیجی‌کوین">${COIN}<b>${fa(b)}</b></span>`;
}
/** The home's bottom sheet (owner 2026-10-25): full-bleed, curved top; the chances line and the one main action. v: the G01 state. */
function homeSheet(v, m) {
  const b = m.boot, q = b.quota;
  const chances = `<p class="q-chances">${ICO('info', 18)}<span>هنوز <b>${fa(q.playsLeft)}</b> شانس داری</span></p>`;
  let cta, pre = '';
  if (v === 'G01.ACTIVE_RUN') {
    const r = b.activeRun;
    pre = status('', `یه دست نیمه‌کاره داری با ${fa(r.score)} جواب درست؛ از همون‌جا ادامه بده.`, 'info');
    cta = PRIMARY('ادامه دست', ' data-act="resume"', I.play);
  } else if (v === 'G01.OPERATION_PENDING') {
    pre = status('', 'پرداخت قبلیت هنوز در حال بررسیه. دوباره کسر نمی‌شه؛ چند لحظه صبر کن.', null, true);
    cta = BUSY('شروع بازی');
  } else if (v === 'G01.STARTING' || v === 'G01.REFRESHING') cta = BUSY('شروع بازی');
  else if (v === 'G01.QUOTA_CHECKING') cta = `<button class="q-btn q-btn--primary" disabled aria-disabled="true" aria-busy="true"><span>در حال بررسی شانس بعدی...</span></button>`;
  else if (v === 'G01.QUOTA_EXHAUSTED') cta = `<button class="q-btn q-btn--primary" disabled aria-disabled="true"><i class="q-btn__i">${ICO('clock')}</i><span>تا شانس بعدی <b dir="ltr" data-countdown>${m.untilReset}</b></span></button>`;
  else if (m.offline) { pre = status('warn', 'اتصال برقرار نیست؛ برای شروع بازی به اینترنت وصل شو.', 'wifi'); cta = `<button class="q-btn q-btn--primary" disabled aria-disabled="true">${ICON(I.play)}<span>شروع بازی</span></button>`; }
  else cta = PRIMARY('شروع بازی', ' data-act="start"', I.play);
  return `<section class="q-homesheet" aria-label="شروع بازی">${pre}${v === 'G01.ACTIVE_RUN' ? '' : chances}${cta}</section>`;
}
/** Promo under the record card: opens the discounted products the player has seen (G12.DEALS). */
const DEALS_BANNER = `<button class="q-dealbanner" data-act="deals" aria-label="تا ۹۰ درصد تخفیف روی کالاهایی که دیدی؛ دیدن کالاها">` +
  `<b>تا ۹۰ درصد تخفیف روی کالاهایی که دیدی!</b><span class="q-dealbanner__go">از دستشون نده و کلیک کن ${ICO('fwd', 16)}</span></button>`;
export function vHome(v, m) {
  const b = m.boot;
  const top = `<header class="q-hdr q-hdr--home"><button class="q-iconbtn" data-act="exit-app" aria-label="بازگشت به اپ">${I.back}</button>` +
    `<h1 class="q-brand">قیمت‌شناس</h1><span class="q-flex"></span>${balance(m.balance)}` +
    `<button class="q-iconbtn q-guidebtn" data-act="guide" aria-label="راهنمای بازی">${ICO('help', 22)}</button></header>`;
  const cps = b.config.checkpoints;
  const earnedIndex = cps.reduce((last,c,i)=>b.record >= c.requiredCorrect ? i : last,-1);
  const side = earnedIndex >= 0 ? badge(cps[earnedIndex], earnedIndex, 'q-record__badge') : '<p class="q-record__none">هنوز بازی نکردی!!!</p>';
  const record = `<section class="q-record" aria-label="بهترین رکوردت: ${fa(b.record)} جواب درست"><div class="q-record__n"><span>بهترین رکوردت</span><b>${fa(b.record)}</b></div>${side}</section>`;
  const o = b.activeRun && !b.activeRun.onThisDevice ? b.activeRun : null;
  const note = o ? status('warn', `یه دست روی دستگاه دیگه‌ات بازه. با شروع دست جدید، اون دست با ${fa(o.score)} جواب درست تموم می‌شه.`, 'devices') : '';
  const camp = b.campaign ? status('', `کمپین ویژه: با رسیدن به ${fa(b.campaign.checkpointRequiredCorrect)} جواب درست، کد تخفیف ${money(b.campaign.codeAmountToman)} تومانی هم می‌گیری.`, 'info') : '';
  return page('q-home', top + `<main class="q-home__scroll">${record}${m.productsOn ? DEALS_BANNER : ''}${camp}${note}</main>` + homeSheet(v, m), (m.modal || '') + toastHTML(m.toast));
}

// ---------------------------------------------------------------- G01 daily reward modal
const WD = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'], WDF = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];   // getUTCDay()
/**
 * «جایزه‌ی روزانه». The 7 days keep the server's floating window and its dates in calendar order: the earliest day sits at
 * the physical right, each next day to its left (RTL, owner 2026-10-25). The only claim button sends one claim; on success the modal closes and the home shows
 * (no second «دریافت شد» surface). ui.phase: claimable | claiming | processing | slow | error.
 */
export function dailyModal(d, ui) {
  const days = [...d.days].sort((a,b)=>a.date.localeCompare(b.date)).map(x => {   // owner 2026-10-25: earlier day at the right (شنبه | یکشنبه | …)
    const w = new Date(x.date + 'T12:00:00Z').getUTCDay();
    const st = x.today ? (x.attended ? 'امروز، حضور ثبت شده' : 'امروز') : x.attended ? 'حضور ثبت شده' : 'غیرفعال';
    return `<li aria-current="${x.today ? 'date' : 'false'}" class="${x.attended ? 'is-on' : ''}${x.today ? ' is-today' : ''}" aria-label="${WDF[w]}، ${st}"><span class="q-day__c" aria-hidden="true">${x.attended ? ICO('check', 16) : ''}</span><span aria-hidden="true">${x.today ? 'امروز' : WD[w]}</span></li>`;
  }).join('');
  const p = ui.phase;
  let body = '', btns;
  if (p === 'claiming') btns = BUSY('دریافت کن');
  else if (p === 'processing') { body = status('', 'در حال ثبت جایزه…', null, true); btns = BUSY('دریافت کن'); }
  else if (p === 'slow') { body = status('warn', 'ثبت جایزه بیشتر از همیشه طول کشیده. جایزه‌ات محفوظه؛ دوباره بررسی کن.', 'clock'); btns = PRIMARY('بررسی دوباره', ' data-act="daily-check"', I.refresh) + SECONDARY('بعداً', ' data-act="daily-close"'); }
  else if (p === 'error') { body = status('no', ui.message || 'اتصال برقرار نشد؛ جایزه‌ات محفوظه. دوباره امتحان کن.', 'alert', false, true); btns = PRIMARY('دوباره امتحان کن', ' data-act="daily-claim"', I.refresh) + SECONDARY('بعداً', ' data-act="daily-close"'); }
  else btns = PRIMARY('دریافت کن', ' data-act="daily-claim"');
  const closable = p !== 'claiming' && p !== 'processing';
  return `<div class="q-scrim q-modal"><section class="q-sheet q-daily" role="dialog" aria-modal="true" aria-labelledby="daily-t" data-phase="${p}">` +
    (closable ? `<button class="q-iconbtn q-sheet__x" data-act="daily-close" aria-label="بستن">${ICO('x', 20)}</button>` : '') +
    `<div class="q-daily__streak"><b>${fa(d.streakDays)}</b><span>روز پشت‌سرهم</span></div><h2 id="daily-t"><span class="q-daily__gift" aria-hidden="true">${ICO('gift', 22)}</span>جایزه‌ی روزانه</h2>` +
    `<ol class="q-days" aria-label="روزهای حضور در هفته اخیر">${days}</ol><p class="q-daily__rw">${COIN}<b>${fa(d.amount)}</b><span>دیجی‌کوین</span></p>${body}<div class="q-sheet__btns">${btns}</div></section></div>`;
}

// ---------------------------------------------------------------- G02 guide (§15) and onboarding (§14)
const GUIDE_ART = {
  compare: `<span class="q-gart q-gart--compare" aria-hidden="true"><i>${TAG}</i><i>${TAG}</i></span>`,
  time: `<span class="q-gart" aria-hidden="true">${ICO('clock', 30)}</span>`,
  badges: `<span class="q-gart q-gart--badges" aria-hidden="true">${BADGES.slice(0, 3).map(b => `<img src="${BADGE_SRC(b)}" alt="">`).join('')}</span>`,
  cont: `<span class="q-gart" aria-hidden="true">${ICO('undo', 30)}</span>`,
};
export function vGuide(m) {
  if (m.demo) return page('q-guide q-guide--tour', tour(m.still, 'guide'));
  const c = m.config, cps = c.checkpoints, cr = c.continueRule;
  const steps = cps.map(x => fa(x.requiredCorrect)), last = steps.pop();
  const firstPaid = cps.findIndex(x => x.rewardAmount > 0);
  const ordinal = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'][firstPaid] || fa(firstPaid + 1) + 'م';
  const sec = (art, h, p) => `<section class="q-gsec">${art}<div><h2>${h}</h2><p>${p}</p></div></section>`;
  const body = sec(GUIDE_ART.compare, 'مقایسه قیمت', 'قیمت کالای اول معلومه. حدس بزن کالای دوم گرون‌تره یا ارزون‌تر.') +
    sec(GUIDE_ART.time, `${fa(Math.round(c.inputMs / 1000))} ثانیه فرصت`, `برای هر مقایسه ${fa(Math.round(c.inputMs / 1000))} ثانیه وقت داری.`) +
    sec(GUIDE_ART.badges, 'عنوان تازه بگیر', `با ${steps.join('، ')} و ${last} جواب درست، عنوان تازه می‌گیری${firstPaid >= 0 ? `؛ از چک‌پوینت ${ordinal} دیجی‌کوین هم داری` : ''}.`) +
    (cr.enabled && cr.cap > 0 ? sec(GUIDE_ART.cont, 'همون دست رو ادامه بده', `اگر امکان ادامه داشته باشی، می‌تونی با ${fa(cr.cost)} دیجی‌کوین همون دست رو ادامه بدی.`) : '');
  return page('q-guide', hdr('راهنمای قیمت‌شناس', 'guide-close', 'بستن راهنما') + `<main class="q-guide__body">${body}</main>` +
    `<footer class="q-foot">${SECONDARY('نمایش آموزش متحرک',' data-act="guide-demo"', I.play)}${PRIMARY('فهمیدم', ' data-act="guide-close"')}</footer>`);
}
/**
 * The animated tour (owner 2026-10-25): one practice game screen; the camera moves to each part in turn and the beats play
 * by themselves (no «بعدی»). Story-style segments show the progress; holding a finger pauses; «رد کردن» is always there.
 * The whole stage is rendered once; the controller only changes data-beat, and CSS does the rest. Demo products are
 * drawn art, never catalog products, and nothing here touches the server or spends a play.
 */
export const TOUR = [
  ['قیمت این کالا معلومه', 'ماگ سرامیکی ۲۴۵٬۰۰۰ تومنه؛ این قیمت مرجع توئه.'],
  ['قیمت این یکی مخفیه', 'باید حدس بزنی هدفون از ماگ گرون‌تره یا ارزون‌تر.'],
  ['۱۰ ثانیه وقت داری', 'زمان از وقتی کالای دوم نشون داده می‌شه شروع می‌شه.'],
  ['حدس بزن: گرون‌تره یا ارزون‌تره؟', 'هدفون گرون‌تر به نظر می‌رسه؛ «گرون‌تره» رو می‌زنیم.'],
  ['هر جواب درست یعنی یک قدم جلوتر', 'هدفون ۸۹۰٬۰۰۰ تومنه؛ درست گفتی و یک امتیاز گرفتی.'],
  ['به چک‌پوینت برسی، جایزه می‌گیری', 'سر هر چک‌پوینت نشان تازه، و از بعضی‌ها دیجی‌کوین هم می‌گیری.'],
];
const HAND = '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M18 22V9a4 4 0 0 1 8 0v11l9.6 1.6A5 5 0 0 1 40 27.5L38 39a6 6 0 0 1-6 5H22a6 6 0 0 1-4.8-2.4L9.5 31.3a3.6 3.6 0 0 1 5.2-5L18 29Z" fill="#fff"/><path d="M18 22V9a4 4 0 0 1 8 0v11l9.6 1.6A5 5 0 0 1 40 27.5L38 39a6 6 0 0 1-6 5H22a6 6 0 0 1-4.8-2.4L9.5 31.3a3.6 3.6 0 0 1 5.2-5L18 29Z" fill="none" stroke="#1d2a5c" stroke-width="2.4" stroke-linejoin="round"/></svg>';
export function tour(still, from) {
  const cps = [{ requiredCorrect: 1, rewardAmount: 0, badgeAssetId: 'badge_5', title: 'بازاری تازه‌کار' }, { requiredCorrect: 3, rewardAmount: 1, badgeAssetId: 'badge_10', title: 'بازاری قدیمی' },
    { requiredCorrect: 6, rewardAmount: 3, badgeAssetId: 'badge_15', title: 'قیمت‌شناس حرفه‌ای' }, { requiredCorrect: 10, rewardAmount: 5, badgeAssetId: 'badge_20', title: 'قیمت‌شناس اعظم' }];
  const ref = { displayTitle: 'ماگ سرامیکی', imageUrl: 'demo:first', art: DEMO_MUG, price: 245000 };
  const cmp = { displayTitle: 'هدفون بی‌سیم', imageUrl: 'demo:second', art: DEMO_HEADPHONES };
  const segs = TOUR.map(() => '<i><b></b></i>').join('');
  const caps = TOUR.map(([h, p], i) => `<div class="q-tour__cap" data-cap="${i + 1}"><h2>${h}</h2><p>${p}</p></div>`).join('');
  const screen = `<div class="q-tour__screen q-game" aria-hidden="true" inert>${gameTop(0, true).replace('<b>۰</b>', '<b><span class="q-tour__s0">۰</span><span class="q-tour__s1">۱</span></b>')}` +
    `<div class="q-tour__trk">${track(0, cps)}</div>` +
    `<div class="q-tour__tm">${timer({ mode: 'run', t: fa(7) })}${timer({ mode: 'verdict', kind: 'ok', title: 'درست گفتی!', sub: 'گرون‌تر بود' })}</div>` +
    `<main class="q-game__main">${refCard(ref, true)}<div class="q-tour__cmp">${cmpCard(cmp, 'hidden', 0)}${cmpCard(cmp, 'ok', 890000)}</div></main>` +
    `<div class="q-tour__dec">${decide('on', null, '', 0)}${decide('ok', 'higher', '', 0)}<span class="q-tour__hand">${HAND}</span></div></div>`;
  const end = `<div class="q-tour__end" data-cap="7"><h2>حالا نوبت توئه!</h2><p>قیمت‌ها رو مقایسه کن، رکورد بزن و نشان بگیر.</p>` +
    (from === 'guide' ? PRIMARY('فهمیدم', ' data-act="guide-close"') + BTN('q-btn--text', 'دوباره ببینم', ' data-act="tour-replay"', ICO('replay', 18))
      : PRIMARY('شروع بازی', ' data-act="onb-start"', I.play) + BTN('q-btn--text', 'راهنمای متنی', ' data-act="onb-rules"')) + '</div>';
  return `<section class="q-tour${still ? ' is-still' : ''}" data-beat="1" aria-label="آموزش بازی">` +
    `<div class="q-tour__top"><div class="q-tour__segs" aria-hidden="true">${segs}</div>` +
    `<button class="q-tour__skip" data-act="${from === 'guide' ? 'guide-rules' : 'onb-skip'}">${from === 'guide' ? 'بستن' : 'رد کردن'}</button></div>` +
    `<div class="q-tour__stage" data-tour-hold><div class="q-tour__cam">${screen}</div></div>` +
    `<div class="q-tour__caps" role="status" aria-live="polite">${caps}${end}</div></section>`;
}
export function vOnboard(m, still) {
  return page('q-onb q-onb--tour', tour(still, 'onb') + (m.error || m.busy ? `<div class="q-tour__save">${m.busy ? status('', 'در حال ذخیره…', null, true) : status('no', m.error, 'alert', false, true)}</div>` : ''));
}

// ---------------------------------------------------------------- gameplay (§6, §7, §8, §10)
/** Top bar: back at the right, the game name, the correct-answer count at the left. No balance (§1). */
export function gameTop(score, backLocked) {
  return `<header class="q-hdr q-hdr--game"><button class="q-iconbtn" data-act="back" aria-label="خروج از دست"${backLocked ? L : ''}>${I.back}</button><h1 class="q-hdr__t">قیمت‌شناس</h1>` +
    `<div class="q-hdr__end"><span class="q-score" aria-live="polite"><b>${fa(score)}</b><small>جواب درست</small></span></div></header>`;
}
/** A paying checkpoint shows the DigiCoin alone (owner 2026-10-25: no amount on it, the coin says «you earn DigiCoin here»). */
const coinStack = () => `<span class="q-stack">${COIN}</span>`;
/** Main progress bar (kept, §10): fills with the score; each checkpoint shows its real reward — the badge when it pays no coin. */
export function track(score, cps) {
  const last = cps.length ? cps[cps.length - 1].requiredCorrect : 1;
  const f = Math.min(1, score / last);
  const nodes = cps.map((c, i) => {
    const ic = c.rewardAmount > 0 ? coinStack() : `<img src="${BADGE_SRC(badgeId(c, i))}" alt="" width="34" height="33">`;
    return `<li class="${c.requiredCorrect <= score ? 'is-done' : ''}" style="--x:${(100 * c.requiredCorrect / last).toFixed(2)}%"><span class="q-track__ic">${ic}</span><span class="q-track__n">${fa(c.requiredCorrect)}</span></li>`;
  }).join('');
  const next = cps.find(c => c.requiredCorrect > score);
  const label = next ? `${fa(score)} جواب درست؛ چک‌پوینت بعدی با ${fa(next.requiredCorrect)} جواب درست${next.rewardAmount > 0 ? ` و ${fa(next.rewardAmount)} دیجی‌کوین` : ''}` : `${fa(score)} جواب درست؛ همه‌ی چک‌پوینت‌ها رو گرفتی`;
  return `<div class="q-track" role="progressbar" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${Math.min(score, last)}" aria-label="${label}">` +
    `<div class="q-track__line"><i style="--f:${f.toFixed(4)}"></i></div><ol aria-hidden="true">${nodes}</ol></div>`;
}
/**
 * Timer plate above the products (§7): the words on the right, the seconds on the left in a pulsing cap, no bar.
 * mode: idle · run · low (last 3 s: only the digits and their ring turn red) · zero · busy (answer sent) ·
 * verdict (owner 2026-10-26: the result shows here, in place of the seconds, until the next question).
 */
export function timer(o) {
  const mode = o.mode;
  if (mode === 'verdict') {
    const ic = { ok: 'check', no: 'x', time: 'clock' }[o.kind];
    return `<div class="q-timer is-verdict is-${o.kind}" data-tour="timer" role="status"><span class="q-timer__l"><b>${o.title}</b>${o.sub ? `<span>${o.sub}</span>` : ''}</span>` +
      `<span class="q-timer__n q-timer__v${o.pop ? ' q-pop-once' : ''}" aria-hidden="true">${ICO(ic, 24)}</span></div>`;
  }
  const n = mode === 'idle' ? fa(10) : mode === 'zero' ? fa(0) : o.t;
  const lab = { idle: 'ثانیه وقت داری', run: 'ثانیه وقت داری', low: 'وقت داره تموم می‌شه', zero: 'زمان تموم شد', busy: 'در حال بررسی پاسخ...' }[mode];
  const num = mode === 'busy' ? `<span class="q-timer__n">${SPIN}</span>` : `<b class="q-timer__n">${n}</b>`;
  const live = mode === 'run' || mode === 'low';
  return `<div class="q-timer is-${mode}" data-tour="timer" ${live ? 'role="timer" data-timer' : 'role="status"'} aria-label="${mode === 'zero' ? lab : mode === 'busy' ? 'در حال بررسی پاسخ' : `${n} ${lab}`}">` +
    `<span class="q-timer__l">${lab}</span>${num}</div>`;
}
export function refCard(card, strip) {
  const k = keyOf(card);
  return `<article class="q-ref${strip ? ' q-ref--strip' : ''}" aria-label="کالای اول، ${money(card.price)} تومان"${mk('card:' + k, 'frame')} data-tour="first">${img(card, true)}` +
    `<div class="q-ref__b"><h2 class="q-ref__t"${mk('ttl:' + k, 'text')}>${title(card.displayTitle)}</h2>${price(card.price, '', mk('prc:' + k, 'text'))}</div></article>`;
}
/**
 * Between questions (owner 2026-10-26): «نشان بده» fills over the 5 s lead and the next product then shows by itself; a tap
 * shows it at once. state: wait (asking for the next product) · count ({total, left} ms) · failed · off.
 */
export function revealCard(state, lead) {
  const failed = state === 'failed', off = state === 'off';
  const t = failed ? 'کالا آماده نشد' : 'آماده‌ای مقایسه کنی؟';
  const p = failed ? 'امتیاز و زمانت سالمه؛ دوباره امتحان کن.' : off ? 'اتصال قطع شد. هنوز سؤالی شروع نشده؛ دستت محفوظه.' : '';
  const fill = state === 'count' && lead ? ` style="--lead-total:${lead.total}ms;--lead-delay:${lead.left - lead.total}ms"` : '';
  const b = off ? `<button class="q-btn q-btn--primary" disabled aria-disabled="true"><span>در انتظار اتصال…</span></button>`
    : failed ? PRIMARY('دوباره امتحان کن', ' data-act="reveal" data-tour="reveal"', I.refresh)
    : `<button class="q-btn q-btn--primary q-btn--lead${state === 'count' ? ' is-counting' : ''}" data-act="reveal" data-tour="reveal" aria-label="نشان بده؛ کالای بعدی خودکار نشون داده می‌شه"${fill}>` +
      `<i class="q-btn__fill" aria-hidden="true"></i><i class="q-btn__i q-btn__i--play">${I.play}</i><span>نشان بده</span></button>`;
  return `<section class="q-invite${failed ? ' is-failed' : ''}"${mk('slot', 'fade')} aria-labelledby="inv-t"><span class="q-invite__tag" aria-hidden="true">${TAG}</span><h2 id="inv-t">${t}</h2>${p ? `<p>${p}</p>` : ''}${b}</section>`;
}
/** Comparison product. Its price is never in the page before the answer; afterwards the server's revealed price fills the same row. */
export function cmpCard(card, st, revealedPrice, slow) {
  const k = keyOf(card);
  const cls = { hidden: '', ok: ' is-ok', no: ' is-no', time: ' is-time' }[st];
  const row = st === 'hidden'
    ? `<p class="q-price q-price--hidden"${mk('prc:' + k, 'text')}><b>؟</b><small>تومان</small><span class="pe-sr">قیمت مخفی</span></p>`
    : price(revealedPrice, ' q-price--reveal', mk('prc:' + k, 'text'));
  const hint = slow ? '<p class="q-cmp__hint">عکس در راهه؛ از روی اسم هم می‌تونی جواب بدی.</p>' : '';
  return `<article class="q-cmp${cls}" aria-label="کالای دوم${st === 'hidden' ? '، قیمت مخفی' : `، ${money(revealedPrice)} تومان`}"${mk('card:' + k, 'frame')} data-tour="second">` +
    `${img(card, true, st === 'hidden' ? 'q' : '')}<h2 class="q-cmp__t"${mk('ttl:' + k, 'text')}>${title(card.displayTitle)}</h2>${hint}${row}</article>`;
}
/**
 * Decision area: the prompt (or, after the server's verdict, the verdict in the same place) and the two answers at a
 * fixed size and position. st: on · off · pending · ok · no · truth. Text marks («انتخاب تو», «درست») never rely on colour.
 */
export function decide(st, side, line, refPrice) {
  const A = { cls: '', a: ' data-act="ans-higher"', i: I.up, m: '' }, B = { cls: '', a: ' data-act="ans-lower"', i: I.down, m: '' };
  const me = side === 'higher' ? A : B, ot = side === 'higher' ? B : A;
  const ok = `<span class="q-ab__m">${ICO('check', 18)}</span>`, no = `<span class="q-ab__m">${ICO('x', 18)}</span>`;
  if (st === 'off') A.a = B.a = L;
  else if (st === 'pending') { me.cls = ' is-picked'; me.a = ' aria-pressed="true" aria-busy="true"' + L; me.i = SPIN; ot.cls = ' is-dim'; ot.a = L; }
  else if (st === 'ok') { me.cls = ' is-ok'; me.a = ' aria-pressed="true"' + L; me.i = ok; me.m = 'انتخاب تو، درست'; ot.cls = ' is-dim'; ot.a = L; }
  else if (st === 'no') { me.cls = ' is-no'; me.a = ' aria-pressed="true"' + L; me.i = no; me.m = 'انتخاب تو، غلط'; ot.cls = ' is-truth'; ot.a = L; ot.i = ok; ot.m = 'جواب درست'; }
  else if (st === 'truth') { me.cls = ' is-truth'; me.a = L; me.i = ok; me.m = 'جواب درست'; ot.cls = ' is-dim'; ot.a = L; }
  const rp = st === 'on' && refPrice ? money(refPrice) : '';
  const btn = (o, w) => `<button class="q-ab${o.cls}"${o.a}${rp ? ` aria-label="${w} از ${rp} تومان"` : ''}><i class="q-ab__i">${o.i}</i><span>${w}${o.m ? `<small class="pe-sr">، ${o.m}</small>` : ''}</span></button>`;
  return `<div class="q-decide"${mk('decide', 'fade')}><div class="q-ans" role="group" aria-label="پاسخ" data-tour="answers">${btn(A, 'گرون‌تره')}${btn(B, 'ارزون‌تره')}</div></div>`;
}
export const prompt = (text, muted) => `<p class="q-prompt${muted ? ' is-muted' : ''}">${text}</p>`;
export function verdict(k, t, sub, pop) {
  const ic = { ok: 'check', no: 'x', time: 'clock' }[k];
  return `<p class="q-verdict q-verdict--${k}" role="status"><span class="q-verdict__i${pop ? ' q-pop-once' : ''}" aria-hidden="true">${ICO(ic, 18)}</span><b>${t}</b>${sub ? `<span>${sub}</span>` : ''}</p>`;
}
export const pill = (t, ic, btn) => `<p class="q-pill" role="status">${ICO(ic, 16)}<span>${t}</span>${btn || ''}</p>`;
export const game = (top, trk, tmr, main, dec, extra, toast) => page('q-game', top + trk + tmr + `<main class="q-game__main">${main}</main>` + (dec || ''), (extra || '') + toastHTML(toast));

export function leaveSheet(m) {
  if (!m.leave) return '';
  const txt = `دست با ${fa(m.score)} جواب درست تموم می‌شه و دیگه نمی‌تونی ادامه بدی.${m.checkpoint ? ' جایزه‌ی چک‌پوینت‌هایی که گرفتی سر جاشه.' : ''}`;
  return sheet('از این دست خارج می‌شی؟', txt, m.questionOpen ? status('warn', 'زمان سؤال متوقف نمی‌شه.', 'clock') : '',
    PRIMARY('ادامه بازی', ' data-act="leave-no"', I.fwd) + BTN('q-btn--danger', 'خروج و پایان دست', ' data-act="leave-yes"'), ['warn', 'alert']);
}

// ---------------------------------------------------------------- G04 checkpoint celebration (§10)
/**
 * Mounted once per (run, checkpoint) outside the re-rendered screen. Badge, «{title} رو گرفتی!»,
 * «{n} جواب درست دادی», the reward line only for a paying checkpoint, and one «ادامه بده». No countdown, no automatic
 * continue, no second «دریافت» step: the reward was registered by the server with the answer that crossed the line.
 */
export function cpOverlay(c, index, reward, next) {
  const head = `${esc(c.title)} رو گرفتی!`;   // factual: no population percentile is measured, so none is claimed
  const amount = c.rewardAmount > 0 ? c.rewardAmount : 0;
  const late = reward && reward.status === 'delayed' ? '<small>واریزش کمی طول می‌کشه</small>' : '';
  return `<div class="q-cp tier-${index}" role="dialog" aria-modal="true" aria-labelledby="cp-t" aria-describedby="cp-d"><div class="q-cp__in">` +
    `${badge(c,index,'q-cp__badge')}` +
    `<h2 class="q-cp__h" id="cp-t">${head}</h2><p class="q-cp__n" id="cp-d">${fa(c.requiredCorrect)} جواب درست دادی</p>` +
    (amount ? `<p class="q-cp__rw">${COIN}<span>${fa(amount)} دیجی‌کوین جایزه</span>${late}</p>` : '') +
    `<p class="q-cp__next">${next ? `${fa(next.requiredCorrect - c.requiredCorrect)} جواب درست دیگه تا «${esc(next.title)}»` : 'همه‌ی چک‌پوینت‌ها رو گرفتی؛ دست ادامه داره.'}</p>` +
    `</div><div class="q-foot">${PRIMARY('ادامه بده', ' data-act="cp-go"', I.fwd)}</div></div>`;
}

// ---------------------------------------------------------------- G05/G06 end of a run (owner 2026-10-25)
/**
 * End screen 1 — the continue offer as a modal over the game screen (the revealed price and verdict stay visible behind a
 * blur). m: { cost, balance, state: offer|loading|ending|pending|unknown|failed, left (offer seconds or null) }.
 */
export function offerModal(m) {
  const busy = { loading: 'در حال آماده‌سازی ادامه…', ending: 'در حال ثبت پایان دست…', pending: 'در حال بررسی پرداخت…' }[m.state];
  const locked = !!busy || m.state === 'unknown';
  let note = '', main;
  if (m.state === 'pending') note = status('', 'پرداخت فقط یک بار انجام می‌شه؛ چند لحظه صبر کن.', 'info');
  if (m.state === 'unknown') note = status('warn', 'نتیجه پرداخت هنوز مشخص نیست. هیچ مبلغی دوباره کسر نمی‌شه؛ اگه ادامه ممکن نشه، هزینه برمی‌گرده.', null, true);
  if (m.state === 'failed') note = status('no', 'پرداخت انجام نشد و کوینی کسر نشد. هنوز می‌تونی دوباره امتحان کنی.', 'alert', false, true);
  if (busy) main = BUSY(busy, 'q-btn--primary q-offer__go');
  else if (m.state === 'unknown') main = BTN('q-btn--secondary q-offer__go', 'بررسی دوباره', ' data-act="recheck"', I.refresh);
  else main = BTN('q-btn--primary q-offer__go', 'ادامه‌ی بازی', ' data-act="continue"', COIN);
  const skip = BTN('q-btn--secondary q-offer__skip', 'رد کردن', ' data-act="offer-skip"' + (locked ? L : ''));
  const left = m.left != null ? `<p class="q-offer__left" aria-live="off">${ICO('clock', 16)}<b data-offer-left>${m.left}</b> ثانیه</p>` : '';
  return `<div class="q-scrim q-modal q-offerlayer"><div class="q-offer__bal">${balance(m.balance)}</div>` +
    `<section class="q-offer${m.state === 'offer' ? ' is-new' : ''}" role="dialog" aria-modal="true" aria-labelledby="offer-t" aria-describedby="offer-d">` +
    `<span class="q-offer__burst" aria-hidden="true">${'<i></i>'.repeat(10)}</span><span class="q-offer__icon" aria-hidden="true">${COIN}</span>` +
    `<button class="q-iconbtn q-offer__x" data-act="offer-skip" aria-label="رد کردن ادامه"${locked ? L : ''}>${ICO('x', 20)}</button>` +
    `<h2 id="offer-t">رکوردت رو بهتر کن!</h2><p id="offer-d">${fa(m.cost)} دیجی‌کوین بده و به بازی ادامه بده</p>${left}${note}` +
    `<div class="q-offer__btns">${main}${skip}</div></section></div>`;
}
/** A seen product with its (simulated) deal: tile for the result screen and the deals page. */
function dealTile(p, big) {
  const d = p.deal || {};
  const tag = d.discountPercent ? `<span class="q-deal__off">${fa(d.discountPercent)}٪</span>` : '';
  const coin = d.coinBack ? `<span class="q-deal__coin">${COIN}${fa(d.coinBack)}</span>` : '';
  const open = p.link ? ` data-act="open-product" data-link="${esc(p.link)}"` : ' disabled';
  return `<li><button class="q-deal${big ? ' q-deal--row' : ''}"${open} aria-label="${esc(p.displayTitle)}${d.discountPercent ? `، ${fa(d.discountPercent)} درصد تخفیف` : ''}، مشاهده کالا">` +
    `<span class="q-deal__img">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="" decoding="async">` : ''}${tag}</span>` +
    `${big ? `<span class="q-deal__b"><span class="q-deal__t">${title(p.displayTitle)}</span>${coin}<span class="q-deal__go">مشاهده کالا ${ICO('fwd', 16)}</span></span>` : coin}</button></li>`;
}
export const dealsOf = list => (list?.items || []).filter(p => p.deal && (p.deal.discountPercent || p.deal.coinBack));
/**
 * End screen 2 — the result. m: { title, score, best, newRecord, cp, cpIndex, better (percent or null), deals, dealsState,
 * note (payment message html), code, shareable, balance, toast }.
 */
export function vEnd(m) {
  const rows = [`<div class="q-end__row"><span>امتیاز</span><b>${fa(m.score)}</b></div>`];
  if (!m.newRecord) rows.push(`<div class="q-end__row"><span>رکورد</span><b>${fa(m.best)}</b></div>`);
  if (m.cp) rows.push(`<div class="q-end__row q-end__row--badge"><span>نشان</span><span class="q-end__badge"><img src="${BADGE_SRC(badgeId(m.cp, m.cpIndex))}" alt="" width="40" height="40"><b>${esc(m.cp.title)}</b></span></div>`);
  const better = m.better != null ? `<p class="q-end__better">از ${fa(m.better)} درصد دیجی‌کالایی‌ها بهتری!</p>` : '';
  const deals = m.deals.slice(0, 4);
  const dealsSec = m.dealsState === 'ready' && !deals.length ? '' :
    `<section class="q-end__deals" aria-labelledby="end-deals"><div class="q-end__dh"><h2 id="end-deals">کالاهای این دست تخفیف خوردن</h2>` +
    `<button class="q-linkbtn" data-act="deals-end">بیشتر ${ICO('fwd', 16)}</button></div>` +
    (m.dealsState === 'ready' ? `<ul class="q-end__dl">${deals.map(p => dealTile(p)).join('')}</ul>` : `<div class="q-end__dl is-loading" aria-busy="true"><i></i><i></i><i></i></div>`) + '</section>';
  return page('q-end', `<header class="q-hdr q-hdr--bare q-end__hd"><button class="q-iconbtn" data-act="end-close" aria-label="بستن و رفتن به صفحه اصلی">${ICO('x', 22)}</button><span class="q-flex"></span>${balance(m.balance)}</header>` +
    `<main class="q-end__main"><h1 class="q-end__h">${m.title}</h1>${m.note || ''}<section class="q-end__card" aria-label="نتیجهٔ این دست">${rows.join('')}${better}</section>${dealsSec}${m.code || ''}</main>` +
    `<footer class="q-end__foot">${BTN('q-btn--primary', 'صفحه اصلی', ' data-act="end-home"', I.home)}${m.shareable ? BTN('q-btn--secondary', 'اشتراک‌گذاری', ' data-act="share-result"', I.share) : ''}</footer>`, toastHTML(m.toast));
}
/** G12.DEALS — the products the player has seen that are discounted now or pay DigiCoin back (data simulated in Play). */
export function vDeals(m) {
  const items = m.deals;
  const body = m.state === 'loading' ? `<div class="q-state" role="status">${SPIN}<p>در حال آوردن کالاها…</p></div>`
    : m.state === 'error' ? statecard('alert', 'no', 'کالاها نیومد', 'اتصال رو بررسی کن و دوباره امتحان کن.', PRIMARY('دوباره امتحان کن', ' data-act="deals-retry"', I.refresh))
    : !items.length ? statecard('gift', '', m.played ? 'فعلاً تخفیفی نیست' : 'هنوز کالایی ندیدی', m.played ? 'کالاهایی که توی بازی دیدی الان تخفیف ندارن؛ بعداً سر بزن.' : 'یه دست بازی کن؛ کالاهایی که می‌بینی و تخفیف می‌خورن اینجا جمع می‌شن.', '')
    : `<p class="q-deals__lead">تا ۹۰ درصد تخفیف روی کالاهایی که توی بازی دیدی</p><ul class="q-deals__list">${items.map(p => dealTile(p, true)).join('')}</ul>`;
  return page('q-deals', hdr('کالاهایی که دیدی', 'deals-close', 'بازگشت') + `<main class="q-deals__main">${body}</main>`, toastHTML(m.toast));
}
export function codeCard(c, copied) {
  const body = c.status === 'pending' ? `<p class="q-code__val">${SPIN}<span>در حال صدور کد…</span></p>`
    : `<p class="q-code__val"><b dir="ltr">${esc(c.code)}</b>${BTN('q-btn--text', copied ? 'کپی شد' : 'کپی کد', ' data-act="copy"')}</p>`;
  return `<section class="q-code" aria-label="کد تخفیف جایزه"><b>کد تخفیف ${money(c.amountToman)} تومانی</b>${body}<small>${esc(c.terms || '')}</small></section>`;
}

// ---------------------------------------------------------------- G10 connection, G11 unavailable
export function vSystem(v, m) {
  const pg = (ic, k, t, p, a) => page('q-sys', hdr('', 'exit-app', 'بازگشت به اپ') + statecard(ic, k, t, p, a), toastHTML(m.toast));
  const R = m.ended || {};
  const HOME = SECONDARY('صفحه اصلی', ' data-act="home"', I.home);
  if (v === 'G10.RESUMING') return page('q-sys', hdr('', 'exit-app', 'بازگشت به اپ') + `<div class="q-state" role="status">${SPIN}<h2>برگشتی!</h2><p>داریم آخرین وضعیت دستت رو از سرور می‌گیریم…</p></div>`);
  if (v === 'G10.INACTIVITY_END') return pg('clock', 'warn', 'این دست تموم شد', `بیشتر از ۳ دقیقه بین سؤال‌ها کاری انجام نشد. دستت با ${fa(R.score || 0)} جواب درست ثبت شد.`, PRIMARY('صفحه اصلی', ' data-act="home"', I.home));
  if (v === 'G11.GAME_OFF') return pg('power', '', 'بازی موقتاً در دسترس نیست', m.playerMessage ? esc(m.playerMessage) : 'در حال به‌روزرسانی هستیم. کمی بعد دوباره سر بزن.', SECONDARY('بازگشت به اپ', ' data-act="exit-app"'));
  if (v === 'G11.AUTH_ERROR') return pg('user', 'no', 'ورود انجام نشد', 'برای بازی باید وارد حساب دیجی‌کالا باشی. از داخل اپ دوباره وارد شو.', PRIMARY('بازگشت به اپ', ' data-act="exit-app"'));
  if (v === 'G11.SERVICE_ERROR') return pg('alert', 'no', 'یه مشکلی پیش اومد', 'سرویس بازی الان جواب نمی‌ده. امتیاز و دست‌هات محفوظه؛ چند لحظه دیگه دوباره امتحان کن.', PRIMARY('تلاش دوباره', ' data-act="boot"', I.refresh) + SECONDARY('بازگشت به اپ', ' data-act="exit-app"'));
  if (v === 'G11.OTHER_DEVICE') return pg('devices', '', 'این دست تموم شد', `روی دستگاه دیگه‌ای دست جدید شروع کردی. این دست با ${fa(R.score || 0)} جواب درست ثبت شد.`, HOME);
  if (v === 'G11.BLOCKED') return pg('lock', 'no', 'بازی غیرفعال شده است', '', SECONDARY('بازگشت به اپ', ' data-act="exit-app"'));   // exact copy (R-61)
  if (v === 'G03.NO_PRODUCTS_LEFT') return pg('check', 'ok', 'کالاها تموم شد!', `کالای مناسب دیگه‌ای برای این دست نمونده. دستت با ${fa(R.score || 0)} جواب درست ثبت شد.`, PRIMARY('صفحه اصلی', ' data-act="home"', I.home));
  return '';
}

export { L, ICO, SPIN };

export function shareModal(s) {
  return `<div class="q-scrim q-modal"><section class="q-sheet q-share" role="dialog" aria-modal="true" aria-labelledby="share-title"><button class="q-iconbtn q-sheet__x" data-act="share-close" aria-label="بستن اشتراک‌گذاری">${I.x}</button><h2 id="share-title">نتیجهٔ این دست رو به اشتراک بذار</h2>${s.url ? `<img class="q-share-preview" src="${s.url}" alt="کارت نتیجهٔ این دست در قیمت‌شناس با نام و لینک بازی"><div class="q-share-actions">${PRIMARY('اشتراک‌گذاری',' data-act="share-send"',I.share)}<a class="q-btn q-btn--secondary" href="${s.url}" download="gheimat-shenas-result.png">${ICO('download', 20)}<span>ذخیره تصویر</span></a></div>` : '<p role="status">آماده‌سازی تصویر نتیجه…</p>'}</section></div>`;
}
