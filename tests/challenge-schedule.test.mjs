import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChallengeSchedule,isChallengeAvailable} from '../challenge-schedule.mjs';
import {playPublished} from '../published-challenges.mjs';

test('daily and weekly editions open and close at Madrid midnight across clock changes',()=>{
  const daily=normalizeChallengeSchedule({kind:'daily',startsOn:'2026-03-29'});
  assert.equal(daily.endsOn,'2026-03-29');
  const live=(schedule,time)=>isChallengeAvailable({status:'published',schedule},Date.parse(time));
  assert.equal(live(daily,'2026-03-28T22:59:59Z'),false);
  assert.equal(live(daily,'2026-03-28T23:00:00Z'),true);
  assert.equal(live(daily,'2026-03-29T21:59:59Z'),true);
  assert.equal(live(daily,'2026-03-29T22:00:00Z'),false);
  const weekly=normalizeChallengeSchedule({kind:'weekly',startsOn:'2026-10-22'});
  assert.equal(weekly.endsOn,'2026-10-28');
  assert.equal(live(weekly,'2026-10-28T22:59:59Z'),true);
  assert.equal(live(weekly,'2026-10-28T23:00:00Z'),false);
});

test('events validate inclusive boundaries and withdrawal takes effect immediately',()=>{
  assert.throws(()=>normalizeChallengeSchedule({kind:'daily',startsOn:'2026-02-30'}),{status:400});
  assert.throws(()=>normalizeChallengeSchedule({kind:'event',startsOn:'2026-12-24',endsOn:'2026-12-23'}),{status:400});
  assert.throws(()=>normalizeChallengeSchedule({kind:'weekly'}),{status:400});
  const schedule=normalizeChallengeSchedule({kind:'event',startsOn:'2026-12-24',endsOn:'2027-01-02'});
  const time=Date.parse('2027-01-02T21:00:00Z');
  assert(isChallengeAvailable({status:'published',schedule},time));
  assert(!isChallengeAvailable({status:'draft',schedule},time));
  assert(!isChallengeAvailable({status:'withdrawn',schedule},time));
  assert(!isChallengeAvailable({status:'published',schedule},Date.parse('2027-01-02T23:00:00Z')));
  assert(isChallengeAvailable({status:'published'},time));
});

test('una edición fuera de plazo impide nuevas jugadas incluso con el formulario previamente abierto',async()=>{
  const id='d714fd23-156f-44ce-b43f-bd1731eeccab';
  const row={id,status:'published',caseId:1,revision:1,title:'Pista del muelle',prompt:'¿Dónde abre la llave?',
    options:['Muelle','Faro'],answer:0,explanation:'El grabado corresponde al muelle.'};
  const store={getMemberData:async()=>({}),lockChallenge:async()=>row,listChallenges:async()=>[row],
    saveMemberData:async()=>assert.fail('Una edición cerrada no debe escribir el saldo')};
  const play=input=>playPublished(store,{uid:'player',editorial:true,input});
  assert.equal((await play()).items.length,1);
  for(const startsOn of ['2001-08-22','2099-08-22']){
    row.schedule=normalizeChallengeSchedule({kind:'daily',startsOn});
    assert.deepEqual((await play()).items,[]);
    await assert.rejects(play({id,revision:1,index:0,option:0}),{status:404});
  }
});
