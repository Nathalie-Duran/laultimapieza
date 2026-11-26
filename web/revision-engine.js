(function(root){
  'use strict';
  const engine=root.GameEngine;
  function freezeLegacyCredits(session){
    for(const entry of session.history){
      if(entry.preferenceEffects)continue;
      const credits=Object.fromEntries(engine.KEYS.slice(0,3).map(key=>[key,entry.effects?.[key]||0]));
      entry.preferenceEffects=Object.fromEntries(session.members.map(member=>[member.userId,{...credits}]));
    }
  }
  engine.changePlayMode=function(session,userId,mode,version){
    if(session.ownerId!==userId)throw new Error('Solo quien creó la partida puede cambiar su modalidad.');
    if(!['solo','duo'].includes(mode))throw new Error('Elige una modalidad disponible.');
    if(!Number.isInteger(version)||version!==session.version)throw new Error('La partida ha cambiado. Revisa el equipo actual.');
    if(!['active','waiting'].includes(session.status))throw new Error('Esta historia ya tiene un final.');
    if(session.mode===mode)return session;
    const next=structuredClone(session);
    freezeLegacyCredits(next);
    next.mode=mode;
    next.status=mode==='solo'?'active':'waiting';
    next.inviteActive=false;
    next.members=next.members.filter(member=>member.userId===userId);
    next.votes=(next.votes||[]).filter(vote=>vote.userId===userId);
    for(const key of ['firstVotes','firstVoteEffects']){
      next[key]=Object.fromEntries(Object.entries(next[key]||{}).filter(([uid])=>uid===userId));
    }
    next.version++;
    next.updatedAt=new Date().toISOString();
    return next;
  };
  engine.joinTeam=function(session,profile){
    if(session.mode!=='duo'||session.status!=='waiting'||session.members.length!==1||session.ownerId===profile.userId)throw new Error('Esta partida ya tiene su equipo.');
    const next=structuredClone(session);
    freezeLegacyCredits(next);
    const scores=engine.zero();
    for(const entry of next.history){
      const credit=entry.preferenceEffects[profile.userId];
      if(credit)for(const key of engine.KEYS)scores[key]+=credit[key]||0;
    }
    next.members.push({...profile,role:'B',scores});
    next.status='active';
    next.inviteActive=false;
    next.version++;
    next.updatedAt=new Date().toISOString();
    return next;
  };
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
