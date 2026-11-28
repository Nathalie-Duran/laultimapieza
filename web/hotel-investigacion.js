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
  const stages = [
    {title:'La centralita de noche', image:'centralita', instruction:'Escoge una toma del conmutador y conecta una orden. Las tres órdenes se cursarán de izquierda a derecha.'},
    {title:'La mesa del aparejador', image:'planta', instruction:'Coteja las dos plantas y el libro de cerrajería. Fija una conclusión por pieza para reconstruir la reforma.'},
    {title:'La ampliadora del archivo', image:'negativo', instruction:'Prepara dos fichas de testigo para la franja de la foto. Adjunta el documento que la tercera persona puede explicar.'},
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
  const interviewObjects = [
    ['plano','Plano de la reforma','planta'],['foto','Recorte de fotografía','negativo'],['recibo','Hoja de depósito','registro']
  ];
  const materialImages = {
    voz:'centralita',protocolo:'centralita',ronda:'llaves',planta:'planta',llaves:'llaves',palabra:'planta',
    negativo:'negativo',fechas:'registro',registro:'registro',fuentes:'negativo',objetos:'llaves',entrevista:'registro',
    referencia:'negativo',candela:'centralita',margen:'registro',recado:'recado'
  };
  function switchboard(root, stage, selected, sync) {
    const sockets = make('div','hm-jacks'), contacts = make('div','hm-contacts');
    const slots = Array.from({length:stage.requiredCount || 3}, () => null);
    let active = 0;
    const jacks = slots.map((_,i) => {
      const b = action('', () => {active=i;paint();}, 'hm-jack');
      b.append(make('span','hm-jack-number','Toma '+(i+1)),make('span','hm-jack-label'));
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
      b.append(prop(switchProps[opt.id] || 'centralita'),make('span','',opt.label));
      contacts.append(b); return b;
    });
    const unplug = action('Desconectar la toma activa', () => {slots[active]=null;paint();}, 'hm-erase');
    function paint() {
      selected.splice(0,selected.length,...slots.filter(Boolean));
      jacks.forEach((b,i) => {
        b.lastChild.textContent=stage.options.find(o=>o.id===slots[i])?.label || 'Sin conectar';
        b.setAttribute('aria-pressed',String(i===active));
        b.dataset.connected=String(Boolean(slots[i]));
      });
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(slots.includes(stage.options[i].id))));
      unplug.disabled=!slots[active];
      sync(selected.length+' de '+slots.length+' tomas conectadas.');
    }
    root.append(sockets,contacts,unplug);paint();
  }
  function dossier(root, stage, index, selected, sync) {
    const entries = families[index];
    const opts = new Map(stage.options.map(o=>[o.id,o]));
    const groups = make('div','hm-files');
    const total = entries.reduce((n,row)=>n+(row[3]||1),0);
    const controls = [];
    for (const [name, image, ids, limit=1] of entries) {
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
      controls.push({summary,ids,limit,buttons});
      groups.append(section);
    }
    function paint(){
      for(const {ids,limit,summary,buttons} of controls) {
        const count=selected.filter(x=>ids.includes(x)).length;
        summary.textContent=count+' / '+limit;
        buttons.forEach((button,i)=>{
          const on=selected.includes(ids[i]);button.setAttribute('aria-pressed',String(on));
          button.disabled=limit>1 && count>=limit && !on;
        });
      }
      sync(selected.length+' de '+total+(index===4?' anotaciones selladas.':index===2?' fichas archivadas.':' conclusiones fijadas.'));
    }
    root.append(groups);paint();
  }
  function interviews(root, stage, selected, sync) {
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
    root.append(tray,people,page);paint();
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
    const banner=make('header','hm-desk-head'), text=make('div','hm-desk-caption');
    text.append(make('h5','',info.title),make('p','',info.instruction));banner.append(prop(info.image),text);desk.append(banner);
    if(index===3 && controller?.sceneBack && controller.visitHotel) {
      desk.append(action('Visitar a los huéspedes del hotel',controller.visitHotel,'hm-visit'));
    }
    const meter=make('p','hm-meter');meter.setAttribute('role','status');
    const sync=message=>{meter.textContent=message;change();};
    if(index===0) switchboard(desk,stage,selected,sync);
    else if(index===3)interviews(desk,stage,selected,sync);
    else dossier(desk,stage,index,selected,sync);
    desk.append(meter);field.append(desk);
    return true;
  }
  function planReader(material) {
    const lines=material.body?.split(/\r?\n/).filter(line=>/^\d{4}:/.test(line));
    if(lines?.length!==2)return null;
    const reader=make('div','hm-viewer'),bar=make('div','hm-years'),drawing=make('div','hm-plan');
    const title=make('h6','','Examinar el plano'),caption=make('p','hm-plan-text');
    const doors=['12','14','16'].map(n=>{const door=make('span','hm-door',n);drawing.append(door);return door;});
    drawing.setAttribute('aria-hidden','true');caption.setAttribute('aria-live','polite');
    const tabs=lines.map((line,i)=>{const button=action(line.slice(0,4),()=>draw(i),'hm-year');bar.append(button);return button;});
    function draw(i){
      tabs.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
      doors.forEach((door,j)=>{door.dataset.closed=String(i===1 && j!==1);});
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
  function clipReader(evidence) {
    const spec=sourceDesk[evidence.id];
    if(!spec || typeof evidence.body!=='string')return null;
    const [title,operation,art]=spec;
    const folder=make('section','hm-document hm-document-'+evidence.id);
    const plate=make('div','hm-document-plate');
    plate.append(prop(art));
    const work=make('div','hm-document-work');
    const heading=make('h5','',title);
    work.append(heading);
    folder.append(plate,work);
    if(evidence.id==='planta'){
      const plan=planReader(evidence);if(!plan)return null;
      work.append(plan);return folder;
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
    if(isCalendar){
      tabs.classList.add('hm-calendar');
      for(const day of ['L','M','X','J','V','S','D']){
        const name=make('span','hm-weekday',day);name.setAttribute('aria-hidden','true');tabs.append(name);
      }
    }
    if(!isLetter)work.append(make('span','hm-instrument-label',operation),tabs);
    let selected=-1;
    const buttons=[];
    function show(i){
      selected=i;buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(i===n)));
      const page=pages[i];
      sheet.hidden=!page;
      if(signal)signal.hidden=i!==1;
      if(!page)return;
      caption.textContent=page[0];
      copy.textContent=page[1];
      if(evidence.id==='objetos'){
        const pic=plate.querySelector('img');
        pic.src=file(['planta','negativo','registro'][i]||art);
      }
    }
    function newTab(name,i){
      const b=action(name,()=>show(i),'hm-chip');
      b.setAttribute('aria-label',pages[i][0]);buttons[i]=b;return b;
    }
    if(isLetter){
      const open=action('Romper el sello y leer el recado',()=>{
        const expanding=selected<0;
        show(expanding?0:-1);open.setAttribute('aria-expanded',String(expanding));open.textContent=expanding?'Doblar el recado':'Abrir el sobre';
      },'hm-chip');
      open.setAttribute('aria-expanded','false');work.append(open);
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
    show(isLetter || signal?-1:0);return folder;
  }
  function decorateShelf({shelf,stage}) {
    for(const card of shelf.querySelectorAll('[data-material]')) {
      if(card.querySelector('.hm-document'))continue;
      const evidence=stage.materials.find(m=>m.id===card.dataset.material);
      if(!evidence)continue;
      const img=materialImages[evidence.id];
      const thumb=card.querySelector('.vhour-format-photo');
      if(img && thumb){thumb.classList.add('hm-photo');thumb.style.backgroundImage='url("'+file(img)+'")';}
      const reader=clipReader(evidence),summary=card.querySelector('summary');
      if(reader && summary) {
        const original=make('details','hm-original');
        original.append(make('summary','','Consultar la fuente íntegra'));
        const contents=[...card.children].filter(child=>child!==summary);
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
