import {readFile} from 'node:fs/promises';
import {ApiError} from './auth-provider.mjs';
import {CASE_ORDER} from './progression.mjs';
import {worldSeasonAccess, valdemarWallet, withValdemarTransaction, WORLD_CASE_COUNT} from './valdemar-wallet.mjs';
import {readValdemarRelease} from './valdemar-release.mjs';
import {evaluateHourStage,readHour,requireHourComplete} from './valdemar-hour.mjs';

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
  data.valdemarCaseProgress ||= {};
  const cases = data.valdemarCaseProgress[scope] ||= {};
  const record = cases[story.id] ||= {};
  if (action === 'stage') {
    const {advanced,correct,feedback} = evaluateHourStage(story,record,input);
    if (advanced) await store.saveMemberData(uid,data);
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
    await store.saveMemberData(uid,data);
  }
  return {progress:visibleProgress(record,story)};
}

export async function valdemarRequest({path,method,input,uid,editorial,withStore,billing,loadRelease=readValdemarRelease}) {
  const walletRoute = path === '/api/valdemar/wallet';
  const seasonsRoute = path === '/api/valdemar/seasons';
  const match = /^\/api\/valdemar\/cases\/([1-9]\d?)(?:\/(reward|open|second|sample|deduce|ending|stage))?$/.exec(path);
  const id = match ? Number(match[1]) : null;
  if ((!walletRoute && !seasonsRoute && !match) || id>WORLD_CASE_COUNT) throw new ApiError(404,'Esta historia no está disponible.');
  const newWorld = id > CASE_ORDER.length;
  const action = match?.[2] || 'read';
  if (method !== (action==='read' ? 'GET' : 'POST')) throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const membership = editorial ? null : await billing?.membership(store,uid);
    const data = await store.getMemberData(uid);
    const access = !editorial && membership?.seasonAccess || worldSeasonAccess(data,{editorial,active:!editorial && membership?.canPlay===true});
    if (!editorial && !seasonsRoute && membership?.canPlay!==true && !access.availableCases.length) {
      throw new ApiError(402,'Necesitas un pase de temporada para jugar.','SUBSCRIPTION_REQUIRED');
    }
    if (id && !access.availableCases.includes(id)) {
      if (newWorld && !access.seasons[Math.floor((id-1)/12)].previousReady) {
        throw new ApiError(409,'Completa los doce desenlaces de la temporada anterior.','PREVIOUS_SEASON_REQUIRED');
      }
      throw new ApiError(409,'Esta historia se abre con el bloque de su mes.','CASE_NOT_RELEASED');
    }
    const scope = editorial ? 'editorial' : 'paid';
    if (walletRoute || seasonsRoute) {
      const wallet = await valdemarWallet(store,uid,{editorial,seasonAccess:access,summaryOnly:seasonsRoute});
      if (seasonsRoute) return {...access,wallet,released:access.availableCases.length};
      const availableCases = access.availableCases.filter(caseId=>caseId<=CASE_ORDER.length);
      const completed = availableCases.filter(caseId=>access.completed.includes(caseId));
      return {wallet,released:availableCases.length,availableCases,completed};
    }
    const release = await loadRelease(store);
    const story = (newWorld ? release.nuevos : release.stories)?.find(item => item.id === id);
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
    const record = data.valdemarCaseProgress?.[scope]?.[id];
    const dossier = {story:visibleStory(story),hour:readHour(story,record),wallet,hints,progress:visibleProgress(record,story)};
    if (newWorld) return {...dossier,side:visibleSide(story.side)};
    const gameScript = await asset('valdemar-challenges-'+Math.ceil(id/4)+'.js');
    return {...dossier,sample:visibleSample(sample),gameScript,stationScript:id===1 ? release.stationScript : null};
  });
}
