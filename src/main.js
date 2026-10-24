// Play starts immediately. Self-hosted font loading must never block the game indefinitely.
import { init } from './game.js';
document.documentElement.setAttribute('data-theme','light');
document.documentElement.classList.add('fonts-ready');
init(document.getElementById('app'));
if (document.fonts) document.fonts.load('700 16px Digikala').catch(()=>{});
