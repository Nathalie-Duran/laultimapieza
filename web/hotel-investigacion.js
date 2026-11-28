(() => {
  'use strict';
  const file = name => '/hotel-medianoche-' + name + '.webp';
  function make(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function action(text, fn, cls) {
    const button = make('button', cls, text);
    button.type = 'button';
    button.addEventListener('click', fn);
    return button;
  }
  function prop(name) {
    const img = make('img', 'hm-object');
    img.src = file(name);
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }
  const rooms=['conmutador','obras','archivo','entrevistas','acta'];
  function roomPhoto(index) {
    const image=make('img','hm-room-photo');
    image.src='/hotel-mesa-'+rooms[index]+'.webp';
    image.alt='';
    image.decoding='async';
    return image;
  }
  const stages = [
    {title:'La centralita de noche', image:'centralita', instruction:'Escoge una toma del conmutador y conecta una orden. Las tres órdenes se cursarán de izquierda a derecha.'},
    {title:'La mesa del aparejador', image:'planta', instruction:'Abre cada pieza de la mesa y fija una conclusión. Contrasta la reforma con el plano y el libro de cerrajería.'},
    {title:'La ampliadora del archivo', image:'negativo', instruction:'Abre el portafotos para elegir dos testigos. En la carpeta de documentos, añade la fuente que puede explicar la tercera persona.'},
    {title:'La ronda de entrevistas', image:'registro', instruction:'Elige un objeto de la carpeta y a quién se lo mostraste en el hotel. Incorpora la declaración correspondiente a tu cuaderno.'},
    {title:'El acta de la última llamada', image:'recado', instruction:'Redacta el cierre de la guardia. Sella una anotación en cada apartado y repasa el acta antes de entregarla.'}
  ];
  const families = {
    1:[
      ['Llaves de servicio','llaves',['copia','familia']],
      ['Planta del rellano','planta',['numero','tabique']],
      ['Cilindro central','llaves',['cilindro','nuevo']]
    ],
    2:[
      ['Testigos de aquella tarde','negativo',['lucia','dario','simon','amalia'],2],
      ['Fuente documental','registro',['factura','foto']]
    ],
    4:[
      ['Vínculo familiar','negativo',['parentesco','hereda']],
      ['Origen de las llaves','llaves',['numero','causa']],
      ['Instrucciones de contacto','recado',['permiso','subir']]
    ]
  };
  const switchProps = {pino:'llaves',seno:'centralita',roble:'llaves',puerta:'planta',guardia:'recado',monta:'planta'};
  const shortLabels={pino:'Armario de pino',seno:'Aviso sonoro',roble:'Manta del armario de roble',puerta:'Armario de nogal',guardia:'Recado a guardia',monta:'Montacargas'};
  const interviewObjects = [
    ['plano','Plano de la reforma','planta'],['foto','Recorte de fotografía','negativo'],['recibo','Hoja de depósito','registro']
  ];
  const materialImages = {
    voz:'centralita',protocolo:'centralita',ronda:'llaves',planta:'planta',llaves:'llaves',palabra:'planta',
    negativo:'negativo',fechas:'registro',registro:'registro',fuentes:'negativo',objetos:'llaves',entrevista:'registro',
    referencia:'negativo',candela:'centralita',margen:'registro',recado:'recado'
  };
  function switchboard(root, surface, stage, selected, sync) {
    const sockets = make('div','hm-jacks'), contacts = make('div','hm-contacts');
    const rig=make('div','hm-switch-rig'), leads=make('canvas','hm-cables');
    leads.setAttribute('aria-hidden','true');
    const slots = Array.from({length:stage.requiredCount || 3}, () => null);
    let active = 0;
    const jacks = slots.map((_,i) => {
      const b = action('', () => {active=i;paint();}, 'hm-jack');
      b.append(make('span','hm-port'),make('span','hm-jack-number','Toma '+(i+1)),make('span','hm-jack-label'));
      sockets.append(b); return b;
    });
    const buttons = stage.options.map(opt => {
      const b = action('', () => {
        const old = slots.indexOf(opt.id);
        if (old>=0) slots[old]=null;
        slots[active]=opt.id;
        const next = slots.indexOf(null);
        if (next>=0) active=next;
        paint();
      }, 'hm-contact');
      b.dataset.vhValue=opt.id;
      b.append(make('i','hm-plug'),prop(switchProps[opt.id] || 'centralita'),make('span','',opt.label));
      contacts.append(b); return b;
    });
    const unplug = action('Desconectar la toma activa', () => {slots[active]=null;paint();}, 'hm-erase');
    let drawing=0;
    function drawLeads(){
      drawing=0;
      const r=rig.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      leads.width=Math.round(r.width*dpr);leads.height=Math.round(r.height*dpr);
      const ctx=leads.getContext('2d');if(!ctx)return;
      ctx.scale(dpr,dpr);ctx.lineCap='round';
      slots.forEach((id,i)=>{
        if(!id)return;
        const a=jacks[i].querySelector('.hm-port').getBoundingClientRect(),b=contacts.querySelector('[data-vh-value="'+id+'"] .hm-plug')?.getBoundingClientRect();
        if(!b)return;
        const x=a.left+a.width/2-r.left,y=a.top+a.height*.72-r.top;
        const dx=b.left+b.width/2-r.left,dy=b.top-r.top;
        const bow=Math.max(14,Math.min(66,(dy-y)*.3));
        for(const [width,ink] of [[7,'#181913'],[4,['#b16943','#599c8b','#c99d57'][i]]]){
          ctx.beginPath();ctx.strokeStyle=ink;ctx.lineWidth=width;
          ctx.moveTo(x,y);ctx.bezierCurveTo(x,y+bow,dx,dy-bow,dx,dy);ctx.stroke();
        }
      });
    }
    function queueDraw(){if(!drawing)drawing=requestAnimationFrame(drawLeads);}
    function paint() {
      selected.splice(0,selected.length,...slots.filter(Boolean));
      jacks.forEach((b,i) => {
        const order=stage.options.find(o=>o.id===slots[i]);
        b.lastChild.textContent=order?(shortLabels[order.id]||order.label):'Libre';
        b.setAttribute('aria-label','Toma '+(i+1)+' · '+(order?.label||'Sin conectar'));
        b.setAttribute('aria-pressed',String(i===active));
        b.dataset.connected=String(Boolean(slots[i]));
      });
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(slots.includes(stage.options[i].id))));
      unplug.disabled=!slots[active];
      sync(selected.length+' de '+slots.length+' tomas conectadas.');
      queueDraw();
    }
    surface.append(sockets);surface.after(rig);rig.append(surface,contacts,leads);
    root.append(unplug);
    if(window.ResizeObserver){
      const resize=new ResizeObserver(()=>{if(rig.isConnected)queueDraw();else resize.disconnect();});
      resize.observe(rig);
    }
    paint();
  }
  function dossier(root, surface, stage, index, selected, sync) {
    const entries = families[index];
    const opts = new Map(stage.options.map(o=>[o.id,o]));
    const groups = make('div','hm-files');
    const total = entries.reduce((n,row)=>n+(row[3]||1),0);
    const controls = [];
    const instruments=make('div','hm-board-pins');
    instruments.setAttribute('role','group');instruments.setAttribute('aria-label',stages[index].title);
    surface.append(instruments);
    let active=0;
    for (const [position,[name, image, ids, limit=1]] of entries.entries()) {
      const pin=action('',()=>{active=position;paint();},'hm-board-pin');
      const badge=make('span','hm-pin-count');
      pin.append(make('i','hm-pin-light'),make('span','hm-pin-title',name),badge);instruments.append(pin);
      const section = make('section','hm-file'), cap = make('div','hm-file-cap');
      cap.append(prop(image),make('h6','',name));
      section.append(cap);
      const summary = make('span','hm-file-count');
      cap.append(summary);
      const buttons=ids.map(id=>{
        const opt=opts.get(id);
        const b=action(opt.label,()=>{
          const at=selected.indexOf(id);
          if(at>=0) selected.splice(at,1);
          else {
            const inGroup=selected.filter(x=>ids.includes(x));
            if(limit===1 && inGroup.length) selected.splice(selected.indexOf(inGroup[0]),1);
            else if(inGroup.length>=limit) return;
            selected.push(id);
          }
          paint();
        }, 'hm-slip');
        b.dataset.vhValue=id;section.append(b);return b;
      });
      controls.push({summary,ids,limit,buttons,pin,badge,section});
      groups.append(section);
    }
    function paint(){
      for(const [i,{ids,limit,summary,buttons,pin,badge,section}] of controls.entries()) {
        const count=selected.filter(x=>ids.includes(x)).length;
        summary.textContent=count+' / '+limit;
        badge.textContent=count+' / '+limit;
        section.hidden=i!==active;
        pin.setAttribute('aria-pressed',String(i===active));
        pin.dataset.complete=String(count===limit);
        buttons.forEach((button,i)=>{
          const on=selected.includes(ids[i]);button.setAttribute('aria-pressed',String(on));
          button.disabled=limit>1 && count>=limit && !on;
        });
      }
      sync(selected.length+' de '+total+(index===4?' anotaciones selladas.':index===2?' fichas archivadas.':' conclusiones fijadas.'));
    }
    root.append(groups);paint();
  }
  function interviews(root, surface, stage, selected, sync) {
    const tray=make('div','hm-tray'), people=make('div','hm-people'), page=make('div','hm-interview-page');
    const names={s:'Simón',l:'Lucía',d:'Darío'};
    let object=interviewObjects[0][0];
    const artifacts=interviewObjects.map(([id,name,img])=>{
      const b=action('',()=>{object=id;paint();},'hm-exhibit');
      b.append(prop(img),make('span','',name));tray.append(b);return b;
    });
    const rows=stage.options.map(opt=>{
      const [oid,person]=opt.id.split('-');
      const b=action('',()=>{
        const at=selected.indexOf(opt.id);
        if(at>=0)selected.splice(at,1);
        else{
          const older=selected.find(id=>id.endsWith('-'+person));
          if(older)selected.splice(selected.indexOf(older),1);
          selected.push(opt.id);
        }
        paint();
      },'hm-interview');
      b.dataset.vhValue=opt.id;
      b.append(make('strong','',names[person]),make('span','',opt.label.slice(opt.label.indexOf(':')+1).trim()));
      people.append(b);return {oid,person,opt,b};
    });
    function paint(){
      artifacts.forEach((b,i)=>b.setAttribute('aria-pressed',String(interviewObjects[i][0]===object)));
      rows.forEach(({oid,opt,b})=>{b.hidden=oid!==object;b.setAttribute('aria-pressed',String(selected.includes(opt.id)));});
      page.replaceChildren(make('h6','','Cuaderno de declaraciones'));
      for(const person of Object.keys(names)){
        const row=rows.find(r=>r.person===person && selected.includes(r.opt.id));
        const slip=make('p','hm-stub');
        slip.append(make('strong','',names[person]),make('span','',row?row.opt.label.split(':').slice(1).join(':').trim():'Sin declaración archivada'));
        page.append(slip);
      }
      sync(selected.length+' de 3 entrevistas archivadas.');
    }
    surface.append(tray);root.append(people,page);paint();
  }
  function renderDecision({field, stage, index, selected, change, controller}) {
    const info=stages[index];
    if(!info || !Array.isArray(stage.options))return false;
    const known=stage.options.map(o=>o.id);
    if(index===3 && !known.every(id=>/^(plano|foto|recibo)-[sld]$/.test(id)))return false;
    if(families[index] && families[index].flatMap(group=>group[2]).some(id=>!known.includes(id)))return false;
    field.dataset.requiredChoices=String(stage.requiredCount || 3);
    field.dataset.vhPrueba=['centralita','plano-de-la-suite','archivo-de-visitas','ronda-de-entrevistas','acta-de-guardia'][index];
    const desk=make('section','hm-desk hm-desk-'+index);
    const banner=make('header','hm-desk-head'),text=make('div','hm-desk-caption'),surface=make('div','hm-stage-surface');
    text.append(make('h5','',info.title),make('p','',info.instruction));
    banner.append(text);surface.append(roomPhoto(index));desk.append(banner,surface);
    if(index===3 && controller?.sceneBack && controller.visitHotel) {
      desk.append(action('Entrevistar a los tres visitantes',controller.visitHotel,'hm-visit'));
    }
    const meter=make('p','hm-meter');meter.setAttribute('role','status');
    const sync=message=>{meter.textContent=message;change();};
    if(index===0) switchboard(desk,surface,stage,selected,sync);
    else if(index===3)interviews(desk,surface,stage,selected,sync);
    else dossier(desk,surface,stage,index,selected,sync);
    desk.append(meter);field.append(desk);
    return true;
  }
  function planReader(material) {
    const lines=material.body?.split(/\r?\n/).filter(line=>/^\d{4}:/.test(line));
    if(lines?.length!==2)return null;
    const reader=make('div','hm-viewer'),bar=make('div','hm-years'),drawing=make('div','hm-plan');
    const title=make('h6','','Plano del rellano'),caption=make('p','hm-plan-text');
    const rooms=['Junto al patio','Dormitorio central','Dormitorio derecho'];
    const doors=['12','14','16'].map((n,i)=>{const door=make('span','hm-door');door.append(make('b','',n),make('small','',rooms[i]));drawing.append(door);return door;});
    drawing.setAttribute('aria-hidden','true');caption.setAttribute('aria-live','polite');
    const tabs=lines.map((line,i)=>{const button=action(line.slice(0,4),()=>draw(i),'hm-year');bar.append(button);return button;});
    function draw(i){
      tabs.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
      title.textContent='Plano del rellano · '+lines[i].slice(0,4);
      doors.forEach((door,j)=>{door.dataset.closed=String(i===1 && j!==1);door.lastChild.textContent=i===0?rooms[j]:j===1?'Salón':'Hueco cegado';});
      caption.textContent=lines[i].slice(5).trim();
    }
    reader.append(title,bar,drawing,caption);draw(0);return reader;
  }
  // The filing cards read only the evidence actually supplied to this player.
  // Choosing a tab changes the document under examination, never the case state.
  const sourceDesk = {
    voz:['Centralita de huéspedes','Elige una línea del conmutador','centralita'],
    protocolo:['Placa de señales','Probar una señal','centralita'],
    ronda:['Armarios de guardia','Girar una etiqueta','llaves'],
    planta:['Planos del rellano','Comparar las plantas','planta'],
    llaves:['Registro de cerrajería','Abrir un encargo','llaves'],
    palabra:['Declaración del inspector','Seguir el testimonio','llaves'],
    negativo:['Sobre del revelador','Dar la vuelta a la tira','negativo'],
    fechas:['Calendario de obra','Examinar una fecha','registro'],
    registro:['Registro de huéspedes','Abrir un asiento','registro'],
    fuentes:['Fichero de testigos','Contrastar la procedencia','negativo'],
    objetos:['Carpeta de procedencias','Examinar un objeto','llaves'],
    entrevista:['Cuaderno de recepción','Pasar una hoja','registro'],
    referencia:['Tarjetas para la entrevista','Sacar una pregunta','recado'],
    candela:['Llamada de devolución','Escuchar a Candela','centralita'],
    margen:['Acta de guardia','Leer una columna','registro'],
    recado:['Sobre de Simón','Abrir el sobre','recado']
  };
  const excerpts = {
    voz:[['Alzar el auricular',/«([^»]+)»/],['Pasar a la línea de servicio',/(Cuando cuelga[\s\S]+)/]],
    negativo:[['Dorso de la tira',/«([^»]+)»/],['Nota del revelador',/»\.\s*([\s\S]+)/]],
    candela:[['El mensaje',/«(.*?mensaje\.)/],['La llamada',/(Si prefiere hablar,.*?pasáis\.)/],['El número',/(Por favor, [^»]+)/]],
    referencia:[['Simón',/(¿Tuvo[^?]+\?)/],['Lucía',/(¿Dónde[^?]+\?)/],['Candela',/(¿Qué relación[^?]+\?)/]]
  };
  function pagesFor(evidence) {
    const {id,body}=evidence;
    const labels={
      palabra:['Las copias','La obra','El encargo','El parentesco'],
      fuentes:['Quien estaba allí','Documento heredado','Fotografía'],
      entrevista:['Detalle nuevo','Reconocer la llave','Anotación de guardia']
    };
    if(excerpts[id]){
      return excerpts[id].map(([name,rx])=>[name,body.match(rx)?.[1]?.trim()]).filter(([,text])=>text);
    }
    if(id==='recado')return [['Mensaje bajo el sello',body]];
    if(id==='protocolo'){
      const phrases=body.match(/[^.]+(?:\.|$)/g)||[];
      return phrases.map((phrase,i)=>{
        const [label,result]=phrase.trim().split(/\s*→\s*/);
        return [result?label:['','','','','Pilotos de servicio','Ascensor'][i]||'Nota',result||phrase.trim()];
      });
    }
    if(labels[id]){
      const sentences=body.replace(/^[«“"]|[»”"]$/g,'').match(/[^.!?]+(?:[.!?]+|$)/g)||[];
      return sentences.map((sentence,i)=>[labels[id][i]||'Apunte '+(i+1),sentence.trim()]);
    }
    const rows=body.split(/\r?\n/).filter(line=>line.includes('|')).map(line=>line.split('|').map(cell=>cell.trim()));
    if(!rows.length)return [];
    const titles=['llaves','fechas','objetos','margen'].includes(id)?rows.shift():null;
    return rows.map(row=>[row[0],row.slice(1).map((s,j)=>titles?.[j+1]?titles[j+1]+' · '+s:s).join('\n')]);
  }
  function callSignal() {
    const box=make('div','hm-call-signal');
    const sequence=['Primer timbre','Segundo timbre','Pausa','Clic final'];
    const lights=make('div','hm-signal-lights');
    const bulbs=sequence.map((label,i)=>{const tick=make('span','hm-signal-tick',String(i+1));tick.title=label;lights.append(tick);return tick;});
    const log=make('output','hm-signal-log','Aviso de servicio');
    log.setAttribute('aria-live','polite');
    let step=-1;
    const button=action('Seguir el aviso',()=>{
      step=(step+1)%sequence.length;
      bulbs.forEach((bulb,i)=>bulb.classList.toggle('hm-lit',i===step));
      log.textContent=sequence[step];
      button.textContent=step===3?'Repetir el aviso':'Siguiente señal';
    },'hm-chip');
    box.append(lights,button,log);return box;
  }
  const sourceSurface={
    voz:0,protocolo:0,ronda:'llaves',planta:1,llaves:1,palabra:1,negativo:2,fechas:2,registro:2,fuentes:2,
    objetos:3,entrevista:3,referencia:3,candela:0,margen:4,recado:4
  };
  function clipReader(evidence) {
    const spec=sourceDesk[evidence.id];
    if(!spec || typeof evidence.body!=='string')return null;
    const [title,operation,art]=spec;
    const folder=make('section','hm-document hm-document-'+evidence.id);
    const plate=make('div','hm-document-plate');
    const scene=sourceSurface[evidence.id];
    const background=typeof scene==='number'?roomPhoto(scene):prop(scene||art);
    background.classList.add('hm-document-image');plate.append(background);
    const work=make('div','hm-document-work');
    const heading=make('h5','',title);
    const label=make('header','hm-document-heading');label.append(heading);plate.append(label);
    folder.append(plate,work);
    if(evidence.id==='planta'){
      const plan=planReader(evidence);if(!plan)return null;
      plate.append(plan);return folder;
    }
    const pages=pagesFor(evidence);
    if(!pages.length)return null;
    const tabs=make('div','hm-source-tabs');
    tabs.setAttribute('role','group');tabs.setAttribute('aria-label',operation);
    const sheet=make('div','hm-document-sheet'),caption=make('strong','hm-document-label'),copy=make('p','hm-document-copy');
    sheet.setAttribute('aria-live','polite');
    sheet.append(caption,copy);
    const isLetter=evidence.id==='recado';
    const isCalendar=evidence.id==='fechas';
    const signal=evidence.id==='voz'?callSignal():null;
    const isPhone=evidence.id==='voz'||evidence.id==='candela';
    const phoneState=isPhone?make('p','hm-phone-state','Auricular en su soporte'):null;
    if(phoneState){phoneState.setAttribute('role','status');label.append(phoneState);}
    const dock=make('div','hm-doc-dock');
    plate.append(dock);
    if(isCalendar){
      tabs.classList.add('hm-calendar');
      for(const day of ['L','M','X','J','V','S','D']){
        const name=make('span','hm-weekday',day);name.setAttribute('aria-hidden','true');tabs.append(name);
      }
    }
    if(!isLetter)dock.append(make('span','hm-instrument-label',operation),tabs);
    let selected=-1;
    const buttons=[];
    function show(i){
      selected=i;buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(i===n)));
      const page=pages[i];
      sheet.hidden=!page;
      if(signal)signal.hidden=i!==1;
      if(isPhone){
        background.src='/hotel-mesa-'+(page?'descolgado':'conmutador')+'.webp';
        phoneState.textContent=page?(signal && i===1?'Línea de servicio conectada':'En línea con Candela'):'Auricular en su soporte';
        if(signal && buttons[0])buttons[0].textContent=i===0?'Colgar el auricular':i===1?'Volver a Candela':'Descolgar y leer';
        folder.dispatchEvent(new CustomEvent('hm-line-changed',{detail:i}));
      }
      if(!page){folder.dataset.page='closed';return;}
      folder.dataset.page=String(i+1);
      caption.textContent=isPhone?(signal&&i===1?'Transcripción del aviso de servicio':'Transcripción de Candela'):page[0];
      copy.textContent=page[1];
      if(evidence.id==='objetos'){
        const artName=['planta','negativo','registro'][i]||art;
        sheet.querySelector('.hm-evidence-inset')?.remove();
        const card=prop(artName);card.classList.add('hm-evidence-inset');sheet.prepend(card);
      }
    }
    function newTab(name,i){
      const b=action(name,()=>show(signal&&i===0&&selected===0?-1:i),'hm-chip');
      buttons[i]=b;return b;
    }
    if(isLetter){
      const open=action('Romper el sello y leer el recado',()=>{
        const expanding=selected<0;
        show(expanding?0:-1);open.setAttribute('aria-expanded',String(expanding));open.textContent=expanding?'Doblar el recado':'Abrir el sobre';
      },'hm-chip');
      open.setAttribute('aria-expanded','false');dock.append(open);
    }else if(isCalendar){
      const indices=new Map(pages.map((p,i)=>[parseInt(p[0],10),i]));
      // Monday 1 July 1996 starts the printed calendar.
      for(let date=1;date<=31;date++){
        const i=indices.get(date);
        const d=i==null?make('span','hm-calendar-day',String(date)):newTab(String(date),i);
        tabs.append(d);
      }
    }else{
      pages.forEach(([label],i)=>tabs.append(newTab(label,i)));
    }
    work.append(sheet);
    if(signal)work.append(signal);
    show(isLetter || isPhone?-1:0);return folder;
  }
  function decorateShelf({shelf,stage}) {
    shelf.classList.add('hm-evidence-shelf');
    for(const card of shelf.querySelectorAll('[data-material]')) {
      if(card.querySelector('.hm-document'))continue;
      const evidence=stage.materials.find(m=>m.id===card.dataset.material);
      if(!evidence)continue;
      const img=materialImages[evidence.id];
      const thumb=card.querySelector('.vhour-format-photo');
      if(img && thumb){thumb.classList.add('hm-photo');thumb.style.backgroundImage='url("'+file(img)+'")';}
      const reader=clipReader(evidence),summary=card.querySelector('summary');
      if(reader && summary) {
        card.classList.add('hm-evidence-card');
        const original=make('details','hm-original');
        original.append(make('summary','','Consultar la fuente íntegra'));
        const contents=[...card.children].filter(child=>child!==summary);
        const playback=card.querySelector('.vhour-recording audio,.vhour-recording .vhour-listen');
        if(playback && (evidence.id==='voz'||evidence.id==='candela')){
          const row=make('div','hm-phone-playback'),status=playback.parentElement.querySelector('.vhour-status');
          playback.setAttribute('aria-label','Reproducir o detener la lectura de la llamada');
          row.hidden=true;row.append(playback);
          if(status)row.append(status);
          reader.querySelector('.hm-document-work').append(row);
          reader.addEventListener('hm-line-changed',event=>{
            row.hidden=event.detail<0 || evidence.id==='voz' && event.detail===1;
            if(row.hidden && playback.tagName==='AUDIO')playback.pause();
            else if(row.hidden && playback.getAttribute('aria-pressed')==='true')playback.click();
          });
        }
        original.append(...contents);
        card.append(reader,original);
      }
    }
  }
  function examineObject(obj) {
    const photo={plano:'planta',recorte:'recorte',recibo:'registro'}[obj.id];
    if(!photo)return null;
    const viewer=make('details','hm-evidence-viewer'),summary=make('summary','',obj.id==='recorte'?'Ampliar el recorte fotográfico':'Examinar el documento de cerca');
    const body=make('div','hm-evidence-detail');
    if(obj.id==='recibo'){
      const slip=make('article','hm-receipt');
      slip.append(make('strong','','Depósito de cerrajería'),make('span','','Entrega de una llave al hotel'),make('i','','Firma de entrega'),make('i','','Firma de recepción'));
      body.append(slip);
    }else{
      const plate=prop(photo);plate.alt=obj.id==='recorte'?'En el reflejo de la ventana asoman una trenza y una correa. Delante de la barandilla, un salvavidas de papel se dobla en forma de ocho.':'Tres dormitorios contiguos comparten un rellano en el plano de la reforma.';
      body.append(plate);
    }
    viewer.append(summary,body);
    return viewer;
  }
  window.FotosHotel=examineObject;
  (window.MesasDeCaso ||= {})[2]=renderDecision;
  (window.ArchivosDeCaso ||= {})[2]=decorateShelf;
})();

// Workstations for the night shift. The store authorizes each role and records a
// completed operation before the other desk or a resumed session can advance.
(() => {
  const desks=[
    [
      {name:'El cordón de guardia', image:'mesa-conmutador', prompt:'Descuelga. Busca en Turno de noche el recorrido del cable y prepara una entrega que respete a Candela.',
       sheet:'Candela habla bajito. «Una manta, por favor. Que nadie suba. Dejádmela con la guardia». Tras colgar oyes dos timbres cortos, una pausa y un clic. El piloto lleva bordada una madeja.',
       wheels:[['Entrada','Patio','Ascensor','Servicio'],['Derivación','Ropa blanca','Equipajes','Cocina'],['Destino','Montacargas','Guardia','Suite']]},
      {name:'El armario de las copias',image:'estancia-centralita',prompt:'Pide a Recepción que describa la secuencia y la petición. Gira las tres etiquetas del carro antes de enviarlo.',
       sheet:'Placa trasera del conmutador. La madeja corresponde a ropa blanca. El cable entra siempre por Servicio. El terminal Guardia entrega en mano. Dos timbres y clic identifican el ala Estación. Etiquetas de almacén: Estación–roble, Patio–pino, Jardín–nogal.',
       wheels:[['Ala','Patio','Estación','Jardín'],['Armario','Nogal','Pino','Roble'],['Entrega','En mano','En cabina','En la puerta']]}
    ],[
      {name:'Banco de cerrajería',image:'medianoche-llaves',prompt:'Ordena los tres elementos de la reconstrucción. Pregunta qué hueco seguía dando al rellano después de la obra.',
       sheet:'Libro de trabajos. F-31: tres copias hermanas para dormitorios del mismo rellano. R-14: unir interiores, conservar la puerta de paso. M-04: cerradura nueva para el mueble del conserje. Sobre el calco el triángulo señala la escalera y el círculo señala el patio.',
       wheels:[['Origen','Llave privada','Pase maestro','Tres copias'],['Puerta conservada','12','14','16'],['Destino de M-04','Suite','Patio','Escalera','Mueble']]},
      {name:'Mesa de luz del rellano',image:'mesa-obras',prompt:'Alinea las dos hojas hasta que coincidan las marcas de la escalera y del patio. Después coloca la puerta de paso que figura en el libro.',
       sheet:'Calco de obra. En 1981 entraba luz por tres umbrales. En 2001 los dos laterales tienen trama de ladrillo y el hueco intermedio conserva las bisagras. Las plantas están dibujadas a la misma escala.',
       wheels:[['Mover en horizontal','−1','Centro','+1'],['Mover en vertical','−2','−1','Centro','+1'],['Entrada','12','14','16']]}
    ],[
      {name:'La lupa de Lucía',image:'medianoche-recorte',prompt:'Desplaza la lupa por la copia y enfoca el reflejo. Pregunta al archivo qué intervalo conservar en el sobre.',
       sheet:'Sobre del revelador. «Jueves antes del cierre de la escalera. Foto después de las seis y antes de la ronda de las seis y media». En el borde del espejo se ve la correa de la cámara. La anotación de Lucía identifica ese espejo con el extremo derecho del encuadre.',
       wheels:[['Encuadre','Barandilla','Centro','Espejo'],['Enfoque','Nítido','Corto','Largo'],['Franja','17:30–18:00','18:30–19:00','18:00–18:30']]},
      {name:'La banda de visitas',image:'medianoche-registro',prompt:'Sitúa el negativo en la banda horaria y separa a quien vio la escena de quien conoce la procedencia de una llave.',
       sheet:'Registro de ronda. Primera vuelta a las 18:00, segunda a las 18:30. Simón estaba alojado entre ambas rondas. Lucía tenía permiso de fotografía. El recibo de Amalia llega años después en la caja que conserva Darío.',
       wheels:[['Inicio','17:30','18:00','18:30'],['Fin','18:00','19:00','18:30'],['Caja heredada','Darío','Simón','Lucía']]}
    ],[
      {name:'La carpeta de entrevistas',image:'mesa-entrevistas',prompt:'Recorre las estancias. Muestra los tres objetos y escucha lo que cada persona añade. Coloca cada objeto en la carpeta de quien pudo explicarlo.',
       sheet:'Hoja del entrevistador. Simón dibuja en un papel un aro doblado en ocho. Lucía recuerda la correa: estaba detrás de la cámara. Darío lee las dos firmas del depósito de su tía. Contrasta estas anotaciones con las declaraciones recogidas.',
       wheels:[['Simón','Recibo','Plano','Recorte'],['Lucía','Plano','Recibo','Recorte'],['Darío','Recibo','Recorte','Plano']]},
      {name:'La rueda de testimonios',image:'estancia-archivo',prompt:'Coteja cada detalle con quien lo declaró. Recepción tiene los croquis. Comprueba que el cuaderno guarda las tres entrevistas.',
       sheet:'Índice del archivo. El plano conserva el rellano, pero omite el apodo que recuerda Simón. El recorte conserva el reflejo que reconoce Lucía. La hoja de depósito conserva dos firmas que Darío deslinda. Una llave por sí sola no identifica un vínculo familiar.',
       wheels:[['Aro','Darío','Lucía','Simón'],['Correa','Lucía','Simón','Darío'],['Firmas','Simón','Darío','Lucía']]}
    ],[
      {name:'La devolución de llamada',image:'mesa-descolgado',prompt:'Escucha la última instrucción de Candela. Contrasta los dos testimonios y prepara una comunicación privada.',
       sheet:'Recado de Candela. «Dejadme su mensaje. Si quiere hablar, llamadme primero a mí y preguntadme si quiero que me lo paséis. No le deis mi número». No ha autorizado que nadie suba a la suite.',
       wheels:[['Visitante','Darío','Simón','Lucía'],['Primera línea','Candela','Vestíbulo','Megafonía'],['Número de suite','Anunciar','Anotar en puerta','Reservado']]},
      {name:'El casillero de salida',image:'mesa-acta',prompt:'Restituye la procedencia de las llaves y archiva los dos detalles que sustentan la identificación. Pide a Recepción qué permite el recado.',
       sheet:'Acta de relevo. Las tres llaves abren por la historia de la cerradura. Dos observaciones independientes enlazan el recuerdo de Simón con la fotografía de Lucía. El parentesco no equivale a permiso de acceso.',
       wheels:[['Procedencia','Familia','Invitados','Servicio'],['Corroboración','Dos firmas','Aro y reflejo','Tres llaves'],['Contacto','Preguntar primero','Transferir directo','Acompañar arriba']]}
    ]
  ];
  // Filed out of order. The indexing register lives at the opposite desk.
  const archives=[
    [
      ['Recados de la línea interior',['La guardia firma el talón de entrega.','La huésped explica que quiere discreción.','El piloto vibra antes de que nadie hable.','El auricular vuelve al soporte y entra servicio.'],'Ordena por el curso de una llamada: señal entrante, voz, cambio de línea, acuse.'],
      ['Talonario de lencería',['El portero recoge la copia asignada.','La guardia extiende su recibí.','Se pliega la manta con el albarán dentro.','El encargado identifica el piloto en la placa.'],'Primero identifica la señal. Luego se retira la llave, se prepara el paquete y firma quien lo recibe.']
    ],[
      ['Expedientes de obra',['El albañil ciega las dos puertas laterales.','El cerrajero talla tres cilindros gemelos.','Se abre el paso entre los dormitorios.','Llega el pedido de una pieza para el mueble.'],'Primero las habitaciones son independientes. El hueco interior se abre antes de tapiar los accesos exteriores. El encargo del mueble es posterior.'],
      ['Capas del plano',['La revisión final anota una única entrada desde el rellano.','En el segundo calco aparece la comunicación interior.','El plano original dibuja tres umbrales completos.','La trama de ladrillo cubre los accesos de los extremos.'],'Reconstruye el orden del dibujo: levantamiento original, unión interior, cierre de huecos y revisión.']
    ],[
      ['Tiras del revelador',['El obturador se abre frente al espejo.','El revelador sella la tira todavía húmeda.','El positivo se recorta para entrar en el sobre.','Lucía coloca la correa alrededor de la muñeca.'],'La preparación precede a la exposición. El sello es del laboratorio y el recorte se hizo sobre el positivo.'],
      ['Registro del jueves',['La ronda de las seis y media da por vacía la escalera.','Se abre el paso para preparar la fiesta.','El carpintero retira la decoración después de la ronda.','Alguien fotografía el aro aún colgado.'],'El fotógrafo entró después de la apertura y antes de la ronda. El carpintero esperó a que el rellano quedara vacío.']
    ],[
      ['Cadena de la fotografía',['Lucía sostiene el negativo ante la ventana.','El revelador coteja el borde dentado de la ampliación.','El reportero entrega la tira sin revelar.','El recorte y el sobre reciben la misma signatura.'],'La tira entra sin revelar. Tras su revelado se mira a contraluz, se coteja el borde y se archivan juntas las piezas.'],
      ['Custodia del recibo',['La tía guarda el resguardo en la caja.','El recepcionista firma la segunda copia.','Darío trae al hotel los papeles heredados.','La tía entrega la pieza en depósito.'],'Se entrega una pieza, el receptor firma, la depositante guarda su copia y el heredero la devuelve años después.']
    ],[
      ['Registro de devolución',['Recepción anota si acepta la comunicación.','Simón dicta un mensaje sin pedir el número.','Candela oye quién desea hablar.','La operadora llama primero a la huésped.'],'Quien solicita hablar deja su mensaje. La operadora llama a la huésped, identifica al solicitante y registra su decisión.'],
      ['Cierre de custodia',['El conserje coteja el número del resguardo.','El armario queda sellado al terminar el relevo.','Se cuentan las copias sobre el paño.','Cada copia ocupa la casilla del servicio.'],'Cuenta las piezas, coteja su origen, guárdalas por procedencia y sella el casillero.']
    ]
  ];
  const roles=['Recepción','Turno de noche'];
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
  function floorPlan(host,positions){
    const sheet=el('div',null,'guard-plan');
    for(const year of [1981,2001]){
      const layer=el('div',null,'guard-trace');
      if(year===2001)layer.style.transform='translate('+((positions[0]-1)*12)+'%, '+((positions[1]-2)*14)+'%)';
      for(const [i,n] of [12,14,16].entries())layer.append(el('span',year===1981?'▵ '+n:(i===1?'▯ '+n:'▨ '+n)));
      sheet.append(layer);
    }
    host.append(sheet);
  }
  function photograph(host,positions){
    const lens=el('div',null,'guard-lens');
    lens.style.left=[12,40,65][positions[0]]+'%';
    lens.style.backgroundImage='url(/hotel-medianoche-recorte.webp)';
    lens.style.backgroundPosition=[15,50,88][positions[0]]+'% 48%';
    lens.style.filter='blur('+[0,1.6,3][positions[1]]+'px)';
    host.append(lens);
  }
  window.HotelGuardia=function({index,controller,refresh}){
    const root=el('section',null,'guard-desk'),navigation=el('nav'),work=el('div'),status=el('p');
    status.setAttribute('role','status');
    let inventory=controller.hotelShift(),side=inventory.role==='B'?1:0,opened=false,busy=false;
    const settings=[null,null],orders=[[],[]];
    function draw(){
      const key=side?'B':'A',desk=desks[index][side],shift=inventory.shift;
      navigation.replaceChildren();work.replaceChildren();
      if(!inventory.role)for(const [i,name] of roles.entries()){
        const b=button(name,()=>{side=i;opened=false;status.textContent='';draw();});
        b.setAttribute('aria-pressed',String(i===side));b.disabled=busy;navigation.append(b);
      }else navigation.append(el('strong',roles[side]));
      const done=shift.done[index+key],both=shift.done[index+'A']&&shift.done[index+'B'];
      work.append(el('h3',desk.name));
      const illustration=el('div',null,'guard-scene'),img=el('img');img.src='/hotel-'+desk.image+'.webp';img.alt=desk.name;illustration.append(img);work.append(illustration);
      if(!shift.opensAt){
        work.append(el('p','La guardia comienza con la primera llamada y dura al menos una hora. Puedes guardar y regresar.'),
          button(side?'Tomar el relevo':'Descolgar',()=>send('hotel-start')));return;
      }
      work.append(el('p',desk.prompt));
      const documentButton=button(opened?'Guardar documento':'Examinar mi documento',()=>{opened=!opened;draw();});work.append(documentButton);
      if(opened){
        const waiting=index===3 && (inventory.hotel?.witnesses?.length||0)<3;
        const sheet=el('blockquote',waiting?'Faltan declaraciones en la carpeta. Recorre las estancias y muestra a cada testigo un objeto del hotel.':desk.sheet,'guard-paper');
        sheet.append(el('p','Nota que necesita '+roles[1-side]+'. '+archives[index][1-side][2]));work.append(sheet);
      }
      if(!shift.archives?.[index+key]){
        const [title,cards]=archives[index][side],order=orders[side];
        work.append(el('h4',title),el('p','Reconstruye el expediente seleccionando sus cuatro fichas en orden. El otro puesto conserva la nota de archivo.'));
        const tray=el('div',null,'guard-cards'),filed=el('ol');
        for(const [i,text] of cards.entries()){
          const card=button(text,()=>{order.push(i);draw();});card.disabled=order.includes(i)||busy;tray.append(card);
        }
        order.forEach(i=>filed.append(el('li',cards[i])));
        work.append(tray,filed,button('Retirar última ficha',()=>{order.pop();draw();}));
        if(order.length===4)work.append(button('Comprobar expediente',()=>send('hotel-archive')));
        return;
      }
      if(index===3 && controller.visitHotel)work.append(button('Ir a las estancias y mostrar los objetos',controller.visitHotel));
      if(done)work.append(el('p','✓ Operación registrada en '+roles[side]+'.'));
      else{
        const positions=settings[side] ||= desk.wheels.map(()=>0);
        const instruments=el('div',null,'guard-instruments');
        if(index===1&&side)floorPlan(illustration,positions);
        if(index===2&&!side)photograph(illustration,positions);
        for(const [i,[label,...values]] of desk.wheels.entries()){
          const dial=el('fieldset'),legend=el('legend',label);dial.append(legend);
          values.forEach((value,v)=>{
            const pick=button(value,()=>{positions[i]=v;draw();work.querySelector('[data-detent="'+i+'-'+v+'"]')?.focus();});
            pick.dataset.detent=i+'-'+v;pick.disabled=busy;pick.setAttribute('aria-pressed',String(positions[i]===v));dial.append(pick);
          });instruments.append(dial);
        }
        work.append(instruments,button(index===0&&!side?'Conectar el cordón':index===1&&side?'Fijar los calcos':index===2&&!side?'Marcar la ampliación':'Registrar operación',()=>send('hotel-operate',positions)));
      }
      if(done&&!both)work.append(el('p',inventory.role?'Esperando la operación del otro puesto.':'Cambia de puesto para completar la otra operación.'));
      if(both){
        const close=button(index===4?'Llamar a Candela':'Continuar la investigación',async()=>{
          if(busy)return;busy=true;close.disabled=true;
          try{const result=await controller.submit(index,['guardia-completa']);if(result.correct||(result.hour && result.hour.current!==index))refresh(result.hour,result.feedback);else status.textContent=result.feedback;}
          catch(err){status.textContent=err.message;}finally{busy=false;close.disabled=false;}
        });
        if(index===4)work.append(el('p','Devolución de llamada disponible a las '+new Date(shift.opensAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'.'));
        work.append(close);
      }
    }
    async function send(operation,positions){
      if(busy)return;busy=true;
      try{const reply=await controller.inventory({operation,index,desk:side?'B':'A',positions,order:orders[side]});inventory=reply.inventory;opened=operation==='hotel-start';status.textContent='Guardado.';}
      catch(err){status.textContent=err.message;}finally{busy=false;draw();}
    }
    root.refreshShift=value=>{if(value?.shift&&value.revision>=inventory.revision){inventory=value;draw();}};
    root.append(navigation,work,status);draw();return root;
  };
})();
