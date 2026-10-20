# قیمت‌شناس · Play

**بازی کن:** https://amasn-a.github.io/gheimat-shenas-play/

بازی «گرون‌تره یا ارزون‌تر» دیجی‌کالا، نسخهٔ نمایشی. همه‌چیز در مرورگر اجرا می‌شود: سرور، پایگاه داده و حساب کاربری ندارد. کالاها، عکس‌ها و کمترین قیمت‌ها از دیجی‌کالا برداشته شده‌اند (۲۲ مهر ۱۴۰۵). کیف پول دیجی‌کوین شبیه‌سازی‌شده است و هیچ پرداخت یا جایزهٔ واقعی‌ای انجام نمی‌شود.

---

Browser-only demo of the Digikala higher-or-lower price game. It needs no backend, database or login: one `index.html` plus product photos in `img/`. Server responses and the DigiCoin wallet are simulated in the page.

- **Play:** https://amasn-a.github.io/gheimat-shenas-play/
- **Reviewer controls** (jump to any screen, force outcomes): add `?review` to the address, for example `https://amasn-a.github.io/gheimat-shenas-play/?review`.
- **Run locally:** open `index.html` in a browser, or serve the folder with any static server.
- **Publishing:** GitHub Pages from the `main` branch, repository root. `.nojekyll` makes Pages serve the files as they are.

The production implementation (backend, admin, tests) lives in a separate private repository.
