import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {orderedCycles,releaseCalendar,SEASON_NAMES} from './progression.mjs';
import {mailKey} from './mail-service.mjs';
import {creditValdemarWelcome,worldSeasonAccess} from './valdemar-wallet.mjs';

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
  const origin='https://laultimapieza.es';
  async function stripe(path,values,idem){
    if(!configured)throw new ApiError(503,'La contratación todavía no está abierta.','BILLING_UNAVAILABLE');
    const response=await fetcher('https://api.stripe.com/v1/'+path,{method:values?'POST':'GET',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-10-28.endive',...(values?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(values?{body:new URLSearchParams(values)}:{}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new ApiError(503,'No podemos comprobar el pago ahora. Inténtalo de nuevo.','BILLING_UNAVAILABLE');
    return response.json();
  }
  async function sync(store,uid){
    const data=await store.getMemberData(uid);
    if(!configured||!data.customer)return {data,active:false};
    const subs=await stripe('subscriptions?customer='+encodeURIComponent(data.customer)+'&status=all&limit=10');
    const candidates=subs.data.filter(s=>s.metadata?.lup_uid===uid&&s.items?.data?.some(i=>i.price?.id===env.STRIPE_PRICE_ID));
    const purchaseHeld=candidates.some(s=>!['canceled','incomplete_expired'].includes(s.status));
    const sub=candidates.find(s=>s.status==='active')||candidates[0];
    if(!sub)return {data,active:false};
    if(data.subscription!==sub.id){data.scheduleConfigured=false;data.schedule=null;}
    data.subscription=sub.id;
    const invoices=await stripe('invoices?subscription='+encodeURIComponent(sub.id)+'&status=paid&limit=100');
    const cycles=[];
    for(const invoice of invoices.data||[]){
      const line=invoice.lines?.data?.find(l=>(l.pricing?.price_details?.price||l.price?.id)===env.STRIPE_PRICE_ID);
      if(!line||!['subscription_create','subscription_cycle'].includes(invoice.billing_reason)||invoice.amount_paid<2995||invoice.currency!=='eur')continue;
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
    creditValdemarWelcome(data);
    if(active&&store.enqueueMail){
      for(const invoice of invoices.data||[]){
        const cycle=data.cycles.find(c=>c.id===invoice.id&&!c.revoked);
        if(cycle&&cycle.end>Date.now()&&invoice.customer_email)await store.enqueueMail(mailKey('subscription',invoice.id),invoice.customer_email,'subscription',{periodEnd:cycle.end,renewal:invoice.billing_reason==='subscription_cycle'});
      }
    }
    await store.saveMemberData(uid,data);
    return {data,active,purchaseHeld};
  }
  return {
    configured,
    publicConfig(){return {checkoutAvailable:configured,termsUrl:configured?env.BILLING_TERMS_URL:null,privacyUrl:configured?env.BILLING_PRIVACY_URL:null};},
    async membership(store,uid){const {data,active,purchaseHeld}=await sync(store,uid);return {canPlay:active,checkoutAvailable:configured,calendar:releaseCalendar(data.cycles||[],data.claims||[]),seasonAccess:worldSeasonAccess(data,{active,purchaseHeld}),periodEnd:data.periodEnd||null,waitlist:!!data.waitlist,hasCustomer:!!data.customer};},
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
      const {data,active,purchaseHeld}=await sync(store,user.userId);
      if(active||purchaseHeld)throw new ApiError(409,'Ya hay un pase o un pago en curso. Consúltalo en Mi cuenta.','SUBSCRIPTION_IN_PROGRESS');
      const purchase=worldSeasonAccess(data,{active}).nextPurchase;
      if(!purchase)throw new ApiError(409,'Para contratar otra temporada, termina primero los doce casos de la anterior.','SEASON_NOT_AVAILABLE');
      if((input?.season??1)!==purchase.number)throw new ApiError(409,'Selecciona la temporada disponible antes de contratar.','SEASON_SELECTION_REQUIRED');
      const ordinals=purchase.blocks.map(n=>(purchase.number-1)*3+n).join(',');
      // Reuse an open payment page across devices, even after the retry key's time window.
      if(data.pendingSeasonCheckout?.expiresAt>Date.now()){
        const pending=data.pendingSeasonCheckout;
        const prior=await stripe('checkout/sessions/'+encodeURIComponent(pending.id));
        if(prior.status==='open' && pending.blocks===ordinals && prior.url)return {url:prior.url};
        if(prior.status==='open')throw new ApiError(409,'Hay una solicitud anterior de pago en curso.','CHECKOUT_IN_PROGRESS');
        if(prior.status==='complete' && !data.cycles?.some(c=>c.subscription===prior.subscription))throw new ApiError(409,'Estamos confirmando tu pago.','CHECKOUT_IN_PROGRESS');
      }
      // Verify the advertised amount and monthly cadence before creating a Checkout session.
      const price=await stripe('prices/'+encodeURIComponent(env.STRIPE_PRICE_ID));
      if(price.unit_amount!==2995||price.currency!=='eur'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.tax_behavior!=='inclusive')throw new ApiError(503,'El precio está pendiente de configuración.','BILLING_UNAVAILABLE');
      if(!data.customer){const customer=await stripe('customers',{email:user.email,'metadata[lup_uid]':user.userId},'lup-customer-'+user.userId);data.customer=customer.id;await store.saveMemberData(user.userId,data);}
      const minute=Math.floor(Date.now()/1800000);
      const seasonName=SEASON_NAMES[purchase.number-1];
      const description=seasonName+'. Cuatro casos por cuota de 29,95 € al mes (IVA incluido). Este pase finaliza después de '+purchase.remainingCycles+(purchase.remainingCycles===1?' cuota.':' cuotas.')+' Puedes cancelar antes de renovar. La siguiente temporada se contrata por separado.';
      const result=await stripe('checkout/sessions',{mode:'subscription',customer:data.customer,'line_items[0][price]':env.STRIPE_PRICE_ID,'line_items[0][quantity]':'1','subscription_data[metadata][lup_uid]':user.userId,'subscription_data[metadata][lup_season]':String(purchase.number),'subscription_data[metadata][lup_blocks]':ordinals,client_reference_id:user.userId,success_url:origin+'/#planes?checkout=complete',cancel_url:origin+'/#planes',locale:'es','custom_text[submit][message]':description},'lup-checkout-'+user.userId+'-'+ordinals+'-'+minute);
      if(result.id && result.expires_at){
        data.pendingSeasonCheckout={id:result.id,blocks:ordinals,expiresAt:result.expires_at*1000};
        await store.saveMemberData(user.userId,data);
      }
      return {url:result.url};
    },
    async portal(store,uid){const data=await store.getMemberData(uid);if(!data.customer)throw new ApiError(409,'Todavía no tienes una suscripción.');return {url:(await stripe('billing_portal/sessions',{customer:data.customer,configuration:env.STRIPE_PORTAL_CONFIGURATION,return_url:origin+'/#perfil',locale:'es'})).url};},
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
          if(invoice){const data=await store.getMemberData(uid);data.revokedInvoices=[...new Set([...(data.revokedInvoices||[]),invoice])];await store.saveMemberData(uid,data);}
        }
        await sync(store,uid);
      });return Response.json({received:true});
    }
  };
}
