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
    for(const line of item.body.split(/\r?\n/).filter(s=>s.trim()&&!s.includes('|')))box.append(el('p','tr-guide',line));
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
    const headings=skipHeading?observations.shift():null;
    if (!observations.length) return;
    const box = instrument(title, guide), sheet = el('div', 'tr-record'), label = el('strong'), notes = el('p');
    sheet.append(label, notes);
    picker(box, observations.map(row => row[0]), i => {
      label.textContent = observations[i][0];
      notes.textContent = observations[i].slice(1).map((value,j)=>headings?.[j+1]?headings[j+1]+' · '+value:value).join('\n');
    });
    box.append(sheet);
    for(const line of item.body.split(/\r?\n/).filter(s=>s.trim()&&!s.includes('|')))box.append(el('p','tr-guide',line));
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
    for(const line of item.body.split(/\r?\n/).filter(s=>s.trim()&&!lines.includes(s)))box.append(el('p','tr-guide',line));
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
    ensayos:item=>archive(item,'Fichero de efectos','Saca una ficha y coteja el sonido con las líneas de la grabación.'),
    partes:item=>archive(item,'Cajón de partes','Extrae una fecha y lee el cambio registrado en el parte de ese día.'),
    inventario:item=>archive(item,'Balda de bobinas','Abre las fichas y compara las marcas de entrada, borde y salida.'),
    capas:item=>archive(item,'Lector de fragmentos','Desplaza el cabezal de T1 a T4 para consultar luz y contenido.',true),
    escaleta:item=>archive(item,'Marcas de continuidad','Lee las horas de cada marca de control antes de montar el saludo.',true),
    cortes:item=>archive(item,'Estuche de canutillos','Elige una pieza para consultar duración y función en el saludo.'),
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
      if (!summary) continue;
      const view=enhanced[item.id]?.(item);
      const originals=[...card.children].filter(n=>n!==summary);
      const scene=el('img','tr-object-photo');scene.alt='';scene.loading='lazy';scene.src=src;
      summary.after(scene);
      if(!view)continue;
      const pane=view.node||view;
      if(item.id==='contacto'){
        // The frame is a working reconstruction. Keep the full photographer's description intact.
        card.append(pane);
      }else if(item.id==='tomas'){
        // The channel selector includes every word of the transcript; retain native playback controls.
        card.querySelector('[data-game-transcript]')?.remove();
        card.append(pane);
      }else{
        originals.forEach(n=>n.remove());card.append(pane);
      }
      if(view.stop)card.addEventListener('toggle',()=>{if(!card.open)view.stop();});
    }
  }

  // The two witnesses own complementary documents. Solo investigators carry both folders.
  const trainDrafts=new WeakMap();
  const compartments=[
    {name:'El doble fondo de la maleta',minutes:10,job:'Perfora tres casillas del resguardo, en el orden del viaje. El patrón libera el cierre de la maleta.',a:'Itinerario cosido al forro · Primero el embarcadero, después el molino y por último el mercado. Una mancha tapa las coordenadas.',b:'Índice de encomiendas · Mercado: fila C, asiento 2. Molino: fila A, asiento 4. Taller: fila A, asiento 2. Embarcadero: fila B, asiento 1. Aduana: fila B, asiento 3.',hint:'Una carpeta da el orden de las paradas y la otra convierte cada nombre en fila y asiento.',reward:'El forro cede. Dentro hay un libro con la silueta de un billete en la guarda. Contrasta esa huella con los cuatro billetes del expediente.'},
    {name:'El enclavamiento de las agujas',minutes:12,job:'Traza la maniobra del coche postal desde la entrada hasta el andén. Pulsa las estaciones del plano en orden.',a:'Orden del jefe de tren · Entra por Norte y recoge el saco en Taller. No pases por Patio: allí esperan los viajeros. Termina en Andén.',b:'Parte de vías · La aguja Taller–Andén está inmovilizada. Desde Taller solo puedes salir por Puente. La vía de Puente conduce a Andén.',hint:'Comprueba tanto la parada obligatoria como la aguja clausurada antes de trazar el camino.',reward:'El coche postal queda en vía libre. En el cajetín aparece el plano de transbordos. Averigua desde qué recorrido pudo verse cada aviso.'},
    {name:'La ventana del fotógrafo',minutes:13,job:'Reconstruye la placa de registro en el visor. Decide qué marco invertir, orienta la muesca y elige el filtro que revela la marca de inventario.',a:'Nota del fotógrafo · La cartulina exterior se lee tal como fue impresa. Solo la imagen tomada a través del cristal está en espejo. La muesca quedó orientada hacia la puerta.',b:'Leyenda al dorso del visor · La puerta estaba al oeste. En la prueba azul, la marca de inventario quedaba velada. En la ámbar se distinguía del fondo.',hint:'Combina tres decisiones independientes: qué inviertes, dónde queda la muesca y qué filtro usas.',reward:'Las guías encajan. En una copia reflejada, el borde y la imagen pueden contar historias distintas. Examina ahora el negativo original de la cita.'},
    {name:'Los tres relojes del furgón',minutes:12,job:'Ajusta las tres esferas a la hora real de paso. Las fichas del relojero expresan cuánto se adelantaba o atrasaba cada máquina.',a:'Hoja del convoy · Lecturas anotadas, sin corregir: Taquilla 20:56 · Andén 21:03 · Furgón 21:06.',b:'Taller de precisión · El reloj de Taquilla adelanta cuatro minutos. El de Andén atrasa dos. El del Furgón adelanta un minuto. Dos sucesos pudieron ocurrir a la vez.',hint:'Un reloj que adelanta señala una hora posterior a la real. Corrige cada esfera por separado.',reward:'Dos relojes coinciden después del ajuste. Una hora impresa solo sirve si sabes qué máquina la marcó. Aplica ese criterio a los sellos del trayecto.'},
    {name:'La carta bajo el asiento',minutes:13,job:'Cose los cinco retales siguiendo los bordes que encajan. Hay un sexto recorte de otra carta. El sello postal debe quedar al final.',a:'Inventario del borde izquierdo · Olivo: margen limpio. Llave: diente corto. Luna: onda doble. Faro: pico. Puerta: escalón. Puente: media luna.',b:'Inventario del borde derecho · Puerta: sello postal. Faro: escalón. Llave: onda doble. Puente: doble pico. Olivo: diente corto. Luna: pico.',hint:'Empieza por el margen limpio. Busca a qué borde izquierdo corresponde la rotura derecha de cada retal.',reward:'«Si llegas después que yo, mira debajo del asiento. Dejé allí lo único que no quise perder: tu carta». La nota explica una intención. Queda contrastarla con lo que el álbum documenta.'}
  ];
  function trainCompartment(index,role,controller,onOpen){
    const spec=compartments[index];
    let drafts=trainDrafts.get(controller);
    if(!drafts){drafts=new Map();trainDrafts.set(controller,drafts);}
    let state=drafts.get(index);
    if(!state){state={sequence:[],dials:[0,0,0],open:false};drafts.set(index,state);}
    const box=el('section','rail-lock');box.dataset.chapter=String(index+1);
    const heading=el('header','rail-head');
    const intro=el('div','rail-intro');intro.append(el('small','','Coche postal · '+spec.minutes+' min de investigación · Aventura de 60 min'),el('h4','',spec.name),el('p','',spec.job));
    const illustration=el('img','rail-still');illustration.src=foto(3,index);illustration.alt='';heading.append(illustration,intro);
    const folders=el('div','rail-folders');
    const assigned=({'1':'A','2':'B',A:'A',B:'B'})[role];
    const pair=controller.role&&assigned;
    for(const [paper,name,clue] of [['A','Cuaderno de la viajera',spec.a],['B','Archivo del pasajero',spec.b]]){
      if(pair&&paper!==assigned)continue;
      const file=el('details','rail-paper');file.append(el('summary','','Papel '+(paper==='A'?'1':'2')+' · '+name),el('p','',clue));folders.append(file);
    }
    const invitation=el('p','rail-brief',pair?'Abre tu carpeta y describe sus marcas a tu pareja. Necesitáis los dos documentos para accionar el mecanismo.':'Llevas las dos carpetas. Abre cada una y cruza sus indicios en el mecanismo.');
    const board=el('div','rail-board');const progress=live('rail-feedback');
    const help=el('details','rail-hint');help.append(el('summary','','Una pista de observación'),el('p','',spec.hint));
    const controls=el('div','rail-actions');
    const targets=[['B1','A4','C2'],['Norte','Taller','Puente','Andén'],[1,3,1],[-4,2,-1],['Olivo','Llave','Luna','Faro','Puerta']];
    const target=targets[index],dial=index===2||index===3;
    const read=()=>dial?state.dials:state.sequence;
    const same=()=>read().length===target.length&&read().every((v,i)=>v===target[i]);
    function add(value){
      if(state.sequence.includes(value)){progress.textContent='Esa pieza ya está colocada. Puedes deshacer el último movimiento.';return;}
      if(state.sequence.length>=target.length){progress.textContent='El soporte está lleno. Deshaz el último movimiento para cambiarlo.';return;}
      state.sequence.push(value);paint();
    }
    function action(label,run){return button(label,event=>{const controls=[...board.querySelectorAll('button')];const pos=controls.indexOf(event.currentTarget);run();if(pos>=0&&!event.currentTarget.isConnected){const next=board.querySelectorAll('button')[pos];if(next&&!next.disabled)next.focus({preventScroll:true});}},'rail-key');}
    function remove(){state.sequence.pop();paint();}
    const undo=action('Deshacer el último movimiento',remove);
    const check=action('Probar el mecanismo',()=>{
      if(!same()){progress.textContent=['Los pernos no caen en las tres perforaciones. Revisa orden, fila y asiento.','La señal sigue roja. Revisa la parada del saco y el desvío de la vía bloqueada.','Las marcas del registro no coinciden. Comprueba el cristal, la muesca y el filtro.','El registro sigue desfasado. Contrasta el signo de cada corrección.','La costura se interrumpe. Comprueba el borde de salida y el de entrada de cada pareja.'][index];return;}
      state.open=true;unseal();
    });controls.append(undo,check);
    function unseal(){board.hidden=true;controls.hidden=true;help.hidden=true;progress.textContent=spec.reward;box.dataset.open='true';onOpen();}
    function paint(){
      board.replaceChildren();progress.textContent='';undo.hidden=dial;undo.disabled=!state.sequence.length;
      const picks=el('div','rail-pieces');
      const put=(label,value)=>{const key=action(label,()=>add(value));const rank=state.sequence.indexOf(value);key.setAttribute('aria-pressed',String(rank>=0));if(rank>=0)key.append(el('small','',' · '+(rank+1)));picks.append(key);};
      if(index===0){
        picks.classList.add('rail-punch');for(const row of ['A','B','C'])for(const seat of [1,2,3,4])put(row+seat,row+seat);
      }else if(index===1){
        const stations=[['Norte',9,50],['Taller',36,22],['Patio',36,80],['Puente',65,22],['Andén',90,50]];
        const links=[[0,1],[0,2],[1,2],[1,3],[1,4],[2,4],[3,4]];
        const map=el('div','rail-map');const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
        for(const [from,to] of links){const line=document.createElementNS(ns,'line');for(const [attr,val] of [['x1',stations[from][1]],['y1',stations[from][2]],['x2',stations[to][1]],['y2',stations[to][2]]])line.setAttribute(attr,val);const pos=state.sequence.indexOf(stations[from][0]),next=state.sequence.indexOf(stations[to][0]);line.setAttribute('class',pos>=0&&next>=0&&Math.abs(pos-next)===1?'used':'');svg.append(line);}map.append(svg);
        for(const [name,x,y] of stations){const key=action(name,()=>{const last=state.sequence.at(-1);const i=stations.findIndex(s=>s[0]===last),j=stations.findIndex(s=>s[0]===name);if(last&&!links.some(([a,b])=>(a===i&&b===j)||(a===j&&b===i))){progress.textContent='No hay vía directa entre esas dos estaciones.';return;}add(name);});key.style.left=x+'%';key.style.top=y+'%';key.setAttribute('aria-pressed',String(state.sequence.includes(name)));map.append(key);}board.append(map);
      }else if(index===2){
        const slide=el('div','rail-glass');slide.dataset.filter=String(state.dials[2]);
        const print=el('img');print.src=foto(3,2);print.alt='Placa del archivo fotográfico';print.style.transform=state.dials[0]===1?'scaleX(-1)':'none';
        const edge=el('span','rail-notch','▲');edge.style.transform='rotate('+state.dials[1]*90+'deg)';slide.append(print,edge,el('b','','N.º 08 · REGISTRO'));board.append(slide);
        const choices=[['Cristal directo','Cristal invertido'],['Muesca norte','Muesca este','Muesca sur','Muesca oeste'],['Filtro azul','Filtro ámbar','Filtro rojo']];
        choices.forEach((opts,k)=>picks.append(action(opts[state.dials[k]],()=>{state.dials[k]=(state.dials[k]+1)%opts.length;paint();})));
      }else if(index===3){
        const names=['Taquilla','Andén','Furgón'];[1256,1263,1266].forEach((base,k)=>{const unit=el('div','rail-clock');const mins=base+state.dials[k];const value=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');unit.append(el('b','',names[k]),el('output','',value));for(const delta of [-1,1]){const key=action(delta<0?'−1 min':'+1 min',()=>{state.dials[k]+=delta;paint();});key.setAttribute('aria-label',names[k]+(delta<0?' restar':' sumar')+' un minuto');key.disabled=Math.abs(state.dials[k]+delta)>9;unit.append(key);}picks.append(unit);});
      }else{picks.classList.add('rail-scraps');for(const name of ['Faro','Olivo','Puente','Puerta','Luna','Llave'])put(name,name);}
      board.append(picks);if(!dial){board.append(el('output','rail-strip',state.sequence.length?state.sequence.join(' → '):'Sin piezas colocadas'));}
      check.disabled=!dial&&state.sequence.length!==target.length;
    }
    box.append(heading,invitation,folders,board,controls,help,progress);paint();if(state.open)unseal();return box;
  }

  function mountDecision({field,stage,index,caseId,selected,change,role,controller}) {
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
    draft.append(receipt,list);panel.append(cover,choices,draft);
    if(Number(caseId)===3){
      panel.hidden=true;
      field.append(trainCompartment(index,role,controller,()=>{panel.hidden=false;}));
    }
    field.append(panel);
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
