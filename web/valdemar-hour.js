(() => {
  'use strict';

  function el(tag, text, className) {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function control(label, handler, className) {
    const item = el('button',label,className);
    item.type = 'button';
    item.addEventListener('click',handler);
    return item;
  }
  function live() {
    const region = el('p',null,'vhour-status');
    region.setAttribute('role','status');
    return region;
  }
  function head(tag, text) {
    const title = el(tag,text);
    title.tabIndex = -1;
    return title;
  }
  function fold(name, ...children) {
    const node = el('details',null,'vhour-fold');
    node.append(el('summary',name),...children);
    return node;
  }
  function pressed(button, value) {
    button.setAttribute('aria-pressed',String(value));
  }
  const roleNames = {A:'Papel 1',B:'Papel 2',AB:'Ambos papeles'};
  const kinds = {text:'Documento',testimony:'Testimonio',ledger:'Registro',visual:'Lámina',audio:'Audio',web:'Archivo web'};
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const playingStates = new Set();
  function stopVoice(state) {
    if (state.voice) {
      const current = state.voice;
      state.voice = null;
      playingStates.delete(state);
      if (current.audio) current.audio.pause();
      else if (window.speechSynthesis) window.speechSynthesis.cancel();
      current.reset();
    }
  }
  function pauseAll() {
    for(const state of playingStates)stopVoice(state);
  }
  window.addEventListener('pagehide',pauseAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();});
  function recording(item,state) {
    const node=el('div',null,'vhour-recording');
    const audio=el('audio',null,'vhour-audio');
    audio.controls=true;audio.preload='none';audio.src=item.clip;
    audio.setAttribute('aria-label',item.label);
    const status=live();
    const transcript=fold('Leer la transcripción',el('p',item.body,'vhour-prose'));
    const entry={button:audio,audio,reset:()=>{}};
    audio.addEventListener('play',()=>{
      if(!node.isConnected||document.hidden||audio.closest('[hidden], [data-silent="true"], details:not([open])')){audio.pause();return;}
      pauseAll();
      state.voice=entry;playingStates.add(state);
    });
    function finish(){
      if(state.voice===entry){state.voice=null;playingStates.delete(state);}
    }
    audio.addEventListener('pause',finish);audio.addEventListener('ended',finish);
    audio.addEventListener('error',()=>{
      finish();transcript.open=true;status.textContent='La grabación no se ha podido reproducir. Puedes leer la transcripción.';
    });
    node.append(audio,status,transcript);
    return node;
  }
  function voiceCard(body, state, transcriptShown=false) {
    const node = el('div',null,'vhour-recording');
    const available = window.speechSynthesis && window.SpeechSynthesisUtterance;
    const status = live();
    if (available) {
      const button = control('Escuchar lectura',() => {
        if (state.voice?.button === button) { stopVoice(state); return; }
        pauseAll();
        const voice = new window.SpeechSynthesisUtterance(body);
        voice.lang = 'es-ES';
        const voices = window.speechSynthesis.getVoices().filter(v => /^es(?:[-_]|$)/i.test(v.lang));
        const spanish = voices.find(v=>v.localService)||voices[0];
        if (spanish) voice.voice = spanish;
        const reset = () => {button.textContent='Escuchar lectura';pressed(button,false);};
        const entry = {button,reset,voice};
        state.voice = entry;playingStates.add(state);
        button.textContent = 'Detener lectura'; pressed(button,true);
        function finish(failed) {
          if (state.voice !== entry) return;
          state.voice = null;playingStates.delete(state);reset();
          status.textContent = failed ? 'La voz de este dispositivo no está disponible. Puedes leer la transcripción.' : 'Lectura terminada.';
        }
        voice.onend = () => finish(false); voice.onerror = () => finish(true);
        status.textContent='Lectura con la voz del dispositivo.';
        try {window.speechSynthesis.speak(voice);} catch {finish(true);}
      },'vhour-listen');
      pressed(button,false); node.append(button,status);
    } else if(!transcriptShown) {
      node.append(el('p','Este navegador puede mostrar la transcripción. La lectura en voz alta requiere una voz del dispositivo.','vhour-muted'));
    }
    if(!transcriptShown){
      const source = fold('Leer la transcripción',el('p',body,'vhour-prose'));
      source.open = !available;
      node.append(source);
    }
    return node;
  }
  function table(rows, name) {
    const wrap = el('div',null,'vhour-table-wrap');
    wrap.tabIndex=0; wrap.setAttribute('role','region');wrap.setAttribute('aria-label',name);
    const t = el('table'); const body = el('tbody');
    const width=Math.max(...rows.map(r=>r.length));
    for (const row of rows) {
      const tr = el('tr');
      for(let col=0;col<width;col++) {
        const cell=el(col===0?'th':'td',row[col]||'');
        if(col===0)cell.scope='row';
        tr.append(cell);
      }
      body.append(tr);
    }
    t.append(body);wrap.append(t);
    return wrap;
  }
  const lines = s => s.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const cells = line => line.replace(/^\|\s*|\s*\|$/g,'').split('|').map(s=>s.trim());
  function evidenceTable(item) {
    const wrap = el('div',null,'vhour-evidence-body');
    let rows=[];
    const flush = () => {if(rows.length){wrap.append(table(rows,item.label));rows=[];}};
    for(const line of lines(item.body)) {
      if(line.includes('|')&&!/^[-\s:|]+$/.test(line))rows.push(cells(line));
      else if(!/^[-\s:|]+$/.test(line)){flush();wrap.append(el('p',line));}
    }
    flush();
    return wrap;
  }
  function records(item) {
    const wrap = el('div',null,'vhour-index');
    const search = el('input');search.type='search';search.placeholder='Buscar en los registros';
    search.setAttribute('aria-label','Buscar en '+item.label);
    const result = el('div'), count=live();
    const raw=lines(item.body);
    const rows=raw.filter(line=>line.includes('|')&&!/^[-\s:|]+$/.test(line));
    const entries=rows.length?rows:raw;
    if(rows.length)for(const text of raw.filter(line=>!line.includes('|')))wrap.append(el('p',text,'vhour-prose'));
    function filter() {
      const term=normalize(search.value||'').trim();
      const found=entries.filter(line=>normalize(line).includes(term));
      count.textContent=found.length+' de '+entries.length+' registros.';
      result.replaceChildren();
      if(found.length)result.append(table(found.map(cells),item.label));
      else result.append(el('p','Ningún registro coincide. Prueba otra palabra.'));
    }
    search.addEventListener('input',filter);
    wrap.append(search,count,result); filter();
    return wrap;
  }
  function calibration(figure, source) {
    const pulses = [
      source.match(/Original:.*?en (\d+).*?en (\d+)/i),
      source.match(/Copia roja:.*?en (\d+) y (\d+)/i),
      source.match(/Copia azul:.*?en (\d+) y (\d+)/i)
    ];
    if(pulses.some(p=>!p))return;
    const max=Math.max(...pulses.flatMap(p=>p.slice(1).map(Number)));
    if(!max)return;
    const graph=el('div',null,'vhour-pulses');
    graph.setAttribute('aria-hidden','true');
    pulses.forEach((p,i)=>{
      const row=el('div',null,'vhour-pulse-row'),strip=el('span',null,'vhour-trace');
      for(const tick of p.slice(1)){
        const mark=el('i');
        mark.style.left=(Number(tick)/max*100)+'%';
        strip.append(mark);
      }
      row.append(el('span',['Original','Copia roja','Copia azul'][i]),strip);
      graph.append(row);
    });
    figure.append(graph);
  }
  function diagram(item) {
    const figure=el('figure',null,'vhour-plate');
    if(item.body.includes('|')){figure.append(evidenceTable(item));return figure;}
    calibration(figure,item.body);
    const content=el('div',null,'vhour-diagram');
    for(const original of lines(item.body)){
      const steps=/[→↔]| — /.test(original) ? original.replace(/([.;])\s+(?=[A-ZÁÉÍÓÚÜÑ•])/g,'$1\n').split('\n') : [original];
      for(const line of steps){
        const parts=line.split(/\s*(→|↔| — )\s*/).filter(Boolean);
        if(parts.length>=3){
          const row=el('div',null,'vhour-flow');
          for(const [i,part] of parts.entries()){
            row.append(el('span',part.trim(),i%2?'vhour-edge':'vhour-stop'));
          }
          content.append(row);
        } else if(/\[[^\]]+\].*\[[^\]]+\]/.test(line)) {
          const row=el('div',null,'vhour-flow');
          for(const piece of line.split(/(\[[^\]]+\])/).map(x=>x.trim()).filter(Boolean))
            row.append(el('span',piece,piece.startsWith('[')?'vhour-stop':'vhour-map-label'));
          content.append(row);
        } else content.append(el('p',line));
      }
    }
    figure.append(content);
    return figure;
  }
  function material(item,state) {
    const node=el('details',null,'vhour-material');
    node.dataset.kind=item.kind;
    node.dataset.material=item.id;
    const summary=el('summary');
    const name=el('span',null,'vhour-material-name');
    const thumbnail=el('span',null,'vhour-format-photo');
    thumbnail.setAttribute('aria-hidden','true');
    name.append(el('small',kinds[item.kind]||'Prueba'),el('strong',item.label),el('span',roleNames[item.role]||'Ambos papeles','vhour-role'));
    summary.append(thumbnail,name);
    let content;
    if(item.kind==='audio' && item.clip)content=recording(item,state);
    else if(item.kind==='web')content=records(item);
    else if(item.kind==='audio'||item.kind==='testimony')content=voiceCard(item.body,state);
    else if(item.kind==='ledger')content=evidenceTable(item);
    else if(item.kind==='visual')content=diagram(item);
    else content=el('p',item.body,'vhour-prose');
    if(state.station && (item.id==='croquis'||item.id==='onda')){
      const image=el('img',null,'vd-station-plate');
      image.src=item.id==='croquis'?'/croquis-deposito.png':'/tiras-calibracion.png';
      image.alt=item.label;
      image.loading='lazy';
      node.append(summary,image,fold('Leer la descripción de la lámina',content));
    }else node.append(summary,content);
    node.addEventListener('toggle',()=>{if(!node.open && state.voice && node.contains(state.voice.button))stopVoice(state);});
    return node;
  }
  const shelfFilters=new WeakMap();
  function filterByRole(root,role) {
    for(const shelf of root.querySelectorAll('.vhour-shelf')){
      if(shelf.dataset.roleFilter!==(role||'all'))shelfFilters.get(shelf)?.(role);
    }
  }
  function proofShelf(items,state,assignedRole) {
    const shelf=el('div',null,'vhour-shelf');
    const tools=el('div',null,'vhour-shelf-tools');
    const heading=el('h4',null,'vhour-shelf-title');
    tools.append(heading);
    const fixedRole=assignedRole==='A'||assignedRole==='B'?assignedRole:null;
    const visibleFor=(item,role)=>!role || item.role==null || item.role==='AB' || item.role===role;
    const records=items.filter(item=>visibleFor(item,fixedRole)).map(item=>({item,card:material(item,state)}));
    const filters=el('div',null,'vhour-filter');
    filters.setAttribute('aria-label','Filtrar las pruebas por papel');
    const buttons=[];
    function select(requestedRole) {
      const role=fixedRole || requestedRole;
      for(const entry of buttons)pressed(entry.button,entry.role===role);
      let visible=0;
      for(const {item,card} of records){
        card.hidden=!visibleFor(item,role);
        if(!card.hidden)visible++;
        if(card.hidden && state.voice && card.contains(state.voice.button))stopVoice(state);
      }
      shelf.dataset.roleFilter=role||'all';
      shelf.dataset.visibleCount=stack.dataset.visibleCount=String(visible);
      const count=visible===1?'Una prueba':visible+' pruebas';
      heading.textContent=fixedRole?roleNames[fixedRole]+' · '+count:count;
    }
    if(!fixedRole && items.some(m=>m.role==='A'||m.role==='B')) {
      for (const [role,label] of [['','Todas las pruebas'],['A','Papel 1'],['B','Papel 2']]){
        const b=control(label,()=>select(role));b.dataset.vhourRole=role||'all';buttons.push({role,button:b});filters.append(b);
      }
      tools.append(filters);
    }
    shelf.append(tools);
    const stack=el('div',null,'vhour-stack');
    stack.append(...records.map(r=>r.card));shelf.append(stack);
    shelfFilters.set(shelf,select);select('');
    return shelf;
  }
  function corroborationField(spec,sources,onChange) {
    const field=el('fieldset',null,'vhour-corroboration');
    const legend=el('legend',spec.prompt||'¿Qué pruebas lo sostienen?');
    const list=el('div',null,'vhour-source-list');
    const count=el('p',null,'vhour-source-count');
    count.setAttribute('role','status');
    count.setAttribute('aria-atomic','true');
    const inputs=[];
    function update() {
      const full=sources.size===spec.count;
      for(const input of inputs)input.disabled=full && !input.checked;
      count.textContent=sources.size+' de '+spec.count+' fuentes seleccionadas.'+
        (full?' Desmarca una para cambiarla.':'');
    }
    for(const option of spec.options) {
      const label=el('label',null,'vhour-source'),input=el('input');
      input.type='checkbox';input.name='vhour-source';input.value=option.id;
      input.addEventListener('change',()=>{
        if(input.checked && sources.size<spec.count)sources.add(option.id);
        else if(!input.checked)sources.delete(option.id);
        input.checked=sources.has(option.id);
        update();onChange();
      });
      inputs.push(input);
      label.append(input,el('span',option.label));
      list.append(label);
    }
    field.append(legend,count,list);
    update();
    return field;
  }
  function decision(stage,index,controller,refresh) {
    const form=el('form',null,'vhour-task');
    form.dataset.mode=stage.mode;
    const field=el('fieldset'), legend=el('legend',stage.task);
    field.append(legend);
    const selected=[];
    const list=el('div',null,'vhour-options'), order=el('ol',null,'vhour-order');
    const status=live();
    const submit=el('button','Contrastar respuesta','vd-primary');submit.type='submit';
    const options=stage.options||[];
    const ordering=stage.mode==='order';
    const required = Number.isInteger(stage.requiredCount) && stage.requiredCount>0 && stage.requiredCount<=options.length
      ? stage.requiredCount : null;
    const sources=new Set();
    const ready=()=>(required?selected.length===required:selected.length>0) &&
      (!stage.corroboration || sources.size===stage.corroboration.count);
    let sending=false;
    if(ordering) {
      const summary=el('div',null,'vhour-order-summary'), count=el('span',null,'vhour-order-count');
      count.setAttribute('role','status');
      summary.append(el('h5','Tu secuencia'),count);
      const undo=control('Deshacer el último paso',()=>{
        const id=selected.pop();
        status.textContent='';
        sync();
        if(!selected.length)picks.find(p=>p.opt.id===id)?.b.focus();
      },'vhour-order-undo');
      const picks=options.map(opt=>{
        const b=control(opt.label,()=>{
          if(selected.includes(opt.id)||(required && selected.length>=required))return;
          selected.push(opt.id);
          status.textContent='';
          sync();
        },'vhour-order-pick');
        list.append(b);return {opt,b};
      });
      function sync(){
        for(const {opt,b} of picks){
          const position=selected.indexOf(opt.id);
          const chosen=position!==-1;
          pressed(b,chosen);
          // The action can be inspected by keyboard after being placed in the sequence.
          if(chosen){
            b.dataset.position=String(position+1);
            b.setAttribute('aria-label',opt.label+(/[.!?…]$/.test(opt.label.trim())?' ':'. ')+'Paso '+(position+1)+' de tu secuencia.');
          }else{
            delete b.dataset.position;
            b.setAttribute('aria-label',opt.label);
          }
          b.setAttribute('aria-disabled',String(chosen||Boolean(required && selected.length>=required)));
        }
        const steps=selected.map((id,i)=>{
          const step=el('li',options.find(opt=>opt.id===id).label,'vhour-order-step');
          step.dataset.position=String(i+1);
          return step;
        });
        if(required && selected.length<required){
          for(let i=selected.length;i<required;i++){
            const step=el('li',i===selected.length?'Elige el siguiente paso':'Pendiente','vhour-order-next');
            step.dataset.position=String(i+1);
            steps.push(step);
          }
        }else if(!required && selected.length<options.length){
          steps.push(el('li',selected.length?'Puedes añadir otro paso.':'Elige la primera acción.','vhour-order-next'));
        }
        order.replaceChildren(...steps);
        const amount=selected.length;
        count.textContent=required?amount+' de '+required+' pasos':amount+(amount===1?' paso elegido':' pasos elegidos');
        undo.disabled=!amount;submit.disabled=!ready();
      }
      order.setAttribute('aria-label','Secuencia elegida');
      const workspace=el('div',null,'vhour-order-workspace');
      const candidates=el('div',null,'vhour-order-candidates');
      const draft=el('div',null,'vhour-order-draft');
      candidates.append(el('h5','Acciones disponibles','vhour-order-list-label'),list);
      draft.append(summary,order,undo);
      workspace.append(candidates,draft);
      field.append(el('p','Añade las acciones en el orden que propones. Puedes deshacer la última antes de contrastar.','vhour-muted'),
        workspace);
      sync();
    } else {
      const multi=stage.mode==='multi';
      if(multi)field.append(el('p','Puedes marcar varias opciones.','vhour-muted'));
      for(const opt of options){
        const label=el('label',null,'vhour-option'),input=el('input');
        input.type=multi?'checkbox':'radio';input.name='vhour-choice';input.value=opt.id;
        input.addEventListener('change',()=>{
          status.textContent='';
          if(!multi)selected.length=0;
          const at=selected.indexOf(opt.id);
          if(input.checked && at<0)selected.push(opt.id);
          if(!input.checked && at>=0)selected.splice(at,1);
          submit.disabled=!ready();
        });
        label.append(input,el('span',opt.label));list.append(label);
      }
      field.append(list);submit.disabled=true;
    }
    form.append(el('h4','Tu hipótesis','vhour-decision-title'),field);
    let sourceField;
    if(stage.corroboration) {
      sourceField=corroborationField(stage.corroboration,sources,()=>{
        status.textContent='';submit.disabled=!ready();
      });
      form.append(sourceField);
    }
    form.append(submit,status);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(sending||!ready())return;
      sending=true;submit.disabled=true;field.disabled=true;
      if(sourceField)sourceField.disabled=true;
      status.textContent='Contrastando la respuesta…';
      try {
        const reply=await (sourceField
          ? controller.submit(index,selected.slice(),Array.from(sources))
          : controller.submit(index,selected.slice()));
        if(reply.correct)refresh(reply.hour,reply.feedback);
        else if(reply.hour?.current!==index && reply.hour)refresh(reply.hour,reply.feedback);
        else status.textContent=reply.feedback||'Revisa las pruebas e inténtalo de nuevo.';
      } catch(e) {
        if(e?.status===409 && controller.reload){
          try{
            const restored=await controller.reload();
            if(restored?.current!==index && restored){refresh(restored,'Se ha recuperado el avance guardado.');return;}
          }catch { /* La próxima respuesta puede reintentarse. */ }
        }
        status.textContent=e.message||'No se ha podido guardar. Vuelve a intentarlo.';
      } finally {
        sending=false;submit.disabled=!ready();field.disabled=false;
        if(sourceField)sourceField.disabled=false;
      }
    });
    return form;
  }
  function hotelMap(hotel,state,initial,save) {
    const wrap=el('section',null,'vhour-hotel');
    wrap.append(el('h3','Explorar el hotel'));
    const scene=el('div',null,'vhour-lobby');
    const img=el('img');img.src='/valdemar-hotel-lobby.webp';img.alt='Recepción nocturna del Hotel Medianoche. Los lugares visitables se indican en el plano.';scene.append(img);
    const spots=el('div',null,'vhour-spots');
    spots.setAttribute('aria-label','Lugares del hotel');
    const pane=el('div',null,'vhour-location');
    const locations=hotel.locations||[],objects=hotel.objects||[],witnesses=hotel.witnesses||[];
    let current=locations[0];
    let held=new Set(initial?.objects), learnt=new Set(initial?.witnesses), pending=false;
    function update(snapshot){
      if(!snapshot)return;
      held=new Set(snapshot.objects);learnt=new Set(snapshot.witnesses);
      display();
    }
    async function act(input,message){
      if(pending)return;
      pending=true;stopVoice(state);display();
      try {
        await save(input);
        record.textContent=message;
      } catch(error) { record.textContent=error.message || 'No se ha podido guardar la prueba.'; }
      finally {pending=false;display();}
    }
    const pins=[];
    const record=live();
    function located(item,i){
      if(item.location && locations.some(l=>l.id===item.location))return item.location;
      return locations[i%Math.max(locations.length,1)]?.id;
    }
    function display(moveFocus=false) {
      if(!current)return;
      for(const pin of pins)pressed(pin.button,pin.id===current.id);
      pane.replaceChildren();
      const title=head('h4',current.name);
      pane.append(title,el('p',current.blurb));
      for(const [i,obj] of objects.entries()){
        if(located(obj,i)!==current.id)continue;
        const pick=control(held.has(obj.id)?'En tu carpeta: '+obj.label:'Examinar '+obj.label,()=>{
          act({operation:'hotel-collect',object:obj.id},'Guardado en tu carpeta: '+obj.label+'.');
        });
        pick.disabled=pending||held.has(obj.id);pane.append(pick);
        if(held.has(obj.id))pane.append(el('p',obj.detail,'vhour-clipping'));
      }
      for(const [i,w] of witnesses.entries()){
        if(located(w,i)!==current.id)continue;
        const talk=el('div',null,'vhour-witness');talk.append(el('h5',w.name),el('p',w.first,'vhour-quote'),voiceCard(w.first,state,true));
        if(learnt.has(w.id)){
          talk.append(el('h6','Después de ver la prueba'),el('p',w.again,'vhour-quote'),voiceCard(w.again,state,true));
        } else if(!held.size) {
          talk.append(el('p','Recoge una prueba del hotel para mostrársela.','vhour-muted'));
        } else {
          const select=el('select'); select.setAttribute('aria-label','Prueba para '+w.name);
          for(const obj of objects.filter(x=>held.has(x.id))){
            const option=el('option',obj.label);option.value=obj.id;select.append(option);
          }
          const result=live();
          const show=control('Mostrar la prueba',()=>{
            act({operation:'hotel-testimony',object:select.value,witness:w.id},w.name+' amplía su declaración.');
          });
          show.disabled=pending;talk.append(select,show,result);
        }
        pane.append(talk);
      }
      if(held.size){
        const bag=el('div');
        for(const obj of objects.filter(o=>held.has(o.id)))bag.append(el('strong',obj.label),el('p',obj.detail));
        pane.append(fold('Objetos recogidos · '+held.size,bag));
      }
      if(moveFocus)title.focus({preventScroll:true});
    }
    for(const place of locations){
      const b=control(place.name,()=>{stopVoice(state);current=place;record.textContent='';display(true);},'vhour-pin');
      b.dataset.place=place.id;
      pins.push({id:place.id,button:b});spots.append(b);
    }
    scene.append(spots);wrap.append(scene,pane,record);display();
    return {node:wrap,update};
  }
  function mount(node,initial,controller) {
    const state={voice:null,station:controller.station};
    let hour=initial;
    const main=el('div',null,'vhour-chapter');
    const inventory=window.ExpeditionInventory?.create(controller.inventory, value=>{hour.inventory=value;});
    let hotel;
    if(initial.hotel)hotel=hotelMap(initial.hotel,state,initial.inventory?.hotel,async input=>{
      const {inventory:snapshot}=await controller.inventory(input);
      if(snapshot.revision>=(hour.inventory?.revision||0)){
        hour.inventory=snapshot;hotel.update(snapshot.hotel);inventory?.update(snapshot,hour.current);
      }
    });
    node.classList.add('vhour');
    node.append(main); if(hotel)(controller.hotelNode||node).append(hotel.node);
    function render(data,feedback='',focus=false) {
      stopVoice(state);
      hour=data;
      hotel?.update(hour.inventory?.hotel);
      main.replaceChildren();
      const stages=hour.stages||[],index=hour.current,stage=hour.stage;
      if(stage)main.dataset.stage=String(index+1);
      else delete main.dataset.stage;
      const nav=el('ol',null,'vhour-timeline');nav.setAttribute('aria-label','Recorrido de la investigación');
      nav.tabIndex=0;
      for(const [i,step] of stages.entries()){
        const entry=el('li',null,i<index?'is-done':i===index?'is-current':'');
        if(i===index)entry.setAttribute('aria-current','step');
        const number=el('span',String(i+1).padStart(2,'0'),'vhour-number');
        entry.append(number,el('span',step.place||step.title));nav.append(entry);
      }
      main.append(nav);
      if(inventory && hour.inventory){inventory.update(hour.inventory, index);main.append(inventory.node);}
      if(feedback){const message=live();message.className='vhour-status vhour-solved';message.textContent=feedback;main.append(message);}
      if(stage) {
        main.append(el('p','Etapa '+(index+1)+' de '+stages.length+' · '+stage.minutes+' min orientativos','vhour-kicker'));
        const heading=head('h3',stage.title);
        main.append(heading,el('p',stage.brief,'vhour-lead'));
        if(hotel && controller.visitHotel)main.append(control(index===3?'Volver a interrogar a los huéspedes':'Explorar la recepción',controller.visitHotel,'vhour-visit'));
        const workbench=el('div',null,'vhour-workbench');
        workbench.dataset.stage=String(index+1);
        const shelf=proofShelf(stage.materials||[],state,controller.role);
        const instrument=stage.instrument;
        const makeTool=instrument && window.ValdemarTalleres?.[instrument.id];
        if(typeof makeTool==='function') {
          const tool=makeTool(instrument.data);
          const title=tool?.querySelector?.('h2,h3,h4,h5,h6')?.textContent || tool?.getAttribute?.('aria-label');
          if(title) {
            const drawer=el('details',null,'vhour-instrument');
            drawer.open=window.matchMedia?.('(min-width: 64rem)').matches ?? true;
            drawer.append(el('summary',title),tool);
            shelf.append(drawer);
          } else if(tool)shelf.append(tool);
        }
        const task=decision(stage,index,controller,(next,note)=>{controller.change(next);render(next,note,true);});
        if(controller.station){
          const cards=()=>Array.from(shelf.querySelectorAll('.vhour-material')).filter(card=>!card.hidden);
          const inspect=(card)=>{
            card.open=true;
            const label=card.querySelector('summary');
            label.focus({preventScroll:true});label.scrollIntoView({block:'start'});
          };
          const first=control('Abrir mi primera prueba',()=>{
            const card=cards()[0];if(card)inspect(card);
          },'vd-primary');
          main.append(first);
          for(const card of shelf.querySelectorAll('.vhour-material')){
            const next=control('Continuar',()=>{
              const list=cards(),target=list[list.indexOf(card)+1];
              if(target)inspect(target);
              else{const title=task.querySelector('h4');title.tabIndex=-1;title.focus();title.scrollIntoView({block:'start'});}
            },'vd-station-next');
            card.addEventListener('toggle',()=>{
              if(card.open){next.textContent=cards().at(-1)===card?'Responder a la hipótesis':'Abrir la siguiente prueba';}
            });
            card.append(next);
          }
        }
        workbench.append(shelf,task);
        main.append(workbench);
        if(focus){heading.focus({preventScroll:true});heading.scrollIntoView?.({block:'start',behavior:'instant'});}
      } else {
        const heading=head('h3','Investigación completada');
        main.append(heading,control('Ir a la resolución',controller.finish,'vd-primary'));
        if(focus)heading.focus({preventScroll:true});
      }
      const notes=hour.journal||[];
      if(notes.length) {
        const box=el('div',null,'vhour-journal');
        for(const note of notes)box.append(fold(note.title,el('p',note.success||note.brief,'vhour-clipping'),proofShelf(note.materials||[],state,controller.role)));
        main.append(fold('Cuaderno de etapas resueltas · '+notes.length,box));
      }
    }
    render(hour);
    return {update:next=>render(next),updateInventory:value=>{hour.inventory=value;hotel?.update(value.hotel);inventory?.update(value,hour.current);},pause:()=>stopVoice(state),focusStage(){
      const heading=main.querySelector('h3');
      if(!heading)return;
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'start',behavior:'instant'});
    }};
  }
  window.ValdemarHour={mount,proofShelf,decision,stopVoice,filterByRole};
})();
