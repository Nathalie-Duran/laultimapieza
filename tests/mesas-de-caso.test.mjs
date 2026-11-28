import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const web=new URL('../web/',import.meta.url);
const source=file=>readFile(new URL(file,web),'utf8');

async function loader(failOnce){
  const requests=[];
  const context={window:{},URL,document:{
    currentScript:{src:'https://juego.example/archivo-objetos.js?v=prueba'},
    createElement:tag=>({tag,remove(){}}),
    head:{async append(asset){
      const url=new URL(asset.href||asset.src);
      requests.push(url);
      await Promise.resolve();
      try{
        if(failOnce===asset.tag){failOnce=null;throw new Error('Fallo temporal');}
        const text=await source(url.pathname.slice(1));
        if(asset.tag==='script')runInNewContext(text,context);
        asset.onload();
      }catch{asset.onerror();}
    }}
  }};
  runInNewContext(await source('archivo-objetos.js'),context);
  return {game:context.window,requests};
}

test('Jugar carga cada mesa de su temporada con su hoja de estilo y reutiliza los archivos',async()=>{
  const {game,requests}=await loader();
  await game.ArchivoObjetos.open(1);
  assert.equal(requests.length,0);
  for(let id=2;id<=48;id++){
    await Promise.all([game.ArchivoObjetos.open(id),game.ArchivoObjetos.open(id)]);
    assert.equal(typeof game.MesasDeCaso[id],'function','Falta la mesa del juego '+id);
    assert.equal(typeof game.ArchivosDeCaso[id],'function','Falta el lector de evidencias del juego '+id);
  }
  assert.equal(requests.length,19);
  for(const url of requests){
    assert.equal(url.search,'?v=prueba');
    if(url.pathname.endsWith('.js')&&!url.pathname.endsWith('/tercer-jugador-evidencias.js')){
      assert.ok(requests.some(s=>s.pathname===url.pathname.replace(/\.js$/,'.css')));
    }
  }
});

test('Volver a abrir un juego después de un fallo recupera el módulo pendiente',async()=>{
  const {game,requests}=await loader('script');
  await assert.rejects(game.ArchivoObjetos.open(2),/cargar la mesa/);
  await game.ArchivoObjetos.open(2);
  assert.equal(typeof game.MesasDeCaso[2],'function');
  assert.deepEqual(requests.map(r=>r.pathname),['/hotel-investigacion.css','/hotel-investigacion.js','/hotel-investigacion.js']);
});
