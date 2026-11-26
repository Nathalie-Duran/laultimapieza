import { ApiError } from './auth-provider.mjs';
import { releaseCalendar } from './progression.mjs';

function createWallet() {
  return { welcomes: [], won: [], opened: [], second: [] };
}

function walletRecord(data, editorial) {
  data.valdemarSeasonOne ||= {};
  const scope = editorial ? 'editorial' : 'paid';
  return data.valdemarSeasonOne[scope] ||= createWallet();
}

function currentPaidSubscription(data, now) {
  if (data.active !== true || typeof data.subscription !== 'string' || !data.subscription) return null;
  const paidPeriod = (data.cycles || []).some(cycle =>
    cycle.subscription === data.subscription && !cycle.revoked &&
    cycle.start <= now && now < cycle.end
  );
  return paidPeriod ? data.subscription : null;
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
  const gift = wallet.welcomes.length;
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
export async function valdemarWallet(store, ownerUid, { editorial = false }, op = 'read', caseId) {
  if (!['read', 'reward', 'open', 'second'].includes(op) ||
      (op !== 'read' && (!Number.isInteger(caseId) || caseId < 1 || caseId > 12))) {
    throw new ApiError(400, 'Elige una acción y una historia de la temporada.');
  }
  const data = await store.getMemberData(ownerUid);
  const now = Date.now();
  let changed = false;
  if (!editorial) {
    if (!currentPaidSubscription(data, now)) {
      throw new ApiError(402, 'Necesitas una suscripción activa para usar el llavero.', 'SUBSCRIPTION_REQUIRED');
    }
    if (op !== 'read') {
      const month = Math.ceil(caseId / 4);
      const released = releaseCalendar(data.cycles || [], [], now).blocks.some(block =>
        block.number === month && !block.revoked && block.start <= now
      );
      if (!released) throw new ApiError(409, 'Esta historia se abrirá con su bloque mensual.', 'CASE_NOT_RELEASED');
    }
    changed = creditValdemarWelcome(data, now);
  }
  const wallet = walletRecord(data, editorial);
  if (editorial && !wallet.welcomes.length) {
    wallet.welcomes.push('editorial');
    changed = true;
  }
  if (op === 'reward' && !wallet.won.includes(caseId)) {
    wallet.won.push(caseId);
    changed = true;
  }
  if (op === 'open' && !wallet.opened.includes(caseId)) {
    if (snapshot(wallet).balance < 1) {
      throw new ApiError(409, 'Gana una llave en un reto paralelo para abrir este sobre.', 'NOT_ENOUGH_KEYS');
    }
    wallet.opened.push(caseId);
    changed = true;
  }
  if (op === 'second' && !wallet.second.includes(caseId)) {
    if (!wallet.opened.includes(caseId)) {
      throw new ApiError(409, 'Abre primero el sobre de esta historia.', 'ENVELOPE_CLOSED');
    }
    wallet.second.push(caseId);
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
