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
  const receptionAudio = 'vallejo-recepcion-87v.wav';
  const tableMedia = [
    [
      { format:'text', label:'Correo del Archivo', use:'Lee lo que el Archivo encontró en la caja.', file:'00_email_apertura.html' },
      { format:'audio', label:'Timbre del depósito', use:'Escucha la señal que quedó grabada al recibir la copia.', tool:'audio' },
      { format:'image', label:'Ficha de admisión', use:'Acércate a la primera ficha digitalizada.', file:'01_ficha_admision.png' },
      { format:'web', label:'Registro de digitalización', use:'Cruza la hora del correo con la señal del depósito.', tool:'web' }
    ],
    [
      { format:'text', label:'El segundo correo', use:'Lee el mensaje que acompaña esta entrega.', file:'00_email_tomas.html' },
      { format:'audio', label:'Cinta de terapia', use:'Escucha la grabación de la sesión.', file:'02_grabacion_sesion1.wav' },
      { format:'image', label:'Diario de Marta', use:'Examina la página del diario de sueño.', file:'01_diario_marta.png' },
      { format:'web', label:'Registro de digitalización', use:'Vuelve al resguardo de la primera entrega.', tool:'web' }
    ]
  ];
  const formatNames = { text:'Texto', audio:'Audio', image:'Imagen', web:'Archivo web' };
  const dialog = () => document.getElementById('scene-preview');
  function referringCase() {
    if (!document.body?.dataset.vallejoStandalone) return null;
    const id = new URLSearchParams(root.location.search).get('caso');
    if (!/^(0[1-9]|1[0-2])$/.test(id)) return null;
    const path = '/valdemar/'+id+'/';
    const title = root.ValdemarCatalog?.get(id)?.title;
    return { path, label:title ? 'Volver a '+title : 'Volver a la historia' };
  }
  const returnCase = referringCase();
  let state = null;
  let consent = false;
  const saveKey = 'lup.vallejo.bookmark.v1';
  let memorySave = null;
  let memoryOnly = false;
  function readSave() {
    if (memoryOnly) return memorySave;
    let raw;
    try { raw = root.localStorage.getItem(saveKey); }
    catch { memoryOnly = true; return memorySave; }
    try {
      const save = JSON.parse(raw);
      return save?.version === 1 && Number.isSafeInteger(save.round) ? save : null;
    } catch { return null; }
  }
  function writeSave(save) {
    memorySave = save;
    if (memoryOnly) return;
    try { root.localStorage.setItem(saveKey, JSON.stringify(save)); }
    catch { memoryOnly = true; }
  }
  function hasProgress() {
    const save = readSave();
    return !!save && (save.playMode === 'solo' || save.playMode === 'duo' || (Array.isArray(save.consulted) && save.consulted.length > 0));
  }
  function asList(value) { return Array.isArray(value) ? value : []; }
  function saveBookmark(st) {
    const previous = readSave();
    if (previous && previous.round !== st.round) return;
    const hints = {...previous?.hints};
    for (const [key,entry] of st.hintHistory) {
      if (entry.seen) hints[key] = Math.max(Number(hints[key]) || 0, entry.seen);
    }
    const files = {...previous?.files};
    const current = st.sessions[st.section];
    if (st.lastIndex[st.section] !== undefined) files[current.id] = current.documents[st.lastIndex[st.section]].file;
    // Store only positions and earned milestones. Form entries, text and recordings stay outside the bookmark.
    writeSave({
      version:1, round:st.round, section:current.id, mode:st.mode, tool:st.mode === 'tool' ? st.activeTool : null,
      playMode:st.playMode, files, hints,
      receipt:st.receiptConfirmed || previous?.receipt === true,
      consulted:[...new Set([...asList(previous?.consulted), ...st.consulted])],
      unlocked:[...new Set([...asList(previous?.unlocked), ...st.unlocked])],
      counted:[...new Set([...asList(previous?.counted), ...st.counted])]
    });
  }
  function restoreBookmark(st, save) {
    if (!save) return;
    st.playMode = save.playMode === 'duo' ? 'duo' : 'solo';
    st.receiptConfirmed = save.receipt === true;
    const seen = new Set(asList(save.consulted));
    for (const tool of ['web','audio']) if (seen.has(tool)) st.consulted.add(tool);
    for (const key of asList(save.counted)) if (typeof key === 'string') st.counted.add(key);
    for (const [i,session] of st.sessions.entries()) {
      if (i && !st.unlocked.has(st.sessions[i-1].id)) break;
      if (asList(save.unlocked).includes(session.id)) st.unlocked.add(session.id);
      for (const doc of session.documents) if (seen.has(doc.file)) st.consulted.add(doc.file);
      const last = session.documents.findIndex(doc => doc.file === save.files?.[session.id]);
      if (last >= 0) st.lastIndex[i] = last;
      for (const [group,hints] of Object.entries(session.hints || {})) {
        const key = session.id + '/' + group, count = save.hints?.[key];
        if (Number.isInteger(count) && count > 0) st.hintHistory.set(key,{seen:Math.min(count,hints.length)});
      }
      if (save.section === session.id) st.section = i;
    }
    st.index = st.lastIndex[st.section] || 0;
  }
  function notifyProgress() { root.dispatchEvent(new Event('case-preview-progress')); }
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
    if (state.hasBookmark) saveBookmark(state);
    root.fetch('/api/metrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, consent: true }), keepalive: true
    }).catch(() => {});
    if (event === 'demo_start') root.InvitationCounts?.start();
  }
  function ensureStyles() {
    for (const file of ['vallejo-demo.css','vallejo-mesa.css']) {
      if (document.querySelector('link[href*="/'+file+'"]')) continue;
      const link = node('link');
      link.rel = 'stylesheet';
      link.href = '/'+file+'?v=mesa-87v-retomar-2';
      document.head.append(link);
    }
  }
  function shelf(expanded, focusFirst = false) {
    if (!state) return;
    const { shell, shelfToggle, side } = state;
    shell.classList.toggle('vp-shelf-open', expanded);
    shelfToggle.setAttribute('aria-expanded', String(expanded));
    if (expanded && focusFirst) (side.querySelector('[aria-current="page"]') || side.querySelector('.vp-doc-button'))?.focus();
  }
  function note(message) {
    if (state) state.status.textContent = message;
  }
  function receptionStep(st) {
    if (st.receiptConfirmed) return null;
    if (!st.consulted.has('00_email_apertura.html')) return { format:'text', label:'Leer el correo de la caja' };
    if (!st.consulted.has('audio')) return { format:'audio', label:'Escuchar el timbre' };
    return { format:'web', label:'Cotejar la copia' };
  }
  function tableAction(st) {
    if (st.section === 0) {
      if (st.unlocked.has(st.sessions[0].id) && st.lastIndex[1] === undefined) {
        return { label:'Leer el segundo correo', run:()=>continueSession(st) };
      }
      if (!st.lastIndex[0] && !st.unlocked.has(st.sessions[0].id)) {
        const step = receptionStep(st) || { format:'image', label:'Examinar la ficha de admisión' };
        return { label:step.label, format:step.format, run:()=>openMedium(st,step.format,0) };
      }
    }
    const index = st.lastIndex[st.section] || 0;
    return { label:index ? 'Retomar '+st.sessions[st.section].documents[index].label : st.section ? 'Leer el segundo correo' : 'Leer el correo de la caja', run:()=>select(st.section,index) };
  }
  function tableCards(st) {
    st.tableGrid.replaceChildren();
    const action = tableAction(st);
    for (const medium of tableMedia[st.section]) {
      const card = button('', 'vp-evidence-card vp-material', () => openMedium(st, medium.format, st.section));
      card.dataset.kind = card.dataset.format = medium.format;
      if (medium.format === action.format) {
        card.dataset.next = 'true';
      }
      const art = node('span', 'vp-card-art vp-material-art');
      art.setAttribute('aria-hidden','true');
      if (medium.format === 'image') {
        const thumb = node('img'); thumb.alt = ''; thumb.src = '/' + medium.file; thumb.decoding = 'async'; art.append(thumb);
      } else if (medium.format === 'audio') {
        for (let n = 0; n < 12; n++) art.append(node('i'));
      }
      const copy = node('span','vp-material-copy');
      const reader=['image','audio'].includes(medium.format)?'Sala de pruebas':'Archivo';
      copy.append(node('small','vp-card-format',formatNames[medium.format]+(st.playMode==='duo'?' · '+reader:'')),node('strong','vp-card-title',medium.label),node('span','vp-card-use',medium.use));
      if (medium.format === action.format) copy.prepend(node('span','vp-card-next','Siguiente pista'));
      const reviewed = st.consulted.has(medium.file || medium.tool);
      if (reviewed) {
        card.dataset.reviewed = 'true';
        const label = medium.tool === 'web' && st.receiptConfirmed ? 'Copia identificada' : 'Consultado';
        copy.append(node('span','vp-card-state',label));
      }
      const arrow = node('span','vp-card-arrow vp-material-arrow','↗'); arrow.setAttribute('aria-hidden','true');
      card.append(art,copy,arrow); st.tableGrid.append(card);
    }
    const first = st.section === 0;
    st.tableKicker.textContent = 'Archivo Provincial de Salud Mental';
    st.tableTitle.textContent = first ? 'La mesa de recepción' : 'La segunda entrega';
    st.tableIntro.textContent = first
      ? 'Han llegado tres copias de madrugada. Busca la hora en el correo, escucha el timbre y usa ambas pistas para reconocer la caja 87-V en el registro.'
      : 'La cinta de Marta ha perdido tres fragmentos. El Archivo te ha enviado su diario, la grabación y una hoja sin firma. ¿Qué dijo Marta aquella noche?';
    st.tableStart.hidden = !!action.format;
    st.tableStart.textContent = action.label;
    st.tableStart.onclick = action.run;
    st.tableSessions.replaceChildren();
    if (st.sessions.length > 1 && st.unlocked.has(st.sessions[0].id)) {
      st.sessions.forEach((session, index) => {
        const tab = button('Sesión ' + (index + 1), 'vp-session-choice', () => { st.section = index; st.index = st.lastIndex[index] || 0; showTable(st); });
        tab.setAttribute('aria-pressed',String(st.section === index)); st.tableSessions.append(tab);
      });
    }
    st.tableSessions.hidden = !st.tableSessions.childElementCount;
  }

  function hideOtherPanes(st, keep) {
    for (const [key, pane] of st.panes) {
      if (key !== keep) {
        pane.hidden = true;
        pane.querySelector('audio')?.pause();
      }
    }
  }
  function showTable(st, focus = true) {
    const source = st.mode === 'tool' ? st.activeTool : st.mode === 'original' ? st.sessions[st.section].documents[st.index].file : null;
    const medium = source && tableMedia[st.section].find(item=>(item.file || item.tool) === source);
    st.mode = 'table';
    hideOtherPanes(st);
    shelf(false);
    updateNav();
    if (focus) {
      const card = medium && st.tableGrid.querySelector('[data-format="' + medium.format + '"]');
      if (card) card.focus();
      else {
        st.table.scrollTop = 0;
        st.tableTitle.focus({preventScroll:true});
      }
    }
  }
  function receiptTool(st, pane) {
    const article = node('article','vp-intake-tool vp-entry');
    article.append(node('p','vp-eyebrow','Archivo Provincial · Depósito digital'),node('h4','','Parte de recepción'),node('p','','El sistema guardó tres resguardos. El reloj de recepción coincide con el del correo. ¿Qué copia corresponde a la caja 87-V?'));
    const table = node('table','vp-entry-table');
    const caption = node('caption','','Copias recibidas esta madrugada');
    const head = table.createTHead().insertRow();
    for (const title of ['Copia','Hora','Timbre','Cotejo']) { const th = node('th','',title); th.scope='col'; head.append(th); }
    table.prepend(caption);
    const rows = table.createTBody();
    const footer = node('p','vp-entry-status'); footer.id='vp-receipt-status'; footer.setAttribute('role','status');
    const next = button('Examinar la ficha de admisión','vp-button vp-entry-next',()=>openMedium(st,'image',st.section));
    next.setAttribute('aria-describedby',footer.id);
    const actions = node('div','vp-receipt-actions');
    actions.append(next);
    actions.hidden = !st.receiptConfirmed;
    if (st.receiptConfirmed) footer.textContent = 'Copia D-24 identificada. Su resguardo corresponde a la ficha que acompañaba el correo.';
    for (const [id,time,signal] of [['D-18','03:08','Largo · corto · corto'],['D-21','03:12','Corto · largo · corto'],['D-24','03:12','Largo · corto · corto']]) {
      const row = rows.insertRow(); row.dataset.copy = id;
      const name = node('th','',id); name.scope = 'row'; row.append(name);
      row.append(node('td','',time),node('td','',signal));
      const action = button('Cotejar','vp-entry-option',()=>{
        if (st.receiptConfirmed) return;
        if (id !== 'D-24') {
          footer.textContent = id + (id === 'D-18' ? ' coincide con el timbre. Comprueba la hora del mensaje.' : ' coincide con la hora. Vuelve a escuchar en qué orden suenan los timbres.');
          return;
        }
        st.receiptConfirmed = true;
        count('demo_receipt');
        saveBookmark(st);
        row.dataset.matched = 'true';
        footer.textContent = 'Copia D-24 identificada. El Archivo confirma que la ficha adjunta al correo pertenece a esta entrega.';
        actions.hidden = false;
        table.querySelectorAll('button').forEach(control=>{control.disabled=true;});
        next.focus();
      });
      action.setAttribute('aria-label','Cotejar la copia '+id);
      action.disabled = st.receiptConfirmed;
      if (st.receiptConfirmed && id === 'D-24') row.dataset.matched = 'true';
      row.insertCell().append(action);
    }
    article.append(table,footer,actions); pane.append(article);
  }
  function audioTool(st, pane) {
    const article = node('article','vp-intake-tool vp-intake-audio');
    article.append(node('p','vp-eyebrow','Recepción del depósito'),node('h4','','Timbre del depósito'),node('p','','Al registrar una copia, el timbre deja su señal en la grabadora. Escucha cómo se suceden los toques.'));
    const player = node('audio'); player.controls = true; player.preload = 'metadata'; player.src = '/' + receptionAudio; player.setAttribute('aria-label','Reproducir el timbre del depósito');
    const transcript = node('details','vp-entry-transcript');
    transcript.append(node('summary','','Leer la transcripción'),node('p','','Se oye un clic y un leve ruido de fondo. Suena el timbre de forma prolongada. Tras una pausa, suenan dos timbrazos cortos, separados. El ruido de fondo se apaga.'));
    const next = button('','vp-button vp-listen-next',()=>{
      const step = receptionStep(st);
      openMedium(st,step?.format || 'image',0);
    });
    article.append(player,transcript,next); pane.append(article);
  }
  function openMedium(st, format, section) {
    if (section > 0 && !st.unlocked.has(st.sessions[0].id)) return;
    const medium = tableMedia[section]?.find(item=>item.format === format);
    if (!medium) return;
    if (medium.file) {
      const index = st.sessions[section].documents.findIndex(doc=>doc.file === medium.file);
      if (index >= 0) select(section,index);
      return;
    }
    st.section = section; st.index = st.lastIndex[section] || 0; st.mode = 'tool'; st.activeTool = medium.tool;
    st.consulted.add(medium.tool);
    const key = 'intake/' + medium.tool;
    let pane = st.panes.get(key);
    if (!pane) {
      pane = node('div','vp-pane vp-intake-pane');
      pane.setAttribute('role','region'); pane.setAttribute('aria-label',medium.label);
      if (medium.tool === 'web') receiptTool(st,pane); else audioTool(st,pane);
      st.reader.append(pane); st.panes.set(key,pane);
    }
    if (medium.tool === 'web') pane.querySelector('.vp-entry-next').textContent = section === 0 ? 'Examinar la ficha de admisión' : 'Examinar el diario de Marta';
    else pane.querySelector('.vp-listen-next').textContent = receptionStep(st)?.label || 'Examinar la ficha de admisión';
    hideOtherPanes(st,key); pane.hidden = false;
    shelf(false); updateNav(); st.heading.focus({preventScroll:true});
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
      const replace = ownsHistoryEntry();
      close(false);
      if (!onHome || root.location.hash !== '#' + route) {
        if (replace) root.location.replace(link.href);
        else root.location.assign(link.href);
      } else {
        if (replace) root.history.back();
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
    if (!st.hintHistory.has(key)) st.hintHistory.set(key, { seen: 0 });
    return { session, group, key, hints, entry: st.hintHistory.get(key) };
  }
  function renderHints(st) {
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
    st.hintMore.hidden = done;
    st.hintMore.textContent = h.entry.seen ? 'Revelar otra pista' : 'Revelar la primera pista';
    st.hintStatus.textContent = done ? 'Has consultado todas las pistas de esta prueba.' : 'Abre las pistas de una en una cuando las necesites.';
  }
  function revealHint(st) {
    const h = hintFor(st);
    if (!h || h.entry.seen >= h.hints.length) return;
    h.entry.seen++;
    count('demo_hint', h.key + '/' + h.entry.seen);
    saveBookmark(st);
    renderHints(st);
    note('Pista ' + h.entry.seen + '. ' + h.hints[h.entry.seen - 1]);
  }
  const documentGoals={
    '00_email_apertura.html':'Localiza la hora de recepción y averigua qué señal dejó el depósito.',
    '01_ficha_admision.png':'Inspecciona las anotaciones del margen. Prueba a invertir la ficha o a subir el brillo.',
    '02_plano_pabellon.png':'Sitúa las dos filas del plano antes de cruzarlas con el registro de rondas.',
    '03_registro_rondas.png':'Con el plano a la vista, confronta las habitaciones nombradas y las que quedan enfrente.',
    '04_carta_vallejo.png':'Examina el comienzo de los párrafos y conserva por separado el grupo de letras del final.',
    '05_tabla_vigenere.png':'Busca la fila de cada letra de la clave y recorre sus columnas con el texto cifrado.',
    '06_expediente_marta.html':'Reúne habitación, palabra y fecha para abrir el expediente de Marta.',
    '00_email_tomas.html':'Averigua qué falta en la segunda entrega y por qué te envían el diario de Marta.',
    '01_diario_marta.png':'Anota únicamente los números que Marta recuerda haber contado y examina la regla del diario.',
    '02_grabacion_sesion1.wav':'Escucha o lee los golpes. Conserva el orden de los pares y las pausas entre ellos.',
    '03_armario_medicacion.png':'Sigue en los cajones las posiciones que obtuviste al escuchar la grabación.',
    '04_hoja_suelta.png':'Pon la hoja ante el espejo y recupera el fragmento escrito al revés.',
    '05_expediente_tomas.html':'Ordena los tres fragmentos del diario, la cinta y la hoja para abrir el expediente de Tomás.'
  };
  function updateGameGuide(st){
    if(!root.MesaDeJuego)return;
    const current=st.sessions[st.section],doc=current.documents[st.index];
    const atTable=st.mode==='table',tool=st.mode==='tool',opened=st.unlocked.has(current.id);
    let objective, next;
    if(atTable){
      const move=tableAction(st);
      objective=st.section?'Reconstruye la frase que quedó repartida entre el diario, la cinta y la hoja.':
        st.receiptConfirmed?'Sigue el plano, las rondas y la carta para reunir los tres datos del expediente.':'Identifica el resguardo de la caja con la hora del correo y la señal del depósito.';
      next={label:move.label,run:move.run};
    }else if(tool){
      objective=st.activeTool==='audio'?'Distingue la duración y el orden de las señales de la recepción.':'Compara la hora y el timbre con las tres copias del registro.';
    }else{
      objective=opened&&doc.type==='gate'?'El expediente ya está abierto. Puedes releer sus pruebas.':documentGoals[doc.file];
      const step=st.section===0&&st.index===0?receptionStep(st):null;
      if(step)next={label:step.label,run:()=>openMedium(st,step.format,0)};
      else if(current.documents[st.index+1]){
        const nextDoc=current.documents[st.index+1];
        next={label:nextDoc.label,run:()=>select(st.section,st.index+1)};
      }else if(opened&&!st.section)next={label:'Leer el segundo correo',run:()=>continueSession(st)};
    }
    if(!st.guideHost)st.guideHost=node('div','vp-game-guide');
    if(atTable){if(st.guideHost.parentElement!==st.table)st.table.append(st.guideHost);}
    else if(st.guideHost.parentElement!==st.desk)st.reader.after(st.guideHost);
    const settings={family:'archivo',title:current.dossierLabel||current.title,objective,
      progress:atTable?'Expediente '+(st.section+1)+' de 2':tool?'Recepción de la caja':'Documento '+(st.index+1)+' de '+current.documents.length,
      next:next||null,result:doc.type==='gate'&&opened&&!atTable&&!tool?(st.section?'Tomás':'Marta')+' · Expediente abierto':null,
      help:{context:'archivo',text:st.playMode==='duo'?'En pareja, podéis repartir la lectura y describiros las marcas de cada documento.':'En solitario puedes volver a cualquier documento que hayas abierto.',
        steps:[objective,'En Documentos puedes saltar entre originales. Las imágenes y las grabaciones incluyen una lectura en texto.','Volver a la mesa conserva los documentos consultados y los expedientes abiertos.']}};
    if(st.guide)st.guide.update(settings);else st.guide=root.MesaDeJuego.mount(st.guideHost,settings);
    if(atTable)st.tableStart.hidden=true;
    if(!atTable&&!tool&&next){st.next.hidden=true;st.nextSession.hidden=true;}
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
    const reception = st.mode === 'original' && st.section === 0 && st.index === 0 ? receptionStep(st) : null;
    st.next.textContent = reception?.label || 'Siguiente';
    st.next.onclick = reception ? ()=>openMedium(st,reception.format,0) : ()=>select(st.section,st.index+1);
    const openedGate = doc.type === 'gate' && st.unlocked.has(current.id);
    st.nextSession.hidden = !(openedGate && st.section === 0);
    st.delivery.hidden = st.nextSession.hidden;
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
      const [joint,alone]=pair[0].split(' Si juegas a solas, ');
      st.pairText.textContent = st.playMode==='duo' ? joint : 'Puedes '+alone.replace(/^puedes /,'');
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
      if (st.mode === 'original' && st.index === index) control.setAttribute('aria-current', 'page');
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
    const atTable = st.mode === 'table', tool = st.mode === 'tool';
    st.shell.classList.toggle('vp-at-table',atTable);
    st.shell.classList.toggle('vp-at-intake-tool',tool);
    st.table.hidden = !atTable;
    st.side.hidden = st.desk.hidden = atTable;
    st.footerActions.hidden = st.help.hidden = atTable || tool;
    if (atTable) tableCards(st);
    if (tool) {
      st.shelfToggle.textContent = 'Documentos de la sesión';
      st.heading.textContent = tableMedia[st.section].find(medium=>medium.tool === st.activeTool)?.label || 'Documento';
      for (const control of [st.zoom,st.adjust,st.bright,st.mirror,st.separate]) control.hidden = true;
    }
    if (atTable || tool) {
      st.hintBox.open = false;
    } else renderHints(st);
    updateGameGuide(st);
    if (st.consulted.size || st.playMode === 'duo' || st.hasBookmark) {
      st.hasBookmark = true;
      saveBookmark(st);
    }
  }
  function unlock(st, section) {
    if (state !== st) return;
    const session = st.sessions[section];
    if (st.unlocked.has(session.id)) return;
    st.unlocked.add(session.id);
    if (section === 0) count('demo_solved');
    if (section === 1) count('demo_complete');
    updateNav();
    note(section === 0 ? 'Expediente de Marta abierto. Ha llegado un segundo correo del Archivo.' : 'Expediente abierto. Has terminado el archivo de Marta y Tomás.');
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
        st.nextSession.textContent = 'Leer el segundo correo';
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
        if (st.unlocked.has(session.id)) {
          door.classList.add('hidden');
          record.classList.remove('hidden');
        }
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
  function evidenceReading(reading) {
    const box=node('details','vp-evidence-reading');
    box.append(node('summary','',reading.knocks?'Leer la secuencia de golpes':'Leer el facsímil en texto'));
    for(const line of reading.lines||[])box.append(node('p','',line));
    if(reading.knocks){
      box.append(node('p','','Cada «toc» es un golpe. Una pausa breve separa los dos grupos de cada línea. Una pausa más larga separa una línea de la siguiente.'));
      const list=node('ol');
      const taps=count=>Array(count).fill('toc').join(', ');
      for(const [first,second] of reading.knocks)list.append(node('li','',taps(first)+'. Pausa breve. '+taps(second)+'.'));
      box.append(list);
    }
    if(reading.alphabet){
      const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const label=node('label','','Fila de la clave ');
      const choose=node('select');
      for(const letter of letters)choose.append(node('option','',letter));
      const values=node('p');values.setAttribute('aria-live','polite');
      const show=()=>{const offset=letters.indexOf(choose.value);values.textContent=[...letters].map((letter,i)=>letter+' / '+letters[(i+offset)%letters.length]).join(', ');};
      label.append(choose);box.append(label,node('p','','Cada par muestra la cabecera de la columna y, después de la barra, la letra cifrada de la fila seleccionada.'),values);
      choose.addEventListener('change',show);show();
    }
    if(reading.tool){
      const changed=node('div');changed.hidden=true;changed.dataset.readingTool=reading.tool;
      for(const line of reading.adjusted)changed.append(node('p','',line));
      box.append(changed);
    }
    return box;
  }
  function loadDocument(st, section, doc) {
    if (st.panes.has(doc.file)) return st.panes.get(doc.file);
    const pane = node('div', 'vp-pane vp-' + doc.type);
    pane.setAttribute('role', 'region');
    pane.setAttribute('aria-label', doc.label);
    pane.hidden = true;
    st.reader.append(pane);
    st.panes.set(doc.file, pane);
    const reading=st.sessions[section].readings?.[doc.file];
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
      if(reading)viewport.append(evidenceReading(reading));
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
      if(reading)card.append(evidenceReading(reading));
      pane.append(card);
    } else frame(st, section, doc, pane);
    return pane;
  }
  function select(section, index, focus = true) {
    const st = state;
    if (!st || (section > 0 && !st.unlocked.has(st.sessions[section - 1]?.id))) return;
    const doc = st.sessions[section]?.documents[index];
    if (!doc) return;
    hideOtherPanes(st,doc.file);
    st.mode = 'original';
    st.consulted.add(doc.file);
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
      <header class="vp-header"><div><p class="vp-eyebrow" data-vp-caption></p><h2 id="scene-title">Archivo de Marta y Tomás</h2></div><label class="vp-play-mode"><span>Cómo jugar</span><select aria-label="Modalidad del archivo"><option value="solo">En solitario</option><option value="duo">En pareja</option></select></label><button type="button" class="vp-close" data-action="scene-close" aria-label="Volver a La cinta 87">Cerrar</button></header>
      <div class="vp-work"><section class="vp-intake vp-table" aria-labelledby="vp-intake-title">
      <header class="vp-intake-intro vp-table-hero"><img class="vp-table-cover" src="/vallejo-mesa-87v.webp" width="1000" height="500" alt=""><div class="vp-table-copy"><p class="vp-eyebrow" data-vp-table-kicker></p><h3 class="vp-intake-title" id="vp-intake-title" tabindex="-1"></h3><p class="vp-intake-description"></p><nav class="vp-intake-sessions" aria-label="Mesas disponibles" hidden></nav><button class="vp-intake-start vp-table-start" type="button"></button></div></header>
      <div class="vp-evidence-grid vp-table-materials" aria-label="Pruebas de la mesa" role="group"></div></section>
      <aside class="vp-side" id="vp-documentos" aria-label="Documentos del expediente"><div class="vp-side-head"><h3>Documentos</h3><button type="button" class="vp-side-close" aria-label="Cerrar la lista de documentos">Cerrar</button></div><div class="vp-sessions"></div><ol class="vp-doc-list"></ol></aside>
      <section class="vp-desk" aria-label="Lector de documentos"><div class="vp-document-head"><button type="button" class="vp-table-return vp-back-table">Volver a la mesa</button><button type="button" class="vp-shelf-toggle" aria-controls="vp-documentos" aria-expanded="false">Documentos</button><h3 class="vp-doc-title" tabindex="-1"></h3><button type="button" class="vp-zoom" hidden>Ampliar imagen</button><button type="button" class="vp-adjust" hidden>Invertir</button><button type="button" class="vp-brighten" hidden>Subir brillo</button><button type="button" class="vp-mirror" hidden>Espejo</button><a class="vp-open-original vp-separate" target="_blank" rel="noopener" hidden>Abrir aparte</a></div><div class="vp-reader"></div>
      <div class="vp-help"><aside class="vp-delivery" hidden aria-label="Nuevo correo"><strong>03:41 · Correo del Archivo</strong><p>Hay una cinta dañada en la carpeta de Marta. El Archivo acaba de enviarte una copia.</p></aside><section class="vp-finale" hidden aria-labelledby="vp-finale-title"><h3 id="vp-finale-title">Expediente de Tomás abierto</h3><p>Has terminado los expedientes de Marta y Tomás.</p><div class="vp-season-actions"></div><div class="case-share vp-share-demo"><button type="button" data-copy-invite="https://www.laultimapieza.es/cinta-87.html?via=invitacion">Compartir la demo La cinta 87</button><p role="status" aria-live="polite"></p></div></section>
      <details class="vp-pair" hidden><summary>Consultar los dos documentos</summary><p><span></span> <a target="_blank" rel="noopener"></a></p></details>
      <details class="vp-hints" hidden><summary>Pistas de esta prueba</summary><div class="vp-hints-body"><ol class="vp-hint-list"></ol><button type="button" class="vp-hint-table" hidden>Ver la tabla de Vigenère</button><button type="button" class="vp-hint-more">Revelar la primera pista</button><small class="vp-hint-status"></small></div></details></div></section></div>
      <footer class="vp-footer"><details class="vp-privacy"><summary>Opciones</summary><div class="vp-options"><p data-save-info></p><label><input type="checkbox" data-vp-consent> Permitir contadores anónimos de uso del archivo, incluida la apertura del pase al terminar. Si llegué por invitación, también se contarán mi visita y mi solicitud de aviso. Opcional.</label><details class="vp-restart"><summary>Empezar de nuevo</summary><p>Se borrará el progreso del archivo de Marta y Tomás guardado en este navegador.</p><button type="button" class="vp-reset">Reiniciar el archivo</button></details></div></details>
      <div class="vp-footer-actions"><button class="vp-prev" type="button">Anterior</button><button class="vp-next" type="button">Siguiente</button><button class="vp-proceed vp-next-session" type="button" hidden>Leer el segundo correo</button></div></footer><p class="vp-live" role="status" aria-live="polite"></p></div>`;
    const q = selector => host.querySelector(selector);
    q('.vp-privacy').addEventListener('toggle',()=>{
      q('[data-save-info]').textContent = memoryOnly ? 'Esta lectura se conserva mientras mantengas la pestaña abierta.' : 'Tu lectura se guarda en este navegador. Al volver, continuarás desde la última pista que consultaste.';
    });
    q('.vp-play-mode select').value=st.playMode;
    q('.vp-play-mode select').addEventListener('change',event=>{
      st.playMode=event.target.value==='duo'?'duo':'solo';
      updateNav();
      note(st.playMode==='duo'?'Compartid esta pantalla para investigar los expedientes. El papel 1 consulta el Archivo y el papel 2 examina las pruebas. Contad al otro lo que habéis encontrado.':'En solitario. Puedes consultar los dos grupos de pistas.');
    });
    Object.assign(st, { shell: q('.vp-shell'), sessionCaption: q('[data-vp-caption]'), side: q('.vp-side'), shelfToggle: q('.vp-shelf-toggle'), sideList: q('.vp-doc-list'), sessionList: q('.vp-sessions'), heading: q('.vp-doc-title'), reader: q('.vp-reader'), zoom: q('.vp-zoom'), status: q('.vp-live'), previous: q('.vp-prev'), next: q('.vp-next'), nextSession: q('.vp-next-session'), offer: q('.vp-finale') });
    Object.assign(st, { adjust: q('.vp-adjust'), bright: q('.vp-brighten'), mirror: q('.vp-mirror'), separate: q('.vp-separate'), pairInfo: q('.vp-pair'), pairText: q('.vp-pair span'), pairLink: q('.vp-pair a'), hintBox: q('.vp-hints'), hintList: q('.vp-hint-list'), hintStatus: q('.vp-hint-status'), hintMore: q('.vp-hint-more'), hintTable: q('.vp-hint-table') });
    Object.assign(st, { desk:q('.vp-desk'), help:q('.vp-help'), footerActions:q('.vp-footer-actions'), table:q('.vp-intake'), tableKicker:q('[data-vp-table-kicker]'), tableTitle:q('.vp-intake-title'), tableIntro:q('.vp-intake-description'), tableStart:q('.vp-intake-start'), tableGrid:q('.vp-evidence-grid'), tableSessions:q('.vp-intake-sessions') });
    st.delivery = q('.vp-delivery');
    q('.vp-table-return').addEventListener('click',()=>showTable(st));
    st.shelfToggle.addEventListener('click', () => shelf(!st.shell.classList.contains('vp-shelf-open'), true));
    q('.vp-side-close').addEventListener('click', () => { shelf(false); st.shelfToggle.focus(); });
    st.previous.addEventListener('click', () => select(st.section, st.index - 1));
    st.nextSession.addEventListener('click', () => continueSession(st));
    const member = !!root.ClubAccess?.canPlay;
    const cases = seasonLink('casos', member ? 'Elegir mi siguiente aventura' : 'Explorar las aventuras',true);
    q('.vp-season-actions').append(cases);
    q('.vp-close').addEventListener('click', event => { event.stopPropagation(); suspend(); });
    q('.vp-close').textContent = 'Volver a La cinta 87';
    q('.vp-close').setAttribute('aria-label','Volver a la demo La cinta 87');
    q('.vp-reset').addEventListener('click', () => {
      const round = (readSave()?.round || 0) + 1;
      const trigger = st.trigger;
      close(false);
      writeSave({version:1,round});
      notifyProgress();
      open(null,trigger);
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
        const active=pane.classList.toggle(css);
        control.setAttribute('aria-pressed', String(active));
        const reading=pane.querySelector('[data-reading-tool="'+css+'"]');
        if(reading)reading.hidden=!active;
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
  function ownsHistoryEntry() {
    return !!root.history?.state?.vallejoDialog && root.history.state.vallejoDialog === root.location.href;
  }
  function restoreFocus(st) {
    const focus = () => {
      if (dialog()?.open) return;
      const visible = el => el?.isConnected && el.getClientRects().length && !el.closest('dialog:not([open])');
      const candidates = [...document.querySelectorAll('[data-action="preview-open"]')].filter(visible);
      const equivalent = candidates.find(el=>st.trigger?.dataset.vpFormat
        ? el.dataset.vpFormat === st.trigger.dataset.vpFormat
        : el.textContent === st.trigger?.textContent);
      const target = visible(st.trigger) ? st.trigger : equivalent || candidates[0] || document.getElementById('main');
      target?.focus({preventScroll:true});
    };
    focus();
    root.requestAnimationFrame(()=>{ if (document.activeElement === document.body) focus(); });
  }
  function dispose(st) {
    if (state !== st) return;
    st.guide?.destroy();
    st.observers.forEach(observer => observer.disconnect());
    const host = dialog();
    host?.querySelectorAll('audio').forEach(player => player.pause());
    host?.removeEventListener('close', st.onClose);
    host?.removeEventListener('cancel', st.onCancel);
    host?.classList.remove('vallejo-player');
    host?.replaceChildren();
    state = null;
    notifyProgress();
  }
  function suspend(popEntry = true) {
    const st = state, host = dialog();
    if (!st || !host?.open) return;
    st.paused = true;
    host.querySelectorAll('audio').forEach(player => player.pause());
    host.close();
    notifyProgress();
    if(document.body.dataset.vallejoStandalone && popEntry && new URLSearchParams(root.location.search).get('archivo')==='1'){
      const next=new URL(root.location.href);
      next.searchParams.delete('archivo');
      root.location.replace(next.href);
      return;
    }
    if (returnCase && popEntry) {
      const referer = document.referrer ? new URL(document.referrer) : null;
      if (root.history.length > 1 && referer?.origin === root.location.origin && referer.pathname === returnCase.path) root.history.back();
      else root.location.replace(returnCase.path);
      return;
    }
    restoreFocus(st);
    if (popEntry && ownsHistoryEntry()) root.history.back();
  }
  function dismiss(st, event) {
    event.preventDefault();
    if (st.shell.classList.contains('vp-shelf-open')) {
      shelf(false);
      st.shelfToggle.focus();
    } else suspend();
  }
  function close(popEntry = true) {
    const st = state, host = dialog();
    if (!host || !st) return;
    if (host.open) host.close();
    dispose(st);
    if (popEntry) {
      restoreFocus(st);
      if (ownsHistoryEntry()) root.history.back();
    }
  }
  function open(format, origin = document.activeElement) {
    const host = dialog();
    if (!host) return;
    const requested = Object.hasOwn(formatNames,format) ? format : null;
    if (host.open && state) {
      if (requested) openMedium(state,requested,0);
      return;
    }
    if (!document.body.dataset.vallejoStandalone && !ownsHistoryEntry()) {
      root.history.pushState({...root.history.state, vallejoDialog:root.location.href},'');
    }
    if (state?.paused && host.contains(state.shell)) {
      state.paused = false;
      if (origin?.matches?.('[data-action="preview-open"]')) state.trigger = origin;
      host.showModal();
      updateNav();
      if (requested) openMedium(state,requested,0);
      else (state.mode === 'table' ? state.tableTitle : state.heading).focus({ preventScroll: true });
      return;
    }
    if (state) dispose(state);
    ensureStyles();
    const trigger = origin?.matches?.('[data-action="preview-open"]') ? origin : null;
    const parent = document.getElementById('modal');
    if (parent?.open) parent.close();
    const saved = readSave();
    const st = { sessions: sessions(), section: 0, index: 0, mode:'table', playMode:'solo', consulted:new Set(), receiptConfirmed:false, lastIndex: [], panes: new Map(), unlocked: new Set(), counted: new Set(), hintHistory: new Map(), observers: [], trigger, paused: false, round:saved?.round || 0, hasBookmark:!!saved?.playMode };
    restoreBookmark(st,saved);
    state = st;
    if (root.InvitationCounts?.enabled) consent = true;
    host.classList.add('vallejo-player');
    setupDOM(host, st);
    st.onClose = () => { if (!host.open && !st.paused) dispose(st); };
    st.onCancel = event => dismiss(st, event);
    host.addEventListener('close', st.onClose);
    host.addEventListener('cancel', st.onCancel);
    if (!host.open) host.showModal();
    if (requested) openMedium(st,requested,0);
    else if (saved?.mode === 'tool' && (saved.tool === 'audio' || saved.tool === 'web') && tableMedia[st.section].some(m=>m.tool===saved.tool)) openMedium(st,saved.tool,st.section);
    else if (saved?.mode === 'original') select(st.section,st.index);
    else showTable(st);
    count('demo_start');
  }
  const archiveRoute=document.body?.dataset.vallejoStandalone==='true'&&new URLSearchParams(root.location.search).get('archivo')==='1';
  root.VallejoArchive = {open,close,hasProgress};
  if(!archiveRoute||!hasProgress())return;
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-archivo-abrir]');
    if(trigger)open(trigger.dataset.vpFormat,trigger);
  });
  root.addEventListener?.('popstate',()=>{
    if (document.body.dataset.vallejoStandalone) return;
    if (ownsHistoryEntry()) open(undefined,state?.trigger);
    else if (dialog()?.open) suspend(false);
  });
  if (returnCase) {
    const back = document.querySelector('.v87-paused .vp-back');
    if(back){back.href = returnCase.path;back.textContent = returnCase.label;}
  }
  open();
})(window);
