// Redesign 2026-10-22 (handoff «Gheimat-Shenas-Claude-Handoff», SPEC.fa.md): the post-onboarding screens of the play
// version. Pure markup builders: every number, product, price, deadline and eligibility comes from the server view the
// controller (game.js) passes in. Geometry, icons and badge SVGs are ported from reference-ui/dist (app.js, style.css);
// the reference's demo data, local scoring and fake wallet are NOT ported. Onboarding keeps views.js / game.css.
import { fa, esc, title } from './fmt.js';

// ------------------------------------------------------------------------------------------------ primitives
export const money = n => fa(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
const P = {
  back: '<path d="m9 5 7 7-7 7"/>', left: '<path d="m15 5-7 7 7 7"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  down: '<path d="M12 5v14m-6-6 6 6 6-6"/>', check: '<path d="m5 12 4 4L19 6"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 0 1 4.6 1c0 1.7-2.3 2-2.3 3.5M12 17h.01"/>',
  tag: '<path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="7.5" cy="8" r="1"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gift: '<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-6 0-7-6-3-6 3 0 3 6 3 6s0-6 3-6c4 0 3 6-3 6"/>', play: '<path d="m9 5 11 7-11 7V5Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', heart: '<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 5 2 10 8 15 6-5 12-10 8-15Z"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M18.5 7a8 8 0 0 0-14 3m1 7a8 8 0 0 0 14-3"/>', wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0M12 20h.01"/>',
  alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>', crown: '<path d="m3 6 5 5 4-7 4 7 5-5-2 13H5L3 6Z"/>',
  shop: '<path d="M4 11v10h16V11M2 5h20l-2 6H4L2 5ZM9 21v-7h6v7M7 5l-1 6m6-6v6m5-6 1 6"/>', trophy: '<path d="M7 3h10v8a5 5 0 0 1-10 0V3Zm5 13v5m-5 0h10M7 5H3v3a5 5 0 0 0 4 5M17 5h4v3a5 5 0 0 1-4 5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', power: '<path d="M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0"/>',
  devices: '<rect x="3" y="4" width="13" height="10" rx="1.5"/><rect x="15" y="9" width="6" height="11" rx="1.5"/><path d="M7 18h6"/>',
};
export const icon = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n] || P.tag}</svg>`;

const NAMES = ['بازاری تازه‌کار', 'بازاری قدیمی', 'قیمت‌شناس حرفه‌ای', 'قیمت‌شناس اعظم'];
const COLORS = [['#bfd0ae', '#e5eddc', '#547750', '#c2af78'], ['#afc7d3', '#e2edf1', '#426e86', '#c1b98e'], ['#e2be77', '#fff0bb', '#a7782d', '#b08335'], ['#b6a3ce', '#e9def2', '#75549c', '#ccb16b']];
let uid = 0;
/** Editable SVG shield of tier 1..4 (reference badge()); each instance gets its own gradient id. */
export function badge(level, cls = 'badge', label) {
  const l = Math.max(1, Math.min(4, level)), c = COLORS[l - 1], id = 'rdb' + (++uid), sym = ['tag', 'shop', 'trophy', 'crown'][l - 1];
  const name = label || NAMES[l - 1];
  return `<svg class="${cls}" viewBox="0 0 180 198" role="img" aria-label="نشان ${esc(name)}" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient></defs>` +
    `<path d="m90 8 69 27v69c0 43-38 68-69 84-31-16-69-41-69-84V35Z" fill="url(#${id})" stroke="${c[3]}" stroke-width="3"/><path d="m90 19 58 23v61c0 34-28 57-58 73-30-16-58-39-58-73V42Z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>` +
    `<circle cx="90" cy="91" r="39" fill="${c[2]}" fill-opacity=".09"/><g transform="translate(61 60) scale(2.45)" fill="none" stroke="${c[2]}" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round">${P[sym]}</g>` +
    `<path d="m58 140 32 7 32-7" fill="none" stroke="${c[2]}" stroke-width="2"/><g fill="${c[2]}">${Array.from({ length: l }, (_, i) => `<circle cx="${90 - (l - 1) * 6 + i * 12}" cy="158" r="2.5"/>`).join('')}</g>` +
    '<path d="m45 48 8-3m74 0 8 3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
}

const SPIN = '<span class="spinner inline" aria-hidden="true"></span>';
/** Main button; the icon is drawn after the label (CSS order:2 puts it on the left). */
export const btn = (label, act, kind = '', ic = 'left', o = {}) =>
  `<button class="btn ${kind}"${act ? ` data-act="${act}"` : ''}${o.disabled ? ' disabled aria-disabled="true"' : ''}${o.busy ? ' aria-busy="true"' : ''}>${o.busy ? `<span>${label}</span>${SPIN}` : `<span>${label}</span>${ic ? icon(ic, 21) : ''}`}</button>`;
const backBtn = (act, label) => `<button class="icon-btn flat" data-act="${act}" aria-label="${label}">${icon('back')}</button>`;
const brand = () => `<span class="brand"><span class="brand-mark">${icon('tag', 23)}</span>قیمت‌شناس</span>`;
const pimg = (p, cls = '') => p && p.imageUrl ? `<img class="${cls}" src="${esc(p.imageUrl)}" alt="${esc(p.displayTitle || '')}" draggable="false" decoding="async">` : `<span class="img-missing ${cls}" aria-hidden="true">${icon('image', 34)}</span>`;
export const priceHTML = (n, cls = 'price') => `<div class="${cls}"><bdi>${money(n)}</bdi><small>تومان</small></div>`;
const alertBox = (kind, ic, html, live = true) => `<div class="inline-alert ${kind}"${live ? ` role="${kind === 'error' ? 'alert' : 'status'}"` : ''}>${ic === 'spin' ? SPIN : icon(ic, 18)}<span>${html}</span></div>`;
export const toast = t => t ? `<div class="rd-toast${t.no ? ' is-no' : ''}" role="status">${esc(t.text)}</div>` : '';
const wrap = (inner, extra = '') => `<div class="rd">${inner}${extra}</div>`;

// ------------------------------------------------------------------------------------------------ splash, system
export function splash() {
  return wrap(`<section class="screen splash" aria-busy="true"><div class="splash-circles" aria-hidden="true"></div><div class="splash-main"><div class="splash-mark" aria-hidden="true">${icon('tag', 104)}</div><h1>قیمت‌شناس</h1><p>گرون‌تره یا ارزون‌تر؟</p></div>` +
    `<div class="splash-bottom" role="status">${SPIN}داریم بازی رو آماده می‌کنیم…</div></section>`);
}

/** Full-page system composition: offline, reconnecting, error and the other unavailable/ended states. */
export function system(kind, m = {}) {
  const score = fa(m.score || 0), HOME = btn('صفحه اصلی', 'home', 'ghost', ''), APP = btn('بازگشت به اپ', 'exit-app', 'ghost', '');
  const D = {
    offline: ['wifi', 'ارتباطمون قطع شد.', 'بین سؤال‌ها منتظرت می‌مونیم.<br>اینترنت رو بررسی کن تا همون دست رو ادامه بدیم.', btn('بررسی اتصال', 'reconnect', 'ink', 'refresh') + btn('صفحه اصلی', 'leave-ask', 'ghost', ''), 'exit-ask'],
    reconnecting: ['refresh', 'داریم برمی‌گردیم.', 'امتیاز و وضعیت همین دست رو<br>دوباره از بازی می‌گیریم.', '', null],
    error: ['alert', 'این بار آماده نشد.', 'بارگذاری بازی به مشکل خورد.<br>یک بار دیگه امتحان کن.', btn('تلاش دوباره', 'boot', 'ink', 'refresh') + APP, 'exit-app'],
    service: ['alert', 'یه مشکلی پیش اومد.', 'سرویس بازی الان جواب نمی‌ده. امتیاز و دست‌هات محفوظه؛<br>چند لحظه دیگه دوباره امتحان کن.', btn('تلاش دوباره', 'boot', 'ink', 'refresh') + APP, 'exit-app'],
    auth: ['user', 'ورود انجام نشد.', 'برای بازی باید وارد حساب دیجی‌کالا باشی.<br>از داخل اپ دوباره وارد شو.', btn('بازگشت به اپ', 'exit-app', 'ink', ''), 'exit-app'],
    blocked: ['lock', 'بازی غیرفعال شده است', '', APP, 'exit-app'],
    off: ['power', 'بازی موقتاً در دسترس نیست.', m.message ? esc(m.message) : 'در حال به‌روزرسانی هستیم.<br>کمی بعد دوباره سر بزن.', APP, 'exit-app'],
    'other-device': ['devices', 'این دست تموم شد.', `روی دستگاه دیگه‌ای دست جدید شروع کردی.<br>این دست با ${score} جواب درست ثبت شد.`, btn('صفحه اصلی', 'home', 'ink', ''), 'home'],
    inactive: ['clock', 'این دست تموم شد.', `مدتی بین سؤال‌ها کاری انجام نشد.<br>دستت با ${score} جواب درست ثبت شد.`, btn('صفحه اصلی', 'home', 'ink', ''), 'home'],
    'no-products': ['check', 'کالاها تموم شد!', `کالای مناسب دیگه‌ای برای این دست نمونده.<br>دستت با ${score} جواب درست ثبت شد.`, btn('صفحه اصلی', 'home', 'ink', ''), 'home'],
  }[kind];
  const [ic, h, p, actions, backAct] = D;
  const top = `<div class="topbar">${backAct === 'home' ? backBtn('home', 'بازگشت به صفحه اصلی') : backAct === 'exit-ask' ? backBtn('leave-ask', 'خروج از دست') : backAct ? backBtn('exit-app', 'بازگشت به اپ') : '<span class="icon-sp"></span>'}${brand()}</div>`;
  return wrap(`<section class="screen system-screen" data-kind="${kind}"${kind === 'reconnecting' ? ' aria-busy="true"' : ''}>${top}<div class="system-icon" aria-hidden="true">${icon(ic, 52)}</div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}` +
    `${kind === 'reconnecting' ? `<div class="system-caption" role="status">${SPIN}در حال بازیابی همین دست</div>` : ''}${actions ? `<div class="bottom-actions">${actions}</div>` : ''}</section>`, (m.sheet || '') + toast(m.toast));
}

// ------------------------------------------------------------------------------------------------ home (home, home-new, home-zero)
function historyRow(m) {
  if (m.historyState === 'none' || !m.productsOn) return '<div class="empty-history">کالاهای اولین دستت اینجا می‌مونن.</div>';
  if (m.historyState === 'error') return `<div class="empty-history">کالاهای دست قبلی بارگذاری نشد. <button class="link-btn" data-act="history-retry">دوباره امتحان کن</button></div>`;
  if (!m.products) return `<div class="history" aria-busy="true">${'<div class="history-item"><div class="history-img skel"></div></div>'.repeat(4)}</div>`;
  return `<div class="history" role="list" aria-label="کالاهای آخرین دست به ترتیب نوبت" data-hscroll="history">${m.products.items.map(p =>
    `<button class="history-item${p.isLoss ? ' lost' : ''}" role="listitem"${p.link ? ` data-act="open-product" data-link="${esc(p.link)}"` : ' disabled'}${p.isLoss ? ' data-loss' : ''} aria-label="${esc(p.displayTitle)}${p.isLoss ? '، اینجا باختی' : ''}">` +
    `<span class="history-img">${pimg(p)}${p.isLoss ? `<span class="lost-dot" aria-hidden="true">${icon('close', 10)}</span>` : ''}</span><span class="history-t">${title(p.displayTitle)}</span></button>`).join('')}</div>`;
}
/**
 * m: { mode: 'home'|'new'|'zero', cta: 'start'|'busy'|'checking'|'resume'|'pending'|'offline', boot, balance, untilReset, tomorrow,
 *      bestLevel, products, historyState, productsOn, daily: 'ready'|'done'|null, notes[], toast }
 */
export function home(m) {
  const b = m.boot, q = b.quota, fresh = m.mode === 'new', zero = m.mode === 'zero';
  const bal = m.balance == null ? '<span class="coin-pill" aria-label="موجودی دیجی‌کوین نامعلوم">—<small>دیجی‌کوین</small></span>'
    : `<span class="coin-pill" aria-label="موجودی: ${fa(m.balance)} دیجی‌کوین">${fa(m.balance)}<small>دیجی‌کوین</small></span>`;
  const top = `<div class="topbar">${backBtn('exit-app', 'بازگشت به اپ')}${brand()}<span class="flex"></span>${bal}<button class="icon-btn flat" data-act="guide" aria-label="راهنمای بازی">${icon('help', 21)}</button></div>`;
  const rec = `<div class="record-card" aria-label="بهترین رکوردت: ${fa(b.record || 0)} جواب درست پشت‌سرهم"><div><div class="eyebrow">بهترین رکوردت</div><div class="number">${fa(b.record || 0)}</div><div class="tiny">جواب درست پشت‌سرهم</div></div>` +
    (m.bestLevel ? badge(m.bestLevel) : `<span class="record-empty" aria-hidden="true">${icon('tag', 50)}</span>`) + '</div>';
  const left = Math.max(0, q.playsLeft), per = Math.max(left, q.playsPerDay || left);
  const dots = `<span class="chance-dots" aria-hidden="true">${Array.from({ length: per }, (_, i) => `<i class="${i < left ? '' : 'empty'}"></i>`).join('')}</span>`;
  let cta;
  if (m.cta === 'resume') cta = btn('ادامه دست', 'resume', '', 'play');
  else if (m.cta === 'busy') cta = btn('شروع بازی', null, '', '', { disabled: true, busy: true });
  else if (m.cta === 'pending') cta = btn('در حال بررسی…', null, '', '', { disabled: true, busy: true });
  else if (m.cta === 'checking') cta = btn('در حال بررسی شانس بعدی…', null, 'secondary', '', { disabled: true, busy: true });
  else if (zero) cta = `<button class="btn secondary countdown-btn" disabled aria-disabled="true"><span>تا شانس بعدی <bdi class="countdown" dir="ltr" data-countdown>${m.untilReset}</bdi></span></button>`;
  else if (m.cta === 'offline') cta = btn('شروع بازی', null, '', 'play', { disabled: true });
  else cta = btn('شروع بازی', 'start', '', 'play');
  const dl = m.daily === 'ready' ? `<button class="daily-link" data-act="daily-open">${icon('gift', 16)}جایزه امروزت آماده‌ست</button>`
    : m.daily === 'done' ? `<button class="daily-link" data-act="daily-done">${icon('check', 16)}جایزه امروزت رو گرفتی</button>` : '';
  const notes = (m.notes || []).map(n => alertBox(n.kind || '', n.icon || 'alert', n.text)).join('');
  return wrap(`<section class="screen home${zero ? ' home-zero' : ''}${fresh ? ' home-new' : ''}">${top}` +
    `<p class="greeting">${fresh ? 'اولین دستت رو امتحان کن.' : 'برای یک چالش تازه <strong>آماده‌ای؟</strong>'}</p>${rec}` +
    `<div class="section-label"><span>کالاهای دست قبلی</span><small>${fresh ? '' : 'آخرین بازی'}</small></div>${historyRow(m)}` +
    `<div class="home-hero"><div class="hero-backdrop" aria-hidden="true"></div><img src="assets/price-tags.webp" class="tag-hero" alt="" width="200" height="142" decoding="async">` +
    `<h1>${zero ? 'دست‌های امروزت<br>تموم شد.' : 'گرون‌تره<br>یا ارزون‌تر؟'}</h1><p>${zero ? (m.tomorrow ? 'فردا با چشم‌های تیزبینت برگرد.' : 'با برگشتن شانس، دوباره بیا.') : 'قیمت‌ها رو مقایسه کن؛<br>ببین چقدر بازار دستته.'}</p></div>` +
    `<div class="chance-row">${dots}${zero ? 'شانس امروزت تموم شده' : `${fa(left)} دست از ${fa(per)} دست امروز باقی مونده`}</div>` +
    `<div class="bottom-actions">${notes}${cta}${dl}</div></section>`, (m.sheet || '') + toast(m.toast));
}

// ------------------------------------------------------------------------------------------------ daily (full page)
const WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'], WEEKF = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
/** Saturday→Friday of the server's business week (dates from the server's 7-day window; RTL: Saturday on the right). */
export function weekOf(days) {
  const today = (days.find(x => x.today) || days[days.length - 1] || {}).date;
  if (!today) return [];
  const sat = addDays(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 1) % 7)), seen = new Set(days.filter(x => x.attended).map(x => x.date));
  return WEEK.map((w, i) => { const date = addDays(sat, i); return { w, full: WEEKF[i], date, today: date === today, done: seen.has(date) && date !== today, future: date > today }; });
}
export function daily(d, ui, m = {}) {
  const ph = ui.phase, wk = weekOf(d.days || []);
  const week = `<div class="week" role="list" aria-label="روزهای این هفته">${wk.map(x => `<div class="day${x.today ? ' today' : x.done ? ' done' : ''}" role="listitem" aria-label="${x.full}${x.today ? '، امروز' : x.done ? '، اومدی' : ''}">` +
    `<span aria-hidden="true">${x.today ? icon('gift', 16) : x.done ? icon('check', 16) : '·'}</span>${x.today ? 'امروز' : x.w}</div>`).join('')}</div>`;
  let act, alert = '';
  if (ph === 'claiming' || ph === 'processing') act = btn('در حال ثبت جایزه…', null, 'ink', '', { disabled: true, busy: true });
  else if (ph === 'slow') { alert = alertBox('info', 'spin', 'ثبت جایزه هنوز تموم نشده؛ جایزه‌ات محفوظه.'); act = btn('بررسی دوباره', 'daily-check', 'ink', 'refresh'); }
  else if (ph === 'error') { alert = alertBox('error', 'alert', esc(ui.message || 'اتصال برقرار نشد؛ جایزه‌ات محفوظه. دوباره امتحان کن.')); act = btn('دوباره امتحان کن', 'daily-claim', 'ink', 'refresh'); }
  else act = btn('دریافت جایزه', 'daily-claim', 'ink', 'left');
  return wrap(`<section class="screen daily-screen" role="dialog" aria-modal="true" aria-labelledby="daily-h">` +
    `<div class="topbar">${backBtn('daily-close', 'بستن جایزه روزانه')}<span>یک جایزه برای برگشتنت</span><span class="icon-sp"></span></div>` +
    `<div class="daily-scroll"><div class="daily-hero" aria-hidden="true"><div class="coin-art">${icon('gift', 67)}</div></div>` +
    `${d.streakDays > 1 ? `<div class="eyebrow streak">${fa(d.streakDays)} روز پشت‌سرهم</div>` : ''}<h1 id="daily-h">خوش برگشتی!</h1>` +
    `<div class="subtitle">هر روز یک سر بزن.<br>جایزه امروزت اینجاست.</div>${week}<div class="daily-value"><strong>${fa(d.amount || 0)}</strong> دیجی‌کوین</div></div>` +
    `<div class="bottom-actions">${alert}${act}<div class="tiny center">فردا هم منتظرتیم.</div></div></section>`, toast(m.toast));
}

// ------------------------------------------------------------------------------------------------ help
export function help(c) {
  const cps = c.checkpoints || [], cost = c.continueRule ? c.continueRule.cost : 0, secs = fa(Math.round((c.inputMs || 10000) / 1000));
  const rows = [
    ['tag', 'قیمت‌ها رو مقایسه کن', 'قیمت کالای اول معلومه. حدس بزن کالای دوم نسبت به اون گرون‌تره یا ارزون‌تر.'],
    ['clock', `${secs} ثانیه برای هر حدس`, `هر وقت آماده بودی، «نمایش کالا» رو بزن؛ از همون لحظه ${secs} ثانیه وقت داری.`],
    ['trophy', 'عنوان تازه بگیر', `با ${cps.map(x => fa(x.requiredCorrect)).join('، ')} پاسخ درست به چک‌پوینت می‌رسی؛ ${cps.some(x => x.rewardAmount > 0) ? 'از چک‌پوینت‌های بعدی دیجی‌کوین هم می‌گیری.' : ''}`],
  ];
  if (c.continueRule && c.continueRule.enabled) rows.push(['heart', 'ادامه همین دست', `اگر امکان ادامه داشته باشی، با ${fa(cost)} دیجی‌کوین همون دست رو ادامه بده.`]);
  const cpRow = `<div class="help-checkpoints">${cps.map((x, j) => `<div>${badge(j + 1, 'badge', x.title)}${fa(x.requiredCorrect)} درست${x.rewardAmount ? `<br><small>${fa(x.rewardAmount)} کوین</small>` : ''}</div>`).join('')}</div>`;
  return wrap(`<section class="screen help-screen"><div class="topbar">${backBtn('guide-close', 'بستن راهنما')}<span>راهنمای قیمت‌شناس</span><span class="icon-sp"></span></div>` +
    `<div class="help-scroll" tabindex="0"><h1>بازار چقدر<br>دستته؟</h1><p class="help-intro">چهار نکته کوتاه، بعدش وقت بازیه.</p>` +
    rows.map((r, i) => `<div class="help-row"><div class="help-icon" aria-hidden="true">${icon(r[0], 25)}</div><div><h3>${r[1]}</h3><p>${r[2]}</p>${i === 2 ? cpRow : ''}</div></div>`).join('') +
    `</div><div class="bottom-actions">${btn('فهمیدم', 'guide-close', 'ink', 'left')}</div></section>`);
}

// ------------------------------------------------------------------------------------------------ game (ready … feedback)
export const TIMER_C = 150.8;   // 2π·24
export function timer(o) {   // o: { t: text, p: 0..1, kind: ''|'urgent'|'stopped', label }
  return `<div class="timer ${o.kind || ''}" data-timer role="timer" aria-label="${o.label || ''}"><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" stroke="#e1e5d8" stroke-width="2" fill="none"/>` +
    `<circle data-ring cx="28" cy="28" r="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-dasharray="${(Math.max(0, o.p) * TIMER_C).toFixed(1)} 151" stroke-linecap="round"/></svg><span class="time" aria-hidden="true">${o.t}</span></div>`;
}
/** Progress toward the next checkpoint; after the last one, toward the record frozen at run start (only if above it). */
function progress(score, cps, target) {
  const ms = cps.map(c => c.requiredCorrect), last = ms[ms.length - 1] || 20, next = ms.find(x => x > score);
  let right, leftS;
  if (next != null) { right = `<strong>${fa(next - score)} پاسخ</strong> تا چک‌پوینت بعدی`; leftS = `${fa(next)} پاسخ درست`; }
  else if (target && target > score) { right = `<strong>${fa(target - score)} پاسخ</strong> تا رکوردت`; leftS = `رکورد ${fa(target)}`; }
  else { right = '<strong>همه چک‌پوینت‌ها رو گرفتی</strong>'; leftS = `${fa(score)} پاسخ درست`; }
  // fill follows the evenly spaced markers, so a passed marker is always covered and the next one never is
  let f = 0;
  if (score >= last) f = 1;
  else for (let i = 0; i < ms.length - 1; i++) if (score >= ms[i] && score < ms[i + 1]) f = (i + (score - ms[i]) / (ms[i + 1] - ms[i])) / (ms.length - 1);
  return `<div class="progress"><div class="progress-summary"><span>${right}</span><span>${leftS}</span></div><div class="milestones" aria-hidden="true"><div class="progress-fill" style="width:${(f * 100).toFixed(1)}%"></div>` +
    cps.map((c, i) => `<div class="milestone ${score >= c.requiredCorrect ? 'done' : c.requiredCorrect === next ? 'next' : ''}"><span>${fa(c.requiredCorrect)}</span><small>${i === 0 || !c.rewardAmount ? 'عنوان تازه' : fa(c.rewardAmount) + ' کوین'}</small></div>`).join('') + '</div></div>';
}
const reference = p => `<div class="reference"><span class="ref-img">${pimg(p)}</span><div class="reference-copy"><span class="eyebrow">قیمت این کالا معلومه</span><h3>${title(p.displayTitle)}</h3>${priceHTML(p.price)}</div></div>`;
const DIR = d => d === 'higher' ? 'گرون‌تر' : d === 'lower' ? 'ارزون‌تر' : 'هم‌قیمت';
/**
 * m: { st: 'ready'|'loading'|'error'|'active'|'urgent'|'checking'|'timeup'|'correct'|'wrong'|'timeout', score, cps, target, ref, product,
 *      pick, tm {t,p}, revealedPrice, direction, equal, imgWait, note {text, btn}, offline, backLocked, sheet, toast }
 */
export function game(m) {
  const st = m.st, ref = m.ref, q = m.product, end = ['correct', 'wrong', 'timeout'].includes(st);
  const top = `<div class="topbar">${`<button class="icon-btn flat" data-act="back" aria-label="خروج از دست"${m.backLocked ? ' disabled aria-disabled="true"' : ''}>${icon('back')}</button>`}` +
    `<span class="game-title">قیمت‌شناس</span><span class="score-chip" aria-label="${fa(m.score)} جواب درست"><strong>${fa(m.score)}</strong> درست</span></div>`;
  const stopped = timer({ t: fa(Math.round((m.inputMs || 10000) / 1000)), p: 1, kind: 'stopped', label: 'زمان هنوز شروع نشده' });
  let head, stage;
  if (st === 'ready' || st === 'loading' || st === 'error') {
    const H = { ready: ['حالا کالای بعدی…', 'هر وقت آماده بودی، ببینش.'], loading: ['کالای بعدی در راهه', 'زمان هنوز شروع نشده.'], error: ['کالای بعدی آماده نشد', 'اتصال برقرار نشد؛ دوباره امتحان کن.'] }[st];
    head = `<div><h2>${H[0]}</h2><div class="tiny">${H[1]}</div></div>${stopped}`;
  } else if (st === 'correct') head = `<div><div class="feedback-line good">${icon('check', 21)}درست گفتی!</div><div class="tiny">${m.equal ? 'قیمت‌ها برابر بود؛ هر دو جواب درسته.' : DIR(m.direction) + ' بود.'}</div></div>${timer({ t: fa(0), p: 0, kind: 'stopped', label: 'پاسخ ثبت شد' })}`;
  else if (st === 'wrong' || st === 'timeout') head = `<div><div class="feedback-line bad">${icon(st === 'timeout' ? 'clock' : 'close', 20)}${st === 'timeout' ? 'زمان تموم شد' : 'جوابت درست نبود'}</div><div class="tiny">${DIR(m.direction)} از کالای بالا بود.</div></div>${timer({ t: fa(0), p: 0, kind: 'urgent ended', label: 'زمان تموم شد' })}`;
  else if (st === 'checking') head = `<div><h2>داریم جوابت رو بررسی می‌کنیم</h2><div class="tiny">انتخابت ارسال شد؛ منتظر نتیجه‌ایم.</div></div><span class="spinner" role="img" aria-label="در حال بررسی"></span>`;
  else if (st === 'timeup') head = `<div><h2>زمان تموم شد</h2><div class="tiny">داریم نتیجه رو از بازی می‌گیریم…</div></div><span class="spinner" role="img" aria-label="در حال بررسی"></span>`;
  else head = `<div><h2>این کالا نسبت به کالای بالا…</h2><div class="tiny">گرون‌تره یا ارزون‌تر؟</div></div>${timer({ t: m.tm.t, p: m.tm.p, kind: st === 'urgent' ? 'urgent' : '', label: m.tm.label })}`;

  if (st === 'ready') stage = `<div class="product-stage mystery"><div class="mystery-icon" aria-hidden="true"><span>؟</span></div><h3>یک کالا، یک حدس.</h3><p>بعد از نمایش، ${fa(Math.round((m.inputMs || 10000) / 1000))} ثانیه وقت داری.</p>` +
    (m.offline ? btn('نمایش کالا', null, '', 'left', { disabled: true }) : btn('نمایش کالا', 'reveal', '', 'left')) + '</div>';
  else if (st === 'loading') stage = `<div class="product-stage loading-stage" aria-busy="true"><div class="loading-image" aria-hidden="true"></div><h3>داریم کالا رو آماده می‌کنیم</h3><div class="waiting-note" role="status">${SPIN}هنوز وقتت شروع نشده</div></div>`;
  else if (st === 'error') stage = `<div class="product-stage mystery">${icon('image', 65)}<h3 class="err-h">این کالا آماده نشد.</h3><p>امتیازت سر جاشه.</p>${btn('دوباره امتحان کن', 'reveal', 'secondary', 'refresh')}</div>`;
  else {
    const cls = st === 'correct' ? ' success' : st === 'wrong' || st === 'timeout' ? ' failure' : '';
    stage = `<div class="product-stage${cls}${m.imgWait ? ' img-wait' : ''}">${end ? `<span class="outcome-mark" aria-hidden="true">${icon(st === 'correct' ? 'check' : st === 'timeout' ? 'clock' : 'close', 17)}</span>` : ''}` +
      `<span class="stage-img">${pimg(q)}</span><h3>${title(q.displayTitle)}</h3>` +
      (end ? priceHTML(m.revealedPrice, 'reveal-price') : `<div class="hidden-price">${icon('lock', 12)}قیمتش رو تو حدس بزن</div>`) + '</div>';
  }
  const disabled = st !== 'active' && st !== 'urgent' || m.offline;
  const cls = dir => m.pick !== dir ? '' : st === 'checking' ? ' selected' : st === 'correct' ? ' good' : st === 'wrong' ? ' bad' : '';
  const ico = dir => m.pick === dir && st === 'correct' ? 'check' : m.pick === dir && st === 'wrong' ? 'close' : dir === 'higher' ? 'up' : 'down';
  const ans = dir => `<button class="answer${cls(dir)}" data-act="ans-${dir}"${disabled ? ' disabled' : ''}${m.pick === dir ? ' aria-pressed="true"' : ''}>${dir === 'higher' ? 'گرون‌تر' : 'ارزون‌تر'}${m.pick === dir && st === 'checking' ? SPIN : icon(ico(dir))}</button>`;
  const answers = st === 'ready' || st === 'error' ? '' :
    `<div class="answer-area"><div class="answer-context">نسبت به <strong><bdi>${money(ref.price)}</bdi> تومان</strong></div><div class="answer-buttons" role="group" aria-label="این کالا نسبت به کالای بالا">${ans('higher')}${ans('lower')}</div></div>`;
  const note = m.note ? `<div class="game-note${m.note.kind ? ' ' + m.note.kind : ''}" role="status"><span>${m.note.text}</span>${m.note.btn || ''}</div>` : '';
  const urgentStrip = st === 'active' || st === 'urgent' ? `<span class="urgent-strip" role="status" data-urgent${st === 'urgent' ? '' : ' hidden'}>وقت داره تموم می‌شه؛ فقط یک انتخاب.</span>` : '';
  const foot = end ? `<button class="link-btn" data-act="fb-next">${st === 'correct' ? 'مقایسه بعدی' : 'دیدن نتیجه'} ${icon('left', 12)}</button>`
    : st === 'ready' ? `با نمایش کالا، ${fa(Math.round((m.inputMs || 10000) / 1000))} ثانیه‌ات شروع می‌شه.` : st === 'checking' || st === 'timeup' ? 'نتیجه از بازی دریافت می‌شه.' : st === 'loading' || st === 'error' ? '' : 'یک مقایسه، یک قدم نزدیک‌تر به عنوان بعدی.';
  const body = `<section class="screen game${st === 'urgent' ? ' urgent-screen' : ''}" data-st="${st}">${top}${progress(m.score, m.cps, m.target)}${reference(ref)}` +
    `<div class="decision-head" aria-live="polite">${head}</div>${stage}${note}${answers}<div class="game-foot">${urgentStrip}<span class="foot-t">${foot}</span></div></section>`;
  return wrap(m.sheet ? `<div class="under" inert>${body}</div>` : body, (m.sheet || '') + toast(m.toast));
}

// ------------------------------------------------------------------------------------------------ exit sheet
export function exitSheet(m) {
  return `<div class="sheet-layer" data-act-scrim="leave-no"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="exit-h" aria-describedby="exit-p"><div class="sheet-handle" aria-hidden="true"></div>` +
    `<div class="sheet-icon" aria-hidden="true">${icon('alert', 28)}</div><h2 id="exit-h">از این دست خارج می‌شی؟</h2>` +
    `<p id="exit-p">این دست با ${fa(m.score)} پاسخ درست تموم می‌شه و دیگه نمی‌تونی ادامه‌اش بدی.${m.questionOpen ? '<br>زمان این سؤال متوقف نمی‌شه.' : ''}</p>` +
    btn('ادامه بازی', 'leave-no', 'ink', 'left') + (m.busy ? btn('در حال ثبت پایان دست…', null, 'ghost', '', { disabled: true, busy: true }) : btn('خروج و پایان دست', 'leave-yes', 'ghost', '')) + '</div></div>';
}

// ------------------------------------------------------------------------------------------------ achievements
const TONES = ['', 'blue', 'gold', 'purple'];
/** c: checkpoint view; index: 0..3; reward: { amount, status } | null; nextC: following checkpoint | null. */
export function checkpoint(c, index, reward, nextC) {
  const n = c.requiredCorrect, pct = c.comparisonPercent != null ? c.comparisonPercent : [50, 70, 90, 99][index], amt = reward ? reward.amount : c.rewardAmount;
  const rl = amt > 0 ? `<div class="reward-line">${icon('gift', 18)}<span><strong>${fa(amt)} دیجی‌کوین</strong> جایزه${reward && reward.status === 'delayed' ? '؛ واریزش کمی طول می‌کشه' : ''}</span></div>` : '';
  return wrap(`<section class="screen celebration ${TONES[index] || ''}" role="dialog" aria-modal="true" aria-labelledby="cp-h"><div class="topbar">${brand()}</div><div class="chapter">چک‌پوینت ${fa(n)}</div>` +
    `<div class="badge-stage"><div class="badge-halo" aria-hidden="true"></div><span class="spark s1" aria-hidden="true">✧</span><span class="spark s2" aria-hidden="true">✦</span><span class="spark s3" aria-hidden="true">✧</span>${badge(index + 1, 'badge', c.title)}</div>` +
    `<div class="badge-title">${esc(c.title)}</div><h1 id="cp-h">از <span class="big-num">${fa(pct)}٪</span> آدما<br>باهوش‌تری!</h1>` +
    `<div class="achievement-note">${fa(n)} جواب درست دادی.<br>${nextC ? 'همین‌قدر تیزبین ادامه بده.' : 'بازار دیگه توی مشتته.'}</div>${rl}` +
    `<div class="bottom-actions">${btn('ادامه بده', 'cp-go', 'ink', 'left')}<div class="next-goal">${nextC ? `${fa(nextC.requiredCorrect - n)} پاسخ تا عنوان بعدی` : 'حالا نوبت رکورد خودته.'}</div></div></section>`);
}
export function record(target, reward) {
  return wrap(`<section class="screen celebration gold record-special" role="dialog" aria-modal="true" aria-labelledby="rec-h"><div class="topbar">${brand()}</div><div class="chapter">رکورد شخصی</div>` +
    `<div class="badge-stage"><div class="badge-halo" aria-hidden="true"></div>${badge(4, 'badge', 'رکورد شخصی')}</div><div class="badge-title">دوباره به رکوردت رسیدی.</div>` +
    `<h1 id="rec-h">چشم‌هات هنوز<br>همون‌قدر تیزبینه!</h1><div class="record-number">${fa(target)}</div><div class="achievement-note">پاسخ درست در همین دست</div>` +
    `<div class="reward-line">${icon('gift', 18)}<span><strong>${fa(reward.amount)} دیجی‌کوین</strong> جایزه رکورد${reward.status === 'delayed' ? '؛ واریزش کمی طول می‌کشه' : ''}</span></div>` +
    `<div class="bottom-actions">${btn('ادامه بده', 'cp-go', 'ink', 'left')}<div class="next-goal">یک قدم دیگه، یک رکورد تازه.</div></div></section>`);
}

// ------------------------------------------------------------------------------------------------ result (and every continue state)
/**
 * Four independent dimensions (spec «مدل حالت»): reason (wrong|timeout), tier (cp of this run or none), continue (pay|insufficient|
 * pending|unknown|failed|none) and alert. m: { reason, score, best, cp, cpIndex, fb, balance, cost, cont, alert, homeLocked, toast }
 */
export function result(m) {
  const lvl = m.cp ? m.cpIndex + 1 : 0, time = m.reason === 'timeout', pend = m.cont === 'pending' || m.cont === 'unknown';
  const pct = m.cp ? (m.cp.comparisonPercent != null ? m.cp.comparisonPercent : [50, 70, 90, 99][m.cpIndex]) : null;
  const fb = m.fb;
  const recap = fb && fb.product ? `<div class="comparison-recap">${pimg(fb.product)}<div class="recap-copy"><small>${time ? 'زمانت روی این کالا تموم شد' : 'اینجا باختی'}</small>${title(fb.product.displayTitle)}` +
    `${fb.revealedPrice != null ? `<br><strong><bdi>${money(fb.revealedPrice)}</bdi> تومان</strong>` : ''}</div>${fb.direction ? `<span class="tiny">${DIR(fb.direction)} بود</span>` : ''}</div>` : '';
  const main = `<div class="result-main" tabindex="-1"><div class="result-top">${lvl ? badge(lvl, 'badge result-badge', m.cp.title) : `<div class="result-badge neutral" aria-hidden="true">${icon('tag', 74)}</div>`}` +
    `<h1 id="res-h">باختی!</h1><div class="subtitle">${time ? 'زمانت تموم شد.' : 'این بار قیمت رو درست حدس نزدی.'}</div></div>` +
    `<div class="stats"><div class="stat"><small>امتیاز</small><strong>${fa(m.score)}</strong></div><div class="stat"><small>بهترین امتیاز</small><strong>${fa(m.best)}</strong></div>` +
    `<div class="stat"><small>عنوان این دست</small><strong>${lvl ? esc(m.cp.title) : 'هنوز عنوانی نگرفتی'}</strong></div></div>` +
    `<div class="ranking-line">${lvl ? `تو بهتر از <strong>${fa(pct)}٪</strong><br>دیجی‌کالایی‌ها بودی!` : `این دست ${fa(m.score)} جواب درست دادی.<br>هر دست، یک فرصت تازه‌ست.`}</div>${recap}</div>`;
  const A = m.alert ? alertBox(m.alert.kind, m.alert.icon, m.alert.html) : '';
  let pay = '';
  if (m.cont !== 'none') {
    const label = pend ? 'در حال بررسی…' : m.cont === 'failed' ? 'تلاش دوباره' : 'ادامه همین دست';
    const bal = `<div class="balance-inline"><span>موجودی تو</span><strong>${m.balance == null ? '—' : fa(m.balance)} دیجی‌کوین</strong></div>`;
    pay = bal + btn(label, pend || m.cont === 'insufficient' ? null : 'continue', pend ? 'ink' : '', pend ? '' : 'left', { disabled: pend || m.cont === 'insufficient', busy: pend }) +
      `<div class="cost-note">${fa(m.cost)} دیجی‌کوین · همان دست ادامه پیدا می‌کنه</div>` + (m.cont === 'unknown' ? '<button class="link-btn center" data-act="recheck">بررسی دوباره</button>' : '');
  }
  return wrap(`<section class="screen result${lvl ? '' : ' no-badge'}${pend ? ' result-pending' : ''}" aria-labelledby="res-h"><div class="topbar">` +
    `<button class="icon-btn flat" data-act="loss-home" aria-label="بازگشت به صفحه اصلی"${m.homeLocked ? ' disabled aria-disabled="true"' : ''}>${icon('back')}</button><span>نتیجه این دست</span><span class="icon-sp"></span></div>` +
    main + `<div class="bottom-actions">${A}${pay}${btn('صفحه اصلی', m.homeLocked ? null : 'loss-home', 'secondary', '', { disabled: m.homeLocked })}<div class="footer-small">کالاهای این دست رو در صفحه اصلی مرور کن.</div></div></section>`, toast(m.toast));
}
