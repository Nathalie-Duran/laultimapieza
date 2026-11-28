import test from 'node:test';
import assert from 'node:assert/strict';
import {createMansionRules,MANSION_MISSION_REWARDS,startMansion} from '../mansion-episode.mjs';
import {mansionFixture as sample} from './mansion-fixture.mjs';

const {inspectMansion,applyMansion,mansionHint}=createMansionRules(sample);
const solve=(record,answers,role='solo',mission)=>applyMansion(record,role,{op:'solve',stage:record.mansion.current,answers,...(mission?{mission}:{})});
const act=(record,role,action)=>applyMansion(record,role,{op:'act',stage:record.mansion.current,action});
const status=code=>error=>error.status===code;

test('el telégrafo contrasta los pulsos y la clave de la edición, sin exponerlos al otro papel',()=>{
  const edition=structuredClone(sample),level=edition.levels[11];
  level.controls=[{id:'llamada',type:'code',label:'Lectura'}];
  level.evidence=[{role:'A',title:'Emisión',signal:'.- / -... / .',text:'Escucha los grupos.'},
    {role:'B',title:'Código',text:'A ·–; B –···; E ·.'}];
  level.solution={llamada:'ABE'};
  const game=createMansionRules(edition),record={};startMansion(record).current=12;
  const send=answers=>game.applyMansion(record,'A',{op:'solve',stage:12,answers});
  assert.equal(game.inspectMansion(record,'B').stage.evidence.some(clue=>clue.signal),false);
  for(const answers of [{llamada:'AEB'},{llamada:'ABE',extra:'x'},{llamada:['ABE']}]){
    assert.equal(send(answers).correct,false);
    assert.equal(record.mansion.current,12);
  }
  assert.equal(send({llamada:'  Ábe '}).correct,true);
  assert.equal(record.mansion.current,13);
});

test('el motor requiere una edición y solo muestra los datos de la realidad, sala y etapa disponibles',()=>{
  assert.throws(()=>createMansionRules({}),status(503));
  const record={};
  assert.equal(inspectMansion(record).stage.evidence.length,2);
  assert.equal(record.mansion,undefined);
  for(const role of ['A','B']){
    const view=inspectMansion(record,role);
    assert.equal(view.rooms.length,8);
    assert.equal(view.rooms.filter(r=>r.unlocked).length,1);
    assert.ok(view.stage.evidence.every(e=>e.role===role));
    assert.ok(view.explore.evidence.every(e=>e.role===role));
    assert.deepEqual(Object.keys(view.recordings),['carta']);
    assert.doesNotMatch(JSON.stringify(view),/test-1"|Sample first hint|"solution"|Test ending/);
  }
  assert.throws(()=>inspectMansion(record,'A','room-7'),status(409));
  assert.throws(()=>inspectMansion(record,'visitor'),status(403));
  assert.throws(()=>applyMansion(record,'A',{op:'solve',stage:4,answers:{token:'test-4'}}),status(409));
});

function play(roles){
  let record={other:'persists'};
  startMansion(record);
  for(const [index,level] of sample.levels.slice(0,14).entries()){
    const n=index+1,solo=roles.length===1;
    const player=roles[index%roles.length];
    const view=inspectMansion(record,player);
    assert.equal(view.current,n);
    assert.equal(view.stage.hints,undefined);
    assert.deepEqual(view.stage.evidence.map(e=>e.role),solo?['A','B']:[player]);
    assert.equal(Boolean(view.recordings.radio),n>=12);
    assert.equal(Boolean(view.stage.recording),n===12);
    assert.equal(view.recordings.final,undefined);
    assert.equal(mansionHint(record,'open',player),sample.hints[index][0]);
    assert.equal(mansionHint(record,'second',player),sample.hints[index][1]);
    assert.equal(mansionHint(record,'solution',player),sample.explanations[index]);
    if(n===3){
      assert.equal(solve(record,level.solution,player).changed,false);
      assert.equal(act(record,player,'join').changed,false);
      if(!solo)assert.throws(()=>act(record,'B','pick-a'),status(403));
      assert.ok(act(record,solo?'solo':'A','pick-a').changed);
      assert.equal(act(record,solo?'solo':'A','pick-a').changed,false);
      assert.ok(act(record,solo?'solo':'B','pick-b').changed);
      assert.ok(act(record,player,'join').changed);
      assert.deepEqual(inspectMansion(record).inventory.map(item=>item.id),['pair']);
    }
    assert.equal(solve(record,{token:'wrong'},player).changed,false);
    assert.equal(solve(record,level.solution,player).stageCompleted,n);
    record=JSON.parse(JSON.stringify(record));
    startMansion(record);
  }
  const first=roles[0],second=roles.at(-1);
  assert.equal(mansionHint(record,'solution',first),first==='A'?sample.panelHints.A:sample.panelHints.A+' '+sample.panelHints.B);
  if(first==='A')assert.throws(()=>solve(record,{panel:'B',secuencia:'test-B'},first),status(403));
  assert.ok(solve(record,{panel:'A',secuencia:'test-A'},first).changed);
  record=JSON.parse(JSON.stringify(record));
  assert.deepEqual(inspectMansion(record,second).stage.panelStatus,{A:true,B:false});
  assert.equal(solve(record,{panel:'A',secuencia:'test-A'},first).changed,false);
  assert.equal(solve(record,{panel:'B',secuencia:'test-B'},second).completed,true);
  const ending=inspectMansion(record);
  assert.ok(ending.completed);
  assert.equal(ending.ending.recording.text,sample.recordings.final.text);
  assert.deepEqual(Object.keys(ending.recordings),['carta','radio','final']);
  assert.equal(record.other,'persists');
  return record;
}
test('las dos realidades se completan en pareja con inventario y confirmaciones persistentes',()=>{play(['A','B']);});
test('en solitario las cuatro misiones siguen disponibles después del desenlace y premian una sola vez',()=>{
  const record=play(['solo']);
  assert.deepEqual(MANSION_MISSION_REWARDS,{nox:1,diario:1,jardin:1,puerta:2});
  for(const quest of sample.sideQuests){
    const view=inspectMansion(record).missions.find(m=>m.id===quest.id);
    assert.ok(view.available);
    assert.deepEqual(view.evidence.map(e=>e.role),['A','B']);
    assert.equal(solve(record,quest.solution,'solo',quest.id).missionReward,MANSION_MISSION_REWARDS[quest.id]);
    assert.equal(solve(record,quest.solution,'solo',quest.id).changed,false);
  }
  assert.equal(inspectMansion(record).album.length,7);
});
