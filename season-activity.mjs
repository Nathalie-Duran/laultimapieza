import {seasonBlocks, SEASON_NAMES} from './progression.mjs';

const DAY = 86400000;
const sideFields = ['won', 'opened', 'second'];

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
    number: index + 1, name, started: 0, completed: 0,
    cases: Array.from({length:12}, (_, local) => ({number: local+1, started:0, completed:0}))
  }));
  const transitions = SEASON_NAMES.slice(1).map((_, index) => ({from:index+1, eligible:0, bought:0}));
  const cohort = {from, until, eligible:0, second:0};
  let firstPlayers = 0;
  let olderStarts = 0;
  for (const row of rows) {
    const starts = [];
    let unknownFirst = Boolean(row.resetAt);
    for (let id = 1; id <= 12 * seasons.length; id++) {
      const record = row.progress[id];
      const startedAt = record?.startedAt;
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
      if (record.choice && Number.isFinite(record.completedAt) && record.completedAt >= startedAt && record.completedAt <= now) {
        season.completed++;
        item.completed++;
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

    const validBlocks = seasonBlocks(row.cycles,now).filter(c => !c.revoked && c.start <= now);
    for (const transition of transitions) {
      const base = (transition.from-1)*12;
      const sealed = seasons[transition.from-1].cases.every(c => row.progress[base+c.number]?.choice);
      const paid = validBlocks.filter(c => Math.ceil(c.number/3) === transition.from);
      if (!sealed || paid.length !== 3 || paid.some(c => c.end > now)) break;
      transition.eligible++;
      if (validBlocks.some(c => Math.ceil(c.number/3) === transition.from+1)) transition.bought++;
    }
  }
  return {since, firstPlayers, olderStarts, seasons, cohort, transitions};
}
