import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {orderedCycles,releaseCalendar,SEASON_NAMES} from './progression.mjs';
import {mailKey} from './mail-service.mjs';
import {creditValdemarWelcome,worldSeasonAccess} from './valdemar-wallet.mjs';
import {accountOffer,emailKey,indexPurchase,paidPassInvoice,publicPartnerOffer,regularAmountCents} from './partner-offer.mjs';
import {PARTNER_COUPON,applyRenewalOffer} from './partner-stripe.mjs';

function publicDocumentUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value.trim())) return null;
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.username || url.password) return null;
  const hostname = url.hostname.replace(/\.$/, '');
  // Published documents use DNS hostnames. Exclude local addresses and reserved suffixes.
  const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
  if (!domain.test(hostname) || /(?:^|\.)(?:localhost|local|internal|lan|test|invalid|example|home\.arpa)$/i.test(hostname)) return null;
  return url.href;
}

function purchasedBlocks(subscription) {
  const raw = subscription.metadata?.lup_blocks;
  if (raw === undefined) return null; // Finite twelve-case legacy pass.
  const numbers = String(raw).split(',').map(Number);
  const season = Number(subscription.metadata?.lup_season);
  if (!Number.isInteger(season) || season<1 || season>SEASON_NAMES.length || !numbers.length || numbers.length>3 ||
      numbers.some((block,i)=>!Number.isInteger(block) || block<1 || Math.ceil(block/3)!==season ||
        (i>0 && block<=numbers[i-1]))) {
    throw new ApiError(503,'No podemos comprobar los bloques contratados.','BILLING_UNAVAILABLE');
  }
  return numbers;
}
export function validSignature(raw,header,secret,now=Date.now()){
  const fields=String(header||'').split(','),time=Number(fields.find(x=>x.startsWith('t='))?.slice(2));
  if(!time||Math.abs(now/1000-time)>300||!secret)return false;
  const expected=createHmac('sha256',secret).update(time+'.'+raw).digest();
  return fields.filter(x=>x.startsWith('v1=')).some(x=>{const value=x.slice(3);return /^[0-9a-f]{64}$/.test(value)&&timingSafeEqual(expected,Buffer.from(value,'hex'));});
}
export function createBilling(env=process.env,fetcher=fetch){
  const configured=!!(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_ID&&env.STRIPE_PORTAL_CONFIGURATION&&env.BILLING_TERMS_URL&&env.BILLING_PRIVACY_URL&&env.BILLING_ENABLED==='true');
  const portalConfigured=Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_PORTAL_CONFIGURATION?.trim());
  const origin='https://laultimapieza.es';
  async function stripe(path,values,idem,{allowMissing=false}={}){
    const portal=path==='billing_portal/sessions';
    if(portal && !portalConfigured)throw new ApiError(503,'El portal de gestión de suscripciones no está disponible en este momento.','BILLING_PORTAL_UNAVAILABLE');
    if(!portal && !configured)throw new ApiError(503,'La contratación todavía no está abierta.','BILLING_UNAVAILABLE');
    const response=await fetcher('https://api.stripe.com/v1/'+path,{method:values?'POST':'GET',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-10-28.endive',...(values?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(values?{body:new URLSearchParams(values)}:{}),signal:AbortSignal.timeout(15000)});
    if(allowMissing && response.status===404)return null;
    if(portal && !response.ok)throw new ApiError(503,'No se ha podido abrir el portal de suscripciones. Inténtalo más tarde.','BILLING_PORTAL_UNAVAILABLE');
    if(!response.ok)throw new ApiError(503,'No podemos comprobar el pago ahora. Inténtalo de nuevo.','BILLING_UNAVAILABLE');
    return response.json();
  }
  async function sync(store,uid,{readOnly=false}={}){
    const data=await store.getMemberData(uid,{readOnly});
    if(!configured||!data.customer)return {data,active:false};
    const subs=await stripe('subscriptions?customer='+encodeURIComponent(data.customer)+'&status=all&limit=10');
    const candidates=subs.data.filter(s=>s.metadata?.lup_uid===uid&&s.items?.data?.some(i=>i.price?.id===env.STRIPE_PRICE_ID));
    const purchaseHeld=candidates.some(s=>!['canceled','incomplete_expired'].includes(s.status));
    const sub=candidates.find(s=>s.status==='active')||candidates[0];
    if(!sub){
      if(!readOnly && data.active){
        data.active=false;data.periodEnd=0;await store.saveMemberData(uid,data);await indexPurchase(store,uid,data);
      }
      return {data,active:false};
    }
    if(data.subscription!==sub.id){data.scheduleConfigured=false;data.schedule=null;}
    data.subscription=sub.id;
    const invoices=await stripe('invoices?subscription='+encodeURIComponent(sub.id)+'&status=paid&limit=100&expand[]=data.discounts&expand[]=data.total_discount_amounts.discount');
    const cycles=[];
    for(const invoice of invoices.data||[]){
      const line=invoice.lines?.data?.find(l=>(l.pricing?.price_details?.price||l.price?.id)===env.STRIPE_PRICE_ID);
      if(!paidPassInvoice(invoice,line,PARTNER_COUPON))continue;
      cycles.push({id:invoice.id,subscription:sub.id,amountPaid:invoice.amount_paid,paidAt:invoice.status_transitions?.paid_at?invoice.status_transitions.paid_at*1000:null,start:line.period.start*1000,end:line.period.end*1000,revoked:(data.revokedInvoices||[]).includes(invoice.id)});
    }
    const blocks=purchasedBlocks(sub);
    const revoked=new Set([...(data.revokedInvoices||[]),...(data.cycles||[]).filter(c=>c.revoked).map(c=>c.id)]);
    data.cycles=orderedCycles([...(data.cycles||[]),...cycles].map(c=>({...c,revoked:revoked.has(c.id)})));
    const ownCycles=data.cycles.filter(c=>c.subscription===sub.id);
    if(blocks)ownCycles.forEach((cycle,index)=>{cycle.worldBlock=blocks[index]||0;});
    // Keep one verified status per subscription. Replayed webhooks update the same record.
    data.billingHistory ||= {};
    for(const item of candidates){
      const paid=data.cycles.filter(c=>c.subscription===item.id);
      const previous=data.billingHistory[item.id]||{};
      const firstPaid=paid.map(c=>c.paidAt).filter(Number.isFinite).sort((a,b)=>a-b)[0];
      if(!firstPaid&&!previous.startedAt)continue;
      const endedAt=item.ended_at?item.ended_at*1000:null;
      const expectedInvoices=purchasedBlocks(item)?.length||3;
      const finalEnd=paid.length>=expectedInvoices?Math.max(...paid.map(c=>c.end)):null;
      const scheduledEnd=item.cancel_at?item.cancel_at*1000:null;
      const requested=item.cancellation_details?.reason==='cancellation_requested';
      const scheduledByUser=item.cancel_at_period_end||Boolean(requested&&scheduledEnd);
      const fullSeason=finalEnd&&endedAt&&endedAt>=finalEnd-1000;
      data.billingHistory[item.id]={id:item.id,startedAt:previous.startedAt||firstPaid,
        cancelScheduledAt:!endedAt&&scheduledByUser&&(!finalEnd||scheduledEnd!==finalEnd)?(scheduledEnd||Math.max(...paid.map(c=>c.end),0)||null):null,
        endedAt,status:item.status,reason:endedAt?(fullSeason?'season_end':requested?'voluntary':'other'):null};
    }
    // Set the complete finite schedule on the provider before granting access.
    // Retries recover the schedule attached to the subscription; a rollback cannot duplicate it.
    if(sub.status==='active'&&!sub.cancel_at_period_end&&!data.scheduleConfigured){
      if(readOnly)return {data,active:false,purchaseHeld};
      const schedule=sub.schedule?await stripe('subscription_schedules/'+sub.schedule):await stripe('subscription_schedules',{from_subscription:sub.id},'lup-season-'+sub.id);
      const start=schedule.current_phase?.start_date||schedule.phases?.[0]?.start_date;
      if(!start)throw new ApiError(503,'Estamos confirmando el calendario de tu temporada.','BILLING_UNAVAILABLE');
      const remaining=blocks ? blocks.length-ownCycles.filter(c=>c.start<start*1000).length : 4-data.cycles.length;
      await stripe('subscription_schedules/'+schedule.id,{end_behavior:'cancel',proration_behavior:'none','phases[0][start_date]':String(start),'phases[0][items][0][price]':env.STRIPE_PRICE_ID,'phases[0][items][0][quantity]':'1','phases[0][duration][interval]':'month','phases[0][duration][interval_count]':String(Math.max(1,Math.min(3,remaining))),'phases[0][proration_behavior]':'none'});
      data.scheduleConfigured=true;data.schedule=schedule.id;
    }
    const now=Date.now();
    const periodEnd=Math.max(0,...ownCycles.filter(c=>!c.revoked && c.start<=now).map(c=>c.end));
    const active=['active','canceled'].includes(sub.status)&&periodEnd>now&&!sub.pause_collection;
    data.periodEnd=periodEnd;data.active=active;
    if(readOnly)return {data,active,purchaseHeld};
    data.billingVerifiedAt=now;
    creditValdemarWelcome(data);
    if(active&&store.enqueueMail){
      for(const invoice of invoices.data||[]){
        const cycle=data.cycles.find(c=>c.id===invoice.id&&!c.revoked);
        if(cycle&&cycle.end>Date.now()&&invoice.customer_email)await store.enqueueMail(mailKey('subscription',invoice.id),invoice.customer_email,'subscription',{periodEnd:cycle.end,amountPaid:cycle.amountPaid,renewal:invoice.billing_reason==='subscription_cycle'});
      }
    }
    await store.saveMemberData(uid,data);
    await indexPurchase(store,uid,data);
    return {data,active,purchaseHeld,subscription:sub};
  }
  async function invalidateCheckout(store,uid,data,eligible){
    const pending=data.pendingSeasonCheckout;
    if(!pending?.id || pending.expiresAt<=Date.now() || (pending.partnerDiscount===true)===eligible)return;
    const path='checkout/sessions/'+encodeURIComponent(pending.id);
    let old=await stripe(path);
    if(old.status==='open'){
      try{await stripe(path+'/expire',{},'lup-expire-'+pending.id);}
      catch(error){old=await stripe(path);if(old.status==='open')throw error;}
    }
    if(old.status==='complete')return;
    data.pendingSeasonCheckout={...pending,expiresAt:0};
    await store.saveMemberData(uid,data);
  }
  function currentAtBoundary(sub,now){
    if(!sub || sub.status!=='active' || sub.pause_collection)return false;
    if(sub.cancel_at && sub.cancel_at*1000<=now)return false;
    return !sub.cancel_at_period_end || Number.isFinite(sub.cancel_at);
  }
  function settledPeriods(data){
    return (data.cycles||[]).filter(c=>c.id && c.subscription===data.subscription && !c.revoked &&
      !(data.revokedInvoices||[]).includes(c.id) && Number.isSafeInteger(c.amountPaid) && c.amountPaid>0 && c.start<c.end);
  }
  // At normal renewal the previous paid period ends before the new draft is
  // collected. Keep only the discount already earned at that exact boundary.
  // Current reciprocal consent and both live provider subscriptions must still agree.
  async function earnedRenewalBoundary(store,uid,data,sub){
    const now=Date.now(),periods=settledPeriods(data);
    const boundary=Math.max(0,...periods.filter(c=>c.start<=now).map(c=>c.end));
    if(!data.preferredPartnerEmail || data.partnerDiscountPeerKey!==emailKey(data.preferredPartnerEmail) ||
       data.partnerOfferEditorial || !currentAtBoundary(sub,now) ||
       boundary>now || now-boundary>=48*3600000)return null;
    const peer=await store.getMutualOfferPartner?.(uid,emailKey(data.preferredPartnerEmail));
    if(!peer || peer===uid)return null;
    const other=await store.getMemberData(peer,{readOnly:true});
    if(other.partnerOfferEditorial || !other.customer || !other.subscription ||
        !settledPeriods(other).some(c=>c.start<boundary && boundary<=c.end))return null;
    const otherSub=await stripe('subscriptions/'+encodeURIComponent(other.subscription));
    if(otherSub.id!==other.subscription || otherSub.metadata?.lup_uid!==peer ||
      !otherSub.items?.data?.some(item=>item.price?.id===env.STRIPE_PRICE_ID) || !currentAtBoundary(otherSub,now))return null;
    return Math.floor(boundary/1000);
  }
  async function reconcileOffer(withStore,uid,version){
    if(!configured)return;
    await withStore(async store=>{
      let data=await store.getMemberData(uid);
      if(version!==undefined && !await store.lockOfferJob(uid,version))return;
      await invalidateCheckout(store,uid,data,false);
      let preserve=null;
      if(data.customer){
        const current=await sync(store,uid);
        data=current.data;
        const subscription=current.subscription;
        const reviewable=subscription && (['active','past_due','paused','unpaid'].includes(subscription.status) || data.partnerDiscountPeerKey);
        if(reviewable){
          const offer=await accountOffer(store,uid,data.preferredPartnerEmail,data.partnerOfferEditorial===true);
          const eligible=subscription.status==='active' && !subscription.pause_collection && current.active && offer.eligible;
          if(!eligible)preserve=await earnedRenewalBoundary(store,uid,data,subscription);
          await applyRenewalOffer(stripe,{subscription,scheduleId:subscription.schedule||data.schedule,
            priceId:env.STRIPE_PRICE_ID,eligible,preserveBoundary:preserve});
          const peerKey=eligible?emailKey(data.preferredPartnerEmail):preserve?data.partnerDiscountPeerKey:null;
          if((data.partnerDiscountPeerKey||null)!==peerKey){
            data.partnerDiscountPeerKey=peerKey;
            await store.saveMemberData(uid,data);
          }
        }
      }
      if(version!==undefined){
        if(preserve)await store.retryOfferJob(uid,version);
        else await store.finishOfferJob(uid,version);
      }
    });
  }
  let processingOffers=false;
  return {
    configured,
    publicConfig(){return {checkoutAvailable:configured,termsUrl:publicDocumentUrl(env.BILLING_TERMS_URL),privacyUrl:publicDocumentUrl(env.BILLING_PRIVACY_URL),partnerOffer:publicPartnerOffer};},
    partnerOffer:accountOffer,
    async updatePartnerPreference(store,uid,beforeEmail,afterEmail,editorial=false){
      if(store.recordOfferPreference)await store.recordOfferPreference(uid,editorial?null:emailKey(afterEmail));
      return accountOffer(store,uid,afterEmail,editorial);
    },
    async refreshOfferIdentity(store,user,editorial=false){
      if(user.emailVerified!==true || !user.email || !store.recordOfferPurchase)return;
      const data=await store.getMemberData(user.userId);
      const key=emailKey(user.email);
      if(data.partnerVerifiedEmailKey!==key || (data.partnerOfferEditorial===true)!==editorial){
        data.partnerVerifiedEmailKey=key;data.partnerOfferEditorial=editorial;await store.saveMemberData(user.userId,data);
      }
      await indexPurchase(store,user.userId,data);
    },
    refreshPartnerOffer:reconcileOffer,
    async processPartnerOffers(withStore){
      if(!configured || processingOffers)return;
      processingOffers=true;
      try{
        await withStore(store=>store.expireOfferPurchases?.());
        await withStore(store=>store.scheduleChangedPartners?.());
        const jobs=await withStore(store=>store.listOfferJobs(10));
        for(const {uid,version} of jobs){
          try{await reconcileOffer(withStore,uid,version);}
          catch{await withStore(store=>store.retryOfferJob(uid,version));}
        }
      }finally{processingOffers=false;}
    },
    async membership(store,uid,options){const {data,active,purchaseHeld}=await sync(store,uid,options);return {canPlay:active,checkoutAvailable:configured,calendar:releaseCalendar(data.cycles||[],data.claims||[]),seasonAccess:worldSeasonAccess(data,{active,purchaseHeld}),periodEnd:data.periodEnd||null,waitlist:!!data.waitlist,hasCustomer:!!data.customer,partnerOffer:await accountOffer(store,uid,data.preferredPartnerEmail)};},
    async pollMembership(store,uid){
      const data=await store.getMemberData(uid,{readOnly:true});
      const now=Date.now();
      if(!configured || !data.customer)return {canPlay:false,seasonAccess:worldSeasonAccess(data,{active:false})};
      if(!data.billingVerifiedAt || data.billingVerifiedAt>now || now-data.billingVerifiedAt>=60000)return this.membership(store,uid);
      const active=data.active===true && data.periodEnd>now && (data.cycles||[]).some(c=>
        c.subscription===data.subscription && !c.revoked && c.start<=now && now<c.end);
      return {canPlay:active,seasonAccess:worldSeasonAccess(data,{active,now})};
    },
    async canPlay({store,uid,caseId}){const {data,active}=await sync(store,uid);if(active&&caseId&&caseId!=='habitacion-309'&&!releaseCalendar(data.cycles||[],data.claims||[]).unlockedCaseIds.includes(caseId))throw new ApiError(409,'Este caso está bloqueado. Cada pago mensual confirmado desbloquea los cuatro casos del siguiente bloque.','CASE_NOT_RELEASED');return active;},
    async claim(store,uid,caseId){
      const {data,active}=await sync(store,uid);
      if(!active)throw new ApiError(402,'Necesitas una suscripción activa para jugar.','SUBSCRIPTION_REQUIRED');
      if(caseId==='habitacion-309')return;
      data.claims ||= [];
      const calendar=releaseCalendar(data.cycles||[],data.claims);
      if(!calendar.unlockedCaseIds.includes(caseId))throw new ApiError(409,'Este caso pertenece a un bloque todavía bloqueado. Se abrirán cuatro casos más con el siguiente pago mensual confirmado.','CASE_NOT_RELEASED');
      if(data.claims.includes(caseId))return;
      data.claims.push(caseId);await store.saveMemberData(uid,data);
    },
    async checkout(store,user,input={}){
      if(!configured)throw new ApiError(503,'La contratación todavía no está abierta.','BILLING_UNAVAILABLE');
      await this.refreshOfferIdentity(store,user);
      const {data,active,purchaseHeld}=await sync(store,user.userId);
      if(active||purchaseHeld)throw new ApiError(409,'Ya hay un pase o un pago en curso. Consúltalo en Mi cuenta.','SUBSCRIPTION_IN_PROGRESS');
      const purchase=worldSeasonAccess(data,{active}).nextPurchase;
      if(!purchase)throw new ApiError(409,'Para contratar otra temporada, termina primero los doce casos de la anterior.','SEASON_NOT_AVAILABLE');
      if((input?.season??1)!==purchase.number)throw new ApiError(409,'Selecciona la temporada disponible antes de contratar.','SEASON_SELECTION_REQUIRED');
      const ordinals=purchase.blocks.map(n=>(purchase.number-1)*3+n).join(',');
      if(input.expectPartnerOffer===true)throw new ApiError(409,'La primera cuota cuesta 29,95 €. El descuento en pareja se aplica a las renovaciones.','PARTNER_OFFER_CHANGED');
      await invalidateCheckout(store,user.userId,data,false);
      // Reuse an open payment page across devices, even after the retry key's time window.
      if(data.pendingSeasonCheckout?.expiresAt>Date.now()){
        const pending=data.pendingSeasonCheckout;
        const prior=await stripe('checkout/sessions/'+encodeURIComponent(pending.id));
        if(prior.status==='open' && pending.blocks===ordinals && pending.partnerDiscount!==true && prior.url)return {url:prior.url};
        if(prior.status==='open')throw new ApiError(409,'Hay una solicitud anterior de pago en curso.','CHECKOUT_IN_PROGRESS');
        if(prior.status==='complete' && !data.cycles?.some(c=>c.subscription===prior.subscription))throw new ApiError(409,'Estamos confirmando tu pago.','CHECKOUT_IN_PROGRESS');
      }
      // Verify the advertised amount and monthly cadence before creating a Checkout session.
      const price=await stripe('prices/'+encodeURIComponent(env.STRIPE_PRICE_ID));
      if(price.unit_amount!==regularAmountCents||price.currency!=='eur'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.tax_behavior!=='inclusive')throw new ApiError(503,'El precio está pendiente de configuración.','BILLING_UNAVAILABLE');
      if(!data.customer){const customer=await stripe('customers',{email:user.email,'metadata[lup_uid]':user.userId},'lup-customer-'+user.userId);data.customer=customer.id;await store.saveMemberData(user.userId,data);}
      const minute=Math.floor(Date.now()/1800000);
      const seasonName=SEASON_NAMES[purchase.number-1];
      const description=seasonName+'. La primera cuota es de 29,95 € (IVA incluido). Cada cuota abre cuatro casos. El 50 % se aplica desde la siguiente factura si ambos tenéis un pase activo y os habéis elegido en el perfil. Este pase finaliza después de '+purchase.remainingCycles+(purchase.remainingCycles===1?' cuota.':' cuotas.')+' Puedes cancelar antes de renovar. La siguiente temporada se contrata por separado.';
      const previous=data.pendingSeasonCheckout?.id||'new';
      const attempt=mailKey('season-checkout',[user.userId,ordinals,'full-first',minute,previous].join('/'));
      const result=await stripe('checkout/sessions',{mode:'subscription',customer:data.customer,'line_items[0][price]':env.STRIPE_PRICE_ID,'line_items[0][quantity]':'1',
        'subscription_data[metadata][lup_uid]':user.userId,'subscription_data[metadata][lup_season]':String(purchase.number),'subscription_data[metadata][lup_blocks]':ordinals,client_reference_id:user.userId,success_url:origin+'/#planes?checkout=complete',cancel_url:origin+'/#planes',locale:'es','custom_text[submit][message]':description},'lup-checkout-'+attempt);
      if(result.id && result.expires_at){
        data.pendingSeasonCheckout={id:result.id,blocks:ordinals,expiresAt:result.expires_at*1000,partnerDiscount:false};
        await store.saveMemberData(user.userId,data);
      }
      return {url:result.url};
    },
    async portal(store,uid){
      const data=await store.getMemberData(uid,{readOnly:true});
      if(!data.customer)throw new ApiError(409,'Todavía no tienes una suscripción.');
      const session=await stripe('billing_portal/sessions',{customer:data.customer,
        configuration:env.STRIPE_PORTAL_CONFIGURATION,return_url:origin+'/#perfil?seccion=cuenta',locale:'es'});
      return {url:session.url};
    },
    async webhook(request,withStore){
      const raw=await request.text();if(!configured||!validSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return Response.json({error:'Firma no válida.'},{status:400});
      let event;try{event=JSON.parse(raw);}catch{return Response.json({error:'Evento no válido.'},{status:400});}
      const obj=event.data?.object;
      const charge=event.type==='charge.dispute.created' && obj?.charge
        ? await stripe('charges/'+encodeURIComponent(typeof obj.charge==='string'?obj.charge:obj.charge.id))
        : event.type==='charge.refunded'?obj:null;
      const customer=charge?.customer||obj?.customer;
      if(!customer)return Response.json({received:true});
      await withStore(async store=>{const uid=await store.findCustomer(typeof customer==='string'?customer:customer.id);if(!uid)return;
        if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
          const invoice=typeof charge?.invoice==='string'?charge.invoice:charge?.invoice?.id;
          let receipts=invoice?[invoice]:[];
          const intent=typeof charge?.payment_intent==='string'?charge.payment_intent:charge?.payment_intent?.id;
          if(!invoice && intent){
            const payments=await stripe('invoice_payments?payment[type]=payment_intent&payment[payment_intent]='+encodeURIComponent(intent)+'&limit=100');
            receipts=(payments.data||[]).map(entry=>typeof entry.invoice==='string'?entry.invoice:entry.invoice?.id).filter(Boolean);
          }
          if(receipts.length){const data=await store.getMemberData(uid);data.revokedInvoices=[...new Set([...(data.revokedInvoices||[]),...receipts])];await store.saveMemberData(uid,data);await indexPurchase(store,uid,data);}
        }
        await sync(store,uid);
        const billingStateChanged=event.type==='invoice.payment_failed' ||
          ['customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed'].includes(event.type) ||
          event.type==='customer.subscription.updated' &&
          ['status','pause_collection','cancel_at','cancel_at_period_end'].some(k=>Object.hasOwn(event.data?.previous_attributes||{},k));
        if(billingStateChanged)await store.queueOfferReview?.(uid);
      });
      if(['invoice.paid','invoice.payment_succeeded','invoice.payment_failed','charge.refunded','charge.dispute.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed'].includes(event.type)){
        // The underlying transaction already committed each impacted member's job.
        // A temporary provider lock is retried by the regular worker.
        await this.processPartnerOffers(withStore).catch(()=>{});
      }
      return Response.json({received:true});
    }
  };
}
