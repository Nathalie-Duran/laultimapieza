import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

test('la gestión abre directamente el área solicitada sin repetir herramientas en otras áreas',async()=>{
  const source=await readFile(new URL('../management.js',import.meta.url),'utf8');
  const window={location:{hash:'#gestion?seccion=edicion'},ClubAccess:{state:{canManage:true}},
    Colecciones:{seals:()=>'<p>Sellos de prueba</p>'}};
  runInNewContext(source,{window,URLSearchParams});
  const edit=window.ManagementUI.view();
  const tab=(html,id)=>html.match(new RegExp('<button[^>]*id="mg-tab-'+id+'"[^>]*>'))[0];
  assert.match(tab(edit,'edicion'),/aria-selected="true"/);
  assert.match(edit,/data-mg-analysis hidden/);
  assert.equal((edit.match(/href="#edicion-valdemar"/g)||[]).length,1);
  assert.equal((edit.match(/Sellos de prueba/g)||[]).length,1);
  assert.match(edit,/<div id="mg-area-cuentas"[^>]+hidden[^>]*><section[^>]*><h2>Consultar una cuenta/);
  window.location.hash='#gestion?seccion=partidas';
  assert.match(tab(window.ManagementUI.view(),'partidas'),/aria-selected="true"/);
  window.location.hash='#gestion?seccion=extranjera';
  assert.match(tab(window.ManagementUI.view(),'resumen'),/aria-selected="true"/);
  window.ClubAccess.state.canManage=false;
  assert.equal(window.ManagementUI.view(),'');
});

test('el editor vuelve a su pestaña y envía únicamente un archivo válido al confirmar',async()=>{
  const source=await readFile(new URL('../web/valdemar-edicion.js',import.meta.url),'utf8');
  const listeners={},input={files:[],addEventListener:(name,handler)=>{listeners[name]=handler;}},button={disabled:true},status={};
  const form={elements:{edicion:input},dataset:{},querySelector:s=>s==='button'?button:status,
    addEventListener:(name,handler)=>{listeners[name]=handler;}};
  const window={},requests=[],key='a'.repeat(43);
  runInNewContext(source,{window,document:{getElementById:()=>form}});
  assert.match(window.ValdemarEdicion.view(),/href="#gestion\?seccion=edicion"/);
  window.ValdemarEdicion.mount({request:async(url,body,method)=>{requests.push({url,body,method});return {active:true,release:'valdemar-s1-v1'};}});
  input.files=[{size:4097}];listeners.change();assert.equal(button.disabled,true);
  input.files=[{size:12,text:async()=>'{}'}];listeners.change();assert.equal(button.disabled,false);
  await listeners.submit({preventDefault(){}});assert.equal(requests.length,0);assert.equal(button.disabled,true);
  input.files=[{size:129,text:async()=>JSON.stringify({release:'valdemar-s1-v1',key})}];listeners.change();
  await listeners.submit({preventDefault(){}});
  assert.equal(requests.length,1);assert.equal(requests[0].method,'POST');assert.equal(requests[0].url,'/api/admin/valdemar-release');
  assert.match(status.textContent,/Temporada activa/);assert.doesNotMatch(status.textContent,new RegExp(key));
});
