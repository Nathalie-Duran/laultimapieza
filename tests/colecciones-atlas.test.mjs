import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext, runInContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {worldSeasonAccess} from '../valdemar-wallet.mjs';

async function atlas(hash='#tableros') {
  const context=createContext({URLSearchParams,location:{hash}});
  context.window=context;
  for(const file of ['retos-temporada','valdemar-catalog','mundos-catalogo','sellos-temporadas','colecciones']) {
    runInContext(await readFile(new URL('../web/'+file+'.js',import.meta.url),'utf8'),context);
  }
  return context.Colecciones;
}

test('el atlas público abre Valdemar y conserva las doce paradas oficiales de cada territorio',async()=>{
  const catalog=await atlas(),html=catalog.boards();
  assert.equal((html.match(/role="tab"/g)||[]).length,4);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,4);
  assert.equal((html.match(/data-atlas-state="preview"/g)||[]).length,48);
  assert.match(html,/Primera aventura<\/span><h2><a href="\/valdemar\/01\/">El secreto de los dos mundos/);
  for(const season of catalog.seasons) {
    assert.ok(html.includes('src="/'+season.art+'"'));
    for(let i=1;i<=12;i++)assert.ok(html.includes('href="/#'+season.board+'?lugar='+i+'"'));
  }
  assert.doesNotMatch(html,/\/#[^"]+-jugar\?id=/);
});

test('los bloques abonados y las piezas ganadas permanecen separados incluso con un hueco de pago',async()=>{
  const catalog=await atlas();
  const access=worldSeasonAccess({cycles:[{id:'second',start:1,end:10,worldBlock:2}],valdemarCaseProgress:{paid:{6:{choice:'final'}}}},{now:5,active:true});
  const html=catalog.boards(access);
  assert.match(html,/4\/12 aventuras disponibles/);
  assert.match(html,/1\/12 piezas recuperadas/);
  assert.match(html,/<div class="atlas-next" data-atlas-next="1"><span>Siguiente aventura disponible<\/span><h2><a href="\/#valdemar-jugar\?id=5">/);
  assert.match(html,/href="\/#mapa\?lugar=6" data-atlas-state="done"/);
  assert.match(html,/href="\/#mapa\?lugar=1" data-atlas-state="closed"/);
  assert.match(html,/Completa los doce juegos de la temporada anterior<\/span><h2><a href="\/#mapa">Volver a Código Valdemar/);
  assert.equal((html.match(/data-atlas-state="open"/g)||[]).length,3);
});

test('el enlace al mundo elegido sobrevive al recargado y el epílogo depende de las doce piezas',async()=>{
  const catalog=await atlas('#tableros?mundo=expedicion');
  const records=Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,{choice:'final'}]));
  const html=catalog.boards(worldSeasonAccess({valdemarCaseProgress:{paid:records}}));
  assert.match(html,/data-atlas-board="expedicion" role="tab" aria-controls="atlas-panel-2" aria-selected="true"/);
  assert.match(html,/href="\/#mapa\?seccion=sello">Leer el epílogo/);
  assert.equal((html.match(/href="\/#mapa\?seccion=sello"/g)||[]).length,1);
  assert.equal((html.match(/Leer el epílogo/g)||[]).length,1);
});

test('cada territorio conduce a una actividad secundaria real y solo los casos abiertos lanzan el reto',async()=>{
  const publicAtlas=await atlas(),guest=publicAtlas.boards();
  assert.equal((guest.match(/class="atlas-side-stop"/g)||[]).length,4);
  assert.match(guest,/href="\/#desafios\?seccion=sala">Visitar la sala de Ada/);
  for(const {board} of publicAtlas.seasons){
    assert.ok(guest.includes('class="atlas-extra-photo" src="/extras-'+board+'.webp"'));
    assert.ok(guest.includes('href="/#desafios?mundo='+board+'">Ver todos los retos'));
  }
  const room=await atlas('#desafios?seccion=sala');
  assert.match(room.challenges(),/<mansion-arcade><\/mansion-arcade>/);
  const {mansionArcadeCatalog}=await import('../web/mansion-arcade-catalog.js');
  assert.deepEqual(mansionArcadeCatalog.map(game=>game.id),['archivo','relojero','museo','cartas','jardin','espejo']);
  for(const [index,board] of ['expedicion','umbravia','necropolis'].entries()){
    const id=17+12*index,link='/#mundos-jugar?id='+id+'&amp;seccion=reto';
    const modulePattern=new RegExp('<aside class="atlas-side-stop" aria-labelledby="atlas-side-'+(index+2)+'">([\\s\\S]*?)</aside>');
    const guestModule=guest.match(modulePattern)[1];
    assert.equal((guestModule.match(/<a /g)||[]).length,1);
    assert.ok(guestModule.includes('href="/#desafios?mundo='+board+'">Ver todos los retos'));
    assert.doesNotMatch(guestModule,/lugar=|seccion=reto|Ver la parada/);
    const chosen=await atlas('#desafios?mundo='+board);
    assert.ok(!chosen.challenges().includes('seccion=reto'));
    const choices=chosen.challenges({availableCases:[id]});
    assert.equal((choices.match(/<li>/g)||[]).length,12);
    assert.equal((choices.match(/seccion=reto/g)||[]).length,1);
    assert.ok(choices.includes(link));
    const memberModule=publicAtlas.boards({availableCases:[id]}).match(modulePattern)[1];
    assert.equal((memberModule.match(/<a /g)||[]).length,2);
    assert.ok(memberModule.includes(link));
    assert.ok(memberModule.includes('href="/#desafios?mundo='+board+'"'));
  }
});
