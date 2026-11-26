import assert from 'node:assert/strict';
import test from 'node:test';
import {valdemarRequest} from '../valdemar-api.mjs';

// Small authored fixture independent of the encrypted edition.
const modes = ['single','multi','order','single','multi'];
const stages = modes.map((mode,i) => ({title:'Scene '+i,place:'Studio '+i,minutes:12,brief:'Intro '+i,
  materials:[{id:'art',label:'Plate',kind:'visual',body:'drawing '+i,role:'AB'}],
  task:'Inspect '+i,mode,options:['a','b','c'].map(id => ({id,label:'Item '+id})),
  answer:mode==='single' ? ['b'] : ['c','a'],retry:'Try '+i,success:'Solved '+i}));

function service({seed={},withHour=true}={}) {
  let data=structuredClone(seed),writes=0,lock=Promise.resolve();
  const store={async getMemberData(){return structuredClone(data);},async saveMemberData(_,value){data=structuredClone(value);writes++;}};
  const story={id:2,title:'Studio',evidenceCards:[],hypotheses:[{id:'a',label:'First'}],correctHypothesis:'a',
    deduction:'Explanation',choices:[{id:'b',label:'Second'},{id:'c',label:'Third'}],hints:[],outcomes:{b:'End',c:'Other'},
    ...(withHour?{hour:{stages}}:{})};
  function req(action,input,overrides={}) {
    return valdemarRequest({path:'/api/valdemar/cases/2'+(action?'/'+action:''),method:action?'POST':'GET',input,uid:'sample',editorial:true,
      loadRelease:async()=>({stories:[story],samples:[]}),withStore(fn){const result=lock.then(()=>fn(store));lock=result.catch(()=>{});return result;},...overrides});
  }
  return {req,writes:()=>writes,data:()=>data};
}

test('a case exposes only its current investigation and public phase outline',async()=>{
  const {req}=service();const {hour}=await req();
  assert.equal(hour.current,0);assert.equal(hour.stages.length,5);assert.deepEqual(hour.journal,[]);
  assert.equal(hour.stage.mode,'single');assert.equal(hour.stage.materials[0].body,'drawing 0');
  for(const field of ['answer','retry','success'])assert(!Object.hasOwn(hour.stage,field));
  assert(!JSON.stringify(hour).includes('drawing 1'));
  await assert.rejects(req('stage',{index:2,choice:['c','a']}),e=>e.code==='HOUR_STAGE_CHANGED');
  await assert.rejects(req('deduce',{hypothesis:'a'}),e=>e.code==='HOUR_STAGES_REQUIRED');
});

test('correct retries advance exactly once and keep old case and wallet data',async()=>{
  const {req,writes,data}=service({seed:{old:'unchanged'}});
  const input={index:0,choice:['b']};const [a,b]=await Promise.all([req('stage',input),req('stage',input)]);
  assert(a.correct&&b.correct);assert.deepEqual(a,b);assert.equal(writes(),1);assert.equal(data().old,'unchanged');
  assert.equal(a.hour.journal[0].materials[0].body,'drawing 0');assert.equal(a.hour.journal[0].success,'Solved 0');
  assert(!('answer' in a.hour.journal[0]));assert(!JSON.stringify(a.hour).includes('drawing 2'));
  assert.equal((await req()).hour.current,1);
});

test('set and ordered puzzles have different validation and cannot be skipped',async()=>{
  const {req}=service();
  for(const choice of [[],['b','b'],['outside'],[{}],['a','b'],null]) await assert.rejects(req('stage',{index:0,choice}),e=>e.status===400);
  const wrong=await req('stage',{index:0,choice:['a']});assert.equal(wrong.correct,false);assert.equal(wrong.hour.current,0);
  await req('stage',{index:0,choice:['b']});
  assert.equal((await req('stage',{index:1,choice:['a','c']})).correct,true);
  assert.equal((await req('stage',{index:2,choice:['a','c']})).correct,false);
  for(const index of [2,3,4])await req('stage',{index,choice:stages[index].answer});
  const {hour}=await req();assert.equal(hour.current,5);assert.equal(hour.stage,null);assert.equal(hour.journal.length,5);
  assert.equal((await req('deduce',{hypothesis:'a'})).correct,true);assert.equal((await req('ending',{choice:'b'})).progress.outcome,'End');
  await assert.rejects(req('ending',{choice:'c'}),e=>e.code==='ENDING_SAVED');
});

test('legacy albums are readable and unfinished older deductions cannot close early',async()=>{
  const seed={valdemarCaseProgress:{editorial:{2:{deduced:true,choice:'b'}}}};
  const saved=service({seed});const shown=await saved.req();assert.equal(shown.progress.outcome,'End');
  assert.equal(shown.hour.current,5);assert.deepEqual(shown.hour.journal,[]);assert.equal((await saved.req('ending',{choice:'b'})).progress.outcome,'End');
  delete seed.valdemarCaseProgress.editorial[2].choice;const unfinished=service({seed});
  await assert.rejects(unfinished.req('ending',{choice:'b'}),e=>e.code==='HOUR_STAGES_REQUIRED');
  const oldBundle=service({withHour:false});assert.equal((await oldBundle.req()).hour,null);
  assert((await oldBundle.req('deduce',{hypothesis:'a'})).correct);assert.equal((await oldBundle.req('ending',{choice:'b'})).progress.outcome,'End');
});

test('stages respect monthly access and do not expose an unreleased case',async()=>{
  const {req}=service();await assert.rejects(req('stage',{index:0,choice:['b']},{editorial:false,
    billing:{async membership(){return {canPlay:true,calendar:{unlockedCaseIds:[]}};}}}),e=>e.code==='CASE_NOT_RELEASED');
});
