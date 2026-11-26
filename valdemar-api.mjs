import {readFile} from 'node:fs/promises';
import {ApiError} from './auth-provider.mjs';
import {CASE_ORDER} from './progression.mjs';
import {worldSeasonAccess, valdemarWallet, withValdemarTransaction, WORLD_CASE_COUNT} from './valdemar-wallet.mjs';
import {readValdemarRelease} from './valdemar-release.mjs';
import {evaluateHourStage,readHour,requireHourComplete} from './valdemar-hour.mjs';
import {hasCaseActivity,recordCaseActivity} from './season-activity.mjs';

const files = new Map();
// Only versioned, server-owned files are passed here. No path comes from the request.
function asset(name) {
  if (!files.has(name)) {
    files.set(name, readFile(new URL(name, import.meta.url), 'utf8')
      .catch(error => { files.delete(name); throw error; }));
  }
  return files.get(name);
}

function visibleStory(story) {
  const {id,title,place,question,roles,solo,intro,challengePrompt,evidenceCards,choices,hypotheses} = story;
  return {id,title,place,question,roles,solo,intro,challengePrompt,evidenceCards,choices,hypotheses};
}

function visibleProgress(record,story) {
  const choice = record?.choice || null;
  const deduced = record?.deduced === true;
  return {
    deduced, choice,
    deduction: deduced ? story.deduction : null,
    outcome: choice ? story.outcomes[choice] : null
  };
}

function visibleHints(story,wallet) {
  if (!wallet.opened.includes(story.id)) return [];
  return story.hints.slice(0,wallet.second.includes(story.id) ? 2 : 1);
}

const playModes = new Set(['solo','duo']);

async function personalGames(data,scope,access,store,loadRelease) {
  const records=data.valdemarCaseProgress?.[scope] || {};
  const wallet=data.valdemarSeasonOne?.[scope] || {};
  const sideProgress=new Set([...(wallet.won || []),...(wallet.opened || []),...(wallet.second || [])]);
  const games=[];
  for(let id=1;id<=WORLD_CASE_COUNT;id++){
    const record=records[id] || {};
    const mode=playModes.has(record.mode)?record.mode:null;
    const finished=Boolean(record.choice);
    const current=finished?5:Math.max(0,Math.min(5,Number.isInteger(record.hourStep)?record.hourStep:0));
    if(mode || current || record.deduced || sideProgress.has(id)){
      games.push({id,mode,current,total:5,finished,available:access.availableCases.includes(id),
        ...(Number.isFinite(record.updatedAt)?{updatedAt:record.updatedAt}:{})});
    }
  }
  const latest=games.filter(game=>game.available&&!game.finished)
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id)[0];
  if(latest){
    try{
      const release=await loadRelease(store);
      const story=releasedStory(release,latest.id);
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
  return {games,access};
}

function releasedStory(release,id) {
  return (id>CASE_ORDER.length ? release.nuevos : release.stories)?.find(item=>item.id===id);
}

function visibleSample(sample) {
  if (!sample) return null;
  const {id,task,soundTitle,sound,transcript,pictureTitle,panels,pictureAlt,
    noteTitle,note,siteTitle,rows,answers} = sample;
  return {id,task,soundTitle,sound,transcript,pictureTitle,panels,pictureAlt,
    noteTitle,note,siteTitle,rows,answers};
}

function visibleSide(side) {
  const {title,brief,task,mode} = side;
  return {title,brief,task,mode,
    options:side.options.map(({id,label}) => ({id,label})),
    materials:side.materials.map(({id,label,kind,body,role}) => ({id,label,kind,body,role})),
    ...(mode === 'order' ? {requiredCount:side.answer.length} : {})};
}

function matchesSide(side,choice) {
  if (!Array.isArray(choice) || choice.length !== side.answer.length || new Set(choice).size !== choice.length) return false;
  return side.mode === 'multi'
    ? side.answer.every(id=>choice.includes(id))
    : side.answer.every((id,index)=>choice[index]===id);
}

async function progressAction(store,uid,scope,story,action,input) {
  const data = await store.getMemberData(uid);
  const alreadyStarted = hasCaseActivity(data,scope,story.id);
  data.valdemarCaseProgress ||= {};
  const cases = data.valdemarCaseProgress[scope] ||= {};
  const record = cases[story.id] ||= {};
  if (action === 'stage') {
    const {advanced,correct,feedback} = evaluateHourStage(story,record,input);
    if (advanced) {
      recordCaseActivity(data,scope,story.id,alreadyStarted,'advance');
      await store.saveMemberData(uid,data);
    }
    return {correct,feedback,hour:readHour(story,record)};
  }
  if (action === 'deduce') {
    if (!record.deduced) requireHourComplete(story,record);
    if (!story.hypotheses.some(item => item.id === input.hypothesis)) {
      throw new ApiError(400,'Elige una de las hipótesis del expediente.');
    }
    const correct = input.hypothesis === story.correctHypothesis;
    if (correct && !record.deduced) {
      record.deduced = true;
      recordCaseActivity(data,scope,story.id,alreadyStarted,'deduce');
      await store.saveMemberData(uid,data);
    }
    return {correct,progress:visibleProgress(record,story)};
  }
  if (!record.deduced) throw new ApiError(409,'Resuelve primero la deducción del expediente.','DEDUCTION_REQUIRED');
  requireHourComplete(story,record);
  if (!story.choices.some(item => item.id === input.choice)) throw new ApiError(400,'Elige un desenlace disponible.');
  if (record.choice && record.choice !== input.choice) {
    throw new ApiError(409,'Esta historia ya tiene una decisión guardada en tu álbum.','ENDING_SAVED');
  }
  if (!record.choice) {
    record.choice = input.choice;
    recordCaseActivity(data,scope,story.id,alreadyStarted,'end');
    await store.saveMemberData(uid,data);
  }
  return {progress:visibleProgress(record,story)};
}

export async function valdemarRequest({path,method,input,uid,editorial,withStore,billing,loadRelease=readValdemarRelease}) {
  const walletRoute = path === '/api/valdemar/wallet';
  const seasonsRoute = path === '/api/valdemar/seasons';
  const gamesRoute = path === '/api/valdemar/partidas';
  const sealRoute = /^\/api\/valdemar\/seals\/([1-9]\d?)$/.exec(path);
  const match = /^\/api\/valdemar\/cases\/([1-9]\d?)(?:\/(reward|open|second|sample|deduce|ending|stage|mode))?$/.exec(path);
  const id = match ? Number(match[1]) : null;
  if ((!walletRoute && !seasonsRoute && !gamesRoute && !sealRoute && !match) || id>WORLD_CASE_COUNT) throw new ApiError(404,'Esta historia no está disponible.');
  const newWorld = id > CASE_ORDER.length;
  const action = match?.[2] || 'read';
  if (method !== (action==='read' ? 'GET' : 'POST')) throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const membership = editorial ? null : await billing?.membership(store,uid,{readOnly:gamesRoute});
    const data = await store.getMemberData(uid,{readOnly:gamesRoute});
    const access = !editorial && membership?.seasonAccess || worldSeasonAccess(data,{editorial,active:!editorial && membership?.canPlay===true});
    const scope = editorial ? 'editorial' : 'paid';
    if (gamesRoute) return personalGames(data,scope,access,store,loadRelease);
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
    const record = data.valdemarCaseProgress?.[scope]?.[id];
    if (action==='mode') {
      const mode=input?.mode;
      if (!playModes.has(mode)) throw new ApiError(400,'Elige jugar en solitario o en pareja.','INVALID_PLAY_MODE');
      if (record?.mode!==mode) {
        const alreadyStarted = hasCaseActivity(data,scope,id);
        data.valdemarCaseProgress ||= {};
        const cases=data.valdemarCaseProgress[scope] ||= {};
        const saved=cases[id] ||= {};
        saved.mode=mode;
        recordCaseActivity(data,scope,id,alreadyStarted,'mode');
        await store.saveMemberData(uid,data);
      }
      return {mode};
    }
    const release = await loadRelease(store);
    const story = releasedStory(release,id);
    if (!story) throw new ApiError(503,'El expediente está temporalmente fuera de servicio.');
    if (action === 'deduce' || action === 'ending' || action === 'stage') return progressAction(store,uid,scope,story,action,input);
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
    const wallet = await valdemarWallet(store,uid,{editorial,seasonAccess:access},action,id);
    const hints = visibleHints(story,wallet);
    if (action !== 'read') return {wallet,hints,...(newWorld && action==='reward' ? {feedback:story.side.success} : {})};
    const dossier = {story:visibleStory(story),hour:readHour(story,record),wallet,hints,progress:visibleProgress(record,story),
      mode:playModes.has(record?.mode)?record.mode:null};
    if (newWorld) return {...dossier,side:visibleSide(story.side)};
    const gameScript = await asset('valdemar-challenges-'+Math.ceil(id/4)+'.js');
    return {...dossier,sample:visibleSample(sample),gameScript,stationScript:id===1 ? release.stationScript : null};
  });
}
