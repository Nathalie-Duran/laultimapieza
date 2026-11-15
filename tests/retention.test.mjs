import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {releaseCalendar,normalise} from '../progression.mjs';
import {validSignature,createBilling} from '../billing.mjs';
test('Los desbloqueos respetan cuatro por ciclo, acumulan pendientes y no duplican repeticiones',()=>{
 const start=Date.UTC(2026,0,1),end=Date.UTC(2026,1,1),cycles=[{id:'one',start,end}];
 assert.equal(releaseCalendar(cycles,[],start-1).released,0);
 assert.equal(releaseCalendar(cycles,[],start).available,1);
 assert.equal(releaseCalendar(cycles,['a'],start+7*86400000-1).available,0);
 assert.equal(releaseCalendar(cycles,['a'],start+7*86400000).available,1);
 assert.equal(releaseCalendar(cycles,['a','a'],start+21*86400000).available,3);
 const all=[...cycles,{id:'two',start:end,end:Date.UTC(2026,2,1)}];
 assert.equal(releaseCalendar(all,['a'],end).available,4);
 assert.equal(releaseCalendar([{...cycles[0],revoked:true}],[],end).available,0);
 assert.equal(releaseCalendar(Array.from({length:5},(_,i)=>({id:i,start:start+i*32*86400000,end:end+i*32*86400000})),[],Date.UTC(2027,0,1)).released,12);
});
test('Firmas de pago auténticas, antigüedad y comparación exacta',()=>{
 const now=1800000000000,raw='{"id":"evt_test"}',secret='test_secret',time=now/1000;
 const signature=createHmac('sha256',secret).update(time+'.'+raw).digest('hex');
 assert.equal(validSignature(raw,'t='+time+',v1='+signature,secret,now),true);
 assert.equal(validSignature(raw+' ','t='+time+',v1='+signature,secret,now),false);
 assert.equal(validSignature(raw,'t='+time+',v1='+signature,secret,now+301000),false);
 assert.equal(validSignature(raw,'t='+time+',v1=bad',secret,now),false);
 assert.equal(createBilling({}).configured,false);
 assert.equal(normalise(' Félix  |  4 '),normalise('Felix|4'));
});
test('El plano reserva sus revelaciones y el epílogo exige decisión persistida',async()=>{
 const c=vm.createContext({document:{addEventListener(){}},fetch:async()=>new Response('{}'),Response,console});c.window=c;
 for(const f of ['stories.js','season.js','experience-ui.js','investigation-ui.js','engagement-ui.js'])vm.runInContext(await readFile(new URL('../public/'+f,import.meta.url),'utf8'),c);
 const m={stories:c.STORIES,sessions:[],canPlay:false,journey:{completed:0,stops:[]}};
 assert.doesNotMatch(c.ExperienceUI.map(m),/Ella reunió los doce/);
 assert.doesNotMatch(c.ExperienceUI.map(m),/Una nota firmada por Irene/);
 m.journey.completed=6;assert.match(c.ExperienceUI.map(m),/Una nota firmada por Irene/);
 m.journey.completed=12;m.journey.solvedAt='now';assert.match(c.ExperienceUI.map(m),/data-action="season-ending"/);
 m.journey.ending='share';assert.match(c.ExperienceUI.map(m),/El archivo vuelve a tener visitantes/);assert.doesNotMatch(c.ExperienceUI.map(m),/data-action="season-ending"/);
 for(const story of c.STORIES.filter(s=>s.season===1))assert.match(c.InvestigationUI.render({caseId:story.id,status:'finished'},story.puzzle),/id="puzzle-form"/);
});
test('La integración de pago verifica factura y termina la temporada con un calendario de tres meses',async()=>{
 const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fake',STRIPE_WEBHOOK_SECRET:'whsec_fake',STRIPE_PRICE_ID:'price_test',STRIPE_PORTAL_CONFIGURATION:'pc_test',BILLING_TERMS_URL:'https://example.test/terms',BILLING_PRIVACY_URL:'https://example.test/privacy'};
 let state={customer:'cus_test'},scheduleSet;
 const store={async getMemberData(){return structuredClone(state);},async saveMemberData(uid,data){state=structuredClone(data);}};
 const start=Math.floor(Date.now()/1000)-5;
 const billing=createBilling(env,async(url,options)=>{
  const route=new URL(url).pathname;
  if(route==='/v1/subscriptions')return Response.json({data:[{id:'sub_test',customer:'cus_test',metadata:{lup_uid:'alice'},status:'active',items:{data:[{price:{id:'price_test'}}]}}]});
  if(route==='/v1/invoices')return Response.json({data:[{id:'in_test',currency:'eur',amount_paid:2995,billing_reason:'subscription_create',lines:{data:[{pricing:{price_details:{price:'price_test'}},period:{start,end:start+30*86400}}]}}]});
  if(route==='/v1/subscription_schedules')return Response.json({id:'sched_test',current_phase:{start_date:start}});
  if(route==='/v1/subscription_schedules/sched_test'){scheduleSet=new URLSearchParams(options.body);return Response.json({id:'sched_test'});}
  throw new Error('Unexpected request '+route);
 });
 const membership=await billing.membership(store,'alice');assert.equal(membership.canPlay,true);assert.equal(membership.calendar.available,1);assert.equal(scheduleSet.get('end_behavior'),'cancel');assert.equal(scheduleSet.get('phases[0][duration][interval_count]'),'3');
 await billing.claim(store,'alice','first');await billing.claim(store,'alice','first');assert.equal(state.claims.length,1);
 await assert.rejects(billing.claim(store,'alice','second'),e=>e.code==='CASE_NOT_RELEASED');
});
