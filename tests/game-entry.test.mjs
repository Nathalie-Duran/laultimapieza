import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source = file => readFile(new URL('../web/' + file, import.meta.url), 'utf8');

async function load(file) {
  const document = new EventTarget();
  function createElement(tag) {
    return {
      tag, dataset:{}, attributes:{}, listeners:{}, children:[], isConnected:true,style:{setProperty(){},removeProperty(){}},
      classList:{toggle(){}},
      insertBefore(item,before){item.remove();this.children.splice(before?this.children.indexOf(before):this.children.length,0,item);item.parentElement=this;},
      append(...items) { for(const item of items)this.insertBefore(item,null); },
      prepend(...items) {for(const item of [...items].reverse())this.insertBefore(item,this.children[0]);},
      get nextSibling(){const siblings=this.parentElement?.children||[];return siblings[siblings.indexOf(this)+1];},
      remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}},
      replaceChildren(...items) {for(const item of [...this.children])item.remove();this.append(...items);},
      matches(selector){return selector.split(',').some(part=>(this.className||'').split(' ').includes(part.slice(1)));},
      closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector);},
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      nodes() { return [this, ...this.children.flatMap(child => child.nodes())]; },
      contains(child) { return this.nodes().includes(child); },
      focus() { document.activeElement = this; },
      scrollIntoView() { this.scrolled = true; },
      querySelector(selector) {
        if (selector === '[data-visit-room]') return this.nodes().find(item => item.dataset.visitRoom);
        if (selector === '.vd-taller h4') return this.nodes().find(item => item.className === 'vd-taller')?.children.find(item => item.tag === 'h4');
        if (selector.startsWith('.')) return this.nodes().find(item => item.matches(selector));
        return this.nodes().find(item => item.tag === selector);
      },
      querySelectorAll() { return this.nodes().filter(item => item.dataset.focusKey); }
    };
  }
  Object.assign(document, {createElement, body:createElement('body'),createTextNode(text){
    const node=createElement('#text');node.textContent=text;return node;
  }});
  document.activeElement = document.body;
  const window = {ValdemarHour:{filterByRole() {}}, clearInterval() {}, setInterval() {}};
  if(file==='aventura-escena.js')runInNewContext(await source('mesa-de-juego.js'),{window,document});
  runInNewContext(await source(file), {window, document, AbortController, queueMicrotask, MutationObserver:class {observe(){} disconnect(){}}});
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
    assert.equal(player.match(/AventuraEscena\.caseNavigation\(/g)?.length, 1, name);
    assert.doesNotMatch(player, /modeControl\.change/, name);
    assert.match(player, /c\.hour(?:View)?\.open\(kind,id\)/, name);
  }
});

test('Elegir pareja sin compañero conduce directamente al formulario de pareja del perfil',async()=>{
  const {window,document}=await load('modalidad-juego.js');
  const picker=window.ModalidadJuego.create(document.createElement('section'),{roles:[]},null,async()=>({}),null,{
    caseId:4,data:{},partners:async()=>({availableCases:[4],preferredEmail:null,invitations:[]})
  });
  await picker.entry.nodes().find(node=>node.textContent==='En pareja').listeners.click();
  const link=picker.entry.nodes().find(node=>node.tag==='a');
  assert.equal(link.href,'/#perfil?seccion=pareja');
});

test('Hotel Medianoche muestra una sola vista y abre el desenlace al completar las cinco etapas',async()=>{
  const {window,document}=await load('aventura-escena.js');
  const frame=document.createElement('main');
  const navigation=window.AventuraEscena.hotelNavigation(frame,(key,focus)=>navigation.show(key,focus));
  frame.append(navigation.shell);
  const buttons=navigation.shell.nodes().filter(node=>node.dataset.hotelGo);
  const screens=new Map(buttons.map(button=>[button.dataset.hotelGo,document.createElement('section')]));
  for(const [key,screen] of screens)navigation.bind(key,screen);
  const stages=Array.from({length:5},(_,i)=>({title:'Etapa '+(i+1)}));
  navigation.progress({stage:stages[0],current:0,stages});
  assert.equal(navigation.show('desenlace'),false);
  for(const button of buttons.filter(button=>!button.hidden)){
    button.listeners.click();
    assert.equal(document.activeElement,screens.get(button.dataset.hotelGo));
    assert.deepEqual([...screens].filter(([,screen])=>!screen.hidden).map(([key])=>key),[button.dataset.hotelGo]);
    assert.deepEqual(buttons.filter(item=>item.attributes['aria-pressed']==='true'),[button]);
  }
  navigation.progress({stage:null,current:5,stages});
  assert.equal(navigation.show('resolver'),false);
  assert.equal(navigation.show('desenlace'),true);
  assert.equal(screens.get('desenlace').hidden,false);
});

test('En cada temporada las secciones se sustituyen al abrir un documento, volver y terminar',async()=>{
  for(const [world,id] of [['valdemar',9],['expedicion',13],['umbravia',25],['necropolis',37]]){
    const {window,document}=await load('aventura-escena.js');
    const frame=document.createElement('main');
    frame.dataset.playMode='duo';
    frame.dataset.playPaper='B';
    const stages=[{title:'Llegada'},{title:'Última sala'}];
    const hour={current:1,stages,journal:[{index:0}],stage:{...stages[1],place:'Taller',materials:[
      {id:'plano',label:'Plano de archivo',role:'A'},
      {id:'foto',label:'Fotografía de campo',role:'B'},
      {id:'carta',label:'Carta de ambos',role:'AB'}
    ]}};
    const opened=[];
    const nav=window.AventuraEscena.caseNavigation(frame,(key,focus)=>nav.show(key,focus),{
      world,id,story:{title:'Aventura'},image:'/portada.webp',read:()=>({hour}),
      actions(kind,value){opened.push([kind,value]);nav.show({material:'evidencias',decision:'resolver',ending:'desenlace',journal:'inventario'}[kind]||'escenario',true);}
    });
    frame.append(nav.shell);
    const buttons=nav.shell.nodes().filter(node=>node.dataset.caseGo);
    for(const key of ['evidencias','resolver','inventario','pistas','extra','desenlace'])nav.bind(key,document.createElement('section'));
    const panels=frame.nodes().filter(node=>node.dataset.casePane);
    const active=key=>{
      assert.equal(frame.dataset.caseView,key);
      const visible=panels.filter(p=>!p.hidden);
      assert.deepEqual(visible.map(p=>p.dataset.casePane),[key],world);
      assert.deepEqual(buttons.filter(b=>b.attributes['aria-pressed']==='true').map(b=>b.attributes['aria-controls']),[visible[0].id]);
      assert.equal(document.activeElement,visible[0]);
    };
    nav.progress(hour);
    assert.equal(nav.show('desenlace'),false);
    for(const button of buttons.filter(b=>!b.hidden)){
      button.listeners.click();active(button.dataset.caseGo);
    }
    nav.show('escenario',true);
    const scene=panels.find(p=>p.dataset.casePane==='escenario');
    assert.equal(scene.querySelector('img').src,'/portada.webp');
    assert.equal(scene.nodes().filter(n=>n.tag==='nav').length,0);
    assert.ok(!scene.nodes().some(n=>n.textContent?.includes('Plano de archivo')));
    const item=scene.nodes().find(n=>n.dataset.action==='material');
    item.listeners.click();active('evidencias');
    assert.deepEqual(opened.pop(),['material','foto']);
    nav.show('escenario',true);
    scene.nodes().find(n=>n.dataset.action==='decision').listeners.click();active('resolver');
    nav.progress({...hour,current:2,stage:null});
    assert.equal(nav.show('resolver'),false);
    assert.equal(nav.show('desenlace',true),true);active('desenlace');
    nav.show('escenario',true);
    scene.nodes().find(n=>n.dataset.action==='ending').listeners.click();active('desenlace');
    nav.destroy();
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
    assert.equal(nodes().filter(n=>n.className==='mesa-juego').length,1);
    const common=nodes().find(n=>n.className==='mesa-juego');
    assert.match(nodes().find(n=>n.className==='mj-progress').textContent,/Etapa 2 de 2/);
    nodes().find(n=>n.dataset.tool==='bag').listeners.click();assert.deepEqual(calls.pop(),['bag',undefined]);
    const side=node();side.className='md-game-side';data.side={brief:'Ajusta la rueda de muestra'};data.parallelPrize=2;
    const cover=window.AventuraEscena.challengeHeader({id:14,world,title:'El mecanismo',caseTitle:'Caso de ensayo',photo:'/prueba.webp'});
    side.append(cover,node());
    ui.returnFrom(side);
    assert.equal(cover.querySelector('h1').textContent,'El mecanismo');
    assert.equal(cover.querySelector('img').src,'/prueba.webp');
    assert.equal(cover.querySelector('a').href,'/#desafios?mundo='+(world==='valdemar'?'mapa':world));
    assert.equal(cover.querySelector('.reto-cabecera-nav').children.at(-1).className,'ae-back');
    assert.equal(side.children[1].className,'ae-mesa');
    assert.equal(side.nodes().find(n=>n.className==='mesa-juego'),common);
    assert.match(side.nodes().find(n=>n.className==='mj-progress').textContent,/2 llaves/);
    assert.equal(side.nodes().find(n=>n.className==='mj-goal').textContent,'Ajusta la rueda de muestra');
    assert.equal(side.nodes().find(n=>n.className==='mj-help').textContent,'Cómo se juega');
    ui.returnFrom(node());
    assert.equal(nodes().find(n=>n.className==='mesa-juego'),common);
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
