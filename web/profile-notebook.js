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

  function featureCard(image, kicker, heading, description, actions) {
    return '<article class="pn-feature" aria-labelledby="pn-feature-title"><div class="pn-cover"><img src="' +
      escape(image || notebookCover) + '" alt="" fetchpriority="high"></div><div class="pn-feature-copy"><p class="pn-kicker">' +
      escape(kicker) + '</p><h2 id="pn-feature-title">' + escape(heading) + '</h2><p>' + escape(description) +
      '</p><div class="pn-actions">' + actions + '</div></div></article>';
  }

  function featured(session, stories, canPlay, mayOpen, userId, online, pieces, detail) {
    const context = detail ? title(session, stories) + ' · ' + detail : '';
    let kicker, heading, description, actions;
    if (!session) {
      kicker = 'Tu cuaderno de investigación';
      heading = pieces || (online && userId) ? 'Elige tu siguiente misterio' : 'Tu primera investigación';
      description = canPlay
        ? 'Elige un caso del catálogo. Puedes seguir las dos pistas a solas o investigar con un cómplice.'
        : 'Investiga la caja 87-V de la Clínica Vallejo en dos sesiones, a solas o en pareja.';
      actions = canPlay ? browse('Elegir un caso') :
        '<button type="button" class="button primary" data-action="preview-open">Jugar a Clínica Vallejo</button>' + plans(false);
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
        (pieces === 12 ? '<a class="button" href="#mapa-clasico">Ver mis doce piezas</a>' : browse('Explorar los casos', false));
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
    return featureCard(cover(session), detail ? kicker + ' · ' + detail : kicker, heading, description, actions);
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
    return '<section class="pn-season" aria-labelledby="pn-season-title"><div class="pn-section-heading"><h2 id="pn-season-title">Mi plano del archivo clásico</h2><span class="pn-count">' +
      countLabel + '</span></div>' + (partial && !pieces ? '' : '<progress class="pn-meter" aria-label="Piezas del archivo clásico confirmadas" max="12" value="' +
      pieces + '">' + pieces + ' de 12</progress>') + (partial ? '<p>Falta confirmar la resolución de alguna partida guardada.</p>' : '') +
      '<p>Terminar un caso del archivo clásico y contrastar su enigma aporta una pieza a este plano. Los casos adicionales se guardan en tu archivo sin sumar piezas.</p>' +
      '<ol class="pn-milestones" aria-label="Hitos de la temporada">' + labels + '</ol><a class="text-link" href="#mapa-clasico">Consultar el plano clásico</a></section>';
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
      const state = [sessionState(session), session.caseId==='habitacion-309'?'Caso retirado del catálogo':'', detail, canResume ? '' : 'Requiere acceso'].filter(Boolean).join(' · ');
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
      return typeof caseAllowed !== 'function' || (catalog.has(session.caseId) && caseAllowed(session.caseId));
    }
    return {catalog, owned, mayOpen, canPlay, details: sessionDetails(owned, catalog)};
  }

  function archive(input = {}) {
    const model = notebookModel(input);
    const {owned, canPlay} = model;
    const ongoing = owned.filter(session => !finished(session)), complete = owned.filter(finished);
    const groups = group(ongoing, 'En curso', model, true, true) + group(complete, 'Terminadas', model, !ongoing.length, true);
    const firstCase = canPlay ? browse('Elegir un caso') : '<button type="button" class="button primary" data-action="preview-open">Jugar a Clínica Vallejo</button>';
    const join = input.online && input.userId ? '<a class="button" href="/#perfil?seccion=pareja">Mis partidas en pareja</a>' : '';
    const seasons = input.online && input.userId && window.customElements?.get('season-archive');
    const seasonList = seasons ? '<season-archive'+(owned.length?' data-with-classic':'')+'></season-archive>' : '';
    const classic = owned.length ? (seasons?'<h2 class="pn-classic-heading">Archivo clásico</h2>':'')+groups :
      seasons ? '' : '<p class="pn-empty">Todavía no tienes partidas guardadas.</p><div class="pn-actions">'+firstCase+'</div>';
    return '<section class="pn-dashboard pn-archive" aria-labelledby="pn-sessions-title"><div class="pn-section-heading"><h1 id="pn-sessions-title">Mis partidas</h1>' + join + '</div>' +
      seasonList + classic + (input.online && input.userId ? '<button type="button" class="text-button" data-action="join">Introducir un código del archivo clásico</button>' : '') + '</section>';
  }

  function careerPanel(career, achievementsOnly = false) {
    const {xp, level, nextLevelXp, skills, achievements, pieces, rewards} = career;
    if (achievementsOnly) {
      const cards = achievements.map(item => {
        const earned = item.progress >= item.goal;
        return '<li class="' + (earned ? 'is-earned' : '') + '"><strong>' + escape(item.name) +
          '</strong><small>' + (earned ? 'Conseguido' : Math.min(item.progress, item.goal) + ' de ' +
          item.goal + ' · ' + escape(item.unit)) + '</small></li>';
      });
      const collection = pieces.map((count, index) => {
        const season = root.Colecciones.seasons[index];
        return '<li class="' + (count === 12 ? 'is-earned' : '') + '"><strong><a href="#' +
          escape(season.board) + '?seccion=sello">' + escape(season.seal) +
          '</a></strong><span>' + escape(season.name) + '</span><small>' +
          (count === 12 ? 'Reliquia conseguida' : count + ' de 12 piezas') + '</small></li>';
      });
      return '<section class="pn-career"><h2>Mis logros</h2><ul class="pn-career-grid">' +
        cards.join('') + '</ul><h2>Mis reliquias</h2><p>Cada aventura terminada aporta una pieza al sello de su tablero.</p>' +
        '<ul class="pn-career-grid">' + collection.join('') + '</ul></section>';
    }
    const cards = skills.map(skill => '<li><strong>' + escape(skill.name) + '</strong><span>' + skill.points +
      (skill.points === 1 ? ' punto' : ' puntos') + '</span><small>' + escape(skill.criterion) + '</small></li>');
    const lines = rewards.map(item => '<li><span>' + escape(item.name) + '</span><strong>' +
      item.count + ' × ' + item.unit + ' XP</strong></li>');
    return '<section class="pn-career"><div class="pn-section-heading"><h2>Mi personaje</h2><span class="pn-count">Nivel ' +
      level + '</span></div><p><strong>' + xp + ' XP</strong> · ' + (nextLevelXp - xp) + ' XP para el nivel ' +
      (level + 1) + '</p><progress class="pn-meter" max="500" value="' + (xp % 500) +
      '" aria-label="Avance dentro del nivel ' + level + '"></progress><details><summary>Cómo he ganado experiencia</summary>' +
      '<ul class="pn-xp-list">' + lines.join('') + '</ul></details><h3>Mis ocho habilidades</h3>' +
      '<p>Cada acción indicada suma un punto de habilidad la primera vez que la completas en cada etapa, reto o aventura.</p>' +
      '<ul class="pn-career-grid">' + cards.join('') + '</ul><a class="button" href="#perfil?seccion=logros">Ver mis logros y reliquias</a></section>';
  }

  if (root.customElements && !root.customElements.get('play-notice-preferences')) {
    root.customElements.define('play-notice-preferences', class extends HTMLElement {
      async connectedCallback() {
        const bridge=root.GameAccountBridge, token=this.token=Symbol();
        const current=()=>this.isConnected && this.token===token && bridge.isSignedIn();
        const api='/api/me/play-notices';
        this.innerHTML='<section class="account-card"><h2>Avisos por correo</h2><p role="status">Cargando tus preferencias…</p></section>';
        const status=this.querySelector('[role=status]');
        try {
          const {preferences}=await bridge.request(api);
          if(!current())return;
          const options={milestones:'Mis aventuras terminadas y las reliquias de mis tableros',
            pairs:'Confirmación cuando los dos elegimos jugar en pareja',
            challenges:'Nuevos desafíos publicados, incluidos los de casos que aún no he abierto',
            reminders:'Un recordatorio tras 14 días sin visitar mi cuenta ni avanzar en mi partida'};
          const form=document.createElement('form');
          form.innerHTML='<fieldset><legend>Qué quiero recibir en mi correo verificado</legend>'+
            Object.entries(options).map(([key,label])=>'<label style="display:block;margin:.7rem 0"><input type="checkbox" name="'+key+'"'+
            (preferences[key]?' checked':'')+'> '+label+'</label>').join('')+
            '</fieldset><button type="submit" class="button">Guardar mis avisos</button>';
          status.textContent='';
          status.before(form);
          form.onsubmit=async event=>{
            event.preventDefault();
            const selected=Object.fromEntries(Object.keys(options).map(key=>[key,form.elements[key].checked]));
            const button=form.querySelector('button'), fieldset=form.querySelector('fieldset');
            button.disabled=fieldset.disabled=true;
            try{
              await bridge.request(api,selected,'PUT');
              if(current())status.textContent='Preferencias guardadas.';
            }catch{
              if(current())status.textContent='No se han guardado los cambios. Vuelve a intentarlo.';
            }finally{ if(current())button.disabled=fieldset.disabled=false; }
          };
        }catch{
          if(!current())return;
          status.textContent='No se han podido leer tus preferencias. ';
          const retry=document.createElement('button');
          retry.textContent='Volver a intentar';retry.className='button';
          retry.onclick=()=>this.connectedCallback();
          status.append(retry);
        }
      }
      disconnectedCallback(){this.token=null;}
    });
  }

  function archiveFindings(entries) {
    const cases = [];
    for (const {caseId, titles} of entries || []) {
      if (!Number.isInteger(caseId) || caseId < 1 || caseId > 48 || !titles?.length) continue;
      const firstBoard = caseId <= 12;
      const story = firstBoard ? root.ValdemarCatalog?.get(caseId) : root.Mundos?.story(caseId);
      const caseTitle = story?.title || 'Caso ' + caseId;
      const route = (firstBoard ? 'valdemar-jugar' : 'mundos-jugar') + '?id=' + caseId;
      cases.push('<li><h3>' + escape(caseTitle) + '</h3><ul>' +
        titles.map(title => '<li>' + escape(title) + '</li>').join('') + '</ul>' +
        link(route, 'Abrir expediente', false, caseTitle) + '</li>');
    }
    return '<section class="pn-career"><h2>Archivo secreto</h2>' + (cases.length
      ? '<p>Hallazgos que has conseguido en tus investigaciones.</p><ul class="pn-career-grid">' + cases.join('') + '</ul>'
      : '<p>Aquí aparecerán los documentos que recuperes con un instrumento, las fichas de misión y las pistas que abras en tus casos disponibles.</p>' +
        link('casos', 'Explorar los tableros', false)) + '</section>';
  }

  if (root.customElements && !root.customElements.get('profile-collection')) {
    root.customElements.define('profile-collection', class extends HTMLElement {
      async connectedCallback() {
        const bridge = root.GameAccountBridge;
        const token = this.readToken = Symbol();
        const keys = this.hasAttribute('data-keys');
        const archive = this.hasAttribute('data-archive');
        this.textContent = archive ? 'Cargando mi archivo secreto.' : keys ? 'Cargando mi llavero.' : 'Cargando mis logros.';
        try {
          const result = await bridge.request(keys ? '/api/valdemar/seasons' : '/api/valdemar/partidas');
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn()) return;
          if (archive) {
            this.innerHTML = archiveFindings(result.archive);
          } else if (keys) {
            this.innerHTML = '<section class="pn-career"><h2>Mi llavero</h2><p><strong>' +
              escape(result.wallet.balance) + (result.wallet.balance === 1 ? ' llave disponible' : ' llaves disponibles') +
              '</strong></p></section>';
            this.querySelector('section').append(root.Keyring.history(result.wallet));
          } else {
            this.innerHTML = careerPanel(result.career, true);
          }
        } catch {
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn()) return;
          this.textContent = archive ? 'No se ha podido cargar tu archivo secreto. ' : keys ? 'No se ha podido cargar tu llavero. ' : 'No se han podido cargar tus logros. ';
          const retry = document.createElement('button');
          retry.className = 'button';
          retry.textContent = 'Volver a intentar';
          retry.onclick = () => this.connectedCallback();
          this.append(retry);
        }
      }
      disconnectedCallback() { this.readToken = null; }
    });
  }

  if (root.customElements && !root.customElements.get('notebook-return')) {
    root.customElements.define('notebook-return', class extends HTMLElement {
      async connectedCallback() {
        const bridge = root.GameAccountBridge;
        if (!bridge?.isSignedIn()) return;
        const token = this.readToken = Symbol();
        try {
          const {games,career} = await bridge.request('/api/valdemar/partidas');
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn() || !Array.isArray(games)) return;
          const tally = this.closest('.pn-dashboard')?.querySelector('[data-notebook-ongoing]');
          const character = this.closest('.pn-dashboard')?.querySelector('[data-player-career]');
          if (character && career) character.innerHTML = careerPanel(career);
          if (tally) {
            tally.querySelector('strong').textContent = Number(this.dataset.classicOngoing) + games.filter(game => !game.finished).length;
            tally.querySelector('span').textContent = 'Partidas en curso';
          }
          const latest = root.ExperienceUI.seasonReturn(games);
          let card;
          if (latest && latest.time >= Number(this.dataset.classicTime)) {
            const action = link(latest.href.slice(1), 'Continuar mi partida', true, latest.title);
            card = featureCard(latest.image, 'Tu partida en curso', latest.title, latest.detail, action);
          } else if (games.length && this.hasAttribute('data-without-classic')) {
            card = featureCard(notebookCover, 'Mis partidas', 'Tus investigaciones guardadas',
              'Consulta los casos que has empezado y los desenlaces que has guardado.', link('archivo', 'Ver mis partidas'));
          }
          if (card) {
            const focused = this.contains(document.activeElement);
            this.innerHTML = card;
            if (focused) this.querySelector('.button')?.focus({preventScroll: true});
          }
        } catch {
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn()) return;
          const character = this.closest('.pn-dashboard')?.querySelector('[data-player-career]');
          if (character) {
            character.textContent = 'No se ha podido cargar la experiencia de tu personaje. ';
            const retry = document.createElement('button');
            retry.className = 'button';
            retry.textContent = 'Volver a intentar';
            retry.onclick = () => this.connectedCallback();
            character.append(retry);
          }
        }
      }
      disconnectedCallback() { this.readToken = null; }
    });
  }

  function progress(input = {}) {
    const {activeSessionId, pieces, totals, canPlay = false, userId, online = false} = input;
    const model = notebookModel(input);
    const {catalog, owned, mayOpen, details} = model;
    const ongoing = owned.filter(session => !finished(session));
    const complete = owned.filter(finished);
    const playable = owned.filter(mayOpen);
    const candidates = playable.length ? playable : owned;
    const showSeasons = online && userId && root.customElements?.get('notebook-return') && root.ExperienceUI?.seasonReturn;
    const recent = showSeasons ? playable.filter(session => !finished(session) && session.caseId !== 'habitacion-309')
      .sort((a, b) => root.ExperienceUI.classicActivity(b) - root.ExperienceUI.classicActivity(a))[0] : null;
    const current = recent || candidates.find(session => !finished(session) && session.id === activeSessionId) ||
      candidates.find(session => !finished(session)) || candidates.find(session => session.id === activeSessionId) || candidates[0];
    const seasonCases = complete.filter(session => catalog.get(session.caseId)?.season === 1);
    const resolved = new Set(seasonCases.filter(session => hasResolution(session, catalog.get(session.caseId))).map(session => session.caseId));
    const partial = !Number.isFinite(pieces) && seasonCases.some(session => !resolved.has(session.caseId));
    const count = Math.min(12, Math.max(0, Number.isFinite(pieces) ? Math.trunc(pieces) : resolved.size));
    const decisions = Number.isFinite(totals?.decisions) ? Math.max(0, Math.trunc(totals.decisions)) : '—';
    const summary = '<div class="notebook-numbers pn-summary" role="group" aria-label="Resumen de mi progreso"><div><strong>' +
      decisions + '</strong><span>Decisiones del archivo clásico</span></div><div data-notebook-ongoing><strong>' + ongoing.length +
      '</strong><span>Partidas clásicas en curso</span></div><div><strong>' + (partial && !count ? '-' : count) +
      '</strong><span>Piezas del plano clásico</span></div></div>';
    const others = showSeasons ? owned : owned.filter(session => session.id !== current?.id);
    const otherRows = others.length ? group(others.filter(session => !finished(session)), 'En curso', model, true) +
      group(others.filter(finished), 'Terminadas', model, !others.some(session => !finished(session))) :
      '<p class="pn-empty">' + (showSeasons ? 'Aún no tienes partidas del archivo clásico.' :
        current ? 'Tus demás investigaciones aparecerán aquí.' : 'Aquí encontrarás las partidas que empieces y los casos que termines.') + '</p>';
    const first = featured(current, catalog, canPlay, mayOpen, userId, online, count, details.get(current?.id));
    const opening = showSeasons ? '<notebook-return data-classic-time="' + root.ExperienceUI.classicActivity(recent) +
      '" data-classic-ongoing="' + ongoing.length + '"' + (owned.length ? '' : ' data-without-classic') + '>' + first + '</notebook-return>' : first;
    return '<div class="pn-dashboard">' +
      opening + (showSeasons ? '<div data-player-career>Cargando mi personaje…</div>' : '') +
      summary + seasonProgress(count, partial) +
      '<section class="pn-archive" aria-labelledby="pn-archive-title"><div class="pn-section-heading"><h2 id="pn-archive-title">' +
      (showSeasons ? 'Mis partidas del archivo clásico' : current ? 'Mis otras partidas' : 'Mis partidas') + '</h2><a class="text-link" href="#archivo">Ver mi archivo</a></div>' + otherRows + '</section></div>';
  }

  root.PlayerNotebook = {...root.PlayerNotebook, progress, archive};
})(window);
