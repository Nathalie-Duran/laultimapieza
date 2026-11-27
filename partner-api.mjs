import {mergeInventory} from './expedition.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {mailKey} from './mail-service.mjs';
import {creditSecretMission,WORLD_CASE_COUNT,withValdemarTransaction} from './valdemar-wallet.mjs';
import {hasCaseActivity,recordCaseActivity} from './season-activity.mjs';
import {mergeStageEvidence} from './season-career.mjs';
import {notifyEnding} from './play-notices.mjs';
import {publicPartnerOffer} from './partner-offer.mjs';

const day=86400000;
const emailAddress=value=>typeof value==='string'?value.trim().toLowerCase():'';
const emailValid=value=>value.length<=254 && /^[^\s@,;:<>"\\\[\]\u0000-\u001f\u007f]{1,64}@[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?(?:\.[\p{L}\d](?:[\p{L}\d-]{0,61}[\p{L}\d])?)+$/u.test(value);
const unavailable=()=>new ApiError(404,'Esta invitación ya no está disponible.','INVITATION_UNAVAILABLE');
const occupied=()=>new ApiError(409,'La pareja de este juego ha cambiado. Vuelve a abrirlo para elegir modalidad.','CASE_PARTNER_EXISTS');
const chooseInGame=()=>new ApiError(409,'Abre el juego y selecciona «En pareja» desde tu propia cuenta.','CHOOSE_IN_GAME');
const needPreferred=()=>new ApiError(409,'Guarda a tu compañero en Mi cuenta para elegir «En pareja».','PARTNER_REQUIRED');
export const hasGameConsent=row=>row?.progress?.consentVersion===2;
const otherEmail=(row,uid)=>row.ownerId===uid?row.email:row.progress?.ownerEmail;
const hasOwnChoice=(row,uid)=>row.ownerId===uid || row.status==='accepted' && row.guestId===uid;

export async function partnerCases(store,billing,uid,{poll=false,editorial=false}={}){
  if(editorial)return Array.from({length:WORLD_CASE_COUNT},(_,index)=>index+1);
  const membership=poll && billing?.pollMembership ? await billing.pollMembership(store,uid) : await billing?.membership(store,uid,{readOnly:true});
  return membership?.canPlay===true ? membership.seasonAccess?.availableCases || [] : [];
}

function visible(row,uid){
  const sent=row.ownerId===uid;
  return {id:row.id,caseId:row.caseId,direction:sent?'sent':'received',status:row.status,
    partnerName:sent?row.guestName:row.ownerName,partnerEmail:otherEmail(row,uid)||null,
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

async function startWaiting(store,user,id,email,now,scope){
  const uid=user.userId;
  const data=await store.getMemberData(uid);
  const recent=(data.partnerMailTimes||[]).filter(time=>time>now-day);
  if(recent.length>=24||recent.filter(time=>time>now-3600000).length>=8)
    throw new ApiError(429,'Has enviado varias invitaciones. Espera un poco antes de enviar otra.','INVITE_LIMIT');
  const profile=await store.getProfile(uid);
  const row={id:randomUUID(),caseId:id,ownerId:uid,ownerName:profile?.name||user.name||'Tu compañero de juego',
    email,guestId:null,guestName:null,status:'pending',expiresAt:now+7*day,
    progress:{consentVersion:2,ownerScope:scope,ownerEmail:emailAddress(user.email)}};
  await store.createPartner(row);
  if(!await store.reservePartner(uid,id,row.id))throw occupied();
  data.partnerMailTimes=[...recent,now];
  await store.saveMemberData(uid,data);
  await store.enqueueMail(mailKey('case_invitation',row.id),email,'case_invitation',{caseId:id,inviterName:row.ownerName});
  return {ok:true,status:'pending',partner:null};
}

async function accept(store,billing,user,row,now,scope){
  const uid=user.userId;
  if(!hasGameConsent(row)||row.status!=='pending'||row.expiresAt<=now||row.email!==emailAddress(user.email)||row.ownerId===uid)throw unavailable();
  const ownerData=await store.getMemberData(row.ownerId,{readOnly:true});
  if(ownerData.preferredPartnerEmail!==row.email)throw unavailable();
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
  for(const member of [row.ownerId,uid].sort()){
    if(partnerScope(row,member)==='paid')await store.queuePlayNotice?.(member,'pair_confirmed',row.id,{caseId:row.caseId,pairId:row.id});
  }
  return {ok:true,status:'accepted',partner:partnerInfo(row,uid)};
}

async function offerFor(store,billing,uid,email,editorial){
  if(billing?.partnerOffer)return billing.partnerOffer(store,uid,email,editorial);
  return {...publicPartnerOffer,eligible:false,status:editorial?'editorial':email?'saved':'no_partner'};
}

async function clearOtherPartners(store,rows,uid,email){
  for(const candidate of rows){
    const row=await store.getPartner(candidate.id);
    if(row && (!hasGameConsent(row) || !email || otherEmail(row,uid)!==email))await endPair(store,row);
  }
}

async function changePreferred(store,billing,uid,address,newEmail,editorial,expected,now){
  const data=await store.getMemberData(uid);
  const before=data.preferredPartnerEmail || null;
  const rows=await store.listPartners(uid,address,now);
  const hasPartnerGames=rows.some(row=>hasGameConsent(row)&&hasOwnChoice(row,uid));
  const previousOffer=await offerFor(store,billing,uid,before,editorial);
  if(typeof expected.expectEligible==='boolean' && expected.expectEligible!==previousOffer.eligible)
    throw new ApiError(409,'La promoción ha cambiado. Revisa tu próxima cuota antes de confirmar.','PARTNER_OFFER_CHANGED');
  if(typeof expected.expectPartnerGames==='boolean' && expected.expectPartnerGames!==hasPartnerGames)
    throw new ApiError(409,'El estado de tus partidas ha cambiado. Revisa tu compañero antes de confirmar.','PARTNER_GAMES_CHANGED');
  if(before===newEmail)return {preferredEmail:before,partnerOffer:previousOffer,hasPartnerGames,changed:false};
  // Ending a pair writes its personal checkpoints. Read the member again afterwards
  // so saving the email cannot overwrite those writes.
  await clearOtherPartners(store,rows,uid,newEmail);
  const latest=await store.getMemberData(uid);
  if(newEmail)latest.preferredPartnerEmail=newEmail;
  else delete latest.preferredPartnerEmail;
  await store.saveMemberData(uid,latest);
  const partnerOffer=billing?.updatePartnerPreference
    ? await billing.updatePartnerPreference(store,uid,before,newEmail,editorial)
    : await offerFor(store,billing,uid,newEmail,editorial);
  return {preferredEmail:newEmail,partnerOffer,hasPartnerGames:false,changed:true};
}

async function chooseTogether(store,billing,user,input,now,editorial){
  const uid=user.userId,address=emailAddress(user.email),id=input?.caseId;
  if(!Number.isInteger(id)||id<1||id>WORLD_CASE_COUNT||Object.hasOwn(input,'email'))
    throw new ApiError(400,'Elige un juego y usa la persona guardada en tu perfil.','INVALID_INVITATION');
  const scope=editorial?'editorial':'paid';
  const data=await store.getMemberData(uid);
  let email=data.preferredPartnerEmail || null;
  let selected=null,changed=false;
  if(input.invitationId!==undefined || input.saveIfEmpty!==undefined){
    if(typeof input.invitationId!=='string'||input.invitationId.length!==36||input.saveIfEmpty!==true)throw unavailable();
    selected=await store.getPartner(input.invitationId);
    if(!hasGameConsent(selected) || selected.caseId!==id || selected.email!==address || selected.ownerId===uid ||
       (selected.status!=='pending' && !(selected.status==='accepted'&&selected.guestId===uid)) ||
       (selected.status==='pending' && selected.expiresAt<=now))throw unavailable();
    if(email && email!==selected.progress.ownerEmail)
      throw new ApiError(409,'Ya tienes otra persona guardada. Puedes cambiarla en tu perfil.','PARTNER_MISMATCH');
    if(!email){
      email=selected.progress.ownerEmail;
      if(!emailValid(email)||email===address)throw unavailable();
      changed=(await changePreferred(store,billing,uid,address,email,editorial,{},now)).changed;
    }
  }
  if(!email)throw needPreferred();
  await requireCase(store,billing,uid,id,scope);
  const bucket=createHash('sha256').update(JSON.stringify([id,...[address,email].sort()])).digest().readUInt16BE(0)%4096;
  if(store.lockCasePair)await store.lockCasePair(bucket);
  let reserved=await store.getCasePartner(uid,id,now);
  if(reserved && (!hasGameConsent(reserved) || otherEmail(reserved,uid)!==email)){
    await endPair(store,reserved);reserved=null;
  }
  if(reserved){
    if(partnerScope(reserved,uid)!==scope || (selected && reserved.id!==selected.id))throw occupied();
    if(reserved.status==='accepted'){
      const other=reserved.ownerId===uid?reserved.guestId:reserved.ownerId;
      await requireCase(store,billing,other,id,partnerScope(reserved,other));
      return {ok:true,status:'accepted',partner:partnerInfo(reserved,uid),changed};
    }
    return {ok:true,status:'pending',partner:null,changed};
  }
  const waiting=store.pendingCaseChoices ? await store.pendingCaseChoices(address,id,now)
    : await store.listPartners(uid,address,now);
  const counterpart=waiting.find(row=>hasGameConsent(row) && row.caseId===id && row.ownerId!==uid &&
    row.email===address && row.progress.ownerEmail===email && row.status==='pending' && row.expiresAt>now);
  if(selected && selected.id!==counterpart?.id)throw unavailable();
  const decision=counterpart ? await accept(store,billing,user,counterpart,now,scope)
    : await startWaiting(store,user,id,email,now,scope);
  return {...decision,changed};
}

export async function partnerRequest({path,method,input,user,withStore,billing,editorial=false}){
  const uid=user.userId,email=emailAddress(user.email);
  if(user.emailVerified!==true||!emailValid(email))throw new ApiError(403,'Verifica tu correo para gestionar tus invitaciones.','EMAIL_NOT_VERIFIED');
  const match=/^\/api\/partners\/([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})\/(accept|decline|revoke)$/.exec(path);
  const preference=path==='/api/partners/preferred';
  const play=path==='/api/partners/play';
  if(!match && !preference && !play && path!=='/api/partners')throw unavailable();
  const result=await withValdemarTransaction(withStore,async store=>{
    const now=Date.now();
    if(preference){
      if(method==='GET'){
        const preferredEmail=(await store.getMemberData(uid,{readOnly:true})).preferredPartnerEmail || null;
        const rows=await store.listPartners(uid,email,now);
        return {preferredEmail,partnerOffer:await offerFor(store,billing,uid,preferredEmail,editorial),
          hasPartnerGames:rows.some(row=>hasGameConsent(row) && hasOwnChoice(row,uid))};
      }
      if(method==='POST'){
        const preferredEmail=input?.email===null?null:emailAddress(input?.email);
        if(preferredEmail!==null && (!emailValid(preferredEmail) || preferredEmail===email))
          throw new ApiError(400,'Escribe un correo válido distinto del tuyo.','INVALID_PARTNER_EMAIL');
        return changePreferred(store,billing,uid,email,preferredEmail,editorial,input||{},now);
      }
    }else if(play){
      if(method==='POST')return chooseTogether(store,billing,user,input,now,editorial);
    }else if(!match){
      if(method==='GET'){
        const rows=await store.listPartners(uid,email,now);
        const preferredEmail=(await store.getMemberData(uid,{readOnly:true})).preferredPartnerEmail || null;
        const choices=rows.filter(row=>hasGameConsent(row) &&
          (otherEmail(row,uid)===preferredEmail || !preferredEmail && row.status==='pending' && row.email===email));
        return {invitations:choices.map(row=>visible(row,uid)),availableCases:await partnerCases(store,billing,uid,{editorial}),preferredEmail,
          partnerOffer:await offerFor(store,billing,uid,preferredEmail,editorial)};
      }
      if(method==='POST')throw chooseInGame();
    }else if(method==='POST'){
      if(match[2]==='accept')throw chooseInGame();
      const row=await store.getPartner(match[1]);
      if(!row || (row.status==='pending' && row.expiresAt<=now))throw unavailable();
      const authorized=match[2]==='decline'
        ? row.status==='pending' && row.email===email && row.ownerId!==uid
        : row.ownerId===uid || row.status==='accepted' && row.guestId===uid;
      if(!authorized)throw unavailable();
      await endPair(store,row);
      return {ok:true};
    }
    throw new ApiError(405,'Método no permitido.');
  });
  if(!Object.hasOwn(result,'changed'))return result;
  const {changed,...response}=result;
  if(changed && !editorial && billing?.refreshPartnerOffer)await billing.refreshPartnerOffer(withStore,uid).catch(()=>{});
  return response;
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
    mergeInventory(record,row.progress);
    if (row.progress.missionPrize) creditSecretMission(data,scope,row.caseId,row.progress.missionPrize);
    record.hourStep=Math.max(record.hourStep||0,row.progress.hourStep||0);
    mergeStageEvidence(record,row.progress);
    if(row.progress.deduced)record.deduced=true;
    if(row.progress.choice && !record.choice){
      record.choice=row.progress.choice;
      if(action==='end')await notifyEnding(store,uid,data,scope,row.caseId);
    }
    recordCaseActivity(data,scope,row.caseId,started,action);
    if(scope==='paid')await store.touchNoticeActivity?.(uid);
    await store.saveMemberData(uid,data);
  }
}
