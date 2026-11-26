import {readFile} from 'node:fs/promises';
import {ApiError} from './auth-provider.mjs';
import {CASE_ORDER} from './progression.mjs';
import {valdemarWallet, withValdemarTransaction} from './valdemar-wallet.mjs';
import {readValdemarRelease} from './valdemar-release.mjs';

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
  const {id,title,question,roles,solo,intro,challengePrompt,evidenceCards,choices,hypotheses} = story;
  return {id,title,question,roles,solo,intro,challengePrompt,evidenceCards,choices,hypotheses};
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

async function releasedCases(store,uid,editorial,billing) {
  if (editorial) return CASE_ORDER.map((_,index) => index+1);
  const membership = await billing?.membership(store,uid);
  if (membership?.canPlay !== true) {
    throw new ApiError(402,'Necesitas una suscripción activa para jugar a la temporada.','SUBSCRIPTION_REQUIRED');
  }
  // Preserve refund holes; a count of eight cannot distinguish months 1+2 from 2+3.
  const unlocked = membership.calendar?.unlockedCaseIds || [];
  return CASE_ORDER.flatMap((slug,index) => unlocked.includes(slug) ? [index+1] : []);
}

async function progressAction(store,uid,scope,story,action,input) {
  const data = await store.getMemberData(uid);
  data.valdemarCaseProgress ||= {};
  const cases = data.valdemarCaseProgress[scope] ||= {};
  const record = cases[story.id] ||= {};
  if (action === 'deduce') {
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

export async function valdemarRequest({path,method,input,uid,editorial,withStore,billing}) {
  const walletRoute = path === '/api/valdemar/wallet';
  const match = /^\/api\/valdemar\/cases\/([1-9]|1[0-2])(?:\/(reward|open|second|sample|deduce|ending))?$/.exec(path);
  if (!walletRoute && !match) throw new ApiError(404,'Esta historia no está disponible.');
  const id = match ? Number(match[1]) : null;
  const action = match?.[2] || 'read';
  if (method !== (action==='read' ? 'GET' : 'POST')) throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const availableCases = await releasedCases(store,uid,editorial,billing);
    if (id && !availableCases.includes(id)) {
      throw new ApiError(409,'Esta historia se abre con el bloque de su mes.','CASE_NOT_RELEASED');
    }
    const scope = editorial ? 'editorial' : 'paid';
    if (walletRoute) {
      const wallet = await valdemarWallet(store,uid,{editorial});
      const data = await store.getMemberData(uid);
      const completed = availableCases.filter(caseId => data.valdemarCaseProgress?.[scope]?.[caseId]?.choice);
      return {wallet,released:availableCases.length,availableCases,completed};
    }
    const release = await readValdemarRelease(store);
    const story = release.stories.find(item => item.id === id);
    if (!story) throw new ApiError(503,'El expediente está temporalmente fuera de servicio.');
    if (action === 'deduce' || action === 'ending') return progressAction(store,uid,scope,story,action,input);
    const sample = release.samples.find(item => item.id === id);
    if (action === 'sample') {
      if (!sample || !Number.isInteger(input.answer) || input.answer < 0 || input.answer >= sample.answers.length) {
        throw new ApiError(400,'Elige una hipótesis de la mesa de pistas.');
      }
      const correct = input.answer === sample.correct;
      return {correct,explanation:correct ? sample.explain : null};
    }
    if (action === 'reward') {
      const {verifyValdemarVictory} = await import('./valdemar-replay.mjs');
      if (!verifyValdemarVictory(id,input.proof?.moves)) {
        throw new ApiError(422,'El recorrido del reto todavía no acredita la victoria.','VICTORY_NOT_VERIFIED');
      }
    }
    const wallet = await valdemarWallet(store,uid,{editorial},action,id);
    const hints = visibleHints(story,wallet);
    if (action !== 'read') return {wallet,hints};
    const [gameScript,data] = await Promise.all([
      asset('valdemar-challenges-'+Math.ceil(id/4)+'.js'),
      store.getMemberData(uid)
    ]);
    return {story:visibleStory(story),sample:visibleSample(sample),gameScript,
      stationScript:id===1 ? release.stationScript : null,
      wallet,hints,progress:visibleProgress(data.valdemarCaseProgress?.[scope]?.[id],story)};
  });
}
