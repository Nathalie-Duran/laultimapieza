import {randomInt,randomUUID} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {hasGameConsent,partnerScope} from './partner-api.mjs';
import {markRoomCooperation} from './valdemar-wallet.mjs';

// The two inventories use different labels. Neither player receives the other half of the key.
const objects={
  archivo:['el sello ovalado','el sello de cobre','el sello de lacre'],
  relojero:['la rueda central','el piñón','la rueda de salida'],
  museo:['la luna de plata','el ancla de latón','el caballo de marfil'],
  cartas:['la hebilla','el cuaderno','el sobre'],
  jardin:['el rosal','los lirios','el aljibe'],
  espejo:['el reloj','el ancla','la luna'],
  luces:['la lámpara del muelle','la lámpara de punta','la lámpara del dique'],
  portulano:['la carta del istmo','la carta de la rada','la carta del cabo'],
  compases:['el compás de cobre','el compás de boj','el compás de hueso'],
  atraques:['la vela gris','el junco','la gabarra'],
  calcos:['el calco de lacre','el calco de cera','el calco de humo'],
  mareas:['el dibujo de la gaviota','el dibujo del ancla','el dibujo de la soga'],
  negativos:['el sobre Perla','el sobre Jade','el sobre Nácar'],
  bobina:['el trozo Hilo','el trozo Humo','el trozo Polvo'],
  focos:['el foco Alto','el foco Rojo','el foco Bajo'],
  guardarropa:['la gabardina','el chal','el sombrero'],
  domino:['la ficha de coral','la ficha de ébano','la ficha de olmo'],
  'tercera-silla':['la ficha de miel','la ficha azul','la ficha de hueso'],
  improntas:['el sello de loto','el sello de limo','el sello de junco'],
  vasijas:['la vasija de la garza','la vasija del pez','la vasija del junco'],
  sombras:['el relieve del ibis','el relieve del ojo','el relieve del remo'],
  balanza:['la pesa de jaspe','la pesa de jade','la pesa de pizarra'],
  lino:['la gasa','la cinta','la estera'],
  barca:['la tablilla de cedro','la tablilla de loto','la tablilla de cobre']
};
const marks=['círculo','triángulo','estrella'];
const drawers=['cajón superior','cajón central','cajón inferior'];
const conflict=()=>new ApiError(409,'La ronda en pareja ha cambiado. Vuelve a abrir su ficha.','ARCADE_ROUND_CHANGED');
const bit=role=>role==='A'?1:2;
const has=(mask,role)=>Boolean(mask&bit(role));

export async function arcadePair(store,billing,uid,caseId,scope){
  const row=await store.getCasePartner?.(uid,caseId,Date.now());
  if(!hasGameConsent(row)||row.status!=='accepted'||row.caseId!==caseId||!row.guestId||row.ownerId===row.guestId||
     (row.ownerId!==uid&&row.guestId!==uid)||partnerScope(row,uid)!==scope)return null;
  const other=row.ownerId===uid?row.guestId:row.ownerId;
  if(partnerScope(row,other)!=='editorial'){
    const membership=await billing?.membership(store,other,{readOnly:true});
    if(!membership?.seasonAccess?.availableCases?.includes(caseId))return null;
  }
  return {row,role:uid===row.ownerId?'A':'B'};
}

function preparation(station,variant,role){
  const pieces=objects[station],markFor=i=>(i+Math.floor(variant/3))%3,drawerFor=j=>(j+variant%3)%3;
  const options=labels=>labels.map((label,i)=>({id:String(i+1),label}));
  if(role==='A'){
    return {material:pieces.map((p,i)=>p+' lleva la marca '+marks[markFor(i)]+'.'),
      prompt:'Averigua con tu compañero en qué cajón se guarda '+pieces[0]+'.',
      options:options(drawers),answer:String(drawerFor(markFor(0))+1)};
  }
  return {material:marks.map((m,j)=>'La marca '+m+' indica el '+drawers[drawerFor(j)]+'.'),
    prompt:'Pregunta a tu compañero qué pieza abre el '+drawers[1]+'.',
    options:options(pieces),answer:String(pieces.findIndex((_,i)=>drawerFor(markFor(i))===1)+1)};
}
function phase(s){return s.solved?'solved':s.joined!==3?'waiting':s.prepared!==3?'prepare':'play';}
export function arcadePairView(pair){
  if(!pair)return null;
  const {row,role}=pair,otherRole=role==='A'?'B':'A',stations={};
  for(const [id,s] of Object.entries(row.progress.arcadeRounds||{})){
    if(!Object.hasOwn(objects,id))continue;
    const state={round:s.round,joined:has(s.joined,role),partnerJoined:has(s.joined,otherRole),
      prepared:has(s.prepared,role),partnerPrepared:has(s.prepared,otherRole),phase:phase(s)};
    if(state.phase==='prepare'){
      const {material,prompt,options}=preparation(id,s.variant,role);
      state.card={material,prompt,options};
    }
    stations[id]=state;
  }
  return {partnerId:row.id,partnerName:(role==='A'?row.guestName:row.ownerName)||'Tu compañero',role,stations};
}
function newRound(previous,role){
  return {round:randomUUID(),variant:previous?(previous.variant+1)%9:randomInt(9),joined:bit(role),prepared:0,solved:false,initial:!previous};
}

export async function playArcadePair({store,pair,input,caseId,validate,award,prize}){
  const {coop,id}=input;
  if(!pair||!coop||typeof coop!=='object'||coop.partnerId!==pair.row.id)throw conflict();
  const {row,role}=pair,rounds=row.progress.arcadeRounds||{},s=rounds[id],flag=bit(role);
  if(coop.op!=='join'&&(!s||coop.round!==s.round))throw conflict();
  let correct,awarded,changed=false;
  switch(coop.op){
    case 'join':
      if(s&&coop.round!==s.round&&(coop.round!=null||!s.initial))throw conflict();
      if(!s){if(coop.round!=null)throw conflict();rounds[id]=newRound(null,role);changed=true;}
      else if(!s.solved&&!has(s.joined,role)){s.joined|=flag;changed=true;}
      break;
    case 'leave':
      if(!s.solved&&has(s.joined,role)){
        s.joined&=~flag;s.prepared=0;s.initial=false;s.round=randomUUID();changed=true;
      }
      break;
    case 'replay':
      if(!s.solved)throw conflict();
      rounds[id]=newRound(s,role);changed=true;break;
    case 'prepare':
      if(s.joined!==3||s.solved)throw conflict();
      correct=coop.answer===preparation(id,s.variant,role).answer;
      if(correct&&!has(s.prepared,role)){s.prepared|=flag;changed=true;}
      break;
    case 'solve':
      if(s.solved)return {coop:arcadePairView(pair),correct:true,awarded:0};
      if(phase(s)!=='play')throw conflict();
      correct=validate(id,input.attempt);awarded=0;
      if(correct){
        for(const member of [row.ownerId,row.guestId].sort()){
          const scope=partnerScope(row,member),data=await store.getMemberData(member);
          const fresh=award(data,scope,id,prize);
          const cooperation=markRoomCooperation(data,scope,caseId,id);
          if(fresh||cooperation)await store.saveMemberData(member,data);
          if(fresh&&member===(role==='A'?row.ownerId:row.guestId))awarded=prize;
        }
        s.solved=true;changed=true;
      }
      break;
    default:throw new ApiError(400,'Acción de sala en pareja desconocida.');
  }
  if(changed){row.progress.arcadeRounds=rounds;await store.savePartner(row);}
  return {coop:arcadePairView(pair),...(correct!==undefined?{correct}:{}),...(awarded!==undefined?{awarded}:{})};
}
