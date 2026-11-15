import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {seasonProgress} from '../season-journey.mjs';
const ctx=createContext({structuredClone,crypto:globalThis.crypto});ctx.window=ctx;
for(const file of ['stories.js','season.js','engine.js','experience-ui.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),ctx);
test('La ruta coincide con todas las ramas reales de las trece historias y termina sin decisiones pendientes',()=>{
 for(const c of ctx.STORIES){
  const total=c.decisionCount||4;
  const walk=s=>{
   const markup=ctx.ExperienceUI.roadmap(s,c),done=s.history.length;
   assert.ok(done<=total,c.id+' supera su ruta');
   assert.match(markup,new RegExp('max="'+total+'" value="'+done+'"'));
   if(s.status==='finished'){assert.equal(done,total,c.id+' final prematuro');assert.match(markup,/Experiencia completada/);return;}
   assert.match(markup,new RegExp('decisión '+(done+1)+' de '+total));
   for(const choice of c.nodes[s.nodeId].choices)walk(ctx.GameEngine.vote(s,'a',s.nodeId,choice.id,s.version).session);
  };
  walk(ctx.GameEngine.makeSession(c.id,[{userId:'a',name:'A'}],'solo'));
 }
});
test('Un voto sin acuerdo no aumenta el roadmap y una espera no simula avance',()=>{
 const c=ctx.STORIES.find(s=>s.season===1),s=ctx.GameEngine.makeSession(c.id,[{userId:'a',name:'A'},{userId:'b',name:'B'}],'duo');
 const voted=ctx.GameEngine.vote(s,'a',s.nodeId,c.nodes[s.nodeId].choices[0].id,0).session;
 assert.equal(voted.history.length,0);assert.match(ctx.ExperienceUI.roadmap(voted,c),/5 decisiones pendientes/);
 const waiting=ctx.GameEngine.makeSession(c.id,[{userId:'a',name:'A'}],'duo');assert.match(ctx.ExperienceUI.roadmap(waiting,c),/Esperando a tu cómplice/);
});
test('La colección no cuenta estados falsos, partidas ajenas, repeticiones ni el prólogo',()=>{
 const c=ctx.STORIES.find(s=>s.season===1),fake={caseId:c.id,status:'finished',nodeId:'not-an-ending',members:[{userId:'a'}],history:[]};
 assert.equal(seasonProgress(ctx.STORIES,[fake],'a').completed,0);
 let s=ctx.GameEngine.makeSession(c.id,[{userId:'a',name:'A'}],'solo');while(s.status==='active')s=ctx.GameEngine.vote(s,'a',s.nodeId,c.nodes[s.nodeId].choices[0].id,s.version).session;
 assert.equal(seasonProgress(ctx.STORIES,[s,s],'a').completed,0);s.investigation={solvedAt:'2026-11-15T12:00:00Z'};assert.equal(seasonProgress(ctx.STORIES,[s,s],'a').completed,1);assert.equal(seasonProgress(ctx.STORIES,[s],'b').completed,0);
 const anonymous={stories:ctx.STORIES,sessions:[],journey:null,canPlay:false};
 const map=ctx.ExperienceUI.map(anonymous);assert.equal((map.match(/class="map-station /g)||[]).length,12);assert.match(map,/id="season-key"[^>]*disabled/);assert.doesNotMatch(map,/class="secret-epilogue"/);assert.doesNotMatch(map,/UMBRALOCULTO/);
 assert.match(ctx.ExperienceUI.detail(c,anonymous),/Ver suscripción/);assert.doesNotMatch(ctx.ExperienceUI.detail(c,anonymous),/data-action="setup"/);
});
