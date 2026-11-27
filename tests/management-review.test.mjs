import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCaseReview,summarizeManagementAccount} from '../case-review.mjs';
import {summarizeSeasonActivity} from '../season-activity.mjs';
import {createGameApi} from '../game-api.mjs';

test('las revisiones editoriales conservan el resto del perfil y detectan cambios simultáneos',async()=>{
  const owner = {active:true};
  const store = {async getMemberData(){return structuredClone(owner);},async saveMemberData(uid,data){Object.assign(owner,data);}};
  const input = {caseId:48,version:0,status:'reviewing',note:'  Revisar pista 3  '};
  const result = await saveCaseReview(store,'owner',input);
  assert.equal(result.note,'Revisar pista 3');
  assert.equal(result.version,1);
  assert.equal(owner.active,true);
  assert.deepEqual(await saveCaseReview(store,'owner',input),result);
  await assert.rejects(saveCaseReview(store,'owner',{...input,status:'ready'}),{status:409});
  await assert.rejects(saveCaseReview(store,'owner',{...input,caseId:49}),{status:400});
  await assert.rejects(saveCaseReview(store,'owner',{...input,note:'a'.repeat(501)}),{status:400});
  assert.equal((await saveCaseReview(store,'owner',{...input,status:'ready',version:1})).version,2);
});

test('la ruta editorial rechaza una cuenta ordinaria antes de leer el almacén',async()=>{
  const origin = 'https://example.test';
  let reads=0;
  const api=createGameApi({origins:[origin],verify:async()=>({userId:'member',email:'member@example.test',emailVerified:true}),
    withStore:()=>{reads++;throw Error('No se debe leer');}});
  const response=await api(new Request(origin+'/api/admin/case-review',{method:'PUT',headers:{origin,'Content-Type':'application/json'},body:'{}'}));
  assert.equal(response.status,403);
  assert.equal(reads,0);
});

test('una cuenta activa cuenta una vez por tablero, incluso si reanuda un caso anterior',()=>{
  const now=10000, first=4000;
  const players=[
    {progress:{1:{startedAt:200,updatedAt:5000},2:{updatedAt:6000},13:{updatedAt:7000},25:{updatedAt:10001}},cycles:[],sideIds:new Set()},
    {progress:{},cycles:[{id:'paid',start:300,end:20000,worldBlock:4},{id:'refunded',start:500,end:20000,worldBlock:7,revoked:true}],sideIds:new Set()}
  ];
  const result=summarizeSeasonActivity(players,{now,first,days:7,since:100});
  assert.deepEqual(result.seasons.map(s=>s.activeHolders),[1,1,0,0]);
  assert.deepEqual(result.seasons.map(s=>s.paidPeriodHolders),[0,1,0,0]);
});

test('la ficha de soporte entrega indicadores y mantiene privados los identificadores, las decisiones y las notas',()=>{
  const row={name:'Perfil',created_at:'2026-01-02',subscription:'sub_internal',active:'true',
    cycles:JSON.stringify([{id:'receipt_internal',start:200,end:1200,subscription:'sub_internal'}]),
    progress:JSON.stringify({1:{choice:'private-choice'}}),caseReviews:{1:{note:'private-note'}}};
  const account=summarizeManagementAccount(row,1000);
  assert.equal(account.paidPeriod,true);
  assert.deepEqual(account.boards[0],{number:1,blocks:1,available:4,completed:1});
  assert.doesNotMatch(JSON.stringify(account),/internal|private/);
  assert.equal(summarizeManagementAccount(row,1200).paidPeriod,false);
});
