import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {mansionArcadeRequest} from '../mansion-arcade.mjs';
import {creditMansionArcade} from '../valdemar-wallet.mjs';

const path='/api/valdemar/mansion/arcade';
const ids=['archivo','relojero','museo','cartas','jardin','espejo'];
function fixture(availableCases=[1,2,3,4]){
  const progress={paid:{1:{mansion:{scene:'sala-de-prueba',evidence:[]}}}};
  const data={valdemarCaseProgress:structuredClone(progress)};
  const store={
    getMemberData:async uid=>{assert.equal(uid,'ana');return structuredClone(data);},
    saveMemberData:async(uid,next)=>{assert.equal(uid,'ana');Object.assign(data,next);}
  };
  const billing={membership:async()=>({canPlay:availableCases.length>0,seasonAccess:{availableCases}})};
  const request=(method,input,editorial=false)=>mansionArcadeRequest({path,method,input,uid:'ana',editorial,billing,withStore:fn=>fn(store)});
  return {progress,data,request};
}

test('el catálogo muestra solo información de juego y los premios del ámbito de la cuenta',async()=>{
  const db=fixture();
  assert.equal(creditMansionArcade(db.data,'editorial','archivo',1),true);
  assert.equal(creditMansionArcade(db.data,'editorial','archivo',1),false);
  assert.equal(creditMansionArcade(db.data,'paid','cartas',2),true);
  const {games}=await db.request('GET');
  assert.deepEqual(games.map(g=>g.id),ids);
  assert.deepEqual(games.map(g=>g.prize),[1,1,1,2,1,2]);
  assert.ok(games.every(g=>Object.keys(g).sort().join(',')==='description,id,prize,solved,title'));
  assert.deepEqual(games.filter(g=>g.solved).map(g=>g.id),['cartas']);
  const editorial=await db.request('GET',null,true);
  assert.deepEqual(editorial.games.filter(g=>g.solved).map(g=>g.id),['archivo']);
  assert.deepEqual(db.data.valdemarCaseProgress,db.progress);
});

test('los intentos vacíos, adulterados y de otro tablero no acreditan premios',async()=>{
  const db=fixture();
  const invalid={
    archivo:['TEXTO','DE PRUEBA'],relojero:[18,18,18],museo:[0,0,0],
    cartas:{order:['a','a','a','a'],message:'PRUEBA'},jardin:[4,4,4,4],espejo:[-1,0,99]
  };
  for(const id of ids){
    for(const attempt of [null,true,{},invalid[id]]) {
      assert.deepEqual(await db.request('POST',{id,attempt,solved:true,reward:999}),{correct:false,awarded:0});
    }
  }
  assert.equal(db.data.valdemarSeasonOne,undefined);
  await assert.rejects(db.request('POST',{id:'otro'}),{status:400});
  await assert.rejects(db.request('DELETE'),{status:405});
  for(const available of [[],[5,6,7,8]]){
    const blocked=fixture(available);
    await assert.rejects(blocked.request('GET'),{code:'MANSION_ACCESS_REQUIRED'});
    await assert.rejects(blocked.request('POST',{id:'jardin',attempt:[]}),{code:'MANSION_ACCESS_REQUIRED'});
    assert.equal(blocked.data.valdemarSeasonOne,undefined);
  }
});

test('los controles de las seis salas respetan la confirmación del servidor y regresan a la aventura',async()=>{
  const db=fixture();
  const control={focus(){}}, elements=new Map(), events=[], posts=[];
  let confirmed=false;
  async function request(url,input,method='GET'){
    assert.equal(url,path);
    if(method==='GET')return db.request('GET');
    posts.push(input);
    return confirmed?{correct:true,awarded:2}:{correct:false,awarded:0};
  }
  class Element {
    addEventListener(){} hasAttribute(){return true;} contains(){return true;}
    closest(){return null;} querySelector(){return control;} querySelectorAll(){return [];}
    dispatchEvent(e){events.push(e.type);}
  }
  const code=await readFile(new URL('../web/mansion-arcade.js',import.meta.url),'utf8');
  runInNewContext(code,{HTMLElement:Element,customElements:{get:id=>elements.get(id),define:(id,C)=>elements.set(id,C)},
    CustomEvent:class{constructor(type){this.type=type;}},window:{GameAccountBridge:{request,isSignedIn:()=>true}}});
  const C=elements.get('mansion-arcade'), element=new C();
  element.states={};
  await element.load();
  const click=(act,value)=>element.clickControl({target:{closest:()=>({dataset:{act,value},closest:()=>null})}});
  for(const id of ids){
    click('open',id);
    assert.match(element.innerHTML,/Volver a la aventura/);
    await element.check();
    assert.equal(posts.at(-1).id,id);
    assert.ok(Object.hasOwn(posts.at(-1),'attempt'));
    assert.doesNotMatch(element.innerHTML,/Has ganado/);
    click('back');
  }
  confirmed=true;
  click('open','cartas');
  await element.check();
  assert.match(element.innerHTML,/Has ganado 2 llaves/);
  click('return');
  assert.deepEqual(events,['mansion-arcade-reward','mansion-arcade-close']);
});

test('la sala ofrece seis fichas a visitantes y reserva el jugador y el progreso para las cuentas con acceso',async t=>{
  const captures=new Map(),calls=[];
  let focused='';
  class Dialog {
    constructor(){this.events=new Map();this.dataset={};}
    setAttribute(name,value){this[name]=value;}
    addEventListener(name,listener){this.events.set(name,listener);}
    showModal(){this.open=true;}
    close(){this.open=false;this.events.get('close')?.();}
    remove(){this.removed=true;}
    querySelector(){return {focus:()=>{focused='dialog';}};}
  }
  class Room {
    closest(selector){return selector==='.reto-sala'?{}:null;}
    contains(){return true;}
    hasAttribute(){return false;}
    append(dialog){this.dialog=dialog;}
    querySelector(selector){return selector==='dialog[open]' && this.dialog?.open?this.dialog:null;}
    querySelectorAll(){return ids.map(value=>({dataset:{act:'detail',value},focus(){focused=value;}}));}
  }
  const page={GameAccountBridge:{isSignedIn:()=>false,request:async()=>{calls.push('guest');}}};
  const globals={window:page,document:{createElement:tag=>{assert.equal(tag,'dialog');return new Dialog();}},
    HTMLElement:Room,customElements:{get:id=>captures.get(id),define:(id,C)=>captures.set(id,C)}};
  for(const [name,value] of Object.entries(globals)){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  // Import the native component so the visitor takes its public-catalog import path.
  await import('../web/mansion-arcade.js');
  const Component=captures.get('mansion-arcade'),room=new Component();
  room.states={};
  const click=(act,value)=>room.clickControl({target:{closest:()=>({dataset:{act,value}})}});
  await room.load();
  assert.match(room.innerHTML,/<h1[^>]*>La sala de juegos de Ada/);
  assert.match(room.innerHTML,/class="ma87-scene"[^>]+sala-de-ada\.webp/);
  assert.deepEqual([...room.innerHTML.matchAll(/data-act="detail" data-value="([^"]+)"/g)].map(m=>m[1]),ids);
  assert.doesNotMatch(room.innerHTML,/class="ma87-progress"|data-act="open"/);
  for(const id of ids){
    click('detail',id);
    const dialog=room.dialog;
    assert.equal(dialog.open,true);
    assert.equal(focused,'dialog');
    assert.ok(dialog.innerHTML.includes('/sala-'+id+'.webp'));
    assert.match(dialog.innerHTML,/href="\/#planes"/);
    assert.match(dialog.innerHTML,/data-action="auth-login"/);
    assert.doesNotMatch(dialog.innerHTML,/data-act="open"|data-field=/);
    click('close-detail');
    assert.equal(dialog.removed,true);
    assert.equal(focused,id);
    click('open',id);
    assert.equal(room.current,undefined);
  }
  assert.deepEqual(calls,[]);
  const games=room.games.map(g=>({...g,solved:g.id==='cartas'||g.id==='jardin'}));
  page.GameAccountBridge={isSignedIn:()=>true,request:async url=>{calls.push(url);return {games};}};
  await room.load();
  assert.match(room.innerHTML,/2 de 6 estaciones resueltas/);
  assert.match(room.innerHTML,/3 llaves[^<]*8/);
  click('detail','cartas');
  assert.match(room.dialog.innerHTML,/data-act="open"[^>]+>Volver a jugar/);
  assert.doesNotMatch(room.dialog.innerHTML,/href="\/#planes"/);
  room.dialog.close();
  assert.equal(focused,'cartas');
  page.GameAccountBridge.request=async url=>{calls.push(url);throw Object.assign(Error('Acceso caducado'),{status:403});};
  await room.load();
  click('detail','jardin');
  assert.match(room.dialog.innerHTML,/href="\/#planes"/);
  assert.doesNotMatch(room.dialog.innerHTML,/data-act="open"|data-action="auth-login"/);
  assert.doesNotMatch(room.innerHTML,/class="ma87-progress"/);
  assert.deepEqual(calls,[path,path]);
});
