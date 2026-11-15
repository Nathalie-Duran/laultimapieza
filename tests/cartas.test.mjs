import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {checkPuzzle} from '../progression.mjs';
const c=vm.createContext({crypto:globalThis.crypto,structuredClone});
for(const name of ['stories.js','season.js','engine.js','media-plan.js','evidence-design.js','scoring-guide.js'])vm.runInContext(await readFile(new URL('../public/'+name,import.meta.url),'utf8'),c);
const story=c.STORIES.find(s=>s.id==='cartas-medianoche'),artifacts=c.SEASON_MEDIA[story.id].artifacts;
test('Seven sequential deductions are required and stage replays cannot skip or duplicate progress',()=>{
 let session=c.GameEngine.makeSession(story.id,[{userId:'tester'}],'solo');
 session=c.GameEngine.vote(session,'tester',session.nodeId,story.nodes[session.nodeId].choices[0].id,session.version).session;
 assert.equal(checkPuzzle(session,story,{answer:story.puzzle.answer},'tester').correct,false);
 assert.throws(()=>checkPuzzle(session,story,{stage:'informe',answer:story.puzzle.stages[5].answer},'tester'));
 for(const [i,stage] of story.puzzle.stages.entries()){
  while(session.history.length<(stage.requiredDecisions||0))session=c.GameEngine.vote(session,'tester',session.nodeId,story.nodes[session.nodeId].choices[0].id,session.version).session;
  assert.equal(checkPuzzle(session,story,{action:'hint',stage:stage.id},'tester').hints.length,1);
  assert.equal(checkPuzzle(session,story,{stage:stage.id,answer:'incorrecta'},'tester').correct,false);
  const result=checkPuzzle(session,story,{stage:stage.id,answer:stage.answer.toLowerCase()},'tester');
  assert.equal(result.correct,true);assert.equal(result.complete,i===6);assert.equal(!!session.investigation.solvedAt,i===6);
 }
 assert.equal(Object.keys(session.investigation.stages).length,7);
 assert.equal(checkPuzzle(session,story,{answer:'anything'},'tester').complete,true);
});

test('Seven complementary role-based puzzles replace the old videos',()=>{
 assert.equal(story.revision,'cartas-cooperativo-7');assert.equal(story.puzzle.stages.length,7);assert.equal(artifacts.length,0);
 for(const p of story.puzzle.stages){assert.ok(p.clues.A.length);assert.ok(p.clues.B.length);assert.notDeepEqual(p.clues.A,p.clues.B);assert.equal(p.hints.length,3);assert.ok(p.skills.length>=2);}
 for(const key of c.GameEngine.KEYS)assert.ok(c.ScoringGuide.best(story,key).points>0,key);
});
