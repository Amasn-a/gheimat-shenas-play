/** Visible foreground time, independently testable without a browser. */
export class SplashTiming {
  constructor(minimum=2000) {
    this.minimum=Math.max(2000,Number(minimum)||2000);
    this.elapsed=0; this.previous=null; this.appReady=false;
    this.failed=false; this.progress=0; this.measured=null;
  }
  pause(){ this.previous=null; }
  setProgress(p){if(Number.isFinite(p))this.measured=Math.max(this.measured||0,Math.max(0,Math.min(100,p))/100);}
  markReady(){this.appReady=true;}
  tick(now,visible=true,painted=true){
    if(!visible||!painted||this.failed){this.pause();return;}
    if(this.previous!==null)this.elapsed+=Math.max(0,now-this.previous);
    this.previous=now;
    const t=Math.min(1,this.elapsed/this.minimum);
    const cap=this.measured===null?.9:this.measured*.9;
    this.progress=Math.max(this.progress,this.appReady?t:Math.min(t*.9,cap));
  }
  get canLeave(){return this.appReady&&!this.failed&&this.elapsed>=this.minimum;}
}
