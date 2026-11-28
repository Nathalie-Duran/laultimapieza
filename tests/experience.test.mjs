import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {seasonProgress} from '../season-journey.mjs';
const ctx=createContext({structuredClone,crypto:globalThis.crypto});ctx.window=ctx;
test('Cada ficha pública de Valdemar enlaza la demo con el caso de procedencia',async()=>{
  const catalog=createContext({});catalog.window=catalog;
  runInContext(await readFile(new URL('../web/valdemar-catalog.js',import.meta.url),'utf8'),catalog);
  for(const item of catalog.ValdemarCatalog.items){
    const code=String(item.id).padStart(2,'0');
    const page=catalog.ValdemarCatalog.detail(item.id,{});
    assert.ok(page.includes('href="/cinta-87.html?caso='+code+'"'),item.title);
    assert.doesNotMatch(page,/data-action="preview-open"/);
  }
});
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

test('La promoción clásica presenta los doce casos y solo invita a la demo de La cinta 87',()=>{
 const model={stories:ctx.STORIES,sessions:[],canPlay:false};
 const retired=ctx.STORIES.find(s=>s.id==='habitacion-309');
 for(const catalogMonth of [1,2,3]){
   const html=ctx.ExperienceUI.catalog({...model,catalogMonth});
   assert.equal((html.match(/class="shelf-card /g)||[]).length,4);
   assert.match(html,/La cinta 87/);
   assert.doesNotMatch(html,/habitaci[oó]n[ -]309|Bellamar|Caso adicional/i);
 }
 for(const html of [ctx.ExperienceUI.map(model),ctx.ExperienceUI.invitation(retired,model),ctx.ExperienceUI.detail(retired,model)]){
   assert.doesNotMatch(html,/habitaci[oó]n[ -]309|Bellamar|Caso adicional/i);
 }
});

test('el mapa clásico y su llamada a continuar describen la misma partida al haber varios intentos',()=>{
 const story=ctx.STORIES.find(item=>item.season===1),members=[{userId:'a'}];
 const pending={id:'desenlace',caseId:story.id,members,status:'finished',history:Array(5).fill({}),nodeId:Object.keys(story.endings)[0]};
 const running={id:'activa',caseId:story.id,members,status:'active',history:[],nodeId:story.startNode};
 const single=seasonProgress(ctx.STORIES,[pending],'a');
 const both=seasonProgress(ctx.STORIES,[pending,running],'a'),pick=both.stops.find(stop=>stop.caseId===story.id);
 assert.equal(pick.sessionId,running.id);assert.equal(pick.status,'in_progress');
 const model={stories:ctx.STORIES,sessions:[pending,running],canPlay:true,userId:'a'};
 assert.match(ctx.ExperienceUI.detail(story,{...model,journey:single}),/data-id="desenlace">Resolver el enigma pendiente/);
 assert.match(ctx.ExperienceUI.detail(story,{...model,journey:both}),/data-id="activa">Continuar/);
});

test('La portada lleva al mapa de cada territorio y ofrece una sola entrada a la demo y a la carta',()=>{
 const model={stories:ctx.STORIES,sessions:[],canPlay:false};
 const front=ctx.ExperienceUI.home(model);
 for(const world of ['mapa','expedicion','umbravia','necropolis']){
   assert.equal(front.split('href="/#'+world+'"').length-1,1);
 }
 assert.equal(front.split('data-action="preview-open"').length-1,1);
 assert.equal(front.split('El secreto de los dos mundos').length-1,1);
 assert.equal(front.split('href="/#planes"').length-1,1);
 assert.doesNotMatch(front,/Hotel Medianoche|Frecuencia 23:17/);
});

test('la oferta inicial cambia según apertura o acceso y la demo conserva su enlace de continuación',()=>{
 const model={stories:ctx.STORIES,sessions:[],canPlay:false};
 try{
   ctx.ClubAccess={salesState:'waitlist',price:'29,95 €'};
   let html=ctx.ExperienceUI.home(model);
   assert.match(html,/<h1[^>]*>Cuatro juegos de misterio al mes<\/h1>/);
   assert.match(html,/href="\/#alta-club">Avisarme cuando abra/);
   assert.match(html,/29,95 €/);
   ctx.ClubAccess.salesState='open';
   ctx.CasePreview={hasProgress:()=>true};
   html=ctx.ExperienceUI.home(model);
   assert.match(html,/href="\/#planes">Ver la suscripción/);
   assert.match(html,/data-home-demo-label>Continuar la demo/);
   html=ctx.ExperienceUI.home({...model,canPlay:true});
   assert.match(html,/href="\/#casos">Elegir un juego/);
   assert.doesNotMatch(html,/Avisarme cuando abra|Ver la suscripción/);
   ctx.ClubAccess.salesState='unknown';
   assert.match(ctx.ExperienceUI.home(model),/href="\/#planes">Ver la suscripción/);
 }finally{delete ctx.ClubAccess;delete ctx.CasePreview;}
});
