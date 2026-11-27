import {ApiError} from './auth-provider.mjs';

const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const dayMs=86400000;
const invalid=()=>new ApiError(400,'Revisa el calendario del desafío. Introduce fechas válidas y un cierre igual o posterior a la apertura.');

function calendarDay(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))throw invalid();
  const time=Date.parse(value+'T12:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw invalid();
  return time;
}

// Each publication represents one playable edition. Its dates are calendar days in Madrid.
export function normalizeChallengeSchedule(value) {
  const kind=value==null?'always':value.kind;
  if(kind==='always')return {kind,startsOn:null,endsOn:null};
  if(!['daily','weekly','event'].includes(kind))throw invalid();
  const start=calendarDay(value.startsOn);
  const end=kind==='event'?calendarDay(value.endsOn):start+(kind==='weekly'?6:0)*dayMs;
  if(end<start || new Date(end).getUTCFullYear()>9999)throw invalid();
  return {kind,startsOn:value.startsOn,endsOn:new Date(end).toISOString().slice(0,10)};
}

export function isChallengeAvailable(item,now=Date.now()) {
  if(item.status!=='published')return false;
  if(!item.schedule || item.schedule.kind==='always')return true;
  const parts=Object.fromEntries(localDay.formatToParts(now).map(p=>[p.type,p.value]));
  const today=parts.year+'-'+parts.month+'-'+parts.day;
  return today>=item.schedule.startsOn && today<=item.schedule.endsOn;
}
