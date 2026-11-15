import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { ApiError, isConfigured } from './auth-provider.mjs';

const COLORS=['#b1846b','#a7b6a0','#dca6a1','#a2b2c9'];
const hash=code=>createHash('sha256').update(code).digest('hex');
const memberProfile=p=>({userId:p.userId,name:p.name,color:p.color,avatar:'detective'});
const fail=(status,message,code)=>{throw new ApiError(status,message,code);};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
function member(record,uid) {
  if(!record?.session.members.some(m=>m.userId===uid)) fail(404,'Esta partida no está disponible.');
  return record.session;
}
async function body(request) {
  if(!(request.headers.get('content-type')||'').startsWith('application/json')) fail(415,'La petición debe contener JSON.');
  const raw=await request.text();
  if(Buffer.byteLength(raw)>16384) fail(413,'La petición es demasiado grande.');
  let result;try{result=JSON.parse(raw);}catch{fail(400,'La petición no es válida.');}
  if(!result||typeof result!=='object'||Array.isArray(result)) fail(400,'La petición no es válida.');
  return result;
}
// Fail closed until a payment provider supplies verified, current entitlements.
// No browser field, profile edit or local import can grant paid access.
export function createGameApi({config,storageReady=true,verify,withStore,engine,stories,origins=[],authorizePlay=async()=>false}) {
  const rates=new Map();
  async function requireSubscription(store,uid){
    if(await authorizePlay({store,uid})!==true)fail(402,'Necesitas una suscripción de pago activa para jugar. La contratación todavía no está abierta.','SUBSCRIPTION_REQUIRED');
  }
  return async function handle(request) {
    const url=new URL(request.url),path=url.pathname,method=request.method;
    try {
      if(path==='/api/auth/config'&&method==='GET') return json({enabled:isConfigured(config)&&storageReady,firebase:isConfigured(config)?config:null});
      if(!path.startsWith('/api/')) return json({error:'No encontrado.'},404);
      const origin=request.headers.get('origin');
      if(origin&&!origins.includes(origin)) fail(403,'El origen de la petición no está permitido.');
      if(!['GET','POST','PUT'].includes(method)) fail(405,'Método no permitido.');
      const user=await verify(request),uid=user.userId;
      const now=Date.now(),rate=rates.get(uid);
      if(rate&&rate.until>now){if(++rate.count>180)fail(429,'Espera unos segundos antes de continuar.');}
      else {if(rates.size>10000)rates.clear();rates.set(uid,{count:1,until:now+60000});}
      const input=method==='GET'?null:await body(request);
      const result=await withStore(async store=>{
        const profile=await store.ensureProfile(user);
        if(path==='/api/bootstrap'&&method==='GET')return {profile,sessions:await store.listSessions(uid),activeSessionId:profile.activeSessionId||null,membership:{canPlay:await authorizePlay({store,uid})===true,checkoutAvailable:false}};
        if(path==='/api/profile'&&method==='PUT'){
          const name=typeof input.name==='string'?input.name.trim():'';
          if(name.length<2||name.length>32||/[\u0000-\u001f\u007f]/.test(name)||!COLORS.includes(input.color))fail(400,'Revisa el nombre y el color de tu perfil.');
          return {profile:await store.updateProfile(uid,name,input.color)};
        }
        if(path==='/api/sessions'&&method==='POST'){
          if(!stories.some(s=>s.id===input.caseId)||!['solo','duo'].includes(input.mode))fail(400,'Elige un caso y un modo disponibles.');
          if(input.requestId&&!/^[0-9a-f-]{36}$/.test(input.requestId))fail(400,'La petición no es válida.');
          const id=input.requestId||randomUUID(),existing=await store.getSession(id);
          if(existing){const session=member(existing,uid);await requireSubscription(store,session.ownerId);return {session};}
          await requireSubscription(store,uid);
          if((await store.listSessions(uid)).length>=200)fail(409,'Has alcanzado el límite de 200 partidas.');
          const session=engine.makeSession(input.caseId,[memberProfile(profile)],input.mode);session.id=id;
          await store.insertSession(session);await store.setActive(uid,id);
          let inviteCode;
          if(input.mode==='duo'){
            inviteCode=randomBytes(24).toString('base64url');session.inviteActive=true;
            await store.setInvite(id,hash(inviteCode),Date.now()+86400000);await store.saveSession(session);
          }
          return {session,...(inviteCode?{inviteCode}:{})};
        }
        if(path==='/api/import-local'&&method==='POST'){
          if(typeof input.localSessionId!=='string'||input.localSessionId.length>100||!input.localSessionId||
              !stories.some(s=>s.id===input.caseId)||!Array.isArray(input.history)||input.history.length>25)fail(400,'La partida local no es válida.');
          const hex=hash('local-import:'+uid+':'+input.localSessionId).slice(0,32);
          const id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
          const existing=await store.getSession(id);if(existing)return {session:member(existing,uid),alreadyImported:true};
          if((await store.listSessions(uid)).length>=200)fail(409,'Has alcanzado el límite de 200 partidas.');
          let session=engine.makeSession(input.caseId,[memberProfile(profile)],'solo');session.id=id;
          const story=stories.find(s=>s.id===input.caseId);
          try{
            for(const entry of input.history){
              if(entry.nodeId!==session.nodeId||session.status!=='active')throw new Error();
              const preference=story.nodes[session.nodeId].choices.find(c=>c.id===(entry.preferenceId||entry.choiceId));
              if(!preference)throw new Error();
              session.firstVotes[uid]=preference.id;session.firstVoteEffects[uid]=structuredClone(preference.effects||{});
              session=engine.vote(session,uid,session.nodeId,entry.choiceId,session.version).session;
            }
          }catch{fail(400,'No se puede recuperar esta partida: su recorrido no coincide con el caso actual.');}
          await store.insertSession(session);await store.setActive(uid,id);return {session,alreadyImported:false};
        }
        if(path==='/api/active-session'&&method==='PUT'){
          const session=member(await store.getSession(String(input.sessionId||'')),uid);
          await requireSubscription(store,session.ownerId);
          await store.setActive(uid,session.id);return {saved:true};
        }
        if(path==='/api/join'&&method==='POST'){
          if(typeof input.code!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(input.code))fail(400,'La invitación no es válida o ha caducado.');
          const record=await store.findInvite(hash(input.code));
          if(!record||record.inviteUntil<Date.now())fail(400,'La invitación no es válida o ha caducado.');
          const session=record.session;
          await requireSubscription(store,session.ownerId);
          if(session.members.some(m=>m.userId===uid))return {session};
          if(session.status!=='waiting'||session.members.length!==1)fail(409,'Esta partida ya tiene su equipo.');
          session.members.push({...memberProfile(profile),role:'B',scores:engine.zero()});session.status='active';session.inviteActive=false;
          await store.addMember(session.id,uid);await store.saveSession(session);await store.setInvite(session.id,null,null);await store.setActive(uid,session.id);
          return {session};
        }
        const match=/^\/api\/sessions\/([0-9a-f-]{36})(?:\/(choose|invite))?$/.exec(path);
        if(match){
          const session=member(await store.getSession(match[1]),uid);
          await requireSubscription(store,session.ownerId);
          if(!match[2]&&method==='GET')return {session};
          if(match[2]==='choose'&&method==='POST'){
            if(!Number.isInteger(input.version)||typeof input.nodeId!=='string'||typeof input.choiceId!=='string')fail(400,'La elección no es válida.');
            let outcome;try{outcome=engine.vote(session,uid,input.nodeId,input.choiceId,input.version);}catch(error){fail(409,error.message,'STATE_CHANGED');}
            await store.saveSession(outcome.session);await store.setActive(uid,session.id);return outcome;
          }
          if(match[2]==='invite'&&method==='POST'){
            if(session.ownerId!==uid||session.status!=='waiting'||session.members.length!==1)fail(403,'No puedes crear una invitación para esta partida.');
            const inviteCode=randomBytes(24).toString('base64url');session.inviteActive=true;
            await store.setInvite(session.id,hash(inviteCode),Date.now()+86400000);await store.saveSession(session);return {inviteCode};
          }
        }
        fail(404,'No encontrado.');
      });
      return json(result);
    } catch(error) {
      if(error instanceof ApiError)return json({error:error.message,code:error.code},error.status);
      // Never disclose database credentials, SQL, tokens or provider response bodies.
      console.error('API request failed:',error.code||error.name||'Error');
      return json({error:'No se ha podido guardar. Reintenta la operación; tu última decisión confirmada sigue a salvo.',code:'STORAGE_UNAVAILABLE'},503);
    }
  };
}
