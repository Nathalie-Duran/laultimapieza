/* Mesas de investigación de los juegos del tren y de la emisora. */
(() => {
  'use strict';

  const mesas = {
    3: [
      ['El billete del sobre', 'Abre los billetes por su doblez y compara el sello con los recuerdos de aquella noche.', 'Pasar el billete al sobre'],
      ['El plano del transbordo', 'Sigue el recorrido de los viajeros. Deja sobre el plano las observaciones que sus trayectos sostienen.', 'Fijar al plano'],
      ['La mesa de luz', 'Observa qué partes del negativo se reflejan y conserva las observaciones compatibles con la fotografía.', 'Conservar observación'],
      ['La tira del trayecto', 'Encadena las marcas en el orden del viaje. Puedes retirar cualquier marca para probar otro recorrido.', 'Perforar la tira'],
      ['El álbum de la cita', 'Sujeta al álbum los hechos que puedes documentar antes de decidir qué hacer con la carta.', 'Sujetar al álbum']
    ],
    4: [
      ['La mesa de escucha', 'Aísla las señales y arma el parte con lo que distingues en cada entrada.', 'Añadir al parte'],
      ['El archivo de emisiones', 'Contrasta cada día con las noches contiguas. Coloca una ficha de fechas en el registro.', 'Registrar ficha'],
      ['La bancada de empalme', 'Marca la caja que llevarás a la mesa y los fragmentos que retirarás de la copia.', 'Marcar en la copia'],
      ['El reloj de continuidad', 'Monta los cortes sobre la línea de tiempo. El contador acumula la duración de las piezas que has colocado.', 'Montar el corte'],
      ['El panel de retornos', 'Conecta las dos rutas privadas que propones. Comprueba quién escucha al otro lado de cada retorno.', 'Tender el cable']
    ]
  };
  const prefix = id => Number(id) === 3 ? 'tren' : 'radio';
  const foto = (id, index) => Number.isInteger(index) && mesas[id]?.[index] ? '/investigacion-' + prefix(id) + '-' + (index + 1) + '.webp' : null;

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(text, run, className) {
    const n = el('button', className, text);
    n.type = 'button';
    n.addEventListener('click', run);
    return n;
  }
  function live(className) {
    const n = el('p', className);
    n.setAttribute('role', 'status');
    return n;
  }
  function rows(item) {
    return item.body.split(/\r?\n/).filter(line => line.includes('|')).map(line => line.split('|').map(text => text.trim()));
  }
  function instrument(title, guide) {
    const wrapper = el('section', 'tr-inspector');
    wrapper.append(el('h5', '', title), el('p', 'tr-guide', guide));
    return wrapper;
  }
  function picker(parent, choices, paint) {
    const controls = el('div', 'tr-picks');
    let current = 0;
    const buttons = choices.map((label, i) => {
      const b = button(label, () => select(i), 'tr-token');
      controls.append(b);
      return b;
    });
    function select(i) {
      current = i;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      paint(i);
    }
    parent.append(controls);
    if (buttons.length) select(0);
    return () => current;
  }
  function tickets(item) {
    const pieces = rows(item);
    if (!pieces.length) return;
    const box = instrument('Billetes plegados', 'Elige una pieza y desdóblala para examinar la tinta.');
    const face = el('div', 'tr-ticket'), number = el('strong'), stamp = el('p'), icon = el('span', 'tr-ink');
    icon.setAttribute('aria-hidden', 'true');
    face.append(icon, number, stamp);
    let turned = false, current = 0;
    const flip = button('Desdoblar billete', () => { turned = !turned; paint(); }, 'tr-action');
    function paint() {
      const [code, date, reverse] = pieces[current];
      number.textContent = code;
      stamp.textContent = turned ? reverse : date;
      face.dataset.reverse = String(turned);
      icon.textContent = !turned ? '⌁' : /V roja/i.test(reverse) ? 'V' : '☾';
      icon.dataset.ink = !turned ? '' : /V roja/i.test(reverse) ? 'roja' : /azul/i.test(reverse) ? 'azul' : 'verde';
      flip.textContent = turned ? 'Volver al anverso' : 'Desdoblar billete';
      flip.setAttribute('aria-pressed', String(turned));
    }
    picker(box, pieces.map(row => row[0]), i => { current = i; turned = false; paint(); });
    box.append(face, flip);
    return box;
  }
  function routes(item) {
    const paths = item.body.split(/\r?\n/).map(line => line.split('→').map(x => x.trim()));
    if (!paths.length) return;
    const box = instrument('Plano de lectura', 'Elige un punto de partida y recorre sus paradas hasta el aviso.');
    const line = el('ol', 'tr-route');
    picker(box, paths.map(path => path[0]), i => line.replaceChildren(...paths[i].map(part => el('li', '', part))));
    box.append(line);
    return box;
  }
  function negative(item) {
    if (!/LARTNEC/.test(item.body) || !/1:50/.test(item.body)) return;
    const box = instrument('Visor de negativos', 'Compara el borde, el ramo y la esfera. Ensaya el giro de toda la copia o solo el reflejo.');
    const frame = el('div', 'tr-film'), border = el('span', 'tr-film-number', 'N.º 08'), display = el('div', 'tr-reflection');
    const clock = el('span', 'tr-clock'), minute = el('i', 'tr-minute'), hour = el('i', 'tr-hour');
    clock.setAttribute('aria-hidden', 'true'); clock.append(hour, minute);
    const reversedSign=item.body.match(/LARTNEC/)[0];
    display.append(el('b', '', [...reversedSign].reverse().join('')), clock);
    frame.append(border, display, el('span', 'tr-bouquet', 'Sol'));
    const output = live('tr-reading');
    picker(box, ['Copia recibida', 'Voltear toda la copia', 'Voltear solo el reflejo'], i => {
      frame.dataset.position = String(i);
      output.textContent = ['Borde y ramo legibles. El rótulo del fondo está invertido. La esfera parece marcar la 1:50.',
        'Borde y ramo invertidos. El rótulo del fondo se lee. Las agujas quedan al otro lado de la esfera.',
        'Borde y ramo legibles. El rótulo del fondo se lee. Las agujas quedan al otro lado de la esfera.'][i];
    });
    box.append(frame, output);
    return box;
  }
  function timeTool(item) {
    const entries = rows(item).filter(r => /^\d{2}:\d{2}$/.test(r[1]));
    if (!entries.length) return;
    const box = instrument('Calibrador de sellos', 'Selecciona un control. Usa los minutos de adelanto o atraso de su máquina para probar una corrección.');
    const tag = el('p', 'tr-guide'), dial = el('output', 'tr-time'), less = button('Restar un minuto', () => adjust(-1), 'tr-action'), more = button('Sumar un minuto', () => adjust(1), 'tr-action');
    let base, delta = 0;
    function adjust(amount) {
      delta = Math.min(59, Math.max(-59, delta + amount));
      const t = (base + delta + 1440) % 1440;
      dial.textContent = [Math.floor(t / 60), t % 60].map(n => String(n).padStart(2, '0')).join(':');
      less.disabled = delta <= -59; more.disabled = delta >= 59;
    }
    picker(box, entries.map(row => row[0]), i => {
      const [, stamp, clock] = entries[i], [h, m] = stamp.split(':').map(Number);
      tag.textContent = stamp + ' · ' + clock; base = h * 60 + m; delta = 0; adjust(0);
    });
    const controls = el('div', 'tr-picks');
    dial.setAttribute('aria-label','Hora corregida');
    controls.append(less, dial, more); box.append(tag, controls);
    return box;
  }
  function archive(item, title, guide, skipHeading) {
    const observations = rows(item);
    if (skipHeading) observations.shift();
    if (!observations.length) return;
    const box = instrument(title, guide), sheet = el('div', 'tr-record'), label = el('strong'), notes = el('p');
    sheet.append(label, notes);
    picker(box, observations.map(row => row[0]), i => {
      label.textContent = observations[i][0];
      notes.textContent = observations[i].slice(1).join(' · ');
    });
    box.append(sheet);
    return box;
  }
  function radioMonitor(item) {
    const parts = item.body.match(/(?:Línea|Canal) [ABC]:[\s\S]*?(?=\s+(?:Línea|Canal) [ABC]:|$)/g);
    if (parts?.length !== 3) return;
    const box = instrument('Escucha aislada', 'Selecciona un canal. Puedes escuchar una recreación de sus señales o leer el registro.');
    const record = el('p', 'tr-reading'), lamps = el('div', 'tr-lamps');
    lamps.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 16; i++) lamps.append(el('i'));
    let selected = 0, audio = null;
    const stop = () => {
      if (audio) { const previous = audio; audio = null; previous.close().catch(() => {}); }
      lamps.classList.remove('tr-playing');
    };
    const play = button('Escuchar la señal', async () => {
      stop();
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      try {
        const ctx = new Context(); audio = ctx;
        await ctx.resume();
        if (audio !== ctx) return;
        const sketches = [
          [[0,123,.32],[.43,262,.18],[.69,330,.18],[.95,392,.22],[1.34,523,.22],[1.66,659,.22],[1.98,784,.32]],
          [[.2,188,.45],[.9,92,.5],[1.4,78,.48],[1.88,62,.55]],
          [[.1,1400,.025],[.18,124,.44],[1.05,1400,.025],[1.13,124,.44]]
        ];
        const marks = sketches[selected], start = ctx.currentTime + .05;
        marks.forEach(([when, frequency, duration], n) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain(), t = start + when;
          osc.type = selected === 0 ? 'sine' : 'triangle';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(.001, t);
          gain.gain.exponentialRampToValueAtTime(selected === 1 ? .12 / (1+n*.28) : .095, t+.01);
          gain.gain.exponentialRampToValueAtTime(.001, t+duration);
          osc.connect(gain).connect(ctx.destination);
          if (n === marks.length-1) osc.onended = () => { if (audio === ctx) stop(); };
          osc.start(t); osc.stop(t+duration+.02);
        });
        lamps.classList.add('tr-playing');
      } catch { stop(); }
    }, 'tr-action');
    picker(box, ['Canal A','Canal B','Canal C'], i => { stop(); selected = i; record.textContent = parts[i]; });
    const controls = el('div','tr-picks');
    if (window.AudioContext || window.webkitAudioContext) controls.append(play,button('Detener',stop,'tr-action'));
    box.append(lamps,record,controls);
    return {node:box,stop};
  }
  function signalMap(item, title, guide) {
    const lines = item.body.split(/\r?\n/).filter(line => /[→↔]/.test(line));
    if (!lines.length) return;
    const box = instrument(title,guide), result = el('p','tr-socket');
    picker(box,lines.map(row => row.split(/[→↔]/)[0].trim()),i => {result.textContent=lines[i];});
    box.append(result);
    return box;
  }
  const enhanced = {
    billetes:tickets,
    carteles:routes,
    contacto:negative,
    marcas:timeTool,
    ediciones:item=>archive(item,'Archivo de carteles','Saca un aviso para comprobar en qué lugar se podía leer.'),
    escaparates:item=>archive(item,'Catálogo de escaparates','Gira las fichas del catálogo y contrasta sus superficies con el negativo.'),
    fuentes:item=>archive(item,'Álbum de procedencias','Levanta una etiqueta para ver la fuente que sostiene esa anotación.',true),
    tomas:radioMonitor,
    manual:item=>signalMap(item,'Selector de entradas','Sigue cada entrada desde el conector hasta su destino.'),
    partes:item=>archive(item,'Cajón de partes','Extrae una fecha y lee el cambio registrado en el parte de ese día.'),
    inventario:item=>archive(item,'Balda de bobinas','Abre las fichas y compara las marcas de entrada, borde y salida.'),
    capas:item=>archive(item,'Lector de fragmentos','Desplaza el cabezal de T1 a T4 para consultar luz y contenido.',true),
    escaleta:item=>archive(item,'Marcas de continuidad','Lee las horas de cada marca de control antes de montar el saludo.',true),
    matriz:item=>signalMap(item,'Banco de conexiones','Escoge un origen y sigue la conexión física hasta el retorno o la antena.')
  };
  function mountArchive({stage,index,caseId,shelf}) {
    const src = foto(caseId,index);
    if (!src || shelf.dataset.trMounted) return;
    shelf.dataset.trMounted = prefix(caseId);
    const materials = new Map((stage.materials||[]).map(item => [String(item.id),item]));
    // Only the base shelf's projected cards receive inspectors. Its role filters stay authoritative.
    for (const card of shelf.querySelectorAll('.vhour-material')) {
      const item = materials.get(card.dataset.material);
      if (!item) continue;
      const summary = card.querySelector('summary');
      const thumb = summary?.querySelector('.vhour-format-photo');
      if (thumb) { thumb.classList.add('tr-photo'); thumb.style.backgroundImage = 'url("' + src + '")'; }
      const view = enhanced[item.id]?.(item);
      if (!view || !summary) continue;
      const pane = view.node || view, originals = [...card.children].filter(n => n !== summary);
      const record = el('details','tr-transcript');
      record.append(el('summary','','Consultar el documento original'), ...originals);
      card.append(pane,record);
      if (view.stop) card.addEventListener('toggle',()=>{if (!card.open) view.stop();});
    }
  }

  function mountDecision({field,stage,index,caseId,selected,change}) {
    const meta = mesas[caseId]?.[index], options = stage.options || [];
    if (!meta || !options.length || !['single','multi','order'].includes(stage.mode)) return false;
    const isRadio = Number(caseId) === 4, ordering = stage.mode === 'order', single = stage.mode === 'single';
    const panel = el('section','tr-bench'), cover = el('header','tr-cover'), image = el('img'), caption = el('div');
    panel.dataset.world=prefix(caseId); panel.dataset.step=String(index+1);
    image.src=foto(caseId,index);image.alt='';image.loading='lazy';
    caption.append(el('h5','',meta[0]), el('p','',meta[1]));cover.append(image,caption);
    const choices = el('div','tr-choices'), draft = el('div','tr-draft'), receipt = live('tr-count');
    const list = el(ordering?'ol':'ul','tr-mounts'), marks = new Map();
    const max = Number.isInteger(stage.requiredCount) ? stage.requiredCount : null;
    const byId = new Map(options.map(option=>[option.id,option]));
    function refresh() {
      for (const [id,b] of marks) {
        const at=selected.indexOf(id);
        b.setAttribute('aria-pressed',String(at!==-1));
        b.dataset.selected=at!==-1?'yes':'no';
        b.querySelector('.tr-mark').textContent=at===-1?'+':ordering?String(at+1):'✓';
      }
      list.replaceChildren(...selected.map((id,i)=>{
        const option=byId.get(id),row=el('li','tr-mounted'), remove=button('Retirar',()=>toggle(option),'tr-remove');
        remove.setAttribute('aria-label','Retirar '+option.label);
        row.append(el('span','',option.label),remove);
        if(ordering)row.dataset.rank=String(i+1);
        return row;
      }));
      const count=selected.length;
      let line=count ? (count===1?'1 pieza colocada':count+' piezas colocadas') : 'Mesa vacía';
      if (ordering && max) line+=' · '+count+' de '+max;
      if (isRadio && index===3) {
        const seconds=selected.reduce((sum,id)=>sum+Number(byId.get(id).label.match(/(\d+)\s*segundo/)?.[1]||0),0);
        line+=' · '+seconds+' s de montaje';
      }
      receipt.textContent=line;
      change();
    }
    function toggle(option) {
      const at=selected.indexOf(option.id);
      if(at!==-1) selected.splice(at,1);
      else if(single) selected.splice(0,selected.length,option.id);
      else if(max && selected.length>=max) {
        receipt.textContent='Retira una pieza antes de colocar otra.';return;
      } else selected.push(option.id);
      refresh();
    }
    function patchPanel() {
      const connections=options.map(option=>{
        const match=option.label.match(/^(?:Voz del (padre)|(?:Voz|Dedicatoria) de la (hija)).*?\b(P1|P2|C)\b/i);
        return match && {option,source:match[1]?'Padre':'Hija',socket:match[3].toUpperCase()};
      });
      if(connections.some(entry=>!entry)) return false;
      const sources=el('div','tr-patch'),jacks=el('div','tr-patch');
      let chosenSource=null;
      const sourceButtons=new Map(),jackButtons=new Map();
      const instruction=live('tr-reading');
      function choose(source) {
        chosenSource=source;
        for(const [name,b] of sourceButtons)b.setAttribute('aria-pressed',String(name===source));
        for(const [jack,b] of jackButtons)b.disabled=!connections.some(r=>r.source===source && r.socket===jack);
        instruction.textContent='Origen seleccionado · '+source+'. Elige el destino del cable.';
      }
      for(const name of [...new Set(connections.map(r=>r.source))]){
        const b=button(name,()=>choose(name),'tr-source');sourceButtons.set(name,b);sources.append(b);
      }
      for(const name of ['P1','P2','C']){
        const b=button(name==='C'?'C · antena':name+' · retorno',()=>{
          const route=connections.find(r=>r.source===chosenSource && r.socket===name);
          if(!route)return;
          toggle(route.option);
          instruction.textContent=(selected.includes(route.option.id)?'Cable tendido. ':'Cable retirado. ')+route.option.label;
        },'tr-jack');
        b.disabled=true;jackButtons.set(name,b);jacks.append(b);
      }
      instruction.textContent='Elige una voz de origen y después una toma de destino.';
      choices.classList.add('tr-patchboard');choices.append(el('h6','','Origen'),sources,el('h6','','Destino'),jacks,instruction);
      return true;
    }
    function dateRegister() {
      const entries=options.map(option=>{
        const match=option.label.match(/A el (.+?) y B el (.+?)\.?$/i);
        return match && {option,a:match[1],b:match[2]};
      });
      if(entries.some(entry=>!entry))return false;
      const slips=el('div','tr-slips'),inputs={};
      for(const key of ['a','b']){
        const label=el('label','tr-date','Línea '+key.toUpperCase());
        const input=el('select');
        input.append(el('option','','Elige una fecha'));
        input.options[0].value='';
        for(const value of [...new Set(entries.map(entry=>entry[key]))]){
          input.append(el('option','',value));
        }
        label.append(input);slips.append(label);inputs[key]=input;
      }
      const note=live('tr-reading');
      const stamp=button('Sellar la ficha de archivo',()=>{
        const r=entries.find(entry=>entry.a===inputs.a.value&&entry.b===inputs.b.value);
        if(!r){note.textContent='El archivo no contiene esa pareja de fechas. Prueba otra combinación.';return;}
        selected.splice(0,selected.length,r.option.id);refresh();note.textContent='Ficha preparada para contrastar.';
      },'tr-source');
      const update=()=>{
        if(selected.length){selected.length=0;refresh();}
        note.textContent='';stamp.disabled=!inputs.a.value||!inputs.b.value;
      };
      for(const input of Object.values(inputs))input.addEventListener('change',update);
      stamp.disabled=true;choices.classList.add('tr-datebox');choices.append(slips,stamp,note);
      return true;
    }
    const machine=isRadio && ((index===4 && patchPanel()) || (index===1 && dateRegister()));
    if(!machine) for(const option of options) {
      const pick=button('',()=>toggle(option),'tr-piece');
      const mark=el('span','tr-mark','+');mark.setAttribute('aria-hidden','true');
      pick.dataset.vhValue=option.id;
      pick.setAttribute('aria-label',meta[2]+'. '+option.label);
      pick.append(mark,el('span','',option.label)); choices.append(pick);marks.set(option.id,pick);
    }
    draft.append(receipt,list);panel.append(cover,choices,draft);field.append(panel);
    refresh();return true;
  }
  window.ArchivosDeCaso ||= {};
  window.MesasDeCaso ||= {};
  window.EscenasDeCaso ||= {};
  for(const id of [3,4]){
    window.ArchivosDeCaso[id]=mountArchive;
    window.MesasDeCaso[id]=mountDecision;
    window.EscenasDeCaso[id]=index=>foto(id,index);
  }
})();
