(() => {
  'use strict';

  function tag(name, text, className) {
    const element = document.createElement(name);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function action(label, run, className) {
    const button = tag('button', label, className);
    button.type = 'button';
    button.addEventListener('click', run);
    return button;
  }

  function panel(host, rules) {
    const section = tag('section', '', 'juego');
    const instructions = tag('p', rules);
    const board = tag('div', '', 'tablero');
    const controls = tag('div', '', 'opciones');
    const status = tag('p', '', 'estado');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.append(instructions, board, controls, status);
    host.replaceChildren(section);
    return { section, board, controls, status, instructions };
  }

  function legend(ui, title, items) {
    const details = tag('details');
    details.open = true;
    details.append(tag('summary', title));
    const list = tag('ul');
    for (const item of items) list.append(tag('li', item));
    details.append(list);
    ui.instructions.after(details);
  }

  const compass = ['norte', 'este', 'sur', 'oeste'];
  const steps = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const blueprints = [
    ['A1 · Vestíbulo', [1, 3], 1], ['A2 · Cocina', [1, 3], 0], ['A3 · Taller', [2, 3], 1],
    ['B1 · Galería', [1, 2], 3], ['B2 · Despensa', [1, 3], 1], ['B3 · Lavadero', [0, 3], 2],
    ['C1 · Patio', [0, 1], 1], ['C2 · Salón', [1, 3], 1], ['C3 · Zaguán', [1, 3], 0]
  ];

  function planos(el, win) {
    const ui = panel(el, 'Han mezclado las nueve piezas del plano de un refugio. Gira una estancia pulsándola. La entrada llega desde el oeste a A1. La salida conduce al este desde C3. El recorrido debe pasar por el taller A3 y la galería B1.');
    ui.board.style.display = 'grid';
    ui.board.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    ui.board.setAttribute('aria-label', 'Plano. Tres filas A, B y C. Tres columnas de oeste a este.');
    const rotations = blueprints.map(room => room[2]);
    const history = [];
    let solved = false;
    const ports = i => blueprints[i][1].map(d => (d + rotations[i]) % 4).sort();
    const symbols = { '0,1': '└', '0,2': '│', '0,3': '┘', '1,2': '┌', '1,3': '─', '2,3': '┐' };
    const tiles = blueprints.map((room, i) => {
      const tile = action('', () => {
        if (solved) return;
        history.push(i);
        rotations[i] = (rotations[i] + 1) % 4;
        redraw();
        ui.status.textContent = room[0] + ' comunica ' + ports(i).map(n => compass[n]).join(' y ') + '.';
      }, 'pieza');
      ui.board.append(tile);
      return tile;
    });
    function walk() {
      if (solved) return;
      let i = 0, entry = 3;
      const seen = new Set();
      while (!seen.has(i)) {
        const doors = ports(i);
        if (!doors.includes(entry)) {
          ui.status.textContent = 'El paso se corta en ' + blueprints[i][0] + '. Se llega desde el ' + compass[entry] + ' y ahí falta una puerta.';
          return;
        }
        seen.add(i);
        const exit = doors.find(d => d !== entry);
        if (i === 8 && exit === 1 && seen.has(2) && seen.has(3)) {
          solved = true;
          redraw();
          ui.status.textContent = '¡Se puede recorrer el refugio de puerta a puerta! El taller y la galería quedan comunicados.';
          win();
          return;
        }
        const row = Math.floor(i / 3) + steps[exit][0], col = i % 3 + steps[exit][1];
        if (row < 0 || row > 2 || col < 0 || col > 2) {
          ui.status.textContent = i === 8 && exit === 1 ? 'Has encontrado la salida, pero falta visitar el taller o la galería.' : 'El recorrido sale del plano por ' + blueprints[i][0] + ', hacia el ' + compass[exit] + '.';
          return;
        }
        i = row * 3 + col;
        entry = (exit + 2) % 4;
      }
      ui.status.textContent = 'El recorrido vuelve a una estancia anterior. Hay una vuelta cerrada.';
    }
    const trace = action('Recorrer el plano', walk);
    const undo = action('Deshacer un giro', () => {
      if (!history.length || solved) return;
      const i = history.pop();
      rotations[i] = (rotations[i] + 3) % 4;
      redraw();
      ui.status.textContent = 'Giro deshecho en ' + blueprints[i][0] + '.';
    }, 'secundario');
    ui.controls.append(trace, undo);
    function redraw() {
      tiles.forEach((tile, i) => {
        const names = ports(i).map(d => compass[d]).join(' y ');
        tile.replaceChildren(tag('strong', symbols[ports(i).join(',')]), tag('br'), tag('span', blueprints[i][0]), tag('br'), tag('small', names));
        tile.setAttribute('aria-label', 'Girar ' + blueprints[i][0] + '. Puertas al ' + names);
        tile.disabled = solved;
      });
      trace.disabled = solved;
      undo.disabled = !history.length || solved;
    }
    redraw();
  }

  function sobremesa(el, win) {
    const ui = panel(el, 'En el ensayo del banquete hay seis sillas alrededor de una mesa. Los números crecen en sentido horario. Inés permanece en la silla 1. Pulsa dos sillas para intercambiar a sus ocupantes y cumple los cuatro acuerdos.');
    const guests = ['Inés', 'Bruno', 'Vera', 'Darío', 'Lucía', 'Alma'];
    const agreements = [
      ['Alma quiere la silla inmediatamente posterior a la de Inés, en sentido horario.', () => guests[1] === 'Alma'],
      ['Inés y Bruno van a brindar frente a frente.', () => guests[3] === 'Bruno'],
      ['Darío lleva un regalo para quien esté enfrente: Alma.', () => Math.abs(guests.indexOf('Darío') - guests.indexOf('Alma')) === 3],
      ['Bruno y Lucía compartirán el discurso. Necesitan sillas contiguas.', () => {
        const distance = Math.abs(guests.indexOf('Bruno') - guests.indexOf('Lucía'));
        return distance === 1 || distance === 5;
      }]
    ];
    legend(ui, 'Los cuatro acuerdos', agreements.map(rule => rule[0]));
    let selected = -1, solved = false;
    const history = [];
    const seats = guests.map((_, i) => {
      const seat = action('', () => {
        if (solved || i === 0) return;
        if (selected === i) {
          selected = -1;
          ui.status.textContent = 'Selección cancelada.';
        } else if (selected === -1) {
          selected = i;
          ui.status.textContent = guests[i] + ' está esperando. Elige la silla con la que intercambiar.';
        } else {
          history.push([selected, i]);
          const previous = guests[selected], next = guests[i];
          [guests[selected], guests[i]] = [next, previous];
          selected = -1;
          ui.status.textContent = previous + ' y ' + next + ' han cambiado de sitio.';
        }
        redraw();
      }, 'pieza');
      ui.board.append(seat);
      return seat;
    });
    const listen = action('Escuchar a los invitados', () => {
      const failed = agreements.filter(([, check]) => !check());
      if (failed.length) {
        ui.status.textContent = (4 - failed.length) + ' de 4 acuerdos cumplidos. Te recuerdan uno pendiente: ' + failed[0][0];
      } else if (!solved) {
        solved = true;
        redraw();
        ui.status.textContent = 'Inés levanta la copa. Se cumplen los cuatro acuerdos y todos aceptan el brindis.';
        win();
      }
    });
    const undo = action('Deshacer intercambio', () => {
      if (!history.length || solved) return;
      const [a, b] = history.pop();
      [guests[a], guests[b]] = [guests[b], guests[a]];
      selected = -1;
      redraw();
      ui.status.textContent = 'Último intercambio deshecho.';
    }, 'secundario');
    ui.controls.append(listen, undo);
    function redraw() {
      seats.forEach((seat, i) => {
        seat.textContent = 'Silla ' + (i + 1) + ' · ' + guests[i] + (i === 0 ? ' (fija)' : '');
        seat.setAttribute('aria-pressed', String(i === selected));
        seat.disabled = solved || i === 0;
      });
      listen.disabled = solved;
      undo.disabled = solved || !history.length;
    }
    redraw();
  }

  function respuesta(stock) {
    const legal = [];
    stock.forEach((size, row) => {
      for (let take = 1; take <= Math.min(size, 3); take++) {
        const result = stock.slice();
        result[row] -= take;
        legal.push({ row, take, mirror: result[0] % 4 === result[1] % 4 });
      }
    });
    return legal.find(move => move.mirror) || legal[0];
  }

  function faroles(el, win) {
    const ui = panel(el, 'El farolero te reta a dos rondas. En cada turno, retira de una a tres fichas de una sola fila. Después juega él. Gana quien retire la última ficha de la mesa. Puedes deshacer una ronda de movimientos para ensayar otra respuesta.');
    const rounds = [[4, 6], [6, 7]];
    let level = 0, stock = rounds[0].slice(), history = [], phase = 'play';
    ui.board.setAttribute('aria-label', 'Fichas que quedan sobre la mesa');
    legend(ui, 'Consejo del club', ['Observa lo que hace el farolero cuando le dejas dos filas iguales.', 'Una fila de cuatro vuelve al mismo punto del ciclo: si te quitan una, puedes quitar tres.']);
    function startLevel() {
      stock = rounds[level].slice();
      history = [];
      phase = 'play';
      ui.status.textContent = 'Ronda ' + (level + 1) + '. Empiezas tú.';
      draw();
    }
    function play(row, take) {
      if (phase !== 'play' || take > stock[row]) return;
      const before = stock.slice();
      history.push(before);
      stock[row] -= take;
      if (stock[0] + stock[1] === 0) {
        phase = level === 1 ? 'done' : 'next';
        ui.status.textContent = phase === 'done' ? '¡Dos victorias! El farolero te entrega su llave del club.' : 'Has ganado la primera ronda. El farolero coloca otra partida.';
        draw();
        if (phase === 'done') win();
        return;
      }
      const other = respuesta(stock);
      stock[other.row] -= other.take;
      const reply = 'El farolero retira ' + other.take + ' de la fila ' + (other.row ? 'azul' : 'ámbar') + '. ';
      phase = stock[0] + stock[1] === 0 ? 'lost' : 'play';
      ui.status.textContent = reply + (phase === 'lost' ? 'Se lleva la última ficha. Puedes deshacer o volver a empezar esta ronda.' : 'Te toca.');
      draw();
    }
    function draw() {
      ui.board.replaceChildren(tag('p', 'Ronda ' + (level + 1) + ' de 2'));
      stock.forEach((n, i) => ui.board.append(tag('p', (i ? 'Azul' : 'Ámbar') + ' · ' + n + (n === 1 ? ' ficha  ' : ' fichas  ') + '●'.repeat(n))));
      const previousFocus = document.activeElement?.dataset?.move;
      ui.controls.replaceChildren();
      if (phase === 'play') stock.forEach((n, row) => {
        for (let take = 1; take <= Math.min(3, n); take++) {
          const option = action('Quitar ' + take + ' · ' + (row ? 'azul' : 'ámbar'), () => play(row, take));
          option.dataset.move = row + '-' + take;
          ui.controls.append(option);
        }
      });
      if (phase === 'next') ui.controls.append(action('Jugar la segunda ronda', () => { level++; startLevel(); }));
      if (phase === 'lost') ui.controls.append(action('Reintentar esta ronda', startLevel));
      if (history.length && (phase === 'play' || phase === 'lost')) ui.controls.append(action('Deshacer mi turno y la respuesta', () => {
        stock = history.pop();
        phase = 'play';
        draw();
        ui.status.textContent = 'Se ha recuperado la posición anterior. Te toca.';
      }, 'secundario'));
      if (previousFocus) {
        const options = Array.from(ui.controls.querySelectorAll('button'));
        (options.find(b => b.dataset.move === previousFocus) || options[0])?.focus();
      }
    }
    startLevel();
  }

  function sellos(el, win) {
    const ui = panel(el, 'La valija del tranvía parte al acabar el minuto 9. Tramita cinco encargos en el orden que elijas. La prensa empieza con tinta roja. Cada cambio de color consume un minuto adicional. Un encargo puede terminar exactamente en su minuto límite.');
    const jobs = [
      { name: 'Partida de nacimiento', color: 'roja', minutes: 1, limit: 3 },
      { name: 'Copia para el padrón', color: 'roja', minutes: 2, limit: 8, after: [0] },
      { name: 'Plano de la acequia', color: 'azul', minutes: 1, limit: 4 },
      { name: 'Rectificación del plano', color: 'azul', minutes: 2, limit: 7, after: [2] },
      { name: 'Índice de la valija', color: 'roja', minutes: 1, limit: 9, after: [1, 3] }
    ];
    const history = [];
    let time = 0, ink = 'roja', late = false, solved = false;
    const clock = tag('p');
    ui.board.before(clock);
    const buttons = jobs.map((job, id) => {
      const b = action('', () => {
        if (solved || late || history.some(h => h.id === id) || !(job.after || []).every(n => history.some(h => h.id === n))) return;
        history.push({ id, time, ink });
        time += job.minutes + (ink === job.color ? 0 : 1);
        ink = job.color;
        late = time > job.limit;
        solved = !late && history.length === jobs.length;
        ui.status.textContent = late ? 'El sello marca el minuto ' + time + '. El encargo vencía en el ' + job.limit + '. Puedes deshacer varios sellos y reorganizar la cola.' : solved ? 'El tranvía se lleva la valija completa. Los cinco documentos llevan un sello a tiempo.' : job.name + ' sellado en el minuto ' + time + '.';
        redraw();
        if (solved) win();
      }, 'pieza');
      ui.board.append(b);
      return b;
    });
    const undo = action('Deshacer el último sello', () => {
      if (solved || !history.length) return;
      const step = history.pop();
      time = step.time;
      ink = step.ink;
      late = false;
      redraw();
      ui.status.textContent = 'Encargo devuelto a la cola. Recuperas el tiempo y la tinta anteriores.';
    }, 'secundario');
    ui.controls.append(undo);
    function redraw() {
      clock.textContent = 'Minuto ' + time + ' de 9 · Tinta ' + ink + '.';
      const done = history.map(h => h.id);
      buttons.forEach((b, id) => {
        const job = jobs[id];
        b.replaceChildren(tag('strong', job.name), tag('br'), tag('span', 'Tinta ' + job.color + ' · ' + job.minutes + ' min · límite ' + job.limit));
        if (job.after) b.append(tag('br'), tag('small', 'Requiere: ' + job.after.map(n => jobs[n].name).join(' + ')));
        if (done.includes(id)) b.append(tag('br'), tag('span', 'Sellado · turno ' + (done.indexOf(id) + 1)));
        b.disabled = solved || late || done.includes(id) || !(job.after || []).every(n => done.includes(n));
      });
      undo.disabled = !history.length || solved;
    }
    redraw();
  }

  Object.assign(window.Retos, {
    9: { title: 'El plano giratorio', pitch: 'Antes de comparar los dibujos de las hermanas, puedes practicar con la maqueta de un refugio. Gira sus nueve estancias hasta encontrar un recorrido que pase por el taller y la galería.', mount: planos },
    10: { title: 'El brindis imposible', pitch: 'El jefe de sala ha guardado el plano de mesa del ensayo. Seis invitados pactaron dónde sentarse para el brindis. Intercambia sus sitios hasta cumplir los cuatro acuerdos.', mount: sobremesa },
    11: { title: 'El duelo de los faroles', pitch: 'En la mesa de prácticas del club, el farolero propone otro juego mientras se revisa la final. Juega dos rondas con las fichas de las dos filas. Gana quien retire la última.', mount: faroles },
    12: { title: 'Turno de las dos tintas', pitch: 'En la ventanilla del archivo esperan cinco encargos para la valija del tranvía. La prensa comienza con tinta roja. Organiza los sellos de ambos colores para entregar los documentos a tiempo.', mount: sellos }
  });
})();
