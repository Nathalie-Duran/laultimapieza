import {secretArchive} from './secret-archive.mjs';
import {explorerCollection,explorerCase} from './explorador-lup.mjs';
import {creditSecretMission,creditMansionMission,creditMansionEnding,purchaseMansionHint} from './valdemar-wallet.mjs';
import {createMansionRules,startMansion} from './mansion-episode.mjs';
import {useInventory, inspectInventory} from './expedition.mjs';
import {readFile} from 'node:fs/promises';
import {ApiError} from './auth-provider.mjs';
import {CASE_ORDER} from './progression.mjs';
import {worldSeasonAccess, valdemarWallet, withValdemarTransaction, WORLD_CASE_COUNT, hintFees, parallelPrize} from './valdemar-wallet.mjs';
import {readValdemarRelease} from './valdemar-release.mjs';
import {evaluateHourStage,readHour,requireHourComplete,roleMaterials} from './valdemar-hour.mjs';
import {hasCaseActivity,recordCaseActivity} from './season-activity.mjs';
import {rememberStage,seasonCareer} from './season-career.mjs';
import {notifyEnding} from './play-notices.mjs';
import {endPair,hasGameConsent,partnerCases,partnerInfo,partnerScope,syncPairProgress} from './partner-api.mjs';

const files = new Map();
// Only versioned, server-owned files are passed here. No path comes from the request.
function asset(name) {
  if (!files.has(name)) {
    files.set(name, readFile(new URL(name, import.meta.url), 'utf8')
      .catch(error => { files.delete(name); throw error; }));
  }
  return files.get(name);
}

const formatNames={text:'el documento',testimony:'el testimonio',ledger:'el registro',visual:'la lámina',audio:'el audio',web:'el archivo web'};
const formatList=new Intl.ListFormat('es',{type:'conjunction'});
function visibleRoles(story,role){
  if(!role || !Array.isArray(story.roles))return story.roles;
  const ownIndex=role==='A'?0:1,otherRole=role==='A'?'B':'A';
  const materials=(story.hour?.stages||[]).flatMap(stage=>stage.materials||[]);
  const formats=[...new Set(materials.filter(item=>item.role===otherRole)
    .map(item=>formatNames[item.kind]).filter(Boolean))].slice(0,3);
  const task=formats.length
    ? 'A lo largo del caso, examina '+formatList.format(formats)+' de su carpeta y comparte lo que encuentre.'
    : 'Contrasta sus pruebas con las tuyas para decidir cómo resolver el caso.';
  return story.roles.map((description,index)=>index===ownIndex?description:task);
}

function visibleStory(story,role) {
  const {id,title,place,question,solo,intro,challengePrompt,evidenceCards,choices,hypotheses} = story;
  return {id,title,place,question,roles:visibleRoles(story,role),solo,intro,challengePrompt,
    evidenceCards:evidenceCards && roleMaterials(evidenceCards,role),choices,hypotheses};
}

function visibleProgress(record,story) {
  const choice = record?.choice === mansionEnding ? null : record?.choice || null;
  const deduced = record?.deduced === true;
  return {
    deduced, choice,
    deduction: deduced ? story.deduction : null,
    outcome: choice ? story.outcomes[choice] : null
  };
}

function caseHints(story,wallet,pair) {
  const shared=pair?.progress?.sharedHints||[];
  const values={open:story.hints[0],second:story.hints[1],solution:story.deduction};
  const owned={open:wallet.opened,second:wallet.second,solution:wallet.solution};
  return Object.entries(hintFees).map(([op,fee])=>{
    const visible=owned[op].includes(story.id)||shared.includes(op);
    return {op,cost:op==='second' && wallet.legacyEnvelopes.includes(story.id)?0:fee,
      text:visible?values[op]:null,shared:shared.includes(op)};
  });
}

const playModes = new Set(['solo','duo']);
const mansionEnding = 'mansion-sealed';

function hasOldStation(record, wallet) {
  if (typeof record?.mansionLegacy === 'boolean') return record.mansionLegacy;
  return Boolean(record?.mode || record?.hourStep || record?.deduced || record?.choice ||
    ['won','opened','second','solution'].some(field=>wallet?.[field]?.includes(1)));
}

async function personalGames(data,scope,access,store,loadRelease,pairedCases) {
  const records=data.valdemarCaseProgress?.[scope] || {};
  const wallet=data.valdemarSeasonOne?.[scope] || {};
  const sideProgress=new Set([...(wallet.won || []),...(wallet.opened || []),...(wallet.second || []),...(wallet.solution || [])]);
  const games=[];
  for(let id=1;id<=WORLD_CASE_COUNT;id++){
    const record=records[id] || {};
    const mode=record.mode==='duo' && scope==='paid' && !pairedCases.includes(id)?'solo':playModes.has(record.mode)?record.mode:null;
    const mansion=id===1 && record.mansionEdition==='mansion';
    const finished=mansion?Boolean(record.mansion?.completed):Boolean(record.choice && record.choice!==mansionEnding);
    const total=mansion?15:5;
    const current=mansion ? finished?15:(record.mansion?.current||1)-1
      : finished?5:Math.max(0,Math.min(5,Number.isInteger(record.hourStep)?record.hourStep:0));
    if(mode || current || record.deduced || sideProgress.has(id)){
      games.push({id,mode,current,total,finished,available:access.availableCases.includes(id),
        ...(mansion?{edition:'mansion',title:'El secreto de los dos mundos'}:id===1?{edition:'legacy',title:'Mundos cruzados · La estación'}:{}),
        ...(Number.isFinite(record.updatedAt)?{updatedAt:record.updatedAt}:{})});
    }
  }
  const latest=games.filter(game=>game.available&&!game.finished)
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id)[0];
  if(latest){
    try{
      const release=await loadRelease(store);
      const story=releasedStory(release,latest.id);
      if(latest.edition==='mansion'){
        const view=mansionRules(story).inspectMansion(records[1],'solo');
        latest.checkpoint={title:view.stage?.title||'La mansión',task:view.stage?.brief||'Continúa la investigación en la mansión.'};
        return {games,access,career:seasonCareer(data,scope),archive:secretArchive(data,scope,access)};
      }
      const stage=story?.hour?.stages?.[latest.current];
      if(stage && typeof stage.title==='string' && typeof stage.task==='string'){
        latest.checkpoint={title:stage.title,task:stage.task};
      }else if(story && latest.current===latest.total){
        const question=[story.question,story.challengePrompt].find(value=>typeof value==='string'&&value.trim());
        latest.checkpoint=records[latest.id]?.deduced
          ? {title:'Elige tu desenlace',task:'Decide qué hacer con lo que has descubierto.'}
          : {title:'Deducción final',task:question || 'Contrasta tu hipótesis con las pruebas del expediente.'};
      }
    }catch(err){
      if(err.code!=='VALDEMAR_RELEASE_PENDING')throw err;
    }
  }
  return {games,access,career:seasonCareer(data,scope),archive:secretArchive(data,scope,access)};
}

function releasedStory(release,id) {
  return (id>CASE_ORDER.length ? release.nuevos : release.stories)?.find(item=>item.id===id);
}

function mansionRules(story){
  if (!story?.mansionEdition) throw new ApiError(503,'La edición de la mansión está pendiente de activación.','VALDEMAR_RELEASE_PENDING');
  return createMansionRules(story.mansionEdition);
}

function availableKeyChallenge(access,wallet,id,release) {
  if (!wallet.won.includes(id)) return null;
  const other = access.availableCases.find(candidate => !wallet.won.includes(candidate) && releasedStory(release,candidate));
  if (!other) return null;
  const route = other <= CASE_ORDER.length ? 'valdemar-jugar' : 'mundos-jugar';
  return {title:releasedStory(release,other).title,href:'#'+route+'?id='+other+'&seccion=reto'};
}

function visibleSample(sample) {
  if (!sample) return null;
  const {id,task,soundTitle,sound,transcript,pictureTitle,panels,pictureAlt,
    noteTitle,note,siteTitle,rows,answers} = sample;
  return {id,task,soundTitle,sound,transcript,pictureTitle,panels,pictureAlt,
    noteTitle,note,siteTitle,rows,answers};
}

function visibleSide(side,role) {
  const {title,brief,task,mode} = side;
  return {title,brief,task,mode,
    options:side.options.map(({id,label}) => ({id,label})),
    materials:roleMaterials(side.materials,role).map(({id,label,kind,body,role}) => ({id,label,kind,body,role})),
    ...(mode === 'order' ? {requiredCount:side.answer.length} : {})};
}

function matchesSide(side,choice) {
  if (!Array.isArray(choice) || choice.length !== side.answer.length || new Set(choice).size !== choice.length) return false;
  return side.mode === 'multi'
    ? side.answer.every(id=>choice.includes(id))
    : side.answer.every((id,index)=>choice[index]===id);
}

async function progressAction(store,uid,scope,story,action,input,pair) {
  const data = await store.getMemberData(uid);
  const alreadyStarted = hasCaseActivity(data,scope,story.id);
  data.valdemarCaseProgress ||= {};
  const cases = data.valdemarCaseProgress[scope] ||= {};
  const stored = pair ? pair.progress : cases[story.id] ||= {};
  const keepMansionSeal = stored.choice === mansionEnding;
  const record = keepMansionSeal ? {...stored,choice:null} : stored;
  async function save(event){
    if(keepMansionSeal)Object.assign(stored,record,{choice:record.choice || mansionEnding});
    if(pair)return syncPairProgress(store,pair,event);
    recordCaseActivity(data,scope,story.id,alreadyStarted,event);
    if(scope==='paid')await store.touchNoticeActivity?.(uid);
    if(event==='end' && !keepMansionSeal)await notifyEnding(store,uid,data,scope,story.id);
    await store.saveMemberData(uid,data);
  }
  if (action === 'inventory') {
    const role = partnerInfo(pair,uid)?.role;
    if (useInventory(story,record,role,input)) {
      if (!pair && record.missionPrize) creditSecretMission(data,scope,story.id,record.missionPrize);
      await save('inventory');
    }
    return {inventory:inspectInventory(story,record,role)};
  }
  if (action === 'stage') {
    const {advanced,correct,feedback} = evaluateHourStage(story,record,input);
    if (advanced) {
      rememberStage(record,input.index,story.hour.stages[input.index],Boolean(pair));
      await save('advance');
    }
    return {correct,feedback,hour:readHour(story,record,partnerInfo(pair,uid)?.role)};
  }
  if (action === 'deduce') {
    if (!record.deduced) requireHourComplete(story,record);
    if (!story.hypotheses.some(item => item.id === input.hypothesis)) {
      throw new ApiError(400,'Elige una de las hipótesis del expediente.');
    }
    const correct = input.hypothesis === story.correctHypothesis;
    if (correct && !record.deduced) {
      record.deduced = true;
      await save('deduce');
    }
    return {correct,progress:visibleProgress(record,story)};
  }
  if (!record.deduced) throw new ApiError(409,'Resuelve primero la deducción del expediente.','DEDUCTION_REQUIRED');
  requireHourComplete(story,record);
  if (!story.choices.some(item => item.id === input.choice)) throw new ApiError(400,'Elige un desenlace disponible.');
  if (record.choice && record.choice !== mansionEnding && record.choice !== input.choice) {
    throw new ApiError(409,'Esta historia ya tiene una decisión guardada en tu álbum.','ENDING_SAVED');
  }
  if (!record.choice || record.choice === mansionEnding) {
    record.choice = input.choice;
    await save('end');
  }
  return {progress:visibleProgress(record,story)};
}

function copyMansionProgress(personal, shared) {
  if (!shared) return;
  const old = personal.mansion;
  const keep = old && (old.completed || (!shared.completed && (old.current > shared.current ||
    (old.current===shared.current && old.revision>shared.revision))));
  const merged = structuredClone(keep ? old : shared);
  merged.missions=[...new Set([...(old?.missions || []), ...shared.missions])];
  personal.mansion = merged;
}

async function mansionSession({store,data,uid,scope,editorial,pair,mode,partner,waitingForPartner,input,method,access,loadRelease}) {
  let purse=await valdemarWallet(store,uid,{editorial,seasonAccess:access,pair});
  data=await store.getMemberData(uid);
  const personal = data.valdemarCaseProgress?.[scope]?.[1];
  const holder = pair ? pair.progress : personal;
  const legacy = pair ? (holder.mansionLegacy ?? hasOldStation(personal,data.valdemarSeasonOne?.[scope])) : hasOldStation(personal,data.valdemarSeasonOne?.[scope]);
  let edition = holder?.mansionEdition || (legacy ? 'choose' : 'mansion');
  const needsRules=(edition==='mansion' || input?.op==='start') && mode && !waitingForPartner;
  const rules=needsRules ? mansionRules(releasedStory(await loadRelease(store),1)) : null;
  const role = partner?.role || (editorial && mode==='duo' ? input?.paper==='B'?'B':'A' : 'solo');
  const view = record => {
    const mansion=edition==='mansion' && rules ? rules.inspectMansion(record||{},role,input?.roomId) : null;
    if(mansion){
      mansion.balance=purse.balance;
      const owned=data.valdemarSeasonOne?.[scope]?.mansionHints || [];
      if(mansion.stage)mansion.stage.hintOptions=Object.entries(hintFees).map(([op,cost])=>{
        const key=mansion.current+'/'+op;
        const unlocked=owned.includes(key) || pair?.progress.mansionSharedHints?.includes(key);
        return {op,cost,text:unlocked?rules.mansionHint(record||{},op,role):null};
      });
    }
    const names=pair ? {A:pair.ownerName,B:pair.guestName} : {};
    return {edition,legacy,mode,partner,names,waitingForPartner,editorialPreview:editorial===true,
      mansionRevision:record?.mansion?.revision || 0,mansion};
  };
  if (method==='GET') return view(holder);
  const op = input?.op;
  if (op==='inspect') return view(holder);
  if ((!mode || waitingForPartner) && !['start','legacy'].includes(op)) throw new ApiError(409,'Elige la modalidad antes de entrar en la mansión.','MODE_REQUIRED');
  if (op==='legacy' && !legacy) throw new ApiError(409,'Esta cuenta carece de una partida anterior de la estación.','EDITION_UNAVAILABLE');
  if (!['legacy','start','act','solve','hint'].includes(op)) throw new ApiError(400,'Elige una acción de la mansión.');
  if (!['legacy','start'].includes(op) && edition!=='mansion') throw new ApiError(409,'Abre la mansión antes de continuar.','EDITION_REQUIRED');
  const before = hasCaseActivity(data,scope,1);
  const records = (data.valdemarCaseProgress ||= {})[scope] ||= {};
  const record = pair ? pair.progress : records[1] ||= {};
  const previousStage = record.mansion?.current || 1;
  let result;
  if (op==='legacy' || op==='start') {
    edition = op==='legacy' ? 'legacy' : 'mansion';
    const needsStart=op==='start' && !record.mansion;
    if(needsStart)startMansion(record);
    result = {changed:needsStart || record.mansionEdition !== edition || record.mansionLegacy===undefined};
  } else if(op==='hint'){
    if(input.stage!==(record.mansion?.current||1) || record.mansion?.completed)throw new ApiError(409,'Actualiza la etapa antes de abrir una ayuda.');
    if(!Object.hasOwn(hintFees,input.tier))throw new ApiError(400,'Elige una ayuda disponible.');
    const key=input.stage+'/'+input.tier;
    const shared=pair && (pair.progress.mansionSharedHints ||= []);
    const bought=!shared?.includes(key) && purchaseMansionHint(data,scope,input.stage,input.tier,input.quotedCost);
    const share=shared && !shared.includes(key);
    if(share)shared.push(key);
    result={changed:Boolean(bought || share),correct:true,message:'Ayuda abierta.'};
    if(result.changed){startMansion(record);record.mansion.revision++;}
  } else result = rules.applyMansion(record,role,input);
  if (result.changed) {
    record.mansionEdition = edition;
    record.mansionLegacy = legacy;
    if (pair) await store.savePartner(pair);
    const members = pair ? [pair.ownerId,pair.guestId].sort() : [uid];
    for (const member of members) {
      const memberScope = pair ? partnerScope(pair,member) : scope;
      const account = member===uid ? data : await store.getMemberData(member);
      const started = pair ? hasCaseActivity(account,memberScope,1) : before;
      const cases = (account.valdemarCaseProgress ||= {})[memberScope] ||= {};
      const saved = cases[1] ||= {};
      if (pair) {
        saved.mansionLegacy ??= hasOldStation(saved,account.valdemarSeasonOne?.[memberScope]);
        saved.mansionEdition = edition;
        saved.mode = 'duo';
        copyMansionProgress(saved,record.mansion);
      }
      if (result.missionReward) creditMansionMission(account,memberScope,result.mission,result.missionReward);
      if (result.completed) creditMansionEnding(account,memberScope);
      if(pair && result.stageCompleted){
        const stages=saved.mansionPairStages ||= [];
        if(!stages.includes(result.stageCompleted))stages.push(result.stageCompleted);
      }
      const newlyClosed = result.completed && !saved.choice;
      if (newlyClosed) saved.choice = mansionEnding;
      recordCaseActivity(account,memberScope,1,started,newlyClosed?'end':'mansion');
      if (!saved.firstAdvancedAt && previousStage===1 && record.mansion?.current>1) saved.firstAdvancedAt=saved.updatedAt;
      if (memberScope==='paid') await store.touchNoticeActivity?.(member);
      if (newlyClosed) await notifyEnding(store,member,account,memberScope,1);
      await store.saveMemberData(member,account);
    }
  }
  if (result.missionReward || result.completed || op==='hint')purse=await valdemarWallet(store,uid,{editorial,seasonAccess:access,pair});
  const response={...view(record),...result};
  if (result.missionReward || result.completed || op==='hint') response.wallet=purse;
  return response;
}

export async function valdemarRequest({path,method,input,uid,editorial,withStore,billing,loadRelease=readValdemarRelease}) {
  if(path==='/api/valdemar/explorer'){
    if(method!=='GET')throw new ApiError(405,'Método no permitido.');
    return withStore(async store=>explorerCollection(await store.getMemberData(uid,{readOnly:true}),editorial?'editorial':'paid'));
  }
  const explorer=/^\/api\/valdemar\/explorer\/([1-9]\d?)$/.exec(path);
  const room=/^\/api\/valdemar\/salas\/([234])$/.exec(path);
  if(room){
    const {seasonArcadeRequest}=await import('./salas-temporada.mjs');
    return seasonArcadeRequest({season:Number(room[1]),method,input,uid,editorial,withStore,billing});
  }
  if(path==='/api/valdemar/mansion/arcade') {
    const {mansionArcadeRequest}=await import('./mansion-arcade.mjs');
    return mansionArcadeRequest({method,input,uid,editorial,withStore,billing});
  }
  const walletRoute = path === '/api/valdemar/wallet';
  const seasonsRoute = path === '/api/valdemar/seasons';
  const gamesRoute = path === '/api/valdemar/partidas';
  const sealRoute = /^\/api\/valdemar\/seals\/([1-9]\d?)$/.exec(path);
  const match = /^\/api\/valdemar\/cases\/([1-9]\d?)(?:\/(reward|open|second|solution|sample|deduce|ending|stage|mode|inventory|pair-state|mansion))?$/.exec(path);
  const id = Number(explorer?.[1] || match?.[1]) || null;
  if ((!walletRoute && !seasonsRoute && !gamesRoute && !sealRoute && !match && !explorer) || id>WORLD_CASE_COUNT) throw new ApiError(404,'Esta historia no está disponible.');
  const newWorld = id > CASE_ORDER.length;
  const action = explorer?'explorer':match?.[2] || 'read';
  if(action==='mansion' && id!==1)throw new ApiError(404,'Esta mansión pertenece al primer caso.');
  if (action==='mansion' || explorer ? !['GET','POST'].includes(method) : method !== (action==='read' || action==='pair-state' ? 'GET' : 'POST')) throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const reservation=id && store.getCasePartner ? await store.getCasePartner(uid,id,Date.now()) : null;
    const poll=action==='pair-state';
    const membership = editorial ? null : poll && billing?.pollMembership ? await billing.pollMembership(store,uid) : await billing?.membership(store,uid,{readOnly:gamesRoute});
    const data = await store.getMemberData(uid,{readOnly:gamesRoute});
    const access = !editorial && membership?.seasonAccess || worldSeasonAccess(data,{editorial,active:!editorial && membership?.canPlay===true});
    const scope = editorial ? 'editorial' : 'paid';
    if (gamesRoute){
      const pairedCases=!editorial && store.listPairedCases ? await store.listPairedCases(uid) : [];
      return personalGames(data,scope,access,store,loadRelease,pairedCases);
    }
    if (sealRoute) {
      const number=Number(sealRoute[1]),season=access.seasons[number-1];
      if(!season)throw new ApiError(404,'Este sello no está disponible.');
      if(!editorial && !season.previousReady)throw new ApiError(409,'Completa antes las temporadas anteriores.','PREVIOUS_SEASON_REQUIRED');
      if(!season.seal.complete)throw new ApiError(409,'Guarda los doce desenlaces de este tablero para abrir su sello.','SEAL_INCOMPLETE');
      const release=await loadRelease(store);
      const seal=release.sellos?.find(s=>s.number===number);
      if(!seal || typeof seal.title!=='string' || typeof seal.epilogue!=='string' || !seal.epilogue.trim())throw new ApiError(503,'El epílogo está temporalmente fuera de servicio.','VALDEMAR_RELEASE_PENDING');
      return {number,title:seal.title,epilogue:seal.epilogue};
    }
    if (!editorial && !seasonsRoute && membership?.canPlay!==true && !access.availableCases.length) {
      throw new ApiError(402,'Necesitas un pase de temporada para jugar.','SUBSCRIPTION_REQUIRED');
    }
    if (id && !access.availableCases.includes(id)) {
      if (newWorld && !access.seasons[Math.floor((id-1)/12)].previousReady) {
        throw new ApiError(409,'Completa los doce desenlaces de la temporada anterior.','PREVIOUS_SEASON_REQUIRED');
      }
      throw new ApiError(409,'Esta historia se abre con el bloque de su mes.','CASE_NOT_RELEASED');
    }
    if (walletRoute || seasonsRoute) {
      const wallet = await valdemarWallet(store,uid,{editorial,seasonAccess:access,summaryOnly:seasonsRoute});
      if (seasonsRoute) return {...access,wallet,released:access.availableCases.length};
      const availableCases = access.availableCases.filter(caseId=>caseId<=CASE_ORDER.length);
      const completed = availableCases.filter(caseId=>access.completed.includes(caseId));
      return {wallet,released:availableCases.length,availableCases,completed};
    }
    const personal = data.valdemarCaseProgress?.[scope]?.[id];
    const waitingForPartner=hasGameConsent(reservation) && reservation.status==='pending' && reservation.ownerId===uid &&
      reservation.email===data.preferredPartnerEmail;
    const accepted=hasGameConsent(reservation) && reservation.status==='accepted' && partnerScope(reservation,uid)===scope ? reservation : null;
    let pair=null;
    if(accepted && (editorial || membership?.canPlay===true)){
      const other=accepted.ownerId===uid?accepted.guestId:accepted.ownerId;
      if((await partnerCases(store,billing,other,{poll,editorial:partnerScope(accepted,other)==='editorial'})).includes(id))pair=accepted;
    }
    if(method==='POST' && (input?.partnerId??null)!==(pair?.id??null)){
      throw new ApiError(409,'La pareja de esta partida ha cambiado. Vuelve a abrir el juego.','PAIR_CHANGED');
    }
    const partner=partnerInfo(pair,uid);
    const record=pair?pair.progress:personal;
    const mode=pair?'duo':accepted || !editorial && personal?.mode==='duo'?'solo':playModes.has(personal?.mode)?personal.mode:null;
    if(poll)return pair
      ? {partner,mode,waitingForPartner:false,...(id===1?{mansionRevision:record.mansion?.revision||0,edition:record.mansionEdition}:{}),sharedHintCount:record.sharedHints?.length||0,hour:{current:record.choice?5:record.hourStep||0,inventory:{revision:record.inventoryRevision||0}},progress:{deduced:record.deduced===true,choice:record.choice||null}}
      : {partner:null,mode,waitingForPartner};
    if(explorer){
      const story=releasedStory(await loadRelease(store),id);
      return explorerCase({store,uid,scope,data,story,record,role:partner?.role||(editorial&&mode==='duo'?'A':null),
        mode,waiting:waitingForPartner,pairId:pair?.id,input,method});
    }
    if(action==='mansion')return mansionSession({store,data,uid,scope,editorial,pair,mode,partner,waitingForPartner,input,method,access,loadRelease});
    if (action==='mode') {
      const mode=input?.mode;
      if (!playModes.has(mode)) throw new ApiError(400,'Elige jugar en solitario o en pareja.','INVALID_PLAY_MODE');
      if(!editorial && mode==='duo' && !pair)throw new ApiError(409,'Para jugar en pareja, invita a la otra persona desde tu perfil. Ambos necesitáis acceso a este juego.','PAIR_REQUIRED');
      if(accepted && mode==='solo'){
        await endPair(store,accepted);
        return {mode,partner:null};
      }
      if(reservation && !accepted && mode==='solo')await endPair(store,reservation);
      if(pair)return {mode:'duo',partner};
      if (record?.mode!==mode) {
        const alreadyStarted = hasCaseActivity(data,scope,id);
        data.valdemarCaseProgress ||= {};
        const cases=data.valdemarCaseProgress[scope] ||= {};
        const saved=cases[id] ||= {};
        if(id===1 && input.mansionEntry && !alreadyStarted) {
          saved.mansionLegacy=false;
          saved.mansionEdition='mansion';
        }
        saved.mode=mode;
        recordCaseActivity(data,scope,id,alreadyStarted,'mode');
        await store.saveMemberData(uid,data);
      }
      return {mode};
    }
    const release = await loadRelease(store);
    const story = releasedStory(release,id);
    if (!story) throw new ApiError(503,'El expediente está temporalmente fuera de servicio.');
    if (action === 'inventory') {
      const result = await progressAction(store,uid,scope,story,action,input,pair);
      if (result.inventory.rooms.some(room => room.assignment?.complete)) {
        result.wallet = await valdemarWallet(store,uid,{editorial,seasonAccess:access,pair});
      }
      return result;
    }
    if (action === 'deduce' || action === 'ending' || action === 'stage') return progressAction(store,uid,scope,story,action,input,pair);
    const sample = newWorld ? null : release.samples.find(item => item.id === id);
    if (action === 'sample') {
      if (!sample || !Number.isInteger(input.answer) || input.answer < 0 || input.answer >= sample.answers.length) {
        throw new ApiError(400,'Elige una hipótesis de la mesa de pistas.');
      }
      const correct = input.answer === sample.correct;
      return {correct,explanation:correct ? sample.explain : null};
    }
    if (action === 'reward') {
      if (newWorld) {
        if (!matchesSide(story.side,input?.proof?.choice)) throw new ApiError(422,story.side.retry,'VICTORY_NOT_VERIFIED');
      } else {
        const {verifyValdemarVictory} = await import('./valdemar-replay.mjs');
        if (!verifyValdemarVictory(id,input?.proof?.moves)) {
          throw new ApiError(422,'El recorrido del reto todavía no acredita la victoria.','VICTORY_NOT_VERIFIED');
        }
      }
    }
    const wallet = await valdemarWallet(store,uid,{editorial,seasonAccess:access,pair,checkPrice:true,quotedCost:input?.quotedCost},action,id);
    const hintOptions=caseHints(story,wallet,pair);
    const hints=hintOptions.filter(option=>option.text).map(option=>option.text);
    const sharedHintCount=pair?.progress?.sharedHints?.length||0;
    const keyChallenge=availableKeyChallenge(access,wallet,id,release);
    if (action !== 'read') return {wallet,hints,keyChallenge,hintOptions,sharedHintCount,...(newWorld && action==='reward' ? {feedback:story.side.success} : {})};
    const role=partner?.role;
    const legacyRecord=record?.choice===mansionEnding?{...record,choice:null}:record;
    const dossier = {story:visibleStory(story,role),hour:readHour(story,legacyRecord,role),wallet,hints,progress:visibleProgress(legacyRecord,story),
      mode,partner,waitingForPartner,keyChallenge,hintOptions,sharedHintCount,parallelPrize:parallelPrize(id),editorialPreview:editorial===true};
    if (newWorld) return {...dossier,side:visibleSide(story.side,role)};
    const gameScript = await asset('valdemar-challenges-'+Math.ceil(id/4)+'.js');
    return {...dossier,sample:visibleSample(sample),gameScript,stationScript:id===1 ? release.stationScript : null};
  });
}
