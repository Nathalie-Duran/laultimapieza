import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {createIdentityVerifier,ApiError} from '../auth-provider.mjs';
import {createGameApi} from '../game-api.mjs';

const config={apiKey:'test-key',authDomain:'test-project.firebaseapp.com',projectId:'test-project',appId:'test-app'};
const context=createContext({structuredClone,crypto:globalThis.crypto});
for(const file of ['stories.js','season.js','engine.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
const engine=context.GameEngine,stories=context.STORIES;
function fakeStore(){
  const profiles=new Map(),sessions=new Map();
  return {
    profiles,sessions,
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
