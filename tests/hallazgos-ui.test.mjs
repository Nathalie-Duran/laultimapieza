import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const componentSource=await readFile(new URL('../web/explorador-lup.js',import.meta.url),'utf8');
const collectionRoute='/#perfil?seccion=coleccion&ver=hallazgos';

function mount({collection=false,hash='',model={}}={}){
  const calls=[];
  class Element {
    constructor(tag){
      this.tag=tag;this.children=[];this.attributes=new Map();this.events=new Map();
      this.isConnected=true;this.textContent='';
    }
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    setAttribute(key,value){this.attributes.set(key,value);}
    removeAttribute(key){this.attributes.delete(key);}
    hasAttribute(key){return this.attributes.has(key);}
    getAttribute(key){return this.attributes.get(key)??null;}
    addEventListener(event,listener){this.events.set(event,listener);}
    dispatchEvent(){}
    querySelectorAll(){return [];}
    querySelector(){return null;}
    focus(){document.activeElement=this;}
    scrollIntoView(){this.scrolled=true;}
    nodes(){return [this,...this.children.flatMap(child=>child.nodes())];}
    find(tag){return this.nodes().find(node=>node.tag===tag);}
    text(){return this.nodes().map(node=>node.textContent).join(' ');}
  }
  const document={createElement:tag=>new Element(tag),head:new Element('head'),querySelector:()=>null,activeElement:null};
  const registry=new Map();
  const window={GameAccountBridge:{request:async(...args)=>{calls.push(args);return model;}}};
  runInNewContext(componentSource,{HTMLElement:Element,document,window,location:{hash},URLSearchParams,
    requestAnimationFrame:callback=>callback(),customElements:{get:name=>registry.get(name),define:(name,cls)=>registry.set(name,cls)}});
  const Component=registry.get('lup-explorador'),component=new Component();
  if(collection)component.setAttribute('collection','');
  else component.setAttribute('case-id','15');
  component.connectedCallback();
  async function open(){
    const details=component.find('details');details.open=true;details.events.get('toggle')();
    await new Promise(resolve=>setImmediate(resolve));
  }
  return {component,open,calls,document};
}

test('la actividad se explica antes de abrirla y permite volver al hallazgo ya guardado',async()=>{
  const model={discovery:{name:'Cuarzo',caseTitle:'Caso de muestra',category:'Mineral',location:'Taller',description:'Cuarzo ahumado',points:10}};
  const {component,open,calls}=mount({model});
  const summary=component.find('summary').text();
  assert.match(summary,/Hallazgo de la aventura/);
  assert.match(summary,/Actividad opcional\. Identifica una muestra del escenario para añadirla a tu colección\./);
  assert.equal(calls.length,0);
  await open();
  assert.equal(calls[0][0],'/api/valdemar/explorer/15');
  assert.match(component.find('article').text(),/Cuarzo ahumado/);
  const link=component.find('a');
  assert.equal(link.textContent,'Ver mis hallazgos');
  assert.equal(link.href,collectionRoute);
});

test('el enlace a Mis hallazgos deja abierta y enfocada la colección del perfil',async()=>{
  const {component,document,open,calls}=mount({collection:true,hash:collectionRoute.slice(1),model:{total:0,points:0,entries:[]}});
  const summary=component.find('summary');
  assert.match(summary.text(),/Mis hallazgos/);
  assert.match(summary.text(),/Las muestras que has identificado en tus aventuras\./);
  assert.equal(component.find('details').open,true);
  assert.equal(document.activeElement,summary);
  await open();
  assert.equal(calls[0][0],'/api/valdemar/explorer');
  assert.match(component.text(),/Hallazgo de la aventura/);
});
