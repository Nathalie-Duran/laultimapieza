(function (root) {
  'use strict';

  const marta = {
    id: 'marta', title: 'La llegada',
    gateSelector: '#expediente', doorSelector: '#puerta',
    documents: [
      { file: '00_email_apertura.html', label: 'Correo de apertura', type: 'email' },
      { file: '01_ficha_admision.png', label: 'Ficha de admisión', type: 'image' },
      { file: '02_plano_pabellon.png', label: 'Plano del pabellón', type: 'image' },
      { file: '03_registro_rondas.png', label: 'Registro de rondas', type: 'image' },
      { file: '04_carta_vallejo.png', label: 'Carta de Vallejo', type: 'image' },
      { file: '05_tabla_vigenere.png', label: 'Tabla de Vigenère', type: 'image' },
      { file: '06_expediente_marta.html', label: 'Abrir el expediente 0147', type: 'gate' }
    ]
  };
  const typeNames = { email: 'Correo', image: 'Documento', gate: 'Expediente', audio: 'Audio' };
  const dialog = () => document.getElementById('scene-preview');
  let state = null;
  let consent = false;
  function sessions() {
    const first = Object.assign({}, marta, root.VallejoMarta);
    const second = root.VallejoTomas;
    if (!second || !Array.isArray(second.documents) || !second.documents.length) return [first];
    if (!second.documents.every(d => Object.hasOwn(typeNames, d.type) && /^[a-zA-Z0-9_.-]+$/.test(d.file))) return [first];
    return [first, Object.assign({}, second, { title: 'Marta' })];
  }
  function node(name, className, content) {
    const el = document.createElement(name);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function button(text, className, action) {
    const el = node('button', className, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function count(event, action = event) {
    if (!state || !consent || state.counted.has(action)) return;
    state.counted.add(action);
    root.fetch('/api/metrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, consent: true }), keepalive: true
    }).catch(() => {});
    if (event === 'demo_start') root.InvitationCounts?.start();
  }
  function ensureStyles() {
    if (document.querySelector('link[data-vallejo-style],link[href*="vallejo-demo.css"]')) return;
    const link = node('link');
    link.rel = 'stylesheet';
    link.href = '/vallejo-demo.css?v=fin-87v-2';
    link.dataset.vallejoStyle = '1';
    document.head.append(link);
  }
  function shelf(expanded, focusFirst = false) {
    if (!state) return;
    const { shell, shelfToggle, side } = state;
    shell.classList.toggle('vp-shelf-open', expanded);
    shelfToggle.setAttribute('aria-expanded', String(expanded));
    if (expanded && focusFirst) side.querySelector('[aria-current="page"]')?.focus();
  }
  function note(message) {
    if (state) state.status.textContent = message;
  }
  function seasonLink(route, label, primary) {
    const onHome = root.location.pathname === '/';
    const link = node('a', 'vp-season-link' + (primary ? ' vp-season-primary' : ''), label);
    link.href = (onHome ? '' : '/') + '#' + route;
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.altKey) return;
      if (route === 'planes') count('plans_view');
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      close();
      if (!onHome || root.location.hash !== '#' + route) {
        root.location.assign(link.href);
      } else {
        document.getElementById('main')?.focus({ preventScroll: true });
        root.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
    return link;
  }
  function hintFor(st) {
    const session = st.sessions[st.section];
    const file = session.documents[st.index].file;
    const group = session.hintGroup?.[file] || session.hintAliases?.[file] || file;
    const hints = session.hints?.[group];
    if (!Array.isArray(hints) || !hints.length) return null;
    const key = session.id + '/' + group;
    if (!st.hintHistory.has(key)) st.hintHistory.set(key, { seen: 0, nextAt: 0 });
    return { session, group, key, hints, entry: st.hintHistory.get(key) };
  }
  function renderHints(st) {
    root.clearTimeout(st.hintTimer);
    const h = hintFor(st);
    if (h?.key !== st.hintKey) st.hintBox.open = false;
    st.hintBox.hidden = !h;
    st.hintKey = h?.key;
    st.hintList.replaceChildren();
    if (!h) return;
    const labels = ['Orientación', 'Dirección', 'Método', 'Casi solución'];
    h.hints.slice(0, h.entry.seen).forEach((hint, i) => {
      const li = node('li');
      li.append(node('strong', '', labels[i] + '. '), document.createTextNode(hint));
      st.hintList.append(li);
    });
    st.hintTable.hidden = !(h.group === '04_carta_vallejo.png' && h.entry.seen >= 4);
    const done = h.entry.seen >= h.hints.length;
    const wait = Math.max(0, h.entry.nextAt - Date.now());
    st.hintMore.hidden = done;
    st.hintMore.disabled = !!wait;
    st.hintMore.textContent = h.entry.seen ? 'Revelar otra pista' : 'Revelar la primera pista';
    let message = 'Las pistas se abren de una en una.';
    if (done) message = 'Has consultado todas las pistas de esta prueba.';
    else if (wait) message = 'La siguiente pista estará disponible en ' + Math.ceil(wait / 60000) + ' min.';
    st.hintStatus.textContent = message;
    if (!done && wait && !st.paused && st.hintBox.open) st.hintTimer = root.setTimeout(() => renderHints(st), Math.min(wait, 60000));
  }
  function revealHint(st) {
    const h = hintFor(st);
    if (!h || h.entry.seen >= h.hints.length || h.entry.nextAt > Date.now()) return;
    h.entry.seen++;
    h.entry.nextAt = Date.now() + Math.max(0, Number(h.session.hintWaitMinutes) || 0) * 60000;
    count('demo_hint', h.key + '/' + h.entry.seen);
    renderHints(st);
    note('Pista ' + h.entry.seen + '. ' + h.hints[h.entry.seen - 1]);
  }
  function updateNav() {
    const st = state;
    if (!st) return;
    const current = st.sessions[st.section], doc = current.documents[st.index];
    st.shelfToggle.textContent = 'Documentos (' + (st.index + 1) + '/' + current.documents.length + ')';
    st.sessionCaption.textContent = 'Caja 87-V · Sesión ' + (st.section + 1) + ' · ' + current.title;
    st.heading.textContent = doc.label;
    st.previous.disabled = st.index === 0;
    st.next.hidden = st.index === current.documents.length - 1;
    const openedGate = doc.type === 'gate' && st.unlocked.has(current.id);
    st.nextSession.hidden = !(openedGate && st.section === 0);
    st.offer.hidden = !(openedGate && st.section === 1);
    st.zoom.hidden = doc.type !== 'image';
    const selected = st.panes.get(doc.file);
    st.separate.hidden = doc.type !== 'image';
    st.separate.href = '/' + doc.file;
    st.adjust.hidden = doc.file !== '01_ficha_admision.png';
    st.adjust.setAttribute('aria-pressed', String(!!selected?.classList.contains('vp-inverted')));
    st.bright.hidden = st.adjust.hidden;
    st.bright.setAttribute('aria-pressed', String(!!selected?.classList.contains('vp-bright')));
    st.mirror.hidden = doc.file !== '04_hoja_suelta.png';
    st.mirror.setAttribute('aria-pressed', String(!!selected?.classList.contains('vp-mirrored')));
    const pair = {
      '02_plano_pabellon.png': ['En pareja, uno consulta el plano y el otro las rondas. Si juegas a solas, puedes abrir el registro en otra pestaña.', '03_registro_rondas.png', 'Abrir registro de rondas'],
      '03_registro_rondas.png': ['En pareja, uno consulta el registro y el otro el plano. Si juegas a solas, puedes abrir el plano en otra pestaña.', '02_plano_pabellon.png', 'Abrir plano'],
      '02_grabacion_sesion1.wav': ['En pareja, uno escucha y cuenta los golpes en voz alta. El otro consulta el armario en su pantalla. Si juegas a solas, puedes abrir el armario en otra pestaña.', '03_armario_medicacion.png', 'Abrir armario'],
      '03_armario_medicacion.png': ['En pareja, uno consulta el armario y el otro escucha la cinta en su pantalla. Si juegas a solas, puedes abrir la grabación en otra pestaña.', '02_grabacion_sesion1.wav', 'Abrir grabación']
    }[doc.file];
    st.pairInfo.hidden = !pair;
    if (pair) {
      st.pairText.textContent = pair[0];
      st.pairLink.href = '/' + pair[1];
      st.pairLink.textContent = pair[2] + ' en otra pestaña';
    }
    const zoomed = !!selected?.classList.contains('vp-zoomed');
    st.zoom.textContent = zoomed ? 'Ajustar imagen' : 'Ampliar imagen';
    st.zoom.setAttribute('aria-pressed', String(zoomed));
    st.sideList.replaceChildren();
    current.documents.forEach((item, index) => {
      const li = node('li');
      const control = button('', 'vp-doc-button', () => select(st.section, index));
      if (st.index === index) control.setAttribute('aria-current', 'page');
      const number = node('span', 'vp-doc-number', String(index + 1).padStart(2, '0'));
      number.setAttribute('aria-hidden', 'true');
      control.append(number, node('span', '', item.label));
      li.append(control);
      st.sideList.append(li);
    });
    st.sessionList.replaceChildren();
    if (st.sessions.length > 1 && st.unlocked.has(st.sessions[0].id)) {
      st.sessions.forEach((s, i) => {
        const tab = button((i + 1) + ' · ' + s.title, 'vp-session-choice', () => select(i, st.lastIndex[i] || 0));
        tab.setAttribute('aria-pressed', String(st.section === i));
        st.sessionList.append(tab);
      });
    }
    renderHints(st);
  }
  function unlock(st, section) {
    if (state !== st) return;
    const session = st.sessions[section];
    if (st.unlocked.has(session.id)) return;
    st.unlocked.add(session.id);
    if (section === 0) count('demo_solved');
    if (section === 1) count('demo_complete');
    updateNav();
    note(section === 0 ? 'Expediente abierto. Ya puedes continuar a la siguiente sesión.' : 'Expediente abierto. Has llegado al final de la demo.');
  }
  function continueSession(st) {
    if (!st.unlocked.has(st.sessions[0].id)) return;
    st.sessions = sessions();
    if (st.sessions.length > 1) { select(1, 0); return; }
    if (st.loadingSecond) return;
    st.loadingSecond = true;
    st.nextSession.disabled = true;
    st.nextSession.textContent = 'Cargando la sesión…';
    const script = node('script');
    script.src = '/vallejo-tomas.js?v=archivo-87v-1';
    const finish = () => {
      script.remove();
      if (state !== st) return;
      st.loadingSecond = false;
      st.nextSession.disabled = false;
      st.sessions = sessions();
      if (st.sessions.length > 1) {
        st.nextSession.textContent = 'Abrir la siguiente sesión';
        select(1, 0);
      } else {
        st.nextSession.textContent = 'Reintentar la segunda sesión';
        note('No se ha podido cargar la segunda sesión. Puedes reintentarlo.');
      }
    };
    script.onload = script.onerror = finish;
    document.head.append(script);
  }
  function errorMessage(pane, retry) {
    const box = node('div', 'vp-error');
    box.setAttribute('role', 'status');
    box.append(node('p', '', 'No se ha podido abrir este documento.'), button('Reintentar', 'vp-button', retry));
    pane.replaceChildren(box);
  }
  function frame(st, section, doc, pane) {
    const session = st.sessions[section];
    const iframe = node('iframe', 'vp-frame');
    iframe.title = doc.label + ' · documento original';
    iframe.src = '/' + doc.file;
    // Only the bundled originals from this origin are embedded; their own script opens each gate.
    iframe.addEventListener('load', () => {
      if (state !== st) return;
      let original;
      try { original = iframe.contentDocument; } catch { return; }
      if (!original || !original.body) return;
      const door = doc.type === 'gate' ? original.querySelector(session.doorSelector || '#puerta') : null;
      const record = doc.type === 'gate' ? original.querySelector(session.gateSelector || '#expediente') : null;
      // Ignore a pending initial about:blank navigation.
      if (original.URL === 'about:blank') return;
      if ((doc.type === 'gate' && (!door || !record)) || (doc.type === 'email' && !original.querySelector('a[href]'))) {
        errorMessage(pane, () => { pane.replaceChildren(); frame(st, section, doc, pane); });
        return;
      }
      const responsive = original.createElement('style');
      responsive.textContent = '@media(max-width:540px){body{padding:8px}main{padding:20px 14px}.correo{border-left-width:5px}.correo header,.correo article,.correo .pie{padding-left:14px;padding-right:14px}.adjunto,.adjuntos{margin-left:14px;margin-right:14px;overflow-wrap:anywhere}main,dd{min-width:0;overflow-wrap:anywhere}}';
      original.head.append(responsive);
      original.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(st, event); });
      original.addEventListener('click', event => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const url = new URL(anchor.href, original.baseURI);
        if (url.origin !== root.location.origin) return;
        for (let i = 0; i < st.sessions.length; i++) {
          const index = st.sessions[i].documents.findIndex(item => '/' + item.file === url.pathname);
          if (index < 0) continue;
          event.preventDefault();
          if (!i || st.unlocked.has(st.sessions[i - 1].id)) select(i, index);
          return;
        }
      });
      if (door && record) {
        const update = () => {
          if (door.classList.contains('hidden') && !record.classList.contains('hidden') && iframe.contentWindow.getComputedStyle(record).display !== 'none') unlock(st, section);
        };
        const observer = new MutationObserver(update);
        observer.observe(door, { attributes: true, attributeFilter: ['class'] });
        observer.observe(record, { attributes: true, attributeFilter: ['class'] });
        st.observers.push(observer);
        update();
      }
    });
    iframe.addEventListener('error', () => errorMessage(pane, () => { pane.replaceChildren(); frame(st, section, doc, pane); }), { once: true });
    pane.append(iframe);
  }
  function loadDocument(st, section, doc) {
    if (st.panes.has(doc.file)) return st.panes.get(doc.file);
    const pane = node('div', 'vp-pane vp-' + doc.type);
    pane.setAttribute('role', 'region');
    pane.setAttribute('aria-label', doc.label);
    pane.hidden = true;
    st.reader.append(pane);
    st.panes.set(doc.file, pane);
    if (doc.type === 'image') {
      const img = node('img', 'vp-original-image');
      img.alt = doc.label + ' · facsímil original';
      img.decoding = 'async';
      const viewport = node('div', 'vp-image-scroll');
      viewport.tabIndex = 0;
      viewport.setAttribute('aria-label', 'Imagen. Usa las flechas para recorrerla al ampliar.');
      const showImage = () => {
        img.addEventListener('error', () => errorMessage(pane, () => { pane.replaceChildren(viewport); showImage(); }), { once: true });
        img.src = '/' + doc.file;
      };
      viewport.append(img);
      pane.append(viewport);
      showImage();
    } else if (doc.type === 'audio') {
      const card = node('div', 'vp-audio-card');
      const audio = node('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = '/' + doc.file;
      audio.setAttribute('aria-label', doc.label);
      const original = node('a', 'vp-open-original', 'Abrir el audio original');
      original.href = '/' + doc.file;
      original.target = '_blank';
      original.rel = 'noopener';
      card.append(node('p', 'vp-eyebrow', 'Archivo sonoro'), node('h3', '', doc.label), audio, original);
      pane.append(card);
    } else frame(st, section, doc, pane);
    return pane;
  }
  function select(section, index, focus = true) {
    const st = state;
    if (!st || (section > 0 && !st.unlocked.has(st.sessions[section - 1]?.id))) return;
    const doc = st.sessions[section]?.documents[index];
    if (!doc) return;
    for (const [file, pane] of st.panes) {
      if (file !== doc.file) {
        pane.hidden = true;
        pane.querySelector('audio')?.pause();
      }
    }
    st.section = section;
    st.index = index;
    st.pairInfo.open = false;
    st.lastIndex[section] = index;
    const current = loadDocument(st, section, doc);
    current.hidden = false;
    shelf(false);
    updateNav();
    if (focus) st.heading.focus({ preventScroll: true });
  }
  function setupDOM(host, st) {
    host.innerHTML = `<div class="vp-shell">
      <header class="vp-header"><div><p class="vp-eyebrow" data-vp-caption></p><h2 id="scene-title">Clínica Vallejo</h2></div><button type="button" class="vp-close" data-action="scene-close" aria-label="Cerrar la demo">Cerrar</button></header>
      <div class="vp-work"><aside class="vp-side" id="vp-documentos" aria-label="Documentos del expediente"><div class="vp-side-head"><h3>Documentos</h3><button type="button" class="vp-side-close" aria-label="Cerrar la lista de documentos">Cerrar</button></div><div class="vp-sessions"></div><ol class="vp-doc-list"></ol></aside>
      <section class="vp-desk" aria-label="Lector de documentos"><div class="vp-document-head"><button type="button" class="vp-shelf-toggle" aria-controls="vp-documentos" aria-expanded="false">Documentos</button><h3 class="vp-doc-title" tabindex="-1"></h3><button type="button" class="vp-zoom" hidden>Ampliar imagen</button><button type="button" class="vp-adjust" hidden>Invertir</button><button type="button" class="vp-brighten" hidden>Subir brillo</button><button type="button" class="vp-mirror" hidden>Espejo</button><a class="vp-open-original vp-separate" target="_blank" rel="noopener" hidden>Abrir aparte</a></div><div class="vp-reader"></div>
      <div class="vp-help"><section class="vp-finale" hidden aria-labelledby="vp-finale-title"><h3 id="vp-finale-title">¿Dónde se esconde la última carta de Valdemar?</h3><p>Has abierto el expediente de Tomás. Tu próxima investigación puede ser «Cartas a medianoche», uno de los cuatro casos del primer mes.</p><div class="vp-season-actions"></div><div class="case-share vp-share-demo"><button type="button" data-copy-invite="https://www.laultimapieza.es/vallejo.html?via=invitacion">Copiar enlace a la demo</button><p role="status" aria-live="polite"></p></div></section>
      <details class="vp-pair" hidden><summary>Consultar los dos documentos</summary><p><span></span> <a target="_blank" rel="noopener"></a></p></details>
      <details class="vp-hints" hidden><summary>Pistas de esta prueba</summary><div class="vp-hints-body"><ol class="vp-hint-list"></ol><button type="button" class="vp-hint-table" hidden>Ver la tabla de Vigenère</button><button type="button" class="vp-hint-more">Revelar la primera pista</button><small class="vp-hint-status"></small></div></details></div></section></div>
      <footer class="vp-footer"><details class="vp-privacy"><summary>Opciones</summary><div class="vp-options"><label><input type="checkbox" data-vp-consent> Permitir contadores anónimos de uso de la demo, incluida la apertura del pase al terminar. Si llegué por invitación, también se contarán mi visita y mi solicitud de aviso. Opcional.</label><details class="vp-restart"><summary>Empezar de nuevo</summary><p>Se borrarán tus respuestas y pistas de esta partida.</p><button type="button" class="vp-reset">Reiniciar la demo</button></details></div></details>
      <div class="vp-footer-actions"><button class="vp-prev" type="button">Anterior</button><button class="vp-next" type="button">Siguiente</button><button class="vp-proceed vp-next-session" type="button" hidden>Abrir la siguiente sesión</button></div></footer><p class="vp-live" role="status" aria-live="polite"></p></div>`;
    const q = selector => host.querySelector(selector);
    Object.assign(st, { shell: q('.vp-shell'), sessionCaption: q('[data-vp-caption]'), side: q('.vp-side'), shelfToggle: q('.vp-shelf-toggle'), sideList: q('.vp-doc-list'), sessionList: q('.vp-sessions'), heading: q('.vp-doc-title'), reader: q('.vp-reader'), zoom: q('.vp-zoom'), status: q('.vp-live'), previous: q('.vp-prev'), next: q('.vp-next'), nextSession: q('.vp-next-session'), offer: q('.vp-finale') });
    Object.assign(st, { adjust: q('.vp-adjust'), bright: q('.vp-brighten'), mirror: q('.vp-mirror'), separate: q('.vp-separate'), pairInfo: q('.vp-pair'), pairText: q('.vp-pair span'), pairLink: q('.vp-pair a'), hintBox: q('.vp-hints'), hintList: q('.vp-hint-list'), hintStatus: q('.vp-hint-status'), hintMore: q('.vp-hint-more'), hintTable: q('.vp-hint-table') });
    st.shelfToggle.addEventListener('click', () => shelf(!st.shell.classList.contains('vp-shelf-open'), true));
    q('.vp-side-close').addEventListener('click', () => { shelf(false); st.shelfToggle.focus(); });
    st.previous.addEventListener('click', () => select(st.section, st.index - 1));
    st.next.addEventListener('click', () => select(st.section, st.index + 1));
    st.nextSession.addEventListener('click', () => continueSession(st));
    const member = !!root.ClubAccess?.canPlay;
    const plans = seasonLink('planes', 'Ver el pase mensual', !member);
    const cases = seasonLink('casos', member ? 'Elegir mi siguiente caso' : 'Explorar los casos', member);
    q('.vp-season-actions').append(...(member ? [cases, plans] : [plans, cases]));
    q('.vp-close').addEventListener('click', event => { event.stopPropagation(); suspend(); });
    q('.vp-reset').addEventListener('click', () => {
      close();
      open();
    });
    st.hintMore.addEventListener('click', () => revealHint(st));
    st.hintBox.addEventListener('toggle', () => { if (state === st) renderHints(st); });
    st.hintTable.addEventListener('click', () => {
      const index = st.sessions[st.section].documents.findIndex(item => item.file === '05_tabla_vigenere.png');
      if (index >= 0) select(st.section, index);
    });
    for (const [control, css] of [[st.adjust, 'vp-inverted'], [st.bright, 'vp-bright'], [st.mirror, 'vp-mirrored']]) {
      control.addEventListener('click', () => {
        const pane = st.panes.get(st.sessions[st.section].documents[st.index].file);
        control.setAttribute('aria-pressed', String(pane.classList.toggle(css)));
      });
    }
    st.zoom.addEventListener('click', () => {
      const pane = st.panes.get(st.sessions[st.section].documents[st.index].file);
      pane.classList.toggle('vp-zoomed');
      updateNav();
      pane.querySelector('.vp-image-scroll')?.focus({ preventScroll: true });
    });
    const checkbox = q('[data-vp-consent]');
    checkbox.checked = consent;
    checkbox.addEventListener('change', () => {
      consent = checkbox.checked;
      root.InvitationCounts?.setConsent(consent);
      if (consent) count('demo_start');
    });
  }
  function dispose(st) {
    if (state !== st) return;
    st.observers.forEach(observer => observer.disconnect());
    root.clearTimeout(st.hintTimer);
    const host = dialog();
    host?.querySelectorAll('audio').forEach(player => player.pause());
    host?.removeEventListener('close', st.onClose);
    host?.removeEventListener('cancel', st.onCancel);
    host?.classList.remove('vallejo-player');
    host?.replaceChildren();
    state = null;
    if (st.trigger?.isConnected) st.trigger.focus({ preventScroll: true });
  }
  function suspend() {
    const st = state, host = dialog();
    if (!st || !host?.open) return;
    st.paused = true;
    root.clearTimeout(st.hintTimer);
    host.querySelectorAll('audio').forEach(player => player.pause());
    host.close();
    if (st.trigger?.isConnected) st.trigger.focus({ preventScroll: true });
  }
  function dismiss(st, event) {
    event.preventDefault();
    if (st.shell.classList.contains('vp-shelf-open')) {
      shelf(false);
      st.shelfToggle.focus();
    } else suspend();
  }
  function close() {
    const st = state, host = dialog();
    if (!host || !st) return;
    if (host.open) host.close();
    dispose(st);
  }
  function open() {
    const host = dialog();
    if (!host || (host.open && state)) return;
    if (state?.paused && host.contains(state.shell)) {
      state.paused = false;
      state.trigger = document.activeElement;
      host.showModal();
      updateNav();
      state.heading.focus({ preventScroll: true });
      return;
    }
    if (state) dispose(state);
    ensureStyles();
    const trigger = document.activeElement;
    const parent = document.getElementById('modal');
    if (parent?.open) parent.close();
    const st = { sessions: sessions(), section: 0, index: 0, lastIndex: [], panes: new Map(), unlocked: new Set(), counted: new Set(), hintHistory: new Map(), observers: [], trigger, paused: false };
    state = st;
    if (root.InvitationCounts?.enabled) consent = true;
    host.classList.add('vallejo-player');
    setupDOM(host, st);
    st.onClose = () => { if (!host.open && !st.paused) dispose(st); };
    st.onCancel = event => dismiss(st, event);
    host.addEventListener('close', st.onClose);
    host.addEventListener('cancel', st.onCancel);
    if (!host.open) host.showModal();
    select(0, 0, false);
    host.querySelector('.vp-close').focus({ preventScroll: true });
    count('demo_start');
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-action="preview-open"]')) open();
  });
  root.CasePreview = { open, close };
  if (document.body?.dataset.vallejoStandalone === 'true') open();
})(window);
