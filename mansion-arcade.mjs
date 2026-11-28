import './web/motor-aventuras.js';
import { createHash } from 'node:crypto';
import {trialEvent} from './aventuras-autor.mjs';
import { ApiError } from './auth-provider.mjs';
import { creditMansionArcade, withValdemarTransaction, worldSeasonAccess } from './valdemar-wallet.mjs';
import { mansionArcadeCatalog as games } from './web/mansion-arcade-catalog.js';
import {arcadePair,arcadePairView,playArcadePair} from './arcade-cooperation.mjs';

const {evaluarPrueba,canonizarPiezas}=globalThis.MotorAventuras;

function word(input) {
  if (typeof input !== 'string' || input.length > 50) return '';
  return input.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

const answerDigests = {
  archivo:'2c14dc6e35786198a01ab23513bfd477858a8c159ebac6306b3af8ab4017116c',
  museo:'9806764145cfc0bdd96f2aa635f197eca1d5bca53af8bfe335c4b5f322717f2b',
  cartas:'55fd2f8f8908c79821162b7fe13f29ff89f5dab0e1b2122482eea3be643d16b6',
  espejo:'b42c06d066063f46853a54cbd484b5b70087ad1a459f37fc828592fd79c9fd98'
};
function matchesDigest(id,value) {
  const huella=createHash('sha256').update(JSON.stringify([id,value])).digest('hex');
  return evaluarPrueba({tipo:'seleccion',respuesta:answerDigests[id]},huella);
}
function matchingSelection(id,attempt) {
  const piezas=canonizarPiezas('conjunto',attempt,3);
  return piezas!==null && piezas.every(Number.isInteger) && matchesDigest(id,piezas);
}
function fitsClock(attempt) {
  if (!Array.isArray(attempt) || attempt.length!==3 || !attempt.every(n=>[12,18,24,30,36].includes(n))) return false;
  const [centre,pinion,exit]=attempt;
  if (pinion+exit!==48) return false;
  const vueltas = (entrada,salida,giros) => evaluarPrueba({
    tipo:'mecanica',mecanica:'engranajes',parametros:{vueltas:giros,pares:[[entrada,salida]]}
  },1);
  return vueltas(12,centre,2) && vueltas(pinion,exit,3);
}

const garden = {
  tipo:'mecanica',mecanica:'circuito-rotatorio',
  parametros:{
    tubos:[['E','ES','S'],['','NEO','NE'],['E','ES','']],
    fuente:[0,0],moviles:[[1,0],[1,1],[2,1],[1,2]],salidas:[[2,0],[0,2]]
  }
};
const checks = {
  archivo: attempt => canonizarPiezas('secuencia',attempt,2)!==null && matchesDigest('archivo',attempt.map(word)),
  relojero: fitsClock,
  museo: attempt => matchingSelection('museo',attempt),
  cartas: attempt => canonizarPiezas('secuencia',attempt?.order,4)!==null &&
    attempt.order.every(fragment => typeof fragment === 'string' && fragment.length === 1) &&
    matchesDigest('cartas',[attempt.order,word(attempt.message)]),
  jardin: attempt => Array.isArray(attempt) && attempt.length===4 && attempt.every(Number.isInteger) && evaluarPrueba(garden,attempt),
  espejo: attempt => matchingSelection('espejo',attempt)
};

export async function mansionArcadeRequest({method,input,uid,editorial,withStore,billing}) {
  if (method !== 'GET' && method !== 'POST') throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const membership = editorial ? null : await billing?.membership(store,uid,{readOnly:true});
    const scope = editorial ? 'editorial' : 'paid';
    const data = await store.getMemberData(uid,{readOnly:true});
    const access = !editorial && membership?.seasonAccess || worldSeasonAccess(data,{editorial,active:membership?.canPlay===true});
    if (!access.availableCases.includes(1)) throw new ApiError(403,'Necesitas acceso al primer caso de Código Valdemar para jugar en la mansión.','MANSION_ACCESS_REQUIRED');
    if (method === 'GET') {
      const pair=await arcadePair(store,billing,uid,1,scope);
      const entries = data.valdemarSeasonOne?.[scope]?.entries || [];
      return {games:games.map(game => ({...game,solved:entries.some(entry => entry.kind==='mansionArcade' && entry.id===game.id)})),coop:arcadePairView(pair)};
    }
    const game = games.find(item => item.id === input?.id);
    if (!game) throw new ApiError(400,'Elige uno de los seis minijuegos de la mansión.');
    if(Object.hasOwn(input,'coop'))return playArcadePair({store,pair:await arcadePair(store,billing,uid,1,scope),input,caseId:1,prize:game.prize,
      validate:(id,attempt)=>checks[id](attempt),award:creditMansionArcade});
    const correct=checks[game.id](input.attempt);
    if(!editorial)await trialEvent(store,{game:'juego/1',edition:0,trial:game.title,participant:'u/'+uid,solved:correct});
    if (!correct) return {correct:false,awarded:0};
    const latest=await store.getMemberData(uid);
    const fresh = creditMansionArcade(latest,scope,game.id,game.prize);
    if (fresh) await store.saveMemberData(uid,latest);
    return {correct:true,awarded:fresh ? game.prize : 0};
  });
}
