// Screen markup of the redesign of 2026-10-21 (white base, Digikala red actions, badge family). Views are pure functions
// of the view model: they never read the network or the clock. All text from data goes through esc()/title().
// Direction rules (§2): back/close sit at the physical right (first in RTL DOM order) and point right; inside continue,
// start, next and play buttons the icon is written after the label, so it sits on the left.
import { I } from './icons.js';
import { fa, money, esc, title } from './fmt.js';
import { DEMO_FIRST, DEMO_SECOND, DEMO_THIRD } from './demo.js';
const DEMO_MUG = DEMO_FIRST.art, DEMO_HEADPHONES = DEMO_SECOND.art, DEMO_KETTLE = DEMO_THIRD.art;

const L = ' disabled aria-disabled="true"';
const ICO = (k, s = 20) => I[k].replace('width="24" height="24"', `width="${s}" height="${s}"`);
const SPIN = '<span class="q-spin" aria-hidden="true"></span>';
/** Official DigiCoin asset downloaded from Digikala's own static asset endpoint. */
export const COIN = '<img class="q-coin" src="assets/digicoin.svg" width="24" height="23" alt="" aria-hidden="true">';
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
export const BTN = (cls, label, a = '', icon = '') => `<button class="q-btn ${cls}"${a}><span>${label}</span>${icon ? `<i class="q-btn__i">${icon}</i>` : ''}</button>`;
export const PRIMARY = (label, a, icon) => BTN('q-btn--primary', label, a, icon);
export const BUSY = (label, cls = 'q-btn--primary') => `<button class="q-btn ${cls}" disabled aria-disabled="true" aria-busy="true"><span>${label}</span><i class="q-btn__i">${SPIN}</i></button>`;
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
const COMPARE_ART = '<img class="q-home-art" src="assets/home-hero.webp" width="1000" height="667" alt="دو برچسب قیمت با فلش‌های رو به بالا و پایین">';
export function balance(b) {
  if (b == null) return '<span class="q-bal is-unknown" aria-label="موجودی دیجی‌کوین نامعلوم">' + COIN + '<b>—</b></span>';
  return `<span class="q-bal" role="img" aria-label="موجودی: ${fa(b)} دیجی‌کوین">${COIN}<b>${fa(b)}</b></span>`;
}
function pcard(p, n) {
  const label = `${n === 0 ? 'کالای شروع' : 'نوبت ' + fa(n)}: ${esc(p.displayTitle)}${p.isLoss ? '، اینجا باختی' : ''}`;
  const open = p.link ? ` data-act="open-product" data-link="${esc(p.link)}"` : ' disabled';
  return `<button class="q-pcard${p.isLoss ? ' is-loss' : ''}" role="listitem"${open}${p.isLoss ? ' data-loss' : ''} aria-label="${label}">` +
    `${img(p)}<span class="q-pcard__t">${title(p.displayTitle)}</span>${p.isLoss ? '<span class="q-pcard__loss">اینجا باختی</span>' : ''}</button>`;
}
function history(m) {
  const hs = m.historyState, items = m.products?.items || [];
  const pages = Math.ceil(items.length / 2), n = Math.min(m.historyPage || 0, Math.max(0, pages - 1));
  let body;
  if (hs === 'error') body = `<div class="q-hist__empty">${BTN('q-btn--text', 'نمایش کالاهای دست قبلی', ' data-act="history-retry"')}</div>`;
  else if (!items.length) body = '<p class="q-hist__empty">بعد از اولین دست، کالاهایی که دیدی اینجا می‌مونن.</p>';
  else body = `<div class="q-hist__row" role="list" aria-label="کالاهای دست قبلی">${items.slice(n * 2, n * 2 + 2).map((p,i)=>pcard(p,n*2+i)).join('')}</div>`;
  const nav = pages > 1 ? `<div class="q-history-nav"><button aria-label="کالاهای قبلی" data-act="history-prev"${n===0?L:''}>${I.back}</button><span>${fa(n+1)} از ${fa(pages)}</span><button aria-label="کالاهای بعدی" data-act="history-next"${n===pages-1?L:''}>${I.fwd}</button></div>` : '';
  return `<section class="q-hist" aria-labelledby="hist-t"><div class="q-hist__hd"><h2 id="hist-t">کالاهای دست قبلی</h2>${nav}</div>${body}</section>`;
}
/** The home's bottom area: part of the page (no scrim, no drag, no extra modal). v: the G01 state. */
function homeSheet(v, m) {
  const b = m.boot, q = b.quota;
  const chances = `<p class="q-chances">شانس بازی: <b>${fa(q.playsLeft)}</b></p>`;
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
  else if (v === 'G01.QUOTA_EXHAUSTED') cta = `<button class="q-btn q-btn--primary" disabled aria-disabled="true"><span>تا شانس بعدی <b dir="ltr" data-countdown>${m.untilReset}</b></span><i class="q-btn__i">${ICO('clock')}</i></button>`;
  else if (m.offline) { pre = status('warn', 'اتصال برقرار نیست؛ برای شروع بازی به اینترنت وصل شو.', 'wifi'); cta = `<button class="q-btn q-btn--primary" disabled aria-disabled="true"><span>شروع بازی</span><i class="q-btn__i">${I.play}</i></button>`; }
  else cta = PRIMARY('شروع بازی', ' data-act="start"', I.play);
  return `<section class="q-homesheet" aria-label="شروع بازی">${COMPARE_ART}<h2>گرون‌تره <em>یا ارزون‌تر؟</em></h2><p class="q-eyebrow">قیمت دو کالا رو مقایسه کن و درست حدس بزن.</p>${pre}${cta}${chances}</section>`;
}
export function vHome(v, m) {
  const b = m.boot;
  const top = `<header class="q-hdr q-hdr--home"><button class="q-iconbtn" data-act="exit-app" aria-label="بازگشت به اپ">${I.back}</button>` +
    `<div class="q-brand"><span class="q-logo q-logo--s" aria-hidden="true">${TAG}</span><b>قیمت‌شناس</b></div><span class="q-flex"></span>${balance(m.balance)}` +
    `<button class="q-guidebtn" data-act="guide">${ICO('help', 20)}<span>راهنمای بازی</span></button></header>`;
  const earnedIndex = b.config.checkpoints.reduce((last,c,i)=>b.record >= c.requiredCorrect ? i : last,-1);
  const earned = earnedIndex >= 0 ? badge(b.config.checkpoints[earnedIndex], earnedIndex, 'q-record__badge') : '';
  const first = b.config.checkpoints[0];
  const sub = earned ? `عنوان: ${esc(b.config.checkpoints[earnedIndex].title)}` : first ? `با ${fa(first.requiredCorrect)} جواب درست، اولین نشانت رو بگیر.` : '';
  const record = `<section class="q-record${earned ? '' : ' q-record--empty'}" aria-label="بهترین رکورد: ${fa(b.record)} جواب درست در یک دست"><div><span>بهترین رکوردت</span><b>${fa(b.record)}</b><small>${b.record ? 'جواب درست در یک دست' : 'هنوز رکوردی نداری'}</small>${sub ? `<em class="q-record__sub">${sub}</em>` : ''}</div>${earned}</section>`;
  const o = b.activeRun && !b.activeRun.onThisDevice ? b.activeRun : null;
  const note = o ? status('warn', `یه دست روی دستگاه دیگه‌ات بازه. با شروع دست جدید، اون دست با ${fa(o.score)} جواب درست تموم می‌شه.`, 'devices') : '';
  const camp = b.campaign ? status('', `کمپین ویژه: با رسیدن به ${fa(b.campaign.checkpointRequiredCorrect)} جواب درست، کد تخفیف ${money(b.campaign.codeAmountToman)} تومانی هم می‌گیری.`, 'info') : '';
  return page('q-home', top + `<main class="q-home__scroll">${record}${m.productsOn ? history(m) : ''}${camp}${note}</main>` + homeSheet(v, m), (m.modal || '') + toastHTML(m.toast));
}

// ---------------------------------------------------------------- G01 daily reward modal
const WD = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'], WDF = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];   // getUTCDay()
/**
 * «جایزه‌ی روزانه». The 7 days keep the server's floating window and its dates; the first day of the window sits at the
 * physical right (RTL order, §15). The only claim button sends one claim; on success the modal closes and the home shows
 * (no second «دریافت شد» surface). ui.phase: claimable | claiming | processing | slow | error.
 */
export function dailyModal(d, ui) {
  const days = [...d.days].sort((a,b)=>b.date.localeCompare(a.date)).map(x => {
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
  if (m.demo) return page('q-guide q-guide--demo', hdr('آموزش بازی','guide-close','بستن راهنما') + tutorial(m.step,m.paused,m.still) + `<footer class="q-foot">${SECONDARY('نشان‌ها و قوانین',' data-act="guide-rules"')}${PRIMARY('فهمیدم',' data-act="guide-close"',I.fwd)}</footer>`);
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
    `<footer class="q-foot">${SECONDARY('نمایش آموزش متحرک',' data-act="guide-demo"')}${PRIMARY('فهمیدم', ' data-act="guide-close"', I.fwd)}</footer>`);
}
/** Onboarding page 1: a fixed sandbox of the game screen under a dimmed layer; the spotlight hole is placed by the controller. */
export function tutorial(step = 0, paused = true, still = false) {
  const captions = [
    ['کالای اول: قیمتش معلومه', 'ماگ سرامیکی ۲۴۵٬۰۰۰ تومنه. این قیمت مرجع توئه.'],
    ['کالای دوم: قیمتش مخفیه', 'با زدن «نشان بده» کالای دوم میاد و ۱۰ ثانیه وقت داری.'],
    ['گرون‌تره یا ارزون‌تر؟', 'هدفون از ۲۴۵٬۰۰۰ تومن گرون‌تره؟ اینجا «گرون‌تره» رو می‌زنیم.'],
    ['درست بود؛ یک امتیاز!', 'هدفون ۸۹۰٬۰۰۰ تومنه، پس «گرون‌تره» درست بود.'],
    ['هدفون، کالای اول بعدی می‌شه', 'حالا کتری رو با قیمت هدفون مقایسه می‌کنی.'],
  ];
  const [h, p] = captions[step], last = captions.length - 1;
  const dots = captions.map((c, i) => `<button class="q-demo-dot${step === i ? ' is-on' : ''}" data-act="demo-step" data-step="${i}" aria-label="مرحله ${fa(i + 1)}: ${c[0]}" aria-current="${i === step ? 'step' : 'false'}">${fa(i + 1)}</button>`).join('');
  const first = step === 4 ? { t: 'هدفون بی‌سیم', a: DEMO_HEADPHONES, p: '۸۹۰٬۰۰۰' } : { t: 'ماگ سرامیکی', a: DEMO_MUG, p: '۲۴۵٬۰۰۰' };
  const second = step === 4 ? { t: 'کتری برقی', a: DEMO_KETTLE, p: '؟' } : { t: 'هدفون بی‌سیم', a: DEMO_HEADPHONES, p: step === 3 ? '۸۹۰٬۰۰۰' : '؟' };
  const top = step >= 3 ? '۱ جواب درست' : step >= 1 ? '۱۰ ثانیه' : 'تمرین؛ شانسی مصرف نمی‌شه';
  const nav = `<button class="q-demo-nav" data-act="demo-prev" aria-label="مرحله قبل"${step === 0 ? L : ''}>${I.back}</button>` +
    `<span class="q-demo-pos" aria-live="polite">مرحله ${fa(step + 1)} از ${fa(captions.length)}</span>` +
    `<button class="q-demo-nav" data-act="demo-next" aria-label="مرحله بعد"${step === last ? L : ''}>${I.fwd}</button>`;
  const play = still ? '' : `<button class="q-demo-pause" data-act="demo-toggle" aria-pressed="${!paused}">${ICO(paused ? 'play' : 'pause', 18)}<span>${paused ? 'پخش خودکار' : 'توقف'}</span></button>`;
  return `<section class="q-tutorial" aria-label="نمایش آموزشی بازی"><div class="q-demo${paused ? ' is-paused' : ''}" data-step="${step}" aria-hidden="true">` +
    `<div class="q-demo-top"><b>یک مقایسهٔ تمرینی</b><span>${top}</span></div><div class="q-demo-cards">` +
    `<article class="q-demo-card q-demo-first"><span>کالای اول</span><div class="q-demo-art">${first.a}</div><h3>${first.t}</h3><b>${first.p} <small>تومان</small></b></article>` +
    `<i class="q-demo-versus">${I.fwd}</i><article class="q-demo-card q-demo-second${step === 0 ? ' is-hidden' : ''}"><span>کالای دوم</span><div class="q-demo-art">${second.a}</div><h3>${second.t}</h3><b>${second.p} <small>تومان</small></b></article></div>` +
    `<div class="q-demo-answers"><span class="${step === 2 || step === 3 ? 'is-chosen' : ''}">${step === 3 ? '✓ درست گفتی' : '↑ گرون‌تره'}</span><span>↓ ارزون‌تره</span></div></div>` +
    `<div class="q-demo-caption"><h2>${h}</h2><p>${p}</p></div>` +
    `<div class="q-demo-controls"><div class="q-demo-step">${nav}${play}</div><div class="q-demo-dots" role="group" aria-label="رفتن به مرحله">${dots}<button class="q-demo-pause" data-act="demo-replay" aria-label="از اول">${ICO('replay', 20)}</button></div></div></section>`;
}
export function vOnboard1(m, scene, step, steps, still) {
  return page('q-onb q-onb--lesson', hdr('چطور بازی کنم؟', 'onb-skip', 'رد کردن آموزش') + tutorial(step, m.paused || still, still) + `<footer class="q-foot">${m.error ? status('no',m.error,'alert',false,true):''}${PRIMARY('بعدی؛ نشان‌ها و جایزه‌ها', ' data-act="onb-next"', I.fwd)}${BTN('q-btn--text','رد کردن آموزش',' data-act="onb-skip"')}</footer>`);
}
export function vOnboard2(m) {
  const cps = m.config.checkpoints;
  const grid = cps.map((c, i) => `<li>${badge(c, i, '', true)}</li>`).join('');
  const paid = cps.findIndex(x => x.rewardAmount > 0), ord = ['اول', 'دوم', 'سوم', 'چهارم'][paid] || fa(paid + 1) + 'م';
  const rule = cps.length ? `با ${fa(cps[0].requiredCorrect)} جواب درست، اولین نشانت رو می‌گیری؛` + (paid > 0 ? `<br>از چک‌پوینت ${ord}، یعنی ${fa(cps[paid].requiredCorrect)} جواب درست، دیجی‌کوین هم می‌گیری.` : '') : '';
  return page('q-onb q-onb--2', hdr('راهنمای بازی', 'onb-prev', 'قبلی') +
    `<main class="q-onb2"><h1>باید رکورد بزنی</h1><p class="q-onb2__sub">${rule}</p><ul class="q-badgegrid" aria-label="چک‌پوینت‌ها">${grid}</ul>` +
    `<p class="q-onb2__note">پاسخ‌های درستت حساب می‌شن</p></main>` +
    `<footer class="q-foot q-foot--row">${m.error ? status('no', m.error, 'alert', false, true) : ''}${m.busy ? BUSY('بزن بریم') : PRIMARY('بزن بریم', ' data-act="onb-done"', I.play)}${BTN('q-btn--text', 'قبلی', ' data-act="onb-prev"' + (m.busy ? L : ''))}</footer>`);
}

// ---------------------------------------------------------------- gameplay (§6, §7, §8, §10)
/** Top bar: back at the right, the game name, the correct-answer count at the left. No balance (§1). */
export function gameTop(score, backLocked) {
  return `<header class="q-hdr q-hdr--game"><button class="q-iconbtn" data-act="back" aria-label="خروج از دست"${backLocked ? L : ''}>${I.back}</button><h1 class="q-hdr__t">قیمت‌شناس</h1>` +
    `<div class="q-hdr__end"><span class="q-score" aria-live="polite"><b>${fa(score)}</b><small>جواب درست</small></span></div></header>`;
}
/** A coin stack for a reward amount: 1 coin, a small cluster, or a simple stack for 5 and more (§10); the number is beside it. */
function coinStack(n) { return `<span class="q-stack">${COIN}<b>${fa(n)}</b></span>`; }
/** Main progress bar (kept, §10): fills with the score; each checkpoint shows its real reward — the badge when it pays no coin. */
export function track(score, cps) {
  const last = cps.length ? cps[cps.length - 1].requiredCorrect : 1;
  const f = Math.min(1, score / last);
  const nodes = cps.map((c, i) => {
    const ic = c.rewardAmount > 0 ? coinStack(c.rewardAmount) : `<img src="${BADGE_SRC(badgeId(c, i))}" alt="" width="34" height="33">`;
    return `<li class="${c.requiredCorrect <= score ? 'is-done' : ''}" style="--x:${(100 * c.requiredCorrect / last).toFixed(2)}%"><span class="q-track__ic">${ic}</span><span class="q-track__n">${fa(c.requiredCorrect)}</span></li>`;
  }).join('');
  const next = cps.find(c => c.requiredCorrect > score);
  const label = next ? `${fa(score)} جواب درست؛ چک‌پوینت بعدی با ${fa(next.requiredCorrect)} جواب درست${next.rewardAmount > 0 ? ` و ${fa(next.rewardAmount)} دیجی‌کوین` : ''}` : `${fa(score)} جواب درست؛ همه‌ی چک‌پوینت‌ها رو گرفتی`;
  return `<div class="q-track" role="progressbar" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${Math.min(score, last)}" aria-label="${label}">` +
    `<div class="q-track__line"><i style="--f:${f.toFixed(4)}"></i></div><ol aria-hidden="true">${nodes}</ol></div>`;
}
/**
 * Timer above the decision area (§7): large fixed-width number on a contrasting plate with a draining line.
 * mode: idle (before «نشان بده») · run · low (last 3 s) · zero (visible window over, server recording it) · busy (answer
 * sent) · done (answered; the verdict lives in the decision area).
 */
export function timer(o) {
  const mode = o.mode, n = mode === 'idle' ? fa(10) : mode === 'zero' ? fa(0) : o.t;
  const lab = { idle: 'ثانیه وقت داری', run: 'ثانیه وقت داری', low: 'وقت داره تموم می‌شه', zero: 'زمان تموم شد', busy: 'در حال بررسی پاسخ...', done: 'جوابت ثبت شد' }[mode];
  const num = mode === 'busy' ? SPIN : mode === 'done' ? `<span class="q-timer__ok">${ICO('check', 26)}</span>` : `<b class="q-timer__n">${n}</b>`;
  const live = mode === 'run' || mode === 'low';
  return `<div class="q-timer is-${mode}" data-tour="timer" ${live ? 'role="timer" data-timer' : 'role="status"'} aria-label="${mode === 'zero' || mode === 'done' ? lab : mode === 'busy' ? 'در حال بررسی پاسخ' : `${n} ${lab}`}" style="--p:${o.p == null ? 1 : o.p}">` +
    `${num}<span class="q-timer__l">${lab}</span><i class="q-timer__bar" aria-hidden="true"></i></div>`;
}
export function refCard(card, strip) {
  const k = keyOf(card);
  return `<article class="q-ref${strip ? ' q-ref--strip' : ''}" aria-label="کالای اول، ${money(card.price)} تومان"${mk('card:' + k, 'frame')} data-tour="first">${img(card, true)}` +
    `<div class="q-ref__b"><span class="q-label">کالای اول</span><h2 class="q-ref__t"${mk('ttl:' + k, 'text')}>${title(card.displayTitle)}</h2>${price(card.price, '', mk('prc:' + k, 'text'))}</div></article>`;
}
/** Before «نشان بده»: the invitation card; the comparison product is chosen by the server only after the tap. */
export function revealCard(state, goal = '') {
  const busy = state === 'busy', failed = state === 'failed', off = state === 'off';
  const t = failed ? 'کالا آماده نشد' : busy ? 'کالای بعدی آماده می‌شه…' : 'آماده‌ای مقایسه کنی؟';
  const p = failed ? 'امتیاز و زمانت سالمه؛ دوباره امتحان کن.' : off ? 'اتصال قطع شد. هنوز سؤالی شروع نشده؛ دستت محفوظه.' : busy ? '' : 'با زدن «نشان بده»، زمان پاسخ شروع می‌شه.';
  const b = busy ? BUSY('نشان بده') : off ? `<button class="q-btn q-btn--primary" disabled aria-disabled="true"><span>در انتظار اتصال…</span></button>`
    : PRIMARY(failed ? 'دوباره امتحان کن' : 'نشان بده', ' data-act="reveal" data-tour="reveal"', failed ? I.refresh : I.play);
  return `<section class="q-invite${failed ? ' is-failed' : ''}"${mk('slot', 'fade')} aria-labelledby="inv-t"><span class="q-invite__tag" aria-hidden="true">${TAG}</span><h2 id="inv-t">${t}</h2>${p ? `<p>${p}</p>` : ''}${b}${goal && !failed ? `<p class="q-invite__goal">${goal}</p>` : ''}</section>`;
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
    `<span class="q-label">کالای دوم</span><h2 class="q-cmp__t"${mk('ttl:' + k, 'text')}>${title(card.displayTitle)}</h2>${img(card, true, st === 'hidden' ? 'q' : '')}${hint}${row}</article>`;
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
  const btn = (o, w) => `<button class="q-ab${o.cls}"${o.a}${rp ? ` aria-label="${w} از ${rp} تومان"` : ''}><span>${w}${o.m ? `<small class="pe-sr">، ${o.m}</small>` : ''}</span><i class="q-ab__i">${o.i}</i></button>`;
  return `<div class="q-decide"${mk('decide', 'fade')}>${line}${rp ? `<p class="q-compare-price">قیمت کالای اول: <b dir="ltr">${rp}</b> تومان</p>` : ''}<div class="q-ans" role="group" aria-label="پاسخ" data-tour="answers">${btn(A, 'گرون‌تره')}${btn(B, 'ارزون‌تره')}</div></div>`;
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

// ---------------------------------------------------------------- G05/G06 loss and continue (§11, §12)
/**
 * One surface for the result of a miss and the continue of the same run (replaces the old offer sheet and End Screen).
 * m: { reason: wrong|timeout, score, best, cp (highest of THIS run) , cpIndex, action: html of the continue area, code }.
 */
export function vLoss(m) {
  const cp = m.cp;
  const head = m.final ? 'نتیجهٔ این دست' : m.reason === 'timeout' ? 'زمان تموم شد' : 'این بار درست حدس نزدی';
  const sub = m.final ? (m.reason === 'timeout' ? 'زمانت روی آخرین کالا تموم شد.' : m.reason === 'wrong' ? 'آخرین حدست درست نبود.' : '') : '';
  const tier = cp ? `<div class="q-loss__tier"><p>عنوان این دست</p>${badge(cp, m.cpIndex, 'q-loss__badge')}</div>`
    : m.next ? `<p class="q-loss__goal">${m.score > 0 ? `${fa(m.next.requiredCorrect - m.score)} جواب درست دیگه تا نشان «${esc(m.next.title)}»!` : `با ${fa(m.next.requiredCorrect)} جواب درست، نشان «${esc(m.next.title)}» رو می‌گیری.`}</p>` : '';
  const best = m.best > m.score ? `<p class="q-loss__best">بهترین رکوردت: ${fa(m.best)}</p>` : m.score > 0 ? '<p class="q-loss__best">این بهترین رکوردته!</p>' : '';
  const home = m.homeLocked ? `<button class="q-btn q-btn--secondary" disabled aria-disabled="true"><span>صفحه اصلی</span><i class="q-btn__i">${I.home}</i></button>`
    : BTN(m.final ? 'q-btn--primary' : 'q-btn--secondary', 'صفحه اصلی', ' data-act="loss-home"', I.home);
  return page('q-loss', `<header class="q-hdr q-hdr--bare"><button class="q-iconbtn" data-act="loss-home" aria-label="صفحه اصلی"${m.homeLocked ? L : ''}>${I.back}</button><span class="q-flex"></span></header>` +
    `<main class="q-loss__main"><h1 class="q-loss__h">${head}</h1>${sub ? `<p class="q-loss__sub">${sub}</p>` : ''}` +
    `<p class="q-loss__score"><b>${fa(m.score)}</b><span>جواب درست در این دست</span></p>${tier}${best}${m.recap || ''}${m.code || ''}</main>` +
    `<footer class="q-foot q-loss__act">${m.action}${home}${!m.homeLocked && m.shareable ? SECONDARY('اشتراک‌گذاری نتیجه', ' data-act="share-result"', I.share) : ''}</footer>`, toastHTML(m.toast));
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
