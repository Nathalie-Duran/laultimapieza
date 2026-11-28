import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailer,messageTemplate,mailKey} from '../mail-service.mjs';
import {createBilling} from '../billing.mjs';
import {createHmac} from 'node:crypto';
test('Mail stays disabled without explicit activation and verified sender configuration',async()=>{
 let called=false;await createMailer({MAIL_ENABLED:'true'},()=>{called=true;}).process(()=>{called=true;});assert.equal(called,false);
 assert.match(messageTemplate('welcome',{name:'<script>alert(1)</script>'}).html,/&lt;script&gt;/);
 assert.doesNotMatch(messageTemplate('welcome',{name:'<script>'}).html,/<script>/);
 assert.equal(mailKey('welcome','a'),mailKey('welcome','a'));assert.notEqual(mailKey('welcome','a'),mailKey('subscription','a'));
});
test('Mail retries use the same provider idempotency key and mark success only after confirmation',async()=>{
 const job={id:mailKey('welcome','test'),email:'recipient@example.test',type:'welcome',data:{name:'Test'}};
 let available=true,attempt=0,finished=[],failed=[],keys=[];
 const store={async claimMail(){if(!available)return null;available=false;return job;},async finishMail(...args){finished.push(args);},async retryMail(...args){failed.push(args);}};
 const mailer=createMailer({MAIL_ENABLED:'true',MAIL_FROM:'La ultima pieza <hello@example.test>',RESEND_API_KEY:'fake'},async(url,opts)=>{keys.push(opts.headers['Idempotency-Key']);attempt++;return attempt===1?new Response('',{status:503}):Response.json({id:'provider_1'});});
 await mailer.process(fn=>fn(store));assert.equal(finished.length,0);assert.equal(failed[0][1],'PROVIDER_503');
 available=true;await mailer.process(fn=>fn(store));assert.deepEqual(keys,[job.id,job.id]);assert.deepEqual(finished,[[job.id,'provider_1']]);
});
test('Subscription email is queued only for a qualifying paid cycle and deduplicated by invoice',async()=>{
 const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'fake',STRIPE_WEBHOOK_SECRET:'fake',STRIPE_PRICE_ID:'price_test',STRIPE_PORTAL_CONFIGURATION:'pc_test',BILLING_TERMS_URL:'https://example.test/terms',BILLING_PRIVACY_URL:'https://example.test/privacy'};
 let state={customer:'cus_test',subscription:'sub_test',scheduleConfigured:true},paid=0;const jobs=new Map(),start=Math.floor(Date.now()/1000)-5;
 const store={async getMemberData(){return structuredClone(state);},async saveMemberData(uid,v){state=structuredClone(v);},async enqueueMail(id,...data){if(!jobs.has(id))jobs.set(id,data);}};
 const billing=createBilling(env,async url=>new URL(url).pathname==='/v1/subscriptions'?Response.json({data:[{id:'sub_test',metadata:{lup_uid:'alice'},status:'active',items:{data:[{price:{id:'price_test'}}]}}]}):Response.json({data:[{id:'in_test',customer_email:'recipient@example.test',currency:'eur',amount_paid:paid,billing_reason:'subscription_create',lines:{data:[{pricing:{price_details:{price:'price_test'}},period:{start,end:start+30*86400}}]}}]}));
 assert.equal((await billing.membership(store,'alice')).canPlay,false);assert.equal(jobs.size,0);
 paid=2995;await billing.membership(store,'alice');await billing.membership(store,'alice');assert.equal(jobs.size,1);assert.equal(jobs.get(mailKey('subscription','in_test'))[1],'subscription');
 assert.equal(jobs.get(mailKey('subscription','in_test'))[2].billingPlan,'season');
});

test('los correos de alta y renovación describen el bloque y las llaves del contrato pagado',()=>{
 for(const billingPlan of ['four-boards-v1','season',undefined])for(const renewal of [true,false]){
   const amountPaid=renewal?1498:2995;
   const message=messageTemplate('subscription',{billingPlan,renewal,amountPaid,periodEnd:Date.UTC(2026,11,27)});
   for(const content of [message.text,message.html]){
     assert.match(content,/cuatro juegos/);
     assert.match(content,renewal?/14,98/:/29,95/);
     assert.match(content,/cancelación/);
     if(billingPlan==='four-boards-v1')assert.match(content,/48 juegos/);
     else assert.match(content,/pase de temporada/);
     if(!renewal)assert.match(content,/una llave de bienvenida/);
     else if(billingPlan==='four-boards-v1')assert.match(content,/renovación incluye una llave/);
     else assert.doesNotMatch(content,/incluye una llave/);
   }
 }
});

test('los diez correos tienen un asunto propio y salen una vez por el proveedor simulado',async()=>{
 const kinds=['welcome','subscription','subscription','case_finished','board_finished','pair_confirmed','new_challenge','inactivity','subscription_cancelled','payment_failed'];
 const jobs=kinds.map((type,i)=>({type,id:'test-'+i,email:'member@example.test',data:{renewal:i===2,uid:'player',invoice:'in_open',caseId:12,effectiveAt:Date.UTC(2026,11,1)}}));
 const sent=new Map(),ack=[];
 const store={claimMail:async()=>jobs.shift(),finishMail:async(id)=>ack.push(id),noticeStillWanted:async()=>true,getMemberData:async()=>({cycles:[]})};
 const mailer=createMailer({MAIL_ENABLED:'true',MAIL_FROM:'test@example.test',RESEND_API_KEY:'local'},async(_url,options)=>{
   const message=JSON.parse(options.body),key=options.headers['Idempotency-Key'];
   assert.deepEqual(message.to,['member@example.test']);
   assert.ok(message.subject&&message.html.includes(message.subject)&&message.text.includes(message.subject));sent.set(key,message.subject);
   return Response.json({id:'delivery-'+key});
 });
 await mailer.process(fn=>fn(store));await mailer.process(fn=>fn(store));
 assert.equal(ack.length,10);assert.equal(new Set(sent.values()).size,10);
});

test('un impago de la cuota genera un aviso por factura; si se recupera antes del envío se retira',async()=>{
 const secret='solo-pruebas',now=Math.floor(Date.now()/1000),customer='cus_member',subscription='sub_member',email='member@example.test';
 const sub={id:subscription,customer,status:'active',metadata:{lup_uid:'player'},items:{data:[{price:{id:'price_pass'}}]}};
 const line={price:{id:'price_pass'},period:{start:now-120,end:now+86400}};
 const failed={id:'in_retry',customer,customer_email:email,billing_reason:'subscription_cycle',parent:{subscription_details:{subscription}},lines:{data:[line]}};
 const receipts=[],jobs=new Map();let data={customer,subscription,scheduleConfigured:true};
 const store={getMemberData:async()=>structuredClone(data),saveMemberData:async(_,next)=>{data=structuredClone(next);},
   findCustomer:async id=>id===customer?'player':null,enqueueMail:async(id,email,type,details)=>{if(!jobs.has(id))jobs.set(id,{id,email,type,data:details,status:'pending'});},
   claimMail:async()=>{const next=[...jobs.values()].find(j=>j.status==='pending');if(next)next.status='processing';return next;},
   finishMail:async id=>{jobs.get(id).status='sent';},cancelMail:async id=>{jobs.get(id).status='cancelled';}};
 const withStore=fn=>fn(store);
 const provider=async address=>{
   const route=new URL(address).pathname;
   if(route==='/v1/subscriptions')return Response.json({data:[sub]});
   if(route==='/v1/invoices')return Response.json({data:receipts});
   if(route==='/v1/customers/'+customer)return Response.json({id:customer,email});
   throw Error('Ruta inesperada '+route);
 };
 const billing=createBilling({STRIPE_SECRET_KEY:'local',STRIPE_WEBHOOK_SECRET:secret,STRIPE_PRICE_ID:'price_pass'},provider);
 async function webhook(type,object){
   const body=JSON.stringify({type,data:{object}}),stamp=Math.floor(Date.now()/1000);
   const signature=createHmac('sha256',secret).update(stamp+'.'+body).digest('hex');
   const request=new Request('https://example.test/webhook',{method:'POST',body,headers:{'stripe-signature':'t='+stamp+',v1='+signature}});
   assert.equal((await billing.webhook(request,withStore)).status,200);
 }
 await webhook('invoice.payment_failed',failed);await webhook('invoice.payment_failed',failed);
 await webhook('invoice.payment_failed',{...failed,id:'in_other',parent:{subscription_details:{subscription:'sub_other'}}});
 assert.equal(jobs.size,1);assert.equal(data.cycles.length,0);
 receipts.push({...failed,currency:'eur',amount_paid:2995,status:'paid',status_transitions:{paid_at:now}});
 await webhook('invoice.paid',failed);await webhook('invoice.payment_failed',failed);
 const liveFailure={...failed,id:'in_new',customer_email:null};await webhook('invoice.payment_failed',liveFailure);
 const sent=[];const mailer=createMailer({MAIL_ENABLED:'true',MAIL_FROM:'qa@example.test',RESEND_API_KEY:'local'},async(_,options)=>{
   sent.push(options.headers['Idempotency-Key']);return Response.json({id:'ok'});
 });
 await mailer.process(withStore);await mailer.process(withStore);
 assert.equal(jobs.get(mailKey('payment_failed',failed.id)).status,'cancelled');
 assert.deepEqual(sent.filter(id=>id===mailKey('payment_failed',liveFailure.id)),[mailKey('payment_failed',liveFailure.id)]);
 sub.cancel_at_period_end=true;sub.cancel_at=line.period.end;
 await webhook('customer.subscription.updated',sub);await webhook('customer.subscription.updated',sub);
 sub.status='canceled';sub.ended_at=line.period.end;sub.cancellation_details={reason:'cancellation_requested'};
 await webhook('customer.subscription.deleted',sub);await mailer.process(withStore);
 const cancellations=[...jobs.values()].filter(j=>j.type==='subscription_cancelled');
 assert.equal(cancellations.length,1);assert.equal(cancellations[0].data.effectiveAt,line.period.end*1000);assert.equal(cancellations[0].status,'sent');
});
