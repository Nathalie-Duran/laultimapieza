import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {checkFieldInstrument,getFieldInstrument} from '../field-instruments.mjs';
import {valdemarRequest} from '../valdemar-api.mjs';

const solutions = [[1,'0734'],[13,'010'],[25,'aro'],[37,'junco-luna-pez']];
test('Los cuatro instrumentos verifican su propia respuesta en el servidor', () => {
  for (const [id,answer] of solutions) {
    const definition=getFieldInstrument(id);
    assert.ok(definition.title && definition.brief && definition.note);
    assert.ok(!('answer' in definition));
    definition.title='Modificada';
    assert.notEqual(getFieldInstrument(id).title,definition.title);
    assert.equal(checkFieldInstrument(id,answer),true);
    for(const invalid of [null,1,{answer},'',answer+'x']) assert.equal(checkFieldInstrument(id,invalid),false);
  }
  for(const id of [2,14,26,38,0,49,'1']){
    assert.equal(getFieldInstrument(id),null);
    assert.equal(checkFieldInstrument(id,'0734'),false);
  }
});

test('El estado pedido en el cuadro de señales tiene una única configuración', () => {
  const solutions=[];
  for (const a of [true,false]) for (const b of [true,false]) for (const c of [true,false]){
    if ((a!==b) && (b&&!c) && !(a||c)) solutions.push([a,b,c].map(Number).join(''));
  }
  assert.equal(solutions.length,1);
  assert.equal(checkFieldInstrument(13,solutions[0]),true);
});

test('la placa compartida conserva los ajustes anteriores incluso si dos posiciones encienden las mismas luces',()=>{
  const instrument=getFieldInstrument(13);
  assert.equal(instrument.placa.salidas.length,3);
  for(let setting=0;setting<8;setting++){
    const expected=setting.toString(2).padStart(3,'0'),edition={instrument,answer:expected};
    for(let other=0;other<8;other++){
      assert.equal(checkFieldInstrument(13,other.toString(2).padStart(3,'0'),edition),other===setting);
    }
  }
});

const browserCode=await readFile(new URL('../web/field-instruments.js',import.meta.url),'utf8');
function element(tag) {
  return {tag,children:[],events:{},value:'',checked:false,focus(){},
    append(...items){this.children.push(...items);if(tag==='select'&&this.children.length===items.length)this.value=items[0].value;},
    setAttribute(name,value){this[name]=value;},addEventListener(type,handler){this.events[type]=handler;}};
}
function all(root,tag){
  return [ ...(root.tag===tag?[root]:[]), ...root.children.flatMap(item=>all(item,tag)) ];
}
test('Las ruedas, las luces y las láminas representan el ajuste enviado al juego',()=>{
  const browser={window:{MotorAventuras:globalThis.MotorAventuras},document:{createElement:element,createTextNode:text=>({...element('text'),textContent:text})}};
  runInNewContext(browserCode,browser);
  function setup(id){
    const root=element('div');
    const definition=getFieldInstrument(id);
    browser.window.FieldInstruments.render(root,definition,false,async()=>false);
    return {root,definition};
  }
  const lock=setup(1).root;
  const code=all(lock,'input')[0],wheels=all(lock,'button');
  code.value='0279';code.events.input();
  wheels.find(x=>x['aria-label']==='Subir cifra 4').events.click();
  assert.equal(code.value,'0270');
  wheels.find(x=>x['aria-label']==='Bajar cifra 2').events.click();
  assert.equal(code.value,'0170');
  assert.equal(all(lock,'strong').map(x=>x.textContent).join(''),code.value);
  const circuit=setup(13).root;
  const controls=all(circuit,'input'),lamps=all(circuit,'span').filter(x=>x.className==='instrument-bulb');
  controls[1].checked=true;controls[1].events.change();
  assert.deepEqual(lamps.map(x=>x['data-lit']),['true','true','false']);
  for(const [id,key] of [[25,'zones'],[37,'samples']]){
    const {root,definition}=setup(id);
    const label=definition[key][2].label;
    const marker=all(root,'button').find(x=>x['aria-label']===label);
    marker.events.click();
    assert.equal(marker['aria-pressed'],'true');
    const mode=id===25?'direct':'detail';
    assert.equal(all(root,'p').find(x=>x.className==='instrument-reading').textContent,definition[key][2][mode]);
  }
});
test('Cada mesa permite ajustar los controles nativos, corregir un intento y guardar el acierto',async()=>{
  const browser={window:{},document:{createElement:element,createTextNode:text=>({...element('text'),textContent:text})}};
  runInNewContext(browserCode,browser);
  for(const [id,answer] of solutions){
    const root=element('div'),attempts=[];
    browser.window.FieldInstruments.render(root,getFieldInstrument(id),false,async value=>{
      attempts.push(value);return {correct:checkFieldInstrument(id,value)};
    });
    const form=all(root,'form')[0],inputs=all(root,'input'),selects=all(root,'select');
    await form.events.submit({preventDefault(){}});
    assert.equal(all(root,'fieldset')[0].disabled,false);
    if(id===1 || id===25)inputs[0].value=answer;
    if(id===13){inputs[1].checked=true;inputs[1].events.change();}
    if(id===25){selects[0].value='raking';selects[0].events.change();assert.ok(all(root,'p').some(p=>p.textContent?.includes('tallada')));}
    if(id===37)answer.split('-').forEach((piece,i)=>{selects[i+1].value=piece;});
    await form.events.submit({preventDefault(){}});
    assert.equal(attempts.at(-1),answer);
    assert.equal(all(root,'fieldset')[0].disabled,true);
  }
});

test('La edición del caso decide el instrumento y la respuesta solo se comprueba en el servidor', async () => {
  const story = {
    id:13, title:'Caso de ensayo', roles:['Archivo','Campo'], hints:[], choices:[], hypotheses:[],
    hour:{stages:[{title:'Sala de lectura', materials:[], options:[], mode:'single'}]},
    side:{materials:[], options:[], answer:[]},
    fieldTool:{answer:'8615', instrument:{
      kind:'lock', title:'El registro de ensayo', brief:'Busca el par de registros.', note:'Une sus dos referencias.',
      tables:[{caption:'Registro', headers:['Entrada','Referencia'], rows:[['Este','86'],['Oeste','15']]}]
    }}
  };
  let saved = {};
  const store = {
    getMemberData:async () => structuredClone(saved),
    saveMemberData:async (_, data) => { saved = structuredClone(data); }
  };
  const ask = (operation, answer) => valdemarRequest({
    path:'/api/valdemar/cases/13' + (operation ? '/inventory' : ''), method:operation ? 'POST' : 'GET',
    input:{index:0, operation, answer}, uid:'lectora', editorial:true, withStore:fn => fn(store),
    loadRelease:async () => ({nuevos:[story], stories:[], samples:[]})
  });
  function publicPayload(data) {
    const serialized = JSON.stringify(data);
    assert.ok(!serialized.includes(story.fieldTool.answer));
    assert.doesNotMatch(serialized, /"fieldTool"\s*:|"answer"\s*:/);
    return data;
  }
  const first = publicPayload(await ask());
  assert.equal(first.hour.inventory.rooms[0].visited, false);
  const visit = publicPayload(await ask('visit'));
  assert.deepEqual(visit.inventory.rooms[0].instrument, story.fieldTool.instrument);
  await assert.rejects(ask('instrument','010'), {status:422});
  assert.equal(publicPayload(await ask()).hour.inventory.rooms[0].instrumentSolved, false);
  publicPayload(await ask('instrument','8615'));
  const room = publicPayload(await ask()).hour.inventory.rooms[0];
  assert.equal(room.instrumentSolved, true);
  assert.equal(room.instrument.title, 'El registro de ensayo');

  delete story.fieldTool;
  const older = (await ask()).hour.inventory.rooms[0];
  assert.deepEqual(older.instrument, getFieldInstrument(13));
  assert.equal(older.visited, true);
  assert.equal(older.instrumentSolved, true);
  assert.equal(checkFieldInstrument(13,'010'), true);
});

test('Los cuatro formatos muestran sus etiquetas editoriales y mantienen las de la edición antigua', () => {
  const browser = {window:{}, document:{createElement:element, createTextNode:text => ({...element('text'), textContent:text})}};
  runInNewContext(browserCode,browser);
  const paint = definition => {
    const root = element('div');
    browser.window.FieldInstruments.render(root,definition,false,async () => false);
    const controls = [...all(root,'input'), ...all(root,'select')];
    const labels = all(root,'label');
    const names = controls.map(input => {
      const label = labels.find(node => node.children.includes(input));
      assert.ok(label, 'El control debe quedar asociado a una etiqueta');
      const name = (label.textContent || all(label,'text').map(node => node.textContent).join('')).trim();
      assert.ok(name, 'La etiqueta debe tener texto');
      return name;
    });
    return {root, names};
  };
  const lock = getFieldInstrument(1);
  const editedLock = {...lock, tables:[{...lock.tables[0], headers:['Franja propia','Turno propio']}]};
  assert.deepEqual(all(paint(editedLock).root,'th').map(node => node.textContent), ['Franja propia','Turno propio']);
  assert.deepEqual(all(paint(lock).root,'th').slice(0,2).map(node => node.textContent), ['Hora','Consigna']);

  const circuit = getFieldInstrument(13);
  const customSwitches = ['Ramal este','Ramal sur','Ramal oeste'];
  const customLamps = ['Lámpara este','Lámpara sur','Lámpara oeste'];
  const wired = paint({...circuit, switches:customSwitches, lamps:customLamps});
  assert.deepEqual(wired.names, customSwitches);
  const firstSwitch = all(wired.root,'input')[0];
  firstSwitch.checked = true;
  firstSwitch.events.change();
  assert.ok(all(wired.root,'p').some(node => node.textContent === 'Lámpara este: sí · Lámpara sur: no · Lámpara oeste: sí'));
  assert.ok(all(paint(circuit).root,'p').some(node => node.textContent?.includes('Faro apagado')));

  const lamp = getFieldInstrument(25);
  assert.deepEqual(paint({...lamp, zoneLabel:'Borde del cuño', answerLabel:'Letras del cuño'}).names,
    ['Letras del cuño','Orientación de la linterna','Borde del cuño']);
  assert.deepEqual(paint(lamp).names, ['Palabra tallada','Orientación de la linterna','Zona del marco']);

  const strata = getFieldInstrument(37);
  const positions = ['Primera marca','Marca intermedia','Última marca'];
  assert.deepEqual(paint({...strata, sampleLabel:'Capa del sondeo', positionLabels:positions}).names,
    ['Capa del sondeo', ...positions]);
  assert.deepEqual(paint(strata).names, ['Profundidad de la muestra','Signo más antiguo','Segundo signo','Signo más reciente']);
});
