import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/mesa-de-juego.js',import.meta.url),'utf8');
function fixture(){
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.handlers={};this.textContent='';this.style={setProperty(){},removeProperty(){}};this.classList={toggle(){}};}
    append(...nodes){for(const node of nodes)this.insertBefore(node,null);}
    insertBefore(node,before){node.remove();this.children.splice(before?this.children.indexOf(before):this.children.length,0,node);node.parent=this;}
    replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.append(...nodes);}
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}}
    setAttribute(key,value){this.attrs[key]=value;}
    addEventListener(name,handler){this.handlers[name]=handler;}
    nodes(){return [this,...this.children.flatMap(node=>node.nodes())];}
    click(options={}){let prevented=false;this.handlers.click?.({preventDefault(){prevented=true;},...options});return prevented;}
  }
  const window={},document={createElement:tag=>new Element(tag)},host=new Element('div');
  runInNewContext(source,{window,document});
  const find=cls=>host.nodes().find(node=>node.className===cls);
  return {window,host,find};
}
test('el contexto común conserva sus controles al cambiar la etapa y utiliza solo acciones disponibles',()=>{
  const {window,host,find}=fixture(),calls=[];
  const view=window.MesaDeJuego.mount(host,{family:'umbravia',title:'Casa de prueba',progress:'Etapa 1',objective:'Orienta el croquis',
    tools:[{id:'bag',label:'Inventario',run:()=>calls.push(1)},{id:'sin-accion',label:'Ajeno'}]});
  assert.equal(find('mesa-juego').attrs['aria-label'],'Mesa de juego · Casa de prueba');
  assert.ok(!host.nodes().some(n=>n.textContent==='Casa de prueba'));
  assert.equal(find('mj-goal').textContent,'Orienta el croquis');
  const tool=find('mj-tool');
  assert.equal(tool.textContent,'Inventario');tool.click();
  assert.equal(find('mj-next').hidden,true);
  view.update({progress:'Etapa 2',tools:[{id:'bag',label:'Mochila',run:()=>calls.push(2)}],result:'Objeto encontrado.',
    next:{label:'Ir a la puerta',run:()=>calls.push(3)}});
  assert.equal(find('mj-tool'),tool);
  tool.click();find('mj-next').click();assert.deepEqual(calls,[1,2,3]);
  assert.equal(find('mj-result').attrs.role,'status');
  view.update({tools:[],next:null,objective:null,result:null});
  assert.equal(find('mj-tool'),undefined);assert.equal(find('mj-objective').hidden,true);
  view.destroy();assert.equal(host.children.length,0);
});
test('la guía usa la acción local, conserva el enlace de respaldo y respeta los controles de privacidad',()=>{
  const {window,host,find}=fixture(),opened=[];
  const view=window.MesaDeJuego.mount(host,{family:'demo',help:{context:'demo',steps:['Lee la transcripción.']}});
  const link=find('mj-help');
  assert.equal(link.href,'/#como-se-juega');assert.equal(link.target,'_blank');
  assert.equal(link.click(),false);
  window.ComoSeJuega={open:(trigger,model)=>opened.push([trigger,model])};
  assert.equal(link.click(),true);assert.equal(opened[0][0],link);
  assert.equal(opened[0][1].context,'demo');assert.equal(opened[0][1].steps[0],'Lee la transcripción.');
  assert.equal(link.click({ctrlKey:true}),false);assert.equal(opened.length,1);
  view.update({help:false,progress:'',objective:'',result:'',next:null,tools:[]});
  assert.equal(find('mesa-juego').hidden,true);
  const next=window.MesaDeJuego.mount(host,{family:'archivo',help:{context:'archivo'}});
  assert.equal(host.children.length,1);assert.notEqual(find('mj-help'),link);
  view.destroy();assert.equal(host.children.length,1);next.destroy();
});
