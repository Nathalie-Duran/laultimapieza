import {ApiError} from './auth-provider.mjs';

export function createMansionNotebook(rooms,levels) {
  const byId=new Map(),byEntry=new WeakMap();
  function register(id,room,from,entry) {
    byId.set(id,{room,from,entry});
    byEntry.set(entry,id);
  }
  for(const [room,,from,placeA,placeB] of rooms) {
    for(const [role,text] of [['A',placeA],['B',placeB]]) {
      const id=room+'-entorno-'+role;
      register(id,room,from,{id,role,title:role==='A'?'Casa habitada':'Casa abandonada',text});
    }
  }
  for(const [index,stage] of levels.entries()) {
    for(const [offset,entry] of stage.evidence.entries()) {
      register('prueba-'+(index+1)+'-'+(offset+1),stage.room,index+1,entry);
    }
  }
  function known(state,role) {
    const result=[];
    for(const value of Array.isArray(state.discoveries)?state.discoveries:[]) {
      if(typeof value!=='string')continue;
      const [world,id]=value.split(':');
      const item=byId.get(id);
      if(!item||item.from>state.current||(role!=='solo'&&world!==role))continue;
      result.push({...item.entry,id,world,roomId:item.room});
    }
    return result;
  }
  function observe(state,role,input) {
    const {world,evidenceId,roomId}=input;
    if(!['A','B'].includes(world)||role!=='solo'&&world!==role)throw new ApiError(403,'Ese hallazgo pertenece a la otra casa.');
    const item=byId.get(evidenceId);
    if(!item||item.room!==roomId||item.from>state.current)throw new ApiError(404,'Ese objeto no está disponible en esta habitación.');
    if(['A','B'].includes(item.entry.role)&&item.entry.role!==world)throw new ApiError(403,'Ese hallazgo pertenece a la otra casa.');
    const token=world+':'+evidenceId;
    if(!Array.isArray(state.discoveries))state.discoveries=[];
    if(state.discoveries.includes(token))return {changed:false,correct:true,message:''};
    state.discoveries.push(token);
    return {changed:true,correct:true,message:''};
  }
  return {
    idFor:entry=>byEntry.get(entry),
    roomPlace:(room,role)=>byId.get(room+'-entorno-'+role)?.entry,
    known,observe
  };
}
