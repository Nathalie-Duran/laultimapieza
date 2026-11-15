import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
async function appHarness(){
  const elements=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',dataset:{},open:false,hidden:false,
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(selector);};
  let fetcher=async()=>Response.json({}),bridge;
  const context=createContext({crypto:globalThis.crypto,structuredClone,AbortController,Response,console,
    document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},
    location:{hash:'#perfil'},localStorage:{getItem:()=>null,setItem(){}},
    setTimeout:()=>0,clearTimeout(){},setInterval(){},FormData,
    fetch:(...args)=>fetcher(...args),
    AccountAccess:{token:async()=>'test-token'},
    AccountUI:{start:async value=>{bridge=value;},signInPanel:()=>'<h1>Iniciar sesión</h1>',header:()=>'',accountCard:()=>'',open(){}},
    addEventListener(){},scrollTo(){}});
  context.window=context;
  for(const file of ['stories.js','season.js','engine.js','profile-model.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  runInContext(source,context);bridge.cloud(true);bridge.loading(false);
  return {bridge,element,setFetch(value){fetcher=value;}};
}
test('Cambiar de cuenta limpia la vista y una respuesta anterior no puede restaurar sus datos',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null}));
  await app.bridge.load();app.bridge.render();assert.match(app.element('#main').innerHTML,/Alice privada/);
  let release,started;const issued=new Promise(resolve=>{started=resolve;});
  app.setFetch(()=>new Promise(resolve=>{release=resolve;started();}));
  const pending=app.bridge.load();await issued;
  app.bridge.reset();app.bridge.render();assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
  release(Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null}));
  await assert.rejects(pending,/cuenta ha cambiado/);
  app.setFetch(async()=>Response.json({profile:{userId:'bob',name:'Bob independiente'},sessions:[],activeSessionId:null}));
  await app.bridge.load();app.bridge.render();
  assert.match(app.element('#main').innerHTML,/Bob independiente/);assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
});
test('Cerrar sesión durante una carga quita el estado de espera y los datos de la cuenta',async()=>{
  const app=await appHarness();app.bridge.loading(true);assert.match(app.element('#main').innerHTML,/Cargando/);
  app.bridge.reset();app.bridge.render();assert.match(app.element('#main').innerHTML,/Iniciar sesión/);assert.doesNotMatch(app.element('#main').innerHTML,/Cargando/);
});
