import {randomUUID} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {mailKey} from './mail-service.mjs';
import {WORLD_CASE_COUNT,withValdemarTransaction} from './valdemar-wallet.mjs';
import {hasCaseActivity,recordCaseActivity} from './season-activity.mjs';

const day=86400000;
const emailAddress=value=>typeof value==='string'?value.trim().toLowerCase():'';
const emailValid=value=>value.length<=254 && /^[^\s@,;:<>"\\\[\]\u0000-\u001f\u007f]{1,64}@[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?(?:\.[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?)+$/u.test(value);
const unavailable=()=>new ApiError(404,'Esta invitación ya no está disponible.','INVITATION_UNAVAILABLE');
const occupied=()=>new ApiError(409,'Ya tienes una invitación o una pareja para este juego. Puedes gestionarla en tu perfil.','CASE_PARTNER_EXISTS');

export async function partnerCases(store,billing,uid,{poll=false,editorial=false}={}){
  if(editorial)return Array.from({length:WORLD_CASE_COUNT},(_,index)=>index+1);
  const membership=poll && billing?.pollMembership ? await billing.pollMembership(store,uid) : await billing?.membership(store,uid,{readOnly:true});
  return membership?.canPlay===true ? membership.seasonAccess?.availableCases || [] : [];
}

function visible(row,uid){
  const sent=row.ownerId===uid;
  return {id:row.id,caseId:row.caseId,direction:sent?'sent':'received',status:row.status,
    partnerName:sent?row.guestName:row.ownerName,partnerEmail:sent?row.email:null,
    expiresAt:row.status==='pending'?row.expiresAt:null};
}

export function partnerScope(row,uid){
  const key=row.ownerId===uid?'ownerScope':'guestScope';
  return row.progress?.[key]==='editorial'?'editorial':'paid';
}

function progress(data,id,scope){
  return data.valdemarCaseProgress?.[scope]?.[id] || {};
}

async function saveMode(store,uid,id,mode,scope){
  const data=await store.getMemberData(uid);
  if(progress(data,id,scope).mode===mode)return;
  const started=hasCaseActivity(data,scope,id);
  const records=(data.valdemarCaseProgress ||= {})[scope] ||= {};
  (records[id] ||= {}).mode=mode;
  recordCaseActivity(data,scope,id,started,'mode');
  await store.saveMemberData(uid,data);
}

export async function endPair(store,row){
  if(row.status==='accepted'){
    for(const uid of [row.ownerId,row.guestId].sort())await saveMode(store,uid,row.caseId,'solo',partnerScope(row,uid));
  }
  await store.closePartner(row);
}

async function requireCase(store,billing,uid,id,scope){
  if(!(await partnerCases(store,billing,uid,{editorial:scope==='editorial'})).includes(id))
    throw new ApiError(402,'Para jugar en pareja necesitas acceso a este juego con tu propio pase.','CASE_PASS_REQUIRED');
}

async function sendInvitation(store,billing,user,input,now,scope){
  const id=input?.caseId,email=emailAddress(input?.email),uid=user.userId;
  if(!Number.isInteger(id)||id<1||id>WORLD_CASE_COUNT||!emailValid(email)||email===emailAddress(user.email))
    throw new ApiError(400,'Elige un juego y escribe el correo de la otra persona.','INVALID_INVITATION');
  await requireCase(store,billing,uid,id,scope);
  const reserved=await store.getCasePartner(uid,id,now);
  if(reserved){
    if(reserved.ownerId===uid && reserved.email===email && partnerScope(reserved,uid)===scope)return {ok:true};
    throw occupied();
  }
  const data=await store.getMemberData(uid);
  const recent=(data.partnerMailTimes||[]).filter(time=>time>now-day);
  if(recent.length>=24||recent.filter(time=>time>now-3600000).length>=8)
    throw new ApiError(429,'Has enviado varias invitaciones. Espera un poco antes de enviar otra.','INVITE_LIMIT');
  const profile=await store.getProfile(uid);
  const row={id:randomUUID(),caseId:id,ownerId:uid,ownerName:profile?.name||user.name||'Tu compañero de juego',
    email,guestId:null,guestName:null,status:'pending',expiresAt:now+7*day,progress:{ownerScope:scope}};
  await store.createPartner(row);
  if(!await store.reservePartner(uid,id,row.id))throw occupied();
  data.partnerMailTimes=[...recent,now];
  await store.saveMemberData(uid,data);
  await store.enqueueMail(mailKey('case_invitation',row.id),email,'case_invitation',{caseId:id,inviterName:row.ownerName});
  return {ok:true};
}

async function accept(store,billing,user,row,now,scope){
  const uid=user.userId;
  if(row.status==='accepted' && row.guestId===uid && partnerScope(row,uid)===scope)return {ok:true};
  if(row.status!=='pending'||row.email!==emailAddress(user.email)||row.ownerId===uid)throw unavailable();
  row.progress ||= {};
  row.progress.guestScope=scope;
  for(const member of [row.ownerId,uid].sort())await requireCase(store,billing,member,row.caseId,partnerScope(row,member));
  if(await store.getCasePartner(uid,row.caseId,now) || !await store.reservePartner(uid,row.caseId,row.id))throw occupied();
  const profile=await store.getProfile(uid);
  row.guestId=uid;row.guestName=profile?.name||user.name||'Tu compañero de juego';row.status='accepted';
  const personal=[];
  for(const member of [row.ownerId,uid].sort()){
    const memberScope=partnerScope(row,member);
    personal.push(progress(await store.getMemberData(member),row.caseId,memberScope));
    await saveMode(store,member,row.caseId,'duo',memberScope);
  }
  // Resume at the last checkpoint reached by both. Previous solo endings remain personal.
  row.progress.hourStep=Math.min(...personal.map(record=>record.choice?5:record.hourStep||0));
  row.progress.deduced=personal.every(record=>record.deduced||record.choice);
  await store.savePartner(row);
  return {ok:true};
}

export async function partnerRequest({path,method,input,user,withStore,billing,editorial=false}){
  const uid=user.userId,email=emailAddress(user.email);
  if(user.emailVerified!==true||!emailValid(email))throw new ApiError(403,'Verifica tu correo para gestionar tus invitaciones.','EMAIL_NOT_VERIFIED');
  const match=/^\/api\/partners\/([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})\/(accept|decline|revoke)$/.exec(path);
  const preference=path==='/api/partners/preferred';
  if(!match && !preference && path!=='/api/partners')throw unavailable();
  return withValdemarTransaction(withStore,async store=>{
    const now=Date.now();
    if(preference){
      if(method==='GET')return {preferredEmail:(await store.getMemberData(uid,{readOnly:true})).preferredPartnerEmail || null};
      if(method==='POST'){
        const preferredEmail=input?.email===null?null:emailAddress(input?.email);
        if(preferredEmail!==null && (!emailValid(preferredEmail) || preferredEmail===email))
          throw new ApiError(400,'Escribe un correo válido distinto del tuyo.','INVALID_PARTNER_EMAIL');
        const data=await store.getMemberData(uid);
        if((data.preferredPartnerEmail || null)!==preferredEmail){
          if(preferredEmail===null)delete data.preferredPartnerEmail;
          else data.preferredPartnerEmail=preferredEmail;
          await store.saveMemberData(uid,data);
        }
        return {preferredEmail};
      }
    }else if(!match){
      if(method==='GET'){
        const rows=await store.listPartners(uid,email,now);
        const preferredEmail=(await store.getMemberData(uid,{readOnly:true})).preferredPartnerEmail || null;
        return {invitations:rows.map(row=>visible(row,uid)),availableCases:await partnerCases(store,billing,uid,{editorial}),preferredEmail};
      }
      if(method==='POST')return sendInvitation(store,billing,user,input,now,editorial?'editorial':'paid');
    }else if(method==='POST'){
      const row=await store.getPartner(match[1]);
      if(!row || (row.status==='pending' && row.expiresAt<=now))throw unavailable();
      if(match[2]==='accept')return accept(store,billing,user,row,now,editorial?'editorial':'paid');
      const authorized=match[2]==='decline'
        ? row.status==='pending' && row.email===email && row.ownerId!==uid
        : row.ownerId===uid || row.status==='accepted' && row.guestId===uid;
      if(!authorized)throw unavailable();
      await endPair(store,row);
      return {ok:true};
    }
    throw new ApiError(405,'Método no permitido.');
  });
}

export function partnerInfo(row,uid){
  return row?{id:row.id,name:row.ownerId===uid?row.guestName:row.ownerName,role:row.ownerId===uid?'A':'B'}:null;
}

// Advance both personal albums without overwriting a more advanced solo checkpoint
// or an ending either player chose before joining this team.
export async function syncPairProgress(store,row,action){
  await store.savePartner(row);
  for(const uid of [row.ownerId,row.guestId].sort()){
    const data=await store.getMemberData(uid);
    const scope=partnerScope(row,uid);
    const started=hasCaseActivity(data,scope,row.caseId);
    const records=(data.valdemarCaseProgress ||= {})[scope] ||= {};
    const record=records[row.caseId] ||= {};
    record.mode='duo';
    record.hourStep=Math.max(record.hourStep||0,row.progress.hourStep||0);
    if(row.progress.deduced)record.deduced=true;
    if(row.progress.choice && !record.choice)record.choice=row.progress.choice;
    recordCaseActivity(data,scope,row.caseId,started,action);
    await store.saveMemberData(uid,data);
  }
}
