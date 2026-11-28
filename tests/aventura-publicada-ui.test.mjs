import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const code=await readFile(new URL('../web/aventura-publicada.js',import.meta.url),'utf8');
function fixture(){
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.isConnected=true;this.style={};}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    setAttribute(key,value){this.attributes[key]=value;}
    hasAttribute(key){return key in this.attributes;}
    addEventListener(name,fn){this.events[name]=fn;}
    focus(){this.focused=true;}
    nodes(){return [this,...this.children.flatMap(c=>c.nodes())];}
    get childElementCount(){return this.children.length;}
  }
  const components={},calls=[],shots=[],location={hash:'#aventura?juego=ejemplo&caso=1'};
  const state={titulo:'El puente',modo:'solo',papel:'A',pareja:null,revision:1,paso:0,caseId:1,vista:{
    escena:{id:'puente',titulo:'El puente',texto:'Lee el plano.'},acciones:[],inventario:[],cuaderno:[]}};
  let answer;
  const window={GameAccountBridge:{isSignedIn:()=>true,playerId:()=>1,request:async(path,body)=>{
    calls.push({path,body});
    if(path==='/api/aventuras')return {aventuras:[]};
    if(body)return {...state,ok:JSON.stringify(body.intento)===JSON.stringify(answer),mensaje:'Respuesta comprobada.'};
    return state;
  }},Colecciones:{seasons:[{board:'mapa',name:'Código Valdemar'}],catalogBoard:()=>({board:'mapa'})},
  MesaDeJuego:{mount:(host,panel)=>{shots.push(panel);return {destroy(){}};}}};
  const document={createElement:tag=>new Element(tag)};
  runInNewContext(code,{window,document,location,customElements:{define:(id,data)=>components[id]=data},HTMLElement:Element,URLSearchParams,clearInterval(){},setInterval(){}});
  return {game:new components['aventura-publicada'](),list:new components['aventuras-publicadas'](),calls,shots,state,expect(v){answer=v;}};
}
test('la elección de modalidad es explícita y el catálogo omite ediciones ausentes',async()=>{
  const {game,list,calls,shots}=fixture();game.connectedCallback();
  assert.equal(calls.length,0);assert.ok(game.nodes().some(n=>n.textContent==='Jugar en pareja'));
  await list.connectedCallback();assert.equal(list.children.length,0);
  await game.open('solo');assert.equal(calls.at(-1).path,'/api/aventuras/ejemplo?modo=solo');
  assert.equal(shots[0].saved,'La primera acción guardará tu partida.');
  assert.deepEqual(Array.from(shots[0].tools,t=>t.label),['Escenario','Inventario','Evidencias','Pistas']);
});
test('cada control transmite la respuesta y el papel que el servidor ha mostrado',async()=>{
  for(const [tipo,data,want] of [['numero',[3.5],3.5],['punto',[1,4],[1,4]],['rumbo',['N'],'N'],['lista',['luz; calle'],['luz','calle']],['texto',['llave'],'llave']]){
    const {game,state,calls,expect}=fixture();
    state.papel='B';
    state.vista.acciones=[{id:'abrir',titulo:'Examinar la puerta',tipo:'prueba',controles:[{tipo,label:'¿Qué ves?'}],materiales:[{titulo:'Indicio',texto:'Marca visible'}]}];
    expect(want);game.connectedCallback();await game.open('solo','B');
    const form=game.nodes().find(n=>n.tag==='form'),inputs=form.nodes().filter(n=>n.tag==='input'||n.tag==='select');
    inputs.forEach((input,i)=>{input.value=data[i];input.valueAsNumber=Number(data[i]);});
    form.events.submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
    const {body}=calls.at(-1);
    assert.deepEqual(JSON.parse(JSON.stringify(body.intento)),want);
    assert.equal(body.escena,'puente');assert.equal(body.papel,'B');assert.equal(body.paso,0);assert.equal(body.revision,1);
  }
});
