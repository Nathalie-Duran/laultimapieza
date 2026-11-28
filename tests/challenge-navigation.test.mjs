import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

test('la portada enlaza cada destino y solo el tablero seleccionado enumera sus retos', async () => {
  const context = createContext({location:{hash:'#desafios'},URLSearchParams});
  context.window = context;
  for (const file of ['valdemar-catalog','mundos-catalogo','editorial-challenges','colecciones']) {
    const code = await readFile(new URL('../web/'+file+'.js', import.meta.url), 'utf8');
    runInContext(code, context);
  }
  const guest=context.Colecciones.challenges();
  assert.equal((guest.match(/class="challenge-board"/g)||[]).length,4);
  for(const name of ['Código Valdemar','La ruta prohibida','El tercer jugador','La ira de Ra']){
    assert.ok(guest.includes('<h3>'+name+'</h3>'),name);
  }
  assert.match(guest,/juegos opcionales/);
  assert.match(guest,/llaves para pedir pistas/);
  assert.match(guest,/data-target="retos-tableros"/);
  assert.match(guest,/id="retos-tableros" tabindex="-1"/);
  assert.match(guest,/cinco huéspedes/);
  assert.match(guest,/Hasta 8 llaves en total/);
  assert.match(guest,/primer caso de Código Valdemar/);
  assert.match(guest,/href="\/#desafios\?seccion=sala"/);
  assert.match(guest,/href="\/#desafios\?seccion=calendario"/);
  assert.doesNotMatch(guest,/seccion=reto|<mansion-arcade|id="calendar-challenges"/);
  assert.match(guest,/data-action="auth-login"/);
  context.GameAccountBridge={isSignedIn:()=>true};
  assert.match(context.Colecciones.challenges({availableCases:[1]}),/Ya tienes acceso a la sala de Ada y al calendario/);
  const member={availableCases:[2,14,28,48]};
  assert.match(context.Colecciones.challenges(member),/href="\/#archivo"/);
  for(const [board,id] of [['mapa',2],['expedicion',14],['umbravia',28],['necropolis',48]]){
    context.location.hash='#desafios?mundo='+board;
    const html=context.Colecciones.challenges(member);
    assert.equal((html.match(/seccion=reto/g)||[]).length,1);
    assert.ok(html.includes('id='+id+'&amp;seccion=reto'));
    assert.ok(html.includes('data-reto-premio="'+id+'">'+(id===48?'2 llaves':'1 llave')));
    assert.match(html,/Todos los desafíos/);
    assert.doesNotMatch(context.Colecciones.challenges(),/seccion=reto/);
  }
  context.location.hash='#desafios?seccion=calendario';
  const calendar=context.Colecciones.challenges(member);
  assert.match(calendar,/<h1>Calendario de juego<\/h1>/);
  assert.match(calendar,/Desafío diario/);
  assert.match(calendar,/Misión semanal/);
  assert.doesNotMatch(calendar,/challenge-board|<mansion-arcade/);
  context.location.hash='#desafios?seccion=sala';
  assert.match(context.Colecciones.challenges(member),/<mansion-arcade>/);
});
