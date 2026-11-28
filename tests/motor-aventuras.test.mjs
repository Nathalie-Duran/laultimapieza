import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../web/motor-aventuras.js';

const motor = globalThis.MotorAventuras;
function mesa(action) {
  return {id:'mesa',titulo:'Mesa de ensayo',inicio:'puesto',escenas:[
    {id:'puesto',titulo:'El puesto',texto:'Observa el material marcado.',acciones:[{...action,fin:true}]}
  ]};
}
const play = (def, estado, papel, accion, intento = null) =>
  motor.ejecutar(def,estado,{escena:estado.posiciones[papel],papel,accion,intento});

test('cada mecánica del catálogo produce una acción de autor válida, material y un resultado ejecutable',()=>{
  assert.ok(motor.catalogo.length>100);
  assert.equal(new Set(motor.catalogo.map(x=>x.id)).size,motor.catalogo.length);
  assert.equal(new Set(motor.catalogo.map(x=>x.nombre)).size,motor.catalogo.length);
  assert.ok(new Set(motor.catalogo.map(x=>x.familia)).size>=8);
  for(const entry of motor.catalogo){
    const action=motor.plantillaPrueba(entry.id),def=mesa(action);
    assert.deepEqual(motor.validar(def),[],entry.id);
    const state=motor.iniciar(def),before=JSON.stringify(state),view=motor.vista(def,state);
    assert.ok(view.acciones[0].materiales.every(m=>m.titulo&&m.texto),entry.id);
    assert.deepEqual(view.acciones[0].controles,entry.entradas,entry.id);
    for(const bad of [null,{},'≠ fuera de la mesa']){
      const result=play(def,state,'A',entry.id,bad);
      assert.equal(result.ok,false,entry.id);
      assert.equal(result.estado,state,entry.id);
    }
    const result=play(def,state,'A',entry.id,entry.ejemplo.intento);
    assert.equal(result.ok,true,entry.id);
    assert.equal(result.estado.completada,true,entry.id);
    assert.equal(result.estado.turnos,1,entry.id);
    assert.equal(JSON.stringify(state),before,entry.id);
    assert.deepEqual(motor.vista(def,result.estado).acciones,[],entry.id);
  }
});

test('los datos del autor cambian la solución, y las simulaciones aceptan caminos alternativos legales',()=>{
  const probes=[
    ['seguir-rumbos',{inicio:[0,0],ruta:'EEESS'},[3,2],[2,3]],
    ['laberinto',{mapa:['.#.','...'],inicio:[0,0],fin:[2,0]},4,2],
    ['cesar',{inscripcion:'JQNC',giro:2},'HOLA','JQNC'],
    ['engranajes',{vueltas:4,pares:[[30,10],[12,24]]},6,8],
    ['sifon',{secciones:[2,1],alturas:[3,9]},5,6],
    ['silencios',{silabas:['LU','NA','MAR'],pausas:[1,5],umbral:3},['LUNA','MAR'],['LU','NAMAR']],
    ['circuito',{interruptores:{x:1,y:1},puertas:[{id:'z',tipo:'XOR',a:'x',b:'y'}],salida:'z'},0,1],
    ['llavero',{guarda:5,pernos:[1,4],llaves:{R:[1,4],T:[4,1]}},'T','R'],
    ['tabla-periodica',{elementos:[{z:1,simbolo:'H'},{z:6,simbolo:'C'}],numeros:[6,1]},['C','H'],['H','C']],
    ['coartada',{lugar:'muelle',instante:15,personas:[{id:'luna',registros:[['muelle',12,16]]},{id:'sol',registros:[['calle',11,19]]}]},'luna','sol'],
    ['fecha',null,null,null],
    ['calendario',{fecha:'2025-02-27',dias:2},'2025-03-01','2025-02-29'],
    ['espejos',{mapa:['...','./.','...'],fuente:[0,1],rumbo:'E'},[1,0],[2,1]],
    ['sokoban',{mapa:['....','....'],persona:[0,0],caja:[1,0],meta:[3,0]},['S','E','O','N','E','E'],['S','E','N','O']],
    ['rescate',{tiempos:{A:1,B:2,C:5},limite:8},['A+C','A','A+B'],['A+C','C','B+C']]
  ];
  for(const [id,p,right,wrong] of probes){
    if(id==='fecha'){assert.equal(motor.comprobar(id,p,right),false);continue;}
    assert.equal(motor.comprobar(id,p,right),true,id);
    assert.equal(motor.comprobar(id,p,wrong),false,id);
  }
});

test('ambos modos conservan diálogo, inventarios independientes, transferencia y consecuencias entre escenas al reanudar',()=>{
  for(const modo of ['solo','duo']){
    const def=motor.plantilla();
    let state=motor.iniciar(def,modo);
    function move(role,id,input){
      const result=play(def,state,role,id,input);
      assert.equal(result.ok,true,id);state=JSON.parse(JSON.stringify(result.estado));
    }
    move('A','oir');move('A','tomar-filtro');
    assert.deepEqual(motor.vista(def,state,'A').inventario.map(o=>o.id),['filtro']);
    assert.deepEqual(motor.vista(def,state,'B').inventario,[]);
    assert.equal(play(def,state,'B','enviar').ok,false);
    move('A','enviar');move('B','tomar-farol');move('B','montar');
    assert.deepEqual(motor.vista(def,state,'A').inventario,[]);
    assert.deepEqual(motor.vista(def,state,'B').inventario.map(o=>o.id),['visor']);
    assert.equal(motor.vista(def,state,'B').acciones.some(a=>a.id==='leer'),false);
    move('B','alumbrar');assert.match(motor.vista(def,state,'B').escena.texto,/luz violeta/);
    const caesar=def.escenas.find(s=>s.id==='puerto').acciones.find(a=>a.id==='leer');
    const word=[...caesar.parametros.inscripcion].map(c=>String.fromCharCode(((c.charCodeAt(0)-65-caesar.parametros.giro+26)%26)+65)).join('');
    move('B','leer',word);
    assert.ok(motor.vista(def,state,'A').acciones.some(a=>a.id==='pasar'));
    move('A','pasar');move('B','pasar');move('B','levantar');
    assert.equal(state.completada,false);
    assert.equal(play(def,state,'B','levantar').ok,false);
    move('A','levantar');assert.equal(state.completada,true);assert.equal(state.cuaderno.length,2);
    assert.equal(play(def,state,'A','levantar').ok,false);
  }
});

test('las vistas excluyen parámetros y metadatos editoriales, y todo audio requiere transcripción',()=>{
  const a=motor.plantillaPrueba('pulso-perdido'),def=mesa(a),scene=def.escenas[0];
  const hidden='contenido-privado-del-editor';
  def.secreto=hidden;scene.acciones[0].parametros.secreto=hidden;
  scene.acciones[0].materiales[0].secreto=hidden;scene.acciones[0].opciones=[{id:'x',label:'X',clave:hidden}];
  scene.audio='/mansion-storm.wav';
  assert.ok(motor.validar(def).length);
  scene.transcripcion='Viento continuo y dos golpes de madera.';
  const material=scene.acciones[0].materiales[0];
  material.audio='/mansion-storm.wav';assert.ok(motor.validar(def).length);
  material.transcripcion=scene.transcripcion;assert.deepEqual(motor.validar(def),[]);
  let view=motor.vista(def,motor.iniciar(def));assert.equal(view.escena.transcripcion,scene.transcripcion);
  assert.equal(view.acciones[0].materiales[0].transcripcion,scene.transcripcion);
  assert.ok(!JSON.stringify(view).includes(hidden));
  scene.variantes=[{requiere:[],audio:'/mansion-morse.wav'}];assert.ok(motor.validar(def).length);
  scene.variantes[0].transcripcion='Pulsos de la segunda cinta.';view=motor.vista(def,motor.iniciar(def));
  assert.equal(view.escena.transcripcion,'Pulsos de la segunda cinta.');
  scene.audio='https://ejemplo.invalid/voz';assert.ok(motor.validar(def).length);
});

test('no se pueden reutilizar señales de sincronización después de salir de la habitación',()=>{
  const def={id:'dos-puestos',titulo:'Dos puestos',inicio:'sala',escenas:[
    {id:'sala',titulo:'Sala',texto:'Hay dos botones.',acciones:[
      {id:'listo',titulo:'Estoy listo',tipo:'sincronizar',fin:true},{id:'salir',titulo:'Salir',tipo:'ir',destino:'patio'}]},
    {id:'patio',titulo:'Patio',texto:'Se ve la sala.',acciones:[{id:'volver',titulo:'Volver',tipo:'ir',destino:'sala'}]}
  ]};
  let state=motor.iniciar(def,'duo');
  for(const [r,id] of [['A','listo'],['A','salir'],['B','listo'],['A','volver']]){const update=play(def,state,r,id);assert.ok(update.ok);state=update.estado;assert.equal(state.completada,false);}
  assert.equal(play(def,state,'A','listo').estado.completada,true);
});

test('el script se carga antes de Gestión y los juegos de temporada mantienen sus propios motores',async()=>{
  const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const files=[...html.matchAll(/<script[^>]* src="\/([^"?]+)[^"]*"/g)].map(m=>m[1]);
  assert.equal(files.filter(s=>s==='motor-aventuras.js').length,1);
  assert.ok(files.indexOf('motor-aventuras.js')<files.indexOf('management.js'));
  for(const existing of ['mansion-game.js','valdemar-player.js','mundos-jugador.js'])assert.ok(files.includes(existing));
});
