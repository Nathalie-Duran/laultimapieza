import test from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {estacionesDeSala, validaEstacion} from '../salas-soluciones.mjs';
import {compass, layouts, rooms} from './salas-fixture.mjs';

test('cada sala tiene seis estaciones con fotos, materiales descritos y ocho llaves', async () => {
  assert.deepEqual(rooms.map(room => room.caseId), [13, 25, 37]);
  for (const room of rooms) {
    assert.ok(room.intro);
    assert.deepEqual(room.games.map(game => game.prize), [1, 1, 1, 2, 1, 2]);
    assert.deepEqual(estacionesDeSala(room.id), room.games.map(game => game.id));
    assert.equal(new Set(room.games.map(game => game.kind)).size, 4);
    assert.equal(new Set(room.games.map(game => game.photo)).size, 6);
    for (const path of [room.photo, ...room.games.map(game => game.photo)]) {
      assert.ok(/^\/[\w-]+\.(webp|jpg)$/.test(path));
      assert.ok((await stat(new URL('../web' + path, import.meta.url))).size > 1000);
    }
    for (const game of room.games) {
      for (const field of ['description', 'prompt', 'mechanic', 'hint', 'feedback', 'success']) assert.ok(game[field], game.id);
      assert.ok(game.evidence.length && game.evidence.every(item => item.label && item.text));
      assert.ok(game.pieces.every(piece => piece.mark && piece.label && piece.note));
      assert.equal(new Set(game.pieces.map(piece => piece.id)).size, game.pieces.length);
      assert.equal(new Set(game.slots.map(slot => slot.id)).size, game.slots.length);
      if (game.kind === 'align') assert.deepEqual(game.slots.map(slot => slot.id), game.pieces.map(piece => piece.id));
      assert.ok(!('answer' in game || 'solution' in game || 'solved' in game));
    }
  }
});

// Estos criterios reconstruyen los objetos a partir de sus marcas públicas. La
// solución privada solo se consulta después para contrastar todos los montajes.
const allPresent = (selected, expected) => expected.every(mark => selected.includes(mark));
const compassTurn = (dir, turns) => compass[(compass.indexOf(dir) + turns + 4) % 4];
function connected(marks, separator, start, end) {
  const edges = marks.map(mark => mark.split(separator).map(s => s.trim()));
  return edges[0][0] === start && edges.at(-1)[1] === end &&
    edges.every((edge, i) => i === 0 || edge[0] === edges[i - 1][1]);
}
const mass = stone => [...stone].length;
const punches = mark => (mark.match(/•/g) || []).length;
const shapes = (marks, contours, counts) => marks.every((m, i) => m.includes(contours[i]) && punches(m) === counts[i]);

const rules = {
  luces: marks => allPresent(marks, ['· · —', '— / —']),
  portulano: marks => connected(marks, '→', '⚓', '✦'),
  compases: (turns, game) => {
    const origins = game.pieces.map(p => ({'↑': 'N', '←': 'O', '↓': 'S'})[p.mark]);
    return turns.every((turn, i) => turn === compassTurn(origins[i], [1, -1, 2][i]));
  },
  atraques: marks => marks.every((mark, i) => {
    const [draught, mast] = mark.match(/\d+/g).map(Number);
    return draught <= [2, 4, 4][i] && mast <= [Infinity, 2, Infinity][i];
  }),
  calcos: marks => {
    const cells = marks.flatMap(mark => mark.split(' · '));
    return allPresent(cells, ['A1', 'A3', 'B2', 'B3']) && new Set(cells).size === 4;
  },
  mareas: marks => marks[0] === 'I · muelle' && marks[3] === 'I · mar' &&
    marks[1].startsWith('III') && marks[2].includes('mar'),
  negativos: marks => {
    const prints = marks.map(negative => negative.replace(/[■□]/g, c => c === '■' ? '□' : '■'));
    return allPresent(prints, ['■ □ □', '□ ■ □']);
  },
  bobina: marks => connected(marks, '→', 'vacío', 'negro'),
  focos: turns => {
    // Coordenadas de alfombra, baúl y silla; destinos atril, puerta y piano.
    const from = [[1, 1], [0, 2], [2, 1]], to = [[1, 0], [2, 2], [0, 1]];
    return turns.every((turn, i) => {
      const dx = to[i][0] - from[i][0], dy = to[i][1] - from[i][1];
      return turn === (dx > 0 ? 'E' : dx < 0 ? 'O' : dy > 0 ? 'S' : 'N');
    });
  },
  guardarropa: marks => shapes(marks, ['☾', '☾', '□'], [2, 1, 2]),
  domino: marks => connected(marks, '|', '1', '5'),
  'tercera-silla': marks => {
    const nicks = marks.map(mark => (mark.match(/·/g) || []).length);
    return marks.every((mark, i) => mark.startsWith(['○', '△', '○'][i])) &&
      nicks.reduce((sum, n) => sum + n, 0) === 5 && nicks[1] === nicks[2];
  },
  improntas: marks => allPresent(marks.map(mark => mark.split(' ').reverse().join(' ')), ['✿ ● ≋', '● ≋ ✿']),
  vasijas: marks => marks.every((mark, i) => mark.startsWith(['4', '6', '4'][i]) && mark.endsWith(['║', '║', '│'][i])),
  sombras: (turns, game) => turns.every((turn, i) => ({'▾': 'S', '▸': 'E', '▴': 'N'})[game.pieces[i].mark] === compassTurn(turn, 2)),
  balanza: marks => mass(marks[0]) + mass(marks[2]) === mass(marks[1]) && mass(marks[0]) > mass(marks[2]),
  lino: marks => marks[0] === '∞' && marks.at(-1) === '⋮' && marks.indexOf('═') < marks.indexOf('▦'),
  barca: marks => {
    // Las mitades de oro forman un conector únicamente por sus caras opuestas.
    const joined = marks.map(mark => mark.replace('◐', 'oro').replace('◑', 'oro'));
    return connected(joined, '→', '◁', '▏') && marks[1].endsWith('◐') && marks[2].startsWith('◑');
  }
};

for (const room of rooms) {
  test(room.title + ' admite un único montaje por prueba de acuerdo con las pistas', () => {
    for (const game of room.games) {
      const marks = new Map(game.pieces.map(piece => [piece.id, piece.mark]));
      const candidates = layouts(game);
      const solutions = candidates.filter(attempt => rules[game.id](
        game.kind === 'align' ? attempt : attempt.map(id => marks.get(id)), game));
      assert.equal(solutions.length, 1, game.id + ' debe poder resolverse sin adivinar');
      assert.deepEqual(candidates.filter(attempt => validaEstacion(room.id, game.id, attempt)), solutions, game.id);
      if (game.kind === 'select') assert.equal(validaEstacion(room.id, game.id, [...solutions[0]].reverse()), true);
    }
  });
}

test('se descartan intentos incompletos, repetidos, no textuales o ajenos a la estación', () => {
  for (const room of rooms) {
    for (const game of room.games) {
      const solution = layouts(game).find(attempt => validaEstacion(room.id, game.id, attempt));
      assert.ok(solution, game.id);
      for (const input of [null, {}, 'true', [], solution.slice(1), [...solution, solution[0]],
        solution.map(() => solution[0]), solution.map(() => 1), ['constructor'], Array(solution.length)]) {
        assert.equal(validaEstacion(room.id, game.id, input), false, game.id);
      }
      assert.equal(validaEstacion(room.id, 'constructor', solution), false);
      assert.equal(validaEstacion(9, game.id, solution), false);
    }
  }
});
