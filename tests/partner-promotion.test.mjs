import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBilling} from '../billing.mjs';
import {messageTemplate} from '../mail-service.mjs';
import {applyRenewalOffer} from '../partner-stripe.mjs';

const uid='fixture-holder',other='fixture-partner',address=other+'@example.test';
const emailKey=email=>createHash('sha256').update(email).digest('hex');
const coupon='lup-companero-50-v1';
const priceId='price-fixture';
const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture',
  STRIPE_PRICE_ID:priceId,STRIPE_PORTAL_CONFIGURATION:'fixture',BILLING_TERMS_URL:'https://example.test/terms',
  BILLING_PRIVACY_URL:'https://example.test/privacy'};
const user={userId:uid,email:uid+'@example.test',emailVerified:true};
const now=Math.floor(Date.now()/1000);
const price={id:priceId,unit_amount:2995,currency:'eur',recurring:{interval:'month',interval_count:1},tax_behavior:'inclusive'};
const promotion={id:coupon,percent_off:50,duration:'forever',valid:true};

function fixture(){
  const members=new Map([[uid,{customer:'cus-holder'}]]),purchases=new Map(),preferences=new Map(),messages=new Map();
  const sessions=new Map(),requests=[];
  const stripe={subs:[],invoices:[],drafts:[],peer:null,price:{...price},schedule:{
    id:'sched-fixture',current_phase:{start_date:now-60,end_date:now+30*86400},
    phases:[{start_date:now-60,end_date:now+90*86400,items:[{price:priceId,quantity:1}],discounts:[]}]}};
  const store={
    async getMemberData(id){return structuredClone(members.get(id)||{});},
    async saveMemberData(id,data){members.set(id,structuredClone(data));},
    async hasOfferPurchase(id,key){
      const mine=purchases.get(id);
      return Boolean(mine&&mine.activeUntil>Date.now()&&preferences.get(id)===key&&[...purchases].some(([holder,entry])=>
        holder!==id&&entry.key===key&&entry.activeUntil>Date.now()&&preferences.get(holder)===mine.key));
    },
    async getMutualOfferPartner(id,key){
      if(id===uid && key===emailKey(address) && preferences.get(uid)===key && preferences.get(other)===emailKey(user.email))return other;
      return null;
    },
    async recordOfferPreference(id,key){preferences.set(id,key);},
    async getOfferIdentityKey(id){return emailKey(id+'@example.test');},
    async recordOfferPurchase(id,key,activeUntil){purchases.set(id,{key,activeUntil});},
    async enqueueMail(key,...value){if(!messages.has(key))messages.set(key,value);}
  };
  const billing=createBilling(env,async(url,options)=>{
    const path=new URL(url).pathname.replace('/v1/',''),method=options.method;
    const body=new URLSearchParams(options.body);
    requests.push({path,method,body,key:options.headers['Idempotency-Key']});
    if(path==='subscriptions')return Response.json({data:stripe.subs});
    if(path==='invoices')return Response.json({data:new URL(url).searchParams.get('status')==='draft'?stripe.drafts:stripe.invoices});
    if(path==='subscriptions/sub-holder' || path==='subscriptions/sub-peer'){
      const subscription=path.endsWith('holder')?stripe.subs[0]:stripe.peer;
      if(method==='POST')subscription.discounts=[];
      return Response.json(subscription);
    }
    if(path.startsWith('invoices/')&&method==='POST'){
      const draft=stripe.drafts.find(item=>'invoices/'+item.id===path);
      assert(draft);draft.discounts=[];return Response.json(draft);
    }
    if(path==='prices/'+priceId)return Response.json(stripe.price);
    if(path==='coupons/'+coupon || path==='coupons'&&method==='POST')return Response.json(promotion);
    if(path==='customers/cus-holder')return Response.json({id:'cus-holder',email:user.email,metadata:{lup_uid:uid}});
    if(path==='checkout/sessions'&&method==='POST'){
      const id='cs-fixture-'+(sessions.size+1);
      const response={id,url:'https://checkout.example.test/'+id,status:'open',expires_at:now+3600};
      sessions.set(id,response);return Response.json(response);
    }
    if(path.startsWith('checkout/sessions/')){
      const [, ,id,operation]=path.split('/'),session=sessions.get(id);
      assert(session,'Checkout '+id);
      if(method==='POST'&&operation==='expire')session.status='expired';
      return Response.json(session);
    }
    if(path==='subscription_schedules' ||path==='subscription_schedules/'+stripe.schedule.id)return Response.json(stripe.schedule);
    assert.fail('Unexpected mock Stripe route '+method+' '+path);
  });
  function subscribe(){
    stripe.subs=[{id:'sub-holder',customer:'cus-holder',status:'active',metadata:{lup_uid:uid,lup_season:'1',lup_blocks:'1,2,3'},
      schedule:stripe.schedule.id,items:{data:[{id:'si-fixture',price:{...price},quantity:1,current_period_start:now-60,current_period_end:now+30*86400}]}}];
  }
  async function prefer(email,id=uid){
    const member=await store.getMemberData(id);
    if(email)member.preferredPartnerEmail=email;
    else delete member.preferredPartnerEmail;
    await store.saveMemberData(id,member);
    await store.recordOfferPreference(id,email?emailKey(email):null);
  }
  return {billing,store,stripe,requests,messages,sessions,subscribe,prefer,
    purchase:(activeUntil=(now+86400)*1000)=>store.recordOfferPurchase(other,emailKey(address),activeUntil),
    checkout:(options={})=>billing.checkout(store,user,{season:1,...options}),
    membership:()=>billing.membership(store,uid)};
}

const sessionsCreated=f=>f.requests.filter(r=>r.path==='checkout/sessions'&&r.method==='POST');
const discountIncluded=body=>[...body].some(([key,value])=>key.includes('discounts')&&value===coupon);

test('La primera cuota se contrata a precio completo aun con pareja recíproca de pago, y un reintento reutiliza Checkout',async()=>{
  const f=fixture();
  const terms=f.billing.publicConfig().partnerOffer;
  assert.equal(terms.percentOff,50);assert.equal(terms.regularAmountCents,2995);assert.equal(terms.currency,'eur');
  await f.prefer(address);await f.prefer(user.email,other);await f.purchase();
  assert.equal((await f.membership()).partnerOffer.eligible,false);
  const first=await f.checkout({eligible:true,percentOff:100,discounts:[{coupon}]});
  assert.equal(discountIncluded(sessionsCreated(f)[0].body),false);
  assert.deepEqual(await f.checkout(),first);
  assert.equal(sessionsCreated(f).length,1);
  const data=await f.store.getMemberData(uid);
  data.pendingSeasonCheckout.partnerDiscount=true;
  await f.store.saveMemberData(uid,data);
  const corrected=await f.checkout();
  assert.notDeepEqual(corrected,first);
  assert.deepEqual([...f.sessions.values()].map(s=>s.status),['expired','open']);
  assert.equal(discountIncluded(sessionsCreated(f)[1].body),false);
  f.subscribe();
  await assert.rejects(f.checkout(),{status:409});
  assert.equal(sessionsCreated(f).length,2);
});

function invoice(amount,{couponId=coupon,currency='eur',price=priceId,discountAmount=2995-amount}={}){
  const discount={id:'di-fixture',source:{type:'coupon',coupon:{...promotion,id:couponId}}};
  return {id:'in-fixture',status:'paid',amount_paid:amount,amount_due:amount,total:amount,subtotal:2995,currency,
    customer_email:user.email,customer:'cus-holder',billing_reason:'subscription_cycle',status_transitions:{paid_at:now-30},
    discounts:[discount],total_discount_amounts:[{discount:discount.id,amount:discountAmount}],
    lines:{data:[{amount:2995,quantity:1,pricing:{price_details:{price}},discount_amounts:[{discount:discount.id,amount:discountAmount}],
      period:{start:now-60,end:now+30*86400}}]}};
}

test('El descuento cambia solo cuotas futuras, conserva el fin del calendario y se retira de la factura aún en borrador',async()=>{
  const sub={id:'sub-holder',status:'active',schedule:'sched-holder',discounts:[],items:{data:[{price,quantity:1,discounts:[]}]}};
  const start=now-60,end=now+61*86400;
  const phase={start_date:start,end_date:end,currency:'eur',items:[{price:priceId,quantity:1}],discounts:[],proration_behavior:'none'};
  const schedule={id:sub.schedule,status:'active',subscription:sub.id,end_behavior:'cancel',
    current_phase:{start_date:start,end_date:end},phases:[phase]};
  const draft={id:'in-upcoming',status:'draft',currency:'eur',parent:{subscription_details:{subscription:sub.id}},
    billing_reason:'subscription_cycle',lines:{data:[{pricing:{price_details:{price:priceId}},quantity:1,amount:2995}]},discounts:[]};
  const requests=[];
  const couponDiscount={id:'di-test',source:{type:'coupon',coupon:promotion}};
  const provider=async(path,values,key)=>{
    const [part,query]=path.split('?');
    if(part==='subscriptions/'+sub.id&&!values)return structuredClone(sub);
    if(part==='subscription_schedules/'+schedule.id&&!values)return structuredClone(schedule);
    if(part==='coupons/'+coupon&&!values)return promotion;
    if(part==='invoices'&&!values){
      assert.equal(new URLSearchParams(query).get('status'),'draft');return {data:[structuredClone(draft)]};
    }
    assert(values,'Unexpected read '+path);
    const fields=new URLSearchParams(values);
    requests.push({part,fields,key});
    if(part==='subscription_schedules/'+schedule.id){
      const on=discountIncluded(fields);
      phase.discounts=on?[{coupon}]:[];
      sub.discounts=on?[couponDiscount]:[];
      return structuredClone(schedule);
    }
    assert.equal(part,'invoices/'+draft.id);
    draft.discounts=discountIncluded(fields)?[couponDiscount]:[];
    return structuredClone(draft);
  };
  for(const eligible of [true,false,true]){
    const before=requests.length;
    await applyRenewalOffer(provider,{subscription:sub,scheduleId:schedule.id,priceId,eligible});
    const changes=requests.slice(before);
    assert.deepEqual(changes.map(change=>change.part).sort(),['invoices/in-upcoming','subscription_schedules/sched-holder']);
    const fields=changes.find(change=>change.part.startsWith('subscription_schedules')).fields;
    assert.equal(fields.get('phases[0][start_date]'),String(start));
    assert.equal(fields.get('phases[0][end_date]'),String(end));
    assert.equal(fields.get('phases[0][items][0][price]'),priceId);
    assert.equal(fields.get('proration_behavior'),'none');
    assert(![...fields.keys()].some(key=>key.startsWith('phases[1]')));
    for(const change of changes)assert.equal(discountIncluded(change.fields),eligible);
  }
});
test('Solo la factura de precio, moneda y descuento autorizados abre cuatro casos y entrega una llave',async()=>{
  for(const [amount,overrides,valid] of [
    [1497,{},true],[1498,{},true],[1498,{currency:'usd'},false],
    [1498,{couponId:'coupon-unrelated'},false],[1498,{price:'price-unrelated'},false],
    [1498,{discountAmount:212},false],[1295,{},false],[1498,{first:true},false]
  ]){
    const f=fixture();
    f.subscribe();
    const receipt=invoice(amount,overrides);
    if(overrides.first)receipt.billing_reason='subscription_create';
    f.stripe.invoices.push(receipt);
    const membership=await f.membership();
    assert.equal(membership.canPlay,valid,JSON.stringify({amount,overrides}));
    assert.deepEqual(membership.seasonAccess.availableCases,valid?[1,2,3,4]:[]);
    await f.membership();
    const data=await f.store.getMemberData(uid);
    assert.equal(data.cycles.length,valid?1:0);
    assert.equal(data.valdemarSeasonOne?.paid?.welcomes?.length||0,valid?1:0);
    assert.equal(f.messages.size,valid?1:0);
    if(valid){
      const [,type,payload]=[...f.messages.values()][0];
      assert.equal(type,'subscription');
      const mail=messageTemplate(type,payload);
      const displayed=String(Math.floor(amount/100))+','+String(amount%100).padStart(2,'0');
      assert(mail.text.includes(displayed));assert(mail.html.includes(displayed));
      assert(!mail.text.includes('29,95'));
    }
  }
});

test('Solo dos pases vigentes con correos recíprocos obtienen la próxima renovación con descuento',async()=>{
  const f=fixture();
  await f.prefer(address);await f.purchase();
  f.subscribe();
  const first=invoice(2995);
  first.billing_reason='subscription_create';first.discounts=[];first.total_discount_amounts=[];
  first.lines.data[0].discount_amounts=[];
  f.stripe.invoices.push(first);
  let membership=await f.membership();
  assert.equal(membership.partnerOffer.eligible,false);
  assert.deepEqual(membership.seasonAccess.availableCases,[1,2,3,4]);
  await f.prefer(user.email,other);
  assert.equal((await f.membership()).partnerOffer.eligible,true);
  f.stripe.subs[0].cancel_at_period_end=true;
  assert.equal((await f.membership()).partnerOffer.eligible,true);
  await f.purchase(now*1000-1);
  assert.equal((await f.membership()).partnerOffer.eligible,false);
  await f.purchase();await f.prefer(null,other);
  assert.equal((await f.membership()).partnerOffer.eligible,false);
  await f.prefer(user.email,other);
  assert.equal((await f.membership()).partnerOffer.eligible,true);
  await f.purchase(null);
  assert.equal((await f.membership()).partnerOffer.eligible,false);
  assert.equal((await f.store.getMemberData(uid)).cycles[0].amountPaid,2995);
  assert.equal(f.messages.size,1);
});

test('Al vencer el periodo, una renovación ya bonificada conserva su descuento mientras se confirma el cobro',async()=>{
  for(const state of ['reciprocal','newPartner','removed','refunded','paused','past_due','canceled']){
    const f=fixture(),boundary=now-5;
    await f.prefer(address);
    if(state!=='removed')await f.prefer(user.email,other);
    f.subscribe();
    const holder=f.stripe.subs[0];
    holder.schedule=null;
    const prior=invoice(2995);
    prior.billing_reason='subscription_create';prior.lines.data[0].period={start:boundary-30*86400,end:boundary};
    prior.total_discount_amounts=[];prior.discounts=[];prior.lines.data[0].discount_amounts=[];
    f.stripe.invoices=[prior];
    const member=await f.store.getMemberData(uid);
    Object.assign(member,{subscription:holder.id,scheduleConfigured:true,
      partnerDiscountPeerKey:emailKey(state==='newPartner'?'previous@example.test':address)});
    await f.store.saveMemberData(uid,member);
    const peer=await f.store.getMemberData(other);
    Object.assign(peer,{customer:'cus-peer',subscription:'sub-peer',cycles:[
      {id:'paid-peer',subscription:'sub-peer',amountPaid:2995,revoked:state==='refunded',start:(boundary-86400)*1000,end:boundary*1000}
    ]});
    await f.store.saveMemberData(other,peer);
    f.stripe.peer={id:'sub-peer',customer:'cus-peer',metadata:{lup_uid:other},items:{data:[{price,quantity:1}]},
      status:state==='past_due'||state==='canceled'?state:'active',pause_collection:state==='paused'?{behavior:'void'}:null};
    f.stripe.drafts=[boundary,boundary+30*86400].map((start,index)=>{
      const draft=invoice(1498);draft.id='draft-'+index;draft.status='draft';
      draft.parent={subscription_details:{subscription:holder.id}};
      draft.lines.data[0].period={start,end:start+30*86400};return draft;
    });
    await f.billing.refreshPartnerOffer(fn=>fn(f.store),uid);
    const updated=f.requests.filter(r=>r.method==='POST'&&r.path.startsWith('invoices/')).map(r=>r.path);
    assert.deepEqual(updated,state==='reciprocal'?['invoices/draft-1']:['invoices/draft-0','invoices/draft-1'],state);
    assert.equal((await f.store.getMemberData(uid)).cycles[0].amountPaid,2995);
  }
});

test('La pausa o el impago del titular retira el cupón del calendario y del borrador sin tocar la factura liquidada',async()=>{
  for(const status of ['paused','unpaid','past_due','pause_collection']){
    const f=fixture();
    await f.prefer(address);await f.prefer(user.email,other);await f.purchase();
    f.subscribe();
    const sub=f.stripe.subs[0];
    sub.status=status==='pause_collection'?'active':status;
    if(status==='pause_collection')sub.pause_collection={behavior:'void'};
    const receipt=invoice(1498);
    f.stripe.invoices=[receipt];sub.discounts=structuredClone(receipt.discounts);
    const schedule=f.stripe.schedule,phase=schedule.phases[0];
    Object.assign(schedule,{status:'active',subscription:sub.id,end_behavior:'cancel'});
    schedule.current_phase.end_date=phase.end_date;
    phase.discounts=[{coupon}];
    const draft=structuredClone(receipt);
    Object.assign(draft,{id:'draft-holder',status:'draft',parent:{subscription_details:{subscription:sub.id}}});
    draft.lines.data[0].period={start:now+30*86400,end:now+60*86400};f.stripe.drafts=[draft];
    const member=await f.store.getMemberData(uid);
    Object.assign(member,{subscription:sub.id,schedule:sub.schedule,scheduleConfigured:true,partnerDiscountPeerKey:emailKey(address)});
    await f.store.saveMemberData(uid,member);
    await f.billing.refreshPartnerOffer(fn=>fn(f.store),uid);
    const posts=f.requests.filter(request=>request.method==='POST');
    assert.deepEqual(posts.map(request=>request.path).sort(),['invoices/draft-holder','subscription_schedules/'+schedule.id],status);
    const update=posts.find(request=>request.path.startsWith('subscription_schedules')).body;
    assert.equal(update.get('phases[0][discounts]'),'');assert.equal(update.get('proration_behavior'),'none');
    assert.equal(update.get('phases[0][end_date]'),String(phase.end_date));
    assert.equal(posts.find(request=>request.path==='invoices/draft-holder').body.get('discounts'),'');
    assert.equal((await f.store.getMemberData(uid)).cycles[0].amountPaid,1498);
    assert.equal(receipt.amount_paid,1498);assert.equal(f.stripe.drafts[0].discounts.length,0);
  }
});
