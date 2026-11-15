import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {createIdentityVerifier,ApiError} from '../auth-provider.mjs';
import {createGameApi} from '../game-api.mjs';
import {isAdministrator} from '../admin-access.mjs';


const config={apiKey:'test-key',authDomain:'test-project.firebaseapp.com',projectId:'test-project',appId:'test-app'};
const context=createContext({structuredClone,crypto:globalThis.crypto});
for(const file of ['stories.js','season.js','engine.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
const engine=context.GameEngine,stories=context.STORIES;
function fakeStore(){
  const profiles=new Map(),sessions=new Map(),rewards=new Map(),memberData=new Map();
  return {
    profiles,sessions,rewards,
    async getMemberData(uid){return structuredClone(memberData.get(uid)||{});},
    async saveMemberData(uid,data){memberData.set(uid,structuredClone(data));},
    async getSeasonSolved(uid,season){return rewards.get(uid+':'+season)||null;},
    async saveSeasonSolved(uid,season){const key=uid+':'+season;if(!rewards.has(key))rewards.set(key,new Date().toISOString());},
    async ensureProfile(user){if(!profiles.has(user.userId))profiles.set(user.userId,{...user,color:'#b1846b'});return structuredClone(profiles.get(user.userId));},
    async getProfile(uid){return structuredClone(profiles.get(uid));},
    async updateProfile(uid,name,color){Object.assign(profiles.get(uid),{name,color});return this.getProfile(uid);},
    async setActive(uid,id){profiles.get(uid).activeSessionId=id;},
    async listSessions(uid){return [...sessions.values()].map(r=>structuredClone(r.session)).filter(s=>s.members.some(m=>m.userId===uid));},
    async getSession(id){return sessions.has(id)?structuredClone(sessions.get(id)):null;},
    async findInvite(hash){return structuredClone([...sessions.values()].find(r=>r.inviteHash===hash)||null);},
    async insertSession(session){sessions.set(session.id,{session:structuredClone(session)});},
    async addMember(){},
    async saveSession(session){sessions.get(session.id).session=structuredClone(session);},
    async setInvite(id,inviteHash,inviteUntil){Object.assign(sessions.get(id),{inviteHash,inviteUntil});}
  };
}
function harness(authorizePlay=async()=>true){
  const store=fakeStore();
  const api=createGameApi({config,engine,stories,authorizePlay,origins:['https://example.test'],withStore:fn=>fn(store),verify:async request=>{
    const id=request.headers.get('authorization');if(!['alice','bob','eve'].includes(id))throw new ApiError(401,'Inicia sesión.');return {userId:id,name:id};
  }});
  const call=async (uid,path,body,method,origin='https://example.test')=>{
    const response=await api(new Request('https://example.test'+path,{method:method||(body?'POST':'GET'),headers:{authorization:uid||'',origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
    return {status:response.status,body:await response.json(),headers:response.headers};
  };
  return {store,call,api};
}

test('El plano solo revela piezas de casos terminados por la cuenta y exige doce experiencias distintas',async()=>{
  const {store,call}=harness();
  await call('alice','/api/bootstrap');
  const finish=story=>{let s=engine.makeSession(story.id,[{userId:'alice',name:'Alice'}],'solo');while(s.status==='active')s=engine.vote(s,'alice',s.nodeId,story.nodes[s.nodeId].choices[0].id,s.version).session;if(story.puzzle)s.investigation={solvedAt:new Date().toISOString(),hints:0,attempts:1};return s;};
  const season=stories.filter(s=>s.season===1);
  const first=finish(season[0]);await store.insertSession(first);await store.insertSession(finish(season[0]));await store.insertSession(finish(stories[0]));
  const one=(await call('alice','/api/season')).body.journey;
  assert.equal(one.completed,1);assert.equal(one.stops.filter(s=>s.letter).length,1);assert.equal(one.stops[0].letter,'U');
  assert.equal((await call('alice','/api/season/solve',{key:'UMBRALOCULTO',completed:12,solvedAt:'fake'})).status,409);
  assert.equal((await call('bob','/api/season')).body.journey.completed,0);
  assert.equal((await call('','/api/season')).status,401);
  for(const story of season.slice(1))await store.insertSession(finish(story));
  const full=(await call('alice','/api/bootstrap')).body.journey;
  assert.equal(full.completed,12);assert.equal(full.solvedAt,null);
  const letters=full.stops.map(s=>s.letter);assert.equal([0,4,8,1,5,9,2,6,10,3,7,11].map(i=>letters[i]).join(''),'UMBRALOCULTO');
  assert.equal((await call('alice','/api/season/solve',{key:'incorrecta'})).status,400);
  const solved=await call('alice','/api/season/solve',{key:' umbral oculto '});assert.equal(solved.status,200);assert.ok(solved.body.journey.solvedAt);
  assert.equal((await call('alice','/api/bootstrap')).body.journey.solvedAt,solved.body.journey.solvedAt);
  assert.equal((await call('alice','/api/season/solve',{key:'UMBRALOCULTO'})).body.journey.solvedAt,solved.body.journey.solvedAt);
  assert.equal((await call('bob','/api/season/solve',{key:'UMBRALOCULTO'})).status,409);
});
test('Sin suscripción se bloquean nuevas partidas y no bastan campos enviados por el navegador',async()=>{
  const {call,store}=harness(async()=>false);
  const result=await call('alice','/api/sessions',{caseId:stories[0].id,mode:'solo',subscription:'active',canPlay:true,paid:true});
  assert.equal(result.status,402);assert.equal(result.body.code,'SUBSCRIPTION_REQUIRED');assert.equal(store.sessions.size,0);
  const profile=await call('alice','/api/bootstrap');assert.equal(profile.status,200);assert.equal(profile.body.membership.canPlay,false);
  assert.equal((await call('alice','/api/profile',{name:'Alice',color:'#b1846b',paid:true},'PUT')).status,200);
  assert.equal((await call('alice','/api/bootstrap')).body.membership.canPlay,false);
});
test('Perder la suscripción bloquea continuar, votar e invitar sin borrar el progreso',async()=>{
  let active=true;
  const {call}=harness(async({uid})=>active&&uid==='alice');
  const created=(await call('alice','/api/sessions',{caseId:stories[0].id,mode:'duo'})).body;
  active=false;
  const id=created.session.id;
  assert.equal((await call('alice','/api/sessions/'+id)).status,402);
  assert.equal((await call('alice','/api/active-session',{sessionId:id},'PUT')).status,402);
  assert.equal((await call('alice','/api/sessions/'+id+'/choose',{nodeId:created.session.nodeId,choiceId:'x',version:0})).status,402);
  assert.equal((await call('alice','/api/sessions/'+id+'/invite',{})).status,402);
  assert.equal((await call('bob','/api/join',{code:created.inviteCode})).status,402);
  assert.equal((await call('eve','/api/sessions/'+id)).status,404);
  assert.equal((await call('alice','/api/bootstrap')).body.sessions.length,1);
  active=true;
  assert.equal((await call('bob','/api/join',{code:created.inviteCode})).status,200);
  assert.equal((await call('bob','/api/sessions/'+id)).status,200);
});
test('Importar progreso local no concede acceso de pago',async()=>{
  const {call}=harness(async()=>false),story=stories[0];
  const imported=await call('alice','/api/import-local',{localSessionId:'legacy',caseId:story.id,history:[]});
  assert.equal(imported.status,200);
  assert.equal((await call('alice','/api/sessions/'+imported.body.session.id)).status,402);
  assert.equal((await call('alice','/api/bootstrap')).body.membership.canPlay,false);
});
test('La configuración de producción deniega acceso por defecto sin proveedor de pago',async()=>{
  const store=fakeStore();
  const api=createGameApi({config,engine,stories,withStore:fn=>fn(store),verify:async()=>({userId:'alice',name:'Alice',paid:true})});
  const result=await api(new Request('https://example.test/api/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caseId:stories[0].id,mode:'solo'})}));
  assert.equal(result.status,402);assert.equal(store.sessions.size,0);
});
test('Una cuenta no puede leer, reanudar, votar ni invitar a partidas ajenas',async()=>{
  const {call}=harness();const created=await call('alice','/api/sessions',{caseId:stories[0].id,mode:'solo'});assert.equal(created.status,200);
  const id=created.body.session.id;
  assert.equal((await call('bob','/api/sessions/'+id)).status,404);
  assert.equal((await call('bob','/api/sessions/'+id+'/choose',{nodeId:'x',choiceId:'x',version:0})).status,404);
  assert.equal((await call('bob','/api/sessions/'+id+'/invite',{})).status,404);
  assert.equal((await call('bob','/api/active-session',{sessionId:id},'PUT')).status,404);
  assert.equal((await call('bob','/api/bootstrap')).body.sessions.length,0);
  assert.equal((await call('','/api/bootstrap')).status,401);
});
test('El servidor guarda el avance y rechaza puntuaciones y versiones manipuladas',async()=>{
  const {call}=harness();const created=await call('alice','/api/sessions',{caseId:stories[0].id,mode:'solo',ownerId:'eve'});
  const s=created.body.session,choice=stories[0].nodes[s.nodeId].choices[0];
  const moved=await call('alice',`/api/sessions/${s.id}/choose`,{nodeId:s.nodeId,choiceId:choice.id,version:0,scores:{inteligencia:99999},userId:'eve'});
  assert.equal(moved.status,200);assert.equal(moved.body.session.ownerId,'alice');assert.equal(moved.body.session.nodeId,choice.next);
  assert.notEqual(moved.body.session.members[0].scores.inteligencia,99999);
  assert.equal((await call('alice',`/api/sessions/${s.id}/choose`,{nodeId:s.nodeId,choiceId:choice.id,version:0})).status,409);
  const restored=(await call('alice','/api/bootstrap')).body;
  assert.equal(restored.sessions[0].history.length,1);assert.equal(restored.activeSessionId,s.id);
  assert.equal(restored.sessions[0].nodeId,choice.next);
});
test('Las invitaciones son privadas, caducan y solo admiten a un segundo usuario',async()=>{
  const {call,store}=harness();const created=(await call('alice','/api/sessions',{caseId:stories[0].id,mode:'duo'})).body;
  assert.ok(created.inviteCode);assert.notEqual(store.sessions.get(created.session.id).inviteHash,created.inviteCode);
  const joined=await call('bob','/api/join',{code:created.inviteCode});assert.equal(joined.status,200);assert.equal(joined.body.session.members.length,2);
  assert.equal((await call('eve','/api/join',{code:created.inviteCode})).status,400);
  const second=(await call('alice','/api/sessions',{caseId:stories[0].id,mode:'duo'})).body;
  store.sessions.get(second.session.id).inviteUntil=Date.now()-1;
  assert.equal((await call('bob','/api/join',{code:second.inviteCode})).status,400);
  assert.equal((await call('bob','/api/bootstrap')).body.sessions.length,1);
});
test('Repetir una creación confirmada no duplica la partida',async()=>{
  const {call}=harness();const input={caseId:stories[0].id,mode:'solo',requestId:crypto.randomUUID()};
  await call('alice','/api/sessions',input);await call('alice','/api/sessions',input);
  assert.equal((await call('alice','/api/bootstrap')).body.sessions.length,1);
  assert.equal((await call('eve','/api/sessions',input)).status,404);
});
test('Recuperar una partida local valida el recorrido, evita duplicados y mantiene el propietario',async()=>{
  const {call}=harness(),story=stories[0],choice=story.nodes[story.startNode].choices[0];
  const input={localSessionId:'local-old-session',caseId:story.id,history:[{nodeId:story.startNode,choiceId:choice.id}],scores:{inteligencia:99999}};
  const first=await call('alice','/api/import-local',input);assert.equal(first.status,200);
  assert.equal(first.body.session.nodeId,choice.next);assert.equal(first.body.session.ownerId,'alice');assert.equal(first.body.session.mode,'solo');
  assert.notEqual(first.body.session.members[0].scores.inteligencia,99999);
  const again=await call('alice','/api/import-local',input);assert.equal(again.body.alreadyImported,true);
  assert.equal((await call('alice','/api/bootstrap')).body.sessions.length,1);
  assert.equal((await call('bob','/api/sessions/'+first.body.session.id)).status,404);
  assert.equal((await call('alice','/api/import-local',{...input,localSessionId:'bad',history:[{nodeId:'invented',choiceId:'invented'}]})).status,400);
});
test('Se rechazan orígenes externos y errores de almacenamiento sin filtrar secretos',async()=>{
  const {call}=harness();assert.equal((await call('alice','/api/profile',{name:'Alice',color:'#b1846b'},'PUT','https://evil.test')).status,403);
  assert.equal((await call('alice','/api/profile',{name:'Alice',color:'url(evil)'},'PUT')).status,400);
  const api=createGameApi({config,engine,stories,verify:async()=>({userId:'alice'}),withStore:async()=>{throw new Error('password=private-secret');}});
  const result=await api(new Request('https://example.test/api/bootstrap'));
  assert.equal(result.status,503);assert.ok(!(await result.text()).includes('private-secret'));
});

const now=1800000000000;
function token(overrides={}){return ['eyJhbGciOiJSUzI1NiJ9',Buffer.from(JSON.stringify({aud:config.projectId,iss:`https://securetoken.google.com/${config.projectId}`,sub:'alice',auth_time:now/1000-100,iat:now/1000-10,exp:now/1000+3600,...overrides})).toString('base64url'),'x'.repeat(100)].join('.');}
const request=value=>new Request('https://example.test/api/bootstrap',{headers:{authorization:'Bearer '+value}});
test('El proveedor debe verificar la firma; un token inventado se rechaza',async()=>{
  const verify=createIdentityVerifier(config,async()=>new Response(JSON.stringify({error:{message:'INVALID_ID_TOKEN'}}),{status:400}),()=>now);
  await assert.rejects(verify(request(token())),error=>error.status===401);
});
test('Proyecto incorrecto, token caducado y correo sin verificar quedan bloqueados',async()=>{
  let calls=0;const verify=createIdentityVerifier(config,async()=>{calls++;return Response.json({users:[{localId:'alice',emailVerified:false}]});},()=>now);
  await assert.rejects(verify(request(token({aud:'another-project'}))),error=>error.status===401);
  await assert.rejects(verify(request(token({exp:now/1000-1}))),error=>error.status===401);assert.equal(calls,0);
  await assert.rejects(verify(request(token())),error=>error.code==='EMAIL_NOT_VERIFIED');
});
test('Se rechazan identidades sustituidas, cuentas revocadas y cuentas desactivadas',async()=>{
  for(const account of [{localId:'bob',emailVerified:true},{localId:'alice',emailVerified:true,disabled:true},{localId:'alice',emailVerified:true,validSince:String(now/1000-50)}]){
    const verify=createIdentityVerifier(config,async()=>Response.json({users:[account]}),()=>now);
    await assert.rejects(verify(request(token())),error=>error.status===401);
  }
});
test('La identidad válida procede de Firebase y no de la cabecera del cliente',async()=>{
  const verify=createIdentityVerifier(config,async()=>Response.json({users:[{localId:'alice',displayName:'Alice',email:'a@example.test',emailVerified:true}]}),()=>now);
  const req=request(token());req.headers.set('oai-authenticated-user-id','eve');const user=await verify(req);assert.equal(user.userId,'alice');
});

test('El enigma se guarda, rechaza aciertos falsificados y no premia terminar sin resolver',async()=>{
const {call,store}=harness(),story=stories.find(s=>s.season===1);const created=(await call('alice','/api/sessions',{caseId:story.id,mode:'solo'})).body.session;
assert.equal((await call('alice','/api/sessions/'+created.id+'/puzzle',{answer:story.puzzle.answer})).body.correct,false);
let s=created;while(s.status==='active')s=(await call('alice','/api/sessions/'+s.id+'/choose',{nodeId:s.nodeId,version:s.version,choiceId:story.nodes[s.nodeId].choices[0].id})).body.session;
assert.equal((await call('alice','/api/season')).body.journey.completed,0);
assert.equal((await call('bob','/api/sessions/'+s.id+'/puzzle',{answer:story.puzzle.answer})).status,404);
const wrong=await call('alice','/api/sessions/'+s.id+'/puzzle',{answer:'falso',correct:true,solvedAt:'fake'});assert.equal(wrong.body.correct,false);assert.equal(wrong.body.journey.completed,0);
const help=await call('alice','/api/sessions/'+s.id+'/puzzle',{action:'hint'});assert.equal(help.body.hints.length,1);
let solved;for(const step of story.puzzle.stages||[story.puzzle])solved=await call('alice','/api/sessions/'+s.id+'/puzzle',{stage:step.id,answer:step.answer});assert.equal(solved.body.correct,true);assert.equal(solved.body.journey.completed,1);
assert.equal((await call('alice','/api/bootstrap')).body.sessions[0].investigation.hints,1);
});

test('El acceso editorial exige identidad verificada y no se hereda por perfil o peticion',async()=>{
  assert.equal(isAdministrator({email:'owner@example.test',emailVerified:true,role:'admin'}),false);
  assert.equal(isAdministrator({emailVerified:false}),false);
  const store=fakeStore();let identity={userId:'owner',email:'owner@example.test',emailVerified:true};
  const billing={membership:async()=>({canPlay:false}),claim:async()=>{throw new Error('Admin must not consume paid credits');},checkout:async()=>{throw new Error('Admin must not be charged');}};
  const api=createGameApi({config,engine,stories,billing,authorizePlay:async()=>false,isAdministrator:u=>u.emailVerified===true&&u.email==='owner@example.test',withStore:fn=>fn(store),verify:async()=>identity});
  const call=async(path,value)=>{const r=await api(new Request('https://example.test'+path,{method:value?'POST':'GET',headers:{'content-type':'application/json'},...(value?{body:JSON.stringify(value)}:{})}));return {status:r.status,data:await r.json()};};
  const boot=await call('/api/bootstrap');assert.equal(boot.data.membership.role,'admin');assert.equal(boot.data.membership.calendar.available,12);
  for(const story of stories){const r=await call('/api/sessions',{caseId:story.id,mode:'solo'});assert.equal(r.status,200);assert.equal((await call('/api/sessions/'+r.data.session.id)).status,200);}
  assert.equal((await call('/api/billing/checkout',{})).status,409);
  identity={userId:'visitor',email:'visitor@example.test',emailVerified:true,role:'admin'};
  assert.equal((await call('/api/sessions',{caseId:stories[0].id,mode:'solo',role:'admin',email:'owner@example.test',emailVerified:true})).status,402);
  assert.equal((await call('/api/bootstrap')).data.membership.canPlay,false);
  const id=[...store.sessions.keys()][0];assert.equal((await call('/api/sessions/'+id)).status,404);
  identity={userId:'owner',email:'changed@example.test',emailVerified:true};assert.equal((await call('/api/sessions/'+id)).status,402);
});

test('Revising a finished route replaces its suffix, recalculates scores and preserves investigation',async()=>{
 const {call,store}=harness(),story=stories.find(x=>x.id==='cartas-medianoche');
 let s=(await call('alice','/api/sessions',{caseId:story.id,mode:'solo'})).body.session;
 while(s.status==='active')s=(await call('alice','/api/sessions/'+s.id+'/choose',{nodeId:s.nodeId,choiceId:story.nodes[s.nodeId].choices[0].id,version:s.version})).body.session;
 s.investigation={solvedAt:'legacy-solved',stages:{mensaje:{solvedAt:'now',hints:1}}};await store.saveSession(s);
 const old=structuredClone(s),index=1,node=story.nodes[s.history[index].nodeId],choice=node.choices[1];
 const revised=await call('alice','/api/sessions/'+s.id+'/revise',{index,version:s.version,choiceId:choice.id,scores:{inteligencia:999}});
 assert.equal(revised.status,200);s=revised.body.session;assert.equal(s.history.length,2);assert.equal(s.nodeId,choice.next);assert.equal(s.status,'active');assert.ok(s.version>old.version);
 assert.deepEqual(s.history[0],old.history[0]);assert.deepEqual(s.investigation,old.investigation);
 for(const key of engine.KEYS)assert.equal(s.members[0].scores[key],(old.history[0].preferenceEffects.alice[key]||0)+(choice.effects[key]||0));
 assert.equal((await call('alice','/api/sessions/'+s.id+'/revise',{index,version:old.version,choiceId:choice.id})).status,409);
 assert.equal((await call('eve','/api/sessions/'+s.id+'/revise',{index:0,version:s.version,choiceId:'x'})).status,404);
 assert.equal((await call('alice','/api/sessions/'+s.id+'/revise',{index:8,version:s.version,choiceId:'x'})).status,409);
});

test('Shared revision requires the owner, removes old votes and waits for a new agreement',async()=>{
 let active=true;const {call}=harness(async()=>active),story=stories.find(x=>x.id==='cartas-medianoche');
 const created=(await call('alice','/api/sessions',{caseId:story.id,mode:'duo'})).body;
 let s=(await call('bob','/api/join',{code:created.inviteCode})).body.session;
 const first=story.nodes[s.nodeId].choices[0];
 s=(await call('alice','/api/sessions/'+s.id+'/choose',{nodeId:s.nodeId,choiceId:first.id,version:s.version})).body.session;
 s=(await call('bob','/api/sessions/'+s.id+'/choose',{nodeId:s.nodeId,choiceId:first.id,version:s.version})).body.session;
 const choice=story.nodes[story.startNode].choices[1],body={index:0,version:s.version,choiceId:choice.id};
 assert.equal((await call('bob','/api/sessions/'+s.id+'/revise',body)).status,403);
 active=false;assert.equal((await call('alice','/api/sessions/'+s.id+'/revise',body)).status,402);active=true;
 s=(await call('alice','/api/sessions/'+s.id+'/revise',body)).body.session;
 assert.equal(s.history.length,0);assert.equal(s.votes.length,1);assert.equal(s.votes[0].userId,'alice');assert.equal(s.members[1].scores.inteligencia,0);
 s=(await call('bob','/api/sessions/'+s.id+'/choose',{nodeId:s.nodeId,choiceId:choice.id,version:s.version})).body.session;
 assert.equal(s.history.length,1);assert.equal(s.nodeId,choice.next);
 for(const m of s.members)assert.equal(Object.values(m.scores).reduce((a,b)=>a+b,0),3);
});
