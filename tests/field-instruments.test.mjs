import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {checkFieldInstrument,getFieldInstrument} from '../field-instruments.mjs';

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

const browserCode=await readFile(new URL('../web/field-instruments.js',import.meta.url),'utf8');
function element(tag) {
  return {tag,children:[],events:{},value:'',checked:false,focus(){},
    append(...items){this.children.push(...items);if(tag==='select'&&this.children.length===items.length)this.value=items[0].value;},
    setAttribute(name,value){this[name]=value;},addEventListener(type,handler){this.events[type]=handler;}};
}
function all(root,tag){
  return [ ...(root.tag===tag?[root]:[]), ...root.children.flatMap(item=>all(item,tag)) ];
}
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
