import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const file = name => new URL('../web/'+name,import.meta.url);
const source = await readFile(file('cinta87-demo.js'),'utf8');
const key = 'lup.cinta87.demo.v1';

function browser({storage=new Map(),blocked=false,options={},transcripts=false,withTools=false}={}) {
  const listeners=new Map(),windowListeners=new Map(),events=[],destinations=[];
  let deskTools=[];
  const localStorage={
    getItem(k){if(blocked)throw Error('storage blocked');return storage.get(k)??null;},
    setItem(k,value){if(blocked)throw Error('storage blocked');storage.set(k,value);},
    removeItem(k){if(blocked)throw Error('storage blocked');storage.delete(k);}
  };
  const host={
    innerHTML:'',focusTarget:null,
    contains:()=>true,
    querySelectorAll:()=>[],
    querySelector(selector){return {focus:()=>{this.focusTarget=selector;}};},
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:name=>listeners.delete(name),
    replaceChildren(){this.innerHTML='';}
  };
  const window={localStorage,GamePreferences:{transcripts},location:{assign:path=>destinations.push(path)},
    addEventListener:(name,fn)=>windowListeners.set(name,fn),
    removeEventListener:name=>windowListeners.delete(name)};
  if(withTools)window.MesaDeJuego={mount(_host,model){
    deskTools=model.tools;
    return {destroy(){deskTools=[];}};
  }};
  runInNewContext(source,{window});
  const demo=window.Cinta87Demo;
  const mounting={onEvent:e=>events.push(e),...options};
  let handle=demo.mount(host,mounting);
  return {host,demo,events,destinations,storage,
    get html(){return host.innerHTML;},get saved(){return JSON.parse(storage.get(key)||'null');},
    get tools(){return deskTools;},openTool(id){deskTools.find(tool=>tool.id===id).run();},
    click(action,value){
      const button=(host.innerHTML.match(/<button\b[^>]*>/g)||[]).find(tag=>tag.includes('data-c87="'+action+'"')&&(!value||tag.includes('data-value="'+value+'"')));
      assert.ok(button,'Visible action missing: '+action+' '+(value||''));
      listeners.get('click')({target:{closest:()=>({dataset:{c87:action,value}})}});
    },
    submit(name,values){
      assert.ok(host.innerHTML.includes('data-c87-form="'+name+'"'));
      listeners.get('submit')({target:{matches:()=>true,dataset:{c87Form:name},elements:{namedItem:key=>({value:values[key]||''})}},preventDefault(){}});
    },
    heard(){assert.match(host.innerHTML,/<audio controls[^>]+data-c87-pilot/);listeners.get('ended')({target:{hasAttribute:name=>name==='data-c87-pilot'}});},
    remount(){handle.destroy();assert.equal(listeners.size,0);assert.equal(windowListeners.size,0);handle=demo.mount(host,mounting);},
    otherTabChanged(){windowListeners.get('storage')({key});}
  };
}

test('la preferencia de transcripción muestra la señal y deja anotarla sin reproducir audio',()=>{
  const h=browser({transcripts:true});
  h.click('start','solo');h.click('place','magnetofono');
  assert.match(h.html,/Dos pulsos cortos, seguidos de un pulso largo/);
  assert.equal(h.saved.seen.includes('signal'),false);
  h.click('transcript');
  assert.ok(h.saved.seen.includes('signal'));
  assert.ok(h.saved.items.includes('piloto'));
});

function gather(h,mode,listen=false){
  h.click('start',mode);
  if(mode==='duo')h.click('uncover');
  h.click('place','magnetofono');
  if(listen)h.heard();else h.click('transcript');
  h.click('next');
  assert.match(h.html,/muesca del acetato/);
  h.click('take','acetato');
  assert.match(h.html,/data-c87="next"[^>]*>[^<]*Archivo/);
  h.click('next');
  if(mode==='duo')h.click('uncover');
  h.click('place','libro');
  assert.match(h.html,/precinto triangular/);
  h.click('next');
  h.click('take','hoja');
  assert.match(h.html,/Combinar los objetos en el inventario/);
  h.click('next');
}

const overlap={first:'hoja',second:'acetato',side:'izquierda'};
const original={box:'c2',mark:'triangulo'};

test('la mesa muestra cuatro herramientas, permite releer hallazgos y conserva la deducción de un guardado anterior',()=>{
  const h=browser({withTools:true});
  h.click('start','solo');
  assert.deepEqual(Array.from(h.tools,tool=>tool.label),['Escenario','Inventario','Evidencias','Pistas']);
  assert.doesNotMatch(h.html,/c87-tabs|Pedir una pista/);
  h.openTool('evidence');
  assert.match(h.html,/Todavía no hay anotaciones/);
  assert.doesNotMatch(h.html,/Dos pulsos|precinto triangular|franja negra|<table/);
  h.openTool('scene');h.click('place','magnetofono');h.click('transcript');h.openTool('evidence');
  assert.match(h.html,/Dos pulsos cortos y uno largo/);
  assert.doesNotMatch(h.html,/precinto triangular|franja negra|<table/);
  h.click('view','deduction');
  assert.equal(h.saved.view,'deduction');
  h.remount();
  assert.equal(h.tools.find(tool=>tool.selected).id,'evidence');
  assert.match(h.html,/¿Dónde está la cinta 87\?/);
  assert.doesNotMatch(h.html,/data-c87-form="deduce"/);
  h.openTool('hints');assert.match(h.html,/Abrir la primera pista/);
  assert.equal(h.saved.hints,0);
  h.click('hint');h.openTool('bag');h.openTool('hints');
  assert.equal(h.saved.hints,1);
  assert.match(h.html,/Reparte las dos comprobaciones/);
});

test('la carpeta de evidencias respeta el relevo de la pareja y comparte la tabla solo tras su revelado',()=>{
  const h=browser();
  gather(h,'duo');
  h.click('view','evidence');
  assert.match(h.html,/Parte de cierre/);
  assert.doesNotMatch(h.html,/Dos pulsos cortos|Instrucción del sobre|<table/);
  h.click('view','bag');h.submit('combine',overlap);
  h.click('view','evidence');assert.match(h.html,/Releer la hoja de traslados revelada/);
  h.click('role');assert.doesNotMatch(h.html,/Evidencias|Parte de cierre|<table/);
  h.click('uncover');h.click('view','evidence');
  assert.match(h.html,/Señal del piloto/);assert.match(h.html,/Instrucción del sobre/);
  assert.doesNotMatch(h.html,/Parte de cierre|Margen de la hoja/);
  h.click('view','deduction');assert.match(h.html,/data-c87-form="deduce"/);
});

test('las pistas abren el siguiente puesto, los errores dan feedback junto a la prueba y la identificación requiere dos indicios',()=>{
  const h=browser();
  assert.equal(h.demo.hasProgress(),false);
  assert.match(h.html,/La cinta 87/);
  gather(h,'solo');
  assert.deepEqual(h.saved.seen,['signal','register']);
  assert.deepEqual(h.saved.items,['piloto','acetato','hoja']);
  h.click('view','evidence');h.click('view','deduction');
  assert.doesNotMatch(h.html,/data-c87-form="deduce"/);
  assert.match(h.html,/Revelar la hoja/);
  h.click('next');
  h.submit('combine',{first:'piloto',second:'hoja',side:'izquierda'});
  assert.match(h.html,/necesita una lámina/);
  assert.equal(h.host.focusTarget,'[data-c87-status]');
  assert.match(h.html,/data-c87-status>La mesa necesita una lámina/);
  h.submit('combine',{...overlap,side:'derecha'});
  assert.match(h.html,/Siguen viéndose dos tiradas/);
  assert.equal(h.saved.combined,false);
  h.submit('combine',overlap);
  assert.equal(h.saved.combined,true);
  h.click('next');
  assert.match(h.html,/<th scope="row">A4<\/th>/);
  h.submit('deduce',{box:'a4',mark:'triangulo'});
  assert.equal(h.saved.solved,false);
  assert.match(h.html,/Coteja la señal/);
  h.submit('deduce',original);
  assert.equal(h.saved.solved,true);
  assert.match(h.html,/jefa de andén/);
  h.remount();
  assert.match(h.html,/Emitir el fragmento/);
  h.click('ending','emitir');
  assert.match(h.html,/La estación vuelve al aire/);
  assert.match(h.html,/Ficha de oyente · Cinta 87/);
  assert.match(h.html,/No añade llaves/);
  assert.equal(h.demo.isComplete(),true);
  h.click('alternate');
  assert.match(h.html,/Una copia para quienes estuvieron allí/);
  assert.equal(h.saved.ending,'emitir');
  h.remount();
  assert.match(h.html,/La estación vuelve al aire/);
  assert.deepEqual(h.events,['start','receipt','solved','complete']);
});

test('en pareja cada relevo y cada reanudación protege las carpetas y el audio permite resolver sin transcripción',()=>{
  const h=browser({options:{exitLabel:'Volver a la ficha'}});
  assert.match(h.html,/Volver a la ficha/);
  h.click('start','duo');
  assert.match(h.html,/Entrega el dispositivo a Restauración/);
  assert.match(h.html,/Volver a la ficha/);
  assert.doesNotMatch(h.html,/Magnetófono|franja negra|precinto triangular|Dos pulsos/);
  h.click('uncover');h.click('place','magnetofono');h.heard();
  assert.deepEqual(h.saved.seen,['signal']);
  h.click('next');h.click('take','acetato');h.click('next');
  assert.match(h.html,/Entrega el dispositivo a Archivo/);
  assert.doesNotMatch(h.html,/Carrete piloto|franja negra|precinto triangular|Dos pulsos/);
  h.click('uncover');h.click('place','libro');
  h.remount();
  assert.match(h.html,/Entrega el dispositivo a Archivo/);
  assert.doesNotMatch(h.html,/precinto triangular/);
  h.click('uncover');h.click('next');h.click('take','hoja');h.click('next');
  h.submit('combine',overlap);h.click('next');h.submit('deduce',original);h.click('ending','custodiar');
  assert.match(h.html,/Una copia para quienes estuvieron allí/);
  h.remount();
  assert.match(h.html,/Desenlace guardado/);
  assert.match(h.html,/Volver a la ficha/);
  assert.equal(h.saved.ending,'custodiar');
});

test('cada pista requiere una petición y el reinicio confirmado preserva los expedientes anteriores',()=>{
  const legacy='lup.vallejo.bookmark.v1',value='{"investigacion":"tomas"}';
  const h=browser({storage:new Map([[legacy,value]])});
  h.click('start','solo');h.click('view','hints');
  assert.doesNotMatch(h.html,/original está en C2/);
  h.click('hint');
  assert.match(h.html,/dos comprobaciones/);
  assert.doesNotMatch(h.html,/original está en C2/);
  h.click('hint');
  assert.match(h.html,/muesca del acetato/);
  h.click('hint');
  assert.match(h.html,/original está en C2/);
  assert.equal(h.host.focusTarget,'[data-c87-last-hint]');
  assert.equal(h.saved.hints,3);
  assert.doesNotMatch(h.html,/data-c87="hint"/);
  h.click('view','evidence');h.click('view','deduction');
  assert.doesNotMatch(h.html,/original está en C2|data-c87-form="deduce"/);
  h.click('reset');h.click('cancel-reset');
  assert.equal(h.demo.hasProgress(),true);
  h.click('reset');h.click('confirm-reset');
  assert.equal(h.demo.hasProgress(),false);
  assert.equal(h.storage.get(legacy),value);
  assert.doesNotMatch(h.html,/archivo=1|Marta y Tomás|data-c87="archive"/);
  assert.deepEqual(h.events,['start','hint','hint','hint']);
});

test('un navegador con guardado bloqueado puede jugar y reanudar dentro de la página',()=>{
  const h=browser({blocked:true});
  h.click('start','solo');h.click('place','magnetofono');h.click('transcript');
  assert.match(h.html,/Dos pulsos cortos, seguidos de un pulso largo/);
  assert.match(h.html,/Guardado temporal/);
  h.remount();
  assert.equal(h.demo.hasProgress(),true);
  assert.match(h.html,/Señal del piloto examinada/);
  h.click('exit');assert.equal(h.destinations[0],'/#casos');
});

test('un cambio en otra pestaña vuelve a proteger los datos de la pareja',()=>{
  const storage=new Map(),one=browser({storage}),two=browser({storage});
  one.click('start','duo');one.click('uncover');one.click('role');one.click('uncover');one.click('place','libro');
  two.otherTabChanged();
  assert.match(two.html,/Entrega el dispositivo a Archivo/);
  assert.doesNotMatch(two.html,/Original de andén/);
  two.click('uncover');
  assert.match(two.html,/Original de andén/);
  one.click('reset');one.click('confirm-reset');two.otherTabChanged();
  assert.equal(two.demo.hasProgress(),false);
  assert.match(two.html,/Jugar en solitario/);
});

test('el audio y la ilustración de la demo están disponibles en la distribución local',async()=>{
  const [sound,art]=await Promise.all([readFile(file('cinta87-piloto.wav')),readFile(file('cinta87-mesa.webp'))]);
  assert.equal(sound.toString('ascii',0,4),'RIFF');
  assert.equal(sound.toString('ascii',8,12),'WAVE');
  assert.equal(art.toString('ascii',8,12),'WEBP');
  assert.ok(sound.length>10000&&art.length>10000);
});

test('cada papel abre únicamente sus dos objetos ilustrados y conserva ambos materiales al reunirlos',async()=>{
  const h=browser();
  h.click('start','duo');h.click('uncover');
  assert.match(h.html,/c87-magnetofono\.webp/);assert.match(h.html,/c87-acetato\.webp/);
  assert.doesNotMatch(h.html,/c87-registro\.webp|c87-fichero\.webp/);
  h.click('place','acetato');h.click('take','acetato');h.click('role');
  assert.doesNotMatch(h.html,/c87-(?:magnetofono|acetato|fichero|registro)\.webp/);
  h.click('uncover');assert.match(h.html,/c87-registro\.webp/);assert.match(h.html,/c87-fichero\.webp/);
  h.click('place','hoja');h.click('take','hoja');h.click('view','bag');
  assert.match(h.html,/data-slot="first"/);assert.match(h.html,/data-slot="second"/);
  h.submit('combine',overlap);assert.ok(h.saved.combined);
  for(const object of ['magnetofono','acetato','registro','fichero']){
    const photo=await readFile(file('c87-'+object+'.webp'));
    assert.equal(photo.toString('ascii',8,12),'WEBP',object);
  }
});

test('la mesa gráfica coloca dos objetos y alinea la muesca antes de validar la misma deducción',async()=>{
  const h=browser();gather(h,'solo');
  h.click('place-item','first');
  assert.match(h.html,/Selecciona un objeto de la bandeja/);
  h.click('arm','hoja');h.click('place-item','first');
  h.click('arm','acetato');h.click('place-item','second');
  h.click('align','derecha');
  assert.match(h.html,/class="c87-layer-first" src="\/c87-fichero.webp"/);
  assert.match(h.html,/class="c87-layer-second" src="\/c87-acetato.webp"/);
  assert.match(h.html,/data-aligned="derecha"/);
  assert.match(h.html,/<option value="derecha" selected>/);
  h.submit('combine',{...overlap,side:'derecha'});
  assert.equal(h.saved.combined,false);
  h.click('align','izquierda');
  assert.match(h.html,/<option value="izquierda" selected>/);
  h.submit('combine',overlap);h.click('next');
  assert.equal((h.html.match(/class="c87-box-photo"/g)||[]).length,3);
  assert.match(h.html,/Consultar la hoja de traslados en texto/);
  assert.equal((await readFile(file('c87-caja-bobina.webp'))).toString('ascii',8,12),'WEBP');
  h.submit('deduce',original);h.click('ending','emitir');assert.ok(h.demo.isComplete());
});
