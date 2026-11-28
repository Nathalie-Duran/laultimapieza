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


// The hotel has two working desks. Only completed operations advance on the server.
// Unfinished instruments stay on this device, scoped to the current shift and role.
(() => {
 const roles=['Recepción','Turno de noche'];
 const rooms=[
  [['La centralita de guardia','mesa-conmutador'],['El carro de lencería','estancia-centralita']],
  [['El banco del cerrajero','medianoche-llaves'],['La mesa de luz','mesa-obras']],
  [['La ampliadora','medianoche-recorte'],['El registro de visitas','medianoche-registro']],
  [['La declaración de Simón','testigo-simon'],['El archivo de los testigos','estancia-archivo']],
  [['La última llamada','mesa-descolgado'],['La devolución de las llaves','mesa-acta']]
 ];
 const documents=[
  ['Candela pide una manta. «Dejadla con la guardia. No quiero que nadie suba». Al colgar suenan dos timbres, una pausa y un clic. Se enciende el piloto de la madeja.','Placa de servicio. Madeja: ropa blanca. Todas las derivaciones del turno entran por Servicio. Dos timbres y clic: ala Estación. Las copias de Estación cuelgan del armario de roble. Guardia recibe en mano.'],
  ['Albaranes. F-31 recoge tres copias de un mismo corte. R-14 conserva la puerta que sigue dando al rellano. M-04 instala una cerradura en el mueble de conserjería. En el calco azul el patio es el círculo y la escalera el triángulo.','Leyenda del aparejador. El trazo discontinuo corresponde a 1981. La trama roja señala fábrica de ladrillo en 2001. Compara ambos testigos de registro para identificar la entrada que sobrevivió.'],
  ['Sobre del revelador. «Después de las seis, antes de la segunda ronda». Dos marcas del mismo positivo permiten comparar la memoria de los testigos: algo que alguien llevaba puesto y un adorno hecho a mano.','Ronda de escalera: apertura 18:00, cierre 18:30. Lucía retiró la cámara antes de la apertura. Simón consta como huésped. Darío trajo la caja de Amalia muchos años después.'],
  ['Cuaderno de entrevistas. Busca a Simón, Lucía y Darío en las estancias y muéstrales los objetos recogidos. Transcribe el dibujo que Simón recuerda antes de cotejarlo con el recorte.','Archivo de contraste. Conserva el detalle del positivo hasta que Recepción describa el dibujo de Simón. Contrasta el motivo y la identidad de quien quedó reflejada.'],
  ['Último recado. «Dejadme su mensaje. Si quiere hablar, llamadme primero a mí. Yo decidiré si me lo pasáis. No le deis mi número».','Libro de depósitos. Azul: patrimonio del servicio. Marfil: objeto de una huésped. Granate: depósito familiar. El antiguo manojo pertenece al hotel. El recorte es de Lucía y el resguardo procede de la tía de Darío.']
 ];
 function node(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;}
 function btn(label,fn){const b=node('button',label);b.type='button';b.onclick=fn;return b;}
 function speak(text){if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='es-ES';speechSynthesis.speak(u);}}
 window.HotelGuardia=function({stage,index,controller,refresh}){
  let inv=controller.hotelShift(),busy=false;
  const root=node('section',null,'guard-desk'),nav=node('nav'),work=node('div'),status=node('p');
  status.setAttribute('role','status');root.append(nav,work,status);
  const blank=()=>({open:false,v:[-1,-1,-1],x:0,y:0,marks:[],tool:0,tag:0});
  let state={side:inv.role==='B'?1:0,desks:[blank(),blank()]};
  const storage=()=>inv.shift.opensAt && 'medianoche-v2/'+inv.shift.opensAt+'/'+index+'/'+(inv.role||'solo');
  try{const saved=JSON.parse(localStorage.getItem(storage()));if(saved?.desks?.length===2)state=saved;}catch{}
  if(inv.role)state.side=inv.role==='B'?1:0;
  function save(){try{if(storage())localStorage.setItem(storage(),JSON.stringify(state));}catch{}}
  function redraw(){save();draw();}
  function draw(){
   renderDesk();
   const chapter=node('p','Capítulo '+['I','II','III','IV','V'][index]+' · '+stage.title,'hotel-chapter');
   nav.prepend(chapter);
   const scene=work.querySelector('.guard-scene'),title=work.querySelector('h3');
   const objects=node('aside',null,'hotel-desk-objects');
   objects.append(node('h3','Objetos de este puesto'),title);
   const instrument=node('div',null,'hotel-desk-instrument');
   const controls=node('div',null,'guard-controls');
   instrument.append(scene);
   let operating=false;
   for(const item of [...work.children]){
    if(item===scene)continue;
    if(item.matches('.guard-tray,.hm-picks,.hm-jackboard,.hm-rack')){
     if(!operating&&objects.lastElementChild?.tagName==='P')controls.append(objects.lastElementChild);
     operating=true;
    }
    (operating?controls:objects).append(item);
   }
   if(controls.childElementCount)instrument.append(controls);
   work.className='hotel-desk-layout';work.replaceChildren(instrument,objects);
  }
  function renderDesk(){
   const side=state.side,key=side?'B':'A',d=state.desks[side],shift=inv.shift;
   const done=shift.done[index+key],both=shift.done[index+'A']&&shift.done[index+'B'];
   nav.replaceChildren();work.replaceChildren();
   if(inv.role)nav.append(node('strong',roles[side]));else roles.forEach((role,i)=>{const b=btn(role,()=>{state.side=i;status.textContent='';redraw()});b.disabled=busy;b.setAttribute('aria-pressed',String(i===side));nav.append(b)});
   const [title,image]=rooms[index][side];work.append(node('h3',title));
   const scene=node('div',null,'guard-scene'),photo=node('img');photo.src='/hotel-'+image+'.webp';photo.alt=title;scene.append(photo);work.append(scene);
   if(!shift.opensAt){work.append(node('p','El teléfono suena en recepción.'),btn(side?'Abrir el puesto de guardia':'Descolgar el teléfono',()=>send('hotel-start')));return;}
   const documentButton=btn(d.open?'Cerrar el documento':'Examinar el documento de mi puesto',()=>{d.open=!d.open;redraw()});documentButton.setAttribute('aria-expanded',String(d.open));work.append(documentButton);
   if(d.open){work.append(node('blockquote',documents[index][side],'guard-paper'));if(!side&&(index===0||index===4))work.append(btn('Escuchar la llamada',()=>speak(documents[index][side])));}
   const note=t=>work.append(node('p',t));
   function group(label,values,slot,parent=work){
    const field=node('fieldset',null,'hm-picks');field.append(node('legend',label));
    values.forEach((value,i)=>{const b=btn(value,()=>{d.v[slot]=i;redraw()});b.setAttribute('aria-pressed',String(d.v[slot]===i));field.append(b)});parent.append(field);
   }
   function finish(label,values){const b=btn(label,()=>send('hotel-operate',values));b.disabled=busy||values.some(v=>v<0);b.classList.add('hm-confirm');work.append(b);}
   function placeItems(items,bins){
    const tray=node('div',null,'guard-tray');items.forEach((item,i)=>{const b=btn(item,()=>{d.tag=i;redraw()});b.setAttribute('aria-pressed',String(i===d.tag));tray.append(b)});work.append(tray);
    const rack=node('div',null,'hm-rack');bins.forEach((name,i)=>{const names=items.filter((_,j)=>d.v[j]===i);const b=btn(name+' · '+(names.join(', ')||'vacío'),()=>{d.v[d.tag]=i;const next=d.v.indexOf(-1);if(next>=0)d.tag=next;redraw()});rack.append(b)});work.append(rack);
   }
   function tools(label,items,select){
    const row=node('div',null,'guard-tray');row.setAttribute('aria-label',label);
    items.forEach((t,i)=>{const b=btn(t,()=>{d.tool=i;redraw()});b.setAttribute('aria-pressed',String(i===d.tool));row.append(b)});work.append(row);
   }
   if(done)note('Operación guardada en '+roles[side]+'.');
   else if(index===0&&!side){
    note('Toma un cordón y enchúfalo a su toma. Pide al otro puesto que interprete el piloto.');
    const lines=[['Patio','Ascensor','Servicio'],['Ropa blanca','Equipajes','Cocina'],['Montacargas','Guardia','Suite']];
    tools('Cordones',['Entrada','Derivación','Entrega']);const board=node('div',null,'hm-jackboard');
    lines[d.tool].forEach((name,i)=>{const b=btn(name,()=>{d.v[d.tool]=i;d.tool=Math.min(2,d.tool+1);redraw()});b.setAttribute('aria-pressed',String(d.v[d.tool]===i));board.append(b)});work.append(board);
    note(d.v.map((v,i)=>lines[i][v]||'Toma libre').join(' → '));finish('Probar la conexión',d.v);
   }else if(index===0){
    note('Escucha a Recepción. Lleva la copia, la manta y el talón de entrega a su destino.');
    placeItems(['Etiqueta de ala','Llave del armario','Talón'],['En mano','Estación','Roble','Patio','Nogal','Montacargas']);finish('Enviar el carro',d.v);
   }else if(index===1&&!side){
    note('Abre los tres albaranes del documento. Coteja la puerta con el otro puesto y coloca cada resguardo en su casilla.');
    placeItems(['F-31','R-14','M-04'],['Tres copias','Puerta 14','Puerta 16','Mueble']);finish('Sellar los albaranes',d.v);
   }else if(index===1){
    note('Desliza el calco por la mesa de luz hasta hacer coincidir el patio y la escalera. Marca después el paso que queda abierto.');
    const map=node('div',null,'hm-lightbox');scene.replaceChildren(map);
    for(let layer=0;layer<2;layer++){const plan=node('div',null,'hm-blueprint '+(layer?'hm-overlay':''));plan.append(node('b',layer?'2001':'1981'),node('i','△'),node('i','○'));[12,14,16].forEach((n,i)=>plan.append(node('span',layer?(i===1?'▯':'▨'):String(n))));if(layer)plan.style.transform='translate('+((d.x-2)*12)+'%, '+((d.y-2)*13)+'%)';map.append(plan);}
    function move(x,y){d.x=Math.max(0,Math.min(4,x));d.y=Math.max(0,Math.min(4,y));redraw();}
    let point;map.onpointerdown=e=>{point=[e.clientX,e.clientY];map.setPointerCapture(e.pointerId)};
    map.onpointerup=e=>{if(point)move(d.x+Math.round((e.clientX-point[0])/(map.clientWidth*.09)),d.y+Math.round((e.clientY-point[1])/(map.clientHeight*.09)))};
    const arrows=node('div',null,'guard-tray');for(const [caption,x,y] of [['←',-1,0],['↑',0,-1],['↓',0,1],['→',1,0]])arrows.append(btn(caption,()=>move(d.x+x,d.y+y)));work.append(arrows);
    group('Marcar la entrada',[12,14,16],2);finish('Fijar los calcos',[d.x,d.y,d.v[2]]);
   }else if(index===2&&!side){
    note('Explora el positivo con la lupa. Marca el detalle personal y el adorno del rellano. El reverso conserva la hora para tu compañero.');
    scene.classList.add('hm-inspect-photo');const lens=node('div',null,'hm-photo-lens');scene.append(lens);
    const aim=(x,y)=>{lens.style.left=x+'%';lens.style.top=y+'%';lens.style.backgroundPosition=x+'% '+y+'%';};
    const point=e=>{const r=scene.getBoundingClientRect();return [(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]};
    scene.onpointermove=e=>aim(...point(e));aim(d.x||50,d.y||50);
    function stamp(x,y){d.x=x;d.y=y;d.marks[d.tool]=[x,y];redraw();}
    scene.onclick=e=>stamp(...point(e));tools('Marca de inspección',['Detalle personal','Adorno de papel']);
    d.marks.forEach((m,i)=>{if(!m)return;const pin=node('span',String(i+1),'hm-pin-mark');pin.style.left=m[0]+'%';pin.style.top=m[1]+'%';scene.append(pin)});
    const pad=node('div',null,'guard-tray');for(const [l,x,y] of [['←',-5,0],['↑',0,-5],['↓',0,5],['→',5,0]])pad.append(btn(l,()=>{d.x=Math.max(2,Math.min(98,(d.x||50)+x));d.y=Math.max(2,Math.min(98,(d.y||50)+y));redraw()}));pad.append(btn('Marcar bajo la lupa',()=>stamp(d.x||50,d.y||50)));work.append(pad);
    finish('Guardar las dos ampliaciones',d.marks[0]&&d.marks[1]?d.marks.flat():[-1]);
   }else if(index===2){
    note('Delimita la exposición entre dos marcas de la ronda. Cruza el intervalo con los asientos del registro.');
    group('Abrir intervalo',['17:30','18:00','18:30'],0);group('Cerrar intervalo',['18:00','19:00','18:30'],1);group('La caja llegó después con…',['Darío','Simón','Lucía'],2);finish('Archivar la franja de exposición',d.v);
   }else if(index===3){
    const count=inv.hotel?.witnesses?.length||0;note('Declaraciones recogidas: '+count+' de 3.');work.append(btn('Visitar a los testigos con la carpeta',controller.visitHotel));
    if(count===3){if(!side){group('Selecciona el croquis que dibujó Simón',['○','∞','△'],0);finish('Guardar el croquis',[d.v[0]]);}else{scene.firstChild.src='/hotel-medianoche-recorte.webp';scene.firstChild.alt='Recorte original del rellano';group('Marca la silueta del adorno',['△','○','∞'],0);group('¿Quién estaba tras la cámara?',['Candela','Lucía','Amalia'],1);finish('Cotejar con Recepción',d.v.slice(0,2));}}
   }else if(!side){
    note('Prepara la devolución de llamada usando el croquis y la ampliación. Consulta el recado antes de levantar el auricular.');
    group('Mensaje de',['Darío','Simón','Lucía'],0);group('Línea que llamas primero',['Candela','Vestíbulo','Megafonía'],1);group('Tratamiento del número',['Anunciar','Dejar en el tablón','Reservar'],2);finish('Preparar la línea privada',d.v);
   }else{
    note('Devuelve cada objeto a su casilla por su procedencia. Pide a Recepción que confirme los testimonios.');
    placeItems(['Manojo antiguo','Recorte de Lucía','Resguardo de Amalia'],['Marfil','Granate','Azul']);finish('Cerrar el casillero',d.v);
   }
   if(done&&!both)note(inv.role?'El otro puesto tiene una operación pendiente.':'Cambia de puesto para continuar.');
   if(both){
    if(index===4)note('Candela atiende a partir de las '+new Date(shift.opensAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'. Mientras tanto puedes investigar las estancias y jugar el reto del conserje.');
    const next=btn(index===4?'Llamar a Candela':'Continuar la investigación',async()=>{if(busy)return;busy=true;next.disabled=true;try{const r=await controller.submit(index,['guardia-completa']);if(r.correct||r.hour?.current!==index&&r.hour){if(index===4)speak('Soy Candela. Gracias por llamarme primero. Ahora sí, podéis pasarme con Simón.');refresh(r.hour,r.feedback);}else status.textContent=r.feedback;}catch(e){status.textContent=e.message;}finally{busy=false;next.disabled=false;}});
    work.append(next);
   }
  }
  async function send(operation,positions){if(busy)return;busy=true;const side=state.side;
   try{const reply=await controller.inventory({operation,index,edition:2,desk:side?'B':'A',positions});inv=reply.inventory;if(operation==='hotel-start')state.desks[side].open=true;status.textContent='Guardado.';}
   catch(e){status.textContent=e.message;}finally{busy=false;redraw();}
  }
  root.refreshShift=value=>{if(value?.shift&&value.revision>=inv.revision){inv=value;draw();}};
  draw();return root;
 };
})();
