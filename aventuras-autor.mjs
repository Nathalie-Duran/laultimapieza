import {createHash} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';
import {hasGameConsent,partnerCases,partnerInfo,partnerScope} from './partner-api.mjs';
import {withValdemarTransaction} from './valdemar-wallet.mjs';

const fail=(status,text)=>{throw new ApiError(status,text);};
const slug=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,62}$/.test(id)&&!Object.hasOwn(Object.prototype,id);
export function trialEvent(store,{game,edition,trial,participant,solved,at=Date.now()}){
  return store.noteTrial?.({game,edition,trial,participant:createHash('sha256').update('trial/'+participant).digest('hex'),at,solved});
}
export async function authorAdmin(store,id,method,input,engine){
  if(method==='GET'){
    if(!id)return {aventuras:await store.listAuthorTitles(true)};
    return await store.authorDraft(id)||fail(404,'Borrador no encontrado.');
  }
  if(method!=='PUT'||!id)fail(405,'Método no permitido.');
  if(!slug(id)||input.definition?.id!==id||!Number.isInteger(input.version)||input.version<0||
    !Number.isInteger(input.caseId)||input.caseId<1||input.caseId>48||typeof input.publish!=='boolean')fail(400,'Revisa el identificador, el juego de acceso y la revisión.');
  const errors=engine.validar(input.definition);
  if(errors.length)fail(400,'Revisa la aventura. '+String(errors[0]).slice(0,240));
  return store.saveAuthorDraft({id,caseId:input.caseId,version:input.version,definition:input.definition,publish:input.publish});
}
async function allowed(store,billing,uid,editorial){
  if(editorial)return Array.from({length:48},(_,i)=>i+1);
  return (await billing?.membership(store,uid,{readOnly:true}))?.seasonAccess?.availableCases||[];
}
function observation(record,release,engine,modo,papel){
  const estado=record?.estado||engine.iniciar(release.definition,modo);
  return {id:release.id,titulo:release.definition.titulo,caseId:release.caseId,revision:release.revision,paso:record?.paso||0,
    modo,papel,vista:engine.vista(release.definition,estado,papel),completada:estado.completada===true};
}
export async function authorPlay({id,method,input,params,uid,editorial,billing,withStore,engine}){
  if(!['GET','POST'].includes(method)||(!id&&method!=='GET'))fail(405,'Método no permitido.');
  const scope=editorial?'editorial':'paid';
  return withValdemarTransaction(withStore,async store=>{
    const cases=await allowed(store,billing,uid,editorial);
    const data=await store.getMemberData(uid,{readOnly:method==='GET'});
    const album=data.authorAdventures?.[scope]||{};
    if(!id){
      const titles=(await store.listAuthorTitles()).filter(t=>cases.includes(t.caseId));
      const aventuras=[];
      for(const title of titles){
        const entry=album[title.id]||{};
        let last=entry.solo;
        if(entry.duo&&(!last||entry.duo.at>last.at)){
          const pair=await store.getCasePartner(uid,title.caseId,Date.now());
          if(pair?.id===entry.duo.pairId&&pair.status==='accepted'&&hasGameConsent(pair)&&partnerScope(pair,uid)===scope)last=entry.duo;
          else if(!last&&entry.duo.estado)last={...entry.duo,modo:'solo'};
        }
        aventuras.push({...title,titulo:last?.titulo||title.titulo,revision:last?.revision||title.revision,modo:last?.modo||'solo',empezada:!!last,completada:last?.completada===true,actualizada:last?.at||null});
      }
      return {aventuras};
    }
    if(!slug(id))fail(404,'Aventura no disponible.');
    const modo=(method==='GET'?params.get('modo'):input.modo)||'solo';
    if(!['solo','duo'].includes(modo))fail(400,'Elige una modalidad válida.');
    const current=await store.authorRelease(id);
    if(!current||!cases.includes(current.caseId))fail(404,'Esta aventura no está disponible para tu cuenta.');
    const requestedRole=method==='GET'?params.get('papel'):input.papel;
    let papel=requestedRole||'A',pair=null;
    if(modo==='duo'){
      pair=await store.getCasePartner(uid,current.caseId,Date.now());
      if(!pair||pair.status!=='accepted'||!hasGameConsent(pair)||partnerScope(pair,uid)!==scope||
        ![pair.ownerId,pair.guestId].includes(uid))fail(409,'Para jugar en pareja, vincula a tu compañero en el juego de esta temporada y entrad los dos.');
      const other=pair.ownerId===uid?pair.guestId:pair.ownerId;
      if(!(await partnerCases(store,billing,other,{editorial:partnerScope(pair,other)==='editorial'})).includes(current.caseId))fail(403,'Tu compañero necesita acceso al mismo juego.');
      papel=partnerInfo(pair,uid).role;
      if(requestedRole&&requestedRole!==papel)fail(403,'Ese papel corresponde a tu compañero.');
    }
    if(!['A','B'].includes(papel))fail(400,'Elige un papel válido.');
    const sharedCopy=album[id]?.duo;
    const saved=pair?await store.authorPairRun(pair.id,id):album[id]?.solo||
      (sharedCopy?.estado?{...sharedCopy,modo:'solo',estado:{...sharedCopy.estado,modo:'solo'}}:null);
    const release=saved&&saved.revision!==current.revision?await store.authorRelease(id,saved.revision):current;
    if(!release)fail(409,'No se ha podido recuperar la edición guardada.');
    const view=record=>({...observation(record,release,engine,modo,papel),pareja:pair?.id||null});
    if(method==='GET')return view(saved);
    if(input.paso!==(saved?.paso||0)||input.revision!==release.revision)fail(409,'La partida ha cambiado. Vuelve a abrirla para continuar.');
    if((input.pareja??null)!==(pair?.id||null))fail(409,'La pareja de esta partida ha cambiado.');
    const estado=saved?.estado||engine.iniciar(release.definition,modo);
    const action={escena:input.escena,accion:input.accion,papel,intento:input.intento};
    const available=engine.vista(release.definition,estado,papel).acciones?.find(a=>a.id===action.accion);
    const result=engine.ejecutar(release.definition,structuredClone(estado),action);
    if(scope==='paid'&&(!pair||partnerScope(pair,pair.ownerId)==='paid'&&partnerScope(pair,pair.guestId)==='paid')&&available?.tipo==='prueba'&&action.escena===engine.vista(release.definition,estado,papel).escena.id){
      await trialEvent(store,{game:'autor/'+id,edition:release.revision,trial:action.escena+'/'+action.accion,participant:pair?'p/'+pair.id:'u/'+uid,solved:result.ok===true});
    }
    if(!result.ok)return {...view(saved),ok:false,mensaje:result.mensaje};
    const record={estado:result.estado,paso:(saved?.paso||0)+1,revision:release.revision,modo,at:Date.now(),titulo:release.definition.titulo,completada:result.estado.completada===true};
    if(pair)await store.saveAuthorPairRun(pair.id,id,record);
    for(const member of pair?[pair.ownerId,pair.guestId]:[uid]){
      const account=member===uid?data:await store.getMemberData(member);
      const role=pair?partnerScope(pair,member):scope;
      const all=account.authorAdventures||={};
      const slot=((all[role]||={})[id]||={});
      if(pair)slot.duo={...record,pairId:pair.id};
      else slot.solo=record;
      await store.saveMemberData(member,account);
    }
    return {...view(record),ok:true,mensaje:result.mensaje};
  });
}
