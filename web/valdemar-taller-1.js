(() => {
  'use strict';

  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function button(label, run) {
    const item = node('button', label);
    item.type = 'button';
    item.addEventListener('click', run);
    return item;
  }

  function shell(data) {
    const area = node('section', null, 'vd-taller');
    area.setAttribute('aria-label', data.title);
    area.append(node('h4', data.title), node('p', data.instructions));
    return area;
  }

  function feedback() {
    const live = node('p', '', 'vt-result');
    live.setAttribute('role', 'status');
    return live;
  }

  function chain(data) {
    const area = shell(data);
    const controls = node('div', null, 'vt-controls');
    const board = node('ol', null, 'vt-board');
    const live = feedback();
    const order = [];
    const controlsBySegment = data.segments.map((seg, index) => {
      const item = button(seg.label, () => {
        const at = order.indexOf(index);
        if (at < 0) order.push(index);
        else order.splice(at, 1);
        render();
      });
      item.setAttribute('aria-label', seg.label + ' · ' + seg.from + ' → ' + seg.to);
      controls.append(item);
      return item;
    });
    const undo = button('Retirar la última ficha', () => { order.pop(); render(); });
    function render() {
      controlsBySegment.forEach((item, index) => item.setAttribute('aria-pressed', String(order.includes(index))));
      board.replaceChildren();
      let discontinuities = 0;
      for (const [i, index] of order.entries()) {
        const segment = data.segments[index];
        const line = node('li', null, 'vt-item');
        line.append(node('strong', segment.label + ' · ' + segment.from + ' → ' + segment.to), node('p', segment.detail));
        if (i && data.segments[order[i - 1]].to !== segment.from) {
          line.append(node('small', 'El tramo anterior termina en otro lugar.'));
          discontinuities++;
        }
        board.append(line);
      }
      undo.disabled = !order.length;
      live.textContent = order.length ? 'Fichas en la mesa: ' + order.length + '. Enlaces con cambio de lugar: ' + discontinuities + '.' : 'Selecciona una ficha para empezar. Puedes volver a pulsarla para retirarla.';
    }
    area.append(controls, board, undo, live);
    render();
    return area;
  }

  function plans(data) {
    const area = shell(data);
    const toolbar = node('div', null, 'vt-toolbar');
    const board = node('div', null, 'vt-grid');
    const live = feedback();
    let layer = 0, current = 0;
    const layers = [...data.layers, 'Comparar'];
    const layerButtons = layers.map((name, index) => {
      const item = button(name, () => { layer = index; render(); });
      toolbar.append(item);
      return item;
    });
    const roomButtons = data.rooms.map((room, index) => {
      const item = button(room.label, () => { current = index; render(); });
      item.className = 'vt-item';
      board.append(item);
      return item;
    });
    function render() {
      layerButtons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === layer)));
      const shown = layer < data.layers.length ? [layer] : data.layers.map((_, index) => index);
      roomButtons.forEach((item, i) => {
        const room = data.rooms[i];
        item.replaceChildren(node('strong', room.label));
        for (const index of shown) {
          const state = room.states[index];
          const row = node('span', null, 'vt-row');
          const symbol = node('span', state.symbol + ' ');
          symbol.setAttribute('aria-hidden', 'true');
          row.append(symbol, document.createTextNode(data.layers[index] + ' · ' + state.label));
          item.append(row);
        }
        item.setAttribute('aria-pressed', String(i === current));
      });
      const room = data.rooms[current];
      live.textContent = room.label + '. ' + shown.map(i => data.layers[i] + ' · ' + room.states[i].detail).join(' ');
    }
    area.append(toolbar, board, live);
    render();
    return area;
  }

  function corrected(time, offset) {
    const [hour, minute] = time.split(':').map(Number);
    const total = (hour * 60 + minute + offset + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function clocks(data) {
    const area = shell(data);
    const board = node('div', null, 'vt-grid');
    for (const clock of data.clocks) {
      const part = node('div', null, 'vt-item');
      const label = node('label', 'Corrección que aplicas a ' + clock.label.toLowerCase() + ' ');
      const select = node('select');
      for (const offset of data.offsets) {
        const option = node('option', offset ? (offset > 0 ? '+' : '−') + Math.abs(offset) + ' min' : '0 min');
        option.value = String(offset);
        option.selected = offset === 0;
        select.append(option);
      }
      const result = feedback();
      function display() { result.textContent = 'Hora según tu hipótesis · ' + corrected(clock.time, Number(select.value)); }
      select.addEventListener('change', display);
      display();
      label.append(select);
      part.append(node('strong', clock.event), node('p', 'Marca impresa · ' + clock.time), label, result);
      board.append(part);
    }
    area.append(node('p', data.reference), board);
    return area;
  }

  function cuts(data) {
    const area = shell(data);
    const board = node('div', null, 'vt-grid');
    const list = node('ol', null, 'vt-board');
    const live = feedback();
    const selected = [];
    let version = 0, context, utterance;

    function stop() {
      version++;
      if (utterance) window.speechSynthesis?.cancel();
      utterance = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
      context = null;
    }
    async function sound(clip, request) {
      if (clip.speech) {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw Error('speech');
        await new Promise((resolve, reject) => {
          utterance = new window.SpeechSynthesisUtterance(clip.speech);
          utterance.lang = 'es-ES';window.GamePreferences?.audioVoice(utterance);
          utterance.onend = resolve;
          utterance.onerror = reject;
          window.speechSynthesis.speak(utterance);
        });
      } else {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw Error('audio');
        const audio = context || (context = new Audio());
        await audio.resume();
        if (request !== version) return;
        await new Promise(resolve => {
          const start = audio.currentTime + 0.04;
          clip.tones.forEach((freq, i) => {
            const tone = audio.createOscillator(), gain = audio.createGain(), at = start + i * 0.23;
            tone.frequency.value = freq;
            gain.gain.setValueAtTime(0.001, at);
            gain.gain.exponentialRampToValueAtTime(0.10, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, at + 0.19);
            tone.connect(gain); gain.connect(window.GamePreferences?.audioOutput(audio)||audio.destination);
            tone.start(at); tone.stop(at + 0.2);
          });
          window.setTimeout(resolve, (clip.tones.length * 0.23 + 0.08) * 1000);
        });
      }
    }
    async function play(sequence) {
      stop();
      const request = version;
      stopButton.disabled = false;
      try {
        for (const index of sequence) {
          if (version !== request || !area.isConnected) break;
          const clip = data.clips[index];
          live.textContent = 'Escuchando ' + clip.label + '. ' + clip.caption;
          await sound(clip, request);
        }
        if (version === request) live.textContent = 'Ha terminado la escucha.';
      } catch {
        if (version === request) live.textContent = 'La reproducción no está disponible. Puedes comparar las descripciones y montar los fragmentos.';
      } finally {
        if (version === request) { stop(); stopButton.disabled = true; }
      }
    }

    const clipButtons = data.clips.map((clip, i) => {
      const card = node('div', null, 'vt-item');
      const controls = node('div', null, 'vt-controls');
      const pick = button('Añadir al montaje', () => {
        const at = selected.indexOf(i);
        if (at < 0) selected.push(i);
        else selected.splice(at, 1);
        render();
      });
      const listen = button('Escuchar', () => play([i]));
      listen.setAttribute('aria-label', 'Escuchar ' + clip.label);
      controls.append(listen, pick);
      card.append(node('strong', clip.label), node('p', clip.light), node('p', clip.caption), controls);
      board.append(card);
      return pick;
    });
    const playButton = button('Escuchar mi montaje', () => play([...selected]));
    const stopButton = button('Detener escucha', () => { stop(); stopButton.disabled = true; live.textContent = 'Escucha detenida.'; });
    stopButton.disabled = true;
    function render() {
      list.replaceChildren(...selected.map(i => node('li', data.clips[i].label, 'vt-row')));
      clipButtons.forEach((item, i) => {
        const active = selected.includes(i);
        item.setAttribute('aria-pressed', String(active));
        item.textContent = active ? 'Retirar del montaje' : 'Añadir al montaje';
        item.setAttribute('aria-label', item.textContent + ' · ' + data.clips[i].label);
      });
      playButton.disabled = !selected.length;
      live.textContent = selected.length ? 'Fragmentos en tu montaje: ' + selected.length + '.' : 'El montaje está vacío.';
    }
    const toolbar = node('div', null, 'vt-toolbar');
    toolbar.append(playButton, stopButton);
    area.append(board, list, toolbar, live);
    render();
    return area;
  }

  Object.assign(window.ValdemarTalleres ||= {}, {1: chain, 2: plans, 3: clocks, 4: cuts});
})();
