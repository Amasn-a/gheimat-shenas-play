# قیمت‌شناس — Play redesign

This is the isolated `gheimat-shenas-play` demo. Changes in this repository must **never** be synced back to `gheimat-shenas`.

The Play browser server uses simulated coins, local demo data and 989 public sample products. It does not connect to a real wallet.

2026-10-24: responsive desktop arena and compact mobile layouts, complete product titles and contained images, official DigiCoin artwork, named badge ribbons, empty record state, five-stage controllable tutorial, share-card preview and PNG export, vivid visual identity, keyboard modal trap, immediate font fallback. Continue decisions are untimed in this demo; admitted payments retain their finite 60-second reconciliation deadline. Question timing is unchanged at 10 seconds visible / 12.5 seconds receipt cutoff.

Official coin source: https://www.digikala.com/statics/img/svg/superapp/supercoin/hub/coin.svg
Game logo and home art were generated specifically for this Play redesign using built-in ImageGen. Prompts are recorded in `DESIGN-NOTES.md`.

Run any static web server from the repository root. `?review` exposes the existing simulated network/wallet controls. No build or dependency installation is needed.

The old sync helper is disabled by default to protect the Play redesign. Do not copy Play changes into the main game.

Publication notes (2026-10-24): checkpoint and result copy is factual («{title} رو گرفتی!», «این دست {score} جواب درست دادی»); no player-percentile claims are shown. Escape dismisses the exit sheet, daily reward and share preview (never a checkpoint or a payment) and focus returns to the opener. A product photo that fails becomes a neutral tile while the full title, price and controls stay. The QA harness pages (`scripts/qa-*.html`) are kept out of this repository because GitHub Pages serves its root; they are in the handoff package. Product photos remain remote: slow or failed photos do not change question timing, which still needs a server-coordinated readiness policy for production.
