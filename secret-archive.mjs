import {WORLD_CASE_COUNT} from './valdemar-wallet.mjs';

// The profile indexes earned keepsakes. Role-specific documents, notes and
// puzzle solutions stay inside their original case and its access controls.
export function secretArchive(data, scope, access) {
  const records = data.valdemarCaseProgress?.[scope] || {};
  const wallet = data.valdemarSeasonOne?.[scope] || {};
  const opened = new Set(wallet.opened || []);
  const second = new Set(wallet.second || []);
  const available = new Set(access.availableCases);
  const archive = [];
  for (let caseId = 1; caseId <= WORLD_CASE_COUNT; caseId++) {
    if (!available.has(caseId)) continue;
    const record = records[caseId] || {};
    const titles = [];
    if (record.fieldToolSolved === true) titles.push('Documento recuperado con el instrumento');
    if ([1, 2, 3].includes(record.missionPrize)) titles.push('Ficha de la misión secreta');
    if (record.hotelInventory?.witnesses?.length > 0) titles.push('Segunda declaración del hotel');
    if (opened.has(caseId)) titles.push('Sobre de ayuda abierto');
    if (second.has(caseId)) titles.push('Segunda pista abierta');
    if (titles.length) archive.push({caseId, titles});
  }
  return archive;
}
