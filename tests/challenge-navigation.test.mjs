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
  assert.match(guest, /Desafío diario/);
  assert.match(guest, /Misión semanal/);
  assert.match(guest, /<mansion-arcade\b/);
  assert.match(guest, /data-action="auth-login"/);
  assert.match(guest, /href="\/#planes"/);
  context.GameAccountBridge={isSignedIn:()=>true};
  const member = context.Colecciones.challenges({availableCases:[2,14,28,48]});
  assert.equal((member.match(/seccion=reto/g) || []).length, 4);
  assert.match(member, /#valdemar-jugar\?id=2&amp;seccion=reto/);
  assert.match(member, /#mundos-jugar\?id=48&amp;seccion=reto/);
  assert.match(member, /data-reto-premio="2">1 llave/);
  assert.match(member, /data-reto-premio="48">2 llaves/);
  assert.match(member, /href="\/#archivo"/);
});
