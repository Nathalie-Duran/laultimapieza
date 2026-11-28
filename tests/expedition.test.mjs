import assert from 'node:assert/strict';
import test from 'node:test';
import {valdemarRequest} from '../valdemar-api.mjs';
import {inspectInventory,useInventory,mergeInventory} from '../expedition.mjs';

test('un cruce contextual de dos carpetas revela el hallazgo también al retomar una partida anterior',()=>{
  const materials=[['plano','A'],['placa','B'],['lista','B']].map(([id,role])=>({id,label:id,role,body:'Observación en el archivo: '+id}));
  const fieldLink={items:['plano','placa'],objective:'Busca de qué máquina se retiró la placa.',finding:'Los orificios encajan con el dibujo del torno.'};
  const story={id:2,hour:{stages:[{materials,fieldLink}]}},record={};
  const act=(role,operation,data={})=>useInventory(story,record,role,{index:0,operation,...data});
  const view=(state,role)=>inspectInventory(story,state,role).rooms[0];
  assert.equal(view(record,'A').fieldNote,undefined);
  act('A','visit');
  assert.deepEqual(view(record,'A').fieldNote,{objective:fieldLink.objective});
  assert.throws(()=>act('A','collect',{item:'placa'}),{status:400});
  act('A','collect',{item:'plano'});act('B','collect',{item:'lista'});act('B','collect',{item:'placa'});
  act('A','combine',{items:['plano','lista']});
  assert.equal(view(record,'B').fieldNote.finding,undefined);
  act('B','combine',{items:['placa','plano']});
  assert.equal(view(record,'A').fieldNote.finding,fieldLink.finding);
  assert.equal(view(record,'A').items.find(x=>x.id==='placa').detail,undefined);
  assert.equal(view(record,'A').items.find(x=>x.id==='placa').role,'B');
  const oldRecord={inventory:{0:{items:['plano','placa'],links:[['plano','placa']]}}};
  assert.equal(view(oldRecord,null).fieldNote.finding,fieldLink.finding);
  assert.deepEqual(view(oldRecord,null).items.filter(item=>item.held).map(item=>item.role),['A','B']);
  assert.equal(view(oldRecord,null).items.find(item=>item.id==='lista').held,false);
  const personal={};mergeInventory(personal,record);
  assert.equal(view(personal,null).fieldNote.finding,fieldLink.finding);
});

test('Los cuatro tableros conservan la exploración individual, la combinación y el premio tras reabrir',async()=>{
  for(const id of [1,18,33,48]){
    let saved={};
    const materials=['A','B'].map(role=>({id:role,label:'Carpeta '+role,kind:'text',role,body:'Fragmento del registro '+role}));
    const stages=Array.from({length:5},(_,i)=>({title:'Etapa '+i,place:'Lugar '+i,mode:'single',task:'Revisa el registro.',materials,
      options:[{id:'ok',label:'Continuar'}],answer:['ok'],retry:'Revisa.',success:'Hecho.'}));
    const story={id,title:'Ensayo',hour:{stages},evidenceCards:[],roles:['Archivo','Campo'],choices:[],hints:[],hypotheses:[],
      side:{materials:[],options:[],answer:[]}};
    const withStore=async fn=>{
      const data=structuredClone(saved);
      const store={getMemberData:async()=>structuredClone(data),saveMemberData:async(_,value)=>Object.assign(data,structuredClone(value))};
      const result=await fn(store);
      saved=data;
      return result;
    };
    const ask=(action,input)=>valdemarRequest({path:'/api/valdemar/cases/'+id+(action?'/'+action:''),method:action?'POST':'GET',input,
      uid:'solo',editorial:true,withStore,loadRelease:async()=>({stories:[story],nuevos:[story],samples:[]})});
    const amount=1+Math.floor(((id-1)%12)/4);
    const index=(amount-1)*2;
    for(let i=0;i<index;i++)await ask('stage',{index:i,choice:['ok']});
    await ask('inventory',{index,operation:'visit'});
    if(id===1){
      assert.equal((await ask()).hour.inventory.rooms[index].instrumentSolved,false);
      await assert.rejects(ask('inventory',{index,operation:'instrument',answer:'1111'}),{status:422});
      await ask('inventory',{index,operation:'instrument',answer:'0734'});
      const room=(await ask()).hour.inventory.rooms[index];
      assert.equal(room.instrumentSolved,true);
      assert.equal(room.recovered.label,'Carpeta A');
    }
    for(const item of ['A','B'])await ask('inventory',{index,operation:'collect',item});
    await ask('inventory',{index,operation:'combine',items:['B','A']});
    await ask('inventory',{index,operation:'combine',items:['A','B']});
    const result=await ask();
    assert.equal(result.hour.inventory.rooms[index].links.length,1);
    assert.equal(result.hour.inventory.rooms[index].assignment.complete,true);
    assert.deepEqual(result.wallet.history.filter(e=>e.kind==='mission').map(e=>e.amount),[amount]);
  }
});

test('Los objetos del hotel y la segunda declaración se conservan y exigen la prueba correcta',async()=>{
  const {inspectInventory,useInventory,mergeInventory}=await import('../expedition.mjs');
  const hotel={objects:[{id:'ficha'},{id:'sobre'}],witnesses:[{id:'portero',object:'ficha',miss:'Revisa la ficha de recepción.'}]};
  const story={id:1,hour:{hotel,stages:[]}};
  const record={};
  const show=object=>useInventory(story,record,null,{operation:'hotel-testimony',object,witness:'portero'});
  assert.throws(()=>show('ficha'),{status:409});
  for(const object of ['ficha','sobre'])useInventory(story,record,null,{operation:'hotel-collect',object});
  assert.throws(()=>show('sobre'),{status:422});
  assert.equal(show('ficha'),true);
  assert.equal(show('ficha'),false);
  const personal={};
  mergeInventory(personal,structuredClone(record));
  assert.deepEqual(inspectInventory(story,personal,null).hotel,{objects:['ficha','sobre'],witnesses:['portero']});
});
