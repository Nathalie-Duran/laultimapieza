import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source = file => readFile(new URL('../web/' + file, import.meta.url), 'utf8');

async function load(file) {
  const document = {};
  function createElement(tag) {
    return {
      tag, dataset:{}, attributes:{}, listeners:{}, children:[], isConnected:true,style:{setProperty(){}},
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      nodes() { return [this, ...this.children.flatMap(child => child.nodes())]; },
      contains(child) { return this.nodes().includes(child); },
      focus() { document.activeElement = this; },
      scrollIntoView() { this.scrolled = true; },
      querySelector(selector) {
        if (selector === '[data-visit-room]') return this.nodes().find(item => item.dataset.visitRoom);
        if (selector === '.vd-taller h4') return this.nodes().find(item => item.className === 'vd-taller')?.children.find(item => item.tag === 'h4');
        return this.nodes().find(item => item.tag === selector);
      },
      querySelectorAll() { return this.nodes().filter(item => item.dataset.focusKey); }
    };
  }
  Object.assign(document, {createElement, body:createElement('body')});
  document.activeElement = document.body;
  const window = {ValdemarHour:{filterByRole() {}}, clearInterval() {}, setInterval() {}};
  runInNewContext(await source(file), {window, document, MutationObserver:class {observe(){} disconnect(){}}});
  return {window, document};
}

test('Ambos jugadores montan un único selector y guardan la modalidad antes de entrar', async () => {
  const {window, document} = await load('modalidad-juego.js');
  const frame = document.createElement('div');
  const saved = [];
  const control = window.ModalidadJuego.create(frame, {roles:['Archivo','Campo']}, null, async mode => {
    saved.push(mode);
    return {mode};
  }, null, {caseId:1, data:{}});
  const groups = control.entry.nodes().filter(item => item.attributes.role === 'group');
  assert.equal(groups.length, 1);
  const [solo, duo] = groups[0].children;
  assert.deepEqual([solo.textContent, duo.textContent], ['En solitario','En pareja']);
  assert.equal(frame.dataset.playMode, 'pending');
  await solo.listeners.click();
  assert.deepEqual(saved, ['solo']);
  assert.equal(frame.dataset.playMode, 'solo');
  assert.equal(solo.attributes['aria-pressed'], 'true');
  assert.equal(duo.attributes['aria-pressed'], 'false');
  for (const name of ['valdemar-player.js','mundos-jugador.js']) {
    const player = await source(name);
    assert.equal(player.match(/AventuraEscena\.mount\(/g)?.length, 1, name);
    assert.doesNotMatch(player, /modeControl\.change/, name);
    assert.match(player, /c\.hour(?:View)?\.open\(kind,id\)/, name);
  }
});

test('La escena cambia con la etapa, respeta el papel y conecta cada punto con su material',async()=>{
  for(const world of ['valdemar','expedicion','umbravia','necropolis']){
    const {window,document}=await load('aventura-escena.js'),node=()=>document.createElement('section');
    const host=node(),frame=node(),entry=node(),calls=[];
    frame.dataset.playMode='duo';frame.dataset.playPaper='B';
    const data={progress:{},partner:{role:'B',name:'Lola'},hour:{current:1,stages:[{place:'Uno'},{place:'Dos'}],
      journal:[{index:0}],stage:{place:'Dos',task:'Comparar las muestras',title:'Segundo lugar',materials:[
        {id:121,role:'A',label:'Texto reservado'},{id:'tinta',role:2,label:'Ficha del otro taller',kind:'text'},
        {id:'nota',role:'AB',label:'Recorte común',kind:'ledger'}]}}};
    const ui=window.AventuraEscena.mount(host,{world,id:14,frame,story:{title:'Caso de ensayo'},image:'/prueba.webp',
      place:'Taller',toolbar:node(),modeControl:{entry},read:()=>data,playerName:()=> 'Carmen',actions:(kind,id)=>calls.push([kind,id])});
    const nodes=()=>host.nodes(),marker=()=>nodes().filter(n=>n.className==='ae-marker');
    assert.equal(nodes().filter(n=>n===entry).length,1);
    assert.equal(nodes().find(n=>n.className==='ae-team').textContent,'Papel 1 · Lola / Papel 2 · Carmen');
    assert.equal(marker().length,4);
    assert.ok(!nodes().some(n=>n.textContent?.includes('Texto reservado')));
    marker()[1].listeners.click();assert.deepEqual(calls.pop(),['material','tinta']);
    marker()[2].listeners.click();assert.deepEqual(calls.pop(),['material','nota']);
    marker()[3].listeners.click();assert.deepEqual(calls.pop(),['decision',null]);
    if(world==='expedicion'||world==='valdemar'){
      nodes().find(n=>n.className==='ae-stop').listeners.click();assert.deepEqual(calls.pop(),['journal',0]);
    }
    if(world==='necropolis'){
      nodes().find(n=>n.textContent==='Girar a la derecha').listeners.click();
      nodes().find(n=>n.textContent==='Examinar el indicio seleccionado').listeners.click();
      assert.deepEqual(calls.pop(),['material','nota']);
    }
    if(world==='umbravia'){
      nodes().find(n=>n.textContent==='Encender el farol').listeners.click();assert.equal(nodes().find(n=>n.className==='ae-stage').dataset.lit,'true');
    }
    data.progress.choice='ensayo';ui.update({...data.hour,stage:null,current:2});
    assert.equal(marker().length,1);marker()[0].listeners.click();assert.deepEqual(calls.pop(),['ending',null]);ui.destroy();
  }
});

test('La entrada abre el lugar actual y da foco al instrumento al explorar o reanudar', async () => {
  const {window, document} = await load('expedition-inventory.js');
  const room = {index:1, place:'La estación', items:[], links:[], visited:false};
  const first = {rooms:[{index:0, place:'El andén', items:[], links:[], visited:true},room], revision:0};
  const visited = {rooms:[first.rooms[0], {...room, visited:true, instrument:{title:'Mesa de señales'}}], revision:1};
  let writes = 0;
  window.FieldInstruments = {render(body, instrument) {
    const section = document.createElement('section');
    section.className = 'vd-taller';
    const heading = document.createElement('h4');
    heading.textContent = instrument.title;
    section.append(heading);
    body.append(section);
  }};
  const inventory = window.ExpeditionInventory.create(async request => {
    assert.equal(request.operation, 'visit');
    assert.equal(request.index, 1);
    writes++;
    return {inventory:visited};
  }, () => {});
  inventory.update(first, 1);
  assert.equal(inventory.startExploring(), true);
  assert.equal(inventory.node.open, true);
  assert.equal(document.activeElement.textContent, 'Explorar La estación');
  assert.equal(document.activeElement.scrolled, true);
  assert.equal(writes, 0);
  const visit = document.activeElement.listeners.click();
  document.activeElement = document.body;
  await visit;
  assert.equal(writes, 1);
  assert.equal(document.activeElement.textContent, 'Mesa de señales');
  assert.equal(document.activeElement.tabIndex, -1);
  assert.equal(inventory.startExploring(), true);
  assert.equal(document.activeElement.textContent, 'Mesa de señales');
  visited.rooms[1].instrumentSolved = true;
  inventory.update(visited, 1);
  assert.equal(inventory.startExploring(), false);
});
