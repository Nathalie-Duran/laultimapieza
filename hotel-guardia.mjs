import {ApiError} from './auth-provider.mjs';

const HOUR = 60 * 60 * 1000;
// Values describe physical positions, from left to right, on each workstation.
const solutions = [
  {A:[2,0,1], B:[1,2,0]},
  {A:[2,1,3], B:[1,2,1]},
  {A:[2,0,2], B:[1,2,0]},
  {A:[1,2,0], B:[2,0,1]},
  {A:[1,0,2], B:[2,1,0]}
];
const archiveOrder = [
  {A:'2130',B:'3021'}, {A:'1203',B:'2130'}, {A:'3012',B:'1302'},
  {A:'2013',B:'3102'}, {A:'1320',B:'2031'}
];
function reject(message) { throw new ApiError(409,message,'HOTEL_GUARDIA'); }
export function operateHotel(story,record,role,input,now=Date.now()) {
  if (story.id!==2 || !story.hour?.hotel || record.choice) reject('Esta guardia ya no está disponible.');
  const index=record.hourStep || 0;
  if(input.index!==index || !solutions[index]) reject('Vuelve a abrir la etapa actual.');
  if(!['A','B'].includes(input.desk) || (role && role!==input.desk)) reject('Esta mesa corresponde al otro puesto.');
  const guard=record.hotelShift ||= {start:now,done:{}};
  if(input.operation==='hotel-start'){
    if(guard.opened)return false;
    guard.opened=true;
  } else {
    const key=index+input.desk;
    if(guard.done[key])return false;
    if(input.operation==='hotel-archive'){
      const shelf=guard.archives ||= {};
      if(shelf[key])return false;
      if(!Array.isArray(input.order) || input.order.length!==4 || input.order.join('')!==archiveOrder[index][input.desk])reject('Las cuatro fichas aún no forman una cadena. Contrasta las marcas de entrada y salida.');
      shelf[key]=true;
      record.inventoryRevision=(record.inventoryRevision||0)+1;
      return true;
    }
    if(!guard.archives?.[key])reject('Reconstruye primero el expediente de esta mesa.');
    if(index===3 && (record.hotelInventory?.witnesses?.length || 0)<3)
      reject('Visita a los tres testigos y enséñales sus objetos antes de cotejar las declaraciones.');
    const correct=solutions[index][input.desk];
    if(!Array.isArray(input.positions) || input.positions.length!==correct.length || !correct.every((v,i)=>input.positions[i]===v))
      reject('Las marcas no coinciden. Contrasta cada posición con el documento del otro puesto.');
    guard.done[key]=true;
  }
  record.inventoryRevision=(record.inventoryRevision||0)+1;
  return true;
}
export function hotelReadout(record){
  const guard=record?.hotelShift;
  return {done:guard?.done||{},archives:guard?.archives||{},opensAt:guard?guard.start+HOUR:null};
}
export function requireHotelDesk(story,record,index,now=Date.now()){
  if(story.id!==2 || !story.hour?.hotel || record.choice)return;
  const {done,opensAt}=hotelReadout(record);
  if(!done[index+'A']||!done[index+'B'])reject('Completa Recepción y Turno de noche para avanzar.');
  if(index===4 && now<opensAt)reject('La devolución de llamada se abre al cumplir la hora de guardia. Faltan '+Math.ceil((opensAt-now)/60000)+' min.');
}
