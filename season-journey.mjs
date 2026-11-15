import {ApiError} from './auth-provider.mjs';

// Row-major positions on the 3 x 4 seal. Read down each column to solve.
const fragments='URO LMACTBLUO'.replace(/ /g,'');
const answer='UMBRALOCULTO';
export const normalizeKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[\s-]/g,'');
export function seasonProgress(stories,sessions,uid,solvedAt=null){
  const season=stories.filter(s=>s.season===1).sort((a,b)=>a.episode-b.episode);
  const own=sessions.filter(s=>s.members?.some(m=>m.userId===uid));
  const stops=season.map(story=>{
    const matches=own.filter(s=>s.caseId===story.id);
    const finished=matches.find(s=>s.status==='finished'&&Object.hasOwn(story.endings,s.nodeId));
    const active=matches.find(s=>s.status==='active')||matches.find(s=>s.status==='waiting');
    const session=finished||active;
    return {caseId:story.id,episode:story.episode,completed:!!finished,sessionId:session?.id||null,
      status:finished?'completed':active?'in_progress':'available',decisions:session?.history?.length||0,
      totalDecisions:story.decisionCount||5,letter:finished?fragments[story.episode-1]:null};
  });
  const completed=stops.filter(s=>s.completed).length;
  return {total:season.length,completed,stops,solvedAt:completed===12?solvedAt:null,
    nextCaseId:stops.find(s=>s.status==='in_progress')?.caseId||stops.find(s=>!s.completed)?.caseId||null};
}
export async function readJourney(store,stories,uid,sessions){
  return seasonProgress(stories,sessions||await store.listSessions(uid),uid,await store.getSeasonSolved(uid,1));
}
export async function solveJourney(store,stories,uid,key){
  const progress=await readJourney(store,stories,uid);
  if(progress.total!==12||progress.completed!==12)throw new ApiError(409,'Termina las 12 experiencias para abrir el epílogo secreto.','SEASON_INCOMPLETE');
  if(typeof key!=='string'||key.length>80||normalizeKey(key)!==answer)throw new ApiError(400,'La clave todavía no encaja. Lee cada columna de arriba abajo, empezando por la izquierda.','KEY_INCORRECT');
  await store.saveSeasonSolved(uid,1);
  return readJourney(store,stories,uid);
}
