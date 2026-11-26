(() => {
  'use strict';

  function element(tag, value, className) {
    const item = document.createElement(tag);
    if (value !== undefined) item.textContent = value;
    if (className) item.className = className;
    return item;
  }

  function control(label, action, key, disabled = false) {
    const item = element('button', label, 'pieza');
    item.type = 'button';
    item.disabled = disabled;
    if (key) item.dataset.control = key;
    item.addEventListener('click', action);
    return item;
  }

  function region(className, ...children) {
    const area = element('div', undefined, className);
    area.append(...children);
    return area;
  }

  function paint(host, ...children) {
    const focusKey = host.contains(document.activeElement) ? document.activeElement.dataset.control : '';
    host.replaceChildren(...children);
    if (!focusKey) return;
    const target = Array.from(host.querySelectorAll('[data-control]')).find(item => item.dataset.control === focusKey && !item.disabled);
    (target || host.querySelector('button:not([disabled]),select'))?.focus({preventScroll: true});
  }

  function status(text) {
    const item = element('p', text, 'estado');
    item.setAttribute('role', 'status');
    return item;
  }

  const railMaps = [['....', '.##.', '..#.', '....'], ['.#..', '...#', '#...', '..#.']];
  const targets = [15, 0];
  const directions = [['Norte', -1, 0], ['Sur', 1, 0], ['Oeste', 0, -1], ['Este', 0, 1]];
  const coord = index => 'ABCD'[index % 4] + (Math.floor(index / 4) + 1);

  function railMove(index, map, rowStep, colStep) {
    const row = Math.floor(index / 4) + rowStep;
    const col = index % 4 + colStep;
    if (row < 0 || row > 3 || col < 0 || col > 3 || map[row][col] === '#') return index;
    return row * 4 + col;
  }

  function railTable(era, position, map, target) {
    const table = element('table');
    table.append(element('caption', era + ' · vagoneta en ' + coord(position) + ' · destino ' + coord(target)));
    const head = element('tr');
    for (const letter of ['Fila', 'A', 'B', 'C', 'D']) head.append(element('th', letter));
    table.append(head);
    map.forEach((line, r) => {
      const tr = element('tr');
      tr.append(element('th', String(r + 1)));
      [...line].forEach((character, c) => {
        const index = r * 4 + c;
        const label = index === position ? 'V' : index === target ? 'M' : character === '#' ? '×' : '·';
        const td = element('td', label);
        td.setAttribute('aria-label', coord(index) + ', ' + (index === position ? 'vagoneta' : index === target ? 'muelle' : character === '#' ? 'muro' : 'vía libre'));
        if (index === position || index === target) td.style.fontWeight = 'bold';
        tr.append(td);
      });
      table.append(tr);
    });
    return table;
  }

  function railway(host, win) {
    let positions = [0, 15], history = [], done = false;
    let notice = '1996 espera en A1; 2026 espera en D4.';
    function move(label, dr, dc) {
      const next = positions.map((value, era) => railMove(value, railMaps[era], dr, dc));
      if (next.every((value, era) => value === positions[era])) {
        notice = 'Las dos están bloqueadas hacia el ' + label.toLowerCase() + '. Prueba otra dirección.';
      } else {
        history.push(positions);
        positions = next;
        notice = '1996 en ' + coord(next[0]) + '. 2026 en ' + coord(next[1]) + '.';
      }
      done = positions.every((value, era) => value === targets[era]);
      if (done) notice = 'Los dos muelles reciben su correo en el mismo instante. Reto resuelto.';
      draw();
      if (done) win();
    }
    function draw() {
      const maps = region('opciones', ...railMaps.map((map, i) => railTable(i ? '2026' : '1996', positions[i], map, targets[i])));
      const moves = directions.map(([label, dr, dc]) => control(label, () => move(label, dr, dc), label, done));
      const undo = control('Deshacer movimiento', () => {
        positions = history.pop(); notice = 'Has vuelto una maniobra atrás.'; draw();
      }, 'atras', done || !history.length);
      paint(host, element('p', 'El mismo mando mueve dos vagonetas a través del tiempo. Lleva la de 1996 a D4 y la de 2026 a A1. Deben llegar a la vez. Si una encuentra un muro o el borde, espera mientras la otra avanza. Aprovecha esas paradas.'),
        element('p', 'V = vagoneta · M = muelle de destino · × = muro · punto = vía libre. El norte queda arriba.'), maps,
        region('opciones', ...moves, undo), status(notice));
    }
    draw();
  }

  const guests = ['Luisa', 'Carmen', 'Jon', 'Ivo', 'Vega', 'Vacía'];
  const hotelRules = [
    {text: 'Luisa duerme justo encima de Carmen.', names: ['Luisa','Carmen'], ok: (l,c) => l === c + 3},
    {text: 'Carmen pide una ventana que no dé a la calle.', names: ['Carmen'], ok: c => c % 3 !== 0},
    {text: 'Jon e Ivo quieren puertas contiguas en la misma planta para desayunar juntos.', names: ['Jon','Ivo'], ok: (j,i) => (j <= 3) === (i <= 3) && Math.abs(j - i) === 1},
    {text: 'Ivo se despierta con el reloj; pide una ventana de la columna central.', names: ['Ivo'], ok: i => i % 3 === 2},
    {text: 'Desde su ventana, Vega ve la de Jon en diagonal: otra planta y una columna de distancia.', names: ['Vega','Jon'], ok: (v,j) => (v <= 3) !== (j <= 3) && Math.abs((v - 1) % 3 - (j - 1) % 3) === 1},
    {text: 'La habitación vacía está arriba y su ventana no da al reloj.', names:['Vacía'], ok: e => e > 3 && e % 3 !== 2}
  ];
  const roomNames=['1 · baja, patio','2 · baja, reloj','3 · baja, calle','4 · alta, patio','5 · alta, reloj','6 · alta, calle'];

  function hotel(host, win) {
    const sheet = Array(6).fill('');
    let notice = 'El libro de huéspedes está abierto.', done = false;
    function draw() {
      const rules = element('ul');
      hotelRules.forEach(rule => rules.append(element('li', rule.text)));
      const board = element('div', undefined, 'tablero');
      roomNames.forEach((room, index) => {
        const label = element('label', 'Habitación ' + room + ' ');
        const select = element('select');
        select.dataset.control = 'room' + index;
        select.disabled = done;
        for (const guest of ['', ...guests]) {
          const option = element('option', guest || 'Sin asignar');
          option.value = guest;
          select.append(option);
        }
        select.value = sheet[index];
        select.addEventListener('change', () => {
          const name = select.value, prior = sheet.indexOf(name);
          if (name && prior >= 0 && prior !== index) sheet[prior] = sheet[index];
          sheet[index] = name;
          notice = name ? 'Asignación anotada. Puedes revisar el reparto cuando quieras.' : 'La habitación está sin asignar.';
          draw();
        });
        label.append(select);
        board.append(label, element('br'));
      });
      const review = control('Revisar el reparto', () => {
        const rooms = Object.fromEntries(sheet.map((guest,i) => [guest,i+1]));
        const contradicted = hotelRules.filter(rule => rule.names.every(n => rooms[n]) && !rule.ok(...rule.names.map(n => rooms[n])));
        if (contradicted.length) notice = 'El reparto contradice esta nota de recepción: «' + contradicted[0].text + '»';
        else if (sheet.includes('')) notice = 'Las asignaciones actuales son compatibles. Completa las seis habitaciones, incluida la vacía.';
        else {notice = 'Cinco huéspedes duermen donde pidieron. La sexta habitación queda lista para el turno de mañana.'; done = true;}
        draw();
        if (done) win();
      }, 'revisar', done);
      paint(host, element('p', 'El relevo de recepción dejó seis notas y ninguna reserva asignada. Reparte a cinco huéspedes y marca una habitación como vacía. Si mueves a alguien a una habitación ocupada, intercambia su sitio con el ocupante anterior.'), rules, board, review, status(notice));
    }
    draw();
  }

  const memories = [
    ['mapa', 'puente', 'El borde doblado', 'Doblas el mapa por la esquina que huele a río.'],
    ['mercado', 'reloj', 'El puesto de membrillos', 'En el puesto regalan el último membrillo a quien sepa qué hora es.'],
    ['lluvia', 'mapa', 'Una esquina seca', 'Bajo el toldo encuentras un callejero con dos calles inventadas.'],
    ['puente', 'amanecer', 'La última farola', 'Al otro lado del puente se apaga la última farola.'],
    ['cine', 'faro', 'La pantalla blanca', 'En la pantalla del cine, alguien confunde un faro con la luna.'],
    ['mapa', 'cine', 'Sesión doble', 'Hay un cine minúsculo dibujado donde debería estar la plaza.'],
    ['reloj', 'puente', 'Cinco minutos más', 'Atrasáis el reloj para que el puente os dure cinco minutos más.'],
    ['faro', 'mapa', 'Una costa de bolsillo', 'Dibujas en la palma de una mano la costa que alumbra el faro.'],
    ['puente', 'mercado', 'Los toldos naranjas', 'Desde la barandilla del puente se ven las luces del mercado.']
  ];

  function conversation(host, win) {
    let log = [], motif = 'lluvia', done = false;
    const otherEnd = (card, current) => card[0] === current ? card[1] : card[0];
    function draw() {
      const used = log.map(turn => turn.index);
      const open = memories.some((card,i) => !used.includes(i) && card.slice(0,2).includes(motif));
      const cards = memories.map((card, i) => control(card[2] + ' · ' + card[0] + ' / ' + card[1] + (used.includes(i) ? ' · contada' : ''), () => {
        log.push({index: i, from: motif});
        motif = otherEnd(card, motif);
        done = log.length === memories.length && motif === 'amanecer';
        draw();
        if (done) win();
      }, 'carta'+i, done || used.includes(i) || !card.slice(0,2).includes(motif)));
      const undo = control('Volver una anécdota atrás', () => {
        motif = log.pop().from; draw();
      }, 'volver', done || !log.length);
      const diary = element('ol');
      log.forEach(turn => diary.append(element('li',memories[turn.index][3])));
      const message = done ? 'Amanece cuando termina vuestra última anécdota. El paseo queda escrito.' :
        !open ? 'La conversación se ha quedado sin salida. Retrocede y reserva esta despedida para más tarde.' :
        'Próxima palabra: '+motif+'. Anécdotas guardadas: '+log.length+' de '+memories.length+'.';
      paint(host, element('p','Inventad un paseo con nueve tarjetas de recuerdos. Empezáis bajo la lluvia y os despedís al amanecer. Cada tarjeta tiene dos motivos: entra por el que coincide con la palabra actual y sal por el otro. Usadlas todas una vez. Si sois dos, alternad quién elige la siguiente.'), status(message), region('opciones', ...cards), undo, diary);
    }
    draw();
  }

  const mixCases = [
    {name:'Sintonía de guardia', tracks:[[0,1,4],[0,3],[1,5,7]], solution:[2,5,1]},
    {name:'Cierre de madrugada', tracks:[[0,2,3],[1,4,6],[0,1]], solution:[6,2,4]}
  ];
  function mix(tracks, phases) {
    const pulses = Array(8).fill(0);
    tracks.forEach((track,i) => track.forEach(beat => {pulses[(beat + phases[i]) % 8] += 1;}));
    return pulses;
  }
  const trackNames = ['Péndulo', 'Marimba', 'Claqueta'];
  function mixer(host, win) {
    let page=0, phases=[0,0,0], notice='', finished=false, audio=null;
    const listen = async levels => {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw Error('Audio no disponible');
        if(audio) await audio.close().catch(()=>{});
        const current = new Audio();
        audio=current;
        await current.resume();
        const start=current.currentTime+.06;
        levels.forEach((level, beat) => {
          if (!level) return;
          const osc=current.createOscillator(), gain=current.createGain(), t=start+beat*.31;
          osc.frequency.value=[0,330,495,660][level]; gain.gain.setValueAtTime(0,t);
          gain.gain.linearRampToValueAtTime(.12,t+.012); gain.gain.exponentialRampToValueAtTime(.001,t+.20);
          osc.connect(gain); gain.connect(current.destination); osc.start(t); osc.stop(t+.22);
        });
        window.setTimeout(() => { if (audio===current) {current.close().catch(()=>{}); audio=null;} },2700);
      } catch { notice='Puedes completar la señal comparando las dos filas numéricas.'; draw(); }
    };
    function draw() {
      const sequence=mixCases[page], current=mix(sequence.tracks,phases), target=mix(sequence.tracks,sequence.solution);
      const detail=element('div',undefined,'tablero');
      sequence.tracks.forEach((track,i) => {
        const hits=track.map(b=>(b+phases[i])%8+1).sort((a,b)=>a-b);
        const row=region('opciones',element('strong',trackNames[i]+' · pulsos '+hits.join(', ')));
        [-1,1].forEach(step=>row.append(control((step<0?'Adelantar ':'Retrasar ')+trackNames[i],()=>{
          phases[i]=(phases[i]+step+8)%8; notice=''; draw();
        },'dial'+i+(step<0?'a':'r'),finished)));
        detail.append(row);
      });
      const check=control(page===0?'Guardar primera mezcla':'Guardar segunda mezcla',()=>{
        if(current.some((n,i)=>n!==target[i])) {notice='La señal todavía difiere en '+current.filter((n,i)=>n!==target[i]).length+' pulsos.';draw();return;}
        if(page===0){page=1;phases=[0,0,0];notice='Primera sintonía guardada. Falta la despedida de madrugada.';draw();}
        else {finished=true;notice='Las dos sintonías vuelven a sonar. La emisora os guarda la cinta maestra.';draw();win();}
      },'guardar',finished);
      paint(host, element('p','Restaura dos sintonías de ocho pulsos. Cada canal repite un bucle: sus golpes se suman cuando coinciden. Desplaza los tres canales hasta que el número de golpes de cada pulso coincida con la grabación de referencia. Al pasar del 8, el bucle vuelve al 1.'),
        element('h4',sequence.name+' · '+(page+1)+' de 2'),
        element('p','Referencia · '+target.join('  ·  ')),element('p','Tu mezcla · '+current.join('  ·  ')),
        region('opciones',control('Escuchar referencia',()=>listen(target),'ref'),control('Escuchar mi mezcla',()=>listen(current),'actual')),
        detail,check,status(notice || 'De izquierda a derecha: pulsos 1 a 8. Un cero representa silencio.'));
    }
    draw();
  }

  Object.assign(window.Retos, {
    1:{title:'Dos vagonetas, un mando',pitch:'En la maqueta del museo están las vías de 1996 junto a las de 2026. La antigua palanca mueve las dos vagonetas a la vez, aunque las obras dejaron caminos distintos. Lleva cada una hasta su muelle.',mount:railway},
    2:{title:'El turno del conserje',pitch:'Además de las tres reservas antiguas, recepción tiene pendientes las llegadas del turno ordinario. El conserje ha dejado seis habitaciones y cinco peticiones. ¿Dónde dormirá cada huésped esta noche?',mount:hotel},
    3:{title:'Un paseo de nueve recuerdos',pitch:'Durante el trayecto, sobre la mesa del vagón aparecen nueve tarjetas para romper el hielo. Enlaza sus anécdotas e inventa un paseo que empiece bajo la lluvia y termine al amanecer.',mount:conversation},
    4:{title:'La mesa de mezclas',pitch:'En el estante de continuidad quedan dos sintonías de la emisora desmontadas en bucles. Antes de devolverlas a antena, ajusta la percusión de tres canales hasta que cada pulso coincida con la referencia.',mount:mixer}
  });
})();
