import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const read=name=>readFile(new URL('../web/'+name,import.meta.url),'utf8');
const entry=await read('cinta87-entry.js');
class Node {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.attrs={};this.isConnected=true;
    this.classList={add(){},remove(){}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(event,fn){this.events[event]=fn;}
  setAttribute(key,v){this.attrs[key]=v;}
  removeAttribute(key){delete this.attrs[key];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){this.focused=true;}
}
function page(path,standalone,alias=false){
  const url=new URL(path,'https://www.laultimapieza.es'),dest=[],metrics=[],sessions=[],hooks={},documentHooks={};
  const location={href:url.href,search:url.search,origin:url.origin,assign:path=>dest.push(path),replace:path=>dest.push(path)};
  const history={state:null,pushed:0,backCount:0,pushState(state){this.pushed++;this.state=state;},back(){this.backCount++;this.state=null;}};
  const surface=new Node(standalone?'main':'dialog'),modal=new Node('dialog');
  const document={body:{dataset:alias?{cintaAlias:''}:standalone?{vallejoStandalone:'true'}:{}},activeElement:null,
    getElementById:id=>id===(standalone?'cinta87-standalone-host':'scene-preview')?surface:id==='modal'?modal:null,
    createElement:t=>new Node(t),createTextNode:t=>t,querySelector:()=>null,addEventListener:(name,cb)=>{documentHooks[name]=cb;}};
  const window={location,history,addEventListener:(n,cb)=>{hooks[n]=cb;},dispatchEvent(){},
    Cinta87Demo:{mount:(host,callbacks)=>{const s={host,callbacks,destroyed:false};sessions.push(s);return {destroy:()=>{s.destroyed=true;}};},
      hasProgress:()=>sessions.length>0,isComplete:()=>false}};
  runInNewContext(entry,{window,document,URL,location,history,CustomEvent:class{},fetch:async(_,init)=>{metrics.push(JSON.parse(init.body));}});
  return {url,window,documentHooks,hooks,surface,sessions,history,dest,metrics};
}
test('un enlace compartido abre la demo sin cuenta; conserva el caso al visitar el archivo y volver',()=>{
  const demo=page('/cinta-87.html?via=invitacion&caso=04',true);
  assert.equal(demo.sessions.length,1);
  const {callbacks}=demo.sessions[0];
  assert.equal(callbacks.exitLabel,'Volver a la ficha');
  callbacks.onEvent('start');assert.deepEqual(demo.metrics,[]);
  const utility=demo.surface.children[1],checkbox=utility.children[1].children[1].children[0];
  checkbox.checked=true;checkbox.events.change();callbacks.onEvent('receipt');
  assert.deepEqual(demo.metrics.map(e=>e.event),['demo_start','demo_receipt']);
  checkbox.checked=false;checkbox.events.change();callbacks.onEvent('complete');assert.equal(demo.metrics.length,2);
  callbacks.onArchive();assert.equal(demo.dest[0],'/cinta-87.html?archivo=1&caso=04&via=invitacion');
  callbacks.onExit();assert.equal(demo.dest[1],'/valdemar/04/');
  const independent=page('/cinta-87.html?caso=https://otra.example',true);independent.sessions[0].callbacks.onExit();
  assert.equal(independent.sessions[0].callbacks.exitLabel,'Volver al catálogo');
  assert.deepEqual(independent.dest,['/#casos']);
  const archive=page(demo.dest[0],true);assert.equal(archive.sessions.length,0);
});
test('la dirección anterior mantiene el caso, el archivo y el fragmento en la nueva dirección comercial',()=>{
  for(const suffix of ['', '?via=invitacion&caso=04', '?caso=29&archivo=1#estante']){
    const alias=page('/vallejo.html'+suffix,false,true);
    assert.deepEqual(alias.dest,['https://www.laultimapieza.es/cinta-87.html'+suffix]);
    assert.equal(alias.sessions.length,0);
  }
});
test('las 36 fichas de los otros tableros abren la demo y el botón de salida recupera la misma ficha',async()=>{
  const worlds={window:{},location:{hash:''},URLSearchParams};
  for(const file of ['mundos-catalogo.js','mundos-vista.js'])runInNewContext(await read(file),worlds);
  for(const item of worlds.window.MundosCatalogo){
    const hash=worlds.window.Mundos.route(item.world,item.id)+'&seccion=ficha';
    worlds.location.hash=hash;
    const html=worlds.window.Mundos.view(item.world);
    const dest=html.match(/class="md-demo-link" href="([^"]+)"/)?.[1];
    assert.equal(dest,'/cinta-87.html?caso='+item.id,item.title);
    const demo=page(dest,true);
    demo.sessions[0].callbacks.onArchive();demo.sessions[0].callbacks.onExit();
    assert.deepEqual(demo.dest,['/cinta-87.html?archivo=1&caso='+item.id,'/'+hash]);
  }
});
test('la portada abre la misma aventura en diálogo y Atrás/Adelante restaura el foco y la sesión',()=>{
  const demo=page('/#inicio',false);assert.equal(demo.sessions.length,0);
  const trigger=new Node('button');trigger.closest=()=>trigger;
  demo.documentHooks.click({target:trigger,preventDefault(){}});
  assert.equal(demo.sessions.length,1);assert.ok(demo.surface.open);assert.equal(demo.history.pushed,1);
  assert.equal(demo.sessions[0].callbacks.exitLabel,'Cerrar la demo');
  demo.window.CasePreview.open(undefined,trigger);assert.equal(demo.sessions.length,1);
  const state=demo.history.state;demo.history.state=null;demo.hooks.popstate();
  assert.ok(demo.sessions[0].destroyed);assert.ok(trigger.focused);assert.equal(demo.surface.open,false);
  demo.history.state=state;demo.hooks.popstate();
  assert.equal(demo.sessions.length,2);assert.equal(demo.history.pushed,1);
  demo.sessions[1].callbacks.onExit();assert.equal(demo.history.backCount,1);
  assert.ok(demo.sessions[1].destroyed);
});
test('las marcas históricas de ambos expedientes se mantienen aparte de la partida de la cinta',async()=>{
  const source=await read('preview-investigation.js');
  const value=JSON.stringify({version:1,round:2,playMode:'duo',section:'tomas',files:{marta:'06_expediente_marta.html',tomas:'01_diario_marta.png'},unlocked:['marta']});
  const storage=new Map([['lup.vallejo.bookmark.v1',value]]);
  const window={location:new URL('https://www.laultimapieza.es/'),localStorage:{getItem:key=>storage.get(key)}};
  runInNewContext(source,{window,document:{body:{dataset:{}}},URL,URLSearchParams});
  assert.equal(window.VallejoArchive.hasProgress(),true);
  assert.equal(storage.get('lup.vallejo.bookmark.v1'),value);
  assert.equal(window.CasePreview,undefined);
});
