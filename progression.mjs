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
// Each paid monthly cycle earns four choices, at day 0, 7, 14 and 21.
// Replaying a selected case never spends another choice. Only verified receipts count.
export function releaseCalendar(cycles,claims=[],now=Date.now()){
  const valid=cycles.filter(c=>!c.revoked&&Number(c.start)<Number(c.end)).sort((a,b)=>a.start-b.start);
  const slots=valid.flatMap(c=>[0,7,14,21].map(day=>({at:Number(c.start)+day*86400000,cycle:c.id}))).sort((a,b)=>a.at-b.at).slice(0,12);
  const released=slots.filter(s=>s.at<=now).length;
  return {released,used:new Set(claims).size,available:Math.max(0,released-new Set(claims).size),claimed:claims,nextAt:slots.find(s=>s.at>now)?.at||null,slots};
}
