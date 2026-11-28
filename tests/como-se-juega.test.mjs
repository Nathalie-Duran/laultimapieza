import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/como-se-juega.js',import.meta.url),'utf8');
function guideHarness(){
  const registry=new Map();
  class Element{
    constructor(tag='custom'){
      this.tag=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this.ownerDocument=doc;
    }
    append(child){this.children.push(child);child.parent=this;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
    get isConnected(){return this===doc.body||Boolean(this.parent?.isConnected&&this.parent.children.includes(this));}
    get firstElementChild(){return this.children[0];}
    setAttribute(name,value){this.attributes[name]=value;}
    getAttribute(name){return this.attributes[name];}
    contains(child){return child===this||this.children.some(node=>node.contains(child));}
    closest(selector){return selector==='[data-inspect]'&&this.dataset.inspect!==undefined?this:this.parent?.closest(selector);}
    querySelector(selector){return children(this).find(node=>selector==='button'?node.tag==='button':node.attributes['data-insight']!==undefined);}
    querySelectorAll(){return this.children.filter(node=>node.getAttribute('aria-pressed')==='true');}
    focus(){doc.activeElement=this;}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
    emit(name,event={}){for(const fn of this.events[name]||[])fn(event);}
    showModal(){this.open=true;doc.modals.push(this);}
    close(){this.open=false;doc.modals=doc.modals.filter(node=>node!==this);this.emit('close');}
  }
  function children(node){return node.children.flatMap(child=>[child,...children(child)]);}
  const doc={modals:[],createElement:tag=>new Element(tag),querySelector:()=>doc.modals.find(node=>node.className==='how-quick'&&node.open),body:null};
  doc.body=new Element('body');
  const win={customElements:{define:(name,ctor)=>registry.set(name,ctor),get:name=>registry.get(name)}};
  runInNewContext(source,{window:win,document:doc,HTMLElement:Element});
  return {doc,win,children,registry};
}

test('la práctica combina dos objetos reales, anuncia el resultado y permite cambiar la selección',async()=>{
  const {win,registry,doc}=guideHarness(),html=win.ComoSeJuega.view();
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.equal((html.match(/<button type="button" data-inspect="\d" aria-pressed="false">/g)||[]).length,2);
  assert.match(html,/role="status" aria-live="polite"/);
  for(const [,img] of html.matchAll(/<img src="\/([^"]+)"/g))await access(new URL('../web/'+img,import.meta.url));
  assert.match(html,/misma cuenta|propia cuenta/);
  assert.match(html,/cuatro juegos/);
  const control=new (registry.get('guide-comparison'))();
  const buttons=[0,1].map(index=>{const node=doc.createElement('button');node.dataset.inspect=String(index);node.setAttribute('aria-pressed','false');control.append(node);return node;});
  const status=doc.createElement('p');status.setAttribute('data-insight','');control.append(status);control.connectedCallback();
  const select=index=>control.emit('click',{target:buttons[index]});
  select(1);assert.match(status.textContent,/precinto/);
  select(0);assert.match(status.textContent,/ambos indicios/);assert.ok(buttons.every(b=>b.getAttribute('aria-pressed')==='true'));
  select(1);assert.match(status.textContent,/transcripción/);
  select(0);assert.match(status.textContent,/Elige un objeto/);
});

test('la ayuda respeta un diálogo de juego abierto, usa foco modal y devuelve el foco al control de origen',()=>{
  const {doc,win,children}=guideHarness(),game=doc.createElement('dialog');
  doc.body.append(game);game.showModal();const trigger=doc.createElement('button');game.append(trigger);
  for(const how of ['button','escape']){
    trigger.focus();win.ComoSeJuega.open(trigger,{context:'demo',text:'Compara las carpetas.',steps:['Paso propio.']});
    assert.equal(doc.modals.length,2);
    const dialog=doc.modals[1],items=children(dialog),back=items.find(n=>n.tag==='button'),more=items.find(n=>n.tag==='a');
    assert.equal(doc.activeElement,back);assert.equal(back.type,'button');
    assert.equal(more.target,'_blank');assert.equal(more.rel,'noopener');assert.equal(more.href,'/#como-se-juega');
    assert.ok(items.some(n=>n.textContent?.includes('misma pantalla')));assert.ok(items.some(n=>n.textContent==='Paso propio.'));
    win.ComoSeJuega.open(trigger);assert.equal(doc.modals.length,2);
    if(how==='button')back.emit('click');
    else{let stopped=false;dialog.emit('cancel',{stopPropagation(){stopped=true;}});assert.ok(stopped);dialog.close();}
    assert.deepEqual(doc.modals,[game]);assert.equal(doc.activeElement,trigger);
  }
});
