import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {readHour,evaluateHourStage} from '../valdemar-hour.mjs';

const script=await readFile(new URL('../web/valdemar-hour.js',import.meta.url),'utf8');
const examples=[
  [2,0,'order','centralita','centralita',['Conexión P','Conexión Q','Conexión R','Conexión S']],
  [13,2,'order','boyas','boyas',['P','Q','R','S']],
  [25,0,'single','habitación','puertas',['Cuarto 20','Cuarto 21','Cuarto 22','Cuarto 23']],
  [37,1,'multi','improntas','improntas',['P','Q','R','S']]
];
function scenario([id,index,mode,cue,kind,labels]){
  const options=labels.map((label,i)=>({id:'fixture'+i,label}));
  const visual=kind==='puertas'?'20 | izquierda | patio | arco':kind==='improntas'?
    'Ojo P | orilla norte, roce alto, 4 estrías\nOjo Q | orilla sur, roce bajo, 6 estrías':'Archivo gráfico';
  const stage={title:'Escena de ensayo',brief:'Investiga',place:'Sala',minutes:9,task:'Examina '+cue,mode,options,
    materials:[{id:'sheet',label:'Calco',role:'A',kind:'visual',body:visual},{id:'voice',label:'Voz',role:'B',kind:'testimony',body:'Testimonio privado'}],
    corroboration:{prompt:'Cita una fuente',answer:['voice']},retry:'Revisa los indicios',success:'Etapa guardada',
    answer:(mode==='single'?[1]:mode==='order'?[2,0,1]:[1,0]).map(i=>options[i].id)};
  const story={id,title:'Ensayo',hour:{stages:Array(index+1).fill(stage)}};
  return {stage,story,kind,index};
}
function element(tag) {
  return {tag,children:[],events:{},style:{},dataset:{},textContent:'',
    append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},
    setAttribute(key,val){this[key]=String(val);},addEventListener(key,handler){this.events[key]=handler;},
    focus(){}};
}
function nodes(node){return [node,...node.children.flatMap(nodes)];}
function decision(stage,index,submit) {
  const context={window:{addEventListener(){}},document:{createElement:element,createElementNS:(_,tag)=>element(tag),addEventListener(){}}};
  runInNewContext(script,context);
  const form=context.window.ValdemarHour.decision(stage,index,{submit},()=>{});
  return {form,find:predicate=>nodes(form).find(predicate),click:predicate=>nodes(form).find(predicate).events.click()};
}
for(const sample of examples){
  test('el control '+sample[4]+' conserva el contrato de la etapa y las pruebas de cada papel',async()=>{
    const {story,stage,kind,index}=scenario(sample),record={hourStep:index};
    const visible=readHour(story,record,'A').stage,partner=readHour(story,record,'B').stage;
    assert.equal(visible.interaction,kind);
    assert.ok(!visible.materials.some(m=>m.role==='B')&&!partner.materials.some(m=>m.role==='A'));
    assert.equal(visible.answer,undefined);assert.equal(visible.corroboration.answer,undefined);
    const received=[];
    const ui=decision(visible,index,async(i,choices,sources)=>{
      const input={index:i,choice:[...choices],sources:[...sources]};
      received.push(input);
      const res=evaluateHourStage(story,record,input);
      return {...res,hour:readHour(story,record,'A')};
    });
    assert.equal(ui.form.dataset.vhPrueba,kind);
    const choose=id=>ui.click(n=>n.dataset.vhValue===id);
    if(kind==='centralita'){
      choose('fixture3');ui.click(n=>n.className==='vh-socket');choose('fixture2');
      choose('fixture0');choose('fixture1');
    }else if(kind==='boyas'){
      choose('fixture3');choose('fixture3');stage.answer.forEach(choose);
      assert.equal(ui.find(n=>n.tag==='polyline').points.split(' ').length,3);
    }else if(kind==='puertas'){
      choose('fixture0');assert.ok(ui.find(n=>n.textContent.includes('Bisagras a la izquierda')));
      stage.answer.forEach(choose);
    }else{
      choose('fixture0');choose('fixture1');
      ui.click(n=>n.className==='vh-overlay');
      assert.equal(ui.find(n=>n.className==='vh-rubbing-plate').dataset.overlap,'true');
    }
    const send=ui.find(n=>n.type==='submit');assert.ok(send.disabled);
    const source=ui.find(n=>n.tag==='input'&&n.value==='voice');
    source.checked=true;source.events.change();
    assert.ok(!send.disabled);
    await ui.form.events.submit({preventDefault(){}});
    assert.equal(record.hourStep,index+1);assert.deepEqual(received[0].sources,['voice']);
    assert.equal(readHour(story,record,'A').stage,null);
    const other=decision(partner,index,()=>{});
    other.click(n=>n.dataset.vhValue==='fixture0');
    assert.ok(!other.find(n=>n.className==='vh-grooves'||n.className==='vh-door-hinge'));
  });
}
