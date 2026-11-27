import {getFieldInstrument, checkFieldInstrument} from './field-instruments.mjs';
import {ApiError} from './auth-provider.mjs';

const fail = (status, message) => { throw new ApiError(status, message, 'INVENTORY_ACTION'); };
const allowedRole = (item, role) => !role || item.role == null || item.role === 'AB' ||
  item.role === role || item.role === (role === 'A' ? 1 : 2);

function accessible(story, record) {
  const stages = story.hour?.stages || [];
  const count = record?.choice ? stages.length : Math.max(1, (record?.hourStep || 0) + 1);
  return stages.slice(0, count);
}

// Build the optional archive assignment from actual evidence in the released edition.
function missionFor(story) {
  const stages = story.hour?.stages || [];
  const prize = 1 + Math.floor(((story.id - 1) % 12) / 4);
  const target = Math.min((prize - 1) * 2, stages.length - 1);
  const indices = stages.map((_, index) => index).sort((a,b) => Math.abs(a-target)-Math.abs(b-target));
  for (const index of indices) {
    const materials = stages[index].materials.filter(item => item.id != null && typeof item.body === 'string' && item.body.trim());
    const a = materials.find(item => allowedRole(item, 'A') && !allowedRole(item, 'B')) || materials.find(item => allowedRole(item, 'A'));
    const b = materials.find(item => item !== a && allowedRole(item, 'B') && !allowedRole(item, 'A')) ||
      materials.find(item => item !== a && allowedRole(item, 'B'));
    if (a && b) return {index, prize, sources:[a,b]};
  }
  return null;
}

function fragment(text, prize) {
  const words = text.trim().split(/\s+/);
  const size = 11 - 2 * prize;
  const start = Math.max(0, Math.floor((words.length-size)/2));
  return (start ? '…' : '') + words.slice(start,start+size).join(' ') + (start+size < words.length ? '…' : '');
}

export function inspectInventory(story, record, role) {
  const ledger = record?.inventory || {};
  const mission = missionFor(story);
  const rooms = accessible(story, record).map((stage, index) => {
    const page = ledger[index];
    const held = new Set(page?.items);
    const materials = (stage.materials || []).filter(item => item.id != null);
    const items = page ? materials.filter(item => allowedRole(item, role) || held.has(item.id)).map(item => ({
      id: item.id, label: item.label, held: held.has(item.id),
      canCollect: allowedRole(item, role),
      contributed: !role || Boolean(page.contributions?.[role]?.includes(item.id)),
      ...(held.has(item.id) && allowedRole(item, role) ? {detail: item.body} : {})
    })) : [];
    const assignment = mission?.index === index && page ? {
      prize:mission.prize, complete:Boolean(record?.missionPrize),
      fragments:mission.sources.filter(item => allowedRole(item,role)).map(item => fragment(item.body,mission.prize)),
      paired:Boolean(role)
    } : null;
    const instrument = index === 0 && page ? getFieldInstrument(story.id) : null;
    const solved = record?.fieldToolSolved === true;
    const recovery = instrument && solved ? materials.find(item => allowedRole(item,role) && typeof item.body === 'string' && item.body.trim()) : null;
    return {...(instrument ? {instrument, instrumentSolved:solved, recovered:recovery && {label:recovery.label,fragment:fragment(recovery.body,1)}} : {}),
      index, place: stage.place || stage.title, visited: Boolean(page), items, links: page?.links || [], assignment};
  });
  return {rooms, revision: record?.inventoryRevision || 0, ...(story.hour?.hotel ? {
    hotel:record?.hotelInventory || {objects:[], witnesses:[]}
  } : {})};
}

function samePair(left, right) {
  return left.length === 2 && right.length === 2 && left.every(value => right.includes(value));
}

// A pair keeps its own finds. Keep each member's personal notebook when they part.
export function mergeInventory(personal, shared) {
  if (shared.fieldToolSolved) personal.fieldToolSolved = true;
  if (shared.hotelInventory) {
    const saved = personal.hotelInventory ||= {objects:[], witnesses:[]};
    for (const field of ['objects','witnesses']) {
      saved[field] = [...new Set([...saved[field], ...shared.hotelInventory[field]])];
    }
  }
  if (!shared.inventory) return;
  if (shared.missionPrize) personal.missionPrize = shared.missionPrize;
  const inventory = personal.inventory ||= {};
  for (const [index, page] of Object.entries(shared.inventory)) {
    const saved = inventory[index] ||= {items: [], links: []};
    for (const id of page.items) if (!saved.items.includes(id)) saved.items.push(id);
    for (const link of page.links) if (!saved.links.some(other => samePair(link, other))) saved.links.push([...link]);
  }
}

function exploreHotel(story, record, input) {
  const hotel = story.hour?.hotel;
  if (!hotel) fail(404,'Este expediente no incluye el hotel.');
  const saved = record.hotelInventory ||= {objects:[], witnesses:[]};
  const object = hotel.objects.find(item => item.id === input.object);
  if (!object) fail(400,'Elige una prueba del hotel.');
  let id = object.id;
  let collection = saved.objects;
  if (input.operation === 'hotel-testimony') {
    const witness = hotel.witnesses.find(item => item.id === input.witness);
    if (!witness || !saved.objects.includes(object.id)) fail(409,'Recoge primero la prueba que quieres mostrar.');
    if (witness.object !== object.id) fail(422,witness.miss || 'Esta prueba no aclara su declaración.');
    id = witness.id;
    collection = saved.witnesses;
  }
  if (collection.includes(id)) return false;
  collection.push(id);
  record.inventoryRevision = (record.inventoryRevision || 0) + 1;
  return true;
}

export function useInventory(story, record, role, input) {
  if (input.operation === 'hotel-collect' || input.operation === 'hotel-testimony') {
    return exploreHotel(story,record,input);
  }
  const index = input.index;
  if (!Number.isInteger(index) || index < 0 || !accessible(story, record)[index]) {
    fail(409, 'Este lugar se abre al llegar a su etapa.');
  }
  const stage = story.hour.stages[index];
  const pages = record.inventory ||= {};
  const page = pages[index];
  let changed = false;
  if (input.operation === 'visit') {
    if (!page) {
      pages[index] = {items: [], links: []};
      changed = true;
    }
  } else if (!page) {
    fail(409, 'Explora el lugar antes de recoger una prueba.');
  } else if (input.operation === 'instrument') {
    if (index !== 0 || !getFieldInstrument(story.id)) fail(404,'Este lugar no contiene ese instrumento.');
    if (!checkFieldInstrument(story.id,input.answer)) fail(422,'La lectura no coincide. Revisa las marcas del instrumento.');
    if (!record.fieldToolSolved) {record.fieldToolSolved = true;changed = true;}
  } else if (input.operation === 'collect') {
    const item = stage.materials.find(material => material.id === input.item);
    if (!item || !allowedRole(item, role)) fail(400, 'Esta prueba no pertenece a tu carpeta.');
    if (!page.items.includes(item.id)) {
      page.items.push(item.id);
      changed = true;
    }
    if (role) {
      const contributors = page.contributions ||= {};
      const own = contributors[role] ||= [];
      if (!own.includes(item.id)) { own.push(item.id); changed = true; }
    }
  } else if (input.operation === 'combine') {
    const ids = input.items;
    if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1] ||
        !ids.every(id => page.items.includes(id) && stage.materials.some(item => item.id === id))) {
      fail(400, 'Selecciona dos pruebas distintas que ya estén en el inventario de este lugar.');
    }
    if (!page.links.some(link => samePair(link, ids))) {
      page.links.push([...ids]);
      changed = true;
    }
  } else {
    fail(400, 'Elige una acción de investigación disponible.');
  }
  const mission = missionFor(story);
  if (!record.missionPrize && mission?.index === index && page) {
    const ids = mission.sources.map(source => source.id);
    const contributed = !role || (page.contributions?.A?.includes(ids[0]) && page.contributions?.B?.includes(ids[1]));
    if (contributed && page.links.some(link => samePair(link,ids))) {
      record.missionPrize = mission.prize;
      changed = true;
    }
  }
  if (changed) record.inventoryRevision = (record.inventoryRevision || 0) + 1;
  return changed;
}
