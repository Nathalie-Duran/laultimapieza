import {createHash} from 'node:crypto';
import {ApiError} from './auth-provider.mjs';

const reward=10;
const fail=(status,message)=>{throw new ApiError(status,message,'EXPLORER');};
function choices(values,id,kind){
  return values.map(label=>({label,value:createHash('sha256').update(id+'|'+kind+'|'+label).digest('hex').slice(0,16)}));
}
const order=items=>[...items].sort((a,b)=>a.value.localeCompare(b.value));
export function explorerCollection(data,scope){
  const records=data.valdemarCaseProgress?.[scope] || {};
  const entries=Object.values(records).map(record=>record?.explorerLup?.discovery).filter(Boolean)
    .sort((a,b)=>b.at-a.at || a.caseId-b.caseId);
  return {entries,total:entries.length,points:entries.length*reward};
}

// Samples describe optional observations in the current edition. They never contain campaign clues.
export async function explorerCase({store,uid,scope,data,story,record,role,mode,waiting,pairId,input,method}){
  if(!mode||waiting)fail(409,'Entra en la partida para examinar la muestra. En pareja, ambos debéis haber confirmado la modalidad.');
  const def=story?.explorador;
  if(!def || !Array.isArray(def.names) || def.names.length<3 || !def.signs?.A || !def.signs?.B)fail(503,'La ficha de campo todavía no está disponible.');
  const id=story.id;
  const mansion=id===1 && record?.mansionEdition==='mansion';
  const stage=mansion?record.mansion?.current||1:(record?.choice?5:(record?.hourStep||0)+1);
  const threshold=mansion?(def.mansionStage||def.stage):def.stage;
  const previous=data.valdemarCaseProgress?.[scope]?.[id]?.explorerLup || {};
  const discovery=previous.discovery;
  const base={caseId:id,partnerId:pairId||null,reward,points:explorerCollection(data,scope).points};
  if(discovery)return {...base,discovery,awarded:0};
  if(stage<threshold){
    if(method==='POST')fail(409,'Aún no has llegado al lugar de este hallazgo.');
    return {...base,locked:true,stage:threshold};
  }
  const viewRoles=role?[role]:['A','B'];
  const names=choices(def.names,id,'name');
  const signs=viewRoles.flatMap(r=>choices(def.signs[r],id,'sign'));
  const evidenceChoices=order([...new Map(signs.map(option=>[option.value,option])).values()]);
  const examined=previous.examined || [];
  const context=pairId || (role?'editorial-'+role:'solo');
  const ready=examined.includes(context);
  const view=shown=>({...base,examined:shown,location:def.location,category:def.category,
    ...(shown?{clues:viewRoles.map(r=>({role:r,text:def.clues[r]})),names:order(names),signs:evidenceChoices}:{})});
  if(method==='GET')return view(ready);
  if(!['examine','identify'].includes(input?.op))fail(400,'Elige si quieres examinar la muestra o comprobar su identificación.');
  const persist=async state=>{
    const cases=(data.valdemarCaseProgress ||= {})[scope] ||= {};
    (cases[id] ||= {}).explorerLup=state;
    await store.saveMemberData(uid,data);
  };
  if(input.op==='examine'){
    if(!ready)await persist({...previous,examined:[context]});
    return view(true);
  }
  if(!ready)fail(409,'Examina primero la muestra en esta partida.');
  const correctSigns=viewRoles.map(r=>choices(def.signs[r],id,'sign')[0].value);
  if(input.name!==names[0].value || !correctSigns.includes(input.sign))
    return {...view(true),correct:false,message:'La identificación y el rasgo elegido deben coincidir con lo que has observado.'};
  const result={caseId:id,caseTitle:story.title,category:def.category,name:def.names[0],
    location:def.location,description:def.description,at:Date.now(),points:reward};
  await persist({discovery:result});
  return {...base,points:base.points+reward,discovery:result,correct:true,awarded:reward};
}
