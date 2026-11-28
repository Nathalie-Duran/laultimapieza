import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
async function appHarness({fullAccess=false}={}){
  const elements=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',dataset:{},open:false,hidden:false,
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},replaceChildren(){this.innerHTML='';},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(selector);};
  let fetcher=async()=>Response.json({}),bridge;
  const context=createContext({crypto:globalThis.crypto,structuredClone,AbortController,Response,URLSearchParams,console,
    document:{body:element('body'),getElementById:id=>element('#'+id),querySelector:element,querySelectorAll:()=>[],addEventListener(){}},
    location:{hash:'#perfil'},localStorage:{getItem:()=>null,setItem(){}},
    setTimeout:()=>0,clearTimeout(){},setInterval(){},FormData,
    fetch:(...args)=>fetcher(...args),
    AccountAccess:{token:async()=>'test-token'},
    AccountUI:{start:async value=>{bridge=value;},signInPanel:()=>'<h1>Iniciar sesión</h1>',header:()=>'',accountCard:()=>'',open(){}},
    addEventListener(){},scrollTo(){}});
  context.window=context;
  for(const file of ['stories.js','season.js','engine.js','profile-model.js','membership.js',...(fullAccess?['membership-flow.js']:[]),'monthly-access.js','experience-ui.js','profile-notebook.js','archive.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  runInContext(source,context);bridge.cloud(true);bridge.loading(false);
  return {bridge,element,membership:context.ClubAccess,setFetch(value){fetcher=value;},credential(value){context.AccountAccess.user=value;},
    visit(hash){context.location.hash=hash;bridge.render();return element('#main').innerHTML;}};
}
test('Cambiar de cuenta limpia la vista y una respuesta anterior no puede restaurar sus datos',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null,membership:{canPlay:true}}));
  await app.bridge.load();app.bridge.render();assert.match(app.element('#main').innerHTML,/Alice privada/);
  assert.equal(app.membership.canPlay,true);
  let release,started;const issued=new Promise(resolve=>{started=resolve;});
  app.setFetch(()=>new Promise(resolve=>{release=resolve;started();}));
  const pending=app.bridge.load();await issued;
  app.bridge.reset();app.bridge.render();assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
  assert.equal(app.membership.canPlay,false);
  release(Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null}));
  await assert.rejects(pending,/cuenta ha cambiado/);
  app.setFetch(async()=>Response.json({profile:{userId:'bob',name:'Bob independiente'},sessions:[],activeSessionId:null}));
  await app.bridge.load();app.bridge.render();
  assert.equal(app.membership.canPlay,false);
  assert.match(app.element('#main').innerHTML,/Bob independiente/);assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
});
test('Cerrar sesión durante una carga quita el estado de espera y los datos de la cuenta',async()=>{
  const app=await appHarness();app.bridge.loading(true);assert.match(app.element('#main').innerHTML,/Cargando/);
  app.bridge.reset();app.bridge.render();assert.match(app.element('#main').innerHTML,/Iniciar sesión/);assert.doesNotMatch(app.element('#main').innerHTML,/Cargando/);
});

test('las rutas del cuaderno de un titular sin cuota conservan cuenta, archivo y colección y cierran al salir',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'lector',name:'Alicia'},sessions:[],activeSessionId:null}));
  await app.bridge.load();
  assert.equal(app.bridge.playerName(),'Alicia');
  const routes=[['#perfil','Cuaderno del aventurero'],['#perfil?seccion=trayectoria','profile-collection data-career'],
    ['#perfil?seccion=coleccion','lup-explorador collection'],['#perfil?seccion=logros','<profile-collection>'],
    ['#perfil?seccion=archivo-secreto','profile-collection data-archive'],['#perfil?seccion=llaves','profile-collection data-keys'],
    ['#perfil?seccion=pareja','<profile-partners>'],['#perfil?seccion=cuenta','<play-notice-preferences>'],['#archivo','Mis partidas']];
  for(const [route,expected] of routes)assert.ok(app.visit(route).includes(expected),route);
  app.bridge.reset();assert.equal(app.bridge.playerName(),'');
  for(const [route] of routes)assert.match(app.visit(route),/Iniciar sesión/);
});

test('cada entrada del cuaderno muestra la acción de acceso, pareja y archivo en su destino',async()=>{
  const app=await appHarness({fullAccess:true});
  assert.match(app.visit('#archivo'),/<h1>Mis partidas<\/h1>/);
  assert.match(app.visit('#perfil'),/<h1>Mi cuaderno<\/h1>/);
  for(const hash of ['#archivo','#perfil']){
    const guest=app.visit(hash);
    assert.equal(guest.match(/data-action="auth-login"/g)?.length,1);
    assert.equal(guest.match(/data-action="auth-register"/g)?.length,1);
  }
  app.credential({emailVerified:false});
  assert.equal(app.visit('#perfil'),'<h1>Iniciar sesión</h1>');
  app.credential(null);
  for(const membership of [{canManage:false,canPlay:false},{canManage:false,canPlay:true},{canManage:true,canPlay:true,role:'admin'}]){
    app.setFetch(async()=>Response.json({profile:{userId:'persona',name:'Mi perfil'},sessions:[],activeSessionId:null,membership}));
    await app.bridge.load();
    const main=app.visit('#perfil');
    assert.equal(main.includes('notebook-management'),membership.canManage);
    assert.doesNotMatch(main,/preferred-partner|Noches para recordar|Mis reliquias|Aún no tienes partidas del archivo clásico/);
    const nav=main.match(/<nav class="notebook-nav"[\s\S]*?<\/nav>/)[0];
    assert.equal(nav.match(/href="#archivo"/g)?.length,1);
    const paired=app.visit('#perfil?seccion=pareja');
    assert.equal(paired.match(/<preferred-partner>/g)?.length,1);
    assert.equal(paired.match(/<profile-partners>/g)?.length,1);
    const style=app.visit('#perfil?seccion=estilo');
    assert.match(style,/Tu estilo del archivo clásico/);assert.doesNotMatch(style,/class="trait-grid"|Descubre tu sello/);
    const archive=app.visit('#archivo');
    assert.doesNotMatch(archive,/archive-memories/);
    assert.match(archive,/<details class="pn-archive-options">[\s\S]*data-action="progress-reset-open"/);
  }
});
