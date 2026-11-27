(() => {
  'use strict';

  function create(send, remember) {
    if (typeof send !== 'function') return null;
    const node = document.createElement('details');
    node.className = 'vhour-fold expedition-inventory';
    const summary = document.createElement('summary');
    const body = document.createElement('div');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.tabIndex = -1;
    node.append(summary, body, status);
    let model, current, selectedRoom, busy = false;
    let picks = [];

    function element(tag, label) {
      const item = document.createElement(tag);
      item.textContent = label;
      return item;
    }
    function button(label, run) {
      const control = element('button', label);
      control.type = 'button';
      control.dataset.focusKey = 'button:' + label;
      control.disabled = busy;
      control.addEventListener('click', run);
      return control;
    }
    function selectRoom(index) {
      selectedRoom = index;
      picks = [];
      status.textContent = '';
      render();
    }
    async function act(payload, message) {
      if (busy) return;
      const index = selectedRoom;
      busy = true;
      render();
      try {
        const result = await send({index, ...payload});
        if (!node.isConnected) return;
        if (result.inventory.revision >= model.revision) {
          model = result.inventory;
          remember(model);
        }
        if (payload.operation === 'combine') picks = [];
        status.textContent = message;
      } catch (error) {
        status.textContent = error.message || 'No se ha podido guardar. Vuelve a intentarlo.';
      } finally {
        busy = false;
        render();
        if (node.isConnected && (document.activeElement === document.body || node.contains(document.activeElement))) status.focus({preventScroll:true});
      }
    }
    function render() {
      const key = node.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
      draw();
      if (key && !busy) {
        const target = [...body.querySelectorAll('[data-focus-key]')].find(item => item.dataset.focusKey === key);
        (target || summary).focus({preventScroll:true});
      }
    }
    function draw() {
      if (!model) return;
      const room = model.rooms.find(room => room.index === selectedRoom);
      const count = model.rooms.reduce((total, room) => total + room.items.filter(item => item.held).length, 0);
      summary.textContent = 'Explorar e inventario · ' + count + (count === 1 ? ' prueba' : ' pruebas');
      body.replaceChildren();
      if (!room) return;
      const label = element('label', 'Lugar de investigación ');
      const places = document.createElement('select');
      places.disabled = busy;
      places.dataset.focusKey = 'places';
      for (const room of model.rooms) {
        const option = element('option', room.place);
        option.value = room.index;
        option.selected = room.index === selectedRoom;
        places.append(option);
      }
      places.addEventListener('change', () => selectRoom(Number(places.value)));
      label.append(places);
      body.append(label);
      if (!room.visited) {
        body.append(button('Explorar ' + room.place, () => act({operation:'visit'}, 'Lugar explorado.')));
        return;
      }
      if(room.instrument && window.FieldInstruments) {
        window.FieldInstruments.render(body,room.instrument,room.instrumentSolved,async answer=>{
          const result=await send({operation:'instrument',index:room.index,answer});
          if (!node.isConnected) return true;
          if(result.inventory.revision >= model.revision){
            model=result.inventory;
            remember(model);
            render();
          }
          status.textContent='Instrumento resuelto. Consulta la anotación recuperada.';
          status.focus({preventScroll:true});
          return true;
        });
        if(room.recovered) {
          const recovered=element('details','');
          recovered.append(element('summary','Anotación recuperada · '+room.recovered.label),element('blockquote',room.recovered.fragment));
          body.append(recovered);
        }
      }
      if (room.assignment) {
        const mission = document.createElement('section');
        const {prize,complete,fragments,paired} = room.assignment;
        const amount = prize + (prize === 1 ? ' llave' : ' llaves');
        mission.append(element('h4','Misión de archivo · ' + amount));
        if (complete) {
          mission.append(element('p','Ficha de archivo verificada. Recompensa registrada.'));
        } else {
          mission.append(element('p','Localiza el origen de los fragmentos y reúne sus dos pruebas en una ficha de contraste.'));
          if (paired) mission.append(element('p','Cada persona debe aportar su prueba desde su papel. Intercambiad lo que habéis leído.'));
          for (const excerpt of fragments) mission.append(element('blockquote',excerpt));
        }
        body.append(mission);
      }
      for (const item of room.items.filter(item => !item.held && item.canCollect)) {
        body.append(button('Recoger ' + item.label, () => act({operation:'collect', item:item.id}, 'Prueba guardada.')));
      }
      const held = room.items.filter(item => item.held);
      if (!held.length) {
        body.append(element('p', room.items.length ? 'Recoge una prueba para guardarla en tu inventario.' : 'Tu compañero puede recoger las pruebas de este lugar.'));
        return;
      }
      const field = document.createElement('fieldset');
      field.append(element('legend', 'Pruebas recogidas en este lugar'));
      const combine = button('Crear ficha de contraste', () => act({operation:'combine', items:picks.slice()}, 'Ficha de contraste guardada.'));
      function ready() { combine.disabled = busy || picks.length !== 2; }
      for (const item of held) {
        const line = document.createElement('p');
        const name = document.createElement('label');
        const tick = document.createElement('input');
        tick.type = 'checkbox';
        tick.dataset.focusKey = 'item:' + item.id;
        tick.checked = picks.includes(item.id);
        tick.disabled = busy;
        tick.addEventListener('change', () => {
          if (tick.checked && picks.length === 2) {
            tick.checked = false;
            status.textContent = 'Desmarca una de las dos pruebas seleccionadas para cambiarla.';
            return;
          }
          picks = tick.checked ? [...picks, item.id] : picks.filter(id => id !== item.id);
          ready();
        });
        name.append(tick, document.createTextNode(' ' + item.label));
        line.append(name); field.append(line);
        if (!item.contributed && item.canCollect) {
          field.append(button('Aportar mi observación de ' + item.label, () => act({operation:'collect', item:item.id}, 'Tu observación está guardada.')));
        }
        if (item.detail) {
          const detail = document.createElement('details');
          detail.append(element('summary','Examinar ' + item.label),element('p',item.detail));
          field.append(detail);
        }
      }
      body.append(field);
      if (held.length >= 2) {
        ready();
        body.append(element('p','Selecciona dos pruebas para compararlas en una ficha.'),combine);
      }
      for (const ids of room.links) {
        const sources = ids.map(id => held.find(item => item.id === id));
        if (sources.some(item => !item)) continue;
        const link = document.createElement('details');
        link.append(element('summary','Ficha · ' + sources.map(item => item.label).join(' + ')));
        for (const item of sources) {
          link.append(element('h5', item.label), element('p', item.detail || 'Tu compañero tiene esta fuente. Pídele que contraste lo que ha encontrado.'));
        }
        body.append(link);
      }
    }

    function update(value, index) {
      if (current !== index || !value.rooms.some(room => room.index === selectedRoom)) {
        selectedRoom = Math.min(index, value.rooms.length - 1);
        picks = [];
      }
      current = index;
      model = value;
      render();
    }
    return {node, update};
  }
  window.ExpeditionInventory = Object.freeze({create});
})();
