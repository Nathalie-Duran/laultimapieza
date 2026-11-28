import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parallelPrize} from '../valdemar-wallet.mjs';
import {mansionArcadeCatalog} from '../web/mansion-arcade-catalog.js';

const web = new URL('../web/', import.meta.url);
const browser = {window:{Retos:{}}};
runInNewContext(await readFile(new URL('retos-temporada.js',web),'utf8'),browser);
const {ficha} = browser.window.RetosTemporada;

test('Cada reto muestra una acción, su fotografía y las llaves de su propia aventura',async()=>{
  const titles = new Set();
  const photos = new Set();
  for(let id=1; id<=48; id++){
    const card=ficha(id);
    assert.equal(card, ficha(String(id)));
    assert.equal(card.prize, id===1 ? mansionArcadeCatalog.reduce((total,game)=>total+game.prize,0) : parallelPrize(id));
    assert.ok(card.title && card.action && card.action!==card.title);
    assert.deepEqual(Object.keys(card).sort(), ['action','photo','prize','title']);
    assert.match(card.photo,/^\/[a-z0-9-]+\.webp$/);
    const image=await readFile(new URL(card.photo.slice(1),web));
    assert.equal(image.toString('ascii',0,4),'RIFF');
    assert.equal(image.toString('ascii',8,12),'WEBP');
    titles.add(card.title);
    photos.add(card.photo);
  }
  assert.equal(titles.size,48);
  assert.equal(photos.size,48);
  for(const id of [0,49,'', '13x',true,null]) assert.equal(ficha(id),null);
});

test('La sala de Ada y los once retos de Código Valdemar se anuncian por el nombre del minijuego',async()=>{
  assert.equal(ficha(1).title,'La sala de juegos de Ada');
  for(const part of [1,2,3]){
    const source=await readFile(new URL('../valdemar-challenges-'+part+'.js',import.meta.url),'utf8');
    runInNewContext(source,browser);
  }
  for(let id=2; id<=12; id++) assert.equal(ficha(id).title,browser.window.Retos[id].title);
});

test('Mapas y fichas dirigen al visitante al reto correcto y al jugador al minijuego',()=>{
  const {enlace}=browser.window.RetosTemporada;
  for(const entitled of [false,true])assert.equal(enlace(1,entitled).href,'/#desafios?seccion=sala');
  for(let id=2;id<=48;id++){
    const season=['mapa','expedicion','umbravia','necropolis'][Math.floor((id-1)/12)];
    assert.equal(enlace(id).href,'/#desafios?mundo='+season+'&reto='+id);
    assert.equal(enlace(id,true).href,'/#'+(id<=12?'valdemar':'mundos')+'-jugar?id='+id+'&seccion=reto');
  }
  assert.equal(enlace(49),null);
  const {acceso}=browser.window.RetosTemporada;
  assert.match(acceso(1),/<span>Ver la sala<\/span>/);
  assert.match(acceso(13,true),/id=13&amp;seccion=reto"><small>Reto extra<\/small><strong>La regata de las botellas<\/strong><span>Jugar el reto/);
  assert.equal(acceso(0),'');
});
