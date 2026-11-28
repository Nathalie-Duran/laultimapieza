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
  function button(text, name, action) {
    const node = el('button',text);
    node.type = 'button';
    node.setAttribute('aria-label',name);
    node.addEventListener('click',action);
    return node;
  }
  function classed(tag, name, text) {
    const node = el(tag,text);
    node.className = name;
    return node;
  }
  function inspection(selector, items, update) {
    const deck = classed('div','instrument-deck');
    const markers = items.map((item,i) => {
      const marker = button(String(i+1).padStart(2,'0'),item.label,() => {
        selector.input.value = String(i);
        update();
      });
      marker.append(classed('span','instrument-marker-label',item.label));
      deck.append(marker);
      return marker;
    });
    function refresh(){
      markers.forEach((marker,i)=>marker.setAttribute('aria-pressed',String(selector.input.value===String(i))));
    }
    selector.field.className = 'instrument-native-picker';
    return {deck,refresh};
  }
  function lock(panel, definition) {
    const records=classed('div','instrument-records');
    for (const {caption,rows,headers} of definition.tables) {
      const table = el('table');
      table.append(el('caption',caption));
      const headings = el('tr');
      for (const heading of headers || ['Hora','Consigna']) {
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
      table.append(head,body);records.append(table);
    }
    const {field,input} = inputLine('Código de cuatro cifras',{inputMode:'numeric',maxLength:4,pattern:'[0-9]{4}',autoComplete:'off'});
    const wheels=classed('div','instrument-wheels');
    const digits=[];
    function sync(){
      digits.forEach((digit,i)=>{digit.textContent=input.value[i] ?? '·';});
    }
    for(let i=0;i<4;i++){
      const wheel=classed('div','instrument-wheel'),digit=el('strong','·');
      digit.setAttribute('aria-hidden','true');
      function turn(delta){
        const code=input.value.replace(/\D/g,'').padEnd(4,'0').split('');
        code[i]=String((Number(code[i])+delta+10)%10);
        input.value=code.join('');
        sync();
        status.textContent='Código '+code.join(' ');
      }
      digits.push(digit);
      wheel.append(button('+','Subir cifra '+(i+1),()=>turn(1)),digit,button('−','Bajar cifra '+(i+1),()=>turn(-1)));
      wheels.append(wheel);
    }
    const status=output();
    status.className='instrument-sr';
    input.addEventListener('input',sync);
    panel.append(records,wheels,field,status);
    return () => input.value;
  }
  function circuit(panel, definition) {
    const group = el('fieldset');
    group.className='instrument-switches';
    group.append(el('legend','Selectores de la maqueta'));
    const indicators = output();
    const lamps=classed('div','instrument-lamps');
    lamps.setAttribute('aria-hidden','true');
    const bulbs=(definition.lamps || ['Faro','Boya','Grúa']).map(name=>{
      const bulb=classed('span','instrument-bulb',name),state=el('small');
      bulb.append(state);lamps.append(bulb);return {bulb,state};
    });
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
      const [a,b,c] = switches.map(control=>Number(control.checked));
      const board=definition.placa;
      const signals=board&&window.MotorAventuras?.evaluarPrueba
        ?board.salidas.map(salida=>window.MotorAventuras.evaluarPrueba({
          tipo:'mecanica',mecanica:'circuito',parametros:{interruptores:{a,b,c},puertas:board.puertas,salida}
        },1))
        :[a!==b,Boolean(b&&!c),Boolean(a||c)];
      bulbs.forEach(({bulb,state},i)=>{
        bulb.setAttribute('data-lit',String(signals[i]));
        state.textContent=signals[i]?'Encendido':'Apagado';
      });
      indicators.textContent = definition.lamps ? definition.lamps.map((name,i)=>name + ': ' + (signals[i] ? 'sí' : 'no')).join(' · ') : [
        a!==b ? 'Faro encendido':'Faro apagado',
        b&&!c ? 'Boya encendida':'Boya apagada',
        a||c ? 'Grúa encendida':'Grúa apagada'
      ].join(' · ');
    }
    indicators.className='instrument-sr';
    show();panel.append(group,lamps,indicators);
    return () => switches.map(item=>item.checked ? '1' : '0').join('');
  }
  function lamp(panel, definition) {
    const beam = choices('Orientación de la linterna',[['direct','Luz frontal'],['raking','Luz rasante']],illuminate);
    const target = choices(definition.zoneLabel || 'Zona del marco',definition.zones.map((zone,i)=>[String(i),zone.label]),illuminate);
    const observation = output();
    const inspectionDeck=inspection(target,definition.zones,illuminate);
    observation.className='instrument-reading';
    function illuminate() {
      observation.textContent = definition.zones[Number(target.input.value)][beam.input.value];
      inspectionDeck.refresh();
      inspectionDeck.deck.setAttribute('data-light',beam.input.value);
    }
    const {field,input} = inputLine(definition.answerLabel || 'Palabra tallada',{maxLength:3,minLength:3,autoComplete:'off'});
    illuminate();panel.append(beam.field,target.field,inspectionDeck.deck,observation,field);
    return () => input.value;
  }
  function strata(panel, definition) {
    const view = choices(definition.sampleLabel || 'Profundidad de la muestra',definition.samples.map((sample,i)=>[String(i),sample.label]),inspect);
    const reading = output();
    const tray=inspection(view,definition.samples,inspect);
    reading.className='instrument-reading';
    function inspect() { reading.textContent = definition.samples[Number(view.input.value)].detail;tray.refresh(); }
    inspect();panel.append(view.field,tray.deck,reading);
    const sequence=classed('div','instrument-sequence');
    const positions = (definition.positionLabels || ['Signo más antiguo','Segundo signo','Signo más reciente']).map(name=>{
      const choice = choices(name,[['','Selecciona un signo'],...definition.symbols]);
      choice.input.required=true;
      const row=el('p');row.append(choice.field);sequence.append(row);
      return choice.input;
    });
    panel.append(sequence);
    return () => positions.map(item=>item.value).join('-');
  }
  const instruments = {lock,circuit,lamp,strata};
  function render(container, definition, solved, onSubmit) {
    const build = definition && Object.hasOwn(instruments,definition.kind) && instruments[definition.kind];
    if (!build) return;
    const section = el('section');
    section.className = 'vd-taller instrument-table instrument-'+definition.kind;
    section.setAttribute('aria-label',definition.title);
    section.append(el('h4',definition.title));
    container.append(section);
    if (solved) { section.append(el('p','Prueba de campo resuelta y guardada.')); return; }
    const head=classed('div','instrument-head'),image=el('img'),copy=el('div');
    const photos={lock:'cierre',circuit:'panel',lamp:'luz',strata:'muestras'};
    image.src='/instrumento-'+photos[definition.kind]+'.webp';
    image.alt='';image.width=480;image.height=480;image.loading='lazy';
    copy.append(el('p',definition.brief),el('p',definition.note));head.append(image,copy);section.append(head);
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
