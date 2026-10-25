// Entry (owner 2026-10-25): the site first asks which design to open — «دیزاین ۱» (the blue game) or «دیزاین ۲» (the light
// variant). The choice is carried in the URL (?ui=1 / ?ui=2), so a reload stays in the chosen design; the plain URL asks again.
const ui = new URLSearchParams(location.search).get('ui');
if (ui === '1' || ui === '2' || ui === 'light') {
  await import('./boot.js');
} else {
  const app = document.getElementById('app');
  app.className = 'pick'; document.documentElement.classList.add('picking');
  const go = n => { const q = new URLSearchParams(location.search); q.set('ui', n); location.replace(location.pathname + '?' + q.toString()); };
  app.innerHTML = `<main class="pick__in"><img class="pick__logo" src="assets/splash/splash-logo.webp" width="1536" height="1024" alt="قیمت‌شناس">
    <h1>کدوم دیزاین رو ببینیم؟</h1>
    <div class="pick__opts">
      <button data-ui="1"><img src="assets/choose/design-1.webp" width="260" height="563" alt=""><b>دیزاین ۱</b><small>نسخه‌ی آبی</small></button>
      <button data-ui="2"><img src="assets/choose/design-2.webp" width="260" height="563" alt=""><b>دیزاین ۲</b><small>نسخه‌ی روشن</small></button>
    </div></main>`;
  app.querySelectorAll('[data-ui]').forEach(b => b.addEventListener('click', () => go(b.dataset.ui)));
}
