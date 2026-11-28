import {ApiError} from './auth-provider.mjs';
import {trialEvent} from './aventuras-autor.mjs';
import {creditSeasonArcade,withValdemarTransaction} from './valdemar-wallet.mjs';
import {estacionesDeSala,validaEstacion} from './salas-soluciones.mjs';
import {arcadePair,arcadePairView,playArcadePair} from './arcade-cooperation.mjs';

const prizes=[1,1,1,2,1,2];

export async function seasonArcadeRequest({season,method,input,uid,editorial,withStore,billing}){
  if(method!=='GET'&&method!=='POST')throw new ApiError(405,'Método no permitido.');
  const caseId=1+(season-1)*12;
  const ids=estacionesDeSala(season);
  return withValdemarTransaction(withStore,async store=>{
    const scope=editorial?'editorial':'paid';
    if(!editorial){
      const membership=await billing?.membership(store,uid,{readOnly:true});
      if(!membership?.seasonAccess?.availableCases?.includes(caseId)){
        throw new ApiError(403,'La sala se abre al tener acceso al primer juego de esta temporada.','SEASON_ROOM_ACCESS_REQUIRED');
      }
    }
    if(method==='GET'){
      const pair=await arcadePair(store,billing,uid,caseId,scope);
      const data=await store.getMemberData(uid,{readOnly:true});
      const entries=data.valdemarSeasonOne?.[scope]?.entries||[];
      const solved=new Set(entries.filter(e=>e.kind==='seasonArcade'&&e.caseId===caseId).map(e=>e.id));
      return {games:ids.map((id,i)=>({id,prize:prizes[i],solved:solved.has(caseId+'/'+id)})),coop:arcadePairView(pair)};
    }
    const index=ids.indexOf(input?.id);
    if(index<0)throw new ApiError(400,'Elige una estación de esta sala.');
    if(Object.hasOwn(input,'coop'))return playArcadePair({store,pair:await arcadePair(store,billing,uid,caseId,scope),input,caseId,prize:prizes[index],
      validate:(id,attempt)=>validaEstacion(season,id,attempt),
      award:(data,scope,id,prize)=>creditSeasonArcade(data,scope,caseId,id,prize)});
    const correct=validaEstacion(season,input.id,input.attempt);
    if(!editorial)await trialEvent(store,{game:'juego/'+caseId,edition:0,trial:input.id,participant:'u/'+uid,solved:correct});
    if(!correct)return {correct:false,awarded:0};
    const data=await store.getMemberData(uid);
    const fresh=creditSeasonArcade(data,scope,caseId,input.id,prizes[index]);
    if(fresh)await store.saveMemberData(uid,data);
    return {correct:true,awarded:fresh?prizes[index]:0};
  });
}
