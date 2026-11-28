import test from 'node:test';
import assert from 'node:assert/strict';
import {createMansionRules,startMansion} from '../mansion-episode.mjs';
import {mansionFixture} from './mansion-fixture.mjs';

// A made-up two-part mechanism for the shared engine, independent of the published mysteries.
const edition=structuredClone(mansionFixture);
const first=edition.levels[0];
first.controls=[{id:'tension',label:'Left crank'},{id:'escala',label:'Right scale'}];
first.solution={tension:'left test',escala:'right test'};
first.contributions={
  A:{objective:'Tension the initial line',controlIds:['tension'],feedback:'Check the notch on the crank.',success:'The line is taut.'},
  B:{objective:'Read the moving scale',controlIds:['escala'],feedback:'Check the scale.',success:'The scale holds.'}
};
const well=edition.levels[2];
well.well={target:2};
well.actions[2].id='atar';
well.actions.push({id:'pescar',label:'Catch the sample',role:'both',needs:['pair']});
well.requires=['pescar'];
const {applyMansion,inspectMansion,mansionHint}=createMansionRules(edition);
const status=n=>error=>error.status===n;
const submit=(record,role,world,answers,stage=1)=>applyMansion(record,role,{op:'solve',stage,world,answers});

test('cada papel conserva su propia decisión y el segundo acierto completa la prueba una sola vez',()=>{
  let record={};
  const a=inspectMansion(record,'A').stage,b=inspectMansion(record,'B').stage;
  assert.deepEqual(a.controls.map(c=>c.id),['tension']);
  assert.deepEqual(b.controls.map(c=>c.id),['escala']);
  assert.equal(a.contributions.B.objective,undefined);
  assert.doesNotMatch(mansionHint(record,'solution','A'),/right test/);
  assert.equal(submit(record,'A','A',{tension:'left test',escala:'right test'}).correct,false);
  assert.throws(()=>submit(record,'A','B',{escala:'right test'}),status(403));
  assert.equal(submit(record,'A','A',{tension:'wrong'}).message,first.contributions.A.feedback);
  assert.equal(submit(record,'A','A',{tension:'left test'}).stageCompleted,undefined);
  record=structuredClone(record);
  assert.equal(record.mansion.current,1);
  assert.equal(inspectMansion(record,'B').stage.contributions.A.done,true);
  assert.equal(submit(record,'A','A',{tension:'left test'}).changed,false);
  assert.equal(submit(record,'B','B',{escala:'right test'}).stageCompleted,1);
  assert.equal(submit(record,'B','B',{escala:'right test'}).changed,false);
  assert.equal(record.mansion.revision,2);
});

test('una persona alterna los dos mandos y una partida previa mantiene su posición',()=>{
  const previous={};startMansion(previous);
  const controls=inspectMansion(previous,'solo').stage.controls;
  assert.deepEqual(controls.map(c=>c.role),['A','B']);
  assert.throws(()=>submit(previous,'solo',undefined,{tension:'left test'}),status(400));
  assert.equal(submit(previous,'solo','B',{escala:'right test'}).correct,true);
  assert.equal(submit(previous,'solo','A',{tension:'left test'}).stageCompleted,1);
  assert.equal(inspectMansion(previous).current,2);
});

test('el cuaderno conserva los hallazgos visitados y los filtra por casa',()=>{
  let record={};startMansion(record);
  const a=inspectMansion(record,'A'),b=inspectMansion(record,'B');
  const clue=a.stage.evidence[0];
  const observe=(world,id,roomId)=>applyMansion(record,'A',{op:'observe',world,stage:1,evidenceId:id,roomId});
  assert.deepEqual(a.notebook,[]);
  assert.throws(()=>observe('B',b.stage.evidence[0].id,first.room),status(403));
  assert.throws(()=>observe('A',b.stage.evidence[0].id,first.room),status(403));
  assert.throws(()=>observe('A',clue.id,'distant-room'),status(404));
  assert.ok(observe('A',clue.id,first.room).changed);
  assert.equal(observe('A',clue.id,first.room).changed,false);
  record=structuredClone(record);record.mansion.current=2;
  assert.equal(inspectMansion(record,'A').notebook[0].id,clue.id);
  assert.deepEqual(inspectMansion(record,'B').notebook,[]);
});

test('el pozo conserva la altura, distingue las dos casas y respeta una llave recuperada previamente',()=>{
  const record={};startMansion(record).current=3;
  const act=(role,action,depth)=>applyMansion(record,role,{op:'act',stage:3,action,depth});
  assert.equal(act('A','profundidad',2).changed,false);
  act('A','pick-a');act('B','pick-b');act('A','atar');
  assert.throws(()=>act('B','profundidad',2),status(403));
  assert.throws(()=>act('A','profundidad',4),status(400));
  assert.ok(act('A','profundidad',1).changed);
  assert.equal(inspectMansion(record,'B').stage.wellReach,'above');
  assert.equal(inspectMansion(record,'A').stage.wellMark,undefined);
  assert.equal(act('B','pescar').changed,false);
  assert.ok(act('A','profundidad',2).changed);
  assert.equal(inspectMansion(structuredClone(record),'B').stage.wellReach,'at');
  assert.throws(()=>act('A','pescar'),status(403));
  assert.ok(act('B','pescar').changed);
  delete record.mansion.wellDepth;
  assert.equal(act('B','pescar').changed,false);
  assert.equal(submit(record,'A','A',well.solution,3).stageCompleted,3);
});
