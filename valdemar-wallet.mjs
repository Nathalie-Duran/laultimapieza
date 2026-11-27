import { ApiError } from './auth-provider.mjs';
import { seasonBlocks, SEASON_NAMES } from './progression.mjs';
import { hasCaseActivity,recordCaseActivity } from './season-activity.mjs';

export const WORLD_CASE_COUNT = SEASON_NAMES.length*12;
const CASES_PER_BLOCK = 4;
export const hintFees = Object.freeze({open:1,second:2,solution:3});
const hintFields = {open:'opened',second:'second',solution:'solution'};

// Cases in the final block of each board use the advanced reward.
export function parallelPrize(id) { return (id-1)%12 >= 8 ? 2 : 1; }

function createWallet() {
  return { welcomes: [], won: [], opened: [], second: [] };
}

function walletRecord(data, editorial) {
  data.valdemarSeasonOne ||= {};
  const scope = editorial ? 'editorial' : 'paid';
  return data.valdemarSeasonOne[scope] ||= createWallet();
}

function ledger(wallet) {
  if (!wallet.entries) {
    wallet.legacyEnvelopes = [...wallet.opened];
    const historic = (kind,id,amount,caseId=null) => ({kind,id,amount,caseId,at:null});
    wallet.entries = [
      ...wallet.welcomes.slice(wallet.clearedWelcomes||0).map(id=>historic('welcome',id,1)),
      ...wallet.won.map(id=>historic('reward',id,1,id)),
      ...wallet.opened.map(id=>historic('open',id,-1,id)),
      ...wallet.second.map(id=>historic('second',id,0,id))
    ];
  }
  return wallet.entries;
}

function addEntry(wallet,kind,id,amount,caseId=null,at=Date.now()) {
  const entries=ledger(wallet);
  if(entries.some(row=>row.kind===kind && row.id===id))return false;
  entries.push({kind,id,amount,caseId,at});
  return true;
}

export function creditSecretMission(data,scope,id,amount) {
  if(!Number.isInteger(id)||id<1||id>WORLD_CASE_COUNT||![1,2,3].includes(amount))throw new Error('Premio de misión no válido.');
  return addEntry(walletRecord(data,scope==='editorial'),'mission',id,amount,id);
}

export function creditPublishedChallenge(data,scope,challengeId,caseId,advanced=false) {
  if(typeof challengeId!=='string'||!challengeId||!Number.isInteger(caseId)||caseId<1||caseId>WORLD_CASE_COUNT)throw new Error('Reto publicado no válido.');
  return addEntry(walletRecord(data,scope==='editorial'),'challenge',challengeId,advanced?2:1,caseId);
}

// The caller owns the locked member record and commits the classic and Valdemar reset together.
export function resetValdemarProgress(data,{editorial=false,now=Date.now()}={}) {
  const subscriptions = (data.cycles || [])
    .filter(c=>!c.revoked && c.start<=now && c.end>c.start && typeof c.subscription==='string' && c.subscription)
    .map(c=>c.subscription);
  for(const scope of editorial ? ['paid','editorial'] : ['paid']){
    if(data.valdemarCaseProgress)delete data.valdemarCaseProgress[scope];
    const wallet=walletRecord(data,scope==='editorial');
    const welcomes=[...new Set([...wallet.welcomes,...(scope==='paid'?subscriptions:['editorial'])])];
    // Retain the identities of previously granted welcomes across repeated resets and billing sync.
    const ignoredRenewals=scope==='paid' ? [...new Set((data.cycles||[]).filter(c=>c.start<=now && c.renewal).map(renewalPeriod))] : [];
    data.valdemarSeasonOne[scope]={...createWallet(),welcomes,clearedWelcomes:welcomes.length,ignoredRenewals};
  }
}

function currentPaidSubscription(data, now) {
  if (data.active !== true || typeof data.subscription !== 'string' || !data.subscription) return null;
  const paidPeriod = (data.cycles || []).some(cycle =>
    cycle.subscription === data.subscription && !cycle.revoked &&
    cycle.start <= now && now < cycle.end
  );
  return paidPeriod ? data.subscription : null;
}

function renewalPeriod(cycle) { return cycle.subscription+'/'+cycle.start; }

export function worldSeasonAccess(data,{editorial=false,now=Date.now(),active=Boolean(currentPaidSubscription(data,now)),purchaseHeld=false}={}) {
  const paid = seasonBlocks(data.cycles || [],now).filter(c=>!c.revoked && c.start<=now);
  const records = data.valdemarCaseProgress?.[editorial?'editorial':'paid'] || {};
  const completed = [], availableCases = [], seasons = [];
  let previousReady = true, nextPurchase = null;
  for(let number=1;number<=SEASON_NAMES.length;number++){
    const base = (number-1)*12;
    const ids = Array.from({length:12},(_,i)=>base+i+1);
    const finished = ids.filter(id=>records[id]?.choice);
    const cycles = paid.filter(c=>Math.ceil(c.number/3)===number);
    const paidBlocks = cycles.map(c=>c.number-(number-1)*3);
    const finishAccess = !editorial && !active && previousReady && cycles.length===3 && cycles.every(c=>c.end<=now);
    const available = editorial ? ids : previousReady && (active || finishAccess)
      ? ids.filter(id=>paidBlocks.includes(Math.ceil((id-base)/CASES_PER_BLOCK))) : [];
    if(!editorial && !active && !purchaseHeld && previousReady && !nextPurchase && paidBlocks.length<3){
      const blocks = [1,2,3].filter(n=>!paidBlocks.includes(n));
      nextPurchase = {number,blocks,remainingCycles:blocks.length};
    }
    seasons.push({number,previousCompleted:number===1?12:seasons.at(-1).completed,previousReady,
      completed:finished.length,paidBlocks,availableCases:available,finishAccess,
      seal:{earned:finished.map(id=>id-base),complete:finished.length===12}});
    availableCases.push(...available);
    completed.push(...finished);
    previousReady = previousReady && finished.length===12;
  }
  return {availableCases,completed,seasons,nextPurchase,billingPlan:data.billingPlan||'season'};
}

// Called in the same locked member transaction as the verified Stripe update.
// The stable subscription ID survives renewals, retries and webhook replays.
export function creditValdemarWelcome(data, now = Date.now()) {
  const subscription = currentPaidSubscription(data, now);
  if (!subscription) return false;
  const wallet = walletRecord(data, false);
  let changed=false;
  if (!wallet.welcomes.includes(subscription)) {
    addEntry(wallet,'welcome',subscription,1,null,now);
    wallet.welcomes.push(subscription);
    changed=true;
  }
  for(const cycle of data.cycles||[]){
    if(cycle.plan==='four-boards-v1' && cycle.renewal && cycle.id && !cycle.revoked && cycle.start<=now &&
        !wallet.ignoredRenewals?.includes(renewalPeriod(cycle))) {
      changed=addEntry(wallet,'renewal',renewalPeriod(cycle),1,null,cycle.start)||changed;
    }
  }
  return changed;
}

function snapshot(wallet) {
  const gift = Math.max(0,wallet.welcomes.length-(wallet.clearedWelcomes||0));
  const entries=ledger(wallet);
  return {
    gift,
    balance: entries.reduce((sum,row)=>sum+row.amount,0),
    won: [...wallet.won],
    opened: [...wallet.opened],
    second: [...wallet.second],
    solution:[...(wallet.solution||[])],
    legacyEnvelopes:[...wallet.legacyEnvelopes],
    history:entries.map(({kind,caseId,amount,at})=>({kind,caseId,amount,at}))
  };
}

// Caller supplies the authenticated owner and server-verified editorial role,
// checks access, and verifies the challenge before allowing "reward".
// getMemberData SELECTs FOR UPDATE and saveMemberData uses the same connection.
export async function valdemarWallet(store, ownerUid, { editorial = false, seasonAccess, summaryOnly = false, pair, checkPrice=false, quotedCost }, op = 'read', caseId) {
  if (!['read', 'reward', 'open', 'second','solution'].includes(op) ||
      (op !== 'read' && (!Number.isInteger(caseId) || caseId < 1 || caseId > WORLD_CASE_COUNT))) {
    throw new ApiError(400, 'Elige una acción y una historia de la temporada.');
  }
  const data = await store.getMemberData(ownerUid);
  const now = Date.now();
  let changed = false;
  if (!editorial) {
    const access = seasonAccess || worldSeasonAccess(data,{now});
    const active = currentPaidSubscription(data, now);
    if (!active && !access.availableCases.length && !(summaryOnly && op==='read')) {
      throw new ApiError(402, 'Necesitas una suscripción activa para usar el llavero.', 'SUBSCRIPTION_REQUIRED');
    }
    if (op !== 'read' && !access.availableCases.includes(caseId)) {
      throw new ApiError(409, 'Esta historia se abrirá con su bloque mensual.', 'CASE_NOT_RELEASED');
    }
    changed = creditValdemarWelcome(data, now);
  }
  const wallet = walletRecord(data, editorial);
  const scope = editorial ? 'editorial' : 'paid';
  const alreadyStarted = op !== 'read' && hasCaseActivity(data,scope,caseId);
  ledger(wallet);
  if (editorial && !wallet.welcomes.length) {
    addEntry(wallet,'welcome','editorial',1);
    wallet.welcomes.push('editorial');
    changed = true;
  }
  if (op === 'reward' && !wallet.won.includes(caseId)) {
    addEntry(wallet,'reward',caseId,parallelPrize(caseId),caseId);
    wallet.won.push(caseId);
    recordCaseActivity(data,scope,caseId,alreadyStarted,'reward',now);
    changed = true;
  }
  if (Object.hasOwn(hintFields,op) && !pair?.progress?.sharedHints?.includes(op)) {
    const purchased=wallet[hintFields[op]] ||= [];
    if (!purchased.includes(caseId)) {
      const price=op==='second' && wallet.legacyEnvelopes.includes(caseId) ? 0 : hintFees[op];
      if (snapshot(wallet).balance < price)throw new ApiError(409,'Te faltan llaves para esta pista. Puedes ganarlas en los retos paralelos.','NOT_ENOUGH_KEYS');
      if(checkPrice && price && price!==quotedCost)throw new ApiError(409,'Actualiza la página para consultar el precio actual de esta pista.','HINT_PRICE_CHANGED');
      addEntry(wallet,op,caseId,price ? -price : 0,caseId);
      purchased.push(caseId);
      recordCaseActivity(data,scope,caseId,alreadyStarted,op,now);
      changed=true;
    }
    if(pair) {
      (pair.progress.sharedHints ||= []).push(op);
      await store.savePartner(pair);
    }
  }
  if (changed) await store.saveMemberData(ownerUid, data);
  return snapshot(wallet);
}

// Only retry known rolled-back lock failures. A lost connection during COMMIT
// is ambiguous and the caller can replay the same idempotent user action.
export async function withValdemarTransaction(withStore, operation) {
  for (let attempt = 0; ; attempt++) {
    try { return await withStore(operation); }
    catch (error) {
      const retryable = error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT';
      if (!retryable || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
}
