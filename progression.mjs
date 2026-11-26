import {ApiError} from './auth-provider.mjs';
export const normalise=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[−–]/g,'-').replace(/\s*([|:-])\s*/g,'$1').replace(/\s+/g,' ').trim();
export function checkPuzzle(session,story,input,uid){
  if(!session.members.some(m=>m.userId===uid))throw new ApiError(404,'Partida no disponible.');
  const p=story.puzzle,seen=new Set([session.nodeId,...session.history.map(h=>h.nodeId)]);
  if(!p||!p.unlockNodes.some(n=>seen.has(n)))throw new ApiError(409,'Descubre las pruebas antes de resolver el enigma.');
  session.investigation ||= {attempts:0,hints:0,solvedAt:null};
  const progress=session.investigation;
  if(p.stages){
    progress.stages ||= {};
    const current=p.stages.find(x=>!progress.stages[x.id]?.solvedAt);
    if(!current)return {correct:true,complete:true,message:'Las deducciones están guardadas. Completa las decisiones para cerrar la historia.'};
    if((current.requiredDecisions||0)>session.history.length)throw new ApiError(409,'Acordad primero la decisión pendiente en Historia.');
    if(input.stage&&input.stage!==current.id)throw new ApiError(409,'La investigación ha avanzado. Abre la prueba actual antes de responder.');
    const part=progress.stages[current.id] ||= {attempts:0,hints:0,solvedAt:null};
    if(input.action==='hint'){
      part.hints=Math.min(current.hints.length,part.hints+1);progress.hints=(progress.hints||0)+1;
      return {correct:false,complete:false,hints:current.hints.slice(0,part.hints),message:'Ayuda guardada para esta prueba.'};
    }
    if(typeof input.answer!=='string'||input.answer.length>200)throw new ApiError(400,'Escribe una respuesta de hasta 200 caracteres.');
    const tidy=value=>normalise(value).replace(/[.,]/g,'').replace(/^CARRER (?:DE )?|^CALLE (?:DE )?/,'');
    const correct=[current.answer,...(current.aliases||[])].some(a=>tidy(a)===tidy(input.answer));
    part.attempts++;progress.attempts=(progress.attempts||0)+1;
    if(correct){part.solvedAt=new Date().toISOString();part.solvedBy=uid;}
    const complete=p.stages.every(x=>progress.stages[x.id]?.solvedAt);
    if(complete&&!progress.solvedAt){progress.solvedAt=new Date().toISOString();progress.solvedBy=uid;}
    return {correct,complete,stage:current.id,hints:current.hints.slice(0,part.hints),message:correct?current.explanation:'Esa conexión aún no encaja. Contrasta las fuentes de esta prueba o abre una ayuda.'};
  }
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
export const SEASON_NAMES=Object.freeze(['Valdemar','El Tablero de Ámbar','Umbravía','La Necrópolis del Sol Velado']);
// Each verified payment assigns the next fixed block immediately. Revocations keep
// their ordinal so refunding month one never renumbers month two's cases.
export function orderedCycles(cycles){
  return [...new Map(cycles.filter(c=>Number(c.start)<Number(c.end)).map(c=>[c.id,c])).values()].sort((a,b)=>a.start-b.start);
}
// Historic subscriptions were sold for Valdemar alone. Later checkouts name the
// exact blocks purchased, including a replacement for a refunded block.
export function seasonBlocks(cycles,now=Date.now()){
  const byBlock = new Map();
  let legacyBlock = 0;
  const rank = cycle => cycle.start <= now ? (cycle.revoked ? 1 : 3) : 2;
  for(const cycle of orderedCycles(cycles)){
    const explicit = Object.hasOwn(cycle,'worldBlock');
    const number = explicit ? cycle.worldBlock : ++legacyBlock;
    if(!Number.isInteger(number) || number<1 || number>(explicit?SEASON_NAMES.length*3:3)) continue;
    const old = byBlock.get(number);
    if(!old || rank(cycle)>=rank(old)) byBlock.set(number,{...cycle,number});
  }
  return [...byBlock.values()].sort((a,b)=>a.number-b.number);
}
export function releaseCalendar(cycles,claims=[],now=Date.now()){
  const blocks=seasonBlocks(cycles,now).filter(c=>c.number<=3).map(c=>({id:c.id,number:c.number,start:Number(c.start),end:Number(c.end),revoked:!!c.revoked,caseIds:CASE_ORDER.slice((c.number-1)*4,c.number*4)}));
  const paid=blocks.filter(c=>!c.revoked&&c.start<=now),unlockedCaseIds=paid.flatMap(c=>c.caseIds);
  const current=paid.filter(c=>c.end>now).at(-1)||null;
  const claimed=[...new Set(claims)].filter(id=>unlockedCaseIds.includes(id));
  const slots=paid.flatMap(c=>c.caseIds.map(caseId=>({at:c.start,cycle:c.id,caseId})));
  return {released:unlockedCaseIds.length,used:claimed.length,available:unlockedCaseIds.length-claimed.length,claimed,nextAt:null,slots,blocks,unlockedCaseIds,currentCaseIds:current?.caseIds||[],currentCycle:current?.number||null,currentStart:current?.start||null,currentEnd:current?.end||null};
}
