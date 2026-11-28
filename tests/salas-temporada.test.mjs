import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiError} from '../auth-provider.mjs';
import {createGameApi} from '../game-api.mjs';
import {estacionesDeSala,validaEstacion} from '../salas-soluciones.mjs';
import {layouts,rooms} from './salas-fixture.mjs';
import {valdemarRequest} from '../valdemar-api.mjs';
import {valdemarWallet} from '../valdemar-wallet.mjs';

const caseIds=[13,25,37],prizes=[1,1,1,2,1,2];
const origin='https://www.laultimapieza.es';
const stations=new Map(rooms.map(room=>[room.id,room.games.map(game=>{
  const valid=layouts(game).find(attempt=>validaEstacion(room.id,game.id,attempt));
  assert.ok(valid,game.id);
  return [game.id,valid];
})]));
const firstStation=season=>stations.get(season)[0];

function fixture(availableCases=caseIds){
  let accounts=new Map(),previous=Promise.resolve(),writes=0;
  const withStore=operation=>{
    const transaction=previous.then(async()=>{
      const updated=structuredClone(accounts);
      const result=await operation({
        async getMemberData(uid){return structuredClone(updated.get(uid)||{});},
        async saveMemberData(uid,data){writes++;updated.set(uid,structuredClone(data));}
      });
      accounts=updated;
      return result;
    });
    previous=transaction.catch(()=>{});
    return transaction;
  };
  const billing={membership:async(_store,_uid,options)=>{
    assert.deepEqual(options,{readOnly:true});
    return {canPlay:true,seasonAccess:{availableCases}};
  }};
  const request=(season,method='GET',input=null,overrides={})=>valdemarRequest({
    path:'/api/valdemar/salas/'+season,method,input,uid:'ana',editorial:false,withStore,billing,...overrides
  });
  return {withStore,billing,request,writes:()=>writes,record:uid=>structuredClone(accounts.get(uid))};
}

test('Cada sala exige el primer juego de su temporada y expone solo las estaciones, premios y resolución',async()=>{
  for(const [i,caseId] of caseIds.entries()){
    const season=i+2,db=fixture([caseId]),[id,attempt]=firstStation(season);
    const {games}=await db.request(season);
    assert.deepEqual(games,estacionesDeSala(season).map((id,i)=>({id,prize:prizes[i],solved:false})));
    assert.equal(games.length,6);
    assert.deepEqual(games.map(g=>[g.id,g.prize]),rooms.find(room=>room.id===season).games.map(g=>[g.id,g.prize]));
    assert.equal(db.writes(),0);
    const locked=fixture([caseId+1,...caseIds.filter(value=>value!==caseId)]);
    await assert.rejects(locked.request(season),{status:403});
    await assert.rejects(locked.request(season,'POST',{id,attempt,editorial:true,caseId:1,prize:99}),{status:403});
    await assert.rejects(db.request(season,'POST',{id:'sin-estación',attempt}),{status:400});
    await assert.rejects(db.request(season,'DELETE'),{status:405});
    await assert.rejects(db.request(season,'GET',null,{billing:null}),{status:403});
    const paidSeason={membership:async()=>({canPlay:false,seasonAccess:{availableCases:[caseId]}})};
    assert.equal((await db.request(season,'GET',null,{billing:paidSeason})).games.length,6);
    for(const value of [null,{},[],['opción-inventada']]){
      assert.deepEqual(await db.request(season,'POST',{id,attempt:value,correct:true,awarded:42}),{correct:false,awarded:0});
    }
    assert.equal(db.writes(),0);
  }
});

test('Al resolver 18 estaciones el llavero suma 24 llaves una sola vez y cada cuenta conserva su avance',async()=>{
  const db=fixture();
  for(const season of [2,3,4]){
    for(const [i,[id,attempt]] of stations.get(season).entries()){
      const payload={id,attempt,prize:200,userId:'otra'};
      const results=await Promise.all([1,2,3].map(()=>db.request(season,'POST',payload)));
      assert.deepEqual(results.map(r=>r.awarded).sort(),[0,0,prizes[i]]);
      assert.ok(results.every(r=>r.correct));
    }
    assert.ok((await db.request(season)).games.every(g=>g.solved));
    assert.ok((await db.request(season,'GET',null,{uid:'otra'})).games.every(g=>!g.solved));
  }
  assert.equal(db.writes(),18);
  const entries=db.record('ana').valdemarSeasonOne.paid.entries;
  assert.equal(new Set(entries.map(e=>e.id)).size,18);
  for(const caseId of caseIds)assert.equal(entries.filter(e=>e.caseId===caseId).reduce((n,e)=>n+e.amount,0),8);
  const wallet=await db.withStore(store=>valdemarWallet(store,'ana',{seasonAccess:{availableCases:caseIds}}));
  assert.equal(wallet.balance,24);
  assert.ok(wallet.history.every(e=>e.kind==='seasonArcade'));
});

test('Un reintento de transacción o una respuesta perdida conservan un único premio; la revisión editorial es independiente',async()=>{
  const db=fixture(),[id,attempt]=firstStation(3),input={id,attempt};
  let calls=0;
  const retry=op=>db.withStore(async store=>{
    const result=await op(store);
    if(!calls++)throw Object.assign(Error('deadlock'),{code:'ER_LOCK_DEADLOCK'});
    return result;
  });
  assert.deepEqual(await db.request(3,'POST',input,{withStore:retry}),{correct:true,awarded:1});
  assert.equal(calls,2);
  const [second,answer]=stations.get(3)[1];
  const lost=async op=>{await db.withStore(op);throw Error('Respuesta perdida');};
  await assert.rejects(db.request(3,'POST',{id:second,attempt:answer},{withStore:lost}),/Respuesta perdida/);
  assert.deepEqual(await db.request(3,'POST',{id:second,attempt:answer}),{correct:true,awarded:0});
  const editor={editorial:true,billing:null};
  assert.ok((await db.request(3,'GET',null,editor)).games.every(g=>!g.solved));
  assert.deepEqual(await db.request(3,'POST',input,editor),{correct:true,awarded:1});
  assert.equal(db.record('ana').valdemarSeasonOne.editorial.entries.length,1);
  assert.equal(db.record('ana').valdemarSeasonOne.paid.entries.length,2);
});

test('La ruta real de las salas exige identidad y rechaza ámbitos y temporadas forzados',async()=>{
  const db=fixture([]);
  const api=createGameApi({origins:[origin],config:{},billing:db.billing,withStore:db.withStore,
    verify:async req=>{if(!req.headers.get('Authorization'))throw new ApiError(401,'Inicia sesión.');return {userId:'ana',email:'ana@example.test',emailVerified:true};}});
  const call=(room,headers={},body)=>api(new Request(origin+'/api/valdemar/salas/'+room,{
    method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:origin,...headers},
    ...(body?{body:JSON.stringify(body)}:{})
  }));
  assert.equal((await call(2)).status,401);
  assert.equal((await call(2,{Authorization:'test'},{editorial:true,uid:'admin',solved:true})).status,403);
  for(const room of ['1','5','02'])assert.equal((await call(room,{Authorization:'test'})).status,404);
  assert.equal(db.writes(),0);
});
