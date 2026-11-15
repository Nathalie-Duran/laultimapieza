import {ApiError} from './auth-provider.mjs';
export const normalise=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[−–]/g,'-').replace(/\s*([|:-])\s*/g,'$1').replace(/\s+/g,' ').trim();
export function checkPuzzle(session,story,input,uid){
  if(!session.members.some(m=>m.userId===uid))throw new ApiError(404,'Partida no disponible.');
  const p=story.puzzle,seen=new Set([session.nodeId,...session.history.map(h=>h.nodeId)]);
  if(!p||!p.unlockNodes.some(n=>seen.has(n)))throw new ApiError(409,'Descubre las pruebas antes de resolver el enigma.');
  session.investigation ||= {attempts:0,hints:0,solvedAt:null};
  const progress=session.investigation;
  if(input.action==='hint'){
    progress.hints=Math.min((p.hints||[]).length,progress.hints+1);
    return {correct:!!progress.solvedAt,hints:p.hints.slice(0,progress.hints),message:'Ayuda guardada. Puedes volver a consultarla.'};
  }
  if(typeof input.answer!=='string'||input.answer.length>200)throw new ApiError(400,'Escribe una respuesta de hasta 200 caracteres.');
  const correct=[p.answer,...(p.aliases||[])].some(a=>normalise(a)===normalise(input.answer));
  progress.attempts++;
  if(correct&&!progress.solvedAt){progress.solvedAt=new Date().toISOString();progress.solvedBy=uid;}
  return {correct,hints:p.hints.slice(0,progress.hints),message:correct?p.explanation:'Todavía hay una contradicción. Revisa las pruebas o abre una ayuda; puedes volver a intentarlo.'};
}
export const CASE_ORDER=['cartas-medianoche','ultima-funcion','archivo-ausencias','marea-quieta','frecuencia-17','jardin-invierno','retrato-prestado','mesa-13','tren-detenido','ciudad-invisible','ultimo-coro','ultima-invitacion'];
// Each verified payment assigns the next fixed block immediately. Revocations keep
// their ordinal so refunding month one never renumbers month two's cases.
export function releaseCalendar(cycles,claims=[],now=Date.now()){
  const unique=[...new Map(cycles.filter(c=>Number(c.start)<Number(c.end)).map(c=>[c.id,c])).values()].sort((a,b)=>a.start-b.start).slice(0,3);
  const blocks=unique.map((c,i)=>({id:c.id,number:i+1,start:Number(c.start),end:Number(c.end),revoked:!!c.revoked,caseIds:CASE_ORDER.slice(i*4,i*4+4)}));
  const paid=blocks.filter(c=>!c.revoked&&c.start<=now),unlockedCaseIds=paid.flatMap(c=>c.caseIds);
  const current=paid.filter(c=>c.end>now).at(-1)||null;
  const claimed=[...new Set(claims)].filter(id=>unlockedCaseIds.includes(id));
  const slots=paid.flatMap(c=>c.caseIds.map(caseId=>({at:c.start,cycle:c.id,caseId})));
  return {released:unlockedCaseIds.length,used:claimed.length,available:unlockedCaseIds.length-claimed.length,claimed,nextAt:null,slots,blocks,unlockedCaseIds,currentCaseIds:current?.caseIds||[],currentCycle:current?.number||null,currentStart:current?.start||null,currentEnd:current?.end||null};
}
