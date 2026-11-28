import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeStore,playPublished,validateChallenge} from '../published-challenges.mjs';
import {createGameApi} from '../game-api.mjs';

const puzzle={id:'ae519d13-da39-4f05-ab16-3ab9b4df7c34',revision:1,caseId:2,status:'published',
  title:'La fecha de la carta',prompt:'La carta se escribió dos días antes del 4 de mayo. ¿Qué fecha llevaba?',options:['1 de mayo','2 de mayo'],answer:1,explanation:'Dos días antes del 4 es el día 2.'};
test('el editor valida la respuesta, las alternativas distintas, el caso y el estado',()=>{
  assert.deepEqual(validateChallenge(puzzle),{...puzzle,prize:1,rewardType:'simple',schedule:{kind:'always',startsOn:null,endsOn:null}});
  for(const extra of [{caseId:49},{options:['Sí',' sí']},{answer:2},{status:'deleted'},{revision:-1}]){
    assert.throws(()=>validateChallenge({...puzzle,...extra}),{status:400});
  }
});
test('las variantes guardan la versión empezada y la primera misión concede el premio anunciado una sola vez',async()=>{
  const alt={prompt:'¿En qué mes nació Ada?',options:['Abril','Mayo'],answer:0,explanation:'El acta dice abril.'};
  let row=validateChallenge({...puzzle,variants:[alt],prize:3,rewardType:'mission'});
  for(const input of [{...puzzle,prize:3},{...puzzle,rewardType:'advanced',prize:1},{...puzzle,prize:4,rewardType:'mission'},{...puzzle,variants:[puzzle]}]){
    assert.throws(()=>validateChallenge(input),{status:400});
  }
  const members=new Map();
  const store={getMemberData:async uid=>structuredClone(members.get(uid)||{}),saveMemberData:async(uid,data)=>members.set(uid,structuredClone(data)),
    listChallenges:async()=>[row],lockChallenge:async()=>row,countChallenge:async()=>{},countStage:async()=>{}};
  const run=(uid,input)=>playPublished(store,{uid,editorial:false,billing:{membership:async()=>({seasonAccess:{availableCases:[2]}})},input});
  const cases=new Map();
  for(let i=0;i<24;i++){
    const uid='participante-'+i,info=(await run(uid)).items[0];
    assert.equal(info.prize,3);assert.equal(info.rewardType,'mission');
    assert.equal(info.variants,undefined);assert.equal(info.answer,undefined);
    cases.set(info.prompt,uid);
  }
  assert.equal(cases.size,2);
  const uid=cases.get(alt.prompt);
  const guess=option=>run(uid,{id:row.id,revision:row.revision,index:0,option});
  assert.equal((await guess(1)).correct,false);
  row=validateChallenge({...row,revision:2,variants:[{...alt,prompt:'¿Quién firmó la carta?'},alt]});
  assert.equal((await run(uid)).items[0].prompt,alt.prompt);
  assert.equal((await guess(0)).next.solved,true);
  const before=structuredClone(members.get(uid));
  const entries=before.valdemarSeasonOne.paid.entries;
  assert.ok(entries.some(entry=>entry.id===row.id&&entry.amount===3));
  await guess(0);
  assert.deepEqual(members.get(uid),before);
  row=validateChallenge({...row,revision:3,prize:1,rewardType:'simple'});
  assert.equal((await run(uid)).items[0].earned,3);
  assert.equal((await run('nueva-cuenta')).items[0].prize,1);
});
test('un guardado no reemplaza la revisión de otra sesión',async()=>{
  const store=challengeStore(async()=>({affectedRows:0}));
  await assert.rejects(store.saveChallenge(puzzle),{status:409});
});
test('solo se entrega contenido publicado para casos con acceso y se remunera una única victoria',async()=>{
  let data={},row={...puzzle},counts={attempted:0,solved:0},cases=[2];
  const store={
    getMemberData:async()=>structuredClone(data),saveMemberData:async(_,d)=>{data=d;},
    listChallenges:async(published)=>{assert.equal(published,true);return [row,{...row,caseId:3}];},
    lockChallenge:async()=>row,countChallenge:async(_,first,solved)=>{counts.attempted+=Number(first);counts.solved+=Number(solved);},countStage:async()=>{}
  };
  const play=input=>playPublished(store,{uid:'member',billing:{membership:async()=>({seasonAccess:{availableCases:cases}})},editorial:false,input});
  const list=await play();
  assert.equal(list.items.length,1);
  assert.equal(list.items[0].answer,undefined);
  assert.equal(list.items[0].explanation,undefined);
  assert.equal(list.items[0].solved,false);
  const guess=option=>({id:row.id,revision:row.revision,option});
  assert.deepEqual(await play(guess(0)),{correct:false});
  assert.deepEqual(await play(guess(0)),{correct:false});
  const solved=await play(guess(1));
  assert.equal(solved.explanation,row.explanation);
  assert.equal(solved.next.solved,true);
  const saved=JSON.stringify(data);
  assert.deepEqual(await play(guess(1)),solved);
  assert.equal(JSON.stringify(data),saved);
  assert.deepEqual(counts,{attempted:1,solved:1});
  assert.equal((await play()).items[0].solved,true);
  await assert.rejects(play({...guess(0),revision:0}),{status:409});
  row.status='draft';
  await assert.rejects(play(guess(1)),{status:404});
  row.status='published';cases=[];
  await assert.rejects(play(guess(1)),{status:404});
});

test('la aventura reserva las pruebas posteriores, guarda las etapas y mide las cuentas pendientes sin duplicar',async()=>{
  const row={...puzzle,steps:[{prompt:'¿Quién conservó la carta?',options:['Ana','Luis'],answer:0,explanation:'La firma coincide con Ana.'}]};
  let data={},first=0,won=0;
  const metrics=[[0,0],[0,0]];
  const store={getMemberData:async()=>structuredClone(data),saveMemberData:async(_,d)=>{data=d;},listChallenges:async()=>[row],lockChallenge:async()=>row,
    countChallenge:async(_,a,b)=>{first+=Number(a);won+=Number(b);},
    countStage:async(_,i,key,a,b)=>{metrics[i][0]+=Number(a);metrics[i][1]+=Number(b);}
  };
  const call=input=>playPublished(store,{uid:'subscriber',billing:{membership:async()=>({seasonAccess:{availableCases:[2]}})},editorial:false,input});
  const guess=(index,option)=>({id:row.id,revision:row.revision,index,option});
  assert.doesNotMatch(JSON.stringify(await call()),/conservó|firma|explanation|answer/);
  await assert.rejects(call(guess(1,0)),{status:409});
  const result=await call(guess(0,1));
  assert.equal(result.next.index,1);
  assert.equal(result.next.solved,false);
  assert.equal((await call()).items[0].prompt,row.steps[0].prompt);
  await call(guess(0,1));
  await call(guess(1,1));await call(guess(1,1));
  assert.deepEqual(metrics,[[1,1],[1,0]]);
  assert.equal(won,0);
  assert.equal((await call(guess(1,0))).next.solved,true);
  await call(guess(1,0));
  assert.deepEqual(metrics,[[1,1],[1,1]]);
  assert.deepEqual([first,won],[1,1]);
  row.revision++;
  row.prompt='Un enunciado corregido';
  assert.equal((await call()).items[0].index,0);
  assert.equal((await call()).items[0].solved,false);
  await call(guess(0,1));
  await call(guess(1,0));
  assert.equal(won,1);
});
test('el acceso editorial a borradores y soluciones exige una cuenta propietaria verificada',async()=>{
  const origin='https://example.test';
  const api=createGameApi({origins:[origin],verify:async()=>({userId:'reader',email:'reader@example.test',emailVerified:true}),
    withStore:()=>{assert.fail('No debe leer el almacén de gestión');}});
  for(const method of ['GET','PUT']){
    const res=await api(new Request(origin+'/api/admin/challenges',{method,headers:{origin,'content-type':'application/json'},...(method==='PUT'?{body:JSON.stringify(puzzle)}:{})}));
    assert.equal(res.status,403);
  }
});
