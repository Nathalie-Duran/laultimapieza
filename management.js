(function (root) {
  'use strict';

  const number = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
  const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
  const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 });
  const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const updatedFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });
  const ranges = [7, 30, 90];
  const goalStorageKey = 'lup.management.netGoal.v1';
  const charts = {
    accounts: { label: 'Cuentas', series: [['accounts', 'Altas de cuenta']] },
    subscriptions: { label: 'Suscripciones', series: [['subscriptionStarts', 'Altas de pago'], ['subscriptionEnds', 'Bajas efectivas']] },
    notices: { label: 'Avisos de apertura', series: [['noticeAdds', 'Solicitudes'], ['noticeRemoves', 'Retiradas']] },
    games: { label: 'Partidas narrativas', series: [['sessionsStarted', 'Iniciadas'], ['cohortCompleted', 'De esas, resueltas']] },
    payments: { label: 'Cobros', series: [['paidCents', 'Cobros brutos']], money: true }
  };
  let days = 30;
  let selectedChart = 'accounts';
  let generation = 0;
  let loading = false;
  let report = null;
  let sessionGoalCents;
  let goalPersisted = false;
  const sections=[['resumen','Resumen'],['partidas','Partidas'],['edicion','Edición'],['cuentas','Cuentas']];
  let currentSection='resumen';

  function permitted() { return root.ClubAccess?.state?.canManage === true; }
  function host() { return document.getElementById('management-panel'); }
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function valid(value) { return typeof value === 'number' && Number.isFinite(value); }
  function format(value, monetary = false) {
    if (!valid(value)) return '—';
    return monetary ? euro.format(value / 100) : number.format(value);
  }
  function dateText(value, formatter = dateFormat) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) ? formatter.format(date) : '—';
  }
  function ratio(part, total) {
    return valid(part) && valid(total) && total > 0 ? percent.format(part / total) : '—';
  }
  function pairedShare(row) {
    const known = row.solo + row.duo;
    return known > 0 ? ratio(row.duo, known) + ' (' + format(row.duo) + ' de ' + format(known) + ')' : '—';
  }
  function averageElapsed(row) {
    if (!row.completed || !valid(row.elapsedMs)) return '—';
    const ms = row.elapsedMs / row.completed;
    if (ms === 0) return '0 min';
    if (ms < 60000) return '&lt; 1 min';
    const minutes = Math.round(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? format(hours) + ' h' + (rest ? ' ' + rest + ' min' : '') : rest + ' min';
  }
  function tile(label, value, note, accent = false) {
    return `<div class="mg-tile${accent ? ' mg-accent' : ''}"><dt>${label}</dt><dd>${value}</dd><dd class="mg-tile-note">${note}</dd></div>`;
  }
  function metricRow(label, value) {
    return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  }
  function view() {
    if (!permitted()) return '';
    const requested=new URLSearchParams((root.location?.hash || '').split('?')[1]).get('seccion');
    currentSection=sections.some(([id])=>id===requested)?requested:'resumen';
    return `<section class="management" id="management-panel" aria-labelledby="management-title">
      <header class="mg-head"><h1 id="management-title">Administración</h1><a class="mg-return" href="#inicio">Volver al inicio</a></header>
      ${sectionNavigation()}
      <div class="mg-toolbar" data-mg-analysis ${isAnalysis()?'':'hidden'}><div class="mg-range" role="group" aria-label="Periodo de análisis">${ranges.map(value => `<button type="button" data-mg-days="${value}" aria-pressed="${value === days}">${value} días</button>`).join('')}</div><button class="mg-refresh" type="button" data-mg-refresh>Actualizar</button></div>
      <p class="mg-status" role="status" aria-live="polite" ${isAnalysis()?'':'hidden'}></p><p class="mg-sr" data-mg-goal-announcement role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="mg-content">
        ${area('resumen','<div data-mg-overview></div>')}
        ${area('partidas','<div data-mg-games></div>'+(root.Colecciones?.seals(root.ClubAccess.state.seasonAccess,true)||''))}
        ${area('edicion','<author-workshop></author-workshop><div data-mg-reviews></div>'+(root.EditorialChallenges?.adminView()||'')+'<section class="mg-panel mg-block"><h2>Publicación de Código Valdemar</h2><p><a class="mg-return" href="#edicion-valdemar">Abrir el editor de publicación</a></p></section>')}
        ${area('cuentas',accountLookupPanel())}
      </div></section>`;
  }
  function isAnalysis(){return currentSection==='resumen'||currentSection==='partidas';}
  function sectionNavigation() {
    return '<div class="mg-sections" role="tablist" aria-label="Áreas de administración">'+sections.map(([id,label])=>
      `<button type="button" role="tab" data-mg-section="${id}" id="mg-tab-${id}" aria-controls="mg-area-${id}" aria-selected="${id===currentSection}" tabindex="${id===currentSection?0:-1}">${label}</button>`).join('')+'</div>';
  }
  function area(id,html) {
    return `<div id="mg-area-${id}" role="tabpanel" tabindex="0" aria-labelledby="mg-tab-${id}" ${currentSection===id?'':'hidden'}>${html}</div>`;
  }
  function selectSection(el,id) {
    if(!sections.some(([key])=>id===key))return;
    currentSection=id;
    el.querySelector('[data-mg-analysis]').hidden=!isAnalysis();
    el.querySelector('.mg-status').hidden=!isAnalysis();
    if(root.location?.hash.split('?')[0]==='#gestion'){
      const address='#gestion'+(id==='resumen'?'':'?seccion='+id);
      root.history.replaceState(root.history.state,'',address);
    }
    for(const tab of el.querySelectorAll('[data-mg-section]')){
      const selected=tab.dataset.mgSection===id;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;
      el.querySelector('#'+tab.getAttribute('aria-controls')).hidden=!selected;
    }
    if(id==='edicion')mountEditors();
  }
  function mountEditors(){
    root.EditorialChallenges?.adminMount();
    if(root.customElements&&!root.customElements.get('author-workshop')){
      import('/gestion-aventuras.js?v=6623af45d472').catch(()=>{const panel=host()?.querySelector('author-workshop');if(panel)panel.textContent='No se ha podido abrir el taller. Recarga Gestión para reintentar.';});
    }
  }
  function summary(data) {
    const s = data.stock, t = data.totals;
    return `<section class="mg-block" aria-labelledby="mg-stock"><div class="mg-section-heading"><h2 id="mg-stock">Ahora mismo</h2><span class="mg-billing">${data.billingEnabled ? 'Contratación abierta' : 'Contratación cerrada'}</span></div>
      <dl class="mg-tiles">
        ${tile('Cuentas creadas', format(s.accounts), 'Perfiles guardados')}
        ${tile('Avisos vigentes', format(s.notices), 'Correos únicos que esperan la apertura')}
        ${tile('Suscripciones activas', format(s.activeSubscriptions), 'Titulares con acceso de pago vigente', true)}
        ${tile('Cancelaciones previstas', format(s.scheduledCancellations), 'Pendientes de hacerse efectivas')}
        ${data.economics?tile('MRR observado',format(data.economics.mrrCents,true),'Suma de las cuotas confirmadas del mes vigente en suscripciones activas')+tile('Ingreso mensual por suscriptor',format(data.economics.arpuCents,true),'Media de esas cuotas, con el descuento realmente aplicado')+tile('Ingreso acumulado por titular',format(data.economics.lifetimeCents,true),'Media histórica de facturas abonadas y no revocadas por pagador'):''}
      </dl></section>
      <section class="mg-block" aria-labelledby="mg-movements"><div class="mg-section-heading"><h2 id="mg-movements">Durante el periodo</h2><span>${dateText(data.from)} – ${dateText(data.to)} · UTC</span></div>
      <dl class="mg-tiles">
        ${tile('Altas de cuenta', format(t.accounts), 'Nuevos perfiles')}
        ${tile('Altas de suscripción', format(t.subscriptionStarts), 'Suscripciones de pago iniciadas')}
        ${tile('Bajas efectivas', format(t.subscriptionEnds), 'Suscripciones que llegaron a su fin')}
        ${tile('Cobros brutos', format(t.paidCents, true), 'Importes confirmados, antes de reembolsos', true)}
      </dl></section>`;
  }
  function comparison(data) {
    const current = data.comparison?.current, previous = data.comparison?.previous;
    if (!current || !previous) return '<section class="mg-panel mg-block"><h2>Comparación comercial</h2><p class="mg-note">Comparación pendiente de datos de ambos periodos.</p></section>';
    const periodLabel = period => dateText(period.from, dayFormat) + ' – ' + dateText(period.to, dayFormat);
    const indicators = [['accounts', 'Altas de cuenta'], ['noticeAdds', 'Solicitudes de aviso'], ['newSubscriptions', 'Altas de suscripción'], ['cancellations', 'Bajas efectivas'], ['grossCents', 'Cobros brutos']];
    return `<section class="mg-panel mg-block"><div class="mg-section-heading"><h2>Comparación comercial</h2><span>Dos periodos de ${format(data.days)} días completos · UTC</span></div>
      <div class="mg-table-wrap" tabindex="0" role="region" aria-label="Comparación entre periodos"><table class="mg-comparison"><caption class="mg-sr">Diferencia entre el periodo reciente, cerrado ayer, y el anterior. N/D indica cobertura insuficiente.</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Anterior<small>${periodLabel(previous)}</small></th><th scope="col">Reciente<small>${periodLabel(current)}</small></th><th scope="col">Diferencia</th></tr></thead><tbody>${indicators.map(([key, label]) => {
        const a = previous[key], b = current[key], money = key === 'grossCents';
        const delta = valid(a) && valid(b) ? b - a : null;
        return `<tr><th scope="row">${label}</th><td>${valid(a) ? format(a, money) : 'N/D'}</td><td>${valid(b) ? format(b, money) : 'N/D'}</td><td class="mg-delta">${valid(delta) ? (delta > 0 ? '+' : '') + format(delta, money) : 'N/D'}</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  }
  function readDeductions(raw) {
    const text = String(raw).trim();
    if (!text) return null;
    // Spanish grouping and decimal comma, plus ungrouped decimals with a point.
    if (!/^(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/.test(text)) return NaN;
    const normalized = /\.\d{3}(?:[.,]|$)/.test(text) ? text.replace(/\./g, '') : text;
    const [units, decimals = ''] = normalized.replace(',', '.').split('.');
    const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
    return Number.isSafeInteger(cents) ? cents : NaN;
  }
  function rememberedGoal() {
    if (!permitted()) return '';
    if (sessionGoalCents === undefined) {
      try {
        const stored = Number(root.localStorage.getItem(goalStorageKey));
        sessionGoalCents = Number.isSafeInteger(stored) && stored > 0 ? stored : null;
        goalPersisted = sessionGoalCents !== null;
      } catch { sessionGoalCents = null; }
    }
    return sessionGoalCents === null ? '' : (sessionGoalCents / 100).toFixed(2).replace('.', ',');
  }
  function rememberGoal(raw) {
    if (!permitted()) return '';
    const cents = readDeductions(raw);
    if (cents !== null && (!valid(cents) || cents <= 0)) return 'Objetivo sin guardar. Introduce un importe superior a cero con un máximo de dos decimales.';
    sessionGoalCents = cents;
    goalPersisted = false;
    try {
      if (cents === null) root.localStorage.removeItem(goalStorageKey);
      else root.localStorage.setItem(goalStorageKey, String(cents));
      goalPersisted = root.localStorage.getItem(goalStorageKey) === (cents === null ? null : String(cents));
    } catch { /* The value stays available in this panel for the current account session. */ }
    if (cents === null) return goalPersisted ? 'Objetivo borrado de este navegador.' : 'Objetivo borrado de esta sesión. El almacenamiento del navegador no está disponible.';
    return goalPersisted ? 'Objetivo guardado en este navegador.' : 'Objetivo disponible en esta sesión. El almacenamiento del navegador no está disponible.';
  }
  function goalResult(gross, raw, goalRaw) {
    if (!valid(gross)) return '<p class="mg-note">El neto estimado estará disponible cuando haya cobertura de cobros para este mes.</p>';
    const deductions = readDeductions(raw), goal = readDeductions(goalRaw);
    if (deductions === null) return '<p class="mg-note">Introduce las deducciones para calcular el neto estimado y cuánto te falta. Puedes indicar 0 si corresponde.</p>';
    if (!valid(deductions)) return '<p class="mg-note">Introduce un importe positivo o cero, con un máximo de dos decimales.</p>';
    const net = gross - deductions;
    const measured = `<div><dt>Neto simulado</dt><dd>${format(net, true)}</dd></div>`;
    if (!(valid(goal) && goal > 0)) {
      const note = goal === null ? 'Añade un objetivo para calcular el avance.' : 'El objetivo debe ser un importe superior a cero, con un máximo de dos decimales.';
      return `<dl class="mg-goal-values">${measured}</dl><p class="mg-note">${note}</p>`;
    }
    const missing = Math.max(0, goal - net), progress = Math.max(0, Math.min(goal, net));
    return `<dl class="mg-goal-values">${measured}<div><dt>Falta para el objetivo</dt><dd>${format(missing, true)}</dd></div></dl><div class="mg-goal-progress"><progress max="${goal}" value="${progress}" aria-label="Avance hacia el objetivo neto" aria-valuetext="${percent.format(net / goal)}"></progress><span>${percent.format(net / goal)} del objetivo</span></div>`;
  }
  function monthlyGoal(data) {
    const m = data.month, goal = rememberedGoal();
    return `<section class="mg-panel mg-block mg-goal"><div class="mg-section-heading"><h2>Objetivo mensual e ingresos</h2><span>${m?.from && m?.to ? dateText(m.from) + ' – ' + dateText(m.to) + ' · UTC' : 'Mes natural en curso'}</span></div>
      <div class="mg-confirmed"><span>Cobros brutos confirmados del mes</span><strong>${valid(m?.grossCents) ? format(m.grossCents, true) : 'N/D'}</strong></div>
      <div class="mg-goal-cols"><div><label class="mg-goal-label" for="mg-target">Objetivo neto mensual (€)</label><input id="mg-target" data-mg-target type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${escape(goal)}" maxlength="24" aria-describedby="mg-target-help"><p class="mg-note" id="mg-target-help">Opcional. Se guarda mientras escribes. Vacía el campo para borrarlo.</p><p class="mg-note" id="mg-target-status">${goal ? goalPersisted ? 'Objetivo guardado en este navegador.' : 'Objetivo disponible en esta sesión.' : ''}</p></div><div><label class="mg-goal-label" for="mg-deductions">Deducciones acumuladas del mes (€)</label><input id="mg-deductions" data-mg-deductions type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="p. ej., 125,50" maxlength="24" aria-describedby="mg-deduction-help" ${valid(m?.grossCents) ? '' : 'disabled'}><p class="mg-note" id="mg-deduction-help">Suma devoluciones, comisiones, gastos e impuestos hasta la fecha. Las deducciones se usan solo para esta simulación.</p></div></div><div class="mg-goal-result">${goalResult(m?.grossCents, '', goal)}</div></section>`;
  }
  function saveGoalField(el) {
    const field = el.querySelector('[data-mg-target]');
    if (!field || !permitted() || field.dataset.lastHandled === field.value) return;
    field.dataset.lastHandled = field.value;
    const message = rememberGoal(field.value);
    el.querySelector('#mg-target-status').textContent = message;
  }
  function simulate(el, gross) {
    const deductions = el.querySelector('[data-mg-deductions]');
    el.querySelector('.mg-goal-result').innerHTML = goalResult(gross, deductions.value, el.querySelector('[data-mg-target]').value);
  }
  function announceAfterEdit(el, field, goal, gross) {
    let announced = field.value;
    function confirm() {
      if (!permitted() || host() !== el || field.value === announced) return;
      announced = field.value;
      if (field === goal) saveGoalField(el);
      simulate(el, gross);
      const amount = readDeductions(field.value);
      field.setAttribute('aria-invalid', String(Number.isNaN(amount) || (field === goal && amount === 0)));
      const feedback = field === goal ? el.querySelector('#mg-target-status') : el.querySelector('.mg-goal-result');
      el.querySelector('[data-mg-goal-announcement]').textContent = feedback.innerText.trim().replace(/\s+/g, ' ');
    }
    field.addEventListener('blur', confirm);
    field.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); confirm(); }
    });
  }
  function activation(data) {
    const cohort = data.activation;
    const windowLabel = cohort?.from && cohort?.to ? 'Altas de cuenta del ' + dateText(cohort.from) + ' al ' + dateText(cohort.to) + ' (UTC).' : 'Las fechas de alta del grupo aún están pendientes de histórico.';
    function cohortFraction(count) {
      if (!valid(count) || !valid(cohort?.accounts)) return 'N/D';
      if (cohort.accounts === 0) return '0 de 0';
      return ratio(count, cohort.accounts) + ' · ' + format(count) + ' de ' + format(cohort.accounts);
    }
    return `<section class="mg-panel"><h2>Primeros 30 días de una cuenta</h2><p class="mg-note">${escape(windowLabel)} Cada cuenta ha tenido 30 días completos de seguimiento.</p><dl class="mg-rows">${metricRow('Cuentas del grupo', valid(cohort?.accounts) ? format(cohort.accounts) : 'N/D')}${metricRow('Guardaron una partida propia en una historia narrativa', cohortFraction(cohort?.played))}${metricRow('Hicieron su primer pago', cohortFraction(cohort?.paid))}</dl><p class="mg-note">Las partidas recuperadas cuentan el día en que se guardaron en la web.</p></section>`;
  }
  function lineSegments(daily, key, x, y) {
    const pieces = [];
    let points = [];
    function finish() {
      if (points.length) pieces.push(points);
      points = [];
    }
    daily.forEach((row, i) => {
      if (valid(row[key])) points.push([x(i), y(row[key])]);
      else finish();
    });
    finish();
    return pieces;
  }
  function graph(daily, config) {
    const points = daily.flatMap(row => config.series.map(([key]) => row[key]).filter(valid));
    if (!points.length) return '<p class="mg-empty">Todavía no hay datos de esta serie para el periodo elegido.</p>';
    const max = Math.max(...points, 0);
    if (max === 0) return '<p class="mg-empty">Todos los días con datos registran cero en esta serie.</p>';
    const width = 920, height = 198, left = 10, right = width - 12, top = 12, bottom = height - 10;
    const x = i => daily.length < 2 ? width / 2 : left + (right - left) * i / (daily.length - 1);
    const y = value => bottom - (bottom - top) * value / max;
    const grid = [0, 0.5, 1].map(fraction => `<line x1="${left}" x2="${right}" y1="${y(max * fraction)}" y2="${y(max * fraction)}"/>`).join('');
    const lines = config.series.map(([key], index) => lineSegments(daily, key, x, y).map(segment => {
      const cls = 'mg-series-' + index;
      if (segment.length === 1) return `<circle class="${cls}" cx="${segment[0][0].toFixed(1)}" cy="${segment[0][1].toFixed(1)}" r="3.5"/>`;
      return `<polyline class="${cls}" points="${segment.map(([px, py]) => px.toFixed(1) + ',' + py.toFixed(1)).join(' ')}" />`;
    }).join('')).join('');
    return `<div class="mg-axis-y"><span>${format(max, config.money)}</span><span>0</span></div><div class="mg-plot"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolución diaria de ${config.label.toLowerCase()}. Los valores exactos están en la tabla."><g class="mg-gridlines">${grid}</g>${lines}</svg></div>
      <div class="mg-axis-x"><span>${dateText(daily[0]?.date, dayFormat)}</span><span>${dateText(daily[daily.length - 1]?.date, dayFormat)}</span></div>`;
  }
  function chartBody(data) {
    const config = charts[selectedChart], daily = data.daily;
    const detail = daily.length ? `<details class="mg-details"><summary>Consultar los valores por día</summary>
      <div class="mg-table-wrap mg-daily-wrap" tabindex="0" role="region" aria-label="Datos diarios de ${config.label}"><table><caption class="mg-sr">Evolución diaria, en UTC</caption>
        <thead><tr><th scope="col">Fecha</th>${config.series.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
        <tbody>${[...daily].reverse().map(row => `<tr><th scope="row">${dateText(row.date)}</th>${config.series.map(([key]) => `<td>${format(row[key], config.money)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : '';
    return `<div class="mg-legend">${config.series.map(([, label], index) => `<span><i class="mg-swatch-${index}"></i>${label}</span>`).join('')}</div>
      <div class="mg-chart-grid">${graph(daily, config)}</div>${detail}`;
  }
  function dailyReportCsv(dashboard) {
    const columns = [
      ['accounts', 'Altas de cuenta'],
      ['noticeAdds', 'Solicitudes de aviso'],
      ['noticeRemoves', 'Retiradas de aviso'],
      ['subscriptionStarts', 'Altas de suscripción de pago'],
      ['subscriptionEnds', 'Bajas efectivas de suscripción'],
      ['paidCents', 'Cobros brutos antes de reembolsos (EUR)'],
      ['sessionsStarted', 'Partidas narrativas iniciadas'],
      ['cohortCompleted', 'Partidas narrativas iniciadas ese día y ya resueltas']
    ];
    const lines = [['Fecha (UTC)', ...columns.map(([, label]) => label)].join(';')];
    for (const day of dashboard.daily) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error('Fecha de informe no válida.');
      if (day.date < dashboard.from || day.date > dashboard.to) continue;
      const cells = columns.map(([key]) => {
        const value = day[key];
        if (value == null) return '';
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor de informe no válido.');
        if (key !== 'paidCents') return String(value);
        return Math.floor(value / 100) + ',' + String(value % 100).padStart(2, '0');
      });
      lines.push([day.date, ...cells].join(';'));
    }
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  function downloadDaily(report, el) {
    const status = el.querySelector('.mg-status');
    let url;
    try {
      const csv = dailyReportCsv(report);
      const validDate = /^\d{4}-\d{2}-\d{2}$/;
      if (!validDate.test(report.from) || !validDate.test(report.to)) throw new Error('Fechas no disponibles');
      url = root.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'la-ultima-pieza-evolucion-' + report.from + '_' + report.to + '.csv';
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      status.textContent = 'Informe diario preparado para descargar.';
    } catch {
      status.textContent = 'No se ha podido descargar el informe. Actualiza los datos y vuelve a intentarlo.';
    } finally {
      if (url) root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
    }
  }
  function chart(data) {
    return `<section class="mg-panel mg-block"><div class="mg-section-heading"><h2>Evolución diaria</h2>
      <div class="mg-chart-actions"><label class="mg-select"><span>Indicador</span><select data-mg-chart>${Object.entries(charts).map(([key, val]) => `<option value="${key}" ${key === selectedChart ? 'selected' : ''}>${val.label}</option>`).join('')}</select></label><button type="button" class="mg-refresh" data-mg-export ${data.daily.length ? '' : 'disabled'}>Descargar CSV diario</button></div></div><div class="mg-chart-body">${chartBody(data)}</div></section>`;
  }
  function activity(data) {
    const t = data.totals, rows = [...data.cases].sort((a, b) => b.started - a.started || b.completed - a.completed || String(a.title).localeCompare(String(b.title), 'es'));
    return `<section class="mg-panel mg-block"><div class="mg-section-heading"><h2>Partidas narrativas por caso</h2><span>Partidas iniciadas en el periodo</span></div>
      <dl class="mg-activity">
        ${tile('Partidas iniciadas', format(t.sessionsStarted), 'Una partida compartida cuenta una vez')}
        ${tile('De esas, resueltas', format(t.cohortCompleted), 'Completadas hasta hoy')}
        ${tile('Finalización', ratio(t.cohortCompleted, t.sessionsStarted), 'Resueltas sobre iniciadas')}
        ${tile('Personas en partidas actualizadas', format(t.activePlayers), 'Participantes en esas actualizaciones del periodo')}
      </dl>
      <div class="mg-table-wrap" tabindex="0" role="region" aria-label="Progreso de los casos"><table><caption class="mg-sr">Partidas por caso, con el estado actual de las iniciadas en el periodo</caption><thead><tr><th scope="col">Caso</th><th scope="col">Iniciadas</th><th scope="col">Resueltas</th><th scope="col">Finalización</th><th scope="col">A solas</th><th scope="col">En pareja</th><th scope="col">Proporción en pareja con modo conocido</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${escape(r.title)}</th><td>${format(r.started)}</td><td>${format(r.completed)}</td><td>${ratio(r.completed, r.started)}</td><td>${format(r.solo)}</td><td>${format(r.duo)}</td><td>${pairedShare(r)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function renewals(data) {
    const groups = [['Segundo mes', data.retention?.second], ['Tercer mes', data.retention?.third]];
    const measured = groups.some(([, group]) => valid(group?.eligible) && valid(group?.renewed));
    const empty = measured && groups.every(([, group]) => group?.eligible === 0);
    const note = !measured ? 'Este informe todavía no dispone del historial de renovaciones.' :
      empty && !data.billingEnabled ? 'Contratación cerrada. En este periodo ningún ciclo llegó a su fecha de renovación.' :
      empty ? 'En este periodo ningún ciclo llegó a su fecha de renovación.' :
      'Se cuentan las suscripciones cuyo ciclo anterior venció en el periodo y cuyo siguiente pago está confirmado. Se excluyen los ciclos revocados.';
    return `<section class="mg-panel"><h2>Renovaciones de la temporada</h2><dl class="mg-rows">${groups.map(([label, group]) => {
      if (!valid(group?.eligible) || !valid(group?.renewed)) return metricRow(label, 'Sin histórico');
      const fraction = format(group.renewed) + ' de ' + format(group.eligible);
      return metricRow(label, group.eligible > 0 ? ratio(group.renewed, group.eligible) + ' · ' + fraction : fraction);
    }).join('')}</dl><p class="mg-note">${note}</p></section>`;
  }
  const reviewLabels = {pending:'Pendiente', reviewing:'En revisión', ready:'Revisado'};
  function accountLookupPanel() {
    return `<section class="mg-panel mg-block"><h2>Consultar una cuenta</h2>
      <form class="mg-review" data-mg-account><label>Nombre de perfil completo<input name="name" required maxlength="32" autocomplete="off"></label>
      <div><button type="submit" class="mg-refresh">Buscar perfil</button></div>
      <p role="status" class="mg-note" aria-live="polite"></p></form><div data-mg-results></div></section>`;
  }
  async function lookupAccounts(form) {
    if (!permitted() || form.dataset.searching) return;
    const submit = form.querySelector('button'), status = form.querySelector('[role="status"]'), results = form.parentElement.querySelector('[data-mg-results]');
    submit.disabled = true;
    form.dataset.searching = '1';
    results.replaceChildren();
    status.textContent = 'Buscando perfiles…';
    try {
      const data = await root.GameAccountBridge.request('/api/admin/accounts/search',{name:form.elements.name.value},'POST');
      if (!permitted() || !form.isConnected) return;
      status.textContent = data.more ? 'Se muestran las diez altas más recientes con ese nombre.' :
        data.accounts.length ? 'Perfiles encontrados: '+format(data.accounts.length)+'.' : 'Ningún perfil coincide con ese nombre.';
      const seasons = report?.seasonActivity?.seasons || [];
      results.innerHTML = data.accounts.map(account => `<article><h3>${escape(account.name)}</h3><p>Alta el ${dateText(account.registeredAt)} · ${account.paidPeriod ? 'Con cuota vigente' : 'Sin cuota vigente'} según el último pago registrado.</p>
        <div class="mg-table-wrap" tabindex="0" role="region" aria-label="Progreso por tablero de ${escape(account.name)}"><table><caption class="mg-sr">Bloques y casos de ${escape(account.name)}</caption><thead><tr><th scope="col">Tablero</th><th scope="col">Bloques pagados</th><th scope="col">Casos disponibles</th><th scope="col">Casos resueltos</th></tr></thead><tbody>${account.boards.map(board=>
          `<tr><th scope="row">${escape(seasons[board.number-1]?.name || 'Tablero '+board.number)}</th><td>${format(board.blocks)}</td><td>${format(board.available)}</td><td>${format(board.completed)}</td></tr>`).join('')}</tbody></table></div>
        ${account.supportRef?`<details><summary>Editar nombre público</summary><form class="mg-review" data-mg-profile-name data-ref="${escape(account.supportRef)}" data-previous="${escape(account.name)}" data-version="${escape(account.updatedAt)}">
        <label>Nombre en el perfil<input name="name" value="${escape(account.name)}" maxlength="32" required></label>
        <button class="mg-refresh" type="submit">Guardar nombre</button><p role="status" aria-live="polite"></p></form></details>`:''}</article>`).join('');
    } catch (error) {
      if (permitted() && form.isConnected) status.textContent = error.message || 'No se ha podido consultar el perfil.';
    } finally {
      delete form.dataset.searching;
      submit.disabled = false;
    }
  }
  async function renameProfile(form){
    if(!permitted()||form.dataset.saving)return;
    const field=form.elements.name,status=form.querySelector('[role=status]'),button=form.querySelector('button');
    const name=field.value.trim();
    if(!name){status.textContent='Escribe el nombre que debe aparecer en el perfil.';field.focus();return;}
    if(name===form.dataset.previous){status.textContent='El nombre ya está guardado.';return;}
    form.dataset.saving='1';button.disabled=true;field.readOnly=true;
    try{
      const result=await root.GameAccountBridge.request('/api/admin/accounts/profile',{ref:form.dataset.ref,previous:form.dataset.previous,updatedAt:form.dataset.version,name},'PUT');
      if(!permitted()||!form.isConnected)return;
      field.value=result.name;form.dataset.previous=result.name;form.dataset.version=result.updatedAt;
      const article=form.closest('article');
      article.querySelector('h3').textContent=result.name;
      article.querySelector('[role=region]').setAttribute('aria-label','Progreso por tablero de '+result.name);
      status.textContent='Nombre público actualizado.';
    }catch(error){if(form.isConnected)status.textContent=error.message||'No se pudo guardar el nombre.';}
    finally{delete form.dataset.saving;button.disabled=false;field.readOnly=false;}
  }
  function caseName(id) {
    const list = id <= 12 ? root.ValdemarCatalog?.items : root.MundosCatalogo;
    return list?.find(item => item.id === id)?.title || 'Caso ' + ((id-1)%12+1);
  }
  function reviewFields(id, data) {
    const review = data.caseReviews?.[id];
    return `<label>Estado editorial<select name="status">${Object.entries(reviewLabels).map(([key, label]) =>
      `<option value="${key}" ${key === (review?.status || 'pending') ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Nota interna<textarea name="note" maxlength="500" rows="3">${escape(review?.note || '')}</textarea></label>
      <div class="mg-review-actions"><a href="#${id <= 12 ? 'valdemar' : 'mundos'}-jugar?id=${id}">Abrir caso</a>
      <button class="mg-refresh" type="submit">Guardar revisión</button></div>
      <p class="mg-note" role="status" aria-live="polite">${review?.updatedAt ? 'Última revisión el '+dateText(review.updatedAt, updatedFormat)+' (hora de Madrid).' : ''}</p>`;
  }
  function reviewPanel(data) {
    if (!data.seasonActivity || !data.caseReviews) return '<section class="mg-panel mg-block"><h2>Revisión de contenidos</h2><p class="mg-note">El estado editorial de los casos todavía no está disponible.</p></section>';
    const cases=data.seasonActivity.seasons.flatMap(s=>s.cases.map(c=>(s.number-1)*12+c.number));
    const totals=Object.fromEntries(Object.keys(reviewLabels).map(k=>[k,0]));
    for(const id of cases){const status=data.caseReviews[id]?.status;totals[Object.hasOwn(reviewLabels,status)?status:'pending']++;}
    const options = data.seasonActivity.seasons.map(s => `<optgroup label="${escape(s.name)}">${s.cases.map(c => {
      const id = (s.number-1)*12+c.number;
      return `<option value="${id}">${String(c.number).padStart(2,'0')} · ${escape(caseName(id))} — ${reviewLabels[data.caseReviews[id]?.status]||reviewLabels.pending}</option>`;
    }).join('')}</optgroup>`).join('');
    return `<section class="mg-panel mg-block"><h2>Revisión de contenidos</h2><p class="mg-note">Guarda las incidencias de las pruebas, los audios y las pistas de cada caso. Estas notas solo aparecen en gestión.</p>
      <dl class="mg-review-counts" aria-label="Estado de los casos">${Object.entries({pending:'Pendientes',reviewing:'En revisión',ready:'Revisados'}).map(([k,label])=>`<div><dt>${label}</dt><dd data-mg-count="${k}">${format(totals[k])}</dd></div>`).join('')}</dl>
      ${cases.length?`<form class="mg-review" data-mg-review><label>Caso<select name="caseId">${options}</select></label><div data-mg-review-fields>${reviewFields(cases[0], data)}</div></form>`:'<p class="mg-empty">Todavía no hay casos disponibles para revisar.</p>'}</section>`;
  }
  async function saveReview(form) {
    const previousReport = report;
    if (!permitted() || !previousReport || form.dataset.saving) return;
    const id = Number(form.elements.caseId.value);
    const input = {caseId:id,status:form.elements.status.value,note:form.elements.note.value,
      version:form.dataset.mgEdited!==undefined?Number(form.dataset.mgEdited):previousReport.caseReviews[id]?.version || 0};
    const status = form.querySelector('[role="status"]');
    form.dataset.saving = '1';
    for (const field of form.elements) field.disabled = true;
    try {
      const review = await root.GameAccountBridge.request('/api/admin/case-review',input,'PUT');
      if (!permitted() || !form.isConnected) return;
      const before=previousReport.caseReviews[id]?.status||'pending';
      previousReport.caseReviews[id] = review;
      if(report&&report!==previousReport && (!report.caseReviews[id]||report.caseReviews[id].version<=review.version))report.caseReviews[id]=review;
      delete form.dataset.mgEdited;
      if(before!==review.status){
        for(const [key,delta] of [[before,-1],[review.status,1]]){
          const count=host()?.querySelector('[data-mg-count="'+key+'"]');
          if(count)count.textContent=format(Number(count.textContent)+delta);
        }
        const option=form.elements.caseId.selectedOptions[0];
        if(option)option.textContent=String((id-1)%12+1).padStart(2,'0')+' · '+caseName(id)+' — '+reviewLabels[review.status];
      }
      status.textContent = 'Revisión guardada.';
    } catch (error) {
      if (permitted() && form.isConnected) status.textContent = error.message || 'No se ha podido guardar la revisión.';
    } finally {
      delete form.dataset.saving;
      for (const field of form.elements) field.disabled = false;
    }
  }
  function boardReport(data) {
    const board = data.seasonActivity;
    if (!board) return '';
    const {cohort,seasons} = board;
    const names = [...(root.ValdemarCatalog?.items || []), ...(root.MundosCatalogo || [])];
    const measurable = valid(board.since) && cohort.until > board.since;
    const retention = !measurable ? 'Pendiente de 14 días completos' :
      cohort.eligible ? ratio(cohort.second,cohort.eligible) + ' · ' + format(cohort.second) + ' de ' + format(cohort.eligible) : 'Sin primeras partidas en este grupo';
    const group = measurable ? 'Primeras partidas del '+dateText(Math.max(cohort.from,board.since))+' al '+dateText(cohort.until-1)+' (UTC). ' : '';
    const coverage = valid(board.since) ? 'Los inicios se fechan desde el '+dateText(board.since)+'. ' : 'La fecha de inicio de medición aún no está disponible. ';
    const playHeadings = '<th scope="col">Tiempo medio hasta el desenlace</th><th scope="col">Fichas en pareja</th><th scope="col">Llaves gastadas en el periodo</th>';
    const playCells = row => `<td>${averageElapsed(row)}</td><td>${pairedShare(row)}</td><td>${format(row.keysSpent)}</td>`;
    const totals = {completed:0, elapsedMs:0, solo:0, duo:0, keysSpent:0};
    for (const season of seasons) {
      for (const field of Object.keys(totals)) totals[field] += season[field];
    }
    const transitions = board.transitions.map(t => metricRow(
      escape(seasons[t.from-1].name)+' a '+escape(seasons[t.from].name),
      t.eligible ? ratio(t.bought,t.eligible)+' · '+format(t.bought)+' de '+format(t.eligible) : 'Sin titulares elegibles'
    )).join('');
    return `<section class="mg-panel mg-block"><div class="mg-section-heading"><h2>Juego de pago en los cuatro tableros</h2><span>48 casos</span></div>
      <p class="mg-note">${coverage}En cada temporada se muestran las partidas guardadas que empezaron durante el periodo elegido y cuántas de ellas ya tienen desenlace.</p>
      <dl class="mg-rows">${metricRow('Titulares que empezaron su primer caso en el periodo',format(board.firstPlayers))}
      ${metricRow('Tiempo medio hasta el desenlace',averageElapsed(totals))}
      ${metricRow('Fichas en pareja con modo conocido',pairedShare(totals))}
      ${metricRow('Llaves gastadas en ayudas durante el periodo',format(totals.keysSpent))}</dl>
      <div class="mg-table-wrap" tabindex="0" role="region" aria-label="Actividad por tablero"><table><thead><tr><th scope="col">Tablero</th><th scope="col">Titulares que jugaron</th><th scope="col">Partidas iniciadas</th><th scope="col">De ellas, resueltas</th>${playHeadings}<th scope="col">Titulares con cuota en curso hoy</th></tr></thead><tbody>${seasons.map(s => `<tr><th scope="row">${escape(s.name)}</th><td>${valid(board.since) ? format(s.activeHolders) : 'N/D'}</td><td>${format(s.started)}</td><td>${format(s.completed)}</td>${playCells(s)}<td>${format(s.paidPeriodHolders)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mg-note">Cada titular cuenta una vez por tablero, incluso si retomó una partida anterior. Las cuotas se atribuyen al tablero del bloque pagado.</p>
      <p class="mg-note">El tiempo transcurrido incluye las pausas entre el inicio y el desenlace de las partidas resueltas. El juego activo carece de cronómetro. La proporción en pareja usa el último modo guardado de cada ficha iniciada en el periodo. Ambos participantes cuentan si conservan una ficha con modo conocido.</p>
      <details class="mg-details"><summary>Ver los 48 casos</summary><div class="mg-table-wrap" tabindex="0" role="region" aria-label="Casos de temporada"><table><thead><tr><th scope="col">Caso</th><th scope="col">Iniciadas</th><th scope="col">Resueltas</th>${playHeadings}</tr></thead><tbody>${seasons.map(s=>s.cases.map(c=>{
        const id=(s.number-1)*12+c.number, name=names.find(item=>item.id===id)?.title;
        return `<tr><th scope="row">T${s.number} · ${String(c.number).padStart(2,'0')}${name?' · '+escape(name):''}</th><td>${format(c.started)}</td><td>${format(c.completed)}</td>${playCells(c)}</tr>`;
      }).join('')).join('')}</tbody></table></div></details>
      ${hintCosts(board.hints)}
      <div class="mg-columns"><div><h3>Segundo caso en 14 días</h3><p><strong>${retention}</strong></p><p class="mg-note">${group}Porcentaje de titulares que resolvieron al menos una etapa de otro caso en las 336 horas posteriores a empezar el primero. Se excluyen los historiales reiniciados o con inicios anteriores sin fecha.</p></div>
      <div><h3>Compra de la siguiente temporada</h3><dl class="mg-rows">${transitions}</dl><p class="mg-note">Acumulado a día de hoy. De quienes conservan el sello completo y han agotado las tres cuotas de esa temporada, cuántos tienen un pago vigente o pasado para la siguiente. Se excluyen bloques revocados.</p></div></div></section>`;
  }
  function hintCosts(hints) {
    if (!hints) return '';
    const labels = {open:'Primera pista', second:'Segunda pista', solution:'Solución'};
    const undated = Object.values(hints).reduce((sum, h) => sum + h.undated, 0);
    return `<h3>Coste de las ayudas en llaves</h3>
      <div class="mg-table-wrap" tabindex="0" role="region" aria-label="Coste de las ayudas"><table><caption class="mg-sr">Aperturas de ayudas y llaves gastadas en el periodo</caption><thead><tr><th scope="col">Ayuda</th><th scope="col">Aperturas registradas</th><th scope="col">Llaves gastadas</th></tr></thead>
      <tbody>${Object.entries(labels).map(([kind,label])=>`<tr><th scope="row">${label}</th><td>${format(hints[kind].uses)}</td><td>${format(hints[kind].keys)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mg-note">Se suman los cargos registrados durante el periodo, incluso en casos iniciados antes. Una pista compartida cuenta en el llavero de quien la abre. Las aperturas gratuitas cuentan con coste cero. Solo se conservan los movimientos posteriores al último reinicio de cada titular.${undated ? ' Aperturas históricas sin fecha o coste verificable, excluidas del periodo: ' + format(undated) + '.' : ''}</p>`;
  }
  function trialReport(rows){
    const title='<h2>Seguimiento de pruebas</h2>';
    if(!rows?.length)return '<section class="mg-panel">'+title+'<p>Todavía no se han registrado intentos de las nuevas mediciones en este periodo.</p></section>';
    const cell=v=>format(Number(v));
    const titleOf=r=>r.game.startsWith('juego/')?caseName(Number(r.game.slice(6))):r.game.slice(6);
    const stalled=rows.filter(r=>Number(r.inactive)>0&&Number(r.started)>0)
      .sort((a,b)=>Number(b.inactive)-Number(a.inactive)||b.inactive/b.started-a.inactive/a.started).slice(0,3);
    const signal=stalled.length?'<h3>Pruebas que conviene revisar</h3><ol>'+stalled.map(r=>'<li>'+escape(titleOf(r))+' · '+escape(r.trial)+' — '+cell(r.inactive)+' de '+cell(r.started)+' partidas siguen sin resolver tras 14 días de inactividad.</li>').join('')+'</ol>':'';
    const body=rows.map(r=>{
      const game=titleOf(r);
      return '<tr><th scope="row">'+escape(game)+'</th><td>'+escape(r.trial)+'</td><td>'+cell(r.started)+'</td><td>'+cell(r.solved)+'</td><td>'+cell(r.inactive)+'</td><td>'+averageElapsed({completed:Number(r.solved),elapsedMs:Number(r.elapsedMs)})+'</td></tr>';
    }).join('');
    return '<section class="mg-panel mg-block">'+title+signal+'<p>Intentos iniciados en el periodo. Una partida sin resolver lleva 14 días inactiva si no ha enviado otra respuesta. El tiempo transcurrido entre el primer intento y la solución incluye pausas.</p><div class="mg-table-wrap" tabindex="0"><table><thead><tr><th>Juego</th><th>Prueba</th><th>Partidas que la intentaron</th><th>Resueltas</th><th>Inactivas 14 días</th><th>Tiempo medio hasta resolver</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
  }
  function rewardReport(data){
    if(!data)return '';
    const list=values=>Object.entries(values||{}).map(([k,v])=>metricRow(escape(k),format(v))).join('');
    const kinds={challenge:'Desafío publicado',reward:'Reto paralelo',mansionArcade:'Sala de Ada',seasonArcade:'Sala de temporada',calendarChallenge:'Calendario'};
    const games=data.extraWins.map(row=>metricRow(escape(kinds[row.kind])+(row.caseId?' · '+escape(caseName(row.caseId)):''),format(row.solved))).join('');
    return '<details class="mg-details mg-panel"><summary>Llaves, habilidades y logros</summary><h3>Llavero</h3><p>'+format(data.keys)+' llaves disponibles en '+format(data.knownBalances)+' llaveros con historial confirmado.</p><h3>Extras resueltos en el periodo</h3>'+(games?'<dl class="mg-rows">'+games+'</dl>':'<p>Todavía no hay premios registrados en este periodo.</p>')+'<h3>Puntos de habilidad acumulados</h3><dl class="mg-rows">'+list(data.skills)+'</dl><h3>Perfiles con cada medalla</h3><dl class="mg-rows">'+list(data.medals)+'</dl><h3>Experiencia por recompensa</h3><dl class="mg-rows">'+data.rules.map(r=>metricRow(escape(r.name),format(r.unit)+' XP')).join('')+'</dl></details>';
  }
  function operationReport(data){
    const mail=data.mail,pairs=data.pairs;
    return '<details class="mg-details mg-panel"><summary>Parejas, comunicaciones e historial de publicación</summary><h3>Parejas</h3><dl class="mg-rows">'+metricRow('Vínculos recíprocos registrados',format(pairs.linked))+metricRow('Ambos miembros con periodo abonado vigente',format(pairs.bothPaid))+'</dl><h3>Comunicaciones automáticas</h3><dl class="mg-rows">'+metricRow('Pendientes de entrega',format(mail.pending||0))+metricRow('Enviadas al proveedor',format(mail.sent||0))+metricRow('Requieren revisión',format(mail.review||0))+'</dl><h3>Últimas publicaciones de aventuras</h3>'+(data.releases.length?'<ol>'+data.releases.map(r=>'<li>'+escape(r.title)+' · edición '+format(r.revision)+' · '+dateText(r.at)+'</li>').join('')+'</ol>':'<p>Todavía no se han publicado aventuras desde el taller.</p>')+'</details>';
  }
  function details(data) {
    const t = data.totals, o = data.optional, since = data.noticeSince ? dateText(data.noticeSince) : '';
    const notes = [];
    if (data.coverage?.noticePartial) notes.push(since ? 'El historial de solicitudes y retiradas de avisos empieza el ' + since + '. Las cifras del periodo cubren desde esa fecha.' : 'El historial de solicitudes y retiradas de avisos todavía es parcial.');
    if (data.coverage?.billingPartial) notes.push('El historial de pagos o de movimientos de suscripciones está incompleto para este periodo.');
    if (data.coverage?.undatedSessions > 0) notes.push('Partidas sin fecha de inicio, excluidas del análisis del periodo: ' + format(data.coverage.undatedSessions) + '.');
    return `<div class="mg-columns mg-block"><section class="mg-panel"><h2>Avisos de apertura</h2><dl class="mg-rows">${metricRow('Solicitudes recibidas', format(t.noticeAdds))}${metricRow('Solicitudes retiradas', format(t.noticeRemoves))}</dl><p class="mg-note">Estos movimientos proceden del formulario público. El total de avisos vigentes incluye también las solicitudes de cuentas verificadas y cuenta cada correo una vez.</p></section>
      <section class="mg-panel"><h2>Motivos de baja</h2><dl class="mg-rows">${metricRow('Cancelación voluntaria', format(t.voluntaryEnds))}${metricRow('Fin de temporada', format(t.seasonEnds))}${metricRow('Otro motivo o sin clasificar', format(t.otherEnds))}</dl></section></div>
      <section class="mg-panel mg-block"><h2>Demo e invitaciones</h2><p class="mg-note">Recuentos de eventos con permiso para el análisis. Una persona puede generar varios eventos. El total de visitantes únicos de la web se desconoce.</p><div class="mg-columns"><dl class="mg-rows">${metricRow('Inicios de demo', format(o.demo_start))}${metricRow('Copias identificadas en recepción', format(o.demo_receipt))}${metricRow('Primer expediente abierto', format(o.demo_solved))}${metricRow('Aperturas del pase desde la demo', format(o.plans_view))}${metricRow('Demos completadas', format(o.demo_complete))}${metricRow('Pistas consultadas en la demo', format(o.demo_hint))}</dl><dl class="mg-rows">${metricRow('Llegadas por invitación', format(o.ref_visit))}${metricRow('Inicios de demo por invitación', format(o.ref_demo))}${metricRow('Avisos solicitados por invitación', format(o.ref_notice))}</dl></div></section>
      <aside class="mg-method"><h2>Cómo leer los datos</h2><p>La evolución se agrupa en días UTC. La actividad editorial identificada se excluye de los perfiles y las partidas. Una raya indica que el dato no está disponible o que falta una base para calcular el porcentaje.</p>${notes.map(note => `<p>${escape(note)}</p>`).join('')}</aside>`;
  }
  function show(data) {
    const el = host();
    if (!el || !permitted()) return;
    saveGoalField(el);
    el.querySelector('[data-mg-overview]').innerHTML=summary(data)+chart(data)+monthlyGoal(data)
      +'<details class="mg-details mg-more"><summary>Comparaciones, renovaciones y detalle de medición</summary>'
      +comparison(data)+'<div class="mg-columns mg-block">'+activation(data)+renewals(data)+'</div>'+details(data)+'</details>';
    el.querySelector('[data-mg-games]').innerHTML=boardReport(data)+trialReport(data.trials)+rewardReport(data.rewards)+activity(data);
    const overview=el.querySelector('[data-mg-overview]');
    if(data.operations)overview.insertAdjacentHTML('beforeend',operationReport(data.operations));
    const reviews=el.querySelector('[data-mg-reviews]');
    const oldForm=reviews.querySelector('form');
    if(!oldForm || oldForm.dataset.mgEdited===undefined){
      const selected=oldForm?.elements.caseId.value;
      reviews.innerHTML=reviewPanel(data);
      const nextForm=reviews.querySelector('form');
      if(nextForm && selected && Array.from(nextForm.elements.caseId.options).some(option=>option.value===selected)){
        nextForm.elements.caseId.value=selected;
        nextForm.querySelector('[data-mg-review-fields]').innerHTML=reviewFields(Number(selected),data);
      }
    }
    const goal = el.querySelector('[data-mg-target]');
    goal.dataset.lastHandled = goal.value;
    const onGoalInput = () => {
      if (!permitted() || host() !== el) return;
      saveGoalField(el);
      simulate(el, data.month?.grossCents);
    };
    goal.addEventListener('input', onGoalInput, true);
    goal.addEventListener('change', onGoalInput, true);
    announceAfterEdit(el, goal, goal, data.month?.grossCents);
    announceAfterEdit(el, el.querySelector('[data-mg-deductions]'), goal, data.month?.grossCents);
    el.querySelector('[data-mg-overview]').setAttribute('aria-busy','false');
    el.querySelector('[data-mg-games]').setAttribute('aria-busy','false');
    el.querySelector('.mg-status').textContent = 'Actualizado el ' + dateText(data.generatedAt, updatedFormat) + ' (hora de Madrid).';
  }
  function setControls(el) {
    el.querySelectorAll('[data-mg-days]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.mgDays) === days)));
    el.querySelector('[data-mg-refresh]').disabled = loading;
  }
  async function load() {
    if (!permitted() || !host()) { clear(); return; }
    const current = ++generation;
    loading = true;
    const el = host();
    saveGoalField(el);
    setControls(el);
    el.querySelector('.mg-status').textContent = 'Consultando los últimos ' + days + ' días…';
    for(const region of el.querySelectorAll('[data-mg-overview],[data-mg-games]'))region.setAttribute('aria-busy','true');
    try {
      const data = await root.GameAccountBridge.request('/api/admin/analytics?days=' + days);
      if (generation !== current || !host() || !permitted()) return;
      if (!data?.stock || !data.totals || !data.optional || !Array.isArray(data.daily) || !Array.isArray(data.cases)) throw new Error('Respuesta incompleta');
      show(data);
      report = data;
    } catch {
      if (generation !== current || !host() || !permitted()) return;
      const panel = host();
      panel.querySelector('.mg-status').textContent = 'No se han podido cargar los datos. Puedes volver a intentarlo.';
      for(const region of panel.querySelectorAll('[data-mg-overview],[data-mg-games]'))region.setAttribute('aria-busy','false');
      const reviews=panel.querySelector('[data-mg-reviews]');
      if(!reviews.querySelector('form'))reviews.innerHTML='<section class="mg-panel"><h2>Revisión de contenidos</h2><p>No se han podido cargar los casos.</p><button type="button" class="mg-refresh" data-mg-retry>Reintentar</button></section>';
    } finally {
      if (generation === current) {
        loading = false;
        if (host() && permitted()) setControls(host());
      }
    }
  }
  function mount() {
    const el = host();
    if (!el || !permitted()) { clear(); return; }
    if (!el.dataset.mgBound) {
      el.dataset.mgBound = '1';
      el.addEventListener('click', event => {
        if (!permitted()) { clear(); return; }
        const button = event.target.closest('button');
        if (!button) return;
        if(button.matches('[data-mg-section]'))selectSection(el,button.dataset.mgSection);
        else if (button.matches('[data-mg-days]')) {
          const next = Number(button.dataset.mgDays);
          if (!ranges.includes(next) || days === next) return;
          days = next;
          load();
        } else if (button.matches('[data-mg-refresh],[data-mg-retry]') && !loading) load();
        else if (button.matches('[data-mg-export]') && report) downloadDaily(report, el);
      });
      el.addEventListener('keydown',event=>{
        const tab=event.target.closest?.('[data-mg-section]');
        if(!tab||!permitted())return;
        const index=sections.findIndex(([id])=>id===tab.dataset.mgSection);
        let next;
        if(event.key==='ArrowLeft')next=(index+sections.length-1)%sections.length;
        else if(event.key==='ArrowRight')next=(index+1)%sections.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=sections.length-1;
        else return;
        event.preventDefault();
        const id=sections[next][0];
        selectSection(el,id);
        el.querySelector('#mg-tab-'+id).focus();
      });
      el.addEventListener('submit', event => {
        if(event.target.matches('[data-mg-profile-name]')){event.preventDefault();renameProfile(event.target);return;}
        if (event.target.matches('[data-mg-account]')) {
          event.preventDefault();
          lookupAccounts(event.target);
          return;
        }
        if (!event.target.matches('[data-mg-review]')) return;
        event.preventDefault();
        saveReview(event.target);
      });
      el.addEventListener('change', event => {
        if (!permitted()) { clear(); return; }
        if (event.target.matches('[data-mg-review] [name="caseId"]') && report) {
          delete event.target.form.dataset.mgEdited;
          event.target.form.querySelector('[data-mg-review-fields]').innerHTML = reviewFields(Number(event.target.value),report);
          return;
        }
        if(event.target.matches('[data-mg-review] [name="status"]') && report){
          const form=event.target.form;
          form.dataset.mgEdited??=String(report.caseReviews[form.elements.caseId.value]?.version||0);
        }
        if (!event.target.matches('[data-mg-chart]') || !Object.hasOwn(charts, event.target.value) || !report) return;
        selectedChart = event.target.value;
        el.querySelector('.mg-chart-body').innerHTML = chartBody(report);
      });
      el.addEventListener('input', event => {
        if (!permitted()) { clear(); return; }
        if(event.target.matches('[data-mg-review] textarea') && report){
          const form=event.target.form;
          form.dataset.mgEdited??=String(report.caseReviews[form.elements.caseId.value]?.version||0);
        }
        if (event.target.matches('[data-mg-deductions]') && report) simulate(el, report.month?.grossCents);
      });
    }
    setControls(el);
    if(currentSection==='edicion')mountEditors();
    if (report) show(report);
    else if (!loading) load();
    else el.querySelector('.mg-status').textContent = 'Consultando los últimos ' + days + ' días…';
  }
  function clear() {
    generation++;
    loading = false;
    report = null;
    sessionGoalCents = undefined;
    goalPersisted = false;
    days = 30;
    selectedChart = 'accounts';
    currentSection = 'resumen';
    host()?.replaceChildren();
  }
  root.ManagementUI = { view, mount, clear };
})(window);
