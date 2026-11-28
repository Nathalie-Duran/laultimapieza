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

  function adventure(id, game) {
    const info=id<=12?root.ValdemarCatalog?.get(id):root.Mundos?.story(id);
    if(!info)return null;
    return {id,title:game?.title||info.title,question:game?.checkpoint?.task||info.question,
      image:game?.edition==='legacy'?'/valdemar-art-01.webp':id<=12?info.image:'/mundo-'+id+'.webp',
      route:(id<=12?'valdemar-jugar':'mundos-jugar')+'?id='+id};
  }

  function nextAdventure(games,access,after) {
    if(!Array.isArray(access?.availableCases))return null;
    const earned=new Set(access.completed||[]);
    const open=access.availableCases.filter(id=>Number.isInteger(id)&&id>=1&&id<=48&&!earned.has(id));
    const ongoing=[...games].filter(g=>g.id!==after&&g.available&&!g.finished&&access.availableCases.includes(g.id))
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id);
    if(ongoing.length)return adventure(ongoing[0].id,ongoing[0]);
    const candidates=open.filter(id=>id!==after).sort((a,b)=>a-b);
    const next=(after && candidates.find(id=>id>after && Math.ceil(id/12)===Math.ceil(after/12)))||candidates[0];
    return next?adventure(next):null;
  }

  async function pairedGames(games,bridge) {
    if(!games.some(g=>g.mode==='duo'))return games;
    let records;
    try{records=(await bridge.request('/api/partners')).invitations;}catch{return games;}
    const confirmed=new Map((records||[]).filter(p=>p.status==='accepted').map(p=>[p.caseId,p]));
    return games.map(game=>{
      const pair=game.mode==='duo'&&confirmed.get(game.id);
      return pair?{...game,partnerName:pair.partnerName,role:pair.direction==='sent'?'A':'B'}:game;
    });
  }

  function teamLabel(game) {
    if(!game)return '';
    if(game.mode==='solo')return 'En solitario · ambos papeles';
    if(game.mode!=='duo')return '';
    return [game.partnerName?'Con '+game.partnerName:'En pareja',game.role?'Tu papel '+game.role:''].filter(Boolean).join(' · ');
  }

  function collectionPanel(pieces) {
    const seasons=root.Colecciones?.seasons||[];
    return '<section class="pn-career pn-collection"><h2>Mis reliquias</h2><p>Recupera las doce piezas de cada tablero para abrir su epílogo.</p><ul class="pn-relics">'+pieces.map((count,i)=>{
      const s=seasons[i];if(!s)return '';
      return '<li><a href="#'+escape(s.board)+'?seccion=sello">'+(s.art?'<img src="/'+escape(s.art)+'" alt="" loading="lazy">':'')+
        '<div><small>'+escape(s.name)+'</small><strong>'+escape(s.seal)+'</strong><span>'+(count===12?'Reliquia conseguida · ':'')+
        count+' de 12 piezas</span><progress class="pn-meter" max="12" value="'+count+'" aria-label="Piezas de '+escape(s.seal)+'"></progress></div></a></li>';
    }).join('')+'</ul></section>';
  }

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
      return '<section class="pn-career"><h2>Mis logros</h2><ul class="pn-career-grid">' +
        cards.join('') + '</ul></section>'+collectionPanel(pieces);
    }
    const cards = skills.map(skill => '<li><strong>' + escape(skill.name) + '</strong><span>' + skill.points +
      (skill.points === 1 ? ' punto' : ' puntos') + '</span><small>' + escape(skill.criterion) + '</small></li>');
    const lines = rewards.map(item => '<li><span>' + escape(item.name) + '</span><strong>' +
      item.count + ' × ' + item.unit + ' XP</strong></li>');
    return '<section class="pn-career pn-character"><div class="pn-section-heading"><h2>Mi trayectoria</h2><span class="pn-count">Nivel ' +
      level + '</span></div><p><strong>' + xp + ' XP</strong> · ' + (nextLevelXp - xp) + ' XP para el nivel ' +
      (level + 1) + '</p><progress class="pn-meter" max="500" value="' + (xp % 500) +
      '" aria-label="Avance dentro del nivel ' + level + '"></progress><details><summary>Cómo he ganado experiencia</summary>' +
      '<ul class="pn-xp-list">' + lines.join('') + '</ul></details><h3>Mis ocho habilidades</h3>' +
      '<p>Estas habilidades recogen las acciones y recompensas que ya has conseguido.</p>' +
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

  function caseRecap(id,report,games) {
    const game=games.find(item=>item.id===id && item.finished);
    const result=report.career?.caseResults?.[id];
    if(!game || !result)return '';
    const seasonIndex=Math.floor((id-1)/12), season=root.Colecciones?.seasons?.[seasonIndex];
    if(!season)return '';
    const pieces=report.career.pieces[seasonIndex], title=adventure(id,game)?.title || game.title || 'Caso '+id;
    const skills=result.skills.map(s=>'<li><span>'+escape(s.name)+'</span> <strong>+'+s.points+'</strong></li>').join('');
    const next=nextAdventure(games,report.access,id),team=teamLabel(game);
    const metric=(value,label)=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>';
    const keys=Number.isInteger(result.earnedKeys)?metric(result.earnedKeys,'Llaves ganadas en este caso'):'';
    return '<section class="pn-recap" aria-label="Resumen de la aventura"><p class="pn-kicker">'+escape(season.name)+'</p>'+
      '<h2>Aventura completada</h2><p>'+escape(title)+'</p>'+(team?'<p>Modalidad guardada · '+escape(team)+'</p>':'')+
      '<dl class="pn-recap-numbers">'+metric(result.xp+' XP','Experiencia de este caso')+metric(pieces+' de 12','Piezas del tablero')+keys+'</dl>'+
      '<p>El desenlace aporta '+result.completionXp+' XP y una pieza de '+escape(season.seal)+'.</p>'+
      (skills?'<details><summary>Habilidades ganadas en esta aventura</summary><ul class="pn-skill-gains">'+skills+'</ul></details>':'')+
      '<div class="pn-actions">'+(next?link(next.route,'Continuar con '+next.title):'')+
      link(season.board+'?seccion=sello',pieces===12?'Abrir el sello completo':'Ver mi sello',!next)+
      link('perfil?seccion=trayectoria','Ver mi trayectoria',false)+'</div></section>';
  }

  if(root.customElements && !root.customElements.get('aventura-resumen')){
    root.customElements.define('aventura-resumen',class extends HTMLElement{
      async connectedCallback(){
        const bridge=root.GameAccountBridge,id=Number(this.dataset.case),token=this.token=Symbol();
        if(!bridge?.isSignedIn()||!Number.isInteger(id)||id<1||id>48)return;
        const current=()=>this.isConnected&&this.token===token&&bridge.isSignedIn();
        try{
          const data=await bridge.request('/api/valdemar/partidas');
          if(!current())return;
          const games=await pairedGames(data.games,bridge);
          if(current())this.innerHTML=caseRecap(id,data,games);
        }catch{
          if(current())this.innerHTML='<p class="pn-empty">Puedes consultar el resumen desde '+link('archivo','Mis partidas',false)+'.</p>';
        }
      }
      disconnectedCallback(){this.token=null;}
    });
  }

  function keyChallenge(result) {
    const id=result.availableCases?.find(id=>id>1&&!result.wallet.won?.includes(id));
    const next=id&&adventure(id);
    if(!next)return '';
    const prize=(id-1)%12>=8?2:1;
    return '<div class="pn-key-challenge"><h3>Ganar más llaves</h3><p>'+escape(next.title)+' · Reto paralelo · '+
      prize+(prize===1?' llave':' llaves')+'</p>'+link(next.route+'&seccion=reto','Abrir el reto')+'</div>';
  }

  if (root.customElements && !root.customElements.get('profile-collection')) {
    root.customElements.define('profile-collection', class extends HTMLElement {
      async connectedCallback() {
        const bridge = root.GameAccountBridge;
        const token = this.readToken = Symbol();
        if(!bridge?.isSignedIn())return;
        const keys = this.hasAttribute('data-keys');
        const archive = this.hasAttribute('data-archive');
        const trajectory=this.hasAttribute('data-career'), collection=this.hasAttribute('data-collection');
        this.textContent = archive ? 'Cargando mi archivo secreto.' : keys ? 'Cargando mi llavero.' : 'Cargando mis logros.';
        try {
          const result = await bridge.request(keys ? '/api/valdemar/seasons' : '/api/valdemar/partidas');
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn()) return;
          if (archive) {
            this.innerHTML = archiveFindings(result.archive);
          } else if(trajectory) {
            this.innerHTML=careerPanel(result.career);
          } else if(collection) {
            this.innerHTML=collectionPanel(result.career.pieces);
          } else if (keys) {
            this.innerHTML = '<section class="pn-career"><h2>Mi llavero</h2><p><strong>' +
              escape(result.wallet.balance) + (result.wallet.balance === 1 ? ' llave disponible' : ' llaves disponibles') +
              '</strong></p>'+keyChallenge(result)+'</section>';
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
          const data = await bridge.request('/api/valdemar/partidas');
          if (!this.isConnected || this.readToken !== token || !bridge.isSignedIn() || !Array.isArray(data.games)) return;
          const games=await pairedGames(data.games,bridge),{career,access}=data;
          if(!this.isConnected || this.readToken!==token || !bridge.isSignedIn())return;
          const tally = this.closest('.pn-dashboard')?.querySelector('[data-notebook-ongoing]');
          const character = this.closest('.pn-dashboard')?.querySelector('[data-player-career]');
          if (character && career) character.innerHTML = '<div class="pn-overview">'+
            '<section><p class="pn-kicker">Mi personaje</p><h2>Nivel '+career.level+'</h2><strong>'+career.xp+' XP</strong>'+
            '<progress class="pn-meter" max="500" value="'+(career.xp%500)+'" aria-label="Avance de nivel"></progress>'+
            '<p>'+Math.max(0,career.nextLevelXp-career.xp)+' XP hasta el nivel '+(career.level+1)+'</p>'+link('perfil?seccion=trayectoria','Ver mis ocho habilidades',false)+'</section>'+
            '<section><p class="pn-kicker">Mi colección</p><h2>'+career.pieces.reduce((sum,n)=>sum+n,0)+' de 48 piezas</h2>'+
            '<p>'+career.pieces.filter(n=>n===12).length+' de 4 reliquias completas</p>'+link('perfil?seccion=coleccion','Abrir mi colección',false)+'</section></div>'+collectionPanel(career.pieces);
          if (tally) {
            tally.querySelector('strong').textContent = Number(this.dataset.classicOngoing) + games.filter(game => !game.finished).length;
            tally.querySelector('span').textContent = 'Partidas en curso';
          }
          const latest = root.ExperienceUI.seasonReturn(games);
          let card;
          if (latest && latest.time >= Number(this.dataset.classicTime)) {
            const game=games.find(g=>g.available&&!g.finished&&(latest.href||'').includes('?id='+g.id+'&'));
            const objective=[game?.checkpoint?.task,teamLabel(game)].filter(Boolean).join(' · ');
            const action = link(latest.href.slice(1), 'Continuar mi partida', true, latest.title);
            card = featureCard(latest.image, latest.detail, latest.title, objective||'Retoma tu etapa guardada.', action);
          } else if (this.hasAttribute('data-without-classic')) {
            const next=nextAdventure(games,access);
            if(next)card=featureCard(next.image,'Siguiente aventura disponible',next.title,next.question,link(next.route,'Abrir la aventura'));
            else if(games.length)card = featureCard(notebookCover, 'Mis partidas', 'Tus investigaciones guardadas',
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

  root.PlayerNotebook = {...root.PlayerNotebook, progress, archive, pairedGames,teamLabel,nextAdventure,caseRecap};
})(window);
