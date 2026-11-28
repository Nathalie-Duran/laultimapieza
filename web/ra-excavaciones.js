(() => {
  'use strict';

  // The artwork identifies the case. All selectable answers and document readings
  // come from the stage currently projected by the game server.
  const cases = {
    37: ['Casco y amarra del Nilo', 'Cuaderno del guardamuelles', ['Trazar las dos derivas', 'Cotejar las improntas', 'Tender la línea de relevos', 'Preparar el cargamento', 'Enlazar el manifiesto']],
    38: ['Clepsidra de piedra', 'Banco de las clepsidras', ['Medir las dos cubetas', 'Fijar el instante de la sombra', 'Calibrar la escala de pulsos', 'Reconstruir el paso del agua', 'Cotejar el rollo de entrada']],
    39: ['Cartucho bajo el enlucido', 'Mesa de restauración', ['Levantar la sección del muro', 'Unir las placas del cartucho', 'Atribuir la intervención', 'Sondear la cuadrícula', 'Documentar la conservación']],
    40: ['Lino azul con sello de barro', 'Banco de la tejedora', ['Comparar las réplicas', 'Envolver el cilindro', 'Pesar las dos entregas', 'Leer el tejido', 'Reconstruir la orden']],
    41: ['Maqueta de una puerta tallada', 'Levantamiento de la capilla', ['Orientar la losa', 'Sondear las siete hojas', 'Trazar la senda', 'Fijar el punto de vista', 'Recorrer las puertas talladas']],
    42: ['Estanque de piedra pulida', 'Observatorio del estanque', ['Dibujar el reflejo', 'Emparejar los turnos', 'Contrastar la altura del foco', 'Aislar la señal', 'Transmitir las tres órdenes']],
    43: ['Vasija de perfume y tapón', 'Taller de la raíz y el loto', ['Examinar los cuellos', 'Comparar las mezclas', 'Reconstruir la travesía', 'Descontar la tara', 'Repartir los documentos']],
    44: ['Fragmentos de cerámica escrita', 'Mesa del alfarero', ['Recomponer el recipiente', 'Ordenar las voces del juicio', 'Volver la pieza', 'Reconstruir el traslado', 'Corregir el acta']],
    45: ['Sección de la galería sonora', 'Puesto de escucha', ['Distinguir la voz del eco', 'Medir el retorno', 'Seguir los conductos', 'Componer el aviso', 'Redactar la declaración']],
    46: ['Cuadernas de la barca solar', 'Grada del astillero', ['Orientar la proa', 'Encajar las tablas', 'Equilibrar la cubierta', 'Reconstruir el encuadre', 'Ordenar los partes de puerto']],
    47: ['Relieve y lámpara de Neryt', 'Cámara de luz rasante', ['Ensayar las dos luces', 'Separar las intervenciones', 'Situar a la portadora', 'Restituir el gesto', 'Fundar la atribución']],
    48: ['Tres piezas de un disco solar', 'Mesa del santuario', ['Montar el dispositivo', 'Alinear las dos ranuras', 'Localizar el banco', 'Reunir las hojas', 'Restituir la inscripción']]
  };
  const artifactNames = [
    ['Bloque de amarre con marcas de cuerda','Poste solar con sombras','Fragmentos de un cartucho real','Corte de un cilindro envuelto en lino','Secciones de puertas talladas','Marcas de nivel en el estanque','Frascos de mezcla del taller','Cálamo y tablillas de testigos','Registro de pulsos junto a un tambor','Juntas de tablas de la barca','Placa de piedra y estratos de ocre','Dos láminas perforadas'],
    ['Testigos de relevo del embarcadero','Dos relojes de agua','Sellos de las cuadrillas','Platillos y cargas del taller','Umbrales del itinerario','Reflejo de una lámpara en el estanque','Amarras y barca de carga','Reverso de un fragmento cerámico','Conductos y compuertas','Maqueta de cubierta con sus cargas','Lámparas en dos hornacinas','Banco y pantallas perforadas'],
    ['Arco, estera y disco de carga','Canal de agua y vaso extraíble','Cuadrícula del muro','Banda de lino azul con tres motivos','Dos puertas y un arco tallado','Puntos de luz y obturador','Balanza de envíos del perfumista','Cesta cerrada y cuña','Fichas para transmitir avisos','Mitad de un sol sobre cubierta','Relieve de dos manos abiertas','Tres documentos de tela cosidos'],
    ['Tablillas del manifiesto de transporte','Rollo de registro con dos escalas','Fragmentos de cal, tinta y ocre','Recibos de consignación','Relieves de puertas de la procesión','Señales de guardia en la orilla','Documento de reparto y vasija','Dos actas de testigos y un sello','Fragmento escrito bajo la estera','Partes y sello del puerto','Recibo del taller de Neryt','Inscripción recompuesta sobre piedra dorada']
  ];
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  function button(text, action, cls) {
    const b = node('button', text, cls);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }
  function group(label, cls) {
    const e = node('div', null, cls);
    e.setAttribute('role', 'group');
    e.setAttribute('aria-label', label);
    return e;
  }
  function picture(id, index) {
    const frame = node('div', null, 'ra-art');
    const img = node('img');
    const sheet = index>=1 && index<=4 ? index : 0;
    img.src = sheet ? '/ra-excavacion-'+(sheet+1)+'.webp' : '/ra-objetos-excavacion.webp';
    img.alt = sheet ? artifactNames[sheet-1][id-37] : cases[id][0];
    img.decoding = 'async';
    const n = id - 37;
    img.style.left = '-' + (n % 4 * 100) + '%';
    img.style.top = '-' + (Math.floor(n / 4) * 100) + '%';
    frame.append(img);
    return frame;
  }
  function permitted(item, role) {
    return !role || !['A','B'].includes(role) || item.role == null || item.role === 'AB' ||
      role === item.role || item.role === (role === 'A' ? 1 : 2);
  }
  function readingList(stage, role) {
    return (stage.materials || []).filter(item => permitted(item, role) && typeof item.body === 'string');
  }
  function rowsIn(records) {
    return records.flatMap(m => m.body.split(/\r?\n/).filter(line => line.includes('|'))
      .map(line => ({ label:m.label, cells:line.split('|').map(cell => cell.trim()) })));
  }
  function choose(input, selection, option, limit) {
    const at = selection.indexOf(option.id);
    if (input.stage.mode === 'single') selection.splice(0, selection.length, option.id);
    else if (at >= 0) selection.splice(at, 1);
    else if (!limit || selection.length < limit) selection.push(option.id);
  }
  function coordinates(label) {
    const m = /^([A-D])([1-5])$/i.exec(label);
    return m ? [m[1].toUpperCase().charCodeAt(0) - 64, Number(m[2])] : null;
  }
  function graphPoint(g, x, y, cls, text) {
    const e = node('span', text, cls);
    e.style.left = x + '%';
    e.style.top = y + '%';
    g.append(e);
    return e;
  }
  function diagram(opts, label, records) {
    const { caseId:id, index:i } = opts;
    const g = node('span', null, 'ra-diagram');
    g.setAttribute('aria-hidden', 'true');
    const matches = (pattern) => label.match(pattern);
    if (id === 37 && i === 0) {
      const dirs = matches(/corriente (norte|sur) y casco (norte|sur)/i);
      if (!dirs) return;
      g.classList.add('ra-river');
      graphPoint(g, 30, 50, 'ra-arrow', dirs[1] === 'norte' ? '↑' : '↓');
      graphPoint(g, 69, 50, 'ra-arrow', dirs[2] === 'norte' ? '↑' : '↓');
    } else if (id === 38 && i === 0) {
      const readings = [...label.matchAll(/\+(\d+)/g)];
      if (readings.length !== 2) return;
      g.classList.add('ra-cups');
      readings.forEach((m, j) => {
        const cup = node('i', null, 'ra-cup');
        cup.style.setProperty('--level', (Number(m[1])/15*100)+'%');
        if (j) cup.classList.add('ra-narrow');
        g.append(cup);
      });
    } else if (id === 42 && i === 0) {
      const marks = [...label.matchAll(/(hoja|círculo|cuña)\s*([+−-]?\d+)/gi)];
      if (marks.length !== 3) return;
      g.classList.add('ra-reflect');
      for (const [j,m] of marks.entries()) {
        const name = m[1].toLowerCase();
        graphPoint(g, 18 + j*32, 50-Number(m[2].replace('−','-'))*7, 'ra-star', name==='hoja'?'◆':name==='cuña'?'▲':'●');
      }
    } else if (id === 41 && i === 0) {
      const dirs = matches(/izquierda\s*=\s*(\w+).*entrada\s*=\s*(\w+)/i);
      if (!dirs) return;
      g.classList.add('ra-plan');
      graphPoint(g,18,48,'ra-axis',dirs[1].slice(0,1).toUpperCase());
      graphPoint(g,51,80,'ra-axis',dirs[2].slice(0,1).toUpperCase());
    } else if (id === 46 && i === 2) {
      const nums = label.match(/\d+/g);
      if (!nums) return;
      g.classList.add('ra-deck');
      graphPoint(g, 50-Number(nums[0])*12, 48, 'ra-cargo','■');
      graphPoint(g, 50+Number(nums[1]||nums[0])*12, 48, 'ra-cargo','●');
    } else if (id === 39 && i === 0) {
      g.classList.add('ra-stratum', 'ra-stratum-'+(label.slice(-1).toLowerCase().replace(/[^a-z]/g,'')));
    } else if (id === 41 && (i === 1 || i === 2 || i === 4)) {
      g.classList.add('ra-door');
      graphPoint(g,50,55,'ra-door-sign',label.replace(/^Hoja\s*/i,''));
    } else if (id===47 && i===0) {
      const panel=label.replace(/^Panel\s*/i,'');
      const row=rowsIn(records).find(r=>r.cells[0]===panel);
      if(!row)return;
      g.classList.add('ra-hand-study');
      for(const [j,n] of [Number(row.cells[1]),Number(row.cells[2])].entries()){
        const tokens=node('span','Ⅰ'.repeat(Math.min(6,Math.max(0,n)||0)),'ra-fingers');
        tokens.style.left=j?'75%':'25%';tokens.style.top='50%';g.append(tokens);
      }
    } else if (id === 44 && i === 0) {
      const code = label.match(/Banda (\w+)/i)?.[1];
      const row = rowsIn(records).find(r=>r.cells[0]===code);
      g.classList.add('ra-sherd');
      graphPoint(g, 50,50,'ra-mark',row?.cells[3]?.replace(/dos rayas|una raya|punto/g,v=>v==='dos rayas'?'Ⅱ':v==='una raya'?'Ⅰ':'•') || code);
    } else return;
    return g;
  }
  // A comparison lens is useful for archival readings with several specimens.
  // Rows are cut from the active player's original record, never authored here.
  function comparison(records) {
    const sources = records.map(doc => ({doc, rows:rowsIn([doc])})).filter(r=>r.rows.length>=2);
    if (!sources.length) return;
    const tool = node('details',null,'ra-lens');
    tool.append(node('summary','Cotejar dos registros'));
    const compare = node('div',null,'ra-compare');
    const panes = [0,1].map(i => {
      const col = node('div'), label = node('label', i?'Segundo registro':'Primer registro');
      const sel = node('select');
      sources.forEach(({doc,rows},s) => {
        const group = node('optgroup');
        group.label = doc.label;
        rows.forEach(({cells},r) => {
          const opt = node('option', cells[0]); opt.value = s+','+r; group.append(opt);
        });
        sel.append(group);
      });
      sel.selectedIndex = i;
      const fields=node('ul');
      function show() {
        const [s,r]=sel.value.split(',').map(Number);
        const current=sources[s].rows[r].cells;
        fields.replaceChildren(...current.slice(1).map(value=>node('li',value)));
      }
      sel.addEventListener('change',show);show();
      label.append(sel);col.append(label,fields);return col;
    });
    compare.append(...panes);tool.append(compare);return tool;
  }
  function selector(name, items, onChange) {
    const box = node('label',name,'ra-selector');
    const sel = node('select');box.append(sel);
    items.forEach(value=>{const opt=node('option',value);opt.value=value;sel.add(opt);});
    sel.addEventListener('change',onChange);return [box,sel];
  }
  function lab(title, help) {
    const panel = node('details',null,'ra-lab');
    panel.append(node('summary',title));
    const bench = node('div',null,'ra-lab-body');
    bench.append(node('p',help));panel.append(bench);
    const out = node('output',null,'ra-result');out.setAttribute('aria-live','polite');
    return {panel,bench,out};
  }
  function arithmetic(title, help, config, compute) {
    const {panel,bench,out}=lab(title,help);
    const inputs=[];
    const controls = node('div',null,'ra-measure');
    const update = () => {out.textContent=compute(inputs.map(s=>Number(s.value)));};
    config.forEach(([name,min,max,start]) => {
      const [label,sel]=selector(name,Array.from({length:max-min+1},(_,i)=>i+min),update);
      sel.value=String(start);inputs.push(sel);controls.append(label);
    });
    bench.append(controls,out);update();return panel;
  }
  function transcription(title, help, records, bodyName, pattern, alternate) {
    const record = records.find(m => m.body.match(pattern));
    if(!record) return;
    const {panel,bench,out}=lab(title,help);
    const form=group(bodyName,'ra-working-controls');
    const rows=alternate(record.body);
    if(!rows?.length) return;
    const [label,sel]=selector(bodyName,rows.map(row=>row[0]),render);
    const [face,position]=selector('Posición de lectura',[...rows[0][1]],render);
    function render(){
      const current=rows[sel.selectedIndex];
      out.textContent=current[2][position.selectedIndex];
    }
    form.append(label,face);bench.append(form,out);render();return panel;
  }
  function tableMachine(records, heading, title, help, itemName, columns, header) {
    return transcription(title,help,records,itemName,heading,body=>{
      const data=body.split(/\r?\n/).filter(line=>line.includes('|')).map(line=>line.split('|').map(v=>v.trim()));
      return data.filter(cells=>!header.test(cells[0]) && cells.length>columns.length)
        .map(cells=>[cells[0],columns,cells.slice(1,columns.length+1)]);
    });
  }
  function slider(name, min, max, start, action) {
    const wrap=node('label',name,'ra-selector');
    const input=node('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=start;
    input.addEventListener('input',action);wrap.append(input);return [wrap,input];
  }
  function opticalBench(records) {
    const copy=records.find(doc=>/ranura en fila (\d), columna (izquierda|central|derecha)/i.test(doc.body));
    if(!copy)return;
    const pat=/ranura en fila (\d), columna (izquierda|central|derecha); segunda ranura en fila (\d), columna (izquierda|central|derecha)/i;
    const coords=copy.body.match(pat);if(!coords)return;
    const {panel,bench,out}=lab('Girar la lámina en el aro','Ensaya las dos caras de la lámina y lee dónde entra la luz.');
    const grid=group('Posición de las ranuras','ra-light-grid');
    const names=['izquierda','central','derecha'];
    const [label,face]=selector('Cara de la lámina',['Anverso','Reverso'],draw);
    function draw() {
      const holes=[0,1].map(n=>{
        const col=names.indexOf(coords[2+n*2]);return [Number(coords[1+n*2]),face.selectedIndex?2-col:col];
      });
      grid.replaceChildren();
      for(let r=1;r<=3;r++)for(let c=0;c<3;c++){
        const tile=node('i');if(holes.some(([y,x])=>y===r&&x===c))tile.className='ra-lit';
        grid.append(tile);
      }
      out.textContent=holes.map(([row,col])=>'Fila '+row+' · '+names[col]).join(' / ');
    }
    bench.append(label,grid,out);draw();return panel;
  }
  function boatCompass(records) {
    const map=records.find(m=>/media luna oeste, punta corta al norte/i.test(m.body));
    if(!map) return;
    const readings=[...map.body.matchAll(/\b([A-D]): media luna (oeste|este), punta (corta|larga) al norte/gi)];
    if(!readings.length)return;
    const {panel,bench,out}=lab('Superponer los calcos a la cubierta','Mantén la proa al norte y cambia de calco. Las marcas identifican el lado y la punta de la media luna.');
    const plan=group('Cubierta vista desde arriba','ra-boat-plan');
    const [label,choice]=selector('Calco',readings.map(m=>m[1]),draw);
    function draw(){
      const m=readings[choice.selectedIndex];plan.replaceChildren();
      graphPoint(plan,50,15,'ra-prow','Proa · N');
      graphPoint(plan,m[2]==='oeste'?25:75,58,'ra-moon','☾');
      out.textContent='Media luna al '+m[2]+' · punta '+m[3]+' al norte.';
    }
    bench.append(label,plan,out);draw();return panel;
  }
  function waterline() {
    const {panel,bench,out}=lab('Mover la línea del agua','Desliza el nivel o cambia la altura del punto. El calco conserva la posición horizontal.');
    const graph=group('Sección del estanque','ra-water-line');
    const [a,point]=slider('Altura del punto',-5,5,0,draw);
    const [b,water]=slider('Nivel del agua',-3,3,0,draw);
    function draw(){
      const p=Number(point.value),w=Number(water.value),mirror=2*w-p;
      graph.replaceChildren();graph.style.setProperty('--water',(50-w*4)+'%');
      graphPoint(graph,35,50-p*4,'ra-direct','◆');
      graphPoint(graph,65,50-mirror*4,'ra-mirror','◇');
      out.textContent='Punto '+p+' · agua '+w+' · reflejo '+mirror;
    }
    bench.append(a,b,graph,out);draw();return panel;
  }
  function instruments(ctx, records) {
    const k=ctx.caseId+':'+ctx.index;
    switch(k) {
      case '42:0': return waterline();
      case '43:0': return tableMachine(records,/Vasija \| Huella inferior/i,'Levantar las huellas del cuello',
        'Examina por separado la capa inferior, la exterior y el barro de cada vasija.','Vasija',
        ['Huella inferior','Huella exterior','Barro fresco'],/^Vasija$/i);
      case '43:1': return tableMachine(records,/Muestra \| Base \| Raíz/i,'Separar las fracciones',
        'Compara, ingrediente por ingrediente, las muestras del taller.','Muestra',
        ['Base','Raíz','Flor','Tinte'],/^Muestra$/i);
      case '45:0': return transcription('Reproducir el recorrido de la voz','Selecciona un ensayo y avanza del sonido emitido al retorno temprano y tardío.',
        records,'Ensayo',/Retorno temprano \| Retorno tardío/i,body=>
          body.split(/\r?\n/).filter(line=>line.includes('|')&&!line.startsWith('Puesto')).map(line=>{
            const [place,voice,first,last]=line.split('|').map(c=>c.trim());
            return [place+' · '+voice,['Emisión','Retorno temprano','Retorno tardío'],[voice,first,last.split('.')[0]]];}));
      case '46:0': return boatCompass(records);
      case '48:1': return opticalBench(records);
      case '48:0': return tableMachine(records,/Caja \| Interior \| Marcas/i,'Abrir las cajas de la mesa',
        'Compara el contenido y el tipo de apoyo de las piezas antes de montarlas.','Caja',['Interior','Marcas'],/^Caja$/i);
      case '38:0':
      case '38:2':
      case '45:1':
        return arithmetic(k==='45:1'?'Poner a cero el contador':'Poner a cero la escala',
          k==='45:1'?'Sitúa la palmada y el retorno en la misma escala. Lee el tiempo transcurrido.':'Introduce dos lecturas de un mismo ensayo para medir el cambio entre ellas.',
          [['Inicio',0,18,0],['Lectura final',0,18,0]],([a,b])=>'Diferencia entre marcas: '+(b-a));
      case '42:2':
        return arithmetic('Trazar el reflejo respecto al agua','Sitúa el nivel y el reflejo según tu documento. El banco mantiene la vertical.',
          [['Nivel del agua',-8,12,0],['Altura del reflejo',-8,12,0]],([a,b])=>'Altura simétrica respecto al agua: '+(2*a-b));
      case '46:2':
      case '40:2':
      case '43:3': {
        if(k==='46:2') return arithmetic('Probar el equilibrio de la maqueta','Introduce tus masas y las distancias desde el centro. Compara ambos lados antes de colocar la carga.',
          [['Masa de babor',1,9,1],['Distancia de babor',1,3,1],['Masa de estribor',1,9,1],['Distancia de estribor',1,3,1]],([a,b,c,d])=>a*b+' frente a '+c*d+' · '+(a*b===c*d?'cubierta nivelada':a*b>c*d?'cae a babor':'cae a estribor'));
        return arithmetic('Descontar los recipientes','Introduce las masas indicadas en tus recibos.',
          [['Peso bruto',0,60,0],['Tara',0,60,0]],([a,b])=>'Contenido sin recipiente: '+(a-b));
      }
      case '47:0':
        return transcription('Mover la lámpara','Compara el contorno que ves en un mismo panel al cambiar la altura de la luz.',records,'Panel',/Dedos a altura de hombro/i, body=>
          body.split(/\r?\n/).filter(s=>/^(I|II|III|IV)\s*\|/.test(s)).map(s=>{
            const [name,high,low,edges]=s.split('|').map(c=>c.trim());
            const wrist=edges.split('.')[0]==='uno'?'un borde de muñeca':'dos bordes de muñeca';
            return [name,['A la altura del hombro','A ras del suelo'],[high+' dedos · '+wrist,low+' dedos · '+wrist]];
          }));
      case '40:0':
        return transcription('Ensayar las réplicas','Compara el comportamiento medido al dejar libre o cubrir un extremo.',records,'Réplica',/cola larga, tapar/i,body=>
          body.split(/\r?\n/).filter(s=>/^[A-D]\s*\|/.test(s)).map(s=>{const [name,desc]=s.split('|').map(c=>c.trim());const [first,second]=desc.split(',');return [name,['Extremo libre','Extremo cubierto'],[first,(second||desc).trim()]];}));
      case '40:3':
        return transcription('Dar la vuelta a la banda','Elige el extremo por el que vas a empezar la lectura de los tres motivos.',records,'Banda',/M = larga/i,body=>
          [...body.matchAll(/([MNP]) = ([^();]+) \(flecha a la (derecha|izquierda)\)/g)].map(m=>{
            const values=m[2].split(',').map(v=>v.trim());return [m[1],['Desde la izquierda','Desde la derecha'],[values.join(' · ')+ ' · flecha a la '+m[3],[...values].reverse().join(' · ')+ ' · flecha a la '+m[3]]];}));
      case '44:2':
        return transcription('Girar la fotografía','Elige cómo giras el soporte y observa qué coordenada cambia.',records,'Cara original',/grieta a la izquierda, arriba; gota a la derecha, abajo/i,()=>[
          ['Frente',['Sin giro','Por el borde vertical','Por el borde horizontal'],['Grieta a la izquierda arriba · gota a la derecha abajo','Grieta a la derecha arriba · gota a la izquierda abajo','Grieta a la izquierda abajo · gota a la derecha arriba']]]);
      default: return;
    }
  }
  function mountWorkbench(input) {
    input={...input,caseId:Number(input.caseId)};
    const {caseId:id,index,field,stage,selected,change,role}=input;
    const meta=cases[id], options=stage.options;
    if (!meta || !Array.isArray(options) || !options.length || !['order','multi','single'].includes(stage.mode)) return false;
    // This existing two-layer rubbing round has its own manipulation controls.
    if (stage.interaction==='improntas') {
      const wrapper=node('div',null,'ra-bench'), intro=node('div',null,'ra-intro'), lead=node('div',null,'ra-lead');
      lead.append(node('span',meta[1],'ra-kicker'),node('h5',meta[2][index]),node('p','Pon las marcas de dos ojos de amarre una sobre otra.'));
      intro.append(picture(id,index),lead);wrapper.append(intro);field.append(wrapper);
      return false;
    }
    const records = readingList(stage,role), ordered=stage.mode==='order';
    const multi=stage.mode==='multi';
    const stated=multi && stage.task?.match(/(?:elegid|seleccionad|identificad|qué)\s+(?:exactamente\s+|las?\s+|los\s+)?(dos|tres|cuatro)\b/i);
    const count=stage.requiredCount || (stated && {dos:2,tres:3,cuatro:4}[stated[1].toLowerCase()]);
    if(count)field.dataset.requiredChoices=String(count);
    field.dataset.vhPrueba='excavacion-'+id+'-'+(index+1);
    const board=node('section',null,'ra-bench');board.dataset.raCase=String(id);
    const intro=node('div',null,'ra-intro'), lead=node('div',null,'ra-lead');
    lead.append(node('span',meta[1],'ra-kicker'),node('h5',meta[2][index] || stage.title));
    const help=ordered?'Coloca las piezas en el orden de tu reconstrucción. Puedes retirar cualquier pieza.':
      multi?'Marca las piezas que sostienen tu hipótesis. Puedes volver a tocarlas para retirarlas.':'Examina las propuestas y coloca la que coincide con tus pruebas.';
    lead.append(node('p',help));intro.append(picture(id,index),lead);board.append(intro);
    const tools=instruments(input,records);
    if (tools) board.append(tools);
    const lens=comparison(records);
    if (lens) board.append(lens);
    const isGrid=id===39 && index===3 && options.every(o=>coordinates(o.label));
    const tray=group(isGrid?'Cuadrícula de la pared':'Propuestas de la investigación','ra-proposals');
    if(isGrid){
      tray.classList.add('ra-coordinate-grid');
      const origin=records.map(r=>r.body.match(/señal roja está en ([A-D][1-5])/i)).find(Boolean);
      const place=origin && coordinates(origin[1]);
      if(place){
        const mark=node('span','●','ra-origin');mark.style.gridRow=String(place[0]);mark.style.gridColumn=String(place[1]);
        mark.setAttribute('role','img');mark.setAttribute('aria-label','Señal roja en '+origin[1]);mark.title='Señal roja · '+origin[1];tray.append(mark);
      }
    }
    if(ordered && id===39 && index===0)board.classList.add('ra-layered');
    const summary=node('div',null,'ra-fit'), current=node('span',null,'ra-count');
    current.setAttribute('role','status');
    const assembly=node(ordered?'ol':'ul',null,'ra-assembly');
    assembly.setAttribute('aria-label',ordered?'Reconstrucción en el orden elegido':'Hipótesis actual');
    summary.append(current,assembly);
    const picks=options.map(opt=>{
      const b=button(null,()=>{
        choose(input,selected,opt,count);sync();change();
      },'ra-piece');
      b.dataset.optionId=opt.id;
      const coords=isGrid && coordinates(opt.label);
      if(coords){b.style.gridRow=String(coords[0]);b.style.gridColumn=String(coords[1]);}
      const detail=diagram(input,opt.label,records);
      if(detail)b.append(detail);
      const name=node('span',opt.label,'ra-piece-label'), seal=node('span','','ra-position');
      seal.setAttribute('aria-hidden','true');b.append(name,seal);tray.append(b);
      return {b,opt,seal};
    });
    function sync(){
      picks.forEach(({b,opt,seal})=>{
        const pos=selected.indexOf(opt.id);
        b.setAttribute('aria-pressed',String(pos!==-1));
        b.disabled=Boolean(ordered||multi)&&pos<0&&Number.isInteger(count)&&selected.length>=count;
        seal.textContent=pos===-1?'':ordered?String(pos+1):'✓';
      });
      current.textContent=ordered?'Orden propuesto':multi?'Piezas elegidas':'Propuesta elegida';
      if(Number.isInteger(count))current.textContent+=' · '+selected.length+' de '+count;
      const tokens=selected.map((v,pos)=>{
        const opt=options.find(o=>o.id===v);
        const li=node('li');
        if(ordered)li.append(node('span',String(pos+1),'ra-slot'));
        li.append(node('span',opt.label));
        const remove=button('×',()=>{
          selected.splice(selected.indexOf(v),1);sync();change();
          picks.find(p=>p.opt.id===v)?.b.focus();
        },'ra-remove');
        remove.setAttribute('aria-label','Retirar '+opt.label);li.append(remove);return li;
      });
      if(!tokens.length)tokens.push(node('li',ordered?'Elige la primera pieza.':multi?'Elige las piezas que vas a contrastar.':'Elige una propuesta.','ra-empty'));
      assembly.replaceChildren(...tokens);
    }
    board.append(tray,summary);field.append(board);sync();change();return true;
  }
  const registry=window.MesasDeCaso ||= {};
  Object.keys(cases).forEach(id=>{registry[id]=mountWorkbench;});

  function selectEvidence(label, names, onPick) {
    const controls=group(label,'ra-reading-tabs'), buttons=[];
    function pick(i) {
      buttons.forEach((b,k)=>b.setAttribute('aria-pressed',String(i===k)));
      onPick(i);
    }
    names.forEach((name,i)=>{const b=button(name,()=>pick(i));buttons.push(b);controls.append(b);});
    pick(0);return controls;
  }
  function measuredReadings(doc) {
    const trials=[...doc.body.matchAll(/Ensayo (ancho|estrecho): marca inicial (\d+), final (\d+)/gi)];
    if(trials.length<2)return;
    const box=node('section',null,'ra-gauge-reading');
    const chart=group('Nivel observado en las dos marcas','ra-gauge-rows');
    const out=node('output');out.setAttribute('aria-live','polite');
    const ceiling=Math.max(...trials.map(row=>Math.max(+row[2],+row[3])));
    const tabs=selectEvidence('Elegir cubeta',trials.map(m=>'Vaso '+m[1]),i=>{
      const m=trials[i];chart.replaceChildren();
      for(const [label,v] of [['Inicio',m[2]],['Final',m[3]]]){
        const strip=node('div',null,'ra-gauge-strip'),bar=node('i');
        bar.style.setProperty('--filled',(+v/ceiling*100)+'%');
        strip.append(node('span',label),bar,node('b',v));chart.append(strip);
      }
      out.textContent='Vaso '+m[1]+' · de la marca '+m[2]+' a la '+m[3]+'.';
    });
    box.append(tabs,chart,out);return box;
  }
  function riverReading(doc) {
    const bank=doc.body.match(/De sur a norte se suceden (\w+), (\w+) y (\w+)/i);
    const departure=doc.body.match(/la vasija y el casco estaban en (\w+)/i);
    const arrival=doc.body.match(/el casco pasó frente al (\w+)/i);
    if(!bank||!departure||!arrival)return;
    const box=node('section'),strip=group('Orillas de sur a norte','ra-bank-strip'),out=node('output');
    out.setAttribute('aria-live','polite');
    const tabs=selectEvidence('Instante observado',['Primer toque','Tercer toque'],i=>{
      const at=i?arrival[1]:departure[1];strip.replaceChildren();
      for(const name of bank.slice(1)){
        const post=node('span',name,'ra-bank-post');
        if(name===at){post.classList.add('ra-present');post.append(node('b',i?'Casco':'Vasija y casco'));}
        strip.append(post);
      }
      out.textContent=(i?'Tercer toque · casco en ':'Primer toque · vasija y casco en ')+at+'.';
    });
    box.append(tabs,strip,out);return box;
  }
  function starReading(doc) {
    const source=doc.body.match(/izquierda a derecha: ([\p{L}]+), ([\p{L}]+), ([\p{L}]+).*?son (\d+), (\d+) y (\d+) divisiones/iu);
    if(!source)return;
    const box=node('section',null,'ra-star-reading');
    const line=group('Alturas sobre la línea del agua','ra-star-plot');
    const max=Math.max(...source.slice(4).map(Number));
    source.slice(1,4).forEach((name,i)=>{
      const d=source[4+i], col=node('div',null,'ra-observation');
      const point=node('span',name==='hoja'?'◆':name==='cuña'?'▲':'●');
      point.style.bottom=(Number(d)/(max+1)*76+15)+'%';col.append(point,node('strong',name+' · '+d));line.append(col);
    });
    box.append(line);return box;
  }
  function wallReading(doc) {
    const mark=doc.body.match(/señal roja está en ([A-D][1-5])/i);
    const named=doc.body.match(/Puntos marcados: ([^.]+)\./i);
    if(!mark||!named)return;
    const points=new Set(named[1].match(/[A-D][1-5]/g));
    const wrap=group('Cuadrícula del andamio','ra-wall-survey');
    for(const row of 'ABCD')for(let i=1;i<=5;i++){
      const coord=row+i,cell=node('span',coord);
      if(coord===mark[1]){cell.className='ra-red';cell.append(node('small','Señal roja'));}
      else if(points.has(coord)){cell.className='ra-survey-pin';cell.append(node('small','Marca'));}
      wrap.append(cell);
    }return wrap;
  }
  function readConnections(doc) {
    const arcs=doc.body.split(/[.;\n]+/).map(s=>s.trim()).filter(s=>s.includes('→') && !s.includes('|'));
    if(!arcs.length)return;
    const box=node('div'),route=node('ol',null,'ra-path');
    const all=arcs.map(line=>line.split('→').map(s=>s.trim()));
    const selectors=selectEvidence('Elegir trayecto',all.map(parts=>parts[0]),i=>{
      route.replaceChildren(...all[i].map(label=>node('li',label)));
    });
    box.append(selectors,route);return box;
  }
  function documentRows(doc) {
    const values=rowsIn([doc]).map(r=>r.cells);
    if(values.length<2)return;
    // A header never counts as a specimen. Headerless two-column records keep their first row.
    const head=/^(?:vasija|muestra|día|panel|puesto|pieza|caja|guardia|turno|registro|rollo|foto|banda|objeto|nombre|medida|hoja|patio|marca|lugar|hora|partida|testigo|contenido|tarjeta|barca|cuadrilla|orden|etapa|lado|mesa|fuente|entrega|ficha|contacto|calco|prueba|tramo|carga|señal|orilla|persona|fecha|tablilla)$/i.test(values[0][0]);
    const header=head?values.shift():[];
    if(!values.length)return;
    const view=node('div'),spec=node('dl',null,'ra-read-cells'),preview=node('div',null,'ra-specimen-preview');
    const colLimit=values.reduce((max,row)=>Math.max(max,row.length),0);
    const magnitudes=new Map();
    for(let j=1;j<colLimit;j++){
      const nums=values.map(row=>Number(String(row[j]).replace('−','-')));
      if(nums.every(n=>Number.isFinite(n)&&n>=0)&&Math.max(...nums)>0)magnitudes.set(j,Math.max(...nums));
    }
    const tabs=selectEvidence('Examinar un registro',values.map(v=>v[0]),i=>{
      spec.replaceChildren();
      const specimen=specimenFigure(doc,values[i],header);
      preview.replaceChildren(...(specimen?[specimen]:[]));
      values[i].slice(1).forEach((v,k)=>{
        const j=k+1, group=node('div');group.append(node('dt',header[j]||'Observación '+j));
        const dd=node('dd',v);
        if(magnitudes.has(j)){
          const strip=node('span',null,'ra-read-meter');strip.setAttribute('aria-hidden','true');
          strip.style.setProperty('--filled',(+v/magnitudes.get(j)*100)+'%');dd.append(strip);
        }else if(v.includes('→')){
          const stations=node('span',null,'ra-read-stations');stations.setAttribute('aria-hidden','true');
          v.split('→').forEach(()=>stations.append(node('i')));dd.append(stations);
        }
        group.append(dd);spec.append(group);
      });
    });
    view.append(tabs,preview,spec);return view;
  }
  function quotations(source) {
    const segments=source.split(/(?<=[.!?])\s+|\r?\n+|;\s*/).map(t=>t.trim()).filter(Boolean);
    return segments.length?segments:[source];
  }
  function annotatedExcerpt(value) {
    const p=node('p',null,'ra-notated');
    const regex=/(\b\d+(?:[½.,]\d*)?\b|\b(?:primer[oa]?|segund[oa]|tercer[oa]?|norte|sur|este|oeste|izquierda|derecha|arriba|abajo|delante|detrás|sobre|bajo|inicio|final|antes|después|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b)/gi;
    for(const [i,part] of value.split(regex).entries())p.append(i%2?node('mark',part):document.createTextNode(part));
    return p;
  }
  function readingRoll(doc) {
    const text=quotations(doc.body),card=node('div',null,'ra-scroll-read'),note=node('div');
    const pos=node('span',null,'ra-read-number');
    const prev=button('‹',()=>move(-1)),next=button('›',()=>move(1));
    prev.setAttribute('aria-label','Leer el pasaje anterior');next.setAttribute('aria-label','Leer el pasaje siguiente');
    let current=0;
    const paint=()=>{
      note.replaceChildren(annotatedExcerpt(text[current]));
      pos.textContent='Pasaje '+(current+1)+' de '+text.length;
      prev.disabled=current===0;next.disabled=current===text.length-1;
    };
    function move(by){current=Math.max(0,Math.min(text.length-1,current+by));paint();}
    if(text.length>1){const bar=node('div',null,'ra-scroll-nav');bar.append(prev,pos,next);card.append(bar);}
    note.setAttribute('aria-live','polite');card.append(note);paint();return card;
  }
  function signalSamples(clip) {
    const encoded=clip?.split(',')[1];
    if(!encoded)return;
    try{
      const raw=atob(encoded);
      if(raw.slice(0,4)!=='RIFF'||raw.slice(8,12)!=='WAVE')return;
      const n=(p,size)=>{let v=0;for(let j=0;j<size;j++)v+=raw.charCodeAt(p+j)*256**j;return v;};
      let bit=0,align=0,codec=0,start=0,length=0;
      for(let i=12;i+8<=raw.length;){
        const type=raw.slice(i,i+4),size=n(i+4,4),at=i+8;
        if(type==='fmt '){codec=n(at,2);align=n(at+12,2);bit=n(at+14,2);}
        if(type==='data'){start=at;length=Math.min(size,raw.length-at);break;}
        i=at+size+(size%2);
      }
      if(codec!==1||!align||![8,16].includes(bit)||!length)return;
      const frames=Math.floor(length/align),bars=Array.from({length:48},(_,i)=>{
        let peak=0;
        const a=Math.floor(i*frames/48),b=Math.floor((i+1)*frames/48);
        for(let j=a;j<b;j+=Math.max(1,Math.floor((b-a)/64))){
          const p=start+j*align,u=n(p,bit/8);
          peak=Math.max(peak,bit===8?Math.abs(u-128)/128:Math.abs(u>32767?u-65536:u)/32768);
        }return peak;
      });
      return bars;
    }catch{return;}
  }
  function sourceAudio(card,doc) {
    const audio=card.querySelector('audio');
    if(!audio)return;
    const bars=signalSamples(doc.clip);if(!bars)return;
    const panel=node('div',null,'ra-source-audio'),wave=node('div',null,'ra-sound-line');
    wave.setAttribute('aria-hidden','true');
    const max=Math.max(...bars,.02);
    bars.forEach(v=>{const bar=node('i');bar.style.height=Math.max(4,v/max*96)+'%';wave.append(bar);});
    const [label,position]=slider('Buscar en la grabación',0,100,0,()=>{
      if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(position.value)/100;
    });
    position.disabled=!Number.isFinite(audio.duration);
    audio.addEventListener('loadedmetadata',()=>{position.disabled=!Number.isFinite(audio.duration);});
    audio.addEventListener('timeupdate',()=>{
      if(Number.isFinite(audio.duration)){position.value=String(audio.currentTime/audio.duration*100);wave.style.setProperty('--played',position.value+'%');}
    });
    panel.append(wave,label);return panel;
  }
  function specimenFigure(doc,cells,headers) {
    const text=cells.join(' | '), figure=node('div',null,'ra-specimen-figure');
    figure.setAttribute('aria-hidden','true');
    if(headers.includes('Huella inferior')){
      figure.classList.add('ra-vessel-neck');
      for(const [i,layer] of cells.slice(1,3).entries()){
        const band=node('span',layer);band.className=layer.toLowerCase().includes('lino')?'ra-linen':'ra-reed';
        band.style.order=String(2-i);figure.append(band);
      }
    }else if(headers.includes('Borde de arriba')){
      figure.classList.add('ra-fragment-face');
      figure.append(node('small',cells[1]),node('b',cells[3]?.replace(/dos rayas|una raya|punto/g,v=>v==='dos rayas'?'Ⅱ':v==='una raya'?'Ⅰ':'•')),node('small',cells[2]));
    }else if(headers.includes('Dedos a altura de hombro')){
      figure.classList.add('ra-two-lamps');
      for(const [j,n] of cells.slice(1,3).entries()){
        const group=node('div');group.append(node('span',j?'Luz baja':'Luz alta'),node('b','Ⅰ'.repeat(Math.min(6,Number(n)||0))));figure.append(group);
      }
    }else if(/roce (alto|bajo), \d+ estrías/i.test(text)){
      const [,height,count]=text.match(/roce (alto|bajo), (\d+) estrías/i);
      figure.classList.add('ra-rubbed-stone');const grooves=node('span','╱'.repeat(Number(count)));
      grooves.style.top=height==='alto'?'22%':'60%';figure.append(grooves);
    }else if(/hueco|roca continua|nicho elevado|senda continua|suelo al pie/i.test(text) && /sección|senda|hojas/i.test(doc.label+' '+doc.body)){
      figure.classList.add('ra-cutaway');const hole=node('span');
      if(/hueco|nicho elevado|senda continua/i.test(text))hole.className=/nicho elevado/.test(text)?'ra-niche':'ra-opening';
      figure.append(hole);
    }else if(/cola larga|cola corta|sin cola tonal/i.test(text)){
      figure.classList.add('ra-resonance');const limit=/cola larga/i.test(text)?24:/cola corta/i.test(text)?10:3;
      for(let i=0;i<24;i++){const bar=node('i');bar.style.height=(i<limit?Math.max(8,90-i/limit*80):2)+'%';figure.append(bar);}
    }else return;
    return figure;
  }
  function protocolReading(ctx,doc) {
    const key=Number(ctx.caseId)+':'+ctx.index;
    if(!['40:3','44:2','46:0','48:1'].includes(key))return;
    const tool=instruments(ctx,[doc]);if(!tool)return;
    const inner=tool.querySelector('.ra-lab-body');
    if(inner){inner.classList.add('ra-source-instrument');return inner;}
  }
  function sourceWorkbench(ctx) {
    const {stage,index,shelf,role}=ctx,id=Number(ctx.caseId),docs=readingList(stage,role);
    const material=docs.find(d=>d.kind==='visual')||docs.find(d=>d.kind==='ledger')||docs.find(d=>d.kind!=='audio')||docs[0];
    for(const card of shelf.querySelectorAll('.vhour-material')){
      const doc=docs.find(item=>item.id===card.dataset.material);
      if(!doc||card.dataset.raDocument)continue;
      card.dataset.raDocument='true';
      const sourceContent=card.querySelector(':scope > summary + *');
      if(!sourceContent)continue;
      const special=measuredReadings(doc)||riverReading(doc)||starReading(doc)||wallReading(doc)||readConnections(doc)||protocolReading(ctx,doc);
      const table=documentRows(doc), tool=special || table;
      const isVoice=doc.kind==='audio'||doc.kind==='testimony';
      const graphic=node('div',null,'ra-source-view');
      if(doc===material){
        const artifact=picture(id,index);
        graphic.append(artifact);graphic.classList.add('ra-with-art');
        const thumb=card.querySelector('.vhour-format-photo');
        if(thumb){thumb.classList.add('ra-thumb');thumb.append(picture(id,index));}
      }
      if(!isVoice){
        const fallback=node('details',null,'ra-original');
        fallback.append(node('summary',doc.kind==='web'?'Consultar el archivo completo':'Leer el documento completo'));
        sourceContent.before(graphic,fallback);fallback.append(sourceContent);
      }else sourceContent.before(graphic);
      const page=node('div',null,'ra-reading-area');
      if(isVoice&&doc.clip && card.querySelector('audio')){
        const reveal=()=>{
          if(!card.open)return;
          card.removeEventListener('toggle',reveal);
          const waveform=sourceAudio(card,doc);
          if(waveform)page.prepend(waveform);
        };
        card.addEventListener('toggle',reveal);if(card.open)reveal();
      }
      page.append(tool||readingRoll(doc));graphic.append(page);
    }
  }
  const archive=window.ArchivosDeCaso ||= {};
  Object.keys(cases).forEach(id=>{archive[id]=sourceWorkbench;});
})();
