import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {finalPaidPhase} from './partner-stripe.mjs';

const id=value=>typeof value==='string'?value:value?.id;
const closed=new Set(['canceled','incomplete_expired']);
const conflict=()=>new ApiError(409,'El estado de tu suscripción ha cambiado. Revisa los datos antes de confirmar.','SUBSCRIPTION_CHANGED');
const unavailable=()=>new ApiError(503,'No hemos podido verificar la renovación. Vuelve a consultar tu suscripción.','CANCELLATION_UNAVAILABLE');
const periodEnd=sub=>sub.items?.data?.[0]?.current_period_end||sub.current_period_end;
const stamp=(secret,parts)=>createHmac('sha256',secret).update(JSON.stringify(parts)).digest('hex');

export function cancellationSummary(data){
 if(!data.customer)return {status:'none'};
 const sub=data.subscription;
 if(!sub)return {status:data.active?'unknown':'none'};
 const history=data.billingHistory?.[sub];
 if(history?.endedAt||closed.has(history?.status))return {status:'ended',effectiveAt:history?.endedAt||null};
 const effectiveAt=data.renewalStop?.subscription===sub?data.renewalStop.effectiveAt:history?.cancelScheduledAt;
 if(effectiveAt)return {status:effectiveAt>Date.now()?'scheduled':'ended',effectiveAt};
 return {status:history?.status==='active'?'active':'unknown'};
}

export async function subscriptionCancellation({stripe,secret,store,uid,confirmation,clock=Date.now,onScheduled}){
 const change=confirmation!==undefined;
 const data=await store.getMemberData(uid,{readOnly:!change});
 if(!data.customer)return {status:'none'};
 if(!secret)throw unavailable();
 // Use the member's locked billing record. New and older passes both carry the verified account ID.
 const bound=data.subscription;
 const subPath=bound?'subscriptions/'+encodeURIComponent(bound):null;
 let sub=subPath?await stripe(subPath):null;
 if(bound&&(sub?.id!==bound||id(sub.customer)!==data.customer||sub.metadata?.lup_uid!==uid))throw conflict();
 if(!sub||closed.has(sub.status)){
  const list=await stripe('subscriptions?customer='+encodeURIComponent(data.customer)+'&status=all&limit=100');
  const owned=list.data.filter(s=>id(s.customer)===data.customer&&s.metadata?.lup_uid===uid);
  const live=owned.filter(s=>!closed.has(s.status));
  if(list.has_more||live.length>1)throw unavailable();
  sub=live[0]||sub||owned[0];
 }
 if(!sub)return {status:'none'};
 if(id(sub.customer)!==data.customer||sub.metadata?.lup_uid!==uid)throw conflict();
 if(closed.has(sub.status))return {status:'ended',effectiveAt:sub.ended_at?sub.ended_at*1000:null};
 if(sub.status==='incomplete')return {status:'none'};
 if(sub.items?.has_more||sub.items?.data?.length!==1)throw unavailable();
 const item=sub.items.data[0],price=id(item.price)||id(item.plan),end=periodEnd(sub);
 if(!price||!Number.isSafeInteger(end)||end<=0||Number(item.quantity)!==1)throw unavailable();
 const now=clock(),parts=[uid,data.customer,sub.id,end];
 if(change){
   const [exp,sig]=String(confirmation||'').split('.');
   if(!/^\d{13}$/.test(exp)||sig?.length!==64||!/^[a-f0-9]{64}$/.test(sig)||Number(exp)<=now||Number(exp)>now+15*60000||
      !timingSafeEqual(Buffer.from(sig),Buffer.from(stamp(secret,[...parts,exp]))))throw conflict();
 }
 const scheduleId=id(sub.schedule),schedulePath=scheduleId?'subscription_schedules/'+encodeURIComponent(scheduleId):null;
 const schedule=schedulePath?await stripe(schedulePath):null;
 if(schedule&&(id(schedule.subscription)!==sub.id||id(schedule.customer)!==data.customer||schedule.status!=='active'))throw conflict();
 const cutoff=sub.cancel_at||null,prior=data.renewalStop?.subscription===sub.id?data.renewalStop:null;
 const marked=schedule?.metadata?.lup_stop_at===String(end)||sub.metadata?.lup_stop_at===String(end)||prior?.effectiveAt===end*1000;
 const finish=schedule?.end_behavior==='cancel'?schedule.phases.at(-1)?.end_date:null;
 const stopping=sub.cancel_at_period_end||Boolean(cutoff&&cutoff<=end)||Boolean(finish&&finish<=end);
 if(stopping){
   const effectiveAt=Math.min(cutoff||Infinity,finish||Infinity,end)*1000;
   const voluntary=marked||sub.cancel_at_period_end||sub.cancellation_details?.reason==='cancellation_requested';
   if(change&&voluntary&&!prior){data.renewalStop={subscription:sub.id,effectiveAt};await store.saveMemberData(uid,data);}
   if(change&&voluntary)await onScheduled?.(data.customer,sub.id,effectiveAt);
   return {status:voluntary?'scheduled':'ending',effectiveAt};
 }
 if(end*1000<=now)throw unavailable();
 if(!change){
   const expires=String(now+12*60000);
   return {status:'available',effectiveAt:end*1000,confirmation:expires+'.'+stamp(secret,[...parts,expires])};
 }
 const idem='lup-stop-'+sub.id+'-'+end;
 if(schedule){
   const start=schedule.current_phase?.start_date;
   const phases=(schedule.phases||[]).filter(p=>p.start_date>=start&&p.start_date<end);
   if(!phases.length||phases[0].start_date!==start||phases.at(-1).end_date<end||
      phases.some((p,i)=>i>0&&phases[i-1].end_date!==p.start_date))throw conflict();
   const form=Object.assign({end_behavior:'cancel',proration_behavior:'none','metadata[lup_stop_at]':String(end)},...phases.map((phase,i)=>finalPaidPhase(phase,i,end,price)));
   const saved=await stripe(schedulePath,form,idem);
   if(saved.id!==scheduleId||saved.end_behavior!=='cancel'||saved.phases?.at(-1)?.end_date!==end)throw unavailable();
 }else{
   const saved=await stripe('subscriptions/'+encodeURIComponent(sub.id),{cancel_at_period_end:'true',proration_behavior:'none','metadata[lup_stop_at]':String(end)},idem);
   if(saved.id!==sub.id||!saved.cancel_at_period_end)throw unavailable();
 }
 data.subscription=sub.id;data.renewalStop={subscription:sub.id,effectiveAt:end*1000};
 if(schedule)data.scheduleConfigured=true;
 await store.saveMemberData(uid,data);
 await onScheduled?.(data.customer,sub.id,end*1000);
 return {status:'scheduled',effectiveAt:end*1000};
}
