import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
const c=createContext({structuredClone,crypto:globalThis.crypto,document:{addEventListener(){}}});c.window=c;
for(const name of ['stories.js','season.js','engine.js','media-plan.js'])runInContext(await readFile(new URL('../public/'+name,import.meta.url),'utf8'),c);
for(const name of ['evidence-design.js','scoring-guide.js','media-review.js'])runInContext(await readFile(new URL('../web/'+name,import.meta.url),'utf8'),c);
test('Los máximos individuales coinciden con todas las rutas reales y todas las decisiones suman tres sin penalizar',()=>{
  for(const story of c.STORIES){
    const observed=Object.fromEntries(c.GameEngine.KEYS.map(k=>[k,0]));
    function visit(s){if(s.status==='finished'){for(const key of c.GameEngine.KEYS)observed[key]=Math.max(observed[key],s.members[0].scores[key]);return;}
      for(const choice of story.nodes[s.nodeId].choices){assert.equal(Object.values(choice.effects).reduce((a,b)=>a+b,0),3);assert.ok(Object.values(choice.effects).every(x=>x>=0));visit(c.GameEngine.vote(s,'test',s.nodeId,choice.id,s.version).session);}}
    visit(c.GameEngine.makeSession(story.id,[{userId:'test'}],'solo'));
    for(const key of c.GameEngine.KEYS)assert.equal(c.ScoringGuide.best(story,key).points,observed[key],story.id+':'+key);
    const html=c.ScoringGuide.panel(story,null,'test');assert.match(html,/Penalizaciones: ninguna/);assert.match(html,/Máximo del reto/);
  }
});
test('En pareja el máximo permite otra ruta acordada sin alterar los puntos de la primera preferencia',()=>{
  const story=c.STORIES[0],observed=Object.fromEntries(c.GameEngine.KEYS.map(k=>[k,0]));
  function visit(s){if(s.status==='finished'){for(const k of c.GameEngine.KEYS)observed[k]=Math.max(observed[k],s.members[0].scores[k]);return;}
    const choices=story.nodes[s.nodeId].choices;
    for(const first of choices)for(const agreed of choices){let next=c.GameEngine.vote(s,'a',s.nodeId,first.id,s.version).session;next=c.GameEngine.vote(next,'a',next.nodeId,agreed.id,next.version).session;next=c.GameEngine.vote(next,'b',next.nodeId,agreed.id,next.version).session;visit(next);}}
  visit(c.GameEngine.makeSession(story.id,[{userId:'a'},{userId:'b'}],'duo'));
  for(const key of c.GameEngine.KEYS)assert.equal(c.ScoringGuide.best(story,key,story.startNode,true).points,observed[key]);
});
test('Las trece experiencias tienen imágenes disponibles y audios WAV válidos',async()=>{
 for(const plan of [c.MEDIA_PLAN,...Object.values(c.SEASON_MEDIA)]){
 const visual=plan.artifacts.find(a=>a.type==='image');assert.ok(visual);if(plan.caseId==='cartas-medianoche')assert.equal((await readFile(new URL('../public'+visual.src,import.meta.url))).subarray(1,4).toString(),'PNG');else assert.match(await readFile(new URL('../public'+visual.src,import.meta.url),'utf8'),/<svg/);
 const audio=plan.artifacts.find(a=>a.type==='audio');if(!audio){assert.equal(plan.caseId,'cartas-medianoche');continue;}const bytes=await readFile(new URL('../public'+audio.src,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.ok(bytes.length>44);
 }
 const app=await readFile(new URL('../web/app.js',import.meta.url),'utf8');assert.ok(app.includes('<video controls playsinline'));assert.ok(app.includes('ScoringGuide.chips(v)'));
});
