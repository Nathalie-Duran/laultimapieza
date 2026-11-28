import {ApiError} from './auth-provider.mjs';
import './web/motor-aventuras.js';

const A='A', B='B', both='both';
export const MANSION_MISSION_REWARDS=Object.freeze({nox:1,diario:1,jardin:1,puerta:2});
const freshState = () => ({version:1,current:1,completed:false,items:[],flags:[],missions:[],panels:[],revision:0});
export function startMansion(record) {
  if (!record.mansion) record.mansion = freshState();
  return record.mansion;
}

// The edition is parsed JSON from the authenticated season release.
export function createMansionRules(edition) {
  if (edition?.version!==1 || edition.levels?.length!==15 || edition.rooms?.length!==8 ||
      edition.chapters?.length!==5 || edition.hints?.length!==15 || edition.explanations?.length!==14 ||
      edition.sideQuests?.length!==4 || !edition.panelAnswers || !edition.panelHints ||
      !edition.letterEntry || !edition.conclusion || !edition.endingEntries || !edition.objects ||
      !edition.recordings?.carta || !edition.recordings?.radio || !edition.recordings?.final) {
    throw new ApiError(503,'Esta edición de la mansión todavía no está disponible.','MANSION_EDITION_UNAVAILABLE');
  }
  const {title:episodeTitle,chapters,letterEntry,conclusion,endingEntries,recordings:media,panelAnswers,panelHints,
    rooms,objects,levels,hints,explanations,sideQuests}=edition;
  const permitted = (role,world) => role === 'solo' || world === both || world === role;
  function checkRole(role) {
    if (!['solo',A,B].includes(role)) throw new ApiError(403,'Este puesto no tiene acceso a la mansión.');
  }
  const seenBy = (all,role) => all.filter(entry => permitted(role,entry.role)).map(entry=>({...entry,world:entry.role}));
  const flagFor = (stage,id) => stage + ':' + id;
  const hasAction = (s,id) => s.flags.includes(flagFor(s.current,id));
  function mansionHint(record,tier,role='solo') {
    checkRole(role);
    const s=record.mansion || freshState();
    if (s.completed) throw new ApiError(409,'El episodio ya ha terminado.');
    if (tier==='open') return hints[s.current-1][0];
    if (tier==='second') return hints[s.current-1][1];
    if (tier!=='solution') throw new ApiError(400,'Ese nivel de pista no existe.');
    if (s.current!==15) return explanations[s.current-1];
    const {A:first,B:second}=panelHints;
    if (role===A) return first;
    if (role===B) return second;
    return first+' '+second;
  }
  const available = (s,action) => (action.needs || []).every(item => s.items.includes(item));
  function actionViews(level,s,role) {
    return (level.actions || []).filter(action=>permitted(role,action.role)).map(action=>{
      const done=hasAction(s,action.id), ready=available(s,action);
      return {id:action.id,label:action.label,role:action.role,world:action.role,enabled:!done&&ready,done,
        reason:done?'Ya se ha realizado.':ready?'':'Falta un objeto en el inventario compartido.'};
    });
  }
  function controlViews(level,s,role) {
    if (level !== levels[14]) return level.controls;
    return level.controls.map(control => control.id === 'panel' ?
      {...control,options:control.options.filter(opt=>permitted(role,opt.value)&&!s.panels.includes(opt.value))} : control);
  }
  function missionView(q,s,role) {
    const open=s.current>=q.min;
    return {id:q.id,title:q.title,room:q.room,available:open,completed:s.missions.includes(q.id),
      brief:open?q.brief:'Se abre al llegar a la prueba '+q.min+'.',reward:MANSION_MISSION_REWARDS[q.id],
      evidence:open?seenBy(q.evidence,role):[],controls:open?q.controls:[],actions:[]};
  }

  function inspectMansion(record,role='solo',roomId) {
    checkRole(role);
    const s=record.mansion || freshState(), level=levels[s.current-1];
    const room=rooms.find(r=>r[0]===(roomId || level.room));
    if (!room) throw new ApiError(404,'Ese lugar no figura en el plano.');
    if (room[2]>s.current) throw new ApiError(409,'Ese lugar todavía está cerrado.');
    const [id,title,,placeA,placeB]=room;
    const stage=s.completed?null:{number:s.current,chapter:chapters[Math.floor((s.current-1)/3)],title:level.title,
      room:level.room,brief:level.brief,evidence:seenBy(level.evidence,role),controls:controlViews(level,s,role),
      actions:actionViews(level,s,role),
      ready:(level.requires || []).every(action=>hasAction(s,action))};
    if (stage && s.current===15) stage.panelStatus={A:s.panels.includes(A),B:s.panels.includes(B)};
    const placeEvidence=[{role:A,title:'Casa habitada',text:placeA},{role:B,title:'Casa abandonada',text:placeB}];
    for (const visited of levels.slice(0,s.current)) {
      if (visited.room===id) placeEvidence.push(...visited.evidence);
    }
    const recordings={carta:media.carta};
    if (s.current>=12) recordings.radio=media.radio;
    if (s.current===12 && stage) stage.recording=media.radio;
    if (s.completed) recordings.final=media.final;
    return {title:episodeTitle,intro:letterEntry.text,role,recordings,current:s.current,total:15,
      completed:s.completed,revision:s.revision,stage,
      rooms:rooms.map(([id,title,min])=>({id,title,unlocked:min<=s.current})),
      explore:{id,title,evidence:seenBy(placeEvidence,role),actions:stage?.room===id?stage.actions:[]},
      inventory:s.items.filter(key=>!['A','B'].includes(role)||!['A','B'].includes(objects[key][1])||objects[key][1]===role).map(key=>({id:key,title:objects[key][0],world:objects[key][1]})),
      missions:sideQuests.map(q=>missionView(q,s,role)),
      album:[letterEntry,...sideQuests.filter(q=>s.missions.includes(q.id)).map(q=>q.album),...(s.completed?endingEntries:[])],
      ending:s.completed?{...conclusion,recording:media.final}:null};
  }

  const unchanged = (message,correct=false) => ({changed:false,correct,message});
  function commit(record,s,result) {
    s.revision++;
    record.mansion=s;
    return {changed:true,correct:true,...result};
  }
  function updateItems(s,effect) {
    if (!effect) return;
    if (effect.take) s.items=s.items.filter(id=>!effect.take.includes(id));
    if (effect.give && !s.items.includes(effect.give)) s.items.push(effect.give);
  }
  const plain = x => x!==null && typeof x==='object' && !Array.isArray(x);
  function radioCall(level) {
    const signal=level?.evidence?.find(entry=>typeof entry.signal==='string')?.signal;
    if(!signal||!Object.hasOwn(level.solution,'llamada')||Object.keys(level.solution).length!==1)return null;
    const pulses=signal.split('/').map(group=>group.trim());
    const key={};
    for(const entry of level.evidence){
      for(const [,letter,pattern] of (entry.text||'').matchAll(/\b([A-ZÑ])\s+([·–—-]+)(?=[;,.\s]|$)/gu)){
        key[pattern.replace(/·/g,'.').replace(/[–—]/g,'-')]=letter;
      }
    }
    if(!pulses.every(pulse=>Object.hasOwn(key,pulse)))return null;
    const rule={tipo:'mecanica',mecanica:'morse',parametros:{pulsos:pulses,tabla:key}};
    // Older or custom editions may use a different alphabet and keep their authored reading.
    return globalThis.MotorAventuras.evaluarPrueba(rule,level.solution.llamada)?rule:null;
  }
  function matches(answers,solution,level) {
    if(!plain(answers)||Object.values(answers).some(value=>typeof value!=='string'||value.length>100))return false;
    const engine=globalThis.MotorAventuras;
    const radio=radioCall(level);
    if(radio){
      return engine.intentoValido({tipo:'campos',campos:['llamada']},answers)&&
        engine.evaluarPrueba(radio,answers.llamada.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
    }
    return engine.evaluarPrueba({tipo:'campos',respuesta:solution,normalizacion:'texto'},answers);
  }
  function finishPanel(record,s,role,answers) {
    const panel=answers?.panel;
    if (panel!==A && panel!==B) return unchanged('Selecciona el panel que vas a enclavar.');
    if (!permitted(role,panel)) throw new ApiError(403,'Este panel se opera desde la otra casa.');
    if (s.panels.includes(panel)) return unchanged('Este panel ya está enclavado. Falta el de la otra casa.',true);
    if (!matches(answers,{panel,secuencia:panelAnswers[panel]})) return unchanged('El panel no retiene la señal. Comprueba el orden de las marcas.');
    s.panels.push(panel);
    if (s.panels.length===1) return commit(record,s,{message:'La señal queda retenida. Falta enclavar el panel de la otra casa.'});
    s.completed=true;
    return commit(record,s,{message:'Los dos paneles se han sincronizado.',stageCompleted:15,completed:true});
  }

  function applyMansion(record,role,input) {
    checkRole(role);
    if (!plain(input) || !['act','solve'].includes(input.op)) throw new ApiError(400,'Operación de la mansión desconocida.');
    const s=record.mansion || freshState();
    if (input.stage!==s.current) throw new ApiError(409,'La prueba ha cambiado. Actualiza el episodio antes de continuar.');
    if (input.mission!==undefined) {
      const mission=sideQuests.find(q=>q.id===input.mission);
      if (!mission) throw new ApiError(404,'Esta misión no figura en el cuaderno.');
      if (s.current<mission.min) throw new ApiError(409,'El lugar de la misión todavía está cerrado.');
      if (input.op!=='solve') throw new ApiError(400,'Esta misión requiere una respuesta.');
      if (s.missions.includes(mission.id)) return unchanged('La misión ya figura en el álbum.',true);
      if (!matches(input.answers,mission.solution)) return unchanged('Las dos pistas todavía no encajan con esa respuesta.');
      s.missions.push(mission.id);
      return commit(record,s,{message:mission.album.text,mission:mission.id,missionReward:MANSION_MISSION_REWARDS[mission.id]});
    }
    if (s.completed) return unchanged('El desenlace ya está guardado en el álbum.',true);
    const level=levels[s.current-1];
    if (input.op==='act') {
      const action=(level.actions || []).find(a=>a.id===input.action);
      if (!action) throw new ApiError(400,'Esa interacción no está disponible en esta prueba.');
      if (!permitted(role,action.role)) throw new ApiError(403,'Esa interacción pertenece a la otra casa.');
      if (hasAction(s,action.id)) return unchanged('La interacción ya está guardada.',true);
      if (!available(s,action)) return unchanged('Busca los objetos que faltan antes de hacer eso.');
      updateItems(s,action);
      s.flags.push(flagFor(s.current,action.id));
      return commit(record,s,{message:action.give?'Has obtenido '+objects[action.give][0]+'.':'La interacción ha quedado guardada.'});
    }
    if (s.current===15) return finishPanel(record,s,role,input.answers);
    if (!(level.requires || []).every(key=>hasAction(s,key))) return unchanged('Aún hay una interacción pendiente en la sala.');
    if (!matches(input.answers || {},level.solution,level)) return unchanged('El mecanismo no responde. Contrasta otra vez las pistas de las dos casas.');
    const stageCompleted=s.current;
    updateItems(s,level.onWin);
    s.current++;
    return commit(record,s,{stageCompleted,message:'Prueba resuelta. Se ha abierto el siguiente paso.'});
  }
  return {inspectMansion,applyMansion,mansionHint};
}
