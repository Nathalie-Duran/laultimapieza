// Administrative reports contain aggregates only. The caller must authorize the verified
// owner before invoking this function and supply a consistent transaction snapshot.
const DAY = 86400000;
const OPTIONAL = ['demo_start', 'demo_complete', 'demo_hint', 'plans_view', 'ref_visit', 'ref_demo', 'ref_notice'];
const FINANCIAL = ['subscriptionStarts', 'subscriptionEnds', 'paidCents'];
const dayOf = time => new Date(time).toISOString().slice(0, 10);

function timestamp(value) {
  if (value == null || value === '' || value === 'null') return null;
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  const time = typeof value === 'number' && value > 0 && value < 1e11
    ? value * 1000 : new Date(value).getTime();
  return Number.isFinite(time) && time > 0 ? time : null;
}

function jsonValue(value, fallback) {
  if (value == null || value === 'null') return fallback;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function incrementDate(byDay, field, when, amount = 1) {
  const time = timestamp(when);
  if (time === null) return;
  const day = byDay.get(dayOf(time));
  if (day && day[field] !== null) day[field] += amount;
}

function sumCovered(rows, key) {
  const values = rows.map(row => row[key]).filter(value => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

const excludeEditorialSession = `NOT EXISTS (
  SELECT 1 FROM lup_editorial_users editor WHERE editor.user_id = s.owner_id
) AND NOT EXISTS (
  SELECT 1 FROM lup_members participant
  INNER JOIN lup_editorial_users editor ON editor.user_id = participant.user_id
  WHERE participant.session_id = s.id
)`;

async function readAccounts(query, start, after, byDay) {
  const realProfile = 'NOT EXISTS (SELECT 1 FROM lup_editorial_users e WHERE e.user_id = p.user_id)';
  const [stock] = await query('SELECT COUNT(*) AS total FROM lup_profiles p WHERE ' + realProfile);
  const dates = await query(`SELECT LEFT(p.created_at,10) AS day_key, COUNT(*) AS total
    FROM lup_profiles p WHERE ${realProfile} AND p.created_at >= ? AND p.created_at < ?
    GROUP BY LEFT(p.created_at,10)`, [start, after]);
  for (const row of dates) {
    const day = byDay.get(row.day_key);
    if (day) day.accounts = Number(row.total);
  }
  return Number(stock.total);
}

async function readNotices(query) {
  // An anonymous request and a verified-account request may refer to the same address.
  const [row] = await query(`SELECT COUNT(*) AS total FROM (
    SELECT LOWER(TRIM(email)) COLLATE utf8mb4_unicode_ci AS address FROM lup_opening_notices
    UNION
    SELECT LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.waitlistEmail')))) COLLATE utf8mb4_unicode_ci
      FROM lup_member_data m WHERE JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.waitlist'))='true'
      AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.waitlistEmail')),'') IS NOT NULL
      AND JSON_TYPE(JSON_EXTRACT(m.data_json,'$.waitlistEmail'))='STRING'
      AND NOT EXISTS (SELECT 1 FROM lup_editorial_users e WHERE e.user_id=m.user_id)
  ) AS unique_requests`);
  return Number(row.total);
}

async function readProgress(query, start, after, stories, byDay) {
  const catalog = new Map(stories.map(story => [story.id, story]));
  const cases = new Map(stories.map(story => [story.id, {
    id: story.id, title: story.title, started: 0, completed: 0, solo: 0, duo: 0
  }]));
  // A newly created session necessarily has an update timestamp on or after creation.
  // Project only report fields; neither choices nor names are needed for this report.
  const sessions = await query(`SELECT
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.reportCreatedAt')) AS report_created_at,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.createdAt')) AS created_at,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.startedAt')) AS started_at,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.caseId')) AS case_id,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.mode')) AS play_mode,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.status')) AS play_status,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.nodeId')) AS node_id,
    JSON_UNQUOTE(JSON_EXTRACT(s.state_json,'$.investigation.solvedAt')) AS puzzle_solved
    FROM lup_sessions s WHERE s.updated_at >= ? AND ${excludeEditorialSession}`, [start]);
  let undatedSessions = 0;
  for (const row of sessions) {
    const created = timestamp(row.created_at) ?? timestamp(row.started_at) ?? timestamp(row.report_created_at);
    if (created === null) { undatedSessions++; continue; }
    const bucket = byDay.get(dayOf(created));
    if (!bucket) continue;
    const story = catalog.get(row.case_id);
    const finished = row.play_status === 'finished' && story && Object.hasOwn(story.endings || {}, row.node_id);
    const completed = !!(finished && (story.season !== 1 || timestamp(row.puzzle_solved) !== null));
    bucket.sessionsStarted++;
    if (completed) bucket.cohortCompleted++;
    const item = cases.get(row.case_id);
    if (item) {
      item.started++;
      if (completed) item.completed++;
      if (row.play_mode === 'solo' || row.play_mode === 'duo') item[row.play_mode]++;
    }
  }
  const [active] = await query(`SELECT COUNT(DISTINCT roster.user_id) AS total
    FROM lup_sessions s JOIN lup_members roster ON roster.session_id=s.id
    WHERE s.updated_at >= ? AND s.updated_at < ? AND ${excludeEditorialSession}`, [start, after]);
  return {cases: [...cases.values()], undatedSessions, activePlayers: Number(active.total)};
}

function renewalCohorts(cycles, available, byDay, now) {
  const subscriptions = new Map();
  // Keep refunded periods in chronological order so a refunded second month
  // can never turn a third payment into a successful first renewal.
  for (const cycle of cycles) {
    const start = timestamp(cycle.start), end = timestamp(cycle.end), paid = timestamp(cycle.paidAt);
    if (!cycle.subscription || !cycle.id || start === null || end === null || end <= start || paid === null) {
      available = false;
      continue;
    }
    if (paid > now) continue;
    if (!subscriptions.has(cycle.subscription)) subscriptions.set(cycle.subscription, new Map());
    const periods = subscriptions.get(cycle.subscription);
    const existing = periods.get(start);
    if (existing && existing.end !== end) available = false;
    periods.set(start, {start, end, valid: existing?.valid === true || !cycle.revoked});
  }
  const cohort = () => ({eligible: available ? 0 : null, renewed: available ? 0 : null});
  const result = {second: cohort(), third: cohort()};
  if (!available) return result;
  for (const periods of subscriptions.values()) {
    const ordered = [...periods.values()].sort((left, right) => left.start - right.start);
    // The provider schedules contiguous monthly service periods. A later
    // payment after an uncovered gap is not the next monthly renewal.
    let period = ordered[0];
    for (const bucket of [result.second, result.third]) {
      if (!period) break;
      const next = periods.get(period.end);
      if (period.valid && period.end <= now && byDay.has(dayOf(period.end))) {
        bucket.eligible++;
        if (next?.valid) bucket.renewed++;
      }
      period = next;
    }
  }
  return result;
}

async function readBilling(query, billingEnabled, byDay, now) {
  const rows = await query(`SELECT
    JSON_EXTRACT(m.data_json,'$.cycles') AS cycles,
    JSON_EXTRACT(m.data_json,'$.billingHistory') AS billing_history,
    JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.active')) AS paid_active,
    JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.periodEnd')) AS period_end,
    JSON_UNQUOTE(JSON_EXTRACT(m.data_json,'$.subscription')) AS current_subscription
    FROM lup_member_data m WHERE NOT EXISTS (SELECT 1 FROM lup_editorial_users e WHERE e.user_id=m.user_id)
      AND (JSON_EXTRACT(m.data_json,'$.cycles') IS NOT NULL OR JSON_EXTRACT(m.data_json,'$.billingHistory') IS NOT NULL
           OR JSON_EXTRACT(m.data_json,'$.subscription') IS NOT NULL)`);
  let activeSubscriptions = 0, scheduledCancellations = 0, hasEvidence = false, partial = false;
  let voluntaryEnds = 0, seasonEnds = 0, otherEnds = 0, incompleteRevenue = false;
  let incompleteLifecycle = false, missingCurrentSchedule = false, missingPaidPeriods = false;
  const retentionCycles = [];
  for (const row of rows) {
    const cycles = jsonValue(row.cycles, []);
    const history = Object.values(jsonValue(row.billing_history, {}));
    const active = String(row.paid_active) === 'true' && timestamp(row.period_end) > now;
    const paidIds = new Set();
    const invoices = new Set();
    if (active) activeSubscriptions++;
    if (active && !cycles.length) missingPaidPeriods = true;
    if (cycles.length || active) hasEvidence = true;
    retentionCycles.push(...cycles);
    for (const cycle of cycles) {
      if (!cycle.id || invoices.has(cycle.id)) continue;
      invoices.add(cycle.id);
      if (cycle.subscription) paidIds.add(cycle.subscription);
      else incompleteLifecycle = true;
      const when = timestamp(cycle.paidAt);
      if (when === null || !Number.isSafeInteger(cycle.amountPaid) || cycle.amountPaid < 0) {
        partial = true;
        if (when !== null) {
          const day = byDay.get(dayOf(when));
          if (day) { day.paidCents = null; incompleteRevenue = true; }
        } else {
          // The old record has no date of collection. Its service period is not proof
          // of the day on which money moved, so omit the affected historical total.
          const end = timestamp(cycle.end);
          const earliest = [...byDay.keys()][0];
          if (end === null || dayOf(end) >= earliest) {
            for (const bucket of byDay.values()) bucket.paidCents = null;
            incompleteRevenue = true;
          }
        }
      } else {
        // Gross collections include subsequently refunded invoices. No net estimate.
        incrementDate(byDay,'paidCents',when,cycle.amountPaid);
      }
    }
    const tracked = new Set();
    for (const sub of history) {
      if (!sub || !paidIds.has(sub.id) || tracked.has(sub.id)) continue;
      tracked.add(sub.id);
      if (timestamp(sub.startedAt)) incrementDate(byDay,'subscriptionStarts',sub.startedAt);
      else incompleteLifecycle = true;
      const ended = timestamp(sub.endedAt);
      if (ended !== null && ended <= now && byDay.has(dayOf(ended))) {
        incrementDate(byDay,'subscriptionEnds',ended);
        if (sub.reason === 'voluntary') voluntaryEnds++;
        else if (sub.reason === 'season_end') seasonEnds++;
        else otherEnds++;
      }
      if (sub.id === row.current_subscription && active && !ended && timestamp(sub.cancelScheduledAt) && sub.reason !== 'season_end') scheduledCancellations++;
    }
    if (paidIds.size !== tracked.size) incompleteLifecycle = true;
    if (active && !tracked.has(row.current_subscription)) missingCurrentSchedule = true;
  }
  const available = !!billingEnabled || hasEvidence;
  if (!available) for (const day of byDay.values()) for (const key of FINANCIAL) day[key] = null;
  if (incompleteLifecycle) for (const day of byDay.values()) {
    day.subscriptionStarts = null;
    day.subscriptionEnds = null;
  }
  const retention = renewalCohorts(retentionCycles, available && !missingPaidPeriods, byDay, now);
  return {
    retention,
    activeSubscriptions: available ? activeSubscriptions : null,
    scheduledCancellations: available && !missingCurrentSchedule ? scheduledCancellations : null,
    voluntaryEnds: available && !incompleteLifecycle ? voluntaryEnds : null,
    seasonEnds: available && !incompleteLifecycle ? seasonEnds : null,
    otherEnds: available && !incompleteLifecycle ? otherEnds : null,
    incompleteRevenue, partial: partial || incompleteLifecycle || missingCurrentSchedule || (available && retention.second.eligible === null)
  };
}

export async function readAnalytics(query, {days, billingEnabled, stories}) {
  days = Number(days);
  if (![7, 30, 90].includes(days)) throw new RangeError('Elige un periodo de 7, 30 o 90 días.');
  const now = Date.now(), today = Math.floor(now / DAY) * DAY;
  const first = today - (days - 1) * DAY;
  const start = new Date(first).toISOString(), after = new Date(today + DAY).toISOString();
  const [coverageRow] = await query('SELECT started_at FROM lup_reporting_since WHERE id=1');
  const began = timestamp(coverageRow?.started_at);
  const noticeSince = began === null ? null : new Date(began).toISOString();
  const byDay = new Map();
  for (let i = 0; i < days; i++) {
    const date = dayOf(first + i * DAY);
    const noticeDefault = noticeSince && date >= noticeSince.slice(0,10) ? 0 : null;
    byDay.set(date, {date, accounts: 0, noticeAdds: noticeDefault, noticeRemoves: noticeDefault,
      subscriptionStarts: 0, subscriptionEnds: 0, paidCents: 0, sessionsStarted: 0, cohortCompleted: 0});
  }
  const accounts = await readAccounts(query, start, after, byDay);
  const notices = await readNotices(query);
  const metrics = await query('SELECT day_key,event_key,total FROM lup_metrics WHERE day_key >= ? AND day_key <= ?',
    [dayOf(first),dayOf(today)]);
  const optional = Object.fromEntries(OPTIONAL.map(key => [key,0]));
  for (const {day_key, event_key, total} of metrics) {
    const bucket = byDay.get(day_key);
    if (!bucket) continue;
    if (Object.hasOwn(optional, event_key)) optional[event_key] += Number(total);
    if (event_key === 'notice_add' && bucket.noticeAdds !== null) bucket.noticeAdds += Number(total);
    if (event_key === 'notice_remove' && bucket.noticeRemoves !== null) bucket.noticeRemoves += Number(total);
  }
  const games = await readProgress(query, start, after, stories, byDay);
  const billing = await readBilling(query, billingEnabled, byDay, now);
  const daily = [...byDay.values()];
  const totals = {};
  for (const key of Object.keys(daily[0])) if (key !== 'date') totals[key] = sumCovered(daily, key);
  if (billing.incompleteRevenue) totals.paidCents = null;
  Object.assign(totals, {activePlayers: games.activePlayers, voluntaryEnds: billing.voluntaryEnds,
    seasonEnds: billing.seasonEnds, otherEnds: billing.otherEnds});
  return {
    days, from: dayOf(first), to: dayOf(today), generatedAt: new Date(now).toISOString(),
    billingEnabled: !!billingEnabled, noticeSince,
    stock: {accounts, notices, activeSubscriptions: billing.activeSubscriptions,
      scheduledCancellations: billing.scheduledCancellations},
    totals, daily, cases: games.cases, optional, retention: billing.retention,
    coverage: {noticePartial: began === null || began > first, billingPartial: billing.partial,
      undatedSessions: games.undatedSessions}
  };
}
