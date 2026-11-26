import {ApiError} from './auth-provider.mjs';

function outline({title,place,minutes}) {
  return {title,place,minutes};
}

function reading(stage) {
  const {brief,task,materials} = stage;
  return {...outline(stage),brief,task,materials:materials.map(({id,label,kind,body,role}) => ({id,label,kind,body,role}))};
}

function savedCount(record,total) {
  return Number.isInteger(record?.hourStep) ? Math.max(0,Math.min(total,record.hourStep)) : 0;
}

export function readHour(story,record) {
  if (!story.hour) return null;
  const {stages,hotel} = story.hour;
  const count = savedCount(record,stages.length);
  // An existing permanent ending remains accessible across this content revision.
  const current = record?.choice ? stages.length : count;
  const active = stages[current];
  const stage = active ? {...reading(active),mode:active.mode,options:active.options.map(({id,label}) => ({id,label}))} : null;
  const journal = stages.slice(0,count).map((value,index) => ({index,...reading(value),success:value.success}));
  return {stages:stages.map(outline),current,stage,journal,...(hotel ? {hotel} : {})};
}

export function requireHourComplete(story,record) {
  const stages = story.hour?.stages;
  if (stages && !record.choice && savedCount(record,stages.length) < stages.length) {
    throw new ApiError(409,'Completa las etapas de investigación antes de cerrar la deducción.','HOUR_STAGES_REQUIRED');
  }
}

export function evaluateHourStage(story,record,input) {
  const stages = story.hour?.stages;
  if (!stages) throw new ApiError(404,'Esta edición del expediente no incluye etapas.');
  const {index,choice} = input || {};
  if (!Number.isInteger(index) || index < 0 || index >= stages.length) throw new ApiError(400,'Indica una etapa válida.');
  const count = savedCount(record,stages.length);
  if (index > count || (record.choice && index >= count)) {
    throw new ApiError(409,'Vuelve al cuaderno para consultar la etapa actual.','HOUR_STAGE_CHANGED');
  }
  const stage = stages[index];
  const allowed = new Set(stage.options.map(option => option.id));
  if (!Array.isArray(choice) || !choice.length || choice.length > allowed.size ||
      (stage.mode === 'single' && choice.length !== 1) ||
      new Set(choice).size !== choice.length || !choice.every(id => allowed.has(id))) {
    throw new ApiError(400,'Elige las opciones del expediente que quieres contrastar.');
  }
  const {answer} = stage;
  const correct = choice.length === answer.length && (stage.mode === 'multi'
    ? answer.every(id => choice.includes(id)) : answer.every((id,i) => choice[i] === id));
  const advanced = index === count && correct;
  if (advanced) record.hourStep = count + 1;
  return {advanced,correct,feedback:correct ? stage.success : stage.retry};
}
