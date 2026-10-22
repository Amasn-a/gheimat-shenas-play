# Play-only review redesign (2026-10-22)

This branch of `gheimat-shenas-play` carries the handoff redesign (warm ivory / coral / ink, `SPEC.fa.md`, reference
snapshot `78d03b6`) for review. **`gheimat-shenas` is not changed and must not be synced from here.** The
`sync-from-gheimat-shenas.sh` script refuses to run while this redesign is present (`FORCE_OVERWRITE_REDESIGN=1` discards it).

## Review

- Open the Pages site (or `python3 -m http.server` in the repo root, then `http://localhost:8000/`).
- Add `?review` for the reviewer panel. In addition to the simulated wallet, network and account controls, it now has
  preview-only shortcuts: set the record, answer the open question right or wrong, and keep answering right. They act on
  the in-browser play server only. The game never calls them.
- The handoff state id of the current screen is shown in the panel and is set on `#app[data-rd]`.

## Files

| File | Role |
| --- | --- |
| `src/redesign.js` | Markup for every post-onboarding screen, with icons and the editable badge SVG (unique gradient ids) ported from `reference-ui` |
| `styles/redesign.css` | Reference CSS scoped under `.rd`, plus play additions for safe areas, short screens, contrast and constant geometry |
| `src/game.js` | Screen layer rewired to `redesign.js`; deferred offer activation; daily full page; record celebration; exit sheet; offline page; resume on reload |
| `assets/price-tags.webp` | Home artwork from the handoff |
| `play/server.js`, `play/boot.js` | Preview-only reviewer shortcuts (`setRecord`, `correctChoice`) |
| `tests/play_redesign_test.py` | 17 behaviour scenarios that run against the play server |
| `tests/screens.py` | State screenshots at 360×640, 390×844 and 430×932 |

Onboarding (`views.js`, `game.css`, `q-*`) is untouched. It keeps its own visuals, flags and eligibility.

## State map (handoff id → play state)

| Handoff id | Controller state |
| --- | --- |
| splash, error | `G00.SPLASH`, `G00.ERROR` (also `G11.SERVICE_ERROR`) |
| home, home-new, home-zero | `G01.*`. Home-new is shown when there is no record and no last run. Home-zero covers `QUOTA_EXHAUSTED` and `QUOTA_CHECKING` |
| daily | `G01.*` with the daily page open. It opens automatically once per session; closing it claims nothing |
| help | `G02.GUIDE` |
| ready, image-loading, image-error | `G03.READY` and `G06.SUCCESS`; `G03.PREPARING` (the reveal request is in flight); `G03.PREPARE_FAILED` |
| active, urgent, checking | `G03.QUESTION_ACTIVE` (urgent covers the last 3 s); `G03.ANSWER_PENDING` and `TIME_UP_PENDING` |
| correct, wrong, timeout | `G03.CORRECT_FEEDBACK`, `G03.WRONG_FEEDBACK`, `G03.TIMEOUT`. The link and the hold share one consumable path |
| checkpoint-5…20, record | Celebration host, mounted once per (run, checkpoint) and once per run for the record |
| result, result-timeout, result-no-badge | `G05.ELIGIBLE` and `G05.OFFER`. Reason, tier, eligibility and transaction status are independent inputs |
| insufficient | `G05.ELIGIBLE` with a balance below the cost, or `G05.NO_FUNDS` |
| payment-pending | `G05.LOADING`, `G06.PENDING`, `G06.UNKNOWN` (shows the unknown copy and «بررسی دوباره») |
| payment-failed | `G06.FAILED_RETRY` (confirmed failure with no charge) |
| result-final | `G05.LOSS`, `G06.FAILED_END`, `G06.REFUNDED`, `G06.FAILED_END.UNCONFIRMED`, each with its own alert |
| exit | The exit sheet over the screen it was opened from. The question keeps running underneath |
| offline, reconnecting | Offline between questions (ready-like states); `G10.RESUMING` and reconnect |

## Backend dependencies (not faked in the client)

1. **Question readiness.** The service releases the question on `reveal` (t0 = now), and the photo loads after t0.
   "Time has not started while the image loads" therefore holds only while the reveal request is in flight. A bounded,
   server-controlled readiness step is needed before the decision window starts.
2. **Image-failure replacement without penalty.** There is no service operation for this. The play version shows an
   honest «دوباره امتحان کن», which repeats the same reveal key and returns the same question.
3. **Frozen record target.** `RunView` has no `best_score_at_start`. The client freezes the bootstrap record at run start
   and on resume, and progress after 20 uses it. The record reward itself comes from the server (`recordReward`).
4. **No timed continuation decision.** The client activates the offer only when the player taps the button, then buys
   at once. Two server rules still apply:
   - The 180 s `offerActivationMs` ends an unactivated miss.
   - A retry after a confirmed failed charge must happen before the offer deadline (10 s / 15 s). After that the run
     ends with the failure alert.
5. **Comparison percentages** (50/70/90/99) are inherited copy and need an approved factual basis before release.
6. **Official DigiCoin logo** was not supplied. Amounts are labelled with the text «دیجی‌کوین».
7. **Exit during checking** is still blocked (back is disabled while an answer is in flight), as in the main game.
