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
 assert.equal(releaseCalendar(cycles,[],start).available,4);
 assert.equal(releaseCalendar(cycles,['cartas-medianoche'],start+7*86400000-1).available,3);
 assert.equal(releaseCalendar(cycles,['cartas-medianoche'],start+7*86400000).available,3);
 assert.equal(releaseCalendar(cycles,['cartas-medianoche','cartas-medianoche'],start+21*86400000).available,3);
 const all=[...cycles,{id:'two',start:end,end:Date.UTC(2026,2,1)}];
 assert.equal(releaseCalendar(all,['cartas-medianoche'],end).available,7);
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
 for(const f of ['stories.js','season.js','experience-ui.js','cartas-investigation.js','investigation-ui.js','engagement-ui.js'])vm.runInContext(await readFile(new URL('../public/'+f,import.meta.url),'utf8'),c);
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
 const membership=await billing.membership(store,'alice');assert.equal(membership.canPlay,true);assert.equal(membership.calendar.available,4);assert.equal(scheduleSet.get('end_behavior'),'cancel');assert.equal(scheduleSet.get('phases[0][duration][interval_count]'),'3');
 for(const id of ['cartas-medianoche','ultima-funcion','archivo-ausencias','marea-quieta'])await billing.claim(store,'alice',id);
 await billing.claim(store,'alice','cartas-medianoche');assert.equal(state.claims.length,4);
 await assert.rejects(billing.claim(store,'alice','frecuencia-17'),e=>e.code==='CASE_NOT_RELEASED');
 await assert.rejects(billing.canPlay({store,uid:'alice',caseId:'frecuencia-17'}),e=>e.code==='CASE_NOT_RELEASED');
});

test('Los enlaces legales públicos son independientes entre sí y de las ventas',async()=>{
  const terms='https://www.laultimapieza.es/condiciones', privacy='https://www.laultimapieza.es/privacidad';
  const cannotPay=()=>{throw Error('No utilizar el proveedor de pago');};
  for(const [termsUrl,privacyUrl] of [[null,null],[terms,null],[null,privacy],[terms,privacy]]){
    const billing=createBilling({BILLING_TERMS_URL:termsUrl,BILLING_PRIVACY_URL:privacyUrl},cannotPay);
    const config=billing.publicConfig();
    assert.equal(config.checkoutAvailable,false);
    assert.equal(config.termsUrl,termsUrl);assert.equal(config.privacyUrl,privacyUrl);
    await assert.rejects(billing.checkout({},{}),{code:'BILLING_UNAVAILABLE'});
  }
  const invalid=['https://','/solo-interna','//dominio.es','javascript:alert(1)','http://dominio.es',
    'https://nombre:clave@dominio.es','https://localhost','https://127.0.0.1/doc','https://[::1]/doc',
    'https://documentos.local./','https://ejemplo.home.arpa/doc','https://pruebas.invalid'];
  for(const value of invalid){
    const cfg=createBilling({BILLING_PRIVACY_URL:value,BILLING_TERMS_URL:terms},cannotPay).publicConfig();
    assert.equal(cfg.privacyUrl,null,value);assert.equal(cfg.termsUrl,terms);
  }
});

test('Un cliente puede gestionar su suscripción con las ventas cerradas sin abrir una compra',async()=>{
  const env={BILLING_ENABLED:'false',STRIPE_SECRET_KEY:'fixture',STRIPE_PORTAL_CONFIGURATION:'customer-portal'};
  const accounts={titular:{customer:'cus-fixture',cycles:[{id:'previous-payment'}]},nueva:{}};
  const store={getMemberData:async(uid,options)=>{assert.equal(options?.readOnly,true);return structuredClone(accounts[uid]);}};
  const destination='https://billing.stripe.com/p/session/fixture';
  const requests=[];
  const billing=createBilling(env,async(url,options)=>{
    const path=new URL(url).pathname;requests.push(path);
    assert.equal(path,'/v1/billing_portal/sessions');assert.equal(options.method,'POST');
    assert.deepEqual(Object.fromEntries(options.body),{customer:'cus-fixture',configuration:'customer-portal',
      return_url:'https://laultimapieza.es/#perfil?seccion=cuenta',locale:'es'});
    return Response.json({url:destination});
  });
  assert.equal(billing.publicConfig().checkoutAvailable,false);
  assert.deepEqual(await billing.portal(store,'titular'),{url:destination});
  await assert.rejects(billing.portal(store,'nueva'),{status:409});
  await assert.rejects(billing.checkout(store,{userId:'titular'}),{code:'BILLING_UNAVAILABLE'});
  assert.deepEqual(requests,['/v1/billing_portal/sessions']);
  for(const option of ['STRIPE_SECRET_KEY','STRIPE_PORTAL_CONFIGURATION']){
    const missing=createBilling({...env,[option]:'  '},()=>assert.fail('No contactar con Stripe'));
    await assert.rejects(missing.portal(store,'titular'),{status:503,code:'BILLING_PORTAL_UNAVAILABLE'});
  }
  const unavailable=createBilling(env,async()=>new Response(null,{status:401}));
  await assert.rejects(unavailable.portal(store,'titular'),{status:503,code:'BILLING_PORTAL_UNAVAILABLE'});
});
