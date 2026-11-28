import { createHash } from 'node:crypto';
import { ApiError } from './auth-provider.mjs';
import { creditMansionArcade, withValdemarTransaction, worldSeasonAccess } from './valdemar-wallet.mjs';
import { mansionArcadeCatalog as games } from './web/mansion-arcade-catalog.js';

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
  return createHash('sha256').update(JSON.stringify([id,value])).digest('hex') === answerDigests[id];
}
function matchingSelection(id,attempt) {
  return Array.isArray(attempt) && attempt.length === 3 && attempt.every(Number.isInteger) &&
    matchesDigest(id,[...attempt].sort((a,b) => a-b));
}
function fitsClock(attempt) {
  if (!Array.isArray(attempt) || attempt.length !== 3 || !attempt.every(teeth => [12,18,24,30,36].includes(teeth))) return false;
  const [centre,pinion,exit] = attempt;
  return centre === 2*12 && exit === 3*pinion && pinion+exit === 48;
}

// The four rotating joints are at grid positions 1, 4, 5 and 7. Directions run clockwise from north.
const pipes = [[1], [1,2], [2], [], [0,1,3], [0,1], [1], [1,2], []];
function restoresGarden(turns) {
  if (!Array.isArray(turns) || turns.length !== 4 || !turns.every(n => Number.isInteger(n) && n >= 0 && n <= 3)) return false;
  const rotations = [0,turns[0],0,0,turns[1],turns[2],0,turns[3],0];
  const layout = pipes.map((ends,i) => ends.map(end => (end + rotations[i]) % 4));
  const visited = new Set([0]), queue = [0];
  for (const point of queue) {
    for (const dir of layout[point]) {
      const x = point % 3 + [0,1,0,-1][dir], y = Math.floor(point / 3) + [-1,0,1,0][dir];
      const next = y * 3 + x;
      if (x < 0 || x >= 3 || y < 0 || y >= 3 || !layout[next].includes((dir+2)%4)) return false;
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return visited.has(2) && visited.has(6);
}

const checks = {
  archivo: attempt => Array.isArray(attempt) && attempt.length===2 && matchesDigest('archivo',attempt.map(word)),
  relojero: fitsClock,
  museo: attempt => matchingSelection('museo',attempt),
  cartas: attempt => Array.isArray(attempt?.order) && attempt.order.length === 4 &&
    attempt.order.every(fragment => typeof fragment === 'string' && fragment.length === 1) &&
    matchesDigest('cartas',[attempt.order,word(attempt.message)]),
  jardin: restoresGarden,
  espejo: attempt => matchingSelection('espejo',attempt)
};

export async function mansionArcadeRequest({method,input,uid,editorial,withStore,billing}) {
  if (method !== 'GET' && method !== 'POST') throw new ApiError(405,'Método no permitido.');
  return withValdemarTransaction(withStore, async store => {
    const membership = editorial ? null : await billing?.membership(store,uid);
    const data = await store.getMemberData(uid);
    const access = !editorial && membership?.seasonAccess || worldSeasonAccess(data,{editorial,active:membership?.canPlay===true});
    if (!access.availableCases.includes(1)) throw new ApiError(403,'Necesitas acceso al primer caso de Valdemar para jugar en la mansión.','MANSION_ACCESS_REQUIRED');
    const scope = editorial ? 'editorial' : 'paid';
    if (method === 'GET') {
      const entries = data.valdemarSeasonOne?.[scope]?.entries || [];
      return {games:games.map(game => ({...game,solved:entries.some(entry => entry.kind==='mansionArcade' && entry.id===game.id)}))};
    }
    const game = games.find(item => item.id === input?.id);
    if (!game) throw new ApiError(400,'Elige uno de los seis minijuegos de la mansión.');
    if (!checks[game.id](input.attempt)) return {correct:false,awarded:0};
    const fresh = creditMansionArcade(data,scope,game.id,game.prize);
    if (fresh) await store.saveMemberData(uid,data);
    return {correct:true,awarded:fresh ? game.prize : 0};
  });
}
