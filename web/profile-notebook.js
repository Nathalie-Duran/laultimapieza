(function (root) {
  'use strict';

  const covers = new Set([
    'cartas-medianoche', 'ultima-funcion', 'archivo-ausencias', 'marea-quieta', 'frecuencia-17',
    'jardin-invierno', 'retrato-prestado', 'mesa-13', 'tren-detenido', 'ciudad-invisible',
    'ultimo-coro', 'ultima-invitacion', 'habitacion-309'
  ]);
  const sessionDate = new Intl.DateTimeFormat('es-ES', {day: 'numeric', month: 'short', year: 'numeric'});
  const notebookCover = '/cuaderno-investigacion.jpg';
  const milestones = [
    [3, 'Una marca compartida'],
    [6, 'La carta de Irene'],
    [9, 'La entrega pendiente'],
    [12, 'Las doce piezas del plano']
  ];
  const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
  const cover = session => covers.has(session?.caseId) ? '/' + session.caseId + '.jpg' : notebookCover;
  const title = (session, stories) => stories.get(session?.caseId)?.title || 'Caso guardado';
  const finished = session => session.status === 'finished';
  const waiting = session => session.status === 'waiting';
  const accessibleLabel = (label, context) => context ? ' aria-label="' + escape(label + ' · ' + context) + '"' : '';
  function link(route, label, primary = true, context = '') {
    return '<a class="button' + (primary ? ' primary' : '') + '" href="#' + route + '"' + accessibleLabel(label, context) + '>' + escape(label) + '</a>';
  }
  const browse = (text, primary = true, context = '') => link('casos', text, primary, context);
  const plans = (primary = true, context = '') => link('planes', 'Ver la suscripción', primary, context);

  function control(action, id, label, primary, context = '') {
    return '<button class="button' + (primary ? ' primary' : '') + '" type="button" data-action="' + action +
      '" data-id="' + escape(id) + '"' + accessibleLabel(label, context) + '>' + escape(label) + '</button>';
  }

  function sessionState(session) {
    if (finished(session)) return 'Partida terminada';
    if (waiting(session)) return 'A la espera de tu cómplice';
    return session.mode === 'duo' ? 'Investigación en dúo' : 'Investigación en curso';
  }

  function featured(session, stories, canPlay, mayOpen, userId, online, pieces, detail) {
    const context = detail ? title(session, stories) + ' · ' + detail : '';
    let kicker, heading, description, actions;
    if (!session) {
      kicker = 'Tu cuaderno de investigación';
      heading = pieces ? 'Elige tu siguiente misterio' : 'Tu primera investigación';
      description = canPlay
        ? 'Elige un caso del catálogo. Puedes seguir las dos pistas a solas o investigar con un cómplice.'
        : 'Prueba un misterio independiente de 3–5 minutos y descubre cómo se cruzan las pistas.';
      actions = canPlay ? browse('Elegir un caso') :
        '<button type="button" class="button primary" data-action="preview-open">Probar la demo gratis</button>' + plans(false);
    } else if (!mayOpen(session)) {
      kicker = sessionState(session);
      heading = title(session, stories);
      description = canPlay ? 'Esta partida está guardada. Puedes elegir otro caso disponible en tu catálogo.'
        : 'Tu partida está guardada. Consulta tu acceso para continuarla.';
      actions = canPlay ? browse('Elegir otro caso', true, context) : plans(true, context);
      if (finished(session)) actions += link('archivo', 'Consultar mi archivo', false, context);
    } else if (finished(session)) {
      const story = stories.get(session.caseId);
      const solved = hasResolution(session, story);
      kicker = solved ? 'Misterio resuelto' : 'Historia terminada';
      heading = title(session, stories);
      description = pieces === 12 ? '¡Has reunido las doce piezas! Abre tu plano para resolver la clave del epílogo.'
        : story?.season === 1 && !solved ? '¡Has llegado al desenlace! Revisa el enigma final para recuperar la pieza de este caso.'
        : '¡Has llegado al desenlace! Esta investigación ya forma parte de tu archivo.';
      actions = control('resume', session.id, 'Ver mi desenlace', true, context) +
        (pieces === 12 ? '<a class="button" href="#mapa">Ver mi plano</a>' : browse('Explorar los casos', false));
    } else {
      kicker = sessionState(session);
      heading = title(session, stories);
      if (waiting(session) && session.mode === 'duo' && online && userId && session.ownerId === userId) {
        description = 'Comparte la invitación con la persona que investigará contigo.';
        actions = control('invite', session.id, 'Invitar a mi cómplice', true, context) + control('resume', session.id, 'Abrir la partida', false, context);
      } else {
        description = waiting(session) ? 'Abre la partida para consultar el estado de la invitación.'
          : 'Puedes continuar desde la última decisión guardada.';
        actions = control('resume', session.id, waiting(session) ? 'Abrir la partida' : 'Continuar la investigación', true, context);
      }
    }
    return '<article class="pn-feature" aria-labelledby="pn-feature-title"><div class="pn-cover"><img src="' +
      cover(session) + '" alt="" fetchpriority="high"></div><div class="pn-feature-copy"><p class="pn-kicker">' +
      escape(detail ? kicker + ' · ' + detail : kicker) + '</p><h2 id="pn-feature-title">' + escape(heading) + '</h2><p>' + description +
      '</p><div class="pn-actions">' + actions + '</div></div></article>';
  }

  function seasonProgress(pieces, partial) {
    const countLabel = partial ? (pieces ? pieces + ' confirmadas de 12' : 'Recuento por confirmar') : pieces + ' de 12 piezas';
    const next = partial ? null : milestones.find(([at]) => at > pieces)?.[0];
    const labels = milestones.map(([at, name]) => {
      const earned = at <= pieces;
      const state = earned ? 'Conseguido' : partial ? 'Por confirmar' : at === next ? 'Próximo hito' : 'Pendiente';
      return '<li class="' + (earned ? 'is-earned' : at === next ? 'is-next' : 'is-pending') +
        '"><span>' + at + ' piezas</span><strong>' + name + '</strong><small>' + state + '</small></li>';
    }).join('');
    return '<section class="pn-season" aria-labelledby="pn-season-title"><div class="pn-section-heading"><h2 id="pn-season-title">Mi plano de la temporada</h2><span class="pn-count">' +
      countLabel + '</span></div>' + (partial && !pieces ? '' : '<progress class="pn-meter" aria-label="Piezas de la temporada confirmadas" max="12" value="' +
      pieces + '">' + pieces + ' de 12</progress>') + (partial ? '<p>Falta confirmar la resolución de alguna partida guardada.</p>' : '') +
      '<p>Resolver un caso distinto de la temporada aporta una pieza. Los casos adicionales se guardan en tu archivo sin sumar piezas.</p>' +
      '<ol class="pn-milestones" aria-label="Hitos de la temporada">' + labels + '</ol><a class="text-link" href="#mapa">Consultar mi plano</a></section>';
  }

  function creationTime(session) {
    for (const value of [session.createdAt, session.startedAt]) {
      const time = typeof value === 'number' && value > 0 ? new Date(value).getTime()
        : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value) : NaN;
      if (Number.isFinite(time)) return time;
    }
  }

  function sessionDetails(sessions, stories) {
    const groups = new Map(), details = new Map();
    for (const session of sessions) {
      const label = title(session, stories);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(session);
    }
    for (const group of groups.values()) {
      const runs = group.map(session => ({session, stamp: creationTime(session)}));
      runs.sort((a, b) => (a.stamp ?? Infinity) - (b.stamp ?? Infinity) || String(a.session.id).localeCompare(String(b.session.id)));
      runs.forEach(({session, stamp}, index) => {
        const mode = session.mode === 'solo' ? 'Individual' : session.mode === 'duo' ? 'En dúo' : '';
        const labels = [group.length > 1 ? 'Partida ' + (index + 1) : '', mode];
        if (Array.isArray(session.history)) {
          const done = session.history.length, total = stories.get(session.caseId)?.decisionCount;
          labels.push(Number.isInteger(total) && total > 0 && done <= total ? done + ' de ' + total + ' decisiones'
            : done + (done === 1 ? ' decisión' : ' decisiones'));
        }
        if (stamp !== undefined) labels.push('Iniciada el ' + sessionDate.format(stamp));
        details.set(session.id, labels.filter(Boolean).join(' · '));
      });
    }
    return details;
  }

  function group(rows, name, model, expanded, onArchivePage = false) {
    if (!rows.length) return '';
    const {catalog: stories, mayOpen, details, canPlay} = model;
    const items = rows.map(session => {
      const label = title(session, stories);
      const detail = details.get(session.id), context = detail ? label + ' · ' + detail : label;
      const canResume = mayOpen(session);
      const state = [sessionState(session), detail, canResume ? '' : 'Requiere acceso'].filter(Boolean).join(' · ');
      const open = canResume ? control('resume', session.id, finished(session) ? 'Ver desenlace' : 'Abrir partida', false, context)
        : finished(session) && !onArchivePage ? link('archivo', 'Ver archivo', false, context)
        : canPlay ? browse('Elegir otro caso', false, context) : link('planes', 'Ver acceso', false, context);
      return '<li class="pn-row"><img class="pn-thumb" src="' + cover(session) +
        '" alt="" loading="lazy"><div class="pn-row-copy"><strong>' + escape(label) + '</strong><small>' +
        escape(state) + '</small></div><div class="pn-row-action">' + open + '</div></li>';
    }).join('');
    return '<details class="pn-group"' + (expanded ? ' open' : '') + '><summary>' + name + ' (' + rows.length +
      ')</summary><ul class="pn-list">' + items + '</ul></details>';
  }

  function hasResolution(session, story) {
    if (story?.season !== 1 || !finished(session) || !story.endings || !Object.hasOwn(story.endings, session.nodeId)) return false;
    const stamp = session.investigation?.solvedAt;
    if (typeof stamp === 'number') return Number.isFinite(stamp) && stamp > 0;
    return typeof stamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(stamp) && Number.isFinite(Date.parse(stamp));
  }

  function notebookModel({sessions = [], stories = [], canPlay = false, userId, caseAllowed} = {}) {
    const catalog = new Map(stories.map(story => [story.id, story]));
    const owned = sessions.filter(session => session?.id && userId && (session.ownerId === userId ||
      session.members?.some(member => member?.userId === userId)));
    function mayOpen(session) {
      if (!canPlay) return false;
      const invited = session.mode === 'duo' && userId && session.ownerId && session.ownerId !== userId &&
        session.members?.some(member => member?.userId === userId);
      return invited || typeof caseAllowed !== 'function' || (catalog.has(session.caseId) && caseAllowed(session.caseId));
    }
    return {catalog, owned, mayOpen, canPlay, details: sessionDetails(owned, catalog)};
  }

  function archive(input = {}) {
    const model = notebookModel(input);
    const {owned, canPlay} = model;
    const ongoing = owned.filter(session => !finished(session)), complete = owned.filter(finished);
    const groups = group(ongoing, 'En curso', model, true, true) + group(complete, 'Terminadas', model, !ongoing.length, true);
    const firstCase = canPlay ? browse('Elegir un caso') : '<button type="button" class="button primary" data-action="preview-open">Probar la demo gratis</button>';
    return '<section class="pn-dashboard pn-archive" aria-labelledby="pn-sessions-title"><div class="pn-section-heading"><h1 id="pn-sessions-title">Mis partidas</h1></div>' +
      (owned.length ? groups : '<p class="pn-empty">Todavía no tienes partidas guardadas.</p><div class="pn-actions">' + firstCase + '</div>') + '</section>';
  }

  function progress(input = {}) {
    const {activeSessionId, pieces, totals, canPlay = false, userId, online = false} = input;
    const model = notebookModel(input);
    const {catalog, owned, mayOpen, details} = model;
    const ongoing = owned.filter(session => !finished(session));
    const complete = owned.filter(finished);
    const playable = owned.filter(mayOpen);
    const candidates = playable.length ? playable : owned;
    const current = candidates.find(session => !finished(session) && session.id === activeSessionId) ||
      candidates.find(session => !finished(session)) || candidates.find(session => session.id === activeSessionId) || candidates[0];
    const seasonCases = complete.filter(session => catalog.get(session.caseId)?.season === 1);
    const resolved = new Set(seasonCases.filter(session => hasResolution(session, catalog.get(session.caseId))).map(session => session.caseId));
    const partial = !Number.isFinite(pieces) && seasonCases.some(session => !resolved.has(session.caseId));
    const count = Math.min(12, Math.max(0, Number.isFinite(pieces) ? Math.trunc(pieces) : resolved.size));
    const decisions = Number.isFinite(totals?.decisions) ? Math.max(0, Math.trunc(totals.decisions)) : '—';
    const summary = '<div class="notebook-numbers pn-summary" role="group" aria-label="Resumen de mi progreso"><div><strong>' +
      decisions + '</strong><span>Decisiones completadas</span></div><div><strong>' + ongoing.length +
      '</strong><span>Partidas en curso</span></div><div><strong>' + (partial && !count ? '—' : count) +
      '</strong><span>Piezas confirmadas</span></div></div>';
    const others = owned.filter(session => session.id !== current?.id);
    const otherRows = others.length ? group(others.filter(session => !finished(session)), 'En curso', model, true) +
      group(others.filter(finished), 'Terminadas', model, !others.some(session => !finished(session))) :
      '<p class="pn-empty">' + (current ? 'Tus demás investigaciones aparecerán aquí.' : 'Aquí encontrarás las partidas que empieces y los casos que termines.') + '</p>';
    return '<div class="pn-dashboard">' +
      featured(current, catalog, canPlay, mayOpen, userId, online, count, details.get(current?.id)) + summary + seasonProgress(count, partial) +
      '<section class="pn-archive" aria-labelledby="pn-archive-title"><div class="pn-section-heading"><h2 id="pn-archive-title">' +
      (current ? 'Mis otras partidas' : 'Mis partidas') + '</h2><a class="text-link" href="#archivo">Ver mi archivo</a></div>' + otherRows + '</section></div>';
  }

  root.PlayerNotebook = {...root.PlayerNotebook, progress, archive};
})(window);
