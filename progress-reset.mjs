import {ApiError} from './auth-provider.mjs';
import {resetValdemarProgress} from './valdemar-wallet.mjs';
import {endPair} from './partner-api.mjs';

function survivingSession(session, uid) {
  session.members=session.members.filter(member=>member.userId!==uid);
  if(!session.members.length)return null;
  // The remaining investigator can manage the session with their own pass.
  if(session.ownerId===uid)session.ownerId=session.members[0].userId;
  session.mode='solo';
  if(session.status==='waiting')session.status='active';
  session.inviteActive=false;
  session.votes=(session.votes||[]).filter(vote=>vote.userId!==uid);
  for(const field of ['firstVotes','firstVoteEffects']){
    if(session[field])delete session[field][uid];
  }
  for(const entry of session.history||[]){
    if(entry.preferences)delete entry.preferences[uid];
    if(entry.preferenceEffects)delete entry.preferenceEffects[uid];
  }
  for(const clue of [session.investigation,...Object.values(session.investigation?.stages||{})]){
    if(clue?.solvedBy===uid)delete clue.solvedBy;
  }
  session.version++;
  session.updatedAt=new Date().toISOString();
  return session;
}

export function checkRetiredSession(data, id) {
  if(data.progressReset?.retiredSessions?.includes(id))
    throw new ApiError(410,'Esta partida pertenece a un progreso que ya reiniciaste.','PROGRESS_RESET');
}

export async function resetPersonalProgress(store, uid, input, editorial, email='') {
  if(input.confirmation!=='REINICIAR' || typeof input.requestId!=='string' ||
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(input.requestId))
    throw new ApiError(400,'Confirma el reinicio desde tu cuenta.');
  const data=await store.getMemberData(uid);
  const receipt=data.progressReset||{requests:[],retiredSessions:[]};
  if(receipt.requests.includes(input.requestId))return {reset:true};
  if(store.listPartners){
    const teams=await store.listPartners(uid,email.trim().toLowerCase(),Date.now());
    for(const team of teams){
      const current=await store.getPartner(team.id);
      if(current && (current.ownerId===uid || current.guestId===uid || current.status==='pending' && current.email===email.trim().toLowerCase()))
        await endPair(store,current);
    }
  }
  const ids=await store.lockSessionIdsForReset(uid);
  for(const id of ids){
    const record=await store.getSession(id);
    if(!record?.session.members.some(member=>member.userId===uid)){
      await store.removeMember(id,uid);
      continue;
    }
    const remaining=survivingSession(record.session,uid);
    if(remaining){
      await store.removeMember(id,uid);
      await store.setInvite(id,null,null);
      await store.saveSession(remaining);
    }else{
      await store.deleteSoloSession(id,uid);
    }
  }
  await store.setActive(uid,null);
  await store.clearSeasonReward(uid);
  delete data.seasonEnding;
  delete data.claims;
  resetValdemarProgress(data,{editorial});
  // Replay from stage one, retaining first-win receipts and historical counts.
  for(const scope of editorial?['paid','editorial']:['paid']){
    for(const result of Object.values(data.editorialMiniProgress?.[scope]||{}))result.completed=[];
  }
  data.progressReset={
    requests:[...receipt.requests,input.requestId],
    retiredSessions:[...new Set([...receipt.retiredSessions,...ids])],
    at:new Date().toISOString()
  };
  await store.saveMemberData(uid,data);
  return {reset:true};
}
