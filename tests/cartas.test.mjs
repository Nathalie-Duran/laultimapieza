import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {checkPuzzle} from '../progression.mjs';
const c=vm.createContext({crypto:globalThis.crypto,structuredClone});
for(const name of ['stories.js','season.js','engine.js','media-plan.js','evidence-design.js','scoring-guide.js'])vm.runInContext(await readFile(new URL('../public/'+name,import.meta.url),'utf8'),c);
const story=c.STORIES.find(s=>s.id==='cartas-medianoche'),artifacts=c.SEASON_MEDIA[story.id].artifacts;
test('Cartas requires the message and the intended route; the old message and actual storage are insufficient',()=>{
 let session=c.GameEngine.makeSession(story.id,[{userId:'tester'}],'solo');
 for(let i=0;i<2;i++)session=c.GameEngine.vote(session,'tester',session.nodeId,story.nodes[session.nodeId].choices[0].id,session.version).session;
 assert.equal(checkPuzzle(session,story,{answer:'VEN SIN DEBERME NADA'},'tester').correct,false);
 assert.equal(checkPuzzle(session,story,{answer:'VEN SIN DEBERME NADA | E4'},'tester').correct,false);
 assert.equal(checkPuzzle(session,story,{answer:'ven sin deberme nada | r2'},'tester').correct,true);
});
test('The blue ribbon clue belongs to the testimony; the letters and postal dictionary supply different evidence',()=>{
 assert.equal(story.revision,'cartas-2');
 assert.doesNotMatch(artifacts[0].transcript,/azul|R2/i);
 assert.match(artifacts.find(a=>a.type==='video').transcript,/cinta azul, no gris/);
 assert.doesNotMatch(artifacts.find(a=>a.type==='video').transcript,/R2|VEN SIN DEBERME NADA/);
 assert.match(artifacts.find(a=>a.type==='website').transcript,/R2.*AZUL/);
 assert.doesNotMatch(artifacts.find(a=>a.type==='website').transcript,/llevaba una cinta azul|VEN SIN DEBERME NADA/);
 assert.equal(Object.keys(c.SEASON_MEDIA[story.id].finalDocuments).length,0);
 for(const key of c.GameEngine.KEYS)assert.ok(c.ScoringGuide.best(story,key).points>0,key);
 assert.doesNotMatch(JSON.stringify(story),/PDF|vídeo de apertura|grabación de apertura/i);
});
