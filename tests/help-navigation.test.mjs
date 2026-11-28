import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const web=new URL('../web/',import.meta.url);
test('ayuda y privacidad tienen rutas de vuelta, enlaces internos válidos y contacto accesible sin scripts',async()=>{
  for(const name of ['ayuda.html','privacidad.html']){
    const source=await readFile(new URL(name,web),'utf8');
    assert.match(source,/<html lang="es">/);
    assert.equal((source.match(/<h1>/g)||[]).length,1);
    assert.match(source,/href="mailto:info@laultimapieza.es"/);
    assert.match(source,/href="\/#inicio">Volver al inicio</);
    assert.match(source,/href="\/#accesibilidad\?volver=(?:ayuda|privacidad)"/);
    assert.match(source,/href="\/#planes\?seccion=preguntas"/);
    if(name==='privacidad.html'){
      assert.match(source,/href="\/#perfil\?seccion=pareja">Gestionar mi compañero</);
      assert.match(source,/href="\/#perfil\?seccion=cuenta">Abrir cuenta y suscripción</);
      assert.match(source,/href="\/#planes\?gestion=aviso">Gestionar mi aviso</);
    }
    const ids=[...source.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size);
    for(const [,target] of source.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(target),target);
    for(const [,file] of source.matchAll(/(?:href|src)="\/([^"?#]+\.(?:js|css|html))"/g))await readFile(new URL(file,web));
  }
});

test('los documentos del servicio solo se ofrecen cuando hay una URL publicada válida',async()=>{
  const source=await readFile(new URL('documentos-publicados.js',web),'utf8');
  async function links(config,ok=true){
    const entries=['privacyUrl','termsUrl'].map(key=>({hidden:true,dataset:{documento:key},link:{},querySelector(){return this.link;}}));
    await runInNewContext(source,{
      document:{querySelectorAll:()=>entries},URL,location:new URL('https://www.example.test/ayuda.html'),
      fetch:async(path,options)=>{assert.equal(path,'/api/billing/config');assert.equal(options.credentials,'omit');return {ok,json:async()=>config};}
    });
    return entries;
  }
  const [privacy,terms]=await links({privacyUrl:'https://example.test/ayuda.html',termsUrl:'https://legal.example.test/terms'});
  assert.ok(privacy.hidden);
  assert.equal(terms.hidden,false);
  assert.equal(terms.link.href,'https://legal.example.test/terms');
  for(const invalid of [null,'http://legal.example.test','javascript:void(0)','https://user@legal.example.test/policy','https://[']){
    assert.ok((await links({privacyUrl:invalid})).every(entry=>entry.hidden));
  }
  assert.ok((await links({},false)).every(entry=>entry.hidden));
});

test('accesibilidad ofrece una sola vuelta a la guía de origen y conserva los dos ajustes por dispositivo',async()=>{
  const source=await readFile(new URL('display-preferences.js',web),'utf8');
  for(const [origin,expected] of [['ayuda','/ayuda.html'],['privacidad','/privacidad.html'],['https://otras.example','/#inicio']]){
    class Item {
      constructor(){this.children=[];this.dataset={};this.events={};}
      append(...items){this.children.push(...items);}
      addEventListener(event,fn){this.events[event]=fn;}
      setAttribute(){}
    }
    const saved=new Map(),flags=new Map();let Component;
    const document={createElement:()=>new Item(),createTextNode:t=>t,head:new Item(),querySelector:()=>null,
      documentElement:{classList:{toggle:(id,value)=>flags.set(id,value)}}};
    runInNewContext(source,{document,HTMLElement:Item,customElements:{define:(key,value)=>{Component=value;}},
      localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},location:{hash:'#accesibilidad?volver='+origin},URLSearchParams});
    const component=new Component();component.connectedCallback();
    const [group,,,nav]=component.children;
    assert.equal(nav.children[0].href,expected);
    if(origin==='ayuda')assert.equal(nav.children.length,1);
    for(const label of group.children.slice(1)){const input=label.children[0];input.checked=true;input.events.change();}
    assert.equal(flags.get('lup-largeType'),true);assert.equal(flags.get('lup-still'),true);
    assert.deepEqual(JSON.parse(saved.get('lup-display-preferences-v1')),{largeType:true,still:true});
  }
});
