// Play demo backend. GitHub Pages serves static files only, so this page answers the player's API calls itself: an
// in-browser port of the gheimat-shenas backend (application/service/*, domain/*) at the revision named in index.html.
// Play-only timing: question 10 s visible / 12.5 s arrival deadline; continue decisions are untimed.
// Admitted payments resolve within 60 s from admission. Receipt-first admission,
// R-41 bands with look-ahead (starts aligned to 5/10/15/20), each checkpoint paid once when crossed (0/1/3/5), record
// reward (1 for matching a record above 20, once per run), continue 5, daily reward claim, 3 plays a day (Asia/Tehran).
// DEMO ONLY: one account per browser (localStorage), DigiCoin SIMULATED in this page (start balance 120). Nothing is
// charged or credited anywhere. A static page cannot verify the real backend or the real DigiCoin integration.

const PREFIX = '/v1/gamification/price-expert';
export const API_ORIGIN = 'https://play.invalid';   // never resolves: a call that escapes the interceptor fails, it reaches no server
const STORE = 'pe.play.state.v1';

// LaunchConfig.value() of gheimat-shenas (R-20, R-33, R-41, R-47, brief 2026-10-20, redesign 2026-10-21)
const CFG = {
  configVersion: 1, catalogVersion: 2, playsPerDay: 3,
  inputMs: 10_000, acceptMs: 12_500, offerMs: null, offerAcceptMs: null, paymentResolutionMs: 60_000,
  inactivityMs: 180_000, offerActivationMs: 180_000, timeoutGraceMs: 1_000, checkpointAutoContinueMs: 5_000,
  checkpoints: [
    { id: 'cp_5', requiredCorrect: 5, title: 'بازاری تازه‌کار', badgeAssetId: 'badge_5', reward: 0, percent: 50 },
    { id: 'cp_10', requiredCorrect: 10, title: 'بازاری قدیمی', badgeAssetId: 'badge_10', reward: 1, percent: 70 },
    { id: 'cp_15', requiredCorrect: 15, title: 'قیمت‌شناس حرفه‌ای', badgeAssetId: 'badge_15', reward: 3, percent: 90 },
    { id: 'cp_20', requiredCorrect: 20, title: 'قیمت‌شناس اعظم', badgeAssetId: 'badge_20', reward: 5, percent: 99 },
  ],
  continueRule: { enabled: true, cost: 5, cap: 1 },
  recordReward: 1, recordRewardAbove: 20,
  streakReward: 1,
  bands: [
    { minScore: 0, minBp: 5000, minInc: false, maxBp: null, maxInc: false },   // 0–4: d > 50%
    { minScore: 5, minBp: 3000, minInc: false, maxBp: 5000, maxInc: true },    // 5–9: 30% < d ≤ 50%
    { minScore: 10, minBp: 1500, minInc: false, maxBp: 3000, maxInc: true },   // 10–14: 15% < d ≤ 30%
    { minScore: 15, minBp: 800, minInc: false, maxBp: 1500, maxInc: true },    // 15–19: 8% < d ≤ 15%
    { minScore: 20, minBp: 300, minInc: true, maxBp: 800, maxInc: true },      // 20+: 3% ≤ d ≤ 8%
  ],
  features: { streak: true, share: true, products: true, haptics: true },
};
const DAILY_CAP = CFG.playsPerDay * (CFG.checkpoints.reduce((t, c) => t + c.reward, 0) + CFG.recordReward) + CFG.streakReward;   // R-47: 3 × (9 + 1) + 1 = 31
const REWARD_DELAYED_AFTER = 10_000, DAILY_PROCESSING_FOR = 120_000, DAYS_SHOWN = 7, LEASE = 20_000, GIVE_UP = 72 * 3600_000;
const PRODUCT_LINK = dkp => `https://www.digikala.com/product/dkp-${dkp}/`;

// ------------------------------------------------------------------------------------------------ time, ids, errors
let clockNow = Date.now();
const iso = ms => (ms == null ? null : new Date(ms).toISOString());
// shortcut: Asia/Tehran is UTC+03:30 all year (no DST since 2022); use Intl time zones if Iran reintroduces DST
const TEHRAN = 3.5 * 3600_000;
const dateOf = ms => new Date(ms + TEHRAN).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const nextMidnight = ms => Date.parse(addDays(dateOf(ms), 1) + 'T00:00:00Z') - TEHRAN;
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(26)), b => ALPHABET[b & 31]).join('');

class Fail extends Error {
  constructor(status, code, details) { super(code); this.status = status; this.code = code; this.details = details || {}; }
}
const notFound = () => new Fail(404, 'NOT_FOUND');
const invalid = (message, details) => Object.assign(new Fail(422, 'VALIDATION_FAILED', details), { text: message });

// ------------------------------------------------------------------------------------------------ state (localStorage)
const fresh = () => ({
  v: 1, player: { onboarded: false, record: 0, recordRunId: null, blocked: false }, gameOn: true,
  part: {}, seen: {}, runs: {}, qs: {}, offers: {}, ops: {}, credit: {}, idem: {},
  wallet: { balance: 120, tx: {}, script: [] },
});
let S = fresh();
function load() {
  try { const v = JSON.parse(localStorage.getItem(STORE)); if (v && v.v === 1) S = v; } catch (e) { /* storage blocked or corrupt: start fresh */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* the demo then lives for this page only */ }
}
function prune() {   // keep the demo state small: finished runs older than 3 days, idempotency records older than 24 h, seen lists of past days
  const today = dateOf(clockNow);
  for (const [id, r] of Object.entries(S.runs)) {
    if (r.state !== 'FINISHED' || clockNow - r.finishedAt < 3 * 86_400_000 || id === S.player.recordRunId) continue;
    r.questionIds.forEach(q => delete S.qs[q]); r.offerIds.forEach(o => delete S.offers[o]);
    for (const [k, op] of Object.entries(S.ops)) if (op.runId === id && op.type !== 'STREAK_REWARD') delete S.ops[k];
    delete S.runs[id];
  }
  for (const [k, e] of Object.entries(S.idem)) if (clockNow - e.at > 86_400_000) delete S.idem[k];
  for (const d of Object.keys(S.seen)) if (d < today) delete S.seen[d];
  for (const d of Object.keys(S.credit)) if (d < addDays(today, -3)) delete S.credit[d];
}
/** A run saved by an older Play version may name a product this catalog no longer has: it is dropped, not resumed. */
function dropRunsWithUnknownProducts() {
  for (const [id, r] of Object.entries(S.runs)) {
    const dkps = [r.referenceDkp, ...r.questionIds.flatMap(q => (S.qs[q] ? [S.qs[q].referenceDkp, S.qs[q].comparisonDkp] : []))];
    if (dkps.every(d => products.has(d))) continue;
    r.questionIds.forEach(q => delete S.qs[q]); r.offerIds.forEach(o => delete S.offers[o]);
    if (S.player.recordRunId === id) S.player.recordRunId = null;
    delete S.runs[id];
  }
}

// ------------------------------------------------------------------------------------------------ catalog + selection (R-41, R-52, R-62)
let products = new Map(), index = [];   // index: [price, dkp] sorted by price, then dkp
export function setCatalog(rows) {
  products = new Map(rows.map(([dkp, variantId, displayTitle, imageUrl, priceToman]) => [dkp, { dkp, variantId, displayTitle, imageUrl, priceToman }]));
  index = rows.map(r => [r[4], r[0]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
const P = dkp => products.get(dkp);
const firstAtLeast = key => { let lo = 0, hi = index.length; while (lo < hi) { const m = (lo + hi) >> 1; if (index[m][0] < key) lo = m + 1; else hi = m; } return lo; };
const bandIndexFor = score => CFG.bands.reduce((idx, b, i) => (b.minScore <= score ? i : idx), 0);
const bandFor = score => CFG.bands[bandIndexFor(score)];

/** DifficultyPolicy.inBand: exact integer arithmetic (prices × 15,000 stay far below 2^53). */
function inBand(b, ref, cand) {
  const hi = Math.max(ref, cand), lo = Math.min(ref, cand), lhs = 10_000 * (hi - lo);
  const above = b.minInc ? lhs >= b.minBp * lo : lhs > b.minBp * lo;
  if (!above) return false;
  if (b.maxBp == null) return true;
  return b.maxInc ? lhs <= b.maxBp * lo : lhs < b.maxBp * lo;
}
/** DifficultyPolicy.range: the exact inclusive price interval in one direction. */
function range(b, p, dearer) {
  if (dearer) {
    let low = b.minInc ? Math.ceil((10_000 + b.minBp) * p / 10_000) : Math.floor((10_000 + b.minBp) * p / 10_000) + 1;
    let high = Infinity;
    if (b.maxBp != null) { const num = (10_000 + b.maxBp) * p; high = b.maxInc ? Math.floor(num / 10_000) : Math.ceil(num / 10_000) - 1; }
    return { low: Math.max(low, p + 1), high };
  }
  const num = 10_000 * p;
  let high = b.minInc ? Math.floor(num / (10_000 + b.minBp)) : Math.ceil(num / (10_000 + b.minBp)) - 1;
  let low = b.maxBp == null ? 1 : (b.maxInc ? Math.ceil(num / (10_000 + b.maxBp)) : Math.floor(num / (10_000 + b.maxBp)) + 1);
  return { low: Math.max(low, 1), high: Math.min(high, p - 1) };
}
function hasNext(refPrice, score, exclude, also) {
  const b = bandFor(score);
  for (const dearer of [true, false]) {
    const r = range(b, refPrice, dearer); if (r.low > r.high) continue;
    for (let i = firstAtLeast(r.low); i < index.length && index[i][0] <= r.high; i++) {
      const dkp = index[i][1]; if (dkp !== also && !exclude.has(dkp)) return true;
    }
  }
  return false;
}
/** SelectionService.canReveal: some product of the band, not in the run, that itself leaves a valid next question. */
function canReveal(refPrice, score, exclude) {
  const b = bandFor(score);
  for (const dearer of [true, false]) {
    const r = range(b, refPrice, dearer); if (r.low > r.high) continue;
    for (let i = firstAtLeast(r.low); i < index.length && index[i][0] <= r.high; i++) {
      const [price, dkp] = index[i];
      if (exclude.has(dkp) || !inBand(b, refPrice, price)) continue;
      if (hasNext(price, score + 1, exclude, dkp)) return true;
    }
  }
  return false;
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** Candidates in a direction: unseen today first (random order), then seen today, least recently seen first. */
function candidates(b, refPrice, dearer, exclude, showDate) {
  const r = range(b, refPrice, dearer); if (r.low > r.high) return [];
  const seen = S.seen[showDate] || {}, out = [];
  for (let i = firstAtLeast(r.low); i < index.length && index[i][0] <= r.high; i++) {
    const [price, dkp] = index[i];
    if (!exclude.has(dkp) && inBand(b, refPrice, price)) out.push({ dkp, price, lastSeen: seen[dkp] ?? null });
  }
  return out;
}
const firstPassing = (list, score, exclude) => (list.find(c => hasNext(c.price, score + 1, exclude, c.dkp)) || null);
/**
 * SelectionService.chooseComparison. The backend tries a random sample of 48 per direction first and then the whole
 * band; on this catalog size the whole band is searched in random order, which picks with the same distribution.
 */
function chooseComparison(refPrice, score, exclude, showDate) {
  const b = bandFor(score);
  const dearer = candidates(b, refPrice, true, exclude, showDate), cheaper = candidates(b, refPrice, false, exclude, showDate);
  const du = shuffle(dearer.filter(c => c.lastSeen == null)), cu = shuffle(cheaper.filter(c => c.lastSeen == null));
  const dearerFirst = du.length && cu.length ? Math.random() < 0.5 : du.length > 0;   // 50/50 when both exist (R-41)
  const pick = firstPassing(dearerFirst ? du : cu, score, exclude) || firstPassing(dearerFirst ? cu : du, score, exclude);
  if (pick) return pick;
  const seen = [...dearer, ...cheaper].filter(c => c.lastSeen != null).sort((x, y) => x.lastSeen - y.lastSeen);   // R-62 fallback
  return firstPassing(seen, score, exclude);
}
function chooseInitialReference(showDate) {
  const seen = S.seen[showDate] || {};
  const all = shuffle(index.map(([price, dkp]) => ({ price, dkp })));
  all.sort((x, y) => (seen[x.dkp] != null) - (seen[y.dkp] != null));            // unseen today first, random within
  return all.find(c => canReveal(c.price, 0, new Set([c.dkp]))) || null;
}
const markSeen = (date, dkp, at) => { (S.seen[date] ||= {})[dkp] = at; };

// ------------------------------------------------------------------------------------------------ fake DigiCoin (FakeCoinGateway)
function step(op) {
  const i = S.wallet.script.findIndex(s => (s.op || 'any') === op || s.op === 'any');
  return i < 0 ? null : S.wallet.script.splice(i, 1)[0];
}
const txResult = t => (!t.applied ? 'FAILED' : t.visibleAt > clockNow ? 'PENDING' : 'SUCCEEDED');
const gateway = {
  balance() { const s = step('balance'); return s && s.outcome === 'unreadable' ? null : S.wallet.balance; },
  charge: (amount, key) => mutate('charge', -amount, key),
  credit: (amount, key) => mutate('credit', amount, key),
  refund(amount, key, chargeKey) { const c = S.wallet.tx[chargeKey]; return c && c.applied ? mutate('refund', amount, key) : 'FAILED'; },
  query(key) { const t = S.wallet.tx[key]; return t ? txResult(t) : 'NOT_FOUND'; },
};
function mutate(op, delta, key) {
  const s = step(op), outcome = s ? s.outcome || 'succeeded' : 'succeeded';
  if (S.wallet.tx[key]) return txResult(S.wallet.tx[key]);                    // idempotent by key
  if (outcome === 'failed') { S.wallet.tx[key] = { applied: false, visibleAt: clockNow }; return 'FAILED'; }
  if (outcome === 'unknown_not_applied') return 'UNKNOWN';
  if (S.wallet.balance + delta < 0) { S.wallet.tx[key] = { applied: false, visibleAt: clockNow }; return 'FAILED'; }
  S.wallet.balance += delta;
  S.wallet.tx[key] = { applied: true, visibleAt: outcome === 'late_success' ? clockNow + (s.late_ms || 0) : clockNow };
  return outcome === 'unknown_applied' || outcome === 'late_success' ? 'UNKNOWN' : 'SUCCEEDED';
}

// ------------------------------------------------------------------------------------------------ views (ViewAssembler, Views.java)
const cpById = id => CFG.checkpoints.find(c => c.id === id) || null;
const cpView = c => (c ? { checkpointId: c.id, title: c.title, badgeAssetId: c.badgeAssetId, rewardAmount: c.reward, requiredCorrect: c.requiredCorrect, comparisonPercent: c.percent } : null);
const runConfig = () => ({
  configVersion: CFG.configVersion, catalogVersion: CFG.catalogVersion, inputMs: CFG.inputMs, acceptMs: CFG.acceptMs, offerMs: CFG.offerMs,
  offerAcceptMs: CFG.offerAcceptMs, checkpointAutoContinueMs: CFG.checkpointAutoContinueMs, checkpoints: CFG.checkpoints.map(cpView),
  continueRule: { ...CFG.continueRule }, features: { ...CFG.features }, payOnCrossing: true, recordReward: CFG.recordReward, recordRewardAbove: CFG.recordRewardAbove,
});
const resolveBy = o => (o.paymentStartedAt ?? o.acceptDeadline ?? clockNow) + CFG.paymentResolutionMs;
const admits = (o, t) => o.acceptDeadline == null || t <= o.acceptDeadline;
const offerView = o => ({ offerId: o.offerId, state: o.state, openedAt: iso(o.openedAt), deadline: iso(o.deadline), acceptDeadline: iso(o.acceptDeadline), resolveBy: iso(resolveBy(o)), cost: o.cost });
const questionsOf = run => run.questionIds.map(id => S.qs[id]).sort((a, b) => a.seq - b.seq);
const openQuestion = run => questionsOf(run).find(q => q.state === 'OPEN') || null;
const latestOffer = run => (run.offerIds.length ? S.offers[run.offerIds[run.offerIds.length - 1]] : null);
const liveOffer = o => o && (o.state === 'OPEN' || o.state === 'PAYMENT_PENDING');
function lastResult(q) {
  if (q.state === 'OPEN' || q.state === 'UNANSWERED') return null;
  const result = q.state === 'CORRECT' ? 'correct' : q.state === 'WRONG' ? 'wrong' : 'timeout';
  const direction = q.comparisonPrice === q.referencePrice ? 'equal' : q.comparisonPrice > q.referencePrice ? 'higher' : 'lower';
  return { questionId: q.questionId, result, choice: q.choice, revealedPrice: q.comparisonPrice, equalPrices: q.comparisonPrice === q.referencePrice, direction, settledAt: iso(q.settledAt) };
}
function runView(run, device) {
  const ref = P(run.referenceDkp);
  let question = null;
  if (run.state === 'QUESTION_OPEN' && device === run.deviceId) {   // another device learns that a question is open, not which
    const q = openQuestion(run), p = P(q.comparisonDkp);
    question = { questionId: q.questionId, product: { displayTitle: p.displayTitle, imageUrl: p.imageUrl }, t0: iso(q.releasedAt), inputDeadline: iso(q.inputDeadline), acceptDeadline: iso(q.acceptDeadline) };
  }
  const settled = questionsOf(run).filter(q => ['CORRECT', 'WRONG', 'TIMED_OUT'].includes(q.state)).pop();
  let offer = null, operation = null;
  const o = latestOffer(run);
  if (o && (run.state === 'OFFER_OPEN' || run.state === 'PAYMENT_PENDING')) {
    offer = offerView(o);
    if (o.operationId) operation = { operationId: o.operationId, status: 'pending' };
  }
  return {
    runId: run.runId, state: run.state, finishReason: run.finishReason, noOfferReason: run.noOfferReason, score: run.score, record: S.player.record,
    continuesUsed: run.continuesUsed, highestCheckpoint: cpView(cpById(run.highestCheckpointId)),
    reference: { displayTitle: ref.displayTitle, imageUrl: ref.imageUrl, price: ref.priceToman }, question,
    lastResult: settled ? lastResult(settled) : null, offer, operation,
    awaitingOfferUntil: run.state === 'AWAITING_OFFER' ? iso(run.nextDeadlineAt) : null,
    onThisDevice: device === run.deviceId, runConfig: runConfig(), serverTime: iso(clockNow),
  };
}
const stateError = (code, run, device) => new Fail(409, code, { state: runView(run, device) });
function finishedError(run, device) {
  const code = { replaced: 'RUN_REPLACED', blocked: 'PLAYER_BLOCKED', game_off: 'GAME_UNAVAILABLE' }[run.finishReason] || 'RUN_FINISHED';
  return stateError(code, run, device);
}

// ------------------------------------------------------------------------------------------------ participation, streak, credits
const part = d => (S.part[d] ||= { playsUsed: 0, finishedRuns: 0, streakEligible: false });
const eligibleDates = () => Object.keys(S.part).filter(d => S.part[d].streakEligible).sort();
function streak(today) {   // StreakPolicy.compute
  const dates = new Set(eligibleDates().filter(d => d <= today));
  if (!dates.size) return 0;
  const last = [...dates].sort().pop();
  if (last !== today && last !== addDays(today, -1)) return 0;
  let n = 0; for (let d = last; dates.has(d); d = addDays(d, -1)) n++;
  return n;
}
function createCredit(run, type, amount, at, rewardKey = null) {   // SettlementService.createCredit: against the start day's cap (R-47, F-03)
  const capDay = run.startBusinessDate, dc = (S.credit[capDay] ||= { credited: 0, held: 0 });
  const grant = Math.min(amount, Math.max(0, DAILY_CAP - dc.credited)), held = amount - grant;
  dc.credited += grant; dc.held += held;
  const claim = type === 'STREAK_REWARD';   // the daily reward waits for the claim in the modal (brief 2026-10-20)
  const op = { operationId: newId(), runId: run.runId, offerId: null, type, rewardKey, amount: grant, heldAmount: held,
    status: grant <= 0 ? 'HELD' : claim ? 'CLAIMABLE' : 'PENDING', capDay, createdAt: at, claimedAt: null,
    nextAttemptAt: grant > 0 && !claim ? at : null, giveUpAt: at + GIVE_UP, attempts: 0, relatedOperationId: null };
  S.ops[op.operationId] = op;
  return op;
}
const streakRewardOf = capDay => Object.values(S.ops).find(o => o.type === 'STREAK_REWARD' && o.capDay === capDay);

/** SettlementService.finish */
function finish(run, reason, at) {
  if (run.state === 'FINISHED') return;
  const q = openQuestion(run);
  if (q) Object.assign(q, { state: 'UNANSWERED', choice: null, receivedAt: null, settledAt: at });   // no correctness (R-59)
  const o = latestOffer(run);
  if (liveOffer(o)) {
    o.state = o.state === 'PAYMENT_PENDING' ? 'ENDED_UNCONFIRMED' : reason === 'skipped' ? 'SKIPPED' : reason === 'expired' ? 'EXPIRED' : 'CANCELLED';
    o.closedAt = at;
  }
  Object.assign(run, { state: 'FINISHED', finishReason: reason, finishedAt: at, nextDeadlineAt: null, recordBefore: S.player.record, newRecord: false,
    lossQuestionId: ['wrong', 'timeout', 'skipped', 'expired', 'continue_failed'].includes(reason) ? run.missQuestionId : null });
  if (reason === 'blocked') return;
  if (run.score > S.player.record) { S.player.record = run.score; S.player.recordRunId = run.runId; run.newRecord = true; }
  const p = part(run.startBusinessDate); p.finishedRuns++; p.streakEligible = true;
  if (CFG.features.streak && CFG.streakReward > 0 && !streakRewardOf(run.startBusinessDate)) createCredit(run, 'STREAK_REWARD', CFG.streakReward, at);
  // since the redesign every checkpoint is paid when it is crossed (crossingRewards): nothing is left to pay at the end
}
const runRewards = run => Object.values(S.ops).filter(o => o.runId === run.runId && (o.type === 'CHECKPOINT_REWARD' || o.type === 'RECORD_REWARD'));
/** SettlementService.crossingRewards: once per (run, checkpoint) at the valid crossing; the record reward once per run. */
function crossingRewards(run, reached, at) {
  const has = key => runRewards(run).some(o => o.rewardKey === key);
  if (reached && reached.reward > 0 && !has(reached.id)) processOp(createCredit(run, 'CHECKPOINT_REWARD', reached.reward, at, reached.id).operationId);
  const t = run.bestScoreAtStart;
  if (CFG.recordReward > 0 && t != null && t > CFG.recordRewardAbove && run.score === t && !has('record:' + t))
    processOp(createCredit(run, 'RECORD_REWARD', CFG.recordReward, at, 'record:' + t).operationId);
}

// ------------------------------------------------------------------------------------------------ deadlines (DeadlineService)
function applyDue(run) {
  if (run.state === 'FINISHED') return false;
  const now = clockNow;
  if (S.player.blocked) { finish(run, 'blocked', now); return true; }
  switch (run.state) {
    case 'READY':
      if (!S.gameOn) { finish(run, 'game_off', now); return true; }
      if (now >= run.readySince + CFG.inactivityMs) { finish(run, 'inactive', run.readySince + CFG.inactivityMs); return true; }
      break;
    case 'QUESTION_OPEN': {
      const q = openQuestion(run);
      if (now >= q.acceptDeadline + CFG.timeoutGraceMs) {   // a receipt recorded on time is the answer, not a timeout
        if (q.receivedAt != null && q.choice) settleAnswer(run, q, now); else timeout(run, q);
        return true;
      }
      break;
    }
    case 'AWAITING_OFFER':
      if (!S.gameOn) { finishAfterMiss(run, 'game_off', now); return true; }
      if (now >= run.nextDeadlineAt) { finishAfterMiss(run, null, run.nextDeadlineAt); return true; }
      break;
    case 'OFFER_OPEN': {
      const o = latestOffer(run);
      if (!S.gameOn) { finish(run, 'game_off', now); return true; }
      if (o.acceptDeadline != null && now >= o.acceptDeadline + CFG.timeoutGraceMs) {   // a purchase that ARRIVED in time is admitted, not expired
        if (o.state === 'OPEN' && o.purchaseReceivedAt != null && admits(o, o.purchaseReceivedAt) && run.continuesUsed < CFG.continueRule.cap) admitPurchase(run, o, now);
        else finish(run, 'expired', o.acceptDeadline);
        return true;
      }
      break;
    }
    case 'PAYMENT_PENDING': {
      const rb = resolveBy(latestOffer(run));
      if (now >= rb) { finish(run, 'continue_failed', rb); return true; }
      break;
    }
  }
  return false;
}
function admitPurchase(run, offer, now) {
  const op = { operationId: newId(), runId: run.runId, offerId: offer.offerId, type: 'CHARGE', amount: offer.cost, heldAmount: 0, status: 'PENDING',
    capDay: null, createdAt: now, claimedAt: null, nextAttemptAt: now, giveUpAt: now + GIVE_UP, attempts: 0, relatedOperationId: null };
  S.ops[op.operationId] = op;
  Object.assign(offer, { paymentStartedAt: now, state: 'PAYMENT_PENDING', operationId: op.operationId, purchaseReceivedAt: null });
  Object.assign(run, { state: 'PAYMENT_PENDING', nextDeadlineAt: resolveBy(offer) });
  return op.operationId;
}
function settleAnswer(run, q, now) {
  const correct = q.comparisonPrice === q.referencePrice || (q.choice === 'higher' ? q.comparisonPrice > q.referencePrice : q.comparisonPrice < q.referencePrice);
  Object.assign(q, { settledAt: now, state: correct ? 'CORRECT' : 'WRONG' });
  if (correct) {
    run.score++;
    const reached = CFG.checkpoints.filter(c => c.requiredCorrect === run.score).pop();
    if (reached) run.highestCheckpointId = reached.id;
    Object.assign(run, { referenceDkp: q.comparisonDkp, state: 'READY', readySince: now, nextDeadlineAt: now + CFG.inactivityMs });   // promotion
    crossingRewards(run, reached, now);
    if (!S.gameOn) finish(run, 'game_off', now);
  } else miss(run, q, q.receivedAt);
}
function timeout(run, q) {   // stamped at the arrival deadline even when finalised later
  Object.assign(q, { state: 'TIMED_OUT', settledAt: q.acceptDeadline });
  miss(run, q, q.acceptDeadline);
}
function miss(run, q, at) {
  run.missQuestionId = q.questionId; run.missAt = at;
  const rule = CFG.continueRule;
  const reason = !rule.enabled || rule.cap === 0 ? 'disabled' : run.continuesUsed >= rule.cap ? 'limit_used' : !S.gameOn ? 'game_off' : S.player.blocked ? 'blocked' : null;
  if (reason) { run.noOfferReason = reason; finish(run, q.state === 'TIMED_OUT' ? 'timeout' : 'wrong', at); return; }
  Object.assign(run, { state: 'AWAITING_OFFER', nextDeadlineAt: at + CFG.offerActivationMs });
}
function finishAfterMiss(run, reason, at) {
  const q = S.qs[run.missQuestionId];
  if (reason) run.noOfferReason = reason;
  finish(run, q && q.state === 'TIMED_OUT' ? 'timeout' : 'wrong', at);
}

// ------------------------------------------------------------------------------------------------ payments (PaymentService)
const backoff = attempts => Math.min(60, 2 ** Math.min(6, Math.max(0, attempts - 1))) * 1000;
function processOp(id) {
  const op = S.ops[id];
  if (!op || (op.status !== 'PENDING' && op.status !== 'UNKNOWN')) return;
  if (op.nextAttemptAt != null && op.nextAttemptAt > clockNow) return;
  if (clockNow > op.giveUpAt) { op.status = 'NEEDS_REVIEW'; return; }
  op.attempts++; op.nextAttemptAt = clockNow + LEASE;
  const outcome = execute(op);
  if (op.type === 'CHARGE') applyChargeOutcome(op, outcome); else applyCreditOutcome(op, outcome);
}
function execute(op) {
  const mayHaveBeenSent = op.attempts > 1 || op.status === 'UNKNOWN';
  if (mayHaveBeenSent) { const q = gateway.query(op.operationId); if (q !== 'NOT_FOUND') return q; }
  if (op.type === 'CHARGE') {
    const offer = S.offers[op.offerId];
    if (!offer || offer.state !== 'PAYMENT_PENDING' || !(clockNow < resolveBy(offer))) return mayHaveBeenSent ? 'UNKNOWN' : 'FAILED';
    return gateway.charge(op.amount, op.operationId);
  }
  if (op.type === 'REFUND') return gateway.refund(op.amount, op.operationId, op.relatedOperationId);
  return gateway.credit(op.amount, op.operationId);
}
function applyChargeOutcome(op, outcome) {
  const now = clockNow, run = S.runs[op.runId], offer = S.offers[op.offerId];
  if (['SUCCEEDED', 'FAILED', 'NEEDS_REVIEW'].includes(op.status)) return;
  if (run.state === 'PAYMENT_PENDING' && now >= resolveBy(offer)) finish(run, 'continue_failed', resolveBy(offer));
  if (outcome === 'SUCCEEDED') {
    Object.assign(op, { status: 'SUCCEEDED', nextAttemptAt: null });
    let granted = false;
    if (offer.state === 'PAYMENT_PENDING' && run.state === 'PAYMENT_PENDING') {
      const ref = P(run.referenceDkp);
      if (!S.player.blocked && S.gameOn && canReveal(ref.priceToman, run.score, runProducts(run))) {
        Object.assign(offer, { state: 'GRANTED', closedAt: now });
        run.continuesUsed++;
        Object.assign(run, { state: 'READY', readySince: now, nextDeadlineAt: now + CFG.inactivityMs, missQuestionId: null, missAt: null });
        granted = true;
      } else {
        const why = S.player.blocked ? 'blocked' : !S.gameOn ? 'game_off' : 'continue_failed';
        if (why === 'continue_failed') run.noOfferReason = 'no_products';
        finish(run, why, now);
      }
    }
    if (!granted) createRefund(op, now);
  } else if (outcome === 'FAILED') {
    Object.assign(op, { status: 'FAILED', nextAttemptAt: null });
    if (offer.state === 'PAYMENT_PENDING' && run.state === 'PAYMENT_PENDING') {
      if (admits(offer, now)) {   // known rejection: the same offer stays actionable while a purchase can still be admitted
        Object.assign(offer, { state: 'OPEN', operationId: null });
        Object.assign(run, { state: 'OFFER_OPEN', nextDeadlineAt: offer.acceptDeadline == null ? null : offer.acceptDeadline + CFG.timeoutGraceMs });
      } else finish(run, 'continue_failed', now);
    }
  } else Object.assign(op, { status: 'UNKNOWN', nextAttemptAt: now + backoff(op.attempts) });   // reconcile by status query
}
function applyCreditOutcome(op, outcome) {
  if (op.status !== 'PENDING' && op.status !== 'UNKNOWN') return;
  if (outcome === 'SUCCEEDED') Object.assign(op, { status: 'SUCCEEDED', nextAttemptAt: null });
  else if (outcome === 'FAILED') Object.assign(op, { status: 'NEEDS_REVIEW', nextAttemptAt: null });
  else Object.assign(op, { status: 'UNKNOWN', nextAttemptAt: clockNow + backoff(op.attempts) });
}
const refundOf = chargeId => Object.values(S.ops).find(o => o.type === 'REFUND' && o.relatedOperationId === chargeId) || null;
function createRefund(charge, now) {
  if (refundOf(charge.operationId)) return;
  const r = { operationId: newId(), runId: charge.runId, offerId: charge.offerId, type: 'REFUND', amount: charge.amount, heldAmount: 0, status: 'PENDING',
    capDay: null, createdAt: now, claimedAt: null, nextAttemptAt: now, giveUpAt: now + GIVE_UP, attempts: 0, relatedOperationId: charge.operationId };
  S.ops[r.operationId] = r;
}
function runProducts(run) {   // JdbcRunRepository.runProductDkps
  const s = new Set([run.referenceDkp]), qs = questionsOf(run);
  if (qs.length) s.add(qs[0].referenceDkp);
  qs.forEach(q => s.add(q.comparisonDkp));
  return s;
}

// ------------------------------------------------------------------------------------------------ player commands (RunService, QueryService)
function lockForCommand(runId) {
  const run = S.runs[runId]; if (!run) throw notFound();
  applyDue(run);
  return run;
}
function requireDevice(run, device) {
  if (run.deviceId !== device) throw new Fail(409, 'ACTIVE_RUN_OTHER_DEVICE', { state: runView(run, device) });
}
const activeRun = () => Object.values(S.runs).find(r => r.state !== 'FINISHED') || null;
const quota = (now, used) => ({ playsLeft: Math.max(0, CFG.playsPerDay - used), playsPerDay: CFG.playsPerDay, resetsAt: iso(nextMidnight(now)) });

function start(device) {
  const now = clockNow;
  if (S.player.blocked) throw new Fail(409, 'PLAYER_BLOCKED');
  if (!S.gameOn) throw new Fail(409, 'GAME_UNAVAILABLE', { message: '' });
  let active = activeRun();
  if (active) { applyDue(active); if (active.state === 'FINISHED') active = null; }
  if (active) {
    if (active.deviceId === device) throw new Fail(409, 'ACTIVE_RUN_EXISTS', { run_id: active.runId });
    if (active.state === 'PAYMENT_PENDING') { const o = latestOffer(active); throw new Fail(409, 'OPERATION_PENDING', { run_id: active.runId, operation_id: o.operationId || '', offer_deadline: iso(o.deadline) }); }
  }
  const day = dateOf(now), p = part(day);
  if (p.playsUsed >= CFG.playsPerDay) throw new Fail(409, 'DAILY_QUOTA_EXHAUSTED', { resets_at: iso(nextMidnight(now)) });
  const ref = chooseInitialReference(day);
  if (!ref) throw new Fail(409, 'GAME_UNAVAILABLE');
  const runId = newId();
  let replaced = null;
  if (active) {   // an accepted start on another device replaces the old run (R-28)
    finish(active, 'replaced', now);
    const cp = cpById(active.highestCheckpointId);
    replaced = { runId: active.runId, score: active.score, checkpointReward: runRewards(active).reduce((t, o) => t + o.amount + o.heldAmount, 0) };
  }
  const run = { runId, deviceId: device, state: 'READY', startBusinessDate: day, startedAt: now, referenceDkp: ref.dkp, nextSeq: 1, readySince: now,
    nextDeadlineAt: now + CFG.inactivityMs, score: 0, continuesUsed: 0, highestCheckpointId: null, missQuestionId: null, missAt: null, noOfferReason: null,
    finishReason: null, finishedAt: null, lossQuestionId: null, recordBefore: null, newRecord: false, questionIds: [], offerIds: [], bestScoreAtStart: S.player.record };
  S.runs[runId] = run;
  p.playsUsed++;
  markSeen(day, ref.dkp, now);
  return { status: 201, body: { run: runView(run, device), replacedRun: replaced, quota: quota(now, p.playsUsed) } };
}

function reveal(runId, device) {
  const run = lockForCommand(runId);
  if (run.state === 'FINISHED') throw finishedError(run, device);
  requireDevice(run, device);
  if (run.state === 'QUESTION_OPEN') return runView(run, device);   // same question, any key
  if (run.state !== 'READY') throw stateError('INVALID_STATE', run, device);
  const ref = P(run.referenceDkp), now = clockNow;
  const sel = chooseComparison(ref.priceToman, run.score, runProducts(run), dateOf(now));
  if (!sel) { finish(run, 'no_products', now); return runView(run, device); }
  const q = { questionId: newId(), runId: run.runId, seq: run.nextSeq, scoreBefore: run.score, bandIndex: bandIndexFor(run.score),
    referenceDkp: ref.dkp, referencePrice: ref.priceToman, comparisonDkp: sel.dkp, comparisonPrice: sel.price,
    releasedAt: now, inputDeadline: now + CFG.inputMs, acceptDeadline: now + CFG.acceptMs, state: 'OPEN', choice: null, receivedAt: null, settledAt: null };
  S.qs[q.questionId] = q; run.questionIds.push(q.questionId);
  Object.assign(run, { state: 'QUESTION_OPEN', nextDeadlineAt: q.acceptDeadline + CFG.timeoutGraceMs });
  run.nextSeq++;
  markSeen(dateOf(now), q.comparisonDkp, now);
  return runView(run, device);
}

function answer(questionId, choice, device, receivedAt) {
  if (choice !== 'higher' && choice !== 'lower') throw invalid('invalid choice', { choice: 'higher or lower' });
  const peek = S.qs[questionId]; if (!peek) throw notFound();
  const owner = S.runs[peek.runId];
  // receipt first: recorded on arrival when the question is open, on time and asked from the run's device
  if (peek.state === 'OPEN' && peek.receivedAt == null && admits(peek, receivedAt) && owner.deviceId === device && owner.state === 'QUESTION_OPEN')
    Object.assign(peek, { choice, receivedAt });
  const run = lockForCommand(peek.runId), q = S.qs[questionId];
  if (q.state === 'CORRECT' || q.state === 'WRONG') return answerView(q, run, device);   // first committed answer wins; replays get it
  if (q.state === 'TIMED_OUT') throw stateError('QUESTION_EXPIRED', run, device);
  if (run.state === 'FINISHED' || q.state === 'UNANSWERED') throw finishedError(run, device);
  requireDevice(run, device);
  if (q.receivedAt == null) {
    if (receivedAt > q.acceptDeadline) throw stateError('QUESTION_EXPIRED', run, device);   // inclusive cutoff
    Object.assign(q, { choice, receivedAt });
  }
  settleAnswer(run, q, clockNow);
  return answerView(q, run, device);
}
function answerView(q, run, device) {
  const lr = lastResult(q);
  const reached = q.state === 'CORRECT' ? CFG.checkpoints.find(c => c.requiredCorrect === q.scoreBefore + 1) || null : null;
  const op = key => { const o = runRewards(run).find(x => x.rewardKey === key); return o ? rewardStatus(o) : null; };
  const t = run.bestScoreAtStart;
  return { questionId: q.questionId, result: lr.result, choice: lr.choice, equalPrices: lr.equalPrices, revealedPrice: lr.revealedPrice, direction: lr.direction,
    score: run.score, checkpointReached: cpView(reached), checkpointReward: reached ? op(reached.id) : null,
    recordReward: q.state === 'CORRECT' && t != null && q.scoreBefore + 1 === t ? op('record:' + t) : null, continuePossible: run.state === 'AWAITING_OFFER' && q.questionId === run.missQuestionId,
    noOfferReason: run.noOfferReason, runFinished: run.state === 'FINISHED', run: runView(run, device), serverTime: iso(clockNow) };
}

function activateOffer(runId, device) {
  const run = lockForCommand(runId);
  const view = (balance, o) => {
    const offer = o || (run.state === 'OFFER_OPEN' || run.state === 'PAYMENT_PENDING' ? latestOffer(run) : null);
    return { offer: offer ? offerView(offer) : null, balance, noOfferReason: run.noOfferReason, run: runView(run, device), serverTime: iso(clockNow) };
  };
  if (run.state === 'OFFER_OPEN' || run.state === 'PAYMENT_PENDING' || run.state === 'FINISHED') return view(null, null);
  requireDevice(run, device);
  if (run.state !== 'AWAITING_OFFER') throw stateError('INVALID_STATE', run, device);
  if (!canReveal(P(run.referenceDkp).priceToman, run.score, runProducts(run))) { finishAfterMiss(run, 'no_products', clockNow); return view(null, null); }
  const balance = gateway.balance(), cost = CFG.continueRule.cost, now = clockNow;   // unknown balance = too low (R-63)
  // R-50: coins earned in this run (already in the wallet since the redesign) cannot fund its continue
  const earned = runRewards(run).filter(o => o.status === 'SUCCEEDED' || o.status === 'UNKNOWN').reduce((t, o) => t + o.amount, 0);
  if (balance == null || balance - earned < cost) { finishAfterMiss(run, 'no_funds', now); return view(balance, null); }
  const o = { offerId: newId(), runId: run.runId, questionId: run.missQuestionId, state: 'OPEN', cost, openedAt: now, deadline: CFG.offerMs == null ? null : now + CFG.offerMs,
    acceptDeadline: CFG.offerAcceptMs == null ? null : now + CFG.offerAcceptMs, purchaseReceivedAt: null, operationId: null, closedAt: null };
  S.offers[o.offerId] = o; run.offerIds.push(o.offerId);
  Object.assign(run, { state: 'OFFER_OPEN', nextDeadlineAt: o.acceptDeadline == null ? null : o.acceptDeadline + CFG.timeoutGraceMs });
  return view(balance, o);
}

function continueOffer(offerId, device, receivedAt) {
  const peek = S.offers[offerId]; if (!peek) throw notFound();
  const owner = S.runs[peek.runId];
  if (peek.state === 'OPEN' && peek.purchaseReceivedAt == null && admits(peek, receivedAt) && owner.deviceId === device && owner.state === 'OFFER_OPEN')
    peek.purchaseReceivedAt = receivedAt;   // receipt first, like answers
  const run = lockForCommand(peek.runId), offer = S.offers[offerId];
  let opId;
  if (offer.state === 'PAYMENT_PENDING' || offer.state === 'GRANTED' || (offer.operationId && offer.state === 'ENDED_UNCONFIRMED')) opId = offer.operationId;
  else {
    if (run.state === 'FINISHED') throw offer.state === 'EXPIRED' ? stateError('OFFER_EXPIRED', run, device) : finishedError(run, device);
    requireDevice(run, device);
    if (offer.state !== 'OPEN' || run.state !== 'OFFER_OPEN') throw stateError('INVALID_STATE', run, device);
    const arrival = offer.purchaseReceivedAt != null ? offer.purchaseReceivedAt : receivedAt;
    if (!admits(offer, arrival)) throw stateError('OFFER_EXPIRED', run, device);
    if (run.continuesUsed >= CFG.continueRule.cap) throw stateError('CONTINUE_LIMIT_USED', run, device);
    opId = admitPurchase(run, offer, clockNow);
  }
  processOp(opId);   // immediate attempt; the worker covers UNKNOWN
  return { status: 202, body: operation(opId, device) };
}

function operation(opId, device) {
  const op = S.ops[opId];
  if (!op || op.type !== 'CHARGE') throw notFound();
  const run = lockForCommand(op.runId), offer = S.offers[op.offerId], refund = refundOf(op.operationId);
  const chargeStatus = op.status === 'SUCCEEDED' ? 'confirmed' : op.status === 'FAILED' ? 'failed' : 'unknown';
  const refundStatus = refund ? (refund.status === 'SUCCEEDED' ? 'succeeded' : 'pending') : 'none';
  const status = offer.state === 'GRANTED' ? 'succeeded' : op.status === 'FAILED' ? 'failed' : refundStatus === 'succeeded' ? 'refunded'
    : offer.state === 'ENDED_UNCONFIRMED' || offer.state === 'CANCELLED' || run.state === 'FINISHED' ? 'expired_unconfirmed' : 'pending';
  return { operationId: op.operationId, offerId: offer.offerId, status, definitive: status !== 'pending', chargeStatus, refundStatus,
    chargedAmount: op.status === 'SUCCEEDED' ? op.amount : 0, refundedAmount: refund && refund.status === 'SUCCEEDED' ? refund.amount : 0,
    balance: status === 'pending' ? null : gateway.balance(), admittedAt: iso(op.createdAt), resolveBy: iso(resolveBy(offer)),
    run: runView(run, device), serverTime: iso(clockNow) };
}

function skip(offerId, device) {
  const peek = S.offers[offerId]; if (!peek) throw notFound();
  const run = lockForCommand(peek.runId), offer = S.offers[offerId];
  if (offer.state === 'PAYMENT_PENDING' || (offer.state === 'OPEN' && offer.purchaseReceivedAt != null)) throw stateError('OPERATION_PENDING', run, device);
  if (run.state === 'FINISHED' || offer.state !== 'OPEN') return runView(run, device);
  requireDevice(run, device);
  finish(run, 'skipped', clockNow);
  return runView(run, device);
}

function leave(runId, device) {
  const run = lockForCommand(runId);
  if (run.state === 'FINISHED') return runView(run, device);
  requireDevice(run, device);
  const o = latestOffer(run);
  if (run.state === 'PAYMENT_PENDING' || (run.state === 'OFFER_OPEN' && o && o.purchaseReceivedAt != null)) throw stateError('OPERATION_PENDING', run, device);
  finish(run, run.state === 'OFFER_OPEN' || run.state === 'AWAITING_OFFER' ? 'skipped' : 'left', clockNow);
  return runView(run, device);
}

function rewardStatus(o) {
  const status = o.heldAmount > 0 ? 'delayed' : o.status === 'SUCCEEDED' ? 'succeeded'
    : ['HELD', 'NEEDS_REVIEW', 'UNKNOWN', 'FAILED'].includes(o.status) ? 'delayed'
    : o.createdAt + REWARD_DELAYED_AFTER < clockNow ? 'delayed' : 'pending';
  return { amount: o.amount + o.heldAmount, heldAmount: o.heldAmount, status };
}
function result(runId, device) {
  const run = lockForCommand(runId);
  if (run.state !== 'FINISHED') throw stateError('RUN_NOT_FINISHED', run, device);
  const parts = runRewards(run).map(rewardStatus);
  const cpReward = !parts.length ? { amount: 0, heldAmount: 0, status: 'none' } : { amount: parts.reduce((t, x) => t + x.amount, 0), heldAmount: parts.reduce((t, x) => t + x.heldAmount, 0),
    status: parts.some(x => x.status === 'delayed') ? 'delayed' : parts.some(x => x.status === 'pending') ? 'pending' : 'succeeded' };
  const next = CFG.checkpoints.find(c => c.requiredCorrect > run.score);
  const balance = gateway.balance();
  return { runId: run.runId, score: run.score, reason: run.finishReason, noOfferReason: run.noOfferReason, record: S.player.record, isNewRecord: !!run.newRecord,
    previousRecord: run.recordBefore || 0, checkpoint: run.finishReason === 'blocked' ? null : cpView(cpById(run.highestCheckpointId)), checkpointReward: cpReward,
    continuesUsed: run.continuesUsed, continueLimitUsed: run.noOfferReason === 'limit_used',
    nextGoal: next ? { remaining: next.requiredCorrect - run.score, title: next.title, reward: next.reward, requiredCorrect: next.requiredCorrect } : null,
    quota: quota(clockNow, part(dateOf(clockNow)).playsUsed), balance, campaignCode: null, finishedAt: iso(run.finishedAt), serverTime: iso(clockNow) };
}
function productsView(runId, device) {
  const run = lockForCommand(runId);
  if (run.state !== 'FINISHED') throw stateError('RUN_NOT_FINISHED', run, device);   // no open-question leak
  const qs = questionsOf(run), items = [];
  // title: the catalog's long title is left out of this static demo to keep the download small; the player shows displayTitle only
  const item = (role, questionId, p, price, result, isLoss) => ({ position: items.length + 1, role, questionId, productId: String(p.dkp), variantId: String(p.variantId),
    displayTitle: p.displayTitle, title: p.displayTitle, imageUrl: p.imageUrl, gamePrice: price, result, isLoss, link: PRODUCT_LINK(p.dkp) });
  const first = P(qs.length ? qs[0].referenceDkp : run.referenceDkp);
  items.push(item('reference', null, first, first.priceToman, null, false));
  let loss = null;
  for (const q of qs) {
    const p = P(q.comparisonDkp), isLoss = q.questionId === run.lossQuestionId;
    if (isLoss) loss = String(p.dkp);
    const res = { CORRECT: 'correct', WRONG: 'wrong', TIMED_OUT: 'timeout' }[q.state] || 'unanswered';
    items.push(item('question', q.questionId, p, q.state === 'UNANSWERED' ? null : q.comparisonPrice, res, isLoss));
  }
  return { runId: run.runId, items, lossProductId: loss, serverTime: iso(clockNow) };
}
function share(runId, device) {
  const run = lockForCommand(runId);
  if (run.state !== 'FINISHED') throw stateError('RUN_NOT_FINISHED', run, device);
  const cp = run.finishReason === 'blocked' ? null : cpById(run.highestCheckpointId);
  return { score: run.score, checkpointTitle: cp ? cp.title : null, badgeAssetId: cp ? cp.badgeAssetId : null, gameName: 'قیمت‌شناس', deepLink: 'https://amasn-a.github.io/gheimat-shenas-play/' };
}

function dailyView() {   // DailyRewardService.view
  const today = dateOf(clockNow), attended = new Set(eligibleDates());
  const days = []; for (let i = DAYS_SHOWN - 1; i >= 0; i--) { const d = addDays(today, -i); days.push({ date: d, attended: attended.has(d), today: i === 0 }); }
  const claimable = Object.values(S.ops).filter(o => o.type === 'STREAK_REWARD' && o.status === 'CLAIMABLE').sort((a, b) => (a.capDay < b.capDay ? -1 : 1));
  let state, shown;
  if (claimable.length) { state = 'claimable'; shown = claimable; }
  else {
    const claimed = Object.values(S.ops).filter(o => o.type === 'STREAK_REWARD' && o.claimedAt != null);
    const latest = claimed.reduce((m, o) => Math.max(m, o.claimedAt), -Infinity);
    shown = claimed.filter(o => o.claimedAt === latest).sort((a, b) => (a.capDay < b.capDay ? -1 : 1));
    if (!shown.length) state = 'none';
    else if (shown.every(o => o.status === 'SUCCEEDED')) state = 'claimed';
    else if (shown.some(o => o.status === 'PENDING' || o.status === 'UNKNOWN') && shown[0].claimedAt + DAILY_PROCESSING_FOR > clockNow) state = 'processing';
    else state = 'delayed';
  }
  return { state, amount: shown.reduce((s, o) => s + o.amount, 0), streakDays: streak(today), days, operationIds: shown.map(o => o.operationId),
    claimedAt: shown.length ? iso(shown[0].claimedAt) : null, serverTime: iso(clockNow) };
}
function claimDaily() {
  if (S.player.blocked) throw new Fail(409, 'PLAYER_BLOCKED');
  const ids = [];
  for (const op of Object.values(S.ops).filter(o => o.type === 'STREAK_REWARD' && o.status === 'CLAIMABLE')) {
    Object.assign(op, { status: 'PENDING', claimedAt: clockNow, nextAttemptAt: clockNow, giveUpAt: clockNow + GIVE_UP });
    ids.push(op.operationId);
  }
  ids.forEach(processOp);
  return dailyView();
}

function bootstrap(device) {
  const balance = gateway.balance(), now = clockNow, today = dateOf(now);
  let active = activeRun();
  if (active) { applyDue(active); if (active.state === 'FINISHED') active = null; }
  let activeView = null;
  if (active) {
    const o = active.state === 'OFFER_OPEN' || active.state === 'PAYMENT_PENDING' ? latestOffer(active) : null;
    activeView = { runId: active.runId, state: active.state, onThisDevice: device === active.deviceId, score: active.score,
      checkpoint: cpView(cpById(active.highestCheckpointId)), offerDeadline: o ? iso(o.deadline) : null, operationId: o ? o.operationId : null };
  }
  const recordRun = S.player.recordRunId && S.runs[S.player.recordRunId];
  return {
    access: S.player.blocked ? { status: 'blocked', message: null } : !S.gameOn ? { status: 'game_off', message: null } : { status: 'ok', message: null },
    firstVisit: !S.player.onboarded, quota: quota(now, part(today).playsUsed), record: S.player.record,
    bestCheckpoint: recordRun ? cpView(cpById(recordRun.highestCheckpointId)) : null, dailyReward: dailyView(), balance,
    activeRun: activeView, config: runConfig(), campaign: null,
    lastRunId: (Object.values(S.runs).filter(r => r.state === 'FINISHED').sort((a, b) => b.startedAt - a.startedAt)[0] || {}).runId || null, serverTime: iso(now),
  };
}

// ------------------------------------------------------------------------------------------------ HTTP surface (PlayerApi)
const snakeKey = k => k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const snake = v => (Array.isArray(v) ? v.map(snake) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [snakeKey(k), snake(x)])) : v);
const ROUTES = [
  ['GET', /^\/bootstrap$/, (m, c) => bootstrap(c.device)],
  ['POST', /^\/runs$/, (m, c) => start(c.device)],
  ['GET', /^\/runs\/([a-z0-9]+)$/, (m, c) => runView(lockForCommand(m[1]), c.device)],
  ['POST', /^\/runs\/([a-z0-9]+)\/reveal$/, (m, c) => reveal(m[1], c.device)],
  ['POST', /^\/questions\/([a-z0-9]+)\/answer$/, (m, c) => answer(m[1], c.body.choice, c.device, c.receivedAt)],
  ['POST', /^\/runs\/([a-z0-9]+)\/offer$/, (m, c) => activateOffer(m[1], c.device)],
  ['POST', /^\/offers\/([a-z0-9]+)\/continue$/, (m, c) => continueOffer(m[1], c.device, c.receivedAt)],
  ['POST', /^\/offers\/([a-z0-9]+)\/skip$/, (m, c) => skip(m[1], c.device)],
  ['POST', /^\/runs\/([a-z0-9]+)\/leave$/, (m, c) => leave(m[1], c.device)],
  ['GET', /^\/operations\/([a-z0-9]+)$/, (m, c) => operation(m[1], c.device)],
  ['GET', /^\/runs\/([a-z0-9]+)\/result$/, (m, c) => result(m[1], c.device)],
  ['GET', /^\/runs\/([a-z0-9]+)\/products$/, (m, c) => productsView(m[1], c.device)],
  ['GET', /^\/runs\/([a-z0-9]+)\/share$/, (m, c) => share(m[1], c.device)],
  ['POST', /^\/player\/onboarding$/, () => { S.player.onboarded = true; return { ok: true }; }],
  ['GET', /^\/player\/daily-reward$/, () => dailyView()],
  ['POST', /^\/player\/daily-reward\/claim$/, () => claimDaily()],
];
const json = (status, body, extra) => ({ status, text: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...extra } });

/** One request, handled at its arrival instant. Successful POST responses are kept per Idempotency-Key and replayed. */
function handle(method, path, headers, bodyText) {
  clockNow = Date.now();
  try {
    if (!/^Bearer \S+/.test(headers.get('Authorization') || '')) throw new Fail(401, 'UNAUTHENTICATED');
    const device = headers.get('X-Device-Id') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(device)) throw invalid('X-Device-Id must be a UUID', { 'x-device-id': 'uuid' });
    const route = ROUTES.find(([m, re]) => m === method && re.test(path));
    if (!route) throw notFound();
    let body = {};
    if (method === 'POST') {
      try { body = bodyText ? JSON.parse(bodyText) : {}; } catch (e) { throw invalid('malformed JSON', {}); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('body must be a JSON object', {});
      const allowed = path.endsWith('/answer') ? ['choice'] : [];
      const extra = Object.keys(body).find(k => !allowed.includes(k));
      if (extra) throw invalid('unknown field', { [extra]: 'not allowed' });
      const key = headers.get('Idempotency-Key');
      if (!key) throw invalid('Idempotency-Key is required', { 'idempotency-key': 'required' });
      const stored = S.idem[key], sig = method + ' ' + path + ' ' + JSON.stringify(body);
      if (stored) {
        if (stored.sig !== sig) throw new Fail(422, 'IDEMPOTENCY_MISMATCH');   // one key = one operation; nothing is created
        return json(stored.status, stored.body, { 'Idempotent-Replay': 'true' });
      }
      const out = runRoute(route, path, { device, body, receivedAt: clockNow });
      S.idem[key] = { sig, status: out.status, body: out.body, at: clockNow };
      return json(out.status, out.body);
    }
    const out = runRoute(route, path, { device, body, receivedAt: clockNow });
    return json(out.status, out.body);
  } catch (e) {
    if (!(e instanceof Fail)) { console.error('[play demo server]', e); return json(500, { code: 'INTERNAL', message: 'demo server error' }); }
    return json(e.status, { code: e.code, message: e.text || e.code.toLowerCase().replace(/_/g, ' '), ...snake(e.details) });
  } finally { prune(); save(); }
}
function runRoute([, re, fn], path, ctx) {
  const r = fn(path.match(re), ctx);
  return r && r.status && r.body ? { status: r.status, body: snake(r.body) } : { status: 200, body: snake(r) };
}

// ------------------------------------------------------------------------------------------------ worker (Workers: deadline sweep + coin operations)
function tick() {
  clockNow = Date.now();
  let changed = false;
  for (const run of Object.values(S.runs)) if (run.state !== 'FINISHED' && run.nextDeadlineAt != null && run.nextDeadlineAt <= clockNow) changed = applyDue(run) || changed;
  for (const op of Object.values(S.ops)) {
    if ((op.status === 'PENDING' || op.status === 'UNKNOWN') && op.nextAttemptAt != null && op.nextAttemptAt <= clockNow) { processOp(op.operationId); changed = true; }
  }
  if (changed) save();
}

// ------------------------------------------------------------------------------------------------ network stand-in + reviewer controls
export const net = { latencyMs: 200, offline: false };
const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
});

/** Answers the player's API calls in this page. The request travels half the latency, is handled on arrival, and the response travels back. */
export function install() {
  load();
  dropRunsWithUnknownProducts();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(API_ORIGIN + PREFIX)) return realFetch(input, init);
    const signal = init.signal;
    if (net.offline) { await wait(30, signal); throw new TypeError('Failed to fetch'); }
    await wait(net.latencyMs / 2, signal);               // aborted here: the request never arrived
    const res = handle((init.method || 'GET').toUpperCase(), url.slice((API_ORIGIN + PREFIX).length).split('?')[0], new Headers(init.headers), init.body);
    await wait(net.latencyMs / 2, signal);               // aborted here: committed, but the response was lost
    return new Response(res.text, { status: res.status, headers: res.headers });
  };
  setInterval(tick, 500);
}

/** Reviewer controls (?review): the in-page equivalents of the development backend's /dev/v1 fixtures. */
export const reviewer = {
  balance: () => S.wallet.balance,
  setBalance(v) { S.wallet.balance = Math.max(0, Math.floor(v)); save(); },
  script(stepObj) { S.wallet.script.push(stepObj); save(); },
  resetOnboarding() { S.player.onboarded = false; save(); },
  seedAttended(n) {   // the n days before today were attended; yesterday's daily reward is waiting for its claim
    clockNow = Date.now();
    const today = dateOf(clockNow);
    for (let i = 1; i <= n; i++) { const p = part(addDays(today, -i)); p.playsUsed = Math.max(1, p.playsUsed); p.finishedRuns = Math.max(1, p.finishedRuns); p.streakEligible = true; }
    const y = addDays(today, -1);
    if (n > 0 && !streakRewardOf(y)) {
      const op = { operationId: newId(), runId: null, offerId: null, type: 'STREAK_REWARD', amount: CFG.streakReward, heldAmount: 0, status: 'CLAIMABLE', capDay: y,
        createdAt: clockNow, claimedAt: null, nextAttemptAt: null, giveUpAt: clockNow + GIVE_UP, attempts: 0, relatedOperationId: null };
      S.ops[op.operationId] = op;
    }
    save();
  },
  resetPlays() { clockNow = Date.now(); part(dateOf(clockNow)).playsUsed = 0; save(); },
  resetAll() { S = fresh(); save(); },
};
