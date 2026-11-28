(() => {
  'use strict';

  const sampleRate = 16000;
  const tau = 2 * Math.PI;
  const cachedSounds = new Map();
  let serial = 0;

  function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  const sine = (frequency, time) => Math.sin(tau * frequency * time);
  const hit = (time, onset, attack, decay) => {
    const age = time - onset;
    return age < 0 ? 0 : (1 - Math.exp(-age / attack)) * Math.exp(-age / decay);
  };
  const effects = {
    campana: { length: 1.60, render: t => hit(t, 0, .004, .43) * (.48*sine(520,t) + .22*sine(1300,t) + .10*sine(2213,t)) },
    golpe: { length: .48, render: (t, noise) => hit(t, 0, .003, .088) * (.75*sine(104,t) + .23*sine(154,t) + .15*noise) },
    papel: { length: 1.03, render: (t, noise, previous) => {
      const bursts = hit(t, .01, .012, .11) + .76*hit(t, .22, .03, .12) + hit(t, .53, .012, .16);
      return (.45*(noise - previous) + .09*noise) * bursts * (.72 + .28*sine(29,t));
    }},
    agua: { length: 1.29, render: t => {
      let sound = 0;
      for (const [start, tone] of [[0, 690], [.39, 845], [.81, 720]]) {
        const age = t - start;
        if (age >= 0) sound += hit(t, start, .005, .065) * Math.sin(tau * (tone * age + 7.8*(1 - Math.exp(-age*33))));
      }
      return sound * .62;
    }},
    clic: { length: .23, render: (t, noise) => hit(t, 0, .0009, .011) * (.64*noise + .27*sine(2200,t)) + hit(t, .031, .001, .009) * .24*sine(1600,t) },
    motor: { length: 1.8, render: (t, noise) => {
      const phase = tau * (44*t + 9*t*t);
      const envelope = Math.min(1, t*5, (1.8-t)*5);
      return envelope * (.33*Math.sin(phase) + .2*Math.sin(2*phase) + .1*Math.sin(4*phase) + .08*noise);
    }},
    pasos: { length: 1.47, render: (t, noise) => {
      const envelope = hit(t, .02, .004, .068) + .83*hit(t, .49, .006, .075) + hit(t, .98, .004, .065);
      return envelope * (.69*sine(103,t) + .22*noise);
    }},
    timbre: { length: 1.19, render: t => hit(t, 0, .005, .15) * (.58*sine(780,t)+.19*sine(1560,t)) + hit(t, .39, .004, .23) * (.53*sine(622,t)+.14*sine(1244,t)) },
    pausa: { length: 1.15, render: () => 0 }
  };

  function recording(sequence) {
    const names = sequence.map(normalize);
    const key = names.join('/');
    if (cachedSounds.has(key)) return cachedSounds.get(key);
    const events = names.map(name => effects[name]);
    if (events.some(effect => !effect)) throw new Error('Hay un efecto de sonido sin definir en la secuencia.');
    const gap = Math.round(.21 * sampleRate);
    const lead = Math.round(.26 * sampleRate);
    const count = lead * 2 + events.reduce((sum, effect) => sum + Math.ceil(effect.length*sampleRate), 0) + Math.max(0, events.length-1)*gap;
    const bytes = new Uint8Array(44 + count*2);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, value) => {
      for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
    ascii(0,'RIFF'); view.setUint32(4,bytes.length-8,true); ascii(8,'WAVE'); ascii(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true); view.setUint16(34,16,true); ascii(36,'data'); view.setUint32(40,count*2,true);
    let cursor = lead, seed = 37119, previousNoise = 0;
    for (const effect of events) {
      const samples = Math.ceil(effect.length * sampleRate);
      for (let i = 0; i < samples; i++) {
        seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        const t = i / sampleRate;
        const edge = Math.min(1, (samples-i) / (.012*sampleRate));
        const value = effect.render(t, noise, previousNoise) * edge;
        view.setInt16(44 + 2*(cursor+i), Math.round(26500*Math.max(-1, Math.min(1,value))), true);
        previousNoise = noise;
      }
      cursor += samples + gap;
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i+8192));
    const uri = 'data:audio/wav;base64,' + btoa(binary);
    cachedSounds.set(key,uri);
    return uri;
  }

  // Índices de las etapas que utilizan el material de campo del encargo.
  const fieldSources = {
    4: { index: 2, kinds: ['audio', 'visual', 'text'] },
    5: { index: 2, kinds: ['audio', 'visual'] },
    6: { index: 0, kinds: ['audio', 'visual', 'web'] },
    7: { index: 0, kinds: ['audio', 'visual', 'web'] },
    8: { index: 0, kinds: ['audio', 'visual', 'web'] }
  };

  function materials(caseId,index,sample) {
    const selection=fieldSources[caseId];
    if (!sample || !selection || selection.index!==index || Number(sample.id)!==Number(caseId)) return [];
    const result=[];
    for (const kind of selection.kinds) {
      const item={id:'anexo-'+kind,role:'AB',kind};
      if (kind==='audio' && sample.sound?.length && sample.transcript) {
        Object.assign(item,{label:sample.soundTitle,body:sample.transcript,clip:recording(sample.sound)});
      } else if (kind==='visual' && sample.panels?.length) {
        const descriptions=sample.panels.map(panel=>panel.label+' · '+panel.detail);
        Object.assign(item,{label:sample.pictureTitle,body:[...descriptions,sample.pictureAlt].filter(Boolean).join('\n')});
      } else if (kind==='text' && sample.note) {
        Object.assign(item,{label:sample.noteTitle,body:sample.note});
      } else if (kind==='web' && sample.rows?.length) {
        const rows=sample.rows.map(row=>[row.name,row.place,row.detail].join(' | '));
        Object.assign(item,{label:sample.siteTitle,body:rows.join('\n')});
      }
      if (item.label && item.body) result.push(item);
    }
    return result;
  }

  function el(type, text, className) {
    const element = document.createElement(type);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function svgEl(type, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', type);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
    return node;
  }
  const icons = {
    reloj: 'M16 1.8a14.2 14.2 0 1 0 .1 0z M16 5v1.6 M26.5 16h-1.7 M16 26.5V25 M5.5 16h1.7 M16 8v8l6 3',
    puerta: 'M4 29h24 M7 28V4h19v24 M10 27V6l12 3v19z M18.5 17v2',
    carta: 'M2.5 6h27v20h-27z M3.8 7.6l12.2 10 12.2-10 M3.8 24.7l8.6-8.1m15.8 8.1-8.6-8.1',
    banco: 'M4 7h24v4H4z M4 13h24v4H4z M2 19h28v3H2z M6 22v6m20-6v6 M7 17v2m18-2v2',
    camara: 'M3 9h7l2-4h8l2 4h7v17H3z M21.5 17a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z M23.5 12H26',
    mesa: 'M3 13q13-10 26 0-13 10-26 0z M7 16v10m18-10v10M15.8 18v9',
    flor: 'M16 24v6m0-4c-5 0-7-3-7-5 4-.2 7 2 7 5z M17 24c3-5 6-6 9-5-1 4-4 6-9 5z M16 7C12-1 7 4 11 9 2 7 1 15 9 15c-5 6 2 10 7 3 4 8 11 3 7-3 9 1 7-7-1-6 3-6-2-9-6-2z M18.6 12a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    tablero: 'M3 3h26v26H3z M3 12h26M3 21h26M12 3v26m9-26v26 M9 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z M17.8 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    barco: 'M2 21h28l-5 6H8z M15 4v16H5z M18 5l8 12h-8z M2 29q3-2 6 0t6 0 6 0 6 0 5 0',
    billete: 'M3 7h26v6a3 3 0 0 0 0 6v6H3v-6a3 3 0 0 0 0-6z M20 8v1m0 3v1m0 3v1m0 3v1m0 3v.4 M7.5 12h8m-8 4h6',
    campana: 'M4 23c4-3 4-5 4-11a8 8 0 0 1 16 0c0 6 0 8 4 11z M12 26q4 6 8 0 M15 4V2h2v2',
    llave: 'M15 12a6.5 6.5 0 1 1-5-7.2A6.5 6.5 0 0 1 15 12z M13 16l12 12h4v-4h-3v-3h-3l-7.3-7.3 M8 10h1',
    maleta: 'M4 9h24a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z M11 9V5h10v4 M7 10v17m18-17v17',
    torre: 'M6 29h20M9 28l2-17h10l2 17z M9 8h14v3H9z M11 7V4l5-2 5 2v3 M14 17h4m-4 4h4',
    huella: 'M5 5c-3 2-3 6-1 9l4 5 5-3-1-6C11 6 8 3 5 5z M9 22l5-3 2 3-4 3z M24 8c3 1 4 5 3 9l-3 6-6-2 1-6c1-5 2-8 5-7z M18 24l6 2-1 3-5-1z',
    onda: 'M1 17h4l2-4 2 8 3-15 4 21 3-23 3 19 2-11 3 7 2-2h2'
  };
  function illustration(icon, alt, n) {
    const svg = svgEl('svg',{viewBox:'0 0 144 76',role:'img','aria-label':alt});
    const bg = svgEl('rect',{x:0,y:0,width:144,height:76,rx:3,fill:['#e9ddbd','#d9e2d7','#e6d5c9'][n%3]});
    const grid = svgEl('path',{d:'M8 12h13m-6.5-6v12m108 46h13m-6.5-6v12M2 68h33m74-60h33',stroke:'#738578',opacity:'.55',fill:'none'});
    const symbol = svgEl('path',{d:icons[normalize(icon)] || icons.carta,fill:'none',stroke:'#233e38','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(43,8) scale(1.8)'});
    svg.append(bg,grid,symbol);
    return svg;
  }

  function illustrate({caseId,index,shelf,controller}) {
    const sample=controller.sample;
    if (!sample || fieldSources[caseId]?.index!==index || Number(sample.id)!==Number(caseId)) return;
    const card=shelf.querySelector('[data-material="anexo-visual"]');
    const body=card?.querySelector('.ve-content, .vhour-plate');
    if (!body || !sample.panels?.length) return;
    const strip=el('div');
    strip.style.display='grid';
    strip.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,10rem),1fr))';
    strip.style.gap='1rem';
    for (const [n,panel] of sample.panels.entries()) {
      const frame=el('figure');
      frame.style.margin='0';
      const drawing=illustration(panel.icon,panel.label,n);
      drawing.setAttribute('aria-hidden','true');
      drawing.setAttribute('width','100%');
      const caption=el('figcaption');
      caption.append(el('strong',panel.label),el('p',panel.detail));
      frame.append(drawing,caption);
      strip.append(frame);
    }
    body.replaceChildren(strip);
    if (sample.pictureAlt) {
      const description=el('details');
      description.append(el('summary','Leer la descripción de la lámina'),el('p',sample.pictureAlt));
      body.append(description);
    }
  }

  function exhibit(kind, title) {
    const details = el('details',null,'documento');
    details.append(el('summary',kind+' · '+title));
    return details;
  }
  function audioEvidence(p) {
    const block = exhibit('Audio',p.soundTitle);
    const player = el('audio');
    player.controls = true;
    player.preload = 'none';
    player.setAttribute('aria-label',p.soundTitle);
    player.src = recording(p.sound);
    const transcript = exhibit('Leer','Transcripción sonora');
    transcript.append(el('p',p.transcript));
    block.append(player,transcript);
    return block;
  }
  function pictureEvidence(p) {
    const block = exhibit('Imagen',p.pictureTitle);
    const strip = el('div',null,'mesa-tiras');
    for (const [n,panel] of p.panels.entries()) {
      const frame = el('figure',null,'mesa-lamina');
      frame.append(illustration(panel.icon,panel.label,n));
      const caption = el('figcaption');
      caption.append(el('strong',panel.label),el('span',panel.detail));
      frame.append(caption);
      strip.append(frame);
    }
    const description = exhibit('Leer','Descripción de la lámina');
    description.append(el('p',p.pictureAlt));
    block.append(strip,description);
    return block;
  }
  function noteEvidence(p) {
    const block = exhibit('Documento',p.noteTitle);
    const note = el('div',null,'mesa-nota');
    for (const paragraph of String(p.note).split(/\n+/).filter(Boolean)) note.append(el('p',paragraph));
    block.append(note);
    return block;
  }
  function siteEvidence(p, id) {
    const block = exhibit('Web del caso',p.siteTitle);
    const explorer = el('div',null,'mesa-archivo');
    const label = el('label','Buscar por nombre, lugar o dato del registro');
    const search = el('input');
    search.type = 'search';
    search.id = id+'-buscar';
    label.htmlFor = search.id;
    const count = el('p',null,'estado');
    count.setAttribute('role','status');
    const list = el('ul',null,'mesa-registros');
    const entries = p.rows.map(row => ({row,index:normalize([row.name,row.place,row.detail].join(' '))}));
    function filter() {
      const words = normalize(search.value).split(/\s+/).filter(Boolean);
      const matches = entries.filter(entry => words.every(word => entry.index.includes(word)));
      list.replaceChildren();
      for (const {row} of matches) {
        const item = el('li',null,'registro');
        item.append(el('strong',row.name),el('span',row.place),el('p',row.detail));
        list.append(item);
      }
      count.textContent = matches.length ? matches.length+' de '+entries.length+' registros visibles.' : 'Sin coincidencias. Prueba con otra palabra o borra la búsqueda.';
    }
    const clear = el('button','Ver todos los registros','secundario');
    clear.type = 'button';
    clear.addEventListener('click',() => { search.value=''; filter(); search.focus(); });
    search.addEventListener('input',filter);
    explorer.append(label,search,clear,count,list);
    block.append(explorer);
    filter();
    return block;
  }
  function verdict(p, id, checkAnswer) {
    const area = el('section',null,'mesa-hipotesis');
    const question = el('h3','Contrastar una hipótesis');
    const group = el('fieldset');
    group.append(el('legend','Elige la explicación que encaja con las pruebas.'));
    const options = p.answers.map((answer,i) => {
      const line = el('label');
      const radio = el('input');
      radio.type='radio'; radio.name=id+'-respuesta'; radio.value=String(i);
      line.append(radio,el('span',answer));
      group.append(line);
      return radio;
    });
    const submit = el('button','Contrastar hipótesis');
    submit.type='button';
    const status = el('p',null,'estado');
    status.setAttribute('role','status');
    submit.addEventListener('click',async () => {
      if (submit.disabled) return;
      const selected = options.findIndex(radio => radio.checked);
      if (selected < 0) {
        status.textContent = 'Selecciona una hipótesis para contrastarla.';
        return;
      }
      submit.disabled = true;
      group.disabled = true;
      status.textContent = 'Contrastando las pruebas…';
      let solved = false;
      try {
        const result = await checkAnswer(selected);
        solved = result?.correct === true;
        status.textContent = solved ? 'Hipótesis corroborada. '+result.explanation :
          'Esta hipótesis deja alguna prueba sin explicar. Revisa la secuencia del audio, la lámina y el registro antes de volver a intentarlo.';
      } catch (error) {
        status.textContent = error.message || 'No se ha podido contrastar la hipótesis. Puedes volver a intentarlo.';
      } finally {
        submit.disabled = solved;
        group.disabled = solved;
      }
    });
    area.append(question,group,submit,status);
    return area;
  }

  const styles = `
    .mesa-medios{display:grid;gap:.9rem;min-width:0;max-width:56rem}
    .mesa-medios .documento{display:block;margin:0;border:1px solid #79897f;border-radius:.6rem;padding:.85rem .95rem;min-width:0;background:transparent}
    .mesa-medios .documento>summary{cursor:pointer;line-height:1.45;font-weight:650;list-style:revert;display:list-item}
    .mesa-medios .documento .documento{margin-top:.8rem;border-style:dashed}
    .mesa-medios audio{display:block;width:100%;max-width:40rem;margin:.85rem 0 .3rem}
    .mesa-medios .mesa-tiras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr));gap:.6rem;margin-block:1rem}
    .mesa-medios .mesa-lamina{display:block;min-width:0;margin:0;padding:.5rem;background:#f1ecdd;color:#263a33;border-radius:.4rem}
    .mesa-medios .mesa-lamina svg{width:100%;height:auto;display:block}
    .mesa-medios .mesa-lamina figcaption{display:grid;gap:.35rem;margin:.5rem 0 .15rem;font-size:.98rem;line-height:1.4}
    .mesa-medios .mesa-nota{margin-top:1rem;padding:.4rem 1rem;background:#f3e9cf;border-inline-start:.25rem solid #a97948;color:#322e28;line-height:1.65}
    .mesa-medios .mesa-archivo{display:grid;gap:.5rem;margin-top:1rem}
    .mesa-medios .mesa-archivo>input{box-sizing:border-box;width:100%;max-width:34rem;border:1px solid #718277;border-radius:.35rem;padding:.65rem;font:inherit}
    .mesa-medios .mesa-archivo>button{justify-self:start}
    .mesa-medios .mesa-registros{list-style:none;padding:0;display:grid;gap:.65rem}
    .mesa-medios .registro{display:grid;gap:.2rem;padding:.8rem;border:1px solid #75857b;border-radius:.35rem}
    .mesa-medios .registro>p{margin:.2rem 0}
    .mesa-medios fieldset{min-width:0;padding:.7rem .8rem;border:1px solid #75857b;border-radius:.5rem;margin-bottom:.7rem}
    .mesa-medios .mesa-hipotesis label{display:flex;gap:.55rem;align-items:baseline;padding:.45rem 0;cursor:pointer}
    .mesa-medios .mesa-hipotesis input{flex:none;inline-size:1rem;block-size:1rem}
    .mesa-medios :focus-visible{outline:3px solid #ae7e3b;outline-offset:3px}
    .mesa-medios .estado{min-height:1.4em;margin:.4rem 0;line-height:1.5}
  `;
  window.ValdemarMesa = {materials,illustrate};
  window.montarMesa = function montarMesa(host,p,checkAnswer) {
    const id='mesa-'+(++serial);
    const section=el('section',null,'mesa-medios');
    const heading=el('h3',p.task);
    heading.id=id+'-tarea';
    section.setAttribute('aria-labelledby',heading.id);
    const css=el('style',styles);
    section.append(css,heading,audioEvidence(p),pictureEvidence(p),noteEvidence(p),siteEvidence(p,id),verdict(p,id,checkAnswer));
    host.replaceChildren(section);
  };
})();
