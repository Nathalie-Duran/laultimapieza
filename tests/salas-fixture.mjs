import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const window = {};
const source = await readFile(new URL('../web/salas-mundos-catalogo.js', import.meta.url), 'utf8');
runInNewContext(source, {window});
export const rooms = Object.values(structuredClone(window.SalasMundosCatalogo));

export const compass = ['N', 'E', 'S', 'O'];

export function layouts(game, prefix = []) {
  if (prefix.length === game.slots.length) return [prefix];
  const options = game.kind === 'align' ? compass : game.pieces.map(piece => piece.id).filter(id =>
    !prefix.includes(id) && (game.kind !== 'select' || !prefix.length || id > prefix.at(-1)));
  return options.flatMap(value => layouts(game, [...prefix, value]));
}
