(() => {
  'use strict';
  function el(tag, text) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    return element;
  }
  function inputLine(label, attributes) {
    const field = el('label', label + ' ');
    const input = el('input');
    Object.assign(input, attributes);
    input.required = true;
    field.append(input);
    return {field,input};
  }
  function choices(label, entries, onChange) {
    const field = el('label', label + ' ');
    const input = el('select');
    for (const [value, text] of entries) {
      const option = el('option', text);
      option.value = value;
      input.append(option);
    }
    if (onChange) input.addEventListener('change', onChange);
    field.append(input);
    return {field,input};
  }
  function output() {
    const element = el('p');
    element.setAttribute('role','status');
    return element;
  }
  function lock(panel, definition) {
    for (const {caption,rows} of definition.tables) {
      const table = el('table');
      table.append(el('caption',caption));
      const headings = el('tr');
      for (const heading of ['Hora','Consigna']) {
        const cell = el('th',heading);
        cell.scope='col';
        headings.append(cell);
      }
      const head = el('thead');
      head.append(headings);
      const body = el('tbody');
      for (const row of rows) {
        const tr = el('tr');
        for (const datum of row) tr.append(el('td',datum));
        body.append(tr);
      }
      table.append(head,body);panel.append(table);
    }
    const {field,input} = inputLine('Código de cuatro cifras',{inputMode:'numeric',maxLength:4,pattern:'[0-9]{4}',autoComplete:'off'});
    panel.append(field);
    return () => input.value;
  }
  function circuit(panel, definition) {
    const group = el('fieldset');
    group.append(el('legend','Selectores de la maqueta'));
    const indicators = output();
    const switches = definition.switches.map(name => {
      const label = el('label');
      const control = el('input');
      control.type = 'checkbox';
      control.addEventListener('change',show);
      label.append(control,document.createTextNode(' '+name));
      const row = el('p');row.append(label);group.append(row);
      return control;
    });
    function show() {
      const [a,b,c] = switches.map(control=>control.checked);
      indicators.textContent = [
        a!==b ? 'Faro encendido':'Faro apagado',
        b&&!c ? 'Boya encendida':'Boya apagada',
        a||c ? 'Grúa encendida':'Grúa apagada'
      ].join(' · ');
    }
    show();panel.append(group,indicators);
    return () => switches.map(item=>item.checked ? '1' : '0').join('');
  }
  function lamp(panel, definition) {
    const beam = choices('Orientación de la linterna',[['direct','Luz frontal'],['raking','Luz rasante']],illuminate);
    const target = choices('Zona del marco',definition.zones.map((zone,i)=>[String(i),zone.label]),illuminate);
    const observation = output();
    function illuminate() {
      observation.textContent = definition.zones[Number(target.input.value)][beam.input.value];
    }
    const {field,input} = inputLine('Palabra tallada',{maxLength:3,minLength:3,autoComplete:'off'});
    illuminate();panel.append(beam.field,target.field,observation,field);
    return () => input.value;
  }
  function strata(panel, definition) {
    const view = choices('Profundidad de la muestra',definition.samples.map((sample,i)=>[String(i),sample.label]),inspect);
    const reading = output();
    function inspect() { reading.textContent = definition.samples[Number(view.input.value)].detail; }
    inspect();panel.append(view.field,reading);
    const positions = ['Signo más antiguo','Segundo signo','Signo más reciente'].map(name=>{
      const choice = choices(name,[['','Selecciona un signo'],...definition.symbols]);
      choice.input.required=true;
      const row=el('p');row.append(choice.field);panel.append(row);
      return choice.input;
    });
    return () => positions.map(item=>item.value).join('-');
  }
  const instruments = {lock,circuit,lamp,strata};
  function render(container, definition, solved, onSubmit) {
    const build = definition && Object.hasOwn(instruments,definition.kind) && instruments[definition.kind];
    if (!build) return;
    const section = el('section');
    section.className = 'vd-taller';
    section.setAttribute('aria-label',definition.title);
    section.append(el('h4',definition.title));
    container.append(section);
    if (solved) { section.append(el('p','Prueba de campo resuelta y guardada.')); return; }
    section.append(el('p',definition.brief),el('p',definition.note));
    const form = el('form'), panel = el('fieldset');
    panel.append(el('legend','Mesa de trabajo'));
    const read = build(panel,definition);
    const submit = el('button','Comprobar');
    submit.type = 'submit';
    const status = output();
    status.tabIndex=-1;
    panel.append(submit);form.append(panel,status);section.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (panel.disabled) return;
      const answer = read();
      panel.disabled = true;
      let success = false;
      try {
        const result = await onSubmit(answer);
        success = result === true || result?.correct === true;
        status.textContent = success ? 'Prueba de campo resuelta y guardada.' : 'El resultado no coincide con las pistas. Puedes ajustar la mesa y volver a comprobar.';
      } catch (error) {
        status.textContent = error?.message || 'No se ha podido guardar. Vuelve a intentarlo.';
      } finally {
        panel.disabled = success;
        if (status.isConnected) status.focus({preventScroll:true});
      }
    });
  }
  window.FieldInstruments = Object.freeze({render});
})();
