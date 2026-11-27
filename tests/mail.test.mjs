import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailer,messageTemplate,mailKey} from '../mail-service.mjs';
import {createBilling} from '../billing.mjs';
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
