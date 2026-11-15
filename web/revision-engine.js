(function(root){
  'use strict';
  const engine=root.GameEngine;
  engine.revise=function(session,userId,index,choiceId,version){
    if(session.ownerId!==userId)throw new Error('Solo quien creó la partida puede cambiar el recorrido compartido.');
    if(!Number.isInteger(version)||version!==session.version)throw new Error('La partida ha cambiado. Revisa su recorrido antes de editarlo.');
    if(!['active','finished'].includes(session.status)||!Number.isInteger(index)||index<0||index>=session.history.length)throw new Error('Elige una decisión ya completada.');
    const story=root.STORIES.find(s=>s.id===session.caseId),entry=session.history[index];
    if(!story.nodes[entry.nodeId]?.choices.some(c=>c.id===choiceId))throw new Error('La elección no pertenece a esta escena.');
    if(entry.choiceId===choiceId)throw new Error('Ese es el camino que ya habéis elegido.');
    const next=structuredClone(session),removed=next.history.splice(index);
    // Subtract original snapshots, never recalculate old awards using revised story text.
    for(const member of next.members)for(const key of engine.KEYS){
      const lost=removed.reduce((sum,h)=>sum+(h.preferenceEffects?.[member.userId]?.[key]??(h.preferenceEffects?0:engine.KEYS.indexOf(key)<3?h.effects?.[key]||0:0)),0);
      member.scores[key]=Math.max(0,(member.scores[key]||0)-lost);
    }
    next.nodeId=entry.nodeId;next.status='active';next.version++;
    next.votes=[];next.firstVotes={};next.firstVoteEffects={};
    next.revisionCount=(next.revisionCount||0)+1;
    // The case-wide deduction remains valid; hints and attempts are not erased.
    return engine.vote(next,userId,next.nodeId,choiceId,next.version);
  };
})(globalThis);
