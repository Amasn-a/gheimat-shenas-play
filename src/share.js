// Exact text is painted with the local font; shared cards never depend on catalog images or cross-origin canvas data.
import { fa } from './fmt.js';
import { BADGES, BADGE_SRC } from './views.js';
export const GAME_URL = 'https://amasn-a.github.io/gheimat-shenas-play/';
const load = src => new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
const rounded = (c,x,y,w,h,r,fill)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
export async function createShareCard({score,title,badgeAssetId}) {
  await Promise.race([document.fonts?.ready || Promise.resolve(),new Promise(r=>setTimeout(r,1500))]);
  const tier = title ? BADGES.indexOf(badgeAssetId) : -1;   // same-origin badge art only: the canvas never becomes tainted
  // v4 (owner 2026-10-25 evening): the splash world and the approved splash logo, the score as the hero, the badge beside it
  const [bg,logo,qr,mark] = await Promise.all([load('assets/splash/splash-background.webp').catch(()=>null),load('assets/splash/splash-logo.webp'),
    load('assets/share-qr.png').catch(()=>null),tier >= 0 ? load(BADGE_SRC(badgeAssetId)).catch(()=>null) : null]);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const c=canvas.getContext('2d');
  rounded(c,0,0,1080,1350,0,'#0B1F5E');
  if(bg){const k=Math.max(1080/bg.width,1350/bg.height);c.drawImage(bg,(1080-bg.width*k)/2,(1350-bg.height*k)/2,bg.width*k,bg.height*k);}
  const veil=c.createLinearGradient(0,0,0,1350);veil.addColorStop(0,'rgba(11,31,94,.15)');veil.addColorStop(.45,'rgba(11,31,94,.55)');veil.addColorStop(1,'rgba(11,31,94,.92)');
  c.fillStyle=veil;c.fillRect(0,0,1080,1350);
  c.drawImage(logo,255,36,570,380);
  c.direction='rtl';c.textAlign='center';
  const earned = tier >= 0, sx = earned ? 735 : 540;
  rounded(c,70,450,940,470,48,'#10297A');
  c.fillStyle='#D6ECFF';c.font='700 36px Digikala';c.fillText('نتیجه‌ی این دست',sx,548);
  c.fillStyle='#FAC602';c.font='900 210px Digikala';c.fillText(fa(score),sx,770);
  c.fillStyle='#fff';c.font='800 40px Digikala';c.fillText('جواب درست دادم',sx,850);
  if(earned){
    if(mark)c.drawImage(mark,95,485,400,400);
    else{let fs=48;do{c.font=`900 ${fs}px Digikala`;}while(c.measureText(title).width>360&&--fs>18);c.fillText(title,295,700);}
  }
  rounded(c,70,950,940,330,48,'#ffffff');
  const tx = qr ? 675 : 540;
  if(qr){c.imageSmoothingEnabled=false;c.drawImage(qr,110,990,250,250);c.imageSmoothingEnabled=true;}
  c.fillStyle='#15162c';c.font='900 42px Digikala';c.fillText('تو چند تا رو درست حدس می‌زنی؟',tx,1062);
  c.fillStyle='#EF4056';c.font='900 40px Digikala';c.fillText('همین الان بازی کن!',tx,1134);
  // shortcut: share-qr.png is a pre-made QR of GAME_URL; regenerate it if GAME_URL changes (the Super App build will use its own link)
  c.direction='ltr';c.font='700 28px Digikala';c.fillStyle='#565a70';c.fillText(GAME_URL.replace(/^https?:\/\//,'').replace(/\/$/,''),tx,1208);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
}
