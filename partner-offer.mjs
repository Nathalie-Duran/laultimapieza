import {createHash} from 'node:crypto';

export const regularAmountCents=2995;
export const publicPartnerOffer=Object.freeze({percentOff:50,regularAmountCents,amountCents:null,currency:'eur',appliesTo:'renewals'});
export function emailKey(email){
  return typeof email==='string' && email.trim()
    ? createHash('sha256').update(email.trim().toLowerCase(),'utf8').digest('hex') : null;
}
export async function accountOffer(store,uid,email,editorial=false){
  const key=emailKey(email);
  const eligible=!editorial && !!key && await store.hasOfferPurchase(uid,key);
  return {...publicPartnerOffer,eligible:!!eligible,status:editorial?'editorial':eligible?'eligible':key?'saved':'no_partner'};
}
export function paidUntil(data,now=Date.now()){
  const status=data.billingHistory?.[data.subscription]?.status;
  const active=data.partnerOfferEditorial!==true && data.active===true && data.customer && data.subscription &&
    (!status || status==='active');
  const current=active && Array.isArray(data.cycles)?data.cycles.filter(c=>c?.id && c.subscription===data.subscription && !c.revoked &&
    !(data.revokedInvoices||[]).includes(c.id) && Number.isSafeInteger(c.amountPaid) && c.amountPaid>0 &&
    Number.isFinite(c.start) && Number.isSafeInteger(c.end) && c.start<=now && now<c.end):[];
  const until=Math.min(Math.max(0,...current.map(c=>c.end)),Number.isFinite(data.periodEnd)?data.periodEnd:Infinity);
  return until>now?until:null;
}
export async function indexPurchase(store,uid,data){
  if(!store.recordOfferPurchase)return;
  const key=data.partnerVerifiedEmailKey || await store.getOfferIdentityKey(uid);
  if(key)await store.recordOfferPurchase(uid,key,paidUntil(data));
}

const objectId=value=>typeof value==='string'?value:value?.id;
// A smaller payment counts only if Stripe confirms the matching pass line and
// its one genuine subscription offer. The account's current preference is irrelevant
// when reconciling an older receipt that was paid under different conditions.
export function paidPassInvoice(invoice,line,couponId){
  if(!line || !['subscription_create','subscription_cycle'].includes(invoice.billing_reason)
      || invoice.currency!=='eur'|| !Number.isSafeInteger(invoice.amount_paid)
      || invoice.status && invoice.status!=='paid')return false;
  if(invoice.amount_paid>=regularAmountCents)return true;
  if(invoice.billing_reason!=='subscription_cycle' || ![1497,1498].includes(invoice.amount_paid) || invoice.total!==invoice.amount_paid || invoice.lines.data.length!==1
      || line.amount!==regularAmountCents || line.quantity!==undefined && line.quantity!==1)return false;
  const reductions=line.discount_amounts||[];
  if(reductions.length!==1 || reductions[0].amount!==regularAmountCents-invoice.amount_paid)return false;
  const applied=reductions[0].discount;
  const listed=invoice.discounts||[];
  const totals=invoice.total_discount_amounts||[];
  if(listed.length>1 || totals.length>1 || listed.some(entry=>objectId(entry)!==objectId(applied))
      || totals.some(entry=>objectId(entry.discount)!==objectId(applied) || entry.amount!==reductions[0].amount))return false;
  const discount=[applied,...listed,...totals.map(entry=>entry.discount)].find(entry=>
    entry && typeof entry==='object' && entry.id===objectId(applied) && (entry.source?.coupon || entry.coupon));
  const coupon=discount?.source?.coupon || discount?.coupon;
  return objectId(coupon)===couponId && (typeof coupon==='string' || coupon.percent_off===50 && coupon.duration==='forever');
}
