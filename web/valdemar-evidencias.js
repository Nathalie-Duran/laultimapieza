(() => {
  'use strict';
  // Each title names the actual place or support used by this stage's evidence.
  const stages={
    5:['Mesa del farero','Cartas del risco','Registro de travesías','Presupuestos de los muelles','Pliegos del consejo'],
    6:['Consigna del taller','Banco de calcos','Archivo de surcos','Mesa del remate','Bandeja de restitución'],
    7:['Taquilla del fotoclub','Tendedero de contactos','Caseta del socorrista','Marginador de imprenta','Mesa de pies de foto'],
    8:['Biblioteca del parque','Planos de la reforma','Caminos del jardín','Dos invitaciones','Archivo del banco'],
    9:['Las dos cocinas','Rutas de reparto','Caja de timbres','Cata de la pared','Carpeta del aparejador'],
    10:['Custodia del paquete','Cuaderno de recetas','Muestrario de grafías','Plano del comedor','Álbum del brindis'],
    12:['Relojes de la línea','Puesto del transbordo','Lector del carrete','Mesa de contactos','Expediente de rectificación']
  };
  const headed={
    5:['guardia','carta','negativos','ofertas'],6:['cajas','calcos','cortes','costes','orden','molde'],
    7:['contacto','puestos','declaraciones','plancha','manga'],8:['antiguo','hoy','copias','plantilla'],
    9:['muesca','impulsos'],10:['camaras','huellas','muestras'],12:['senal','marcas']
  };
  const sourceNames={
    5:{guardia:'Cotejar las anotaciones de los faros',carta:'Comparar las líneas de visión',negativos:'Contrastar perfiles de costa',turnos:'Consultar los turnos de barca',ofertas:'Probar un presupuesto',orden:'Separar las preguntas del acta'},
    6:{cajas:'Comparar tapa y cierre',pases:'Seguir los recibos de consigna',calcos:'Superponer los hilos de un calco',cortes:'Localizar un surco por su sonido',costes:'Ensayar el desembolso',molde:'Comparar los lacres y el remiendo'},
    7:{prestamos:'Comparar dos préstamos',contacto:'Examinar los bordes de las tomas',puestos:'Inspeccionar el campo de visión',declaraciones:'Cotejar testigos antes y después del relevo',franjas:'Mover el marco de recorte',manga:'Contrastar ropa y movimiento'},
    8:{biblioteca:'Contrastar dos folletos',cuadricula:'Girar el plano antiguo',antiguo:'Seguir el destino de los objetos',red:'Recorrer los senderos',copias:'Cotejar los destinatarios',plantilla:'Desplegar los campos de la ficha'},
    9:{sol:'Leer el eje de las cocinas',pasos:'Recorrer las puertas del reparto',impulsos:'Pulsar los contactos',caja:'Explorar los bornes',corte:'Levantar las capas del muro',ficha:'Consultar los anexos del aparejador'},
    10:{motivos:'Comparar las marcas de los paquetes',camaras:'Comparar las horas internas',espejo:'Cerrar las páginas del cuaderno',muestras:'Comparar los trazos firmados',puestos:'Enfrentar las dos filas de sillas',orden:'Separar las hojas de trabajo'},
    12:{senal:'Comparar la lectura de dos relojes',circuito:'Recorrer los ramales',marcas:'Medir entre dos marcas de la banda',cortes:'Examinar cada contacto',pliego:'Contrastar los comprobantes oficiales'}
  };
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function button(label,action){const n=el('button','ve-control',label);n.type='button';n.addEventListener('click',action);return n;}
  function status(){const n=el('p','ve-result');n.setAttribute('role','status');return n;}
  function controls(){return el('div','ve-controls');}
  function selectButtons(parent,labels,render){
    const list=controls();const buttons=labels.map((label,i)=>{const b=button(label,()=>choose(i));list.append(b);return b;});
    function choose(i){buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));render(i);}
    parent.append(list);if(labels.length)choose(0);
  }
  const lineArray=body=>body.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  function notes(container,lines){for(const text of lines)container.append(el('p','ve-original',text));}
  function annotateRecording(box){
    const text=box.querySelector('.vhour-recording .vhour-prose');
    if(!text)return;
    const phrases=text.textContent.split(/(?<=[.!?»”])\s+(?=[A-ZÁÉÍÓÚ¿«])/u).filter(Boolean);
    if(phrases.length<2)return;
    const group=el('div','ve-citations');
    group.append(el('p','ve-tip','Señala las frases que quieras cotejar mientras escuchas el testimonio.'));
    for(const phrase of phrases){
      const mark=button(phrase,event=>{const selected=event.currentTarget;selected.setAttribute('aria-pressed',String(selected.getAttribute('aria-pressed')!=='true'));});
      mark.classList.add('ve-quote');mark.setAttribute('aria-pressed','false');group.append(mark);
    }
    text.replaceWith(group);
  }
  function sheets(container,lines,kind){
    const parts=lines.length>1?lines:(lines[0]||'').split(/(?<=[.!?»”])\s+(?=[A-ZÁÉÍÓÚ¿«])/u).filter(Boolean);
    if(parts.length<2){notes(container,parts);return;}
    const face=el('div','ve-paper'),text=el('p','ve-original'),pages=controls(),count=el('span','ve-page-number');
    let pos=0;const previous=button('Anterior',()=>turn(-1)),next=button('Siguiente',()=>turn(1)),all=button('Leer de corrido',()=>{joined=!joined;paint();});
    let joined=false;
    function paint(){
      count.textContent=joined?'Documento completo':(kind==='film'?'Contacto ':'Fragmento ')+(pos+1)+' de '+parts.length;
      text.textContent=joined?parts.join('\n'):parts[pos];previous.disabled=joined||pos===0;next.disabled=joined||pos===parts.length-1;
      all.textContent=joined?'Volver al fragmento':'Leer de corrido';all.setAttribute('aria-pressed',String(joined));
    }
    function turn(delta){pos+=delta;paint();}
    pages.append(previous,count,next,all);face.append(text);container.append(pages,face);paint();
  }
  function routeView(parent,lines){
    for(const line of lines){
      const sep=line.match(/→|↔|—/);
      if(!sep){notes(parent,[line]);continue;}
      const segments=line.split(/(→|↔|—)/).filter(Boolean),row=el('div','ve-route');
      for(const part of segments){
        if(/^(→|↔|—)$/.test(part)){row.append(el('span','ve-arrow',part));continue;}
        const place=button(part.trim(),event=>{const target=event.currentTarget;const active=target.getAttribute('aria-pressed')==='true';target.setAttribute('aria-pressed',String(!active));});
        place.setAttribute('aria-pressed','false');row.append(place);
      }
      parent.append(row);
    }
  }
  function orientation(parent,body){
    const copy=el('div','ve-original');copy.textContent=body;
    const paper=el('div','ve-grid'),result=status();let rotated=false,current='A1';
    const toggle=button('Girar el plano media vuelta',()=>{rotated=!rotated;draw();});
    function draw(){
      paper.replaceChildren();
      const cells=Array.from({length:16},(_,i)=>String.fromCharCode(65+Math.floor(i/4))+String(i%4+1));
      const order=rotated?cells.slice().reverse():cells;
      for(const name of order){
        const token=button(name,()=>{current=name;draw();});
        token.setAttribute('aria-pressed',String(current===name));paper.append(token);
      }
      const dest=cells[order.indexOf(current)];result.textContent=rotated?'La casilla '+current+' queda en '+dest+' tras el giro.':'Casilla señalada en el plano antiguo · '+current;
      toggle.textContent=rotated?'Restituir la orientación antigua':'Girar el plano media vuelta';
    }
    parent.append(copy,paper,toggle,result);draw();
  }
  function crop(parent,lines){
    const intervals=lines.map(s=>s.match(/^(.+?):\s*x=(\d+)\s+a\s+x=(\d+)\.?$/)).filter(Boolean);
    if(!intervals.length){sheets(parent,lines);return;}
    notes(parent,lines.filter(s=>!intervals.some(m=>m[0]===s)));
    const ruler=el('div','ve-ruler'),input=el('input'),label=el('label','ve-slide','Mover el recorte de 10 cm'),result=status();
    input.type='range';input.min='0';input.max='2';input.value='0';input.step='1';label.append(input);
    for(const m of intervals){const bar=el('div','ve-measure'),name=el('span','',m[1]+' · '+m[2]+'–'+m[3]+' cm');bar.style.setProperty('--start',Number(m[2])/12*100+'%');bar.style.setProperty('--end',Number(m[3])/12*100+'%');ruler.append(name,bar);}
    function draw(){const left=Number(input.value);ruler.style.setProperty('--left',left/12*100+'%');result.textContent='Ventana entre '+left+' y '+(left+10)+' cm. Quedan visibles '+intervals.filter(m=>Math.min(left+10,Number(m[3]))>Math.max(left,Number(m[2]))).map(m=>m[1].toLocaleLowerCase('es')).join(', ')+'.';}
    input.addEventListener('input',draw);parent.append(ruler,label,result);draw();
  }
  function foldBook(parent,lines){
    const pair=lines.find(line=>line.includes('PÁGINA IZQUIERDA:')&&line.includes('PÁGINA DERECHA:'));
    if(!pair){sheets(parent,lines);return;}
    notes(parent,lines.filter(line=>line!==pair));
    const book=el('div','ve-book'),result=status(),picked={side:0,index:0};
    const sides=pair.split('|').map(side=>side.split(':')[1].trim().replace(/[.]$/,'').split(/\s+/));
    if(sides.length!==2||sides[0].length!==sides[1].length){notes(parent,[pair]);return;}
    function refresh(){book.replaceChildren();sides.forEach((cols,side)=>{const leaf=el('div','ve-leaf');
      leaf.append(el('strong','',side?'Página derecha':'Página izquierda'));
      cols.forEach((c,i)=>{const b=button(c,()=>{picked.side=side;picked.index=i;refresh();});b.setAttribute('aria-pressed',String(side===picked.side&&i===picked.index));leaf.append(b);});book.append(leaf);});
      result.textContent='Al cerrar el libro, '+sides[picked.side][picked.index]+' toca '+sides[1-picked.side][sides[0].length-1-picked.index]+'.';}
    parent.append(book,result);refresh();
  }
  function seats(parent,lines){
    const seatLines=lines.filter(line=>line.includes('puestos')&&line.includes('|'));
    if(seatLines.length!==2){sheets(parent,lines);return;}
    const layouts=seatLines.map(line=>line.match(/\d+/g));
    if(!layouts[0]||layouts[0].length!==layouts[1]?.length){sheets(parent,lines);return;}
    let picked='';
    const view=el('div','ve-seats'),read=status();
    function paint(){
      view.replaceChildren();layouts.forEach((numbers,side)=>{const row=el('div','ve-seat-row');row.append(el('b','',seatLines[side].split(':')[0]));
        numbers.forEach((n,i)=>{const b=button(n,()=>{picked=n;read.textContent='El puesto '+n+' queda frente al '+layouts[1-side][i]+'.';paint();});b.setAttribute('aria-pressed',String(n===picked));row.append(b);});view.append(row);});
    }
    notes(parent,lines.filter(s=>!seatLines.includes(s)));parent.append(view,read);paint();
  }
  function ledgers(parent,lines,item,caseId){
    const data=lines.filter(line=>line.includes('|')).map(line=>line.split('|').map(x=>x.trim()));
    const header=headed[caseId].includes(item.id)?data.shift():null;
    if(!data.length){sheets(parent,lines);return;}
    const extra=lines.filter(line=>!line.includes('|'));const label=el('p','ve-tip','Elige un registro. Puedes fijarlo y abrir otro a su lado.');
    const rail=controls(),panels=el('div','ve-comparison'),pin=button('Fijar este registro',()=>{held=held===active?null:active;paint();}),annotation=status();
    let active=0,held=null;
    const names=data.map(row=>row[0]),duplicates=new Set(names.filter((n,i)=>names.indexOf(n)!==i));
    const controlsByRow=data.map((row,i)=>{const b=button(row[0]+(duplicates.has(row[0])?' · '+row[1]:''),()=>{active=i;paint();});rail.append(b);return b;});
    function card(i,pinned){
      const sheet=el('article','ve-slip');sheet.dataset.pinned=String(pinned);
      if(pinned)sheet.append(el('small','','Registro fijado'));
      const list=el('dl','ve-entries');
      for(const [idx,value] of data[i].entries()){
        if(header?.[idx])list.append(el('dt','',header[idx]));list.append(el('dd','',value));
      }
      sheet.append(list);
      if(caseId===6&&item.id==='calcos')addThreads(sheet,data[i]);
      if(caseId===9&&item.id==='impulsos')addBell(sheet,data[i]);
      return sheet;
    }
    function paint(){
      controlsByRow.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===active)));
      panels.replaceChildren();if(held!==null&&held!==active)panels.append(card(held,true));panels.append(card(active,held===active));
      pin.textContent=held===active?'Soltar este registro':'Fijar este registro';pin.setAttribute('aria-pressed',String(held===active));annotation.textContent='';
      if(caseId===12&&item.id==='marcas'&&held!==null&&held!==active){
        const times=[held,active].map(i=>data[i][0].match(/^(\d+):(\d+)$/));
        if(times.every(Boolean)){const seconds=times.map(m=>Number(m[1])*60+Number(m[2]));annotation.textContent='Separación entre marcas · '+Math.abs(seconds[1]-seconds[0])+' s.';}
      }
    }
    parent.append(label,rail,panels,pin,annotation);notes(parent,extra);
    if((caseId===5&&item.id==='ofertas')||(caseId===6&&item.id==='costes'))sumDesk(parent,data,caseId);
    paint();
  }
  function addThreads(sheet,row){
    const sample=row[2]?.match(/(Claro|Oscuro) de ([1-4]) a ([1-4]) sobre (claro|oscuro) de ([1-4]) a ([1-4])/i);
    if(!sample)return;
    const swatch=el('div','ve-swatch');swatch.setAttribute('aria-hidden','true');
    for(const [word,start,end] of [[sample[4],sample[5],sample[6]],[sample[1],sample[2],sample[3]]]){
      const line=el('i','ve-thread');line.dataset.ink=word.toLowerCase();line.dataset.slash=String(new Set([start,end]).has('1'));swatch.append(line);
    }
    sheet.append(swatch);
  }
  function addBell(sheet,row){
    const text=row.at(-1),pulse=text.match(/(?:un timbre largo|dos timbres cortos)/i);
    if(!pulse)return;
    const panel=el('div','ve-pulses'),b=button('Pulsar la salida '+row[0],()=>{
      panel.replaceChildren();const short=pulse[0].toLowerCase().startsWith('dos');for(let i=0;i<(short?2:1);i++){const pip=el('span','');pip.dataset.short=String(short);panel.append(pip);}panel.setAttribute('aria-label',pulse[0]);
    });
    panel.setAttribute('role','img');panel.setAttribute('aria-label','Salida en reposo');sheet.append(b,panel);
  }
  function sumDesk(parent,rows,caseId){
    const budget=el('details','ve-budget'),summary=el('summary','','Calculadora del expediente'),total=status(),tray=controls(),sums=new Map();
    for(const row of rows){
      const price=caseId===5?row[1]?.match(/^(\d+)$/):row[1]?.match(/(?:Paga|Deposita)\s+(\d+)/i);
      if(!price)continue;
      const b=button(row[0]+' · '+price[1],()=>{if(sums.has(b))sums.delete(b);else sums.set(b,Number(price[1]));b.setAttribute('aria-pressed',String(sums.has(b)));show();});b.setAttribute('aria-pressed','false');tray.append(b);
    }
    function show(){total.textContent='Suma de las cantidades marcadas · '+[...sums.values()].reduce((a,b)=>a+b,0)+(caseId===5?' créditos':' fichas antes de devoluciones');}
    if(tray.childElementCount){budget.append(summary,tray,total);parent.append(budget);show();}
  }
  function render({stage,index,caseId,shelf}){
    if(!stages[caseId]?.[index]||shelf.dataset.veExamined)return;
    shelf.dataset.veExamined='true';
    const projected=new Map((stage.materials||[]).map(m=>[String(m.id),m]));
    for(const card of shelf.querySelectorAll('.vhour-material')){
      const item=projected.get(card.dataset.material),summary=card.querySelector(':scope > summary');
      if(!item || !summary || !item.body?.trim())continue;
      const thumb=summary.querySelector('.vhour-format-photo'),scene='/valdemar-lector-'+caseId+'-'+(index+1)+'.webp';
      if(thumb){thumb.classList.add('ve-thumb');thumb.style.backgroundImage='url("'+scene+'")';}
      const box=el('section','ve-desk'),header=el('header','ve-cover'),photo=el('img');
      box.dataset.case=String(caseId);box.dataset.form=item.kind;
      photo.alt='';photo.src=scene;photo.loading='lazy';header.append(photo,el('h5','',sourceNames[caseId][item.id]||stages[caseId][index]));box.append(header);
      const body=el('div','ve-content'),original=[...card.children].filter(n=>n!==summary),lines=lineArray(item.body);
      if(item.kind==='audio'||item.kind==='testimony'||item.clip){body.append(...original);annotateRecording(body);}
      else {
        if(caseId===8&&item.id==='cuadricula')orientation(body,item.body);
        else if(caseId===7&&item.id==='franjas')crop(body,lines);
        else if(caseId===10&&item.id==='espejo')foldBook(body,lines);
        else if(caseId===10&&item.id==='puestos')seats(body,lines);
        else if(caseId===10&&item.id==='orden')sheets(body,lines);
        else if(lines.some(s=>/[→↔]/.test(s))||caseId===8&&item.id==='red')routeView(body,lines);
        else if(lines.some(s=>s.includes('|')))ledgers(body,lines,item,caseId);
        else sheets(body,lines,item.id==='cortes'?'film':'');
        original.forEach(n=>n.remove());
      }
      box.append(body);card.append(box);
    }
  }
  window.ArchivosDeCaso ||= {};
  for(const id of Object.keys(stages))window.ArchivosDeCaso[id]=render;
})();
