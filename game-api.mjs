import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { ApiError, isConfigured } from './auth-provider.mjs';
import { readJourney, solveJourney } from './season-journey.mjs';
import { checkPuzzle } from './progression.mjs';
import { adminMembership, canManageSite } from './admin-access.mjs';
import { worldSeasonAccess } from './valdemar-wallet.mjs';
import { mailKey } from './mail-service.mjs';
import {checkRetiredSession, resetPersonalProgress} from './progress-reset.mjs';

const COLORS=['#b1846b','#a7b6a0','#dca6a1','#a2b2c9'];
const hash=code=>createHash('sha256').update(code).digest('hex');
const AVATARS=new Set(['detective','cobre','jade','ambar','tinta','coral','plata']);
const memberProfile=p=>({userId:p.userId,name:p.name,color:p.color,avatar:AVATARS.has(p.avatar)?p.avatar:'detective'});
const fail=(status,message,code)=>{throw new ApiError(status,message,code);};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
function member(record,uid) {
  if(!record?.session.members.some(m=>m.userId===uid)) fail(404,'Esta partida no está disponible.');
  return record.session;
}
function visibleSession(session){
  const visible=structuredClone(session);
  const members=new Set(visible.members.map(member=>member.userId));
  for(const entry of visible.history){
    for(const field of ['preferences','preferenceEffects']){
      if(entry[field])entry[field]=Object.fromEntries(Object.entries(entry[field]).filter(([uid])=>members.has(uid)));
    }
  }
  for(const finding of [visible.investigation,...Object.values(visible.investigation?.stages||{})]){
    if(finding?.solvedBy&&!members.has(finding.solvedBy))delete finding.solvedBy;
  }
  return visible;
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
export function createGameApi({config,storageReady=true,verify,withStore,engine,stories,origins=[],authorizePlay=async()=>false,billing=null,isAdministrator=()=>false}) {
  const rates=new Map();
  const noticeWindow={end:0,count:0};
  async function requireSubscription(store,uid,user,caseId){
    if(uid===user?.userId&&isAdministrator(user))return;
    if(await authorizePlay({store,uid,caseId})!==true)fail(402,'Necesitas una suscripción activa para acceder a los retos. Tu progreso se conserva.','SUBSCRIPTION_REQUIRED');
  }
  return async function handle(request) {
    const url=new URL(request.url),path=url.pathname,method=request.method;
    try {
      if(path==='/api/auth/config'&&method==='GET') return json({enabled:isConfigured(config)&&storageReady,firebase:isConfigured(config)?config:null});
      if(path==='/api/billing/config'&&method==='GET')return json(billing?.publicConfig()||{checkoutAvailable:false});
      if(path==='/api/billing/webhook'&&method==='POST'&&billing)return await billing.webhook(request,withStore);
      if(!path.startsWith('/api/')) return json({error:'No encontrado.'},404);
      const origin=request.headers.get('origin');
      if(origin&&!origins.includes(origin)) fail(403,'El origen de la petición no está permitido.');
      if(!['GET','POST','PUT'].includes(method)) fail(405,'Método no permitido.');
      if(path==='/api/metrics'&&method==='POST'){
        const metric=await body(request);
        if(!['demo_start','demo_receipt','demo_solved','demo_complete','demo_hint','plans_view','ref_visit','ref_demo'].includes(metric.event))fail(400,'Evento no válido.');
        // Explicit opt-in in the demo. Only aggregate counters: no email, IP or answer stored.
        if(metric.consent!==true)return json({recorded:false});
        await withStore(store=>store.metric(metric.event));return json({recorded:true});
      }
      if(path==='/api/opening-notice' && (method==='POST'||method==='PUT')){
        if(!origin || !origins.includes(origin))fail(403,'Abre el formulario desde La última pieza.');
        const input=await body(request);
        if(method==='PUT'){
          if(typeof input.receipt!=='string'||!/^[a-f0-9]{48}$/.test(input.receipt))fail(400,'La solicitud no es válida.');
          const removed=await withStore(store=>store.removeOpeningNotice(hash(input.receipt)));
          if(!removed)return json({accepted:false,error:'Esta clave no corresponde a una solicitud activa. Si lo pediste antes, usa el navegador original o retíralo desde tu cuenta verificada.'},409);
          return json({accepted:true});
        }
        const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
        if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||input.consent!==true)fail(400,'Revisa tu correo y confirma que quieres recibir el aviso.');
        const now=Date.now();
        if(now>=noticeWindow.end){noticeWindow.end=now+60000;noticeWindow.count=0;}
        if(++noticeWindow.count>120)fail(429,'Hay muchas solicitudes. Vuelve a intentarlo en un minuto.');
        const receipt=randomBytes(24).toString('hex');
        await withStore(async store=>{
          const created=await store.addOpeningNotice(email,hash(receipt));
          if(created&&input.referralMetrics===true)await store.metric('ref_notice');
        });
        return json({accepted:true,receipt},202);
      }
      const user=await verify(request),uid=user.userId;
      const now=Date.now(),rate=rates.get(uid);
      if(rate&&rate.until>now){if(++rate.count>180)fail(429,'Espera unos segundos antes de continuar.');}
      else {if(rates.size>10000)rates.clear();rates.set(uid,{count:1,until:now+60000});}
      const input=method==='GET'?null:await body(request);
      if(path==='/api/admin/valdemar-release'){
        if(method!=='POST')fail(405,'Método no permitido.');
        if(!origin||!origins.includes(origin)||!canManageSite(user))fail(403,'Esta operación está reservada a la propietaria.');
        const {activateValdemarRelease}=await import('./valdemar-release.mjs');
        return json(await withStore(store=>activateValdemarRelease(store,input)));
      }
      if(path.startsWith('/api/valdemar/')){
        const {valdemarRequest}=await import('./valdemar-api.mjs');
        return json(await valdemarRequest({path,method,input,uid,editorial:isAdministrator(user),withStore,billing}));
      }
      if(path==='/api/admin/analytics'&&method==='GET'){
        if(!canManageSite(user))fail(403,'Esta vista está reservada a la propietaria.');
        const days=Number(url.searchParams.get('days')||30);
        if(![7,30,90].includes(days))fail(400,'Elige 7, 30 o 90 días.');
        const report=await withStore(async store=>{await store.markEditorial(uid);return store.analytics({days,billingEnabled:billing?.configured===true,stories});});
        return json(report);
      }
      const result=await withStore(async store=>{
        const profile=await store.ensureProfile(user);
        if(store.enqueueMail){
          const memberData=await store.getMemberData(uid);
          if(profile.newProfile)memberData.welcomePending=true;
          if(memberData.welcomePending&&user.emailVerified===true){
            await store.enqueueMail(mailKey('welcome',uid),user.email,'welcome',{name:profile.name});
            memberData.welcomePending=false;
          }
          if(profile.newProfile||memberData.welcomePending===false)await store.saveMemberData(uid,memberData);
        }
        delete profile.newProfile;
        if(path==='/api/billing/checkout'&&method==='POST'&&billing){if(isAdministrator(user))fail(409,'Tu cuenta de administradora ya tiene acceso completo sin pago.');return billing.checkout(store,user,input);}
        if(path==='/api/billing/portal'&&method==='POST'&&billing)return billing.portal(store,uid);
        if(path==='/api/waitlist'&&method==='PUT'){
          if(typeof input.enabled!=='boolean')fail(400,'Elige si quieres recibir el aviso.');
          if(!input.enabled&&user.emailVerified&&store.removeVerifiedOpeningNotice)await store.removeVerifiedOpeningNotice(user.email);
          const data=await store.getMemberData(uid);data.waitlist=input.enabled;data.waitlistEmail=input.enabled?user.email:null;data.waitlistAt=input.enabled?new Date().toISOString():null;
          await store.saveMemberData(uid,data);return {waitlist:data.waitlist};
        }
        if(path==='/api/me/progress/reset'&&method==='POST')
          return resetPersonalProgress(store,uid,input,isAdministrator(user));
        if(path==='/api/bootstrap'&&method==='GET'){
          if(isAdministrator(user)&&store.markEditorial)await store.markEditorial(uid);
          const sessions=await store.listSessions(uid);
          const membership=isAdministrator(user)
            ? {...adminMembership(),seasonAccess:worldSeasonAccess(await store.getMemberData(uid),{editorial:true})}
            : billing?await billing.membership(store,uid):{canPlay:await authorizePlay({store,uid})===true,checkoutAvailable:false};
          const guestOwners=[...new Set(sessions.filter(s=>s.ownerId!==uid).map(s=>s.ownerId))];
          const guestAccess=[];for(const owner of guestOwners)if(await authorizePlay({store,uid:owner})===true)guestAccess.push(owner);
          membership.canManage=canManageSite(user);membership.ownAccess=membership.canPlay;membership.guestOwners=guestAccess;membership.canPlay ||= guestAccess.length>0;
          return {profile,sessions,journey:await readJourney(store,stories,uid,sessions),activeSessionId:profile.activeSessionId||null,membership};
        }
        if(path==='/api/season'&&method==='GET')return {journey:await readJourney(store,stories,uid)};
        if(path==='/api/season/solve'&&method==='POST')return {journey:await solveJourney(store,stories,uid,input.key)};
        if(path==='/api/season/ending'&&method==='POST'){
          if(!['share','preserve'].includes(input.choice))fail(400,'Elige un desenlace disponible.');
          if(!await store.getSeasonSolved(uid,1))fail(409,'Abre el sello antes de decidir.');
          const data=await store.getMemberData(uid);data.seasonEnding ||= input.choice;await store.saveMemberData(uid,data);return {journey:await readJourney(store,stories,uid)};
        }
        if(path==='/api/profile'&&method==='PUT'){
          const name=typeof input.name==='string'?input.name.trim():'';
          if(name.length<2||name.length>32||/[\u0000-\u001f\u007f]/.test(name)||!COLORS.includes(input.color))fail(400,'Revisa el nombre y el color de tu perfil.');
          if(input.avatarChoice!==undefined&&!AVATARS.has(input.avatarChoice))fail(400,'Elige un avatar de la colección.');
          return {profile:await store.updateProfile(uid,name,input.color,input.avatarChoice)};
        }
        if(path==='/api/sessions'&&method==='POST'){
          if(!stories.some(s=>s.id===input.caseId)||!['solo','duo'].includes(input.mode))fail(400,'Elige un caso y un modo disponibles.');
          if(input.requestId&&!/^[0-9a-f-]{36}$/.test(input.requestId))fail(400,'La petición no es válida.');
          const id=input.requestId||randomUUID();
          if(input.requestId)checkRetiredSession(await store.getMemberData(uid),id);
          const existing=await store.getSession(id);
          if(existing){const session=member(existing,uid);await requireSubscription(store,session.ownerId,user,session.caseId);return {session};}
          await requireSubscription(store,uid,user);
          if(billing&&!isAdministrator(user))await billing.claim(store,uid,input.caseId);
          if((await store.listSessions(uid)).length>=200)fail(409,'Has alcanzado el límite de 200 partidas.');
          const session=engine.makeSession(input.caseId,[memberProfile(profile)],input.mode);session.id=id;
          await store.insertSession(session);await store.setActive(uid,id);
          if(store.metric)await store.metric('case_started');
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
          checkRetiredSession(await store.getMemberData(uid),id);
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
          await store.insertSession(session);await store.setActive(uid,id);return {session,alreadyImported:false,journey:await readJourney(store,stories,uid)};
        }
        if(path==='/api/active-session'&&method==='PUT'){
          const session=member(await store.getSession(String(input.sessionId||'')),uid);
          await requireSubscription(store,session.ownerId,user,session.caseId);
          await store.setActive(uid,session.id);return {saved:true};
        }
        if(path==='/api/join'&&method==='POST'){
          if(typeof input.code!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(input.code))fail(400,'La invitación no es válida o ha caducado.');
          const record=await store.findInvite(hash(input.code));
          if(!record||record.inviteUntil<Date.now())fail(400,'La invitación no es válida o ha caducado.');
          const session=record.session;
          const memberData=await store.getMemberData(uid);
          checkRetiredSession(memberData,session.id);
          if(memberData.progressReset?.at && (session.history||[]).some(entry=>
            (!entry.createdAt||entry.createdAt<=memberData.progressReset.at) &&
            (Object.hasOwn(entry.preferences||{},uid)||Object.hasOwn(entry.preferenceEffects||{},uid))))
            fail(410,'Esta partida pertenece a un progreso que ya reiniciaste.','PROGRESS_RESET');
          await requireSubscription(store,session.ownerId,user,session.caseId);
          if(session.members.some(m=>m.userId===uid))return {session};
          if(session.status!=='waiting'||session.members.length!==1)fail(409,'Esta partida ya tiene su equipo.');
          const joined=engine.joinTeam(session,memberProfile(profile));
          await store.addMember(joined.id,uid);await store.saveSession(joined);await store.setInvite(joined.id,null,null);await store.setActive(uid,joined.id);
          return {session:joined};
        }
        const match=/^\/api\/sessions\/([0-9a-f-]{36})(?:\/(choose|invite|puzzle|revise|mode))?$/.exec(path);
        if(match){
          const session=member(await store.getSession(match[1]),uid);
          await requireSubscription(store,session.ownerId,user,session.caseId);
          if(!match[2]&&method==='GET')return {session,journey:await readJourney(store,stories,uid)};
          if(match[2]==='mode'&&method==='PUT'){
            if(session.ownerId!==uid)fail(403,'Solo quien creó la partida puede cambiar su modalidad.');
            if(!['solo','duo'].includes(input.mode)||!Number.isInteger(input.version))fail(400,'El cambio de modalidad no es válido.');
            let next;
            try{next=engine.changePlayMode(session,uid,input.mode,input.version);}catch(error){fail(409,error.message,'STATE_CHANGED');}
            if(next===session)return {session};
            for(const previous of session.members){
              if(previous.userId!==uid)await store.removeMember(session.id,previous.userId);
            }
            await store.setInvite(session.id,null,null);
            await store.saveSession(next);
            return {session:next};
          }
          if(match[2]==='revise'&&method==='POST'){
            if(session.ownerId!==uid)fail(403,'Solo quien creó la partida puede cambiar el recorrido compartido.');
            if(!Number.isInteger(input.index)||!Number.isInteger(input.version)||typeof input.choiceId!=='string')fail(400,'La revisión no es válida.');
            let outcome;try{outcome=engine.revise(session,uid,input.index,input.choiceId,input.version);}catch(error){fail(409,error.message,'STATE_CHANGED');}
            await store.saveSession(outcome.session);await store.setActive(uid,session.id);
            return {...outcome,journey:await readJourney(store,stories,uid)};
          }
          if(match[2]==='puzzle'&&method==='POST'){
            const alreadySolved=!!session.investigation?.solvedAt;
            const result=checkPuzzle(session,stories.find(s=>s.id===session.caseId),input,uid);
            if(store.metric){if(input.action==='hint')await store.metric('puzzle_hint');else if(result.correct&&result.complete!==false&&!alreadySolved)await store.metric('puzzle_solved');else if(!result.correct)await store.metric('puzzle_retry');}
            await store.saveSession(session);return {...result,session,journey:await readJourney(store,stories,uid)};
          }
          if(match[2]==='choose'&&method==='POST'){
            if(!Number.isInteger(input.version)||typeof input.nodeId!=='string'||typeof input.choiceId!=='string')fail(400,'La elección no es válida.');
            let outcome;try{outcome=engine.vote(session,uid,input.nodeId,input.choiceId,input.version);}catch(error){fail(409,error.message,'STATE_CHANGED');}
            if(store.metric&&outcome.transitioned&&outcome.session.status==='finished')await store.metric('story_finished');
            await store.saveSession(outcome.session);await store.setActive(uid,session.id);return {...outcome,journey:await readJourney(store,stories,uid)};
          }
          if(match[2]==='invite'&&method==='POST'){
            if(session.ownerId!==uid||session.status!=='waiting'||session.members.length!==1)fail(403,'No puedes crear una invitación para esta partida.');
            const inviteCode=randomBytes(24).toString('base64url');session.inviteActive=true;
            await store.setInvite(session.id,hash(inviteCode),Date.now()+86400000);await store.saveSession(session);return {inviteCode};
          }
        }
        fail(404,'No encontrado.');
      });
      if(result.session)result.session=visibleSession(result.session);
      if(result.sessions)result.sessions=result.sessions.map(visibleSession);
      return json(result);
    } catch(error) {
      if(error instanceof ApiError)return json({error:error.message,code:error.code},error.status);
      // Never disclose database credentials, SQL, tokens or provider response bodies.
      console.error('API request failed:',error.code||error.name||'Error');
      return json({error:'No se ha podido guardar. Reintenta la operación; tu última decisión confirmada sigue a salvo.',code:'STORAGE_UNAVAILABLE'},503);
    }
  };
}
