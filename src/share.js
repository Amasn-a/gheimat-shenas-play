// Exact text is painted with the local font; shared cards never depend on catalog images or cross-origin canvas data.
import { fa } from './fmt.js';
export const GAME_URL = 'https://amasn-a.github.io/gheimat-shenas-play/';
const load = src => new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
const rounded = (c,x,y,w,h,r,fill)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
export async function createShareCard({score,title,badgeAssetId}) {
  await Promise.race([document.fonts?.ready || Promise.resolve(),new Promise(r=>setTimeout(r,1500))]);
  const [logo,hero] = await Promise.all([load('assets/game-logo.webp'),load('assets/home-hero.webp')]);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const c=canvas.getContext('2d');
  rounded(c,0,0,1080,1350,0,'#fff9f0');
  rounded(c,40,40,1000,1270,50,'#15162c');
  c.fillStyle='#4055ed';c.beginPath();c.arc(1050,500,330,0,Math.PI*2);c.fill();
  c.fillStyle='#f52b4d';c.beginPath();c.arc(-120,920,310,0,Math.PI*2);c.fill();
  c.drawImage(logo,860,80,90,128);
  c.direction='rtl';c.textAlign='right';c.fillStyle='#ffffff';c.font='800 62px Digikala,Tahoma';c.fillText('قیمت‌شناس',820,165);
  c.font='500 30px Digikala,Tahoma';c.fillStyle='#cdd2f4';c.fillText('گرون‌تره یا ارزون‌تر؟',820,219);
  c.drawImage(hero,180,260,720,480);
  rounded(c,110,704,860,330,32,'#fffdf9');
  c.textAlign='center';c.fillStyle='#565a70';c.font='600 32px Digikala,Tahoma';c.fillText('رکورد من',540,768);
  c.fillStyle='#15162c';c.font='800 142px Digikala,Tahoma';c.fillText(fa(score),540,912);
  c.font='700 30px Digikala,Tahoma';c.fillText('جواب درست در یک دست',540,975);
  if(title){
    rounded(c,260,1059,560,65,20,'#4055ed');c.fillStyle='#fff';c.font='800 31px Digikala,Tahoma';c.fillText(title,540,1103);
  }else{c.fillStyle='#cdd2f4';c.font='600 30px Digikala,Tahoma';c.fillText('تو چند تا قیمت رو درست حدس می‌زنی؟',540,1103);}
  c.fillStyle='#fff';c.font='700 34px Digikala,Tahoma';c.fillText('نوبت توئه؛ بازی کن!',540,1190);
  c.direction='ltr';c.font='500 23px Arial';c.fillStyle='#cdd2f4';c.fillText(GAME_URL,540,1242);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
}
