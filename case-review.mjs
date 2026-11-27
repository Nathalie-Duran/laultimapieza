import {ApiError} from './auth-provider.mjs';
import {SEASON_NAMES} from './progression.mjs';
import {worldSeasonAccess} from './valdemar-wallet.mjs';

export function summarizeManagementAccount(row, now) {
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  const cycles = parse(row.cycles) || [];
  const active = row.active === 'true' || row.active === true;
  const progress = parse(row.progress) || {};
  const access = worldSeasonAccess({active,subscription:row.subscription,cycles,valdemarCaseProgress:{paid:progress}},{now});
  return {
    name:row.name, registeredAt:row.created_at,
    paidPeriod:active && cycles.some(c=>c.subscription===row.subscription && !c.revoked && c.start<=now && now<c.end),
    boards:access.seasons.map(s=>({number:s.number,blocks:s.paidBlocks.length,completed:s.completed,available:s.availableCases.length}))
  };
}

export async function saveCaseReview(store, uid, {caseId, status, note, version}) {
  if (!Number.isInteger(caseId) || caseId < 1 || caseId > SEASON_NAMES.length * 12 ||
      !['pending', 'reviewing', 'ready'].includes(status) ||
      typeof note !== 'string' || note.length > 500 || !Number.isSafeInteger(version) || version < 0) {
    throw new ApiError(400, 'Revisa el caso, el estado y la nota de hasta 500 caracteres.');
  }
  const owner = await store.getMemberData(uid);
  const reviews = owner.caseReviews ||= {};
  const current = reviews[caseId];
  const text = note.trim();
  if (current?.status === status && current.note === text) return current;
  if ((current?.version ?? 0) !== version) {
    throw new ApiError(409, 'Hay una revisión más reciente. Actualiza el panel antes de volver a guardar.');
  }
  const review = {status, note:text, version:version+1, updatedAt:new Date().toISOString()};
  reviews[caseId] = review;
  await store.saveMemberData(uid, owner);
  return review;
}
