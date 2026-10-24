import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const rows=JSON.parse(await readFile(new URL('../play/catalog.json',import.meta.url)));
const prices=new Map(rows.map(r=>[r[2],r[4]]));
let stamp=Date.parse('2026-10-24T12:00:00Z');Date.now=()=>stamp;
globalThis.window=globalThis;
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const workers=[];const originalInterval=globalThis.setInterval;globalThis.setInterval=fn=>{workers.push(fn);return 0;};
const {install,setCatalog,reviewer,net,API_ORIGIN}=await import('../play/server.js');
setCatalog(rows);install();globalThis.setInterval=originalInterval;net.latencyMs=0;
const device=crypto.randomUUID();
async function req(path,method='GET',body={},key=crypto.randomUUID()){
 const r=await fetch(API_ORIGIN+'/v1/gamification/price-expert'+path,{method,headers:{Authorization:'Bearer demo','X-Device-Id':device,'Idempotency-Key':key},body:method==='POST'?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,JSON.stringify({path,status:r.status,data}));return data;
}
const reset=()=>{reviewer.resetAll();reviewer.resetPlays();stamp+=1000;};
const start=async()=> (await req('/runs','POST')).run;
async function question(run,correct=true){
 const qrun=await req('/runs/'+run.run_id+'/reveal','POST');
 const q=qrun.question,price=prices.get(q.product.display_title),ref=qrun.reference.price;
 const higher=price>=ref;let choice=(correct?higher:!higher)?'higher':'lower';
 return req('/questions/'+q.question_id+'/answer','POST',{choice});
}
reset();let run=await start();const before=reviewer.balance();
for(let i=1;i<=21;i++){const ans=await question(run);assert.equal(ans.result,'correct');assert.equal(ans.score,i);run=ans.run;}
assert.equal(reviewer.balance()-before,9,'Checkpoint rewards total 9');
let ans=await question(run,false);run=ans.run;assert.equal(ans.result,'wrong');
let offer=(await req('/runs/'+run.run_id+'/offer','POST')).offer;assert.equal(offer.deadline,null,'Decision is untimed');assert.equal(offer.accept_deadline,null);
stamp+=600000;const recovered=await req('/runs/'+run.run_id);assert.equal(recovered.state,'OFFER_OPEN','Decision survives ten minutes');
const id=crypto.randomUUID(),costBefore=reviewer.balance();let op=await req('/offers/'+offer.offer_id+'/continue','POST',{},id);
assert.equal(op.status,'succeeded');assert.equal(op.run.score,21);assert.equal(reviewer.balance(),costBefore-5);
await req('/offers/'+offer.offer_id+'/continue','POST',{},id);assert.equal(reviewer.balance(),costBefore-5,'Replayed charge never doubles');
run=op.run;ans=await question(run,false);assert.equal(ans.run.state,'FINISHED','Continue cap enforced');
const shared=await req('/runs/'+run.run_id+'/share');assert.equal(shared.deep_link,'https://amasn-a.github.io/gheimat-shenas-play/');
reset();run=await start();ans=await question(run,false);offer=(await req('/runs/'+run.run_id+'/offer','POST')).offer;
const rejectBalance=reviewer.balance();
reviewer.script({op:'charge',outcome:'failed'});op=await req('/offers/'+offer.offer_id+'/continue','POST');
assert.equal(op.status,'failed');assert.equal(op.run.state,'OFFER_OPEN');assert.equal(reviewer.balance(),rejectBalance);
stamp+=600000;op=await req('/offers/'+offer.offer_id+'/continue','POST');assert.equal(op.status,'succeeded');assert.equal(reviewer.balance(),rejectBalance-5);
reset();run=await start();ans=await question(run,false);offer=(await req('/runs/'+run.run_id+'/offer','POST')).offer;
const unknownBalance=reviewer.balance();reviewer.script({op:'charge',outcome:'unknown_applied'});
op=await req('/offers/'+offer.offer_id+'/continue','POST');assert.equal(op.status,'pending');assert.equal(reviewer.balance(),unknownBalance-5);
stamp+=2000;workers.forEach(fn=>fn());op=await req('/operations/'+op.operation_id);assert.equal(op.status,'succeeded');assert.equal(reviewer.balance(),unknownBalance-5,'Unknown charge settles without duplicate debit');
reset();reviewer.seedAttended(3);const daily=await req('/player/daily-reward');assert.equal(daily.state,'claimable');const dailyBefore=reviewer.balance(),dailyKey=crypto.randomUUID();
await req('/player/daily-reward/claim','POST',{},dailyKey);await req('/player/daily-reward/claim','POST',{},dailyKey);assert.equal(reviewer.balance(),dailyBefore+1,'Daily claim is credited once');
reset();reviewer.setBalance(0);run=await start();ans=await question(run,false);let noFunds=await req('/runs/'+run.run_id+'/offer','POST');assert.equal(noFunds.offer,null);assert.equal(noFunds.no_offer_reason,'no_funds');
reset();run=await start();let qrun=await req('/runs/'+run.run_id+'/reveal','POST');stamp+=14000;let timed=await req('/runs/'+run.run_id);assert.equal(timed.last_result.result,'timeout','Question expiry still authoritative');
console.log('PASS: 21 correct answers; 4 checkpoints +9; untimed offer survives 10min; charge -5 once; continue preserves score; cap; share URL; rejected and unknown payments; daily claim once; insufficient funds; 10s question timeout.');
