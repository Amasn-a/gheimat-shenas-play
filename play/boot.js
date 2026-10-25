// Play entry (GitHub Pages). This Play-only redesign intentionally diverges from gheimat-shenas (src/, styles/, fonts/). This file
// does what the Super App and the backend do in production: it configures the host adapter for a plain browser and
// answers the player's API calls with the in-browser demo server (play/server.js). Reviewer controls: add ?review.
import { configureHost } from '../src/host.js';
import { install, API_ORIGIN, setCatalog, net, reviewer } from './server.js';

const app = document.getElementById('app');
const rev = document.documentElement.dataset.source || '';

window.PE_API_BASE = API_ORIGIN;
configureHost({
  getToken: async () => 'demo',                  // demo account: no Digikala login is used or needed
  refreshToken: async () => 'demo',
  openProduct: async url => { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) { /* cross-origin */ } } return !!w; },
  share: async ({ blob, text }) => {             // the native share sheet where the browser has one, otherwise a download
    const file = new File([blob], 'qeymatshenas.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return 'sent'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; /* fallback to image download below */ }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'qeymatshenas.png' });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return 'sent';
  },
});

try {
  const res = await fetch('play/catalog.json?v=' + rev, { cache: 'no-cache' });
  if (!res.ok) throw new Error('catalog ' + res.status);
  setCatalog(await res.json());
} catch (e) {
  app.innerHTML = '<p style="color:#23252B;font:600 16px/1.8 Digikala;text-align:center;padding:40vh 24px 0">نسخهٔ نمایشی بارگذاری نشد. صفحه را دوباره باز کن.</p>';
  throw e;
}
install();

if (/[?&]review\b/.test(location.search)) {
  document.body.classList.add('pe-dev');
  const panel = document.createElement('aside');
  panel.className = 'pe-devpanel';
  panel.innerHTML = `
<header><span><b class="tag">DEMO</b> reviewer controls</span><button id="dvMin">–</button></header>
<div>state <span class="state" id="dvState">…</span></div>
<small>Static Play demo of gheimat-shenas ${rev} · in-browser server · simulated DigiCoin · data kept in this browser only</small>
<fieldset><legend>Simulated DigiCoin</legend>
  balance <input type="number" id="dvBal" min="0"> <button id="dvBalGo">set</button><br>
  next charge <select id="dvCharge"><option value="">normal</option><option value="failed">rejected</option><option value="unknown_applied">applied, response lost</option><option value="late_success">confirms late (15 s)</option><option value="unknown_not_applied">lost, not applied</option></select>
  <button id="dvChargeGo">script</button><br>
  balance read <select id="dvBalRead"><option value="">normal</option><option value="unreadable">unreadable</option></select> <button id="dvBalReadGo">script</button>
</fieldset>
<fieldset><legend>Account (this browser)</legend>
  <button id="dvOnb">reset onboarding</button> <button id="dvDaily">3 attended days + unclaimed reward</button><br>
  <button id="dvPlays">reset today's plays</button> <button id="dvReset">reset all demo data</button>
</fieldset>
<fieldset><legend>Network (simulated)</legend>
  delay <select id="dvLat"><option value="200">0.2 s</option><option value="800">0.8 s</option><option value="2500">2.5 s</option><option value="6000">6 s</option></select>
  <label><input type="checkbox" id="dvOff"> offline</label>
</fieldset>`;
  document.body.appendChild(panel);
  const $ = s => panel.querySelector(s), reload = () => location.reload();
  $('#dvBal').value = reviewer.balance();
  $('#dvMin').onclick = () => panel.classList.toggle('min');
  $('#dvBalGo').onclick = () => reviewer.setBalance(Number($('#dvBal').value));
  $('#dvChargeGo').onclick = () => { const o = $('#dvCharge').value; if (o) reviewer.script({ op: 'charge', outcome: o, late_ms: 15000 }); };
  $('#dvBalReadGo').onclick = () => { const o = $('#dvBalRead').value; if (o) reviewer.script({ op: 'balance', outcome: o }); };
  $('#dvOnb').onclick = () => { reviewer.resetOnboarding(); reload(); };
  $('#dvDaily').onclick = () => { reviewer.seedAttended(3); reload(); };
  $('#dvPlays').onclick = () => { reviewer.resetPlays(); reload(); };
  $('#dvReset').onclick = () => { reviewer.resetAll(); reload(); };
  $('#dvLat').onchange = e => { net.latencyMs = Number(e.target.value); };
  $('#dvOff').onchange = e => { net.offline = e.target.checked; window.dispatchEvent(new Event(net.offline ? 'offline' : 'online')); };
  setInterval(() => { const v = app.dataset.view; if (v) $('#dvState').textContent = v; }, 200);
}

await import('../src/main.js');
