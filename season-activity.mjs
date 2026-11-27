import {seasonBlocks, SEASON_NAMES} from './progression.mjs';

const DAY = 86400000;
const sideFields = ['won', 'opened', 'second','solution'];
const hintKinds = ['open', 'second', 'solution'];

function caseMetrics() {
  return {started:0, completed:0, elapsedMs:0, solo:0, duo:0, keysSpent:0};
}

function countWalletHints(row, seasons, hints, first, now) {
  for (const kind of hintKinds) {
    const hint = hints[kind];
    const dated = new Set();
    for (const entry of row.entries || []) {
      if (entry?.kind !== kind || !Number.isInteger(entry.caseId) || entry.caseId < 1 || entry.caseId > seasons.length*12) continue;
      if (dated.has(entry.caseId) || !Number.isFinite(entry.at) || !Number.isInteger(entry.amount) || entry.amount > 0) continue;
      dated.add(entry.caseId);
      if (entry.at < first || entry.at > now) continue;
      const season = seasons[Math.floor((entry.caseId-1)/12)];
      const spent = -entry.amount;
      hint.uses++;
      hint.keys += spent;
      season.keysSpent += spent;
      season.cases[(entry.caseId-1)%12].keysSpent += spent;
    }
    // Older wallets keep their unlocked hints even when no dated debit was recorded.
    for (const id of new Set(row.unlockedHints?.[kind] || [])) {
      if (!dated.has(id)) hint.undated++;
    }
  }
}

export function hasCaseActivity(data, scope, id) {
  const record = data.valdemarCaseProgress?.[scope]?.[id];
  const wallet = data.valdemarSeasonOne?.[scope];
  return Boolean(record?.mode || record?.hourStep || record?.deduced || record?.choice ||
    sideFields.some(field => wallet?.[field]?.includes(id)));
}

// Only the caller performing a newly committed gameplay action stamps the record.
export function recordCaseActivity(data, scope, id, alreadyStarted, action, now = Date.now()) {
  data.valdemarCaseProgress ||= {};
  const cases = data.valdemarCaseProgress[scope] ||= {};
  const record = cases[id] ||= {};
  if (!alreadyStarted && !record.startedAt) record.startedAt = now;
  if (action === 'advance' && record.hourStep === 1 && !record.firstAdvancedAt) record.firstAdvancedAt = now;
  if (action === 'end' && !record.completedAt) record.completedAt = now;
  record.updatedAt = now;
}

// One row per non-editorial holder. The database projects only paid gameplay,
// billing periods and whether the holder has previously reset their progress.
export function summarizeSeasonActivity(rows, {now, first, days, since}) {
  const until = Math.floor(now / DAY) * DAY - 14 * DAY;
  const from = until - days * DAY;
  const seasons = SEASON_NAMES.map((name, index) => ({
    number: index + 1, name, ...caseMetrics(), activeHolders:0, paidPeriodHolders:0,
    cases: Array.from({length:12}, (_, local) => ({number: local+1, ...caseMetrics()}))
  }));
  const hints = Object.fromEntries(hintKinds.map(kind => [kind, {uses:0, keys:0, undated:0}]));
  const transitions = SEASON_NAMES.slice(1).map((_, index) => ({from:index+1, eligible:0, bought:0}));
  const cohort = {from, until, eligible:0, second:0};
  let firstPlayers = 0;
  let olderStarts = 0;
  for (const row of rows) {
    countWalletHints(row, seasons, hints, first, now);
    const starts = [];
    const activeBoards = new Set();
    let unknownFirst = Boolean(row.resetAt);
    for (let id = 1; id <= 12 * seasons.length; id++) {
      const record = row.progress[id];
      const startedAt = record?.startedAt;
      if ([record?.updatedAt, startedAt, record?.completedAt].some(
        at => Number.isFinite(at) && at >= first && at <= now && since !== null && at >= since
      )) activeBoards.add(Math.floor((id-1)/12));
      if (!Number.isFinite(startedAt) || since === null || startedAt < since || startedAt > now) {
        const old = record?.mode || record?.hourStep || record?.deduced || record?.choice ||
          row.sideIds.has(id);
        if (old) { unknownFirst = true; olderStarts++; }
        continue;
      }
      starts.push({id, startedAt, advancedAt:record.firstAdvancedAt});
      if (startedAt < first) continue;
      const season = seasons[Math.floor((id-1)/12)];
      const item = season.cases[(id-1)%12];
      season.started++;
      item.started++;
      if (record.mode === 'solo' || record.mode === 'duo') {
        season[record.mode]++;
        item[record.mode]++;
      }
      if (record.choice && Number.isFinite(record.completedAt) && record.completedAt >= startedAt && record.completedAt <= now) {
        season.completed++;
        item.completed++;
        const elapsed = record.completedAt - startedAt;
        season.elapsedMs += elapsed;
        item.elapsedMs += elapsed;
      }
    }
    if (starts.length && !unknownFirst) {
      starts.sort((a,b) => a.startedAt-b.startedAt || a.id-b.id);
      const firstCase = starts[0];
      if (firstCase.startedAt >= first) firstPlayers++;
      // Millisecond ties have no provable first case.
      if (firstCase.startedAt >= from && firstCase.startedAt < until && starts[1]?.startedAt !== firstCase.startedAt) {
        cohort.eligible++;
        if (starts.some(other => other.id !== firstCase.id && other.advancedAt >= other.startedAt &&
          other.advancedAt <= firstCase.startedAt + 14*DAY)) cohort.second++;
      }
    }

    for (const index of activeBoards) seasons[index].activeHolders++;
    const validBlocks = seasonBlocks(row.cycles,now).filter(c => !c.revoked && c.start <= now);
    const currentBoards = new Set(validBlocks.filter(c => c.end > now).map(c => Math.floor((c.number-1)/3)));
    for (const index of currentBoards) seasons[index].paidPeriodHolders++;
    for (const transition of transitions) {
      const base = (transition.from-1)*12;
      const sealed = seasons[transition.from-1].cases.every(c => row.progress[base+c.number]?.choice);
      const paid = validBlocks.filter(c => Math.ceil(c.number/3) === transition.from);
      if (!sealed || paid.length !== 3 || paid.some(c => c.end > now)) break;
      transition.eligible++;
      if (validBlocks.some(c => Math.ceil(c.number/3) === transition.from+1)) transition.bought++;
    }
  }
  return {since, firstPlayers, olderStarts, seasons, cohort, transitions, hints};
}
