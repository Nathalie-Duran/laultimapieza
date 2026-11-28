import {ApiError} from './auth-provider.mjs';
import {creditSeasonArcade,withValdemarTransaction} from './valdemar-wallet.mjs';
import {estacionesDeSala,validaEstacion} from './salas-soluciones.mjs';

const prizes=[1,1,1,2,1,2];

export async function seasonArcadeRequest({season,method,input,uid,editorial,withStore,billing}){
  if(method!=='GET'&&method!=='POST')throw new ApiError(405,'Método no permitido.');
  const caseId=1+(season-1)*12;
  const ids=estacionesDeSala(season);
  return withValdemarTransaction(withStore,async store=>{
    if(!editorial){
      const membership=await billing?.membership(store,uid,{readOnly:true});
      if(!membership?.seasonAccess?.availableCases?.includes(caseId)){
        throw new ApiError(403,'La sala se abre al tener acceso al primer juego de esta temporada.','SEASON_ROOM_ACCESS_REQUIRED');
      }
    }
    const scope=editorial?'editorial':'paid';
    if(method==='GET'){
      const data=await store.getMemberData(uid,{readOnly:true});
      const entries=data.valdemarSeasonOne?.[scope]?.entries||[];
      const solved=new Set(entries.filter(e=>e.kind==='seasonArcade'&&e.caseId===caseId).map(e=>e.id));
      return {games:ids.map((id,i)=>({id,prize:prizes[i],solved:solved.has(caseId+'/'+id)}))};
    }
    const index=ids.indexOf(input?.id);
    if(index<0)throw new ApiError(400,'Elige una estación de esta sala.');
    if(!validaEstacion(season,input.id,input.attempt))return {correct:false,awarded:0};
    const data=await store.getMemberData(uid);
    const fresh=creditSeasonArcade(data,scope,caseId,input.id,prizes[index]);
    if(fresh)await store.saveMemberData(uid,data);
    return {correct:true,awarded:fresh?prizes[index]:0};
  });
}
