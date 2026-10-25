// Exact text is painted with the local font; shared cards never depend on catalog images or cross-origin canvas data.
import { fa } from './fmt.js';
import { BADGES, BADGE_SRC, TIER } from './views.js';
export const GAME_URL = 'https://amasn-a.github.io/gheimat-shenas-play/';
const load = src => new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
const rounded = (c,x,y,w,h,r,fill)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
export async function createShareCard({score,title,badgeAssetId}) {
  await Promise.race([document.fonts?.ready || Promise.resolve(),new Promise(r=>setTimeout(r,1500))]);
  const tier = title ? BADGES.indexOf(badgeAssetId) : -1;   // same-origin badge art only: the canvas never becomes tainted
  const [logo,hero,qr,mark] = await Promise.all([load('assets/game-logo.webp'),load('assets/home-hero.webp'),load('assets/share-qr.png').catch(()=>null),tier >= 0 ? load(BADGE_SRC(badgeAssetId)).catch(()=>null) : null]);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const c=canvas.getContext('2d');
  rounded(c,0,0,1080,1350,0,'#fff9f0');
  rounded(c,40,40,1000,1270,50,'#15162c');
  c.fillStyle='#4055ed';c.beginPath();c.arc(1050,500,330,0,Math.PI*2);c.fill();
  c.fillStyle='#f52b4d';c.beginPath();c.arc(-120,920,310,0,Math.PI*2);c.fill();
  c.drawImage(logo,860,80,90,128);
  c.direction='rtl';c.textAlign='right';c.fillStyle='#ffffff';c.font='800 62px Digikala';c.fillText('قیمت‌شناس',820,165);
  c.font='500 30px Digikala';c.fillStyle='#cdd2f4';c.fillText('گرون‌تره یا ارزون‌تر؟',820,219);
  c.drawImage(hero,180,260,720,480);
  // the run's own result (not the all-time record): the same meaning as the button and the preview title
  const earned = tier >= 0, sx = earned ? 380 : 540;
  rounded(c,110,704,earned?510:860,earned?376:330,32,'#fffdf9');
  c.textAlign='center';c.fillStyle='#565a70';c.font='600 32px Digikala';c.fillText('نتیجهٔ این دست',sx,768);
  c.fillStyle='#15162c';c.font='800 142px Digikala';c.fillText(fa(score),sx,912);
  c.font='700 30px Digikala';c.fillText('جواب درست دادم',sx,975);
  if(earned){   // the badge card: emblem above, the real title below, inside one frame (as in the game)
    const [accent,tint]=TIER[Math.min(TIER.length-1,tier)];
    rounded(c,640,704,330,376,32,tint);c.lineWidth=3;c.strokeStyle=accent;c.beginPath();c.roundRect(641.5,705.5,327,373,31);c.stroke();
    if(mark)c.drawImage(mark,705,722,200,200);
    rounded(c,662,944,286,112,22,'#ffffff');c.fillStyle='#15162c';let fs=32;do{c.font=`800 ${fs}px Digikala`;}while(c.measureText(title).width>254&&--fs>18);c.fillText(title,805,1012);
  }else if(!title){c.fillStyle='#cdd2f4';c.font='600 30px Digikala';c.fillText('تو چند تا قیمت رو درست حدس می‌زنی؟',540,1090);}
  else{rounded(c,260,1059,560,65,20,'#4055ed');c.fillStyle='#fff';c.font='800 31px Digikala';c.fillText(title,540,1103);}
  // shortcut: share-qr.png is a pre-made QR of GAME_URL; regenerate it if GAME_URL changes (the Super App build will use its own link)
  const tx=qr?970:540;if(qr){rounded(c,100,1110,189,189,20,'#ffffff');c.imageSmoothingEnabled=false;c.drawImage(qr,112,1122,165,165);c.imageSmoothingEnabled=true;c.textAlign='right';}
  c.fillStyle='#fff';c.font='700 38px Digikala';c.fillText('نوبت توئه؛ بازی کن!',tx,1196);
  c.direction='ltr';c.font='700 29px Digikala';c.fillStyle='#cdd2f4';c.fillText(GAME_URL.replace(/^https?:\/\//,'').replace(/\/$/,''),tx,1250);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
}
