import {SplashTiming} from './splash-timing.mjs';
/** UI only. Does not start a paid game, fetch questions or change game rules. */
export function createPriceShenasSplash({mount=document.body,backgroundUrl,logoUrl,minVisibleMs=2000}={}){
  if(!backgroundUrl||!logoUrl)throw new Error('Provide backgroundUrl and logoUrl.');
  const root=document.createElement('section');
  root.className='ps-splash';root.lang='fa';root.dir='rtl';
  root.setAttribute('aria-label','بارگذاری بازی قیمت شناس');root.setAttribute('aria-busy','true');
  root.innerHTML=`
  <img class="ps-splash__background" alt="" decoding="async" fetchpriority="high">
  <div class="ps-splash__safe"><div class="ps-splash__stage">
    <img class="ps-splash__logo" alt="قیمت شناس" decoding="async" fetchpriority="high">
    <div class="ps-splash__loader">
      <div class="ps-splash__track" role="progressbar" aria-label="آماده‌سازی بازی" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="ps-splash__well"><div class="ps-splash__fill"></div></div>
      </div>
      <p class="ps-splash__label" role="status" aria-live="polite">در حال بارگذاری…</p>
      <div class="ps-splash__actions" hidden><button class="ps-splash__retry" type="button">تلاش دوباره</button></div>
    </div>
  </div></div>`;
  const find=n=>root.querySelector('.ps-splash__'+n);
  const safe=find('safe'),stage=find('stage'),track=find('track'),label=find('label'),actions=find('actions'),retry=find('retry');
  let timing=new SplashTiming(minVisibleMs),removed=false,painted=false,frame=0;
  let finishing=false,finishPromise=null,resolveFinish=null,retryCallback=null;
  let lastFrame=null,hold=0,holding=false,closingAt=null;
  mount.append(root);
  function fit(){
    const b=safe.getBoundingClientRect(),w=Math.min(b.width,b.height*9/16);
    stage.style.width=w+'px';stage.style.height=(w*16/9)+'px';
    root.style.setProperty('--ps-stage-width',w+'px');
  }
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(fit):null;
  observer?.observe(safe);window.addEventListener('resize',fit);fit();
  function visibility(){timing.pause();lastFrame=null;}
  document.addEventListener('visibilitychange',visibility);
  function destroy(){
    if(removed)return;removed=true;cancelAnimationFrame(frame);
    observer?.disconnect();window.removeEventListener('resize',fit);
    document.removeEventListener('visibilitychange',visibility);
    retry.removeEventListener('click',onRetry);root.remove();resolveFinish?.();
  }
  function loop(now){
    if(removed)return;
    const visible=document.visibilityState==='visible';
    timing.tick(now,visible,painted);
    root.style.setProperty('--ps-progress',String(timing.progress));
    track.setAttribute('aria-valuenow',String(Math.round(timing.progress*100)));
    if(visible&&painted&&!timing.failed){
      const delta=lastFrame===null?0:Math.max(0,now-lastFrame);
      if(timing.canLeave&&!finishing){
        if(!holding){holding=true;hold=0;}else hold+=delta;
        // Allow the final CSS fill to visibly reach 100 before the fade.
        if(hold>=240){finishing=true;root.setAttribute('aria-busy','false');root.classList.add('ps-splash--closing');closingAt=now;}
      }
      if(finishing&&now-closingAt>=180){destroy();return;}
      lastFrame=now;
    }else lastFrame=null;
    frame=requestAnimationFrame(loop);
  }
  frame=requestAnimationFrame(loop);
  const ready=Promise.all([loadImage(find('background'),backgroundUrl),loadImage(find('logo'),logoUrl)])
    .then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!removed){painted=true;timing.pause();}resolve();
    }))));
  ready.catch(()=>showError('تصویر بازی بارگذاری نشد. دوباره تلاش کن.',()=>location.reload()));
  function showError(message='بارگذاری انجام نشد. دوباره تلاش کن.',callback){
    if(removed)return;timing.failed=true;timing.pause();
    root.dataset.error='true';root.setAttribute('aria-busy','false');
    label.textContent=message;retryCallback=typeof callback==='function'?callback:null;
    actions.hidden=!retryCallback;
  }
  function showLoading(){
    if(removed)return;
    timing=new SplashTiming(minVisibleMs);lastFrame=null;holding=false;hold=0;
    delete root.dataset.error;root.setAttribute('aria-busy','true');
    label.textContent='در حال بارگذاری…';actions.hidden=true;
  }
  function onRetry(){
    const cb=retryCallback;if(!cb)return;showLoading();
    Promise.resolve().then(cb).catch(()=>showError(undefined,cb));
  }
  retry.addEventListener('click',onRetry);
  function complete(){
    if(removed)return Promise.resolve();
    if(!finishPromise)finishPromise=new Promise(resolve=>{resolveFinish=resolve;});
    timing.markReady();return finishPromise;
  }
  return {element:root,ready,setProgress:p=>timing.setProgress(p),showLoading,showError,complete,destroy};
}
function loadImage(image,url){
  return new Promise((resolve,reject)=>{
    const fail=()=>{const e=new Error('Splash artwork failed');e.code='SPLASH_ARTWORK';reject(e);};
    image.onload=async()=>{try{if(image.decode)await image.decode();resolve();}catch{fail();}};
    image.onerror=fail;image.src=url;
  });
}
