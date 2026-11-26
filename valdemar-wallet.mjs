import { ApiError } from './auth-provider.mjs';
import { seasonBlocks, SEASON_NAMES } from './progression.mjs';
import { hasCaseActivity,recordCaseActivity } from './season-activity.mjs';

export const WORLD_CASE_COUNT = SEASON_NAMES.length*12;
const CASES_PER_BLOCK = 4;

function createWallet() {
  return { welcomes: [], won: [], opened: [], second: [] };
}

function walletRecord(data, editorial) {
  data.valdemarSeasonOne ||= {};
  const scope = editorial ? 'editorial' : 'paid';
  return data.valdemarSeasonOne[scope] ||= createWallet();
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
    data.valdemarSeasonOne[scope]={...createWallet(),welcomes,clearedWelcomes:welcomes.length};
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
  return {availableCases,completed,seasons,nextPurchase};
}

// Called in the same locked member transaction as the verified Stripe update.
// The stable subscription ID survives renewals, retries and webhook replays.
export function creditValdemarWelcome(data, now = Date.now()) {
  const subscription = currentPaidSubscription(data, now);
  if (!subscription) return false;
  const wallet = walletRecord(data, false);
  if (wallet.welcomes.includes(subscription)) return false;
  wallet.welcomes.push(subscription);
  return true;
}

function snapshot(wallet) {
  const gift = Math.max(0,wallet.welcomes.length-(wallet.clearedWelcomes||0));
  return {
    gift,
    balance: gift + wallet.won.length - wallet.opened.length,
    won: [...wallet.won],
    opened: [...wallet.opened],
    second: [...wallet.second]
  };
}

// Caller supplies the authenticated owner and server-verified editorial role,
// checks access, and verifies the challenge before allowing "reward".
// getMemberData SELECTs FOR UPDATE and saveMemberData uses the same connection.
export async function valdemarWallet(store, ownerUid, { editorial = false, seasonAccess, summaryOnly = false }, op = 'read', caseId) {
  if (!['read', 'reward', 'open', 'second'].includes(op) ||
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
  if (editorial && !wallet.welcomes.length) {
    wallet.welcomes.push('editorial');
    changed = true;
  }
  if (op === 'reward' && !wallet.won.includes(caseId)) {
    wallet.won.push(caseId);
    recordCaseActivity(data,scope,caseId,alreadyStarted,'reward',now);
    changed = true;
  }
  if (op === 'open' && !wallet.opened.includes(caseId)) {
    if (snapshot(wallet).balance < 1) {
      throw new ApiError(409, 'Gana una llave en un reto paralelo para abrir este sobre.', 'NOT_ENOUGH_KEYS');
    }
    wallet.opened.push(caseId);
    recordCaseActivity(data,scope,caseId,alreadyStarted,'open',now);
    changed = true;
  }
  if (op === 'second' && !wallet.second.includes(caseId)) {
    if (!wallet.opened.includes(caseId)) {
      throw new ApiError(409, 'Abre primero el sobre de esta historia.', 'ENVELOPE_CLOSED');
    }
    wallet.second.push(caseId);
    recordCaseActivity(data,scope,caseId,alreadyStarted,'second',now);
    changed = true;
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
