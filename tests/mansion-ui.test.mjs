import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

function simulatedEpisode(number,role){
  const locations=['vestibulo','salon','patio','estudio','galeria','invernadero','tunel','laboratorio'];
  const rooms=locations.map((id,index)=>({id,title:'Taller simulado '+index,unlocked:index<number}));
  const active=rooms[number===6?4:Math.min(number-1,7)];
  const recording={title:'Lectura de ensayo',audio:'/test-recording.wav',text:'Un mensaje ficticio.'};
  let picked=false,hint=false,revision=0;
  function state(roomId=active.id){
    let controls=[{id:'texto',label:'Dato de ensayo',type:'code',maxLength:5}];
    if(number===5)controls=[{id:'ruedaTest',label:'Fichas de prueba',type:'code',symbols:['Ne','Li','Mg']}];
    if(number===6)controls=[
      {id:'ajuste',label:'Traslado de ensayo',type:'select',options:[{label:'Mover a la derecha',value:'derecha'},{label:'Conservar posición',value:'centro'}]},
      {id:'casilla',label:'Casilla elegida',type:'code'}
    ];
    if(number===13)controls=[];
    if(number===15)controls=[{id:'panel',label:'Panel de ensayo',type:'select',options:[{value:'A',label:'Primero'},{value:'B',label:'Segundo'}]},...controls];
    const marks=[
      {role:'A',title:'Primera lámina de ensayo',text:'Disco de muestra.',kind:'photo-grid',marks:[{cell:'B2',label:'Disco'}]},
      {role:'B',title:'Segunda lámina de ensayo',text:'Anillo de muestra.',kind:'photo-grid',marks:[{cell:'A2',label:'Anillo'}]}
    ].filter(item=>role==='solo'||item.role===role);
    const stage={number,chapter:'Taller',room:active.id,title:'Mecanismo de ensayo '+number,brief:'Inspecciona el prototipo.',
      hintOptions:[{op:'open',cost:1,text:hint?'Orientación compartida de ensayo.':null}],evidence:number===6?marks:[],
      controls,actions:number===3?[{id:'muestra',role:'B',label:'Tomar arandela de ensayo',enabled:!picked,done:picked}]:[],
      ...(number===12?{recording}:{})};
    return {title:'Escenario de pruebas',current:number,total:15,stage,revision,rooms,role,
      explore:{id:roomId,evidence:roomId===active.id?stage.evidence:[]},inventory:picked?[{title:'Arandela de ensayo',world:'B'}]:[],
      missions:['una','dos','tres','cuatro'].map(id=>({id,title:'Misión de ensayo '+id,brief:'',available:false})),
      balance:hint?5:6,recordings:number>=12?{radio:recording}:{},ending:null};
  }
  function act(input){
    if(input.op==='act'){assert.equal(input.action,'muestra');picked=true;revision++;}
    if(input.op==='hint'){hint=true;revision++;}
    return {correct:true,mansion:state(input.roomId)};
  }
  return {state,act};
}

async function view(number=1,role='solo'){
  const document={};
  class Node{
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.attrs={};this.style={setProperty(){}};}
    set textContent(value){this.text=value;this.children=[];}
    get textContent(){return (this.text||'')+this.children.map(child=>child.textContent).join('');}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;this.text='';}
    setAttribute(name,x){this.attrs[name]=String(x);}
    removeAttribute(name){delete this.attrs[name];}
    addEventListener(name,fn){this.events[name]=fn;}
    focus(){document.activeElement=this;}
    remove(){}
    get childElementCount(){return this.children.length;}
    nodes(){return [this,...this.children.flatMap(child=>child.nodes())];}
    querySelector(token){
      const part=token.split(' ').at(-1);
      return this.nodes().find(item=>part.startsWith('.')?item.className?.split(' ').includes(part.slice(1)):item.tag===part);
    }
  }
  document.createElement=tag=>new Node(tag);
  const window={};
  for(const file of ['mansion-puzzles.js','mansion-game.js'])
    runInNewContext(await readFile(new URL('../web/'+file,import.meta.url),'utf8'),{window,document});
  const episode=simulatedEpisode(number,role);
  const calls=[],host=new Node('div');
  const handle=window.MansionGame.mount(host,{state:episode.state(),role,act:async input=>{
    calls.push(input);
    return episode.act(input);
  }});
  function find(tag,text){const item=host.nodes().find(node=>node.tag===tag&&node.textContent===text);assert.ok(item,'Control '+text);return item;}
  const click=async text=>{await find('button',text).events.click();await Promise.resolve();};
  return {host,calls,handle,click,find,document};
}

test('El escenario abre con su foto, ocho salas y navegación de teclado entre los cuatro paneles',async()=>{
  const {host,click,document,find}=await view();
  assert.equal(host.nodes().find(x=>x.tag==='img').src,'/mansion-room-1.webp');
  assert.equal(host.nodes().filter(x=>x.className==='mansion-room').length,8);
  assert.equal(host.nodes().filter(x=>x.className==='mansion-room'&&!x.disabled).length,1);
  assert.equal(host.nodes().some(x=>x.src==='/mansion-finale.webp'),false);
  await click('Casa abandonada');
  assert.equal(host.nodes().find(x=>x.tag==='img').src,'/mansion-ruin-1.webp');
  find('button','Escenario').events.keydown({key:'ArrowRight',preventDefault(){}});
  assert.equal(document.activeElement.textContent,'Inventario');
  assert.equal(host.nodes().filter(x=>x.className==='mansion-card').length,4);
  find('button','Inventario').events.keydown({key:'End',preventDefault(){}});
  assert.equal(document.activeElement.textContent,'Pistas');
});

test('Las pistas solo se compran al confirmar el precio; después se pueden releer',async()=>{
  const {host,calls,click}=await view();
  await click('Pistas');await click('Abrir por 1 llave');assert.equal(calls.length,0);
  await click('Cancelar');assert.equal(calls.length,0);
  await click('Abrir por 1 llave');await click('Confirmar · 1 llave');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{op:'hint',stage:1,tier:'open',quotedCost:1}]);
  assert.match(host.textContent,/Orientación compartida de ensayo/);
});

test('Cada una de las quince pruebas monta su mecanismo; las fotos y los sonidos respetan la etapa',async()=>{
  const kinds=[];
  for(let n=1;n<=15;n++){
    const {host,click}=await view(n);
    await click('Abrir el mecanismo');
    const puzzle=host.querySelector('.mansion-puzzle');assert.ok(puzzle);kinds.push(puzzle.dataset.kind);
    assert.ok(puzzle.nodes().some(node=>node.tag==='form'));
    const audio=host.nodes().filter(node=>node.tag==='audio');
    assert.ok(audio.every(item=>item.preload==='none'&&!item.autoplay));
    assert.equal(audio.some(item=>item.src==='/test-recording.wav'),n===12);
    assert.ok(!host.nodes().some(item=>item.src==='/mansion-finale.webp'));
    if(n===4)assert.equal(puzzle.nodes().filter(node=>node.type==='range').length,2);
    if(n===6)assert.ok(puzzle.nodes().some(node=>node.type==='range'));
    if(n===11){const radio=puzzle.nodes().find(node=>node.type==='range');assert.ok(radio);assert.equal(radio.value,'600');}
  }
  assert.equal(new Set(kinds).size,15);
});

test('Un jugador en pareja conserva su realidad y las acciones del inventario sobreviven al cambio de pestaña',async()=>{
  const {host,click,calls}=await view(3,'B');
  assert.equal(host.nodes().some(x=>x.className==='mansion-world-choice'),false);
  assert.ok(host.nodes().some(x=>x.src==='/mansion-ruin-3.webp'));
  await click('Abrir el mecanismo');
  const item=host.nodes().find(x=>x.tag==='button'&&x.textContent.includes('Tomar arandela de ensayo'));
  await item.events.click();
  assert.equal(calls[0].op,'act');
  await click('Inventario');assert.match(host.textContent,/Arandela de ensayo/);
  await click('Escenario');assert.ok(host.nodes().some(x=>x.tag==='button'&&x.disabled&&x.textContent.includes('Tomar arandela de ensayo')));
});

test('La mesa de placas desplaza las marcas de B y conserva los indicios privados de cada jugador',async()=>{
  const solo=await view(6);
  await solo.click('Casa abandonada');await solo.click('Abrir el mecanismo');
  const grid=()=>solo.host.querySelector('.mansion-photo-grid').nodes().filter(node=>node.tag==='td').map(node=>node.textContent);
  assert.match(grid()[5],/A · Disco/);
  assert.match(grid()[4],/B · Anillo/);
  await solo.click('Mover a la derecha');
  assert.match(grid()[5],/A · Disco.*B · Anillo/);
  const duo=await view(6,'B');await duo.click('Abrir el mecanismo');
  assert.doesNotMatch(duo.host.querySelector('.mansion-photo-grid').textContent,/A ·/);
});
