import test from 'node:test';
import assert from 'node:assert/strict';
import {createBilling} from '../billing.mjs';
import {createGameApi} from '../game-api.mjs';
import {ApiError} from '../auth-provider.mjs';
import {cancellationSummary} from '../subscription-cancellation.mjs';

function fixture({scheduled=true,existingService=false}={}){
 const now=Math.floor(Date.now()/1000),end=now+3600*24*14,start=now-3600*24*14;
 const data={customer:'cus_test',subscription:'sub_self',active:true,periodEnd:end*1000,cycles:[{id:'paid',subscription:'sub_self',start:start*1000,end:end*1000}],waitlist:true};
 const sub={id:'sub_self',customer:data.customer,metadata:{lup_uid:'player'},status:'active',schedule:scheduled?'sched':null,
   items:{data:[{price:{id:'price_legacy'},quantity:1,current_period_end:end}]}};
 const phase={start_date:start,end_date:end+86400*60,items:[{price:'price_legacy',quantity:1,metadata:{edition:'old'}}],discounts:[{coupon:'partner'}],collection_method:'charge_automatically'};
 const schedule={id:'sched',customer:data.customer,subscription:sub.id,status:'active',current_phase:{start_date:start,end_date:phase.end_date},end_behavior:'cancel',phases:[phase]};
 const writes=[],calls=[];
 let loseResponse=false;
 const store={getMemberData:async()=>structuredClone(data),saveMemberData:async(_uid,next)=>Object.assign(data,next)};
 const billing=createBilling({STRIPE_SECRET_KEY:'test-only',BILLING_ENABLED:'false',...(existingService?{STRIPE_WEBHOOK_SECRET:'test-hook',STRIPE_PRICE_ID:'price_legacy'}:{})},async(url,opts)=>{
   const path=new URL(url).pathname,form=opts.body&&Object.fromEntries(opts.body);
   calls.push([opts.method,path]);
   if(form)writes.push({path,form,key:opts.headers['Idempotency-Key']});
   if(path==='/v1/subscriptions')return Response.json({data:[sub],has_more:false});
   if(path==='/v1/invoices')return Response.json({data:[]});
   if(path.includes('/subscription_schedules/')){
     if(form){schedule.phases=[{...phase,end_date:Number(form['phases[0][end_date]'])}];schedule.metadata={lup_stop_at:form['metadata[lup_stop_at]']};sub.cancel_at=schedule.phases[0].end_date;}
     if(form&&loseResponse){loseResponse=false;throw Error('respuesta perdida');}
     return Response.json(schedule);
   }
   assert.match(path,/\/subscriptions\/sub_/);
   if(form){sub.cancel_at_period_end=form.cancel_at_period_end==='true';sub.metadata.lup_stop_at=form['metadata[lup_stop_at]'];}
   return Response.json(sub);
 });
 return {data,sub,schedule,calls,writes,billing,store,end,start,lose:()=>{loseResponse=true;}};
}

test('La baja en preapertura conserva el periodo pagado, el descuento, la cuenta y el aviso',async()=>{
 const x=fixture(),read=()=>x.billing.cancellation(x.store,'player');
 const before=structuredClone(x.data),quote=await read();
 assert.equal(quote.status,'available');assert.equal(quote.effectiveAt,x.end*1000);assert.equal(x.writes.length,0);
 const result=await x.billing.cancellation(x.store,'player',quote.confirmation);
 assert.deepEqual(result,{status:'scheduled',effectiveAt:x.end*1000});
 assert.equal(x.writes.length,1);const {form,path}=x.writes[0];
 assert.equal(path,'/v1/subscription_schedules/sched');
 assert.equal(form.proration_behavior,'none');assert.equal(form['phases[0][proration_behavior]'],'none');
 assert.equal(form['phases[0][end_date]'],String(x.end));assert.equal(form['phases[0][start_date]'],String(x.start));
 assert.equal(form['phases[0][discounts][0][coupon]'],'partner');assert.equal(form['phases[0][items][0][price]'],'price_legacy');
 assert.equal(form.end_behavior,'cancel');assert.deepEqual(x.data.cycles,before.cycles);assert.equal(x.data.active,true);assert.equal(x.data.waitlist,true);
 assert.deepEqual(await read(),result);assert.deepEqual(await x.billing.cancellation(x.store,'player',quote.confirmation),result);assert.equal(x.writes.length,1);
 assert.deepEqual(cancellationSummary(x.data),result);
});

test('Solo el calendario activo, vinculado y con otra fase de cobro confirma la próxima renovación',async()=>{
  const x=fixture({existingService:true});
  Object.assign(x.data,{scheduleConfigured:true,schedule:'sched'});
  Object.assign(x.data.cycles[0],{paidAt:x.start*1000,amountPaid:2995});
  const read=()=>x.billing.membership(x.store,'player',{readOnly:true,includeRenewalDate:true});
  assert.equal((await read()).nextRenewalAt,x.end*1000);
  x.schedule.customer='otra';assert.equal((await read()).nextRenewalAt,null);x.schedule.customer=x.data.customer;
  x.schedule.phases[0].end_date=x.end;assert.equal((await read()).nextRenewalAt,null);
  x.sub.cancel_at_period_end=true;assert.equal((await read()).nextRenewalAt,null);
  assert.equal(x.writes.length,0);
});

test('El plan histórico sin calendario se da de baja solo al vencimiento',async()=>{
 const x=fixture({scheduled:false}),quote=await x.billing.cancellation(x.store,'player');
 await x.billing.cancellation(x.store,'player',quote.confirmation);
 assert.deepEqual(x.writes.map(a=>a.path),['/v1/subscriptions/sub_self']);
 assert.equal(x.writes[0].form.cancel_at_period_end,'true');assert.equal(x.writes[0].form.proration_behavior,'none');
 assert.equal(x.data.periodEnd,x.end*1000);
});

test('Rechaza confirmaciones caducadas o referidas a otra cuenta, suscripción o mensualidad',async()=>{
 const x=fixture(),quote=await x.billing.cancellation(x.store,'player');
 await assert.rejects(x.billing.cancellation(x.store,'player',quote.confirmation.replace(/^\d+/,String(Date.now()-5))),/cambiado/);
 await assert.rejects(x.billing.cancellation(x.store,'otra',quote.confirmation),/cambiado/);
 x.sub.items.data[0].current_period_end++;
 await assert.rejects(x.billing.cancellation(x.store,'player',quote.confirmation),/cambiado/);
 x.sub.items.data[0].current_period_end--;
 x.data.subscription='sub_reemplazo';x.sub.id='sub_reemplazo';
 await assert.rejects(x.billing.cancellation(x.store,'player',quote.confirmation),/cambiado/);
 x.data.subscription=x.sub.id='sub_self';x.schedule.customer='cus_otro';
 await assert.rejects(x.billing.cancellation(x.store,'player',quote.confirmation),/cambiado/);
 assert.equal(x.writes.length,0);
});

test('Una respuesta perdida se reconcilia y no puede duplicar la operación en Stripe',async()=>{
 const x=fixture(),quote=await x.billing.cancellation(x.store,'player');x.lose();
 await assert.rejects(x.billing.cancellation(x.store,'player',quote.confirmation),/perdida/);
 assert.equal(x.data.renewalStop,undefined);
 assert.equal((await x.billing.cancellation(x.store,'player',quote.confirmation)).status,'scheduled');
 assert.equal(x.data.renewalStop.effectiveAt,x.end*1000);assert.equal(x.writes.length,1);
});

test('Cuenta gratuita, baja efectiva y fin automático del catálogo no se vuelven a cancelar',async()=>{
 const x=fixture();x.schedule.phases[0].end_date=x.end;
 assert.deepEqual(await x.billing.cancellation(x.store,'player'),{status:'ending',effectiveAt:x.end*1000});
 x.sub.status='canceled';x.sub.ended_at=x.start;
 assert.deepEqual(await x.billing.cancellation(x.store,'player'),{status:'ended',effectiveAt:x.start*1000});
 delete x.data.customer;assert.deepEqual(await x.billing.cancellation(x.store,'player'),{status:'none'});
 assert.equal(x.writes.length,0);
});

test('Una cuota ya confirmada sigue dando acceso durante la preapertura después de programar la baja',async()=>{
 const x=fixture({existingService:true});x.data.billingVerifiedAt=Date.now();
 const quote=await x.billing.cancellation(x.store,'player');
 await x.billing.cancellation(x.store,'player',quote.confirmation);
 const access=await x.billing.pollMembership(x.store,'player');
 assert.equal(access.canPlay,true);assert.equal(x.billing.publicConfig().checkoutAvailable,false);
 assert.deepEqual(access.seasonAccess.availableCases,[1,2,3,4]);
});

test('La ruta exige autenticación, origen propio y una confirmación vinculada al periodo',async()=>{
 const x=fixture(),origin='https://laultimapieza.es',api=createGameApi({config:{},billing:x.billing,origins:[origin],withStore:fn=>fn(x.store),
   verify:async req=>{if(req.headers.get('authorization')!=='test')throw new ApiError(401,'Entra en tu cuenta');return {userId:'player'};}});
 const request=(method,options={})=>new Request(origin+'/api/billing/cancellation',{method,headers:{'Content-Type':'application/json',...options.headers},...(method==='POST'?{body:JSON.stringify(options.body||{})}:{})});
 assert.equal((await api(request('GET'))).status,401);
 const response=await api(request('GET',{headers:{Authorization:'test'}}));assert.equal(response.status,200);
 const quote=await response.json(),headers={Authorization:'test',Origin:origin};
 assert.equal((await api(request('POST',{headers,body:{confirmation:quote.confirmation}}))).status,400);
 assert.equal((await api(request('POST',{headers:{Authorization:'test'},body:{confirm:true,confirmation:quote.confirmation}}))).status,403);
 assert.equal(x.writes.length,0);
 const confirmed=await api(request('POST',{headers,body:{confirm:true,confirmation:quote.confirmation}}));
 assert.equal(confirmed.status,200);assert.equal((await confirmed.json()).status,'scheduled');
});

test('Dos confirmaciones simultáneas comparten la baja dentro del bloqueo de cuenta',async()=>{
 const x=fixture(),quote=await x.billing.cancellation(x.store,'player');
 let transaction=Promise.resolve();
 const withStore=fn=>transaction=transaction.then(()=>fn(x.store));
 const responses=await Promise.all([1,2].map(()=>withStore(store=>x.billing.cancellation(store,'player',quote.confirmation))));
 assert.deepEqual(responses[0],responses[1]);assert.equal(x.writes.length,1);
});
