import {ApiError} from './auth-provider.mjs';
import {createMansionNotebook} from './mansion-notebook.mjs';
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
  const notebook=createMansionNotebook(rooms,levels);
  const assignments=new Map();
  for(const level of levels.filter(item=>item.contributions)){
    const fields=new Map();
    for(const world of [A,B]){
      const part=level.contributions[world];
      if(!part?.objective || !Array.isArray(part.controlIds) || !part.controlIds.length)
        throw new ApiError(503,'Falta preparar uno de los papeles de esta prueba.','MANSION_EDITION_UNAVAILABLE');
      for(const id of part.controlIds){
        if(fields.has(id) || !level.controls.some(control=>control.id===id) || !Object.hasOwn(level.solution||{},id))
          throw new ApiError(503,'Los mandos de esta prueba están pendientes de revisión.','MANSION_EDITION_UNAVAILABLE');
        fields.set(id,world);
      }
    }
    if(fields.size!==level.controls.length || fields.size!==Object.keys(level.solution).length)
      throw new ApiError(503,'Esta prueba tiene una decisión sin asignar.','MANSION_EDITION_UNAVAILABLE');
    assignments.set(level,fields);
  }
  const permitted = (role,world) => role === 'solo' || world === both || world === role;
  function checkRole(role) {
    if (!['solo',A,B].includes(role)) throw new ApiError(403,'Este puesto no tiene acceso a la mansión.');
  }
  const seenBy = (all,role) => all.filter(entry => permitted(role,entry.role)).map(entry=>{
    const id=notebook.idFor(entry);
    return {...entry,...(id?{id}:{}),world:entry.role};
  });
  const flagFor = (stage,id) => stage + ':' + id;
  const hasAction = (s,id) => s.flags.includes(flagFor(s.current,id));
  function mansionHint(record,tier,role='solo') {
    checkRole(role);
    const s=record.mansion || freshState();
    if (s.completed) throw new ApiError(409,'El episodio ya ha terminado.');
    if (tier==='open') return hints[s.current-1][0];
    if (tier==='second') return hints[s.current-1][1];
    if (tier!=='solution') throw new ApiError(400,'Ese nivel de pista no existe.');
    const level=levels[s.current-1];
    if (level.contributions && role!=='solo'){
      const part=level.contributions[role];
      if(part.solutionHint) return part.solutionHint;
      return part.controlIds.map(id=>{
        const control=level.controls.find(field=>field.id===id);
        const answer=level.solution[id];
        const label=control.options?.find(option=>option.value===answer)?.label||answer;
        return control.label+' · '+label;
      }).join('. ')+'.';
    }
    if(level.well && role===A) return 'Une el cordón con el imán. Sujeta la manivela en la marca que se ve junto a la llave en la otra casa.';
    if(level.well && role===B) return 'El saliente lleva la marca '+['','I','II','III'][level.well.target]+'. Indica esa profundidad a quien maneja la manivela y recoge la llave con el imán.';
    if (s.current!==15) return explanations[s.current-1];
    const {A:first,B:second}=panelHints;
    if (role===A) return first;
    if (role===B) return second;
    return first+' '+second;
  }
  const available = (s,action) => (action.needs || []).every(item => s.items.includes(item));
  const actionRole=(level,action)=>level.well && action.id==='pescar'?B:action.role;
  function actionViews(level,s,role) {
    return (level.actions || []).filter(action=>permitted(role,actionRole(level,action))).map(action=>{
      const done=hasAction(s,action.id), ready=available(s,action);
      const world=actionRole(level,action);
      return {id:action.id,label:action.label,role:world,world,enabled:!done&&ready,done,
        reason:done?'Ya se ha realizado.':ready?'':'Falta un objeto en el inventario compartido.'};
    });
  }
  function controlViews(level,s,role) {
    const fields=assignments.get(level);
    if(fields) return level.controls.filter(control=>permitted(role,fields.get(control.id)))
      .map(control=>({...control,role:fields.get(control.id)}));
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
    const [id,title]=room;
    const stage=s.completed?null:{number:s.current,chapter:chapters[Math.floor((s.current-1)/3)],title:level.title,
      room:level.room,brief:level.brief,evidence:seenBy(level.evidence,role),controls:controlViews(level,s,role),
      actions:actionViews(level,s,role),
      ready:(level.requires || []).every(action=>hasAction(s,action))};
    if (stage && s.current===15) stage.panelStatus={A:s.panels.includes(A),B:s.panels.includes(B)};
    if(stage && level.contributions) {
      stage.contributions=Object.fromEntries([A,B].map(world=>[world,{
        done:hasAction(s,'part-'+world),
        ...(permitted(role,world)?{objective:level.contributions[world].objective}:{})
      }]));
    }
    if(stage && level.well) {
      const depth=s.wellDepth||0,target=level.well.target;
      stage.wellDepth=depth;
      if(role!==A){
        stage.wellMark=target;
        stage.wellReach=!depth?null:depth===target?'at':depth<target?'above':'below';
      }
    }
    const placeEvidence=[notebook.roomPlace(id,A),notebook.roomPlace(id,B)];
    for (const visited of levels.slice(0,s.current)) {
      if (visited.room===id) placeEvidence.push(...visited.evidence);
    }
    const recordings={carta:media.carta};
    if (s.current>=12) recordings.radio=media.radio;
    if (s.current===12 && stage) stage.recording=media.radio;
    if (s.completed) recordings.final=media.final;
    return {title:episodeTitle,intro:letterEntry.text,role,recordings,current:s.current,total:15,
      completed:s.completed,revision:s.revision,stage,notebook:notebook.known(s,role),
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
    if(!signal||!Object.hasOwn(level.solution,'llamada'))return null;
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
    const radio=Object.keys(solution).length===1&&Object.hasOwn(solution,'llamada')?radioCall(level):null;
    if(radio){
      return engine.intentoValido({tipo:'campos',campos:['llamada']},answers)&&
        engine.evaluarPrueba(radio,answers.llamada.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
    }
    return engine.evaluarPrueba({tipo:'campos',respuesta:solution,normalizacion:'texto'},answers);
  }
  function finishStage(record,s,level) {
    const stageCompleted=s.current;
    updateItems(s,level.onWin);
    s.current++;
    return commit(record,s,{stageCompleted,message:'Prueba resuelta. Se ha abierto el siguiente paso.'});
  }
  function submitContribution(record,s,level,role,input) {
    const world=input.world??role;
    if(world!==A && world!==B) throw new ApiError(400,'Elige la casa desde la que estás actuando.');
    if(!permitted(role,world)) throw new ApiError(403,'Ese mecanismo se maneja desde la otra casa.');
    if(hasAction(s,'part-'+world)) return unchanged('Tu parte ya está resuelta y guardada.',true);
    const part=level.contributions[world];
    const expected=Object.fromEntries(part.controlIds.map(id=>[id,level.solution[id]]));
    if(!matches(input.answers,expected,level)) return unchanged(part.feedback||'Revisa las pistas de tu mecanismo.');
    s.flags.push(flagFor(s.current,'part-'+world));
    if(hasAction(s,'part-'+(world===A?B:A))) return finishStage(record,s,level);
    return commit(record,s,{message:part.success||'Tu parte está resuelta. Falta la maniobra de la otra casa.'});
  }
  function wasSubmitted(s,role,input){
    if(input.op!=='solve'||input.mission!==undefined||!Number.isInteger(input.stage)||input.stage<1||input.stage>=s.current)return false;
    const world=input.world??role,previous=levels[input.stage-1];
    if((world!==A&&world!==B)||!permitted(role,world)||!previous.contributions)return false;
    if(!s.flags.includes(flagFor(input.stage,'part-'+world)))return false;
    const expected=Object.fromEntries(previous.contributions[world].controlIds.map(id=>[id,previous.solution[id]]));
    return matches(input.answers,expected,previous);
  }
  function setDepth(record,s,role,input) {
    if(role===B || input.world===B) throw new ApiError(403,'La manivela se maneja desde la casa habitada.');
    if(!Number.isInteger(input.depth) || input.depth<1 || input.depth>3) throw new ApiError(400,'Elige una de las tres marcas de la cuerda.');
    if(hasAction(s,'pescar')) return unchanged('La llave ya está en el inventario.',true);
    if(!hasAction(s,'atar')) return unchanged('Sujeta primero el imán al cordón.');
    if(s.wellDepth===input.depth) return unchanged('La cuerda ya está sujeta en esa marca.',true);
    s.wellDepth=input.depth;
    return commit(record,s,{message:'La cuerda ha quedado sujeta en la marca '+['','I','II','III'][s.wellDepth]+'.'});
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
    if (!plain(input) || !['observe','act','solve'].includes(input.op)) throw new ApiError(400,'Operación de la mansión desconocida.');
    const s=record.mansion || freshState();
    if(wasSubmitted(s,role,input))return unchanged('Tu parte de esa prueba ya está resuelta y guardada.',true);
    if (input.stage!==s.current) throw new ApiError(409,'La prueba ha cambiado. Actualiza el episodio antes de continuar.');
    if(input.op==='observe') {
      const result=notebook.observe(s,role,input);
      return result.changed?commit(record,s,result):result;
    }
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
      if(level.well && input.action==='profundidad') return setDepth(record,s,role,input);
      const action=(level.actions || []).find(a=>a.id===input.action);
      if (!action) throw new ApiError(400,'Esa interacción no está disponible en esta prueba.');
      const actor=actionRole(level,action);
      if (!permitted(role,actor) || (input.world!==undefined && !permitted(input.world,actor)))
        throw new ApiError(403,'Esa interacción pertenece a la otra casa.');
      if (hasAction(s,action.id)) return unchanged('La interacción ya está guardada.',true);
      if (!available(s,action)) return unchanged('Busca los objetos que faltan antes de hacer eso.');
      if(level.well && action.id==='pescar' && s.wellDepth!==level.well.target) {
        if(!s.wellDepth) return unchanged('La cuerda sigue enrollada en la otra casa.');
        return unchanged(s.wellDepth<level.well.target?'La sonda se balancea por encima del saliente.':'La sonda ha pasado de largo.');
      }
      updateItems(s,action);
      s.flags.push(flagFor(s.current,action.id));
      return commit(record,s,{message:action.give?'Has obtenido '+objects[action.give][0]+'.':'La interacción ha quedado guardada.'});
    }
    if (s.current===15) return finishPanel(record,s,role,input.answers);
    if (!(level.requires || []).every(key=>hasAction(s,key))) return unchanged('Aún hay una interacción pendiente en la sala.');
    if(level.contributions) return submitContribution(record,s,level,role,input);
    if (!matches(input.answers || {},level.solution,level)) return unchanged('El mecanismo no responde. Contrasta otra vez las pistas de las dos casas.');
    return finishStage(record,s,level);
  }
  return {inspectMansion,applyMansion,mansionHint};
}
