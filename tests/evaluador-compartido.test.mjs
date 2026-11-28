import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/motor-aventuras.js';

const motor=globalThis.MotorAventuras;
test('el expediente distingue elección, orden y conjunto y conserva los identificadores literales',()=>{
  const evaluate=(tipo,respuesta,input)=>motor.evaluarPrueba({tipo,respuesta},input);
  assert.equal(evaluate('seleccion','02','02'),true);
  assert.equal(evaluate('seleccion','02',2),false);
  assert.equal(evaluate('secuencia',['luz','luz','sombra'],['luz','luz','sombra']),true);
  assert.equal(evaluate('secuencia',['a','b'],['b','a']),false);
  assert.equal(evaluate('conjunto',['a','b'],['b','a']),true);
  assert.equal(evaluate('conjunto',['a','b'],['a','a']),false);
  assert.equal(evaluate('conjunto',['a','b'],['a','b','c']),false);
  assert.equal(evaluate('otro','a','a'),false);
});
test('cada campo procede del jugador y solo se normaliza cuando lo requiere el acertijo',()=>{
  const regla={tipo:'campos',respuesta:{lugar:'El mirador',nota:'Brújula'}};
  const respuesta={lugar:' el  MIRADOR ',nota:'Brujula'};
  assert.equal(motor.evaluarPrueba(regla,respuesta),false);
  assert.equal(motor.evaluarPrueba({...regla,normalizacion:'texto'},respuesta),true);
  for(const wrong of [{...respuesta,zona:'A'}, {lugar:'El mirador'},[],null,{lugar:' ',nota:'Brújula'}]){
    assert.equal(motor.evaluarPrueba({...regla,normalizacion:'texto'},wrong),false);
  }
  assert.equal(motor.intentoValido({tipo:'campos',campos:[]},{}),true);
});
test('la lámpara transmite solo las marcas visibles y el evaluador usa la mecánica de esa edición',()=>{
  const accion=motor.plantillaPrueba('ultravioleta');
  const material=accion.materiales.find(m=>m.grafico?.tipo==='tintas');
  assert.ok(material);
  material.grafico.marcas[0].observacionInterna='ensayo privado';
  const def={id:'gabinete',titulo:'El gabinete',inicio:'mesa',escenas:[
    {id:'mesa',titulo:'Mesa',texto:'Lee la muestra.',acciones:[{...accion,fin:true}]}]};
  assert.deepEqual(motor.validar(def),[]);
  const view=motor.vista(def,motor.iniciar(def),'A').acciones[0];
  assert.equal(JSON.stringify(view).includes('ensayo privado'),false);
  assert.equal(Object.hasOwn(view,'parametros'),false);
  const regla={tipo:'mecanica',mecanica:'ultravioleta',parametros:{filtro:'UV',marcas:[{letra:'L',luz:'día'},{letra:'M',luz:'UV'}]}};
  assert.equal(motor.evaluarPrueba(regla,'L'),false);
  assert.equal(motor.evaluarPrueba(regla,'M'),true);
});
