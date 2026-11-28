import test from 'node:test';
import assert from 'node:assert/strict';
import {mansionArcadeRequest} from '../mansion-arcade.mjs';
import {seasonArcadeRequest} from '../salas-temporada.mjs';
import {estacionesDeSala,validaEstacion} from '../salas-soluciones.mjs';
import {layouts,rooms} from './salas-fixture.mjs';

const cases=[1,13,25,37];
function harness(season){
  const caseId=cases[season-1];
  const row={id:'vinculo',caseId,ownerId:'ana',guestId:'bea',ownerName:'Ana',guestName:'Bea',status:'accepted',
    progress:{consentVersion:2,ownerScope:'paid',guestScope:'paid',currentStage:3}};
  const accounts={ana:{},bea:{}},allowed=new Set(['ana','bea']);
  let tail=Promise.resolve();
  const withStore=operation=>{
    const next=tail.then(async()=>{
      const members=structuredClone(accounts),pair=structuredClone(row);
      const res=await operation({
        async getCasePartner(uid,id){return (uid==='ana'||uid==='bea')&&id===caseId?pair:null;},
        async savePartner(updated){Object.assign(pair,updated);},
        async getMemberData(uid){return structuredClone(members[uid]||{});},
        async saveMemberData(uid,data){members[uid]=structuredClone(data);}
      });
      Object.assign(accounts,members);Object.assign(row,pair);return res;
    });
    tail=next.catch(()=>{});return next;
  };
  const billing={membership:async(_store,uid)=>({seasonAccess:{availableCases:allowed.has(uid)?[caseId]:[]}})};
  const request=(uid,input,editorial=false)=>(season===1?mansionArcadeRequest:seasonArcadeRequest)({uid,season,method:input?'POST':'GET',input,editorial,billing,withStore});
  return {caseId,row,accounts,allowed,request};
}
function crossCards(a,b){
  const marks=a.material.map(line=>line.split(' lleva la marca ')[1].slice(0,-1));
  const drawers=new Map(b.material.map(line=>line.slice('La marca '.length,-1).split(' indica el ')));
  const first=drawers.get(marks[0]),second=marks.findIndex(mark=>drawers.get(mark)===a.options[1].label);
  return [a.options.find(option=>option.label===first).id,b.options[second].id];
}

test('las dos fichas son complementarias; la preparación, la recompensa y la variante siguen al vínculo',async()=>{
  for(const season of [1,2,3,4]){
    const h=harness(season),id=season===1?'relojero':estacionesDeSala(season)[0];
    // Wheel ratios come from the three constraints displayed on the clock face.
    const attempt=season===1?[2*12,48/4,3*48/4]:layouts(rooms.find(r=>r.id===season).games[0]).find(a=>validaEstacion(season,id,a));
    const send=(uid,op,round,answer,payload)=>h.request(uid,{id,coop:{op,round,answer,partnerId:h.row.id},attempt:payload});
    const view=async uid=>(await h.request(uid)).coop;
    assert.equal((await view('ana')).role,'A');assert.equal((await view('bea')).role,'B');
    assert.deepEqual((await view('ana')).stations,{});
    const initial=(await send('ana','join')).coop.stations[id];
    assert.equal(initial.phase,'waiting');assert.equal(initial.card,undefined);
    const round=initial.round;
    await assert.rejects(send('ana','prepare',round,'1'),{status:409});
    await assert.rejects(send('ana','solve',round,null,attempt),{status:409});
    const b=(await send('bea','join',round)).coop.stations[id],a=(await view('ana')).stations[id];
    assert.equal(b.phase,'prepare');assert.notDeepEqual(a.card,b.card);assert.equal(a.card.answer,undefined);
    const answers=crossCards(a.card,b.card);
    assert.equal((await send('ana','prepare',round,'wrong')).correct,false);
    assert.equal((await send('ana','prepare',round,answers[0])).correct,true);
    await assert.rejects(send('ana','solve',round,null,attempt),{status:409});
    assert.equal((await send('bea','prepare',round,answers[1])).coop.stations[id].phase,'play');
    assert.equal((await send('bea','solve',round,null,[])).correct,false);
    const wins=await Promise.all([send('ana','solve',round,null,attempt),send('bea','solve',round,null,attempt)]);
    assert.deepEqual(wins.map(w=>w.awarded).sort(),[0,1]);
    for(const member of Object.values(h.accounts)){
      const receipts=member.valdemarSeasonOne.paid.entries;
      assert.equal(receipts.length,1);assert.equal(receipts[0].cooperative,true);assert.equal(receipts[0].amount,1);
    }
    assert.equal((await view('bea')).stations[id].phase,'solved');
    const replay=(await send('bea','replay',round)).coop.stations[id];
    assert.equal(replay.phase,'waiting');assert.notEqual(replay.round,round);
    await assert.rejects(send('ana','solve',round,null,attempt),{status:409});
    await send('ana','join',replay.round);
    const newAnswers=crossCards((await view('ana')).stations[id].card,(await view('bea')).stations[id].card);
    assert.notDeepEqual(newAnswers,answers);
    await send('ana','prepare',replay.round,newAnswers[0]);await send('bea','prepare',replay.round,newAnswers[1]);
    assert.equal((await send('bea','solve',replay.round,null,attempt)).awarded,0);
    assert.equal(h.row.progress.currentStage,3);
  }
});

test('retirarse invalida preparaciones antiguas; un permiso o vínculo cambiado impide acreditar a otras cuentas',async()=>{
  const h=harness(2),id='luces',send=(u,op,round,partnerId='vinculo')=>h.request(u,{id,coop:{op,round,partnerId,answer:'1'}});
  let round=(await send('ana','join')).coop.stations[id].round;
  await send('bea','join',round);const quit=(await send('bea','leave',round)).coop.stations[id];
  assert.notEqual(quit.round,round);assert.equal(quit.joined,false);assert.equal(quit.partnerJoined,true);
  await assert.rejects(send('bea','prepare',round),{status:409});round=quit.round;
  await assert.rejects(send('bea','join',round,'otro-vinculo'),{status:409});
  h.allowed.delete('bea');
  assert.equal((await h.request('ana')).coop,null);
  await assert.rejects(send('ana','prepare',round),{status:409});
  await assert.rejects(send('bea','join',round),{status:403});
  h.allowed.add('bea');h.row.status='pending';
  assert.equal((await h.request('ana')).coop,null);
  h.row.status='accepted';h.row.progress.consentVersion=1;
  assert.equal((await h.request('ana')).coop,null);
  h.row.progress.consentVersion=2;assert.equal((await h.request('ana',null,true)).coop,null);
  assert.deepEqual(h.accounts,{ana:{},bea:{}});
});
