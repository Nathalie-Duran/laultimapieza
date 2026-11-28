import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarEditions} from '../calendar-challenges.mjs';
import {playPublished} from '../published-challenges.mjs';

const at=(value)=>Date.parse(value);
const schedule=(date,kind)=>calendarEditions(at(date)).find(item=>item.schedule.kind===kind);
test('el título semanal permite buscar la valija sin revelar la sala de destino',()=>{
  const destinations=new Set();
  for(let week=0;week<53;week++){
    const atNoon=at('2026-01-05T12:00Z')+week*7*86400000;
    const weekly=calendarEditions(atNoon).find(item=>item.schedule.kind==='weekly');
    const room=weekly.options[weekly.answer].replace(/^Sala /,'');
    destinations.add(room);
    assert.equal(weekly.title.includes(room),false);
  }
  assert.equal(destinations.size,4);
});
test('las ediciones diarias, semanales y estacionales siguen el calendario de Madrid',()=>{
  assert.equal(schedule('2026-10-30T22:59Z','event'),undefined);
  assert.equal(schedule('2026-10-30T23:00Z','event').schedule.startsOn,'2026-10-31');
  assert.equal(schedule('2026-10-31T23:00Z','event'),undefined);
  assert.equal(schedule('2026-12-23T22:59Z','event'),undefined);
  const christmas=schedule('2026-12-23T23:00Z','event');
  assert.equal(christmas.id,schedule('2026-12-25T22:59Z','event').id);
  assert.equal(christmas.schedule.endsOn,'2026-12-25');
  assert.equal(schedule('2026-12-25T23:00Z','event'),undefined);
  assert.notEqual(christmas.id,schedule('2027-12-24T12:00Z','event').id);
  const a='2026-03-29T21:59Z',b='2026-03-29T22:00Z';
  for(const kind of ['daily','weekly'])assert.notEqual(schedule(a,kind).id,schedule(b,kind).id);
  assert.equal(schedule(b,'weekly').schedule.startsOn,'2026-03-30');
});

test('el calendario admite pausas, verifica cada prueba, premia una vez y conserva las llaves al caducar',async()=>{
  const now=at('2026-10-31T12:00Z');
  let data={};
  const store={getMemberData:async()=>structuredClone(data),saveMemberData:async(_uid,next)=>{data=next;}};
  const billing={membership:async()=>({seasonAccess:{availableCases:[1,2,3,4]}})};
  const play=(input,when=now,editorial=false)=>playPublished(store,{uid:'persona',billing,editorial,calendar:true,now:when,input});
  const list=await play();
  assert.deepEqual(list.items.map(i=>i.prize),[1,2,2]);
  assert.ok(list.items.every(i=>!('answer' in i)&&!('steps' in i)&&!('explanation' in i)));
  for(const privateRow of calendarEditions(now)){
    const post=(index,option)=>({id:privateRow.id,revision:1,index,option});
    const stages=[privateRow,...privateRow.steps];
    if(stages.length>1)await assert.rejects(play(post(1,0)),{status:409});
    for(const [i,stage] of stages.entries()){
      assert.equal((await play(post(i,(stage.answer+1)%stage.options.length))).correct,false);
      assert.equal((await play(post(i,stage.answer))).correct,true);
      assert.equal((await play()).items.find(item=>item.id===privateRow.id).index,Math.min(i+1,stages.length-1));
    }
    await play(post(stages.length-1,stages.at(-1).answer));
  }
  assert.equal(data.valdemarSeasonOne.paid.entries.reduce((sum,e)=>sum+e.amount,0),5);
  assert.ok((await play()).items.every(i=>i.solved));
  assert.ok((await play(undefined,now,true)).items.every(i=>!i.solved));
  const old=list.items[0],later=at('2027-02-16T12:00Z');
  await assert.rejects(play({id:old.id,revision:1,index:0,option:0},later),{status:404});
  const saved=structuredClone(data);
  assert.ok((await play(undefined,later)).items.every(i=>!i.solved));
  assert.deepEqual(data,saved);
  const blocked=await playPublished(store,{uid:'sinpase',billing:{membership:async()=>({seasonAccess:{availableCases:[]}})},calendar:true,now});
  assert.deepEqual(blocked.items,[]);
});
