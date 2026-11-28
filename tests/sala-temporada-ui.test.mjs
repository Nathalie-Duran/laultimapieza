import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const scripts=await Promise.all(['salas-mundos-catalogo','sala-temporada'].map(name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8')));
function harness(){
  const elements=new Map(),storage=new Map(),events=[];
  const window={GameAccountBridge:{isSignedIn:()=>false}};
  const document={activeElement:{},body:{}};
  class Element {
    constructor(){this.nodes=new Map();}
    hasAttribute(){return false;}
    querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,{});return this.nodes.get(key);}
    querySelectorAll(){return [];}
    dispatchEvent(value){events.push(value);}
  }
  const context={window,document,HTMLElement:Element,CustomEvent:class {constructor(type,opts){Object.assign(this,{type},opts);}},
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    customElements:{define:(tag,type)=>elements.set(tag,type),get:tag=>elements.get(tag)}};
  for(const script of scripts)runInNewContext(script,context);
  function enter(number,member){
    const instance=new (elements.get('sala-temporada'))();
    Object.assign(instance,{number,room:window.SalasMundosCatalogo[number],drafts:new Map(),won:new Set(),pending:new Set(),allowed:!!member,player:member,generation:1,mesa:{update(){},destroy(){}}});
    return instance;
  }
  return {window,storage,events,enter};
}

test('los intentos se recuperan únicamente para su cuenta, sala y estación, y descartan piezas obsoletas',()=>{
  const {enter,storage}=harness();
  for(const number of [2,3,4]){
    const first=enter(number,'ana'),game=first.room.games[0];
    const mine=first.draft(game);mine.push(game.pieces[0].id);first.save(game);
    assert.deepEqual([...enter(number,'ana').draft(game)],[game.pieces[0].id]);
    assert.deepEqual([...enter(number,'otra').draft(game)],[]);
    const key=first.draftKey(game);storage.set(key,JSON.stringify(['retirada',game.pieces[1].id,game.pieces[1].id]));
    assert.deepEqual([...enter(number,'ana').draft(game)],[game.pieces[1].id]);
  }
});

test('las tres salas presentan la misma mesa de ayuda en la entrada, con pasos propios y foco en las estaciones',()=>{
  const {window,enter}=harness();let guide;
  window.MesaDeJuego={mount(_node,options){guide=options;return {destroy(){}};}};
  for(const number of [2,3,4]){
    const screen=enter(number,null);screen.lobby();
    assert.equal(guide.next.label,'Explorar las estaciones');
    assert.equal(guide.help.context,'sala');
    assert.ok(guide.help.text.includes(screen.room.title));
    assert.ok(guide.help.steps[0].includes(screen.room.games[0].title));
    let focused=false;screen.querySelector('[data-room-list]').focus=()=>{focused=true;};
    guide.next.run();assert.ok(focused);
    assert.equal((screen.innerHTML.match(/data-ma-mesa/g)||[]).length,1);
    assert.doesNotMatch(screen.innerHTML,/data-room-explore/);
  }
});

test('comprobar exige una estación completa, conserva el intento tras error y una doble pulsación envía una sola jugada',async()=>{
  const {enter,window,events,storage}=harness();
  const room=enter(2,'ana'),game=room.room.games[0];
  room.current=game.id;const values=room.draft(game),calls=[];let finish;
  window.GameAccountBridge.request=(path,input,method)=>{calls.push({path,input,method});return new Promise(ok=>{finish=ok;});};
  await room.check();assert.equal(calls.length,0);
  values.push(...game.pieces.slice(0,game.slots.length).map(p=>p.id));room.save(game);
  const losing=room.check();await room.check();assert.equal(calls.length,1);
  finish({correct:false,awarded:0});await losing;
  assert.match(room.querySelector('[data-room-feedback]').textContent,new RegExp(game.feedback.slice(0,10)));
  assert.ok(storage.has(room.draftKey(game)));assert.equal(events.length,0);
  const winning=room.check();finish({correct:true,awarded:game.prize});await winning;
  assert.equal(calls[1].method,'POST');assert.equal(calls[1].path,'/api/valdemar/salas/2');
  assert.deepEqual([...calls[1].input.attempt],[...values].sort());
  assert.ok(room.won.has(game.id));assert.equal(storage.has(room.draftKey(game)),false);
  assert.equal(room.querySelector('[data-room-check]').textContent,'Jugar de nuevo');
  assert.equal(events.length,1);assert.equal(events[0].detail.awarded,game.prize);
  room.allowed=false;await room.check();assert.equal(calls.length,2);
});
