import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {checkPuzzle} from '../progression.mjs';
const c=vm.createContext({crypto:globalThis.crypto,structuredClone});
for(const name of ['stories.js','season.js','engine.js','media-plan.js','evidence-design.js','scoring-guide.js'])vm.runInContext(await readFile(new URL('../public/'+name,import.meta.url),'utf8'),c);
const story=c.STORIES.find(s=>s.id==='cartas-medianoche'),artifacts=c.SEASON_MEDIA[story.id].artifacts;
test('Six sequential deductions are required and stage replays cannot skip or duplicate progress',()=>{
 let session=c.GameEngine.makeSession(story.id,[{userId:'tester'}],'solo');
 session=c.GameEngine.vote(session,'tester',session.nodeId,story.nodes[session.nodeId].choices[0].id,session.version).session;
 assert.equal(checkPuzzle(session,story,{answer:story.puzzle.answer},'tester').correct,false);
 assert.throws(()=>checkPuzzle(session,story,{stage:'informe',answer:story.puzzle.stages[5].answer},'tester'));
 for(const [i,stage] of story.puzzle.stages.entries()){
  assert.equal(checkPuzzle(session,story,{action:'hint',stage:stage.id},'tester').hints.length,1);
  assert.equal(checkPuzzle(session,story,{stage:stage.id,answer:'incorrecta'},'tester').correct,false);
  const result=checkPuzzle(session,story,{stage:stage.id,answer:stage.answer.toLowerCase()},'tester');
  assert.equal(result.correct,true);assert.equal(result.complete,i===5);assert.equal(!!session.investigation.solvedAt,i===5);
 }
 assert.equal(Object.keys(session.investigation.stages).length,6);
 assert.equal(checkPuzzle(session,story,{answer:'anything'},'tester').complete,true);
});

test('The blue ribbon clue belongs to the testimony; the letters and postal dictionary supply different evidence',()=>{
 assert.equal(story.revision,'cartas-60-v1');
 assert.doesNotMatch(artifacts[0].transcript,/azul|R2/i);
 assert.match(artifacts.find(a=>a.type==='video').transcript,/cinta azul, no gris/);
 assert.doesNotMatch(artifacts.find(a=>a.type==='video').transcript,/R2|VEN SIN DEBERME NADA/);
 assert.match(artifacts.find(a=>a.type==='website').transcript,/R2.*AZUL/);
 assert.doesNotMatch(artifacts.find(a=>a.type==='website').transcript,/llevaba una cinta azul|VEN SIN DEBERME NADA/);
 assert.equal(Object.keys(c.SEASON_MEDIA[story.id].finalDocuments).length,0);
 for(const key of c.GameEngine.KEYS)assert.ok(c.ScoringGuide.best(story,key).points>0,key);
 assert.doesNotMatch(JSON.stringify(story),/PDF|vídeo de apertura|grabación de apertura/i);
});
