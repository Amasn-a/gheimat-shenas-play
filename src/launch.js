// Launch splash (approved kit, 2026-10-25): shown on every page boot, never between questions or on internal navigation.
// Imported first by play/boot.js so it mounts before anything else; main.js reuses the same instance (one module = one splash).
import { createPriceShenasSplash } from './splash.js';

export const splash = createPriceShenasSplash({
  backgroundUrl: new URL('../assets/splash/splash-background.webp', import.meta.url).href,   // relative to this module: works under /gheimat-shenas-play/
  logoUrl: new URL('../assets/splash/splash-logo.webp', import.meta.url).href,
  minVisibleMs: 2000,
});

export const BOOT_ERROR = 'بارگذاری انجام نشد. دوباره تلاش کن.';

/** Resolves with the next boot outcome game.js reports on #app (true = a real screen is showing). */
export const nextBoot = app => new Promise(res => app.addEventListener('qs:boot', e => res(e.detail.ok), { once: true }));

/** Waits for the artwork and the real boot; dismisses only on success. Retry re-runs the game's own boot (reads state, never starts a run or charges). */
export async function gate(app, firstBoot, boot) {
  const ok = await Promise.all([splash.ready, firstBoot]).then(([, ok]) => ok, () => null);
  if (ok === null) return;                       // artwork failed: splash.js already shows its reload error
  if (ok) return splash.complete();
  const retry = async () => { const next = nextBoot(app); boot(); if (!(await next)) throw new Error('boot'); splash.complete(); };
  splash.showError(BOOT_ERROR, retry);
}
