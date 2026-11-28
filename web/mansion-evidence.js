(() => {
  'use strict';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function portrait(draft, evidence) {
    const card = element('section', 'mansion-evidence-portrait');
    const clue = (evidence || []).find(item => item.role === 'B');
    const picture = element('figure', 'mansion-evidence-paper');
    const image = element('img', 'mansion-evidence-paper-image');
    image.width = 760;
    image.height = 506;
    const inscription = element('blockquote', 'mansion-evidence-hand');
    inscription.textContent = clue?.text?.match(/«([^»]+)»/u)?.[1] || '';
    const drawingDescription = clue?.text?.split('»').slice(1).join('»').replace(/^[.\s]+/u, '').trim() || '';
    const transcript = element('details', 'mansion-reference mansion-evidence-description');
    transcript.append(element('summary', null, 'Leer la descripción de la fotografía'),
      element('p', null, clue?.text || ''));
    const turn = element('button', 'mansion-secondary');
    turn.type = 'button';
    function redraw() {
      const back = Boolean(draft.turned);
      image.src = back ? '/mansion-evidence-reverso.webp' : '/mansion-photo.webp';
      image.alt = back ? ['Reverso de la fotografía.', drawingDescription].filter(Boolean).join(' ')
        : 'Fotografía antigua de dos niños ante una casa.';
      inscription.hidden = !back || !inscription.textContent;
      transcript.hidden = !back || !clue;
      if (!back) transcript.open = false;
      turn.textContent = back ? 'Ver el anverso' : 'Girar la fotografía';
      turn.setAttribute('aria-expanded', String(back));
    }
    turn.addEventListener('click', () => { draft.turned = !draft.turned; redraw(); });
    picture.append(image, inscription);
    card.append(picture, turn, transcript);
    redraw();
    return card;
  }

  const plateObjects = new Map([
    ['clavo', 'pin'], ['retrato', 'portrait'], ['farol', 'lamp'], ['florero', 'vase']
  ]);
  const columns = 'ABCD';

  function plateOffset(value) {
    const adjustment = String(value || '');
    const x = adjustment.includes('izquierda') ? -1 : adjustment.includes('derecha') ? 1 : 0;
    const y = adjustment.includes('arriba') ? -1 : adjustment.includes('abajo') ? 1 : 0;
    return {x, y};
  }

  function makeSlide(plate) {
    const slide = element('div', 'mansion-evidence-slide');
    slide.dataset.role = plate.role;
    for (const mark of plate.marks || []) {
      if (!/^[A-D][1-3]$/.test(mark.cell)) continue;
      const sprite = element('span', 'mansion-evidence-object');
      const kind = plateObjects.get(String(mark.label).toLocaleLowerCase('es'));
      sprite.dataset.kind = kind || 'other';
      if (!kind) sprite.textContent = mark.label;
      sprite.style.left = ((columns.indexOf(mark.cell[0]) + 0.5) * 25) + '%';
      sprite.style.top = ((Number(mark.cell[1]) - 0.5) * 100 / 3) + '%';
      slide.append(sprite);
    }
    return slide;
  }

  function plates(draft, world, evidence) {
    const wrap = element('section', 'mansion-photo-table mansion-evidence-plates');
    const permitted = (evidence || []).filter(item => item.kind === 'photo-grid');
    const current = permitted.find(item => item.role === world);
    if (!current) return {node:wrap, redraw(){}};
    // The server sends both records only to a player controlling both houses.
    const reference = world === 'B' ? permitted.find(item => item.role === 'A') : null;
    const frame = element('div', 'mansion-evidence-lightbox');
    frame.setAttribute('aria-hidden', 'true');
    const xAxis = element('div', 'mansion-evidence-x');
    const yAxis = element('div', 'mansion-evidence-y');
    for (const letter of columns) xAxis.append(element('span', null, letter));
    for (let row = 1; row <= 3; row++) yAxis.append(element('span', null, String(row)));
    const opening = element('div', 'mansion-evidence-aperture');
    const companionSlide = reference ? makeSlide(reference) : null;
    const activeSlide = makeSlide(current);
    if (companionSlide) opening.append(companionSlide);
    opening.append(activeSlide);
    frame.append(xAxis, yAxis, opening);
    const description = element('details', 'mansion-reference mansion-evidence-description');
    const table = element('table', 'mansion-photo-grid');
    const caption = element('caption', null, 'Posición de los objetos respecto a la mesa');
    const thead = element('thead'), top = element('tr');
    top.append(element('th', null, 'Fila'));
    for (const col of columns) {
      const heading = element('th', null, col);
      heading.scope = 'col';
      top.append(heading);
    }
    thead.append(top);
    const tbody = element('tbody');
    table.append(caption, thead, tbody);
    description.append(element('summary', null, 'Leer la cuadrícula de la placa'), table);
    const label = element('p', 'mansion-evidence-plate-name', current.title);
    wrap.append(label, frame);
    const showBoth = element('label', 'mansion-evidence-compare');
    const toggle = element('input');
    toggle.type = 'checkbox';
    if (reference) {
      toggle.checked = draft.plateCompare !== false;
      showBoth.append(toggle, element('span', null, 'Superponer la placa de la casa habitada'));
      toggle.addEventListener('change', () => { draft.plateCompare = toggle.checked; redraw(); });
      wrap.append(showBoth);
    }
    const position = element('p', 'mansion-readout');
    position.setAttribute('role', 'status');
    if (world === 'B') wrap.append(position);
    wrap.append(description);
    function redraw() {
      const {x, y} = world === 'B' ? plateOffset(draft.ajuste) : {x:0, y:0};
      activeSlide.style.transform = 'translate(' + (25 * x) + '%, ' + (100 * y / 3) + '%)';
      if (companionSlide) {
        companionSlide.hidden = !toggle.checked;
        activeSlide.className = 'mansion-evidence-slide' + (toggle.checked ? ' mansion-evidence-overlay' : '');
      }
      position.textContent = draft.ajuste ? 'Posición de la copia · ' + draft.ajuste : 'Copia en su posición inicial.';
      const visible = companionSlide && toggle.checked ? [reference, current] : [current];
      const positions = new Map();
      const outside = [];
      for (const plate of visible) {
        for (const mark of plate.marks || []) {
          if (!/^[A-D][1-3]$/.test(mark.cell)) continue;
          const shifted = plate === current && world === 'B';
          const col = columns.indexOf(mark.cell[0]) + (shifted ? x : 0);
          const row = Number(mark.cell[1]) + (shifted ? y : 0);
          const name = plate.role + ' · ' + mark.label;
          if (col < 0 || col > 3 || row < 1 || row > 3) { outside.push(name); continue; }
          const cell = columns[col] + row;
          if (!positions.has(cell)) positions.set(cell, []);
          positions.get(cell).push(name);
        }
      }
      tbody.replaceChildren();
      for (let row = 1; row <= 3; row++) {
        const line = element('tr'), head = element('th', null, String(row));
        head.scope = 'row';
        line.append(head);
        for (const col of columns) line.append(element('td', null, (positions.get(col + row) || []).join(' / ') || '—'));
        tbody.append(line);
      }
      caption.textContent = 'Posición de los objetos respecto a la mesa' + (outside.length ? '. Fuera de la ventana: ' + outside.join(', ') : '');
    }
    redraw();
    return {node:wrap, redraw};
  }

  window.MansionEvidence = Object.freeze({portrait, plates});
})();
