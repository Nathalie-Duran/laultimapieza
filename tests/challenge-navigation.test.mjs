import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

test('El catálogo muestra los cuatro tableros y enlaza únicamente los retos abiertos', async () => {
  const context = createContext({});
  context.window = context;
  for (const file of ['valdemar-catalog','mundos-catalogo','editorial-challenges','colecciones']) {
    const code = await readFile(new URL('../web/'+file+'.js', import.meta.url), 'utf8');
    runInContext(code, context);
  }
  const guest = context.Colecciones.challenges();
  assert.equal((guest.match(/class="challenge-board"/g) || []).length, 4);
  assert.doesNotMatch(guest, /seccion=reto/);
  assert.match(guest, /published-challenges/);
  const member = context.Colecciones.challenges({availableCases:[2,14,28,48]});
  assert.equal((member.match(/seccion=reto/g) || []).length, 4);
  assert.match(member, /#valdemar-jugar\?id=2&amp;seccion=reto/);
  assert.match(member, /#mundos-jugar\?id=48&amp;seccion=reto/);
});
