(() => {
  'use strict';

  const esc = value => String(value).replace(/[&<>"']/g, chr => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[chr]));
  const button = (action, label, attributes='') => `<button type="button" class="vt-item" data-vt3-action="${action}" ${attributes}>${label}</button>`;
  const result = message => `<p class="vt-result" data-vt3-result role="status" aria-live="polite">${esc(message)}</p>`;
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const select = (name, label, options) => `<label>${esc(label)} <select data-vt3-select="${name}">${options}</select></label>`;
  const initial = option('', 'Sin anotar');
  const readings = values => initial + values.map((label, index)=>option(index,label)).join('');
  function form(id, data, contents) {
    const root=document.createElement('section');
    root.className='vd-taller';
    root.dataset.vt3=String(id);
    const title=document.createElement('h3');
    title.textContent=data.title;
    const instruction=document.createElement('p');
    instruction.textContent=data.instruction;
    const template=document.createElement('template');
    template.innerHTML=contents;
    root.append(title,instruction,template.content);
    const onAction=event=>handle(event,root,data);
    root.addEventListener('click',onAction);
    root.addEventListener('change',onAction);
    return root;
  }
  function terminals(data) {
    const filters = select('mark',data.markLabel,readings(data.marks)) + select('sound',data.soundLabel,readings(data.sounds));
    const cards = data.terminals.map(item=>`<div class="vt-item" data-vt3-terminal><strong>Borne ${esc(item.number)}</strong><span>${esc(data.marks[item.mark])} · ${esc(data.sounds[item.sound])}</span><small>Manguito ${esc(item.sleeve)}</small></div>`).join('');
    return form(9,data,`<div class="vt-controls">${filters}</div><div class="vt-board vt-grid vt-grid--2">${cards}</div>${result('Anota al menos una observación para comparar.')}`);
  }
  function compare(root, data) {
    const mark = root.querySelector('[data-vt3-select="mark"]').value;
    const sound = root.querySelector('[data-vt3-select="sound"]').value;
    const picking = mark!=='' || sound!=='';
    const matches = [];
    const terminals=root.querySelectorAll('[data-vt3-terminal]');
    for (const [index,item] of data.terminals.entries()) {
      const match = picking && (mark==='' || Number(mark)===item.mark) && (sound==='' || Number(sound)===item.sound);
      terminals[index].toggleAttribute('data-vt-match',match);
      if (match) matches.push(item.number);
    }
    root.querySelector('[data-vt3-result]').textContent = picking ? 'Bornes que coinciden con tu anotación: '+(matches.join(', ')||'ninguno')+'.' : 'Anota al menos una observación para comparar.';
  }
  function places(data) {
    const envelopes = data.envelopes.map((name,i)=>button('envelope',esc(name),`data-index="${i}" aria-pressed="false"`)).join('');
    const sides = data.sides.map(side=>`<div><strong>${esc(side.label)}</strong><div class="vt-grid vt-grid--3">${side.seats.map(n=>button('seat','Puesto '+esc(n),`data-seat="${esc(n)}"`)).join('')}</div></div>`).join('');
    return form(10,data,`<div class="vt-controls" role="group" aria-label="Elegir sobre">${envelopes}</div><div class="vt-board">${sides}</div><div class="vt-toolbar">${button('clear-seats','Retirar los sobres')}</div>${result('Los sobres siguen fuera de la mesa.')}`);
  }
  function arrange(root, data, act, target) {
    const status = root.querySelector('[data-vt3-result]');
    const envelopes = [...root.querySelectorAll('[data-vt3-action="envelope"]')];
    const seats = [...root.querySelectorAll('[data-vt3-action="seat"]')];
    if (act==='envelope') {
      for (const envelope of envelopes) envelope.setAttribute('aria-pressed',String(envelope===target));
      status.textContent = data.envelopes[Number(target.dataset.index)]+' seleccionado. Elige un puesto.';
      return;
    }
    if (act==='clear-seats') {
      for (const seat of seats) delete seat.dataset.occupant;
      for (const envelope of envelopes) envelope.setAttribute('aria-pressed','false');
    } else if (act==='seat') {
      const chosen = envelopes.find(el=>el.getAttribute('aria-pressed')==='true');
      if (!chosen) {status.textContent='Escoge primero el sobre que quieres colocar.';return;}
      const index = chosen.dataset.index;
      if (target.dataset.occupant!==undefined && target.dataset.occupant!==index) {
        status.textContent='Ese puesto ya tiene otro sobre. Muévelo primero o elige un puesto libre.';
        return;
      }
      for (const seat of seats) if (seat.dataset.occupant===index) delete seat.dataset.occupant;
      target.dataset.occupant=index;
    }
    const positions=[];
    for (const seat of seats) {
      const name=data.envelopes[seat.dataset.occupant];
      seat.textContent='Puesto '+seat.dataset.seat+(name?' · '+name:'');
      seat.toggleAttribute('data-vt-match',Boolean(name));
      if (name) positions.push(name+' en '+seat.dataset.seat);
    }
    status.textContent=positions.length?'Tu reparto: '+positions.join(', ')+'.':'Los sobres siguen fuera de la mesa.';
  }
  function gridCells(cells) {
    return cells.map(([coord,drawing])=>button('cell',`<strong>${esc(coord)}</strong> <span>${esc(drawing)}</span>`,`data-coord="${esc(coord)}" aria-pressed="false"`)).join('');
  }
  function board(data) {
    const controls=button('rotate','Girar media vuelta','aria-pressed="false"')+button('undo','Deshacer última marca','disabled')+button('clear-cells','Borrar tira','disabled');
    return form(11,data,`<div class="vt-toolbar">${controls}</div><div class="vt-board vt-grid vt-grid--4" aria-label="Tablero de casillas">${gridCells(data.cells)}</div>${result('Tu tira aún está vacía.')}`);
  }
  function markBoard(root,data,act,target) {
    const grid=root.querySelector('.vt-board');
    const live=root.querySelector('[data-vt3-result]');
    const cells=[...grid.children];
    if (act==='rotate') {
      const rotated=target.getAttribute('aria-pressed')!=='true';
      target.setAttribute('aria-pressed',String(rotated));
      for (const cell of cells.reverse()) grid.append(cell);
      live.textContent=(rotated?'Tablero girado media vuelta. ':'Orientación inicial. ')+(root.dataset.strip||'Tu tira aún está vacía.');
      return;
    }
    const marked=cells.filter(c=>c.dataset.pos).sort((a,b)=>Number(a.dataset.pos)-Number(b.dataset.pos));
    if (act==='clear-cells') marked.length=0;
    else if (act==='undo') marked.pop();
    else if (act==='cell') {
      const existing=marked.indexOf(target);
      if (existing>=0) marked.splice(existing,1);
      else if (marked.length===4) {live.textContent='La tira tiene cuatro marcas. Quita una casilla antes de añadir otra.';return;}
      else marked.push(target);
    }
    for (const cell of cells) {
      const index=marked.indexOf(cell);
      cell.setAttribute('aria-pressed',String(index>=0));
      if (index>=0) cell.dataset.pos=String(index+1);
      else delete cell.dataset.pos;
    }
    const strip=marked.map(cell=>data.cells.find(([coord])=>coord===cell.dataset.coord));
    const text=strip.length?'Tu tira: '+strip.map(([coord,name])=>coord+' ('+name+')').join(' → ')+'. Iniciales: '+strip.map(([,name])=>name[0].toUpperCase()).join('')+'.':'Tu tira aún está vacía.';
    root.dataset.strip=text;
    live.textContent=text;
    for (const name of ['undo','clear-cells']) root.querySelector(`[data-vt3-action="${name}"]`).disabled=!strip.length;
  }
  const pad=n=>String(n).padStart(2,'0');
  const clock=minutes=>pad(Math.floor(minutes/60))+':'+pad(minutes%60);
  const counter=seconds=>pad(Math.floor(seconds/60))+':'+pad(seconds%60);
  function tape(data) {
    const marks=initial+data.marks.map((mark,i)=>option(i,counter(mark.counter)+' · '+mark.name)).join('');
    const times=initial+Array.from({length:data.max-data.min+1},(_,offset)=>option(data.min+offset,clock(data.min+offset))).join('');
    const controls=select('anchor','Marca de referencia',marks)+select('minute','Hora oficial asignada',times);
    const rows=data.marks.map((m,i)=>`<div class="vt-row"><span>${esc(m.name)} · ${counter(m.counter)}</span><strong data-vt3-time="${i}">—</strong></div>`).join('');
    return form(12,data,`<div class="vt-controls">${controls}</div><div class="vt-toolbar">${button('earlier','Restar un minuto','disabled')}${button('later','Sumar un minuto','disabled')}</div><div class="vt-board">${rows}</div>${result('Elige una marca del carrete y asígnale una hora.')}`);
  }
  function sync(root,data,act) {
    const anchor=root.querySelector('[data-vt3-select="anchor"]').value;
    const selector=root.querySelector('[data-vt3-select="minute"]');
    if (selector.value!=='' && (act==='earlier'||act==='later')) {
      const candidate=Number(selector.value)+(act==='earlier'?-1:1);
      if (candidate>=data.min && candidate<=data.max) selector.value=String(candidate);
    }
    const valid=anchor!=='' && selector.value!=='';
    const minute=Number(selector.value);
    root.querySelector('[data-vt3-action="earlier"]').disabled=!valid||minute===data.min;
    root.querySelector('[data-vt3-action="later"]').disabled=!valid||minute===data.max;
    const times=data.marks.map((m,i)=>{
      const stamp=valid?clock(minute+(m.counter-data.marks[Number(anchor)].counter)/60):'—';
      root.querySelector(`[data-vt3-time="${i}"]`).textContent=stamp;
      return stamp;
    });
    root.querySelector('[data-vt3-result]').textContent=valid?'Tu sincronización, en orden de cinta: '+times.join(' · ')+'.':'Elige una marca del carrete y asígnale una hora.';
  }
  function handle(event,root,data) {
    const control=event.target.closest?.(event.type==='change'?'[data-vt3-select]':'button[data-vt3-action]');
    if (!control || !root.contains(control)) return;
    const act=control.dataset.vt3Action;
    switch (root.dataset.vt3) {
      case '9': compare(root,data);break;
      case '10': arrange(root,data,act,control);break;
      case '11': markBoard(root,data,act,control);break;
      case '12': sync(root,data,act);break;
    }
  }
  window.ValdemarTalleres ||= {};
  Object.assign(window.ValdemarTalleres,{9:terminals,10:places,11:board,12:tape});
})();
