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

test('el tiempo transcurrido y la modalidad usan las fichas fechadas que empezaron en el periodo',()=>{
  const row = progress => ({progress,cycles:[],sideIds:new Set()});
  const rows = [
    row({1:{startedAt:100,completedAt:300,choice:'a',mode:'duo'},2:{startedAt:99,completedAt:250,choice:'b',mode:'duo'},
      13:{startedAt:190,completedAt:180,choice:'c',mode:'solo'},14:{startedAt:300,completedAt:300,choice:'a'}}),
    row({1:{startedAt:120,completedAt:460,choice:'a',mode:'duo'}, 2:{startedAt:140,completedAt:501,choice:'b',mode:'solo'},
      13:{updatedAt:210,mode:'duo'},15:{startedAt:500,completedAt:500,mode:'solo'}})
  ];
  const report=summarizeSeasonActivity(rows,{now:500,first:100,days:7,since:50});
  const [first,second]=report.seasons;
  assert.deepEqual([first.started,first.completed,first.elapsedMs,first.duo,first.solo],[3,2,540,2,1]);
  assert.deepEqual([second.started,second.completed,second.elapsedMs,second.duo,second.solo],[3,1,0,0,2]);
  assert.equal(first.cases[0].elapsedMs,540);
  assert.equal(first.cases[0].duo,2);
  assert.equal(second.cases[1].completed,1);
  const absent=summarizeSeasonActivity(rows,{now:500,first:100,days:7,since:null}).seasons[0];
  assert.deepEqual([absent.duo,absent.solo,absent.completed,absent.elapsedMs],[0,0,0,0]);
});

test('las ayudas suman débitos del periodo por llavero, incluidos costes cero y casos iniciados antes',()=>{
  const entry=(kind,caseId,amount,at)=>({kind,caseId,amount,at});
  const row = extra => ({progress:{},cycles:[],sideIds:new Set(),...extra});
  const rows=[
    row({unlockedHints:{open:[1,25,26],second:[1,2]},entries:[
      entry('open',1,-1,100),entry('open',25,-1,99),entry('open',26,-1,null),entry('second',1,0,150),
      entry('second',2,-2,501),entry('reward',8,2,200),entry('welcome',null,1,300)
    ]}),
    row({unlockedHints:{solution:[27]},entries:[entry('solution',27,-3,500),entry('solution',27,-3,500)]}),
    row({unlockedHints:{open:[12],second:[12]}})
  ];
  const result=summarizeSeasonActivity(rows,{now:500,first:100,days:7,since:null});
  assert.deepEqual(result.hints,{open:{uses:1,keys:1,undated:2},second:{uses:1,keys:0,undated:1},solution:{uses:1,keys:3,undated:0}});
  assert.deepEqual(result.seasons.map(s=>s.keysSpent),[1,0,3,0]);
  assert.equal(result.seasons[0].cases[0].keysSpent,1);
  assert.equal(result.seasons[2].cases[2].keysSpent,3);
});
