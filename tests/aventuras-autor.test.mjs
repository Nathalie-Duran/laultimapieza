import test from 'node:test';
import assert from 'node:assert/strict';
import {authorPlay,authorAdmin} from '../aventuras-autor.mjs';
import {createGameApi} from '../game-api.mjs';
import {ApiError} from '../auth-provider.mjs';

const id='sala-norte',draft={id,titulo:'Sala Norte',escenas:[{id:'sala'}]};
const engine={
  validar:d=>Array.isArray(d?.escenas)?[]:['Falta una escena'],
  iniciar:(_d,modo)=>({modo,completada:false}),
  vista:(_d,s,papel)=>({escena:{id:'sala'},acciones:s.completada?[]:[{id:'abrir',tipo:'prueba'}],papel}),
  ejecutar:(_d,s,a)=>{const ok=!s.completada&&a.escena==='sala'&&a.accion==='abrir'&&a.intento==='bien';return {ok,estado:ok?{...s,completada:true}:s,mensaje:ok?'Abierto':'Comprueba la pista'};}
};
function fixture(){
  const members=new Map(),releases=new Map(),runs=new Map(),trials=[],access={ana:[13],bea:[13],otra:[]};let item=null;
  const pair={id:'equipo',ownerId:'ana',guestId:'bea',status:'accepted',progress:{consentVersion:2}};
  const store={
    async getMemberData(uid){return structuredClone(members.get(uid)||{});},async saveMemberData(uid,v){members.set(uid,structuredClone(v));},
    async getCasePartner(uid){return [pair.ownerId,pair.guestId].includes(uid)?pair:null;},
    async authorPairRun(pid,game){return structuredClone(runs.get(pid+'/'+game));},
    async saveAuthorPairRun(pid,game,record){runs.set(pid+'/'+game,structuredClone(record));},
    async authorDraft(){return item;},async saveAuthorDraft(v){
      if(v.version!==(item?.version||0))throw new ApiError(409,'Versión modificada');
      const revision=v.publish?v.version+1:item?.revision||0;item={...v,version:v.version+1,revision};
      if(v.publish)releases.set(revision,structuredClone(item));return item;
    },
    async authorRelease(_id,r){return releases.get(r||item?.revision);},
    async listAuthorTitles(admin){return (!item||(!admin&&!item.revision))?[]:[{id,caseId:13,titulo:item.definition.titulo,revision:item.revision}];},
    async noteTrial(v){trials.push(v);}
  };
  const billing={membership:async(_s,uid)=>({canPlay:true,seasonAccess:{availableCases:access[uid]||[]}})};
  const edit=(version,publish,titulo='Sala Norte')=>authorAdmin(store,id,'PUT',{definition:{...draft,titulo},version,publish,caseId:13},engine);
  const play=(method,input={},o={})=>authorPlay({id,method,input,params:new URLSearchParams(o.query),uid:'ana',editorial:false,billing,withStore:fn=>fn(store),engine,...o});
  const move=(info,answer='bien')=>({modo:info.modo,papel:info.papel,paso:info.paso,revision:info.revision,pareja:info.pareja,escena:'sala',accion:'abrir',intento:answer});
  return {store,members,runs,access,trials,edit,play,move,pair};
}
test('Borrador privado, publicación versionada y guardado anclado a su edición y a su derecho de acceso',async()=>{
  const f=fixture();await f.edit(0,false);
  assert.deepEqual(await f.play('GET',{}, {id:null}),{aventuras:[]});
  await assert.rejects(f.play('GET'),{status:404});
  await assert.rejects(f.edit(0,true),{status:409});
  await f.edit(1,true);
  await assert.rejects(f.play('GET',{}, {uid:'otra'}),{status:404});
  const start=await f.play('GET');
  assert.equal(start.revision,2);assert.equal(f.members.size,0);
  const wrong=await f.play('POST',f.move(start,'otra'));
  assert.equal(wrong.ok,false);assert.equal(wrong.paso,0);
  const end=await f.play('POST',f.move(start));assert.equal(end.completada,true);
  await assert.rejects(f.play('POST',f.move(start)),{status:409});
  await f.edit(2,true,'Nueva edición');
  assert.equal((await f.play('GET')).titulo,'Sala Norte');
  const list=await f.play('GET',{}, {id:null});assert.equal(list.aventuras[0].completada,true);assert.equal(list.aventuras[0].revision,2);
  assert.deepEqual(f.trials.map(t=>t.solved),[false,true]);assert.ok(f.trials.every(t=>t.participant.length===64&&!Object.hasOwn(t,'intento')));
});
test('Dos perfiles autorizados comparten el mismo paso y mantienen sus papeles y su copia al salir',async()=>{
  const f=fixture();await f.edit(0,true);
  const read=uid=>f.play('GET',{}, {uid,query:'modo=duo'});
  const a=await read('ana'),b=await read('bea');
  assert.equal(a.papel,'A');assert.equal(b.papel,'B');
  await assert.rejects(f.play('POST',{...f.move(b),papel:'A'},{uid:'bea'}),{status:403});
  await assert.rejects(f.play('POST',{...f.move(a),pareja:'anterior'}),{status:409});
  f.access.bea=[];await assert.rejects(read('ana'),{status:403});f.access.bea=[13];
  assert.equal((await f.play('POST',f.move(b),{uid:'bea'})).completada,true);
  assert.equal((await read('ana')).paso,1);assert.equal(f.runs.size,1);
  f.pair.status='closed';await assert.rejects(read('bea'),{status:409});
  assert.equal((await f.play('GET',{}, {uid:'bea'})).completada,true);
});
test('Las operaciones editoriales requieren la cuenta propietaria antes de leer el motor o datos privados',async()=>{
  const origin='https://www.laultimapieza.es';
  const api=createGameApi({config:{},origins:[origin],verify:async req=>{if(!req.headers.get('authorization'))throw new ApiError(401,'Entra');return {userId:'otra',email:'otra@example.test',emailVerified:true};},withStore(){throw Error('No debe acceder a los datos');}});
  const url=origin+'/api/admin/aventuras/'+id;
  assert.equal((await api(new Request(url))).status,401);
  assert.equal((await api(new Request(url,{headers:{Authorization:'test'}}))).status,403);
});

test('La plantilla del taller se publica y se juega con el motor real sin entregar los parámetros del autor',async()=>{
  await import('../web/motor-aventuras.js');
  const real=globalThis.MotorAventuras,db=fixture(),def={...real.plantilla(),id};
  await authorAdmin(db.store,id,'PUT',{definition:def,version:0,publish:true,caseId:13},real);
  const start=await db.play('GET',{}, {engine:real});
  assert.equal(start.vista.escena.id,real.vista(def,real.iniciar(def,'solo'),'A').escena.id);
  assert.equal(start.vista.acciones.some(a=>Object.hasOwn(a,'parametros')),false);
  const action=start.vista.acciones.find(a=>a.tipo==='hablar'||a.tipo==='observar');
  assert.ok(action);
  const result=await db.play('POST',{...db.move(start),escena:start.vista.escena.id,accion:action.id,intento:null},{engine:real});
  assert.equal(result.ok,true);assert.equal(result.paso,1);
  assert.deepEqual((await db.play('GET',{}, {engine:real})).vista,result.vista);
});
