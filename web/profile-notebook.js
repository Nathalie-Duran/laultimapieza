(function (root) {
  'use strict';

  const covers = new Map([
    ['cartas-medianoche', '/cartas-medianoche.jpg'],
    ['ultima-funcion', '/ultima-funcion.jpg'],
    ['archivo-ausencias', '/archivo-ausencias.jpg'],
    ['marea-quieta', '/marea-quieta.jpg']
  ]);
  const notebookCover = '/cuaderno-investigacion.jpg';
  const milestones = [
    [3, 'Una marca compartida'],
    [6, 'La carta de Irene'],
    [9, 'La entrega pendiente'],
    [12, 'Las doce piezas del plano']
  ];
  const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
  const cover = session => covers.get(session?.caseId) || notebookCover;
  const title = (session, stories) => stories.get(session?.caseId)?.title || 'Caso guardado';
  const finished = session => session.status === 'finished';
  const waiting = session => session.status === 'waiting';
  const browse = (text, primary = true) => '<a class="button' + (primary ? ' primary' : '') + '" href="#casos">' + text + '</a>';
  const plans = (primary = true) => '<a class="button' + (primary ? ' primary' : '') + '" href="#planes">Ver la suscripción</a>';

  function control(action, id, label, primary) {
    return '<button class="button' + (primary ? ' primary' : '') + '" type="button" data-action="' + action +
      '" data-id="' + escape(id) + '">' + escape(label) + '</button>';
  }

  function sessionState(session) {
    if (finished(session)) return 'Partida terminada';
    if (waiting(session)) return 'A la espera de tu cómplice';
    return session.mode === 'duo' ? 'Investigación en dúo' : 'Investigación en curso';
  }

  function featured(session, stories, canPlay, mayOpen, userId, online, pieces) {
    let kicker, heading, description, actions;
    if (!session) {
      kicker = 'Tu cuaderno de investigación';
      heading = pieces ? 'Elige tu siguiente misterio' : 'Tu primera investigación';
      description = canPlay
        ? 'Elige un caso del catálogo. Puedes seguir las dos pistas a solas o investigar con un cómplice.'
        : 'Prueba un misterio independiente de 3–5 minutos y descubre cómo se cruzan las pistas.';
      actions = canPlay ? browse('Elegir un caso') :
        '<button type="button" class="button primary" data-action="preview-open">Probar la demo gratis</button>' + plans(false);
    } else if (finished(session)) {
      const story = stories.get(session.caseId);
      const solved = hasResolution(session, story);
      kicker = solved ? 'Misterio resuelto' : 'Historia terminada';
      heading = title(session, stories);
      description = pieces === 12 ? '¡Has reunido las doce piezas! Abre tu plano para resolver la clave del epílogo.'
        : story?.season === 1 && !solved ? '¡Has llegado al desenlace! Revisa el enigma final para recuperar la pieza de este caso.'
        : '¡Has llegado al desenlace! Esta investigación ya forma parte de tu archivo.';
      actions = (mayOpen(session) ? control('resume', session.id, 'Ver mi desenlace', true) :
        '<a class="button primary" href="#archivo">Consultar mi archivo</a>') +
        (pieces === 12 ? '<a class="button" href="#mapa">Ver mi plano</a>' : browse('Explorar los casos', false));
    } else {
      kicker = sessionState(session);
      heading = title(session, stories);
      if (!mayOpen(session)) {
        description = 'Tu partida está guardada. Consulta tu acceso para continuarla.';
        actions = plans();
      } else if (waiting(session) && session.mode === 'duo' && online && userId && session.ownerId === userId) {
        description = 'Comparte la invitación con la persona que investigará contigo.';
        actions = control('invite', session.id, 'Invitar a mi cómplice', true) + control('resume', session.id, 'Abrir la partida', false);
      } else {
        description = waiting(session) ? 'Abre la partida para consultar el estado de la invitación.'
          : 'Puedes continuar desde la última decisión guardada.';
        actions = control('resume', session.id, waiting(session) ? 'Abrir la partida' : 'Continuar la investigación', true);
      }
    }
    return '<article class="pn-feature" aria-labelledby="pn-feature-title"><div class="pn-cover"><img src="' +
      cover(session) + '" alt="" fetchpriority="high"></div><div class="pn-feature-copy"><p class="pn-kicker">' +
      kicker + '</p><h2 id="pn-feature-title">' + escape(heading) + '</h2><p>' + description +
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

  function group(rows, name, stories, mayOpen, expanded) {
    if (!rows.length) return '';
    const items = rows.map(session => {
      const label = title(session, stories);
      const open = mayOpen(session) ? control('resume', session.id, finished(session) ? 'Ver desenlace' : 'Abrir partida', false)
        : finished(session) ? '<a class="button" href="#archivo">Ver archivo</a>' : '<a class="button" href="#planes">Ver acceso</a>';
      return '<li class="pn-row"><img class="pn-thumb" src="' + cover(session) +
        '" alt="" loading="lazy"><div class="pn-row-copy"><strong>' + escape(label) + '</strong><small>' +
        sessionState(session) + '</small></div><div class="pn-row-action">' + open + '</div></li>';
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

  function progress({sessions = [], stories = [], activeSessionId, pieces, totals, canPlay = false, userId, caseAllowed, online = false} = {}) {
    const catalog = new Map(stories.map(story => [story.id, story]));
    const owned = sessions.filter(session => session?.id);
    function mayOpen(session) {
      if (!canPlay) return false;
      const invited = session.mode === 'duo' && userId && session.ownerId && session.ownerId !== userId &&
        session.members?.some(member => member.userId === userId);
      return invited || typeof caseAllowed !== 'function' || (catalog.has(session.caseId) && caseAllowed(session.caseId));
    }
    const ongoing = owned.filter(session => !finished(session));
    const complete = owned.filter(finished);
    const current = ongoing.find(session => session.id === activeSessionId) || ongoing[0] ||
      complete.find(session => session.id === activeSessionId) || complete[0];
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
    const archive = others.length ? group(others.filter(session => !finished(session)), 'En curso', catalog, mayOpen, true) +
      group(others.filter(finished), 'Terminadas', catalog, mayOpen, !others.some(session => !finished(session))) :
      '<p class="pn-empty">' + (current ? 'Tus demás investigaciones aparecerán aquí.' : 'Aquí encontrarás las partidas que empieces y los casos que termines.') + '</p>';
    return '<div class="pn-dashboard">' +
      featured(current, catalog, canPlay, mayOpen, userId, online, count) + summary + seasonProgress(count, partial) +
      '<section class="pn-archive" aria-labelledby="pn-archive-title"><div class="pn-section-heading"><h2 id="pn-archive-title">' +
      (current ? 'Mis otras partidas' : 'Mis partidas') + '</h2><a class="text-link" href="#archivo">Ver mi archivo</a></div>' + archive + '</section></div>';
  }

  root.PlayerNotebook = {...root.PlayerNotebook, progress};
})(window);
