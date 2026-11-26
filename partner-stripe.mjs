import {randomUUID} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';

export const PARTNER_COUPON='lup-companero-50-v1';
const id=value=>typeof value==='string'?value:value?.id;
const pathId=value=>encodeURIComponent(value);
const conflict=()=>new ApiError(503,'No se ha podido confirmar el descuento de pareja en esta suscripción.','PARTNER_BILLING_CONFLICT');

export async function ensurePartnerCoupon(stripe){
  const path='coupons/'+PARTNER_COUPON;
  const read=()=>stripe(path,undefined,undefined,{allowMissing:true});
  let coupon=await read();
  if(!coupon){
    try{
      coupon=await stripe('coupons',{id:PARTNER_COUPON,name:'Pase en pareja · 50 %',percent_off:'50',duration:'forever'},'lup-create-'+PARTNER_COUPON);
    }catch(error){
      // Both workers may have observed a missing coupon, or the response was lost.
      coupon=await read();
      if(!coupon)throw error;
    }
  }
  if(coupon.id!==PARTNER_COUPON||coupon.valid!==true||Number(coupon.percent_off)!==50||
     coupon.duration!=='forever'||coupon.amount_off!=null||coupon.redeem_by!=null||
     coupon.max_redemptions!=null||coupon.applies_to?.products?.length)throw conflict();
  return coupon;
}

function discountRef(entry,known){
  const discount=entry?.discount || entry;
  const discountId=id(discount);
  const source=id(entry?.coupon)||id(discount?.source?.coupon)||id(discount?.coupon);
  const coupon=source || known.get(discountId);
  if(source && discountId)known.set(discountId,source);
  return {coupon,discountId,request:discountId?{discount:discountId}:entry?.promotion_code?{promotion_code:id(entry.promotion_code)}:source?{coupon:source}:null};
}

// A null result means this object already has the desired discounts.
function discountsFor(entries,eligible,known){
  const refs=(entries||[]).map(entry=>discountRef(entry,known));
  if(refs.some(ref=>!ref.coupon))throw conflict();
  const own=refs.filter(ref=>ref.coupon===PARTNER_COUPON);
  const others=refs.filter(ref=>ref.coupon!==PARTNER_COUPON);
  if(eligible && others.length)throw conflict();
  if(eligible)return own.length===1?null:[{coupon:PARTNER_COUPON}];
  if(!own.length)return null;
  if(others.some(ref=>!ref.request))throw conflict();
  return others.map(ref=>ref.request);
}

function put(form,key,value){
  if(value==null)return;
  if(Array.isArray(value)){for(const [index,item] of value.entries())put(form,key+'['+index+']',item);}
  else if(typeof value==='object'){for(const [name,item] of Object.entries(value))put(form,key+'['+name+']',item);}
  else form[key]=String(value);
}
function putDiscounts(form,key,items){
  if(items.length)put(form,key,items);
  else form[key]='';
}
function priceId(line){
  return id(line.price)||id(line.pricing?.price_details?.price)||id(line.plan);
}
function singlePass(items,price){
  return Array.isArray(items) && items.length===1 && priceId(items[0])===price && Number(items[0].quantity)===1;
}

function phaseForm(phase,index,eligible,known,price){
  if(!singlePass(phase.items,price)||!Number.isSafeInteger(phase.start_date)||!Number.isSafeInteger(phase.end_date)||
     phase.end_date<=phase.start_date||phase.add_invoice_items?.length)throw conflict();
  const item=phase.items[0];
  if(item.discounts?.length && eligible)throw conflict();
  const prefix='phases['+index+']',form={};
  // A schedule update replaces phase attributes. Preserve the original boundaries
  // and settings, including payment, tax and metadata selected in the provider.
  const kept={start_date:phase.start_date,end_date:phase.end_date,proration_behavior:phase.proration_behavior||'none',
    currency:phase.currency,billing_cycle_anchor:phase.billing_cycle_anchor,description:phase.description,
    metadata:phase.metadata,collection_method:phase.collection_method,trial_end:phase.trial_end,
    application_fee_percent:phase.application_fee_percent,default_payment_method:id(phase.default_payment_method),
    default_tax_rates:phase.default_tax_rates?.map(id),on_behalf_of:id(phase.on_behalf_of),
    transfer_data:phase.transfer_data && {...phase.transfer_data,destination:id(phase.transfer_data.destination)},
    invoice_settings:phase.invoice_settings,billing_thresholds:phase.billing_thresholds};
  if(phase.automatic_tax)kept.automatic_tax={enabled:phase.automatic_tax.enabled,liability:phase.automatic_tax.liability};
  const row={price,quantity:1,metadata:item.metadata,tax_rates:item.tax_rates?.map(id),billing_thresholds:item.billing_thresholds};
  if(item.discounts?.length)row.discounts=item.discounts.map(entry=>{
    const request=discountRef(entry,known).request;if(!request)throw conflict();return request;
  });
  kept.items=[row];put(form,prefix,kept);
  const replacement=discountsFor(phase.discounts,eligible,known);
  const keptDiscounts=replacement || (phase.discounts||[]).map(entry=>{
    const request=discountRef(entry,known).request;if(!request)throw conflict();return request;
  });
  putDiscounts(form,prefix+'[discounts]',keptDiscounts);
  return {form,changed:replacement!==null};
}

// Re-read before each reconciliation and express every mutation as an absolute
// setting. The same payer can legitimately go on/off/on within Stripe's key TTL.
const write=(stripe,path,form)=>stripe(path,form,'lup-pair-change-'+randomUUID());

async function updateDrafts(stripe,sub,price,eligible,known,ensure,preserveBoundary){
  let cursor;
  do{
    const list=await stripe('invoices?subscription='+pathId(sub.id)+'&status=draft&limit=100&expand[]=data.discounts'+(cursor?'&starting_after='+pathId(cursor):''));
    for(const invoice of list.data){
      if(invoice.status!=='draft'||invoice.billing_reason!=='subscription_cycle')continue;
      const owner=id(invoice.parent?.subscription_details?.subscription)||id(invoice.subscription);
      if(owner!==sub.id||invoice.currency!=='eur'||invoice.lines?.has_more||!singlePass(invoice.lines?.data,price))throw conflict();
      const line=invoice.lines.data[0];
      if(line.proration||line.parent?.subscription_item_details?.proration||line.amount<=0)throw conflict();
      if(eligible && line.discounts?.length)throw conflict();
      const next=discountsFor(invoice.discounts,eligible,known);
      if(next===null)continue;
      // The regular renewal may precede the paid webhook for this same period.
      // Keep only an already-applied offer on that exact renewal.
      if(preserveBoundary && line.period?.start===preserveBoundary &&
         invoice.discounts?.some(entry=>discountRef(entry,known).coupon===PARTNER_COUPON))continue;
      if(eligible)await ensure();
      const form={};putDiscounts(form,'discounts',next);
      const path='invoices/'+pathId(invoice.id);
      try{await write(stripe,path,form);}
      catch(error){
        const latest=await stripe(path);
        // Stripe may automatically finalize a draft after the list response.
        if(latest.status==='draft')throw error;
      }
    }
    cursor=list.has_more?list.data.at(-1)?.id:null;
    if(list.has_more&&!cursor)throw conflict();
  }while(cursor);
}

export async function applyRenewalOffer(stripe,{subscription,scheduleId,priceId:price,eligible,preserveBoundary}){
  const subId=id(subscription);
  if(!subId||!price||typeof eligible!=='boolean')throw conflict();
  const subPath='subscriptions/'+pathId(subId);
  const sub=await stripe(subPath+'?expand[]=discounts&expand[]=items.data.discounts');
  if(sub.id!==subId||sub.items?.has_more||!singlePass(sub.items?.data,price))throw conflict();
  const ended=['canceled','incomplete_expired'].includes(sub.status);
  eligible=eligible && sub.status==='active' && !sub.pause_collection;
  const handoff=!eligible && Number.isSafeInteger(preserveBoundary) && preserveBoundary>0 &&
    sub.status==='active' && !sub.pause_collection && !sub.cancel_at_period_end ? preserveBoundary : null;
  const known=new Map(),current=discountsFor(sub.discounts,eligible,known);
  if(eligible && sub.items.data[0].discounts?.length)throw conflict();
  let coupon;
  const ensure=()=>coupon||=(ensurePartnerCoupon(stripe));
  // A released schedule ID in our previous snapshot is no longer authoritative.
  const schedule=Object.hasOwn(sub,'schedule')?id(sub.schedule):id(scheduleId);
  if(!ended && !sub.cancel_at_period_end && !handoff){
    if(schedule){
      const path='subscription_schedules/'+pathId(schedule);
      const live=await stripe(path);
      if(id(live.subscription)!==subId||live.status!=='active'||live.end_behavior!=='cancel'||!live.current_phase)throw conflict();
      const phases=live.phases.filter(p=>p.start_date>=live.current_phase.start_date);
      if(!phases.length||phases[0].start_date!==live.current_phase.start_date||phases[0].end_date!==live.current_phase.end_date)throw conflict();
      // A shorter, explicitly set cancellation must not be extended by rewriting this schedule.
      if(sub.cancel_at && sub.cancel_at!==phases.at(-1).end_date)throw conflict();
      const updates=phases.map((p,i)=>phaseForm(p,i,eligible,known,price));
      if(current!==null || updates.some(p=>p.changed)){
        if(eligible)await ensure();
        await write(stripe,path,Object.assign({proration_behavior:'none',end_behavior:'cancel'},...updates.map(p=>p.form)));
      }
    }else if(current!==null){
      if(eligible)await ensure();
      const form={proration_behavior:'none'};putDiscounts(form,'discounts',current);await write(stripe,subPath,form);
    }
  }
  await updateDrafts(stripe,sub,price,eligible,known,ensure,handoff);
}
