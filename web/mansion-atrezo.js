(() => {
  'use strict';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function photograph(name) {
    const photo = element('img', 'atrezo-photo');
    photo.src = '/mansion-instrument-' + name + '.webp';
    photo.alt = '';
    photo.decoding = 'async';
    photo.draggable = false;
    return photo;
  }

  function clock(field, draft) {
    const shortHand = field.id === 'agujaHoras';
    const wrap = element('fieldset', 'mansion-control atrezo-control');
    const figure = element('div', 'atrezo-clock');
    const dial = element('div', 'atrezo-clock-dial');
    const hand = element('span', 'atrezo-clock-hand' + (shortHand ? ' short' : ''));
    const hub = element('span', 'atrezo-clock-hub');
    const readout = element('output', 'atrezo-readout');
    const buttons = [];
    const options = field.options;
    const roman = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    let active = options.findIndex(option => String(option.value) === String(draft[field.id]));
    dial.setAttribute('role', 'radiogroup');
    dial.setAttribute('aria-label', field.label);
    hand.setAttribute('aria-hidden', 'true');
    hub.setAttribute('aria-hidden', 'true');
    function show() {
      const tabStop = active < 0 ? 0 : active;
      for (const [index, button] of buttons.entries()) {
        button.tabIndex = index === tabStop ? 0 : -1;
        button.setAttribute('aria-checked', String(index === active));
      }
      hand.hidden = active < 0;
      if (active < 0) { readout.textContent = 'Elige una cifra en la esfera.'; return; }
      const value = Number(options[active].value);
      hand.style.setProperty('--hand-angle', (shortHand ? value * 30 : value * 6) + 'deg');
      readout.textContent = (shortHand ? 'Aguja corta · ' : 'Aguja larga · ') + value + (shortHand ? ' h' : ' min');
    }
    function choose(index) {
      active = index;
      draft[field.id] = String(options[index].value);
      show();
    }
    for (const [index, option] of options.entries()) {
      const value = Number(option.value);
      const position = shortHand ? value % 12 : value / 5;
      const angle = position * Math.PI / 6;
      const button = element('button', 'atrezo-hour-mark', shortHand ? roman[position] : String(value).padStart(2, '0'));
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', option.label);
      button.style.left = (50 + 40 * Math.sin(angle)) + '%';
      button.style.top = (50 - 40 * Math.cos(angle)) + '%';
      button.addEventListener('click', () => choose(index));
      button.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else return;
        event.preventDefault();
        choose(next);
        buttons[next].focus();
      });
      buttons.push(button);
      dial.append(button);
    }
    dial.append(hand, hub);
    figure.append(photograph('reloj'), dial);
    wrap.append(element('legend', null, field.label), figure, readout);
    show();
    return wrap;
  }

  function radio(field, draft) {
    const wrap = element('fieldset', 'mansion-control atrezo-control');
    const figure = element('div', 'atrezo-radio');
    const glass = element('div', 'atrezo-radio-scale');
    const tickLine = element('span', 'atrezo-ticks');
    const needle = element('span', 'atrezo-radio-needle');
    const input = element('input', 'atrezo-tuner');
    const readout = element('output', 'atrezo-readout');
    const divisions = Array.isArray(field.options) && field.options.length > 0;
    const values = divisions ? field.options.map(option => String(option.value)) : Array.from({length:12}, (_,i) => String(600 + i * 10));
    input.type = 'range';
    input.min = divisions ? '0' : values[0];
    input.max = divisions ? String(values.length - 1) : values[values.length - 1];
    input.step = divisions ? '1' : '10';
    const previous = Math.max(0, values.indexOf(String(draft[field.id])));
    input.value = divisions ? String(previous) : values[previous];
    input.setAttribute('aria-label', field.label);
    tickLine.setAttribute('aria-hidden', 'true');
    needle.setAttribute('aria-hidden', 'true');
    const printed = divisions ? values : ['600','630','660','690','710'];
    tickLine.style.setProperty('--radio-intervals', String(Math.max(1,values.length - 1)));
    for (const value of printed) {
      const mark = element('span', 'atrezo-tick-label', divisions ? field.options[values.indexOf(value)].label : value);
      mark.style.left = (100 * values.indexOf(value) / Math.max(1, values.length - 1)) + '%';
      mark.setAttribute('aria-hidden', 'true');
      tickLine.append(mark);
    }
    function tune() {
      const index = divisions ? Number(input.value) : values.indexOf(input.value);
      draft[field.id] = values[index];
      needle.style.left = (100 * index / Math.max(1,values.length - 1)) + '%';
      readout.textContent = divisions ? 'División ' + field.options[index].label : values[index] + ' kHz';
      input.setAttribute('aria-valuetext', divisions ? readout.textContent : values[index] + ' kilohercios');
    }
    input.addEventListener('input', tune);
    glass.append(tickLine, needle, input);
    figure.append(photograph('radio'), glass);
    wrap.append(element('legend', null, field.label), figure, readout);
    tune();
    return wrap;
  }
  window.MansionAtrezo = Object.freeze({clock, radio});
})();
