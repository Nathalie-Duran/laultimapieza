import assert from 'node:assert/strict';
import test from 'node:test';
import {valdemarRequest} from '../valdemar-api.mjs';
import {resetValdemarProgress} from '../valdemar-wallet.mjs';

const ids=Array.from({length:48},(_,i)=>i+1);
function harness(){
  const members=new Map();
  const sample={stage:2,category:'Ensayo',location:'Banco de ensayo',names:['Muestra C','Muestra A','Muestra B'],
    signs:{A:['Rasgo uno','Otro uno','Otro dos'],B:['Rasgo dos','Otro tres','Otro cuatro']},
    clues:{A:'Observación de la carpeta primera.',B:'Observación de la carpeta segunda.'},description:'Ficha de ensayo.'};
  const all=ids.map(id=>({id,title:'Caso '+id,explorador:sample}));
  const release={stories:all.slice(0,12),nuevos:all.slice(12)};
  let chain=Promise.resolve(),pair=null,reads=0,active=true;
  const get=uid=>{if(!members.has(uid))members.set(uid,{valdemarCaseProgress:{editorial:{},paid:{}}});return members.get(uid);};
  const store={getMemberData:async uid=>structuredClone(get(uid)),saveMemberData:async(uid,data)=>{members.set(uid,structuredClone(data));},
    getCasePartner:async(uid,id)=>pair&&pair.caseId===id&&[pair.ownerId,pair.guestId].includes(uid)?pair:null};
  const withStore=work=>{const op=chain.then(()=>work(store));chain=op.catch(()=>{});return op;};
  const billing={membership:async()=>({canPlay:active,seasonAccess:{availableCases:active?ids:[],seasons:[{previousReady:true}]}})};
  const call=(id,uid,body,editorial=false)=>valdemarRequest({path:'/api/valdemar/explorer'+(id?'/'+id:''),method:body?'POST':'GET',input:body||null,
    uid,editorial,withStore,billing,loadRelease:async()=>{reads++;return release;}});
  const start=(uid,id,scope='paid',more={})=>(get(uid).valdemarCaseProgress[scope][id]={mode:'solo',hourStep:1,...more});
  return {call,start,get,store,sample,paid:value=>{active=value;},reads:()=>reads,
    pair:()=>pair={id:'pair',caseId:1,status:'accepted',ownerId:'one',guestId:'two',progress:{hourStep:1,consentVersion:2}}};
}
const status=n=>error=>error.status===n;
const selection=(card,side='A')=>({op:'identify',partnerId:card.partnerId,
  name:card.names.find(n=>n.label==='Muestra C').value,sign:card.signs.find(s=>s.label===(side==='A'?'Rasgo uno':'Rasgo dos')).value});

test('las 48 fichas requieren examen y validan conjuntamente la muestra y el rasgo; cada alta suma diez puntos',async()=>{
  const h=harness();
  for(const id of ids){
    h.start('one',id);
    const before=await h.call(id,'one');
    assert.equal(before.examined,false);
    assert.equal(before.clues,undefined);
    await assert.rejects(h.call(id,'one',{op:'identify'}),status(409));
    const card=await h.call(id,'one',{op:'examine'});
    assert.equal(card.clues.length,2);
    assert.equal((await h.call(id,'one')).examined,true);
    const guess=selection(card);
    assert.equal((await h.call(id,'one',{...guess,sign:'wrong'})).correct,false);
    assert.equal((await h.call(id,'one',{...guess,name:'wrong'})).correct,false);
    const results=await Promise.all([h.call(id,'one',guess),h.call(id,'one',guess)]);
    assert.deepEqual(results.map(r=>r.awarded),[10,0]);
  }
  h.paid(false);const reads=h.reads();
  const album=await h.call(null,'one');
  assert.equal(album.total,48);assert.equal(album.points,480);assert.equal(h.reads(),reads);
  assert.equal(JSON.stringify(album).includes('Otro tres'),false);
  await assert.rejects(h.call(2,'one',{op:'examine'}),status(402));
  assert.equal((await h.call(null,'one',null,true)).total,0);
  resetValdemarProgress(h.get('one'),{editorial:false});
  assert.equal((await h.call(null,'one')).total,0);
});

test('la carpeta del compañero nunca viaja al cliente y las colecciones de la pareja son personales',async()=>{
  const h=harness();h.start('one',1);h.start('two',1);h.pair();
  await assert.rejects(h.call(1,'one',{op:'examine',partnerId:'previous'}),status(409));
  const owner=await h.call(1,'one',{op:'examine',partnerId:'pair'});
  const guest=await h.call(1,'two',{op:'examine',partnerId:'pair'});
  assert.deepEqual(owner.clues.map(c=>c.role),['A']);assert.deepEqual(guest.clues.map(c=>c.role),['B']);
  assert.ok(!JSON.stringify(owner).includes('Rasgo dos')&&!JSON.stringify(guest).includes('Rasgo uno'));
  assert.equal((await h.call(1,'one',selection(guest,'B'))).correct,false);
  assert.equal((await h.call(1,'one',selection(owner))).awarded,10);
  assert.equal((await h.call(null,'two')).total,0);
  assert.equal((await h.call(1,'two',selection(guest,'B'))).awarded,10);
});

test('el modo, la etapa y el espacio editorial se validan antes de descubrir información',async()=>{
  const h=harness();
  await assert.rejects(h.call(2,'one'),status(409));
  h.start('one',1,'editorial',{hourStep:4,mansionEdition:'mansion',mansion:{current:1}});
  const pending=await h.call(1,'one',null,true);
  assert.equal(pending.locked,true);assert.equal(pending.location,undefined);assert.equal(pending.clues,undefined);
  await assert.rejects(h.call(1,'one',{op:'examine'},true),status(409));
  h.get('one').valdemarCaseProgress.editorial[1].mansion.current=2;
  const card=await h.call(1,'one',{op:'examine'},true);await h.call(1,'one',selection(card),true);
  assert.equal((await h.call(null,'one',null,true)).points,10);
  assert.equal((await h.call(null,'one')).points,0);
  await assert.rejects(h.call(49,'one'),status(404));
});
