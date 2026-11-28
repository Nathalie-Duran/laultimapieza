import {inspectInventory} from './expedition.mjs';
import {ApiError} from './auth-provider.mjs';
import './web/motor-aventuras.js';

// These controls describe how to handle the edition's existing evidence.
// The answer, evidence IDs and scoring remain those of the release.
const presentation={
  2:{index:0,mode:'order',cue:'centralita',kind:'centralita'},
  13:{index:2,mode:'order',cue:'boyas',kind:'boyas'},
  25:{index:0,mode:'single',cue:'habitación',kind:'puertas'},
  37:{index:1,mode:'multi',cue:'improntas',kind:'improntas'}
};

function outline({title,place,minutes}) {
  return {title,place,minutes};
}

function visibleMaterial({id,label,kind,body,role,clip}) {
  const material={id,label,kind,body,role};
  if (kind==='audio' && typeof clip==='string' && clip.length<=1500000 &&
      /^data:audio\/wav;base64,UklGR[A-Za-z0-9+/]+={0,2}$/.test(clip)) material.clip=clip;
  return material;
}

export function roleMaterials(items,role) {
  if(role!=='A' && role!=='B')return items;
  const number=role==='A'?1:2;
  return items.filter(item=>item.role==null || item.role==='AB' || item.role===role || item.role===number);
}

function reading(stage,role) {
  const {brief,task,materials} = stage;
  return {...outline(stage),brief,task,materials:roleMaterials(materials,role).map(visibleMaterial)};
}

function savedCount(record,total) {
  return Number.isInteger(record?.hourStep) ? Math.max(0,Math.min(total,record.hourStep)) : 0;
}

export function readHour(story,record,role=null) {
  if (!story.hour) return null;
  const {stages,hotel} = story.hour;
  const count = savedCount(record,stages.length);
  // An existing permanent ending remains accessible across this content revision.
  const current = record?.choice ? stages.length : count;
  const active = stages[current];
  const stage = active ? {...reading(active,role),mode:active.mode,options:active.options.map(({id,label}) => ({id,label}))} : null;
  const design=presentation[story.id];
  if(stage&&design?.index===current&&design.mode===stage.mode&&stage.task.toLowerCase().includes(design.cue)){
    stage.interaction=design.kind;
  }
  if (stage?.mode === 'order') stage.requiredCount = active.answer.length;
  if (active?.instrument) stage.instrument = active.instrument;
  if (active?.corroboration) {
    stage.corroboration = {
      prompt: active.corroboration.prompt,
      count: active.corroboration.answer.length,
      options: active.materials.map(({id,label}) => ({id,label}))
    };
  }
  const journal = stages.slice(0,count).map((value,index) => ({index,...reading(value,role),success:value.success}));
  return {stages:stages.map(outline),current,stage,journal,inventory:inspectInventory(story,record,role),...(hotel ? {hotel} : {})};
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
  const evaluate=globalThis.MotorAventuras.evaluarPrueba;
  const hypothesisMatches=stage.mode==='single'
    ? evaluate({tipo:'seleccion',respuesta:answer[0]},choice[0])
    : evaluate({tipo:stage.mode==='multi'?'conjunto':'secuencia',respuesta:answer},choice);
  const corroboration = stage.corroboration;
  let sourcesMatch = true;
  if (corroboration && index === count) {
    const sources = input.sources;
    if (sources === undefined) {
      return {advanced:false,correct:false,feedback:'Esta etapa incluye un contraste de fuentes. Actualiza la página para ver la mesa completa. Tu avance está guardado.'};
    }
    const evidenceIds = new Set(stage.materials.map(material => material.id));
    if (!Array.isArray(sources) || sources.length !== corroboration.answer.length ||
        new Set(sources).size !== sources.length || !sources.every(id => evidenceIds.has(id))) {
      throw new ApiError(400,'Selecciona las fuentes que pide la etapa.');
    }
    sourcesMatch=evaluate({tipo:'conjunto',respuesta:corroboration.answer},sources);
  }
  const correct = hypothesisMatches && sourcesMatch;
  const advanced = index === count && correct;
  if (advanced) record.hourStep = count + 1;
  const retry = sourcesMatch ? stage.retry : 'Vuelve a comprobar la deducción y qué observación aporta cada fuente que has elegido.';
  return {advanced,correct,feedback:correct ? stage.success : retry};
}
