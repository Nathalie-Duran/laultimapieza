(() => {
  'use strict';

  function el(tag, cls, text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!=null)node.textContent=text;
    return node;
  }
  function button(label, run, cls='mansion-secondary') {
    const node=el('button',cls,label);node.type='button';
    node.addEventListener('click',run);return node;
  }
  const mechanisms=[
    ['escudos','Escudos del vestíbulo','⬟'],['guardian','Retrato del guardián','▣'],
    ['pozo','Aparejo del pozo','⚓'],['reloj','Reloj de la casa','◷'],
    ['elementos','Mesa de elementos','⚗'],['fotografias','Mesa de superposición','▧'],
    ['esferas','Tres esferas','◉'],['riego','Llaves de riego','✦'],
    ['vias','Cambio de vías','⌘'],['presencia','Detector de presencia','◎'],
    ['radio','Sintonizador','◒'],['morse','Telégrafo','· —'],
    ['intercambio','Bandejas de intercambio','⇄'],['acta','Acta de la casa','✎'],
    ['paneles','Paneles de los dos mundos','▥']
  ];
  const dialKinds=new Set(['reloj','esferas','riego','vias']);
  const guardianArt=new Map([['cuervo','cuervo'],['lobo','lobo'],['búho','buho'],['ciervo','ciervo']]);
  const roman=['I','II','III','IV'];

  function guardianMedal(option) {
    const image=el('img','guardian-relief');
    image.src='/mansion-guardian-'+guardianArt.get(option.value)+'.webp';
    image.alt='';image.width=256;image.height=256;image.decoding='async';
    return image;
  }

  function guardianLock(fields,draft,stage,world,submit) {
    const form=el('form','guardian-form'),arch=el('div','guardian-arch'),sockets=el('div','guardian-sockets');
    const seats=new Map(fields.map(field=>[field.id,field]));
    const done=stage.contributions?.[world]?.done===true;
    const chosen=field=>field.options.find(option=>option.value===draft[field.id]);
    let active=seats.get(draft.guardianSeat)||fields.find(field=>!chosen(field))||fields[0];
    const note=el('p','guardian-announcement');note.setAttribute('role','status');
    const caption=el('div','guardian-sides');
    for(const side of ['B','A']){
      const label=el('span','guardian-side',side==='B'?'Casa abandonada':'Casa habitada');
      if(side===world)label.dataset.own='true';
      caption.append(label);
    }
    arch.setAttribute('role','group');arch.setAttribute('aria-label','Los cuatro engastes del arco, de izquierda a derecha');
    const slotViews=[];
    for(let i=0;i<4;i++){
      const id='escudo'+(i+1),field=seats.get(id);
      const fixed=field?done:stage.contributions?.[i<2?'B':'A']?.done;
      const slot=field&&!done?button('',()=>{active=field;draft.guardianSeat=id;draw();},'guardian-slot'):el('div','guardian-slot');
      slot.dataset.field=id;slot.dataset.movable=String(Boolean(field&&!done));
      const bezel=el('span','guardian-bezel'),number=el('span','guardian-numeral',roman[i]),status=el('span','guardian-setting');
      const face=el('span','guardian-face');bezel.append(face);slot.append(bezel,number,status);sockets.append(slot);
      slotViews.push({slot,field,face,status,fixed});
    }
    arch.append(sockets,caption);form.append(arch);
    const bench=el('fieldset','guardian-bench'),legend=el('legend','guardian-legend'),tray=el('div','guardian-tray');
    bench.append(legend,tray);
    const latch=el('button','guardian-latch','Encajar mis escudos');latch.type='submit';
    const footer=el('div','guardian-footer'),count=el('span','guardian-count');footer.append(count,latch);
    if(done){
      const message=el('p','guardian-confirmed','Tus escudos han quedado fijos. Falta encajar los de la otra casa.');
      message.setAttribute('role','status');form.append(message);
    }else form.append(bench,footer,note);
    function draw(){
      for(const {slot,field,face,status,fixed} of slotViews){
        const selection=field&&!done?chosen(field):null;
        slot.dataset.filled=String(Boolean(selection));slot.dataset.fixed=String(Boolean(fixed));
        face.replaceChildren();
        if(selection)face.append(guardianMedal(selection));
        status.textContent=fixed?'Fijado':selection?selection.label:field?'Libre':'Otra casa';
        if(slot.dataset.movable==='true'){
          slot.setAttribute('aria-pressed',String(field===active));
          slot.setAttribute('aria-label',field.label+' · '+(selection?selection.label:'Sin ajustar'));
        }
      }
      if(done)return;
      const placed=fields.filter(chosen).length;
      count.textContent=placed+' de '+fields.length+' colocados';
      latch.disabled=placed!==fields.length||stage.ready===false;
      legend.textContent='Elige la figura del '+active.label.toLocaleLowerCase('es');
      tray.replaceChildren();
      for(const option of active.options){
        const chip=button('',()=>{
          const edited=active;
          draft[edited.id]=option.value;
          active=fields.find(field=>!chosen(field))||edited;draft.guardianSeat=active.id;
          draw();
          note.textContent=edited.label+' · '+option.label+'. '+(active===edited?'Puedes probar el cierre o cambiar las figuras.':legend.textContent+'.');
          if(active!==edited)tray.firstElementChild?.focus({preventScroll:true});
          else tray.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
        },'guardian-medal');
        chip.dataset.value=option.value;
        chip.setAttribute('aria-label','Colocar '+option.label.toLocaleLowerCase('es')+' en '+active.label.toLocaleLowerCase('es'));
        chip.setAttribute('aria-pressed',String(draft[active.id]===option.value));
        chip.append(guardianMedal(option),el('span','guardian-animal',option.label));tray.append(chip);
      }
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(done||stage.ready===false||!fields.every(chosen))return;
      submit(Object.fromEntries(fields.map(field=>[field.id,draft[field.id]])));
    });
    draw();return form;
  }

  function dial(field, draft, kind) {
    if(kind==='reloj'&&['agujaHoras','agujaMinutos'].includes(field.id)&&window.MansionAtrezo)return window.MansionAtrezo.clock(field,draft);
    const wrap=el('fieldset','mansion-control mansion-dial'), title=el('legend',null,field.label);
    const face=el('div','mansion-device'), needle=el('span','mansion-symbol');
    const read=el('output','mansion-readout');
    const entries=field.options;
    const initial=entries.findIndex(option=>String(option.value)===String(draft[field.id]));
    let position=initial;
    const symbols={escudos:'⬟',reloj:'↑',esferas:'◑',riego:'✣',vias:'┗'};
    needle.textContent=symbols[kind];
    needle.setAttribute('aria-hidden','true');face.append(needle);
    const clockHand=kind==='reloj'&&(field.id==='agujaHoras'||field.id==='agujaMinutos');
    if(clockHand){
      face.style.cssText='position:relative;width:8rem;height:8rem';face.setAttribute('aria-hidden','true');
      for(const [value,x,y] of [['XII',50,12],['III',88,50],['VI',50,88],['IX',12,50]]){
        const mark=el('span','',value);mark.style.cssText='position:absolute;left:'+x+'%;top:'+y+'%;transform:translate(-50%,-50%);font:600 .77rem Georgia,serif';face.append(mark);
      }
      needle.textContent='';needle.style.cssText='position:absolute;left:50%;bottom:50%;transform-origin:bottom center;background:var(--house-metal);border-radius:4px;width:4px;height:'+(field.id==='agujaHoras'?'23%':'34%');
    }
    const adjust=direction=>{position=(position<0?(direction>0?0:entries.length-1):(position+direction+entries.length)%entries.length);draw();};
    const back=button('−',()=>adjust(-1),'mansion-piece'),next=button('+',()=>adjust(1),'mansion-piece');
    back.setAttribute('aria-label','Retroceder en '+field.label);
    next.setAttribute('aria-label','Avanzar en '+field.label);
    const buttons=el('div','mansion-pieces');
    function draw() {
      if(position<0){read.textContent='Sin ajustar';if(clockHand)needle.hidden=true;return;}
      const option=entries[position];draft[field.id]=String(option.value);read.textContent=option.label;
      if(kind==='esferas'){
        const marks={luna:'☾',sol:'☀',estrella:'★'};
        needle.textContent=marks[option.value]||symbols[kind];
      }else if(clockHand){
        needle.hidden=false;needle.style.transform='translateX(-50%) rotate('+(Number(option.value)*(field.id==='agujaHoras'?30:6))+'deg)';
      }else needle.style.transform='rotate('+Math.round(position*360/entries.length)+'deg)';
    }
    read.setAttribute('aria-live','polite');buttons.append(back,read,next);wrap.append(title,face,buttons);draw();return wrap;
  }
  function tiles(field,draft,kind,onChange) {
    const group=el('fieldset','mansion-control');
    group.append(el('legend',null,field.label));
    const tiles=el('div','mansion-pieces');const buttons=[];
    for(const [index,option] of field.options.entries()){
      const item=button('',()=>{
        draft[field.id]=String(option.value);
        for(const [i,other] of buttons.entries())other.setAttribute('aria-pressed',String(i===index));
        onChange?.();
      },'mansion-piece');
      const value=String(option.value);
      if(kind==='elementos' && /^[a-z]{1,2}$/i.test(value))item.append(el('span','mansion-symbol',value));
      if(kind==='acta' && field.id==='copia'){
        item.style.borderInlineStart=value==='azul'?'6px solid #68a9df':'6px solid #bd8736';
        const seal=el('span','mansion-symbol','▤');seal.setAttribute('aria-hidden','true');item.append(seal);
      }
      item.append(el('span','mansion-piece-label',option.label));
      item.setAttribute('aria-pressed',String(String(draft[field.id])===value));buttons.push(item);tiles.append(item);
    }
    group.append(tiles);return group;
  }
  function tuned(field,draft){
    const group=el('fieldset','mansion-control');
    const label=el('label','mansion-control',field.label), input=el('input','mansion-range');
    const read=el('output','mansion-readout');
    input.type='range';input.min='0';input.max=String(field.options.length-1);input.step='1';
    const start=field.options.findIndex(option=>String(option.value)===String(draft[field.id]));
    input.value=String(Math.max(0,start));
    function update(){const value=field.options[Number(input.value)];draft[field.id]=String(value.value);read.textContent=value.label;input.setAttribute('aria-valuetext',value.label);}
    input.addEventListener('input',update);update();label.append(input,read);group.append(label);return group;
  }
  function textField(field,draft){
    const label=el('label','mansion-control',field.label),input=el('input','mansion-code');
    input.type='text';input.autocomplete='off';input.spellcheck=false;
    if(field.maxLength)input.maxLength=field.maxLength;
    input.value=draft[field.id]||'';
    input.required=true;input.addEventListener('input',()=>{draft[field.id]=input.value;});label.append(input);
    return label;
  }
  function clock(field,draft){
    const box=el('fieldset','mansion-control mansion-clock');box.append(el('legend',null,field.label));
    const pad=n=>String(n).padStart(2,'0'),initial=String(draft[field.id]||'1200');
    const face=el('div','mansion-clock-face');face.setAttribute('aria-hidden','true');
    face.style.cssText='position:relative;width:9rem;height:9rem;border:2px solid currentColor;border-radius:50%;margin:.65rem auto';
    for(const [label,x,y] of [['XII',50,10],['III',90,50],['VI',50,90],['IX',10,50]]){
      const mark=el('span','',label);mark.style.cssText='position:absolute;transform:translate(-50%,-50%);left:'+x+'%;top:'+y+'%';face.append(mark);
    }
    function hand(length,width){
      const node=el('i');node.style.cssText='position:absolute;bottom:50%;left:50%;height:'+length+'%;width:'+width+'px;transform-origin:bottom;background:currentColor';face.append(node);return node;
    }
    const short=hand(22,4),long=hand(32,2);box.append(face);
    const controls=[],read=el('output','mansion-readout');
    function update(){const [hour,minutes]=controls.map(input=>Number(input.value));draft[field.id]=pad(hour)+pad(minutes);short.style.transform='rotate('+(hour*30+minutes/2)+'deg)';long.style.transform='rotate('+(minutes*6)+'deg)';read.textContent=pad(hour)+':'+pad(minutes);}
    for(const [i,name,max,start] of [[0,'Aguja de las horas',12,Number(initial.slice(0,2))],[1,'Aguja de los minutos',59,Number(initial.slice(2))]]){
      const label=el('label','mansion-control',name),input=el('input','mansion-range');
      input.type='range';input.min=i?'0':'1';input.max=String(max);input.value=String(start);input.step='1';input.addEventListener('input',update);
      controls.push(input);label.append(input);box.append(label);
    }
    box.append(read);update();return box;
  }
  function frequency(field,draft){
    if(window.MansionAtrezo)return window.MansionAtrezo.radio(field,draft);
    const label=el('label','mansion-control',field.label),input=el('input','mansion-range'),read=el('output','mansion-readout');
    input.type='range';input.min='600';input.max='710';input.step='10';input.value=String(draft[field.id]||600);
    function turn(){draft[field.id]=input.value;read.textContent=input.value+' kHz';input.setAttribute('aria-valuetext',read.textContent);}
    input.addEventListener('input',turn);turn();label.append(input,read);return label;
  }
  function sequence(field,draft,symbols){
    const box=el('fieldset','mansion-control');box.append(el('legend',null,field.label));
    const row=el('div','mansion-pieces'),read=el('output','mansion-readout');
    const tokens=draft[field.id+'Tokens']||[];draft[field.id+'Tokens']=tokens;
    function draw(){read.textContent=tokens.length?tokens.join(' · '):'Sin colocar';draft[field.id]=tokens.join('');}
    const limit=Math.min(4,Number(field.maxLength)||4);
    for(const symbol of symbols)row.append(button(symbol,()=>{if(tokens.length<limit){tokens.push(symbol);draw();}},'mansion-piece'));
    read.setAttribute('aria-live','polite');box.append(row,read,button('Retirar la última pieza',()=>{tokens.pop();draw();}));draw();return box;
  }
  function morse(field,draft){
    const wrap=el('fieldset','mansion-control');wrap.append(el('legend',null,field.label));
    const input=el('input','mansion-code');input.type='text';input.value=draft[field.id]||'';input.maxLength=field.maxLength||3;
    const label=el('label','mansion-control','Letras transcritas');label.append(input);
    const row=el('div','mansion-pieces'),out=el('output','mansion-readout');
    const groups=draft.morseGroups||[];
    draft.morseGroups=groups;
    let press=draft.morsePress||'';
    function show(){
      draft.morsePress=press;
      const tape=[...groups,press].filter(Boolean);
      out.textContent=tape.map(group=>[...group].map(mark=>mark==='.'?'corta':'larga').join(' · ')).join(' / ')||'Manipulador en reposo';
    }
    for(const [mark,name] of [['.','Pulsación corta ·'],['-','Pulsación larga —']])row.append(button(name,()=>{
      if(groups.length<input.maxLength&&press.length<4)press+=mark;
      show();
    },'mansion-piece'));
    row.append(button('Separar grupo',()=>{if(press&&groups.length<input.maxLength){groups.push(press);press='';show();}}),
      button('Deshacer última pulsación',()=>{if(!press)press=groups.pop()||'';press=press.slice(0,-1);show();}));
    input.addEventListener('input',()=>{draft[field.id]=input.value;});
    out.setAttribute('aria-live','polite');
    wrap.append(row,out,el('p',null,'Usa la clave impresa para pasar de grupos de pulsaciones a letras.'),label);
    show();return wrap;
  }
  function spatialPhoto(settings,world,evidence){
    const wrap=el('div','mansion-photo-table'),frame=el('div','mansion-photo-layers');
    const base=el('img','mansion-photo-base'),overlay=el('img','mansion-photo-overlay');
    base.src='/mansion-room-5.webp';base.alt='La placa de la galería en la casa habitada';
    overlay.src='/mansion-ruin-5.webp';overlay.alt='';overlay.setAttribute('aria-hidden','true');
    frame.style.cssText='position:relative;overflow:hidden;aspect-ratio:16/7';
    base.style.cssText='width:100%;height:100%;object-fit:cover;filter:grayscale(1)';
    overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:sepia(.8) contrast(1.25)';
    const label=el('label','mansion-control','Superponer las dos fotografías');
    const slider=el('input','mansion-range');slider.type='range';slider.min='0';slider.max='100';slider.value=String(settings.exposure??50);
    function adjust(){const n=Number(slider.value);settings.exposure=n;overlay.style.clipPath='inset(0 '+(100-n)+'% 0 0)';slider.setAttribute('aria-valuetext',n+' por ciento de la segunda fotografía');}
    adjust();slider.addEventListener('input',adjust);frame.append(base,overlay);label.append(slider);wrap.append(frame,label);
    const table=el('table','mansion-photo-grid');table.style.cssText='width:100%;table-layout:fixed;border-collapse:collapse';
    table.append(el('caption',null,'Marcas de las placas sobre la cuadrícula'));
    const columns=el('tr'),top=el('thead');columns.append(el('th',null,'Fila'));
    for(const col of 'ABCD'){const head=el('th',null,col);head.scope='col';columns.append(head);}top.append(columns);table.append(top);
    const cells=el('tbody');table.append(cells);wrap.append(table);
    function redraw(){
      cells.replaceChildren();
      const shift=settings.ajuste||'', dx=shift.includes('izquierda')?-1:shift.includes('derecha')?1:0,dy=shift.includes('arriba')?-1:0;
      for(let row=1;row<=3;row++){
        const tr=el('tr'),rowHead=el('th',null,String(row));rowHead.scope='row';tr.append(rowHead);
        for(let col=0;col<4;col++){
          const cell=el('td');cell.style.cssText='border:1px solid currentColor;height:3.4rem;padding:.2rem;overflow-wrap:anywhere';
          const labels=[];
          for(const plate of evidence||[]){
            if(plate.kind!=='photo-grid')continue;
            const x=col-(plate.role==='B'?dx:0),y=row-(plate.role==='B'?dy:0);
            if(x<0||x>3)continue;
            for(const mark of plate.marks||[])if(mark.cell==='ABCD'[x]+y)labels.push(plate.role+' · '+mark.label);
          }
          cell.textContent=labels.length?labels.join(' / '):'—';tr.append(cell);
        }
        cells.append(tr);
      }
    }
    redraw();
    return {node:wrap,redraw};
  }
  function wellMechanism(stage,actions,world,perform){
    const section=el('section','mansion-well'),frame=el('figure','mansion-well-view');
    const day=world==='A',recovered=stage.ready===true;
    const depth=stage.wellDepth;
    const state=day?'day':'night';
    frame.dataset.view=recovered?'recovered':state;
    const photo=el('img','mansion-well-photo');
    photo.src=day&&!recovered?'/mansion-room-3.webp':'/mansion-well-detail.webp';
    photo.alt=recovered?'La llave antigua que acabáis de recuperar.':day
      ?'El torno de la manivela, con tres marcas para detener el cordón.'
      :'El interior del pozo. La llave está en un saliente de la pared.';
    frame.append(photo);
    const label=el('figcaption','mansion-well-caption',recovered?'Llave recuperada':day?'Torno de la manivela':'Interior del brocal');
    frame.append(label);
    const reachLabels={above:'El imán cuelga por encima de la llave.',at:'El imán está a la altura del saliente.',below:'El imán ha pasado de largo y cuelga bajo la llave.'};
    const numerals=['','I','II','III'];
    if(!day&&!recovered){
      if(stage.wellMark){
        const notches=el('span','mansion-well-marks',numerals[stage.wellMark]);
        notches.setAttribute('aria-label',stage.wellMark+' incisiones en la piedra junto a la llave');
        notches.setAttribute('role','img');
        frame.append(notches);
      }
      if(depth){
        const rope=el('span','mansion-well-cord');
        rope.setAttribute('aria-hidden','true');
        rope.style.setProperty('--well-drop',['0%','24%','45%','72%'][depth]);
        rope.append(el('span','mansion-well-magnet'));frame.append(rope);
      }
    }
    section.append(frame);
    if(recovered){
      section.append(el('p','mansion-well-instruction','La llave salió del pozo. Prueba la cerradura que reconociste durante la investigación.'));
      return section;
    }
    const byId=new Map(actions.map(a=>[a.id,a]));
    const pickup=byId.get(day?'cordon':'iman'),combine=byId.get('atar'),fish=byId.get('pescar');
    const rigged=Boolean(combine?.done);
    const instruction=el('p','mansion-well-instruction');
    const choices=el('div','mansion-well-choices');
    const actuate=(action,label)=>choices.append(button(label||action.label,()=>perform(action),'mansion-action'));
    if(pickup&&!pickup.done){
      instruction.textContent=day?'Junto a la campana hay un cordón de algodón que soportaría el peso de la llave.':'El herrero dejó un imán en su cajón. Una viruta de hierro se pega a sus extremos.';
      actuate(pickup);
    }else if(!rigged){
      instruction.textContent=combine?.enabled?'Las piezas de las dos casas han llegado al brocal. Puedes montar la sonda.':day
        ?'El cordón está listo. Alguien debe buscar con qué sujetar la llave en la casa abandonada.'
        :'Tienes el imán. En la casa habitada hay que encontrar con qué bajarlo.';
      if(combine?.enabled)actuate(combine);
    }else if(day){
      instruction.textContent='La cuerda tiene tres marcas. Sujétala donde te indique quien ve la llave desde el otro lado.';
      const group=el('fieldset','mansion-well-depth');
      group.append(el('legend',null,'Marca de la cuerda'));
      const row=el('div','mansion-well-choices');
      for(const n of [1,2,3]){
        const control=button(numerals[n],()=>perform({id:'profundidad'},{depth:n}),'mansion-piece');
        control.setAttribute('aria-label','Sujetar la cuerda en la marca '+numerals[n]);
        control.setAttribute('aria-pressed',String(depth===n));row.append(control);
      }
      group.append(row);choices.append(group);
    }else{
      const title=stage.wellMark?'Junto a la llave hay '+stage.wellMark+' incisiones. ':'';
      instruction.textContent=title+(depth?(reachLabels[stage.wellReach]||'La cuerda cuelga frente al saliente.'):'La cuerda todavía está arriba. Comunica la marca a la casa habitada.');
      if(fish&&depth)actuate(fish,'Acercar el imán a la llave');
    }
    section.append(instruction,choices);
    return section;
  }
  function render({stage,draft,actions,submit,perform,world,inventory,mission}) {
    const [kind,title,symbol]=mission?['mission','Resolver la misión','◇']:mechanisms[Number(stage.number)-1]||['mesa',stage.title,'◇'];
    const box=el('section','mansion-puzzle');box.dataset.kind=kind;
    const heading=el('h3','mansion-puzzle-title',title);heading.tabIndex=-1;
    box.append(heading);
    const contribution=stage.contributions?.[world];
    const fields=(stage.controls||[]).filter(field=>!field.role||field.role==='both'||field.role===world);
    if(kind==='escudos' && fields.length && fields.every(field=>/^escudo[1-4]$/.test(field.id)&&field.options?.length&&field.options.every(option=>guardianArt.has(option.value)))){
      heading.textContent='Los cuatro guardianes';
      box.append(guardianLock(fields,draft,stage,world,submit));return box;
    }
    if(contribution?.objective)box.append(el('p','mansion-role-objective',contribution.objective));
    const realWell=kind==='pozo'&&Number.isInteger(stage.wellDepth);
    if(realWell)box.append(wellMechanism(stage,actions||[],world,perform));
    const plates=kind==='fotografias'?(window.MansionEvidence?.plates(draft,world,stage.evidence)??spatialPhoto(draft,world,stage.evidence)):null;
    if(plates)box.append(plates.node);
    if(kind==='guardian'&&world==='B'&&window.MansionEvidence?.portrait){
      box.append(window.MansionEvidence.portrait(draft,stage.evidence));
    }else if(kind==='guardian'||mission&&stage.id==='nox'){
      const image=el('img','mansion-character');
      image.src=kind==='guardian'?(world==='A'?'/mansion-elias.webp':'/mansion-photo.webp'):'/mansion-nox.webp';
      image.alt=kind==='guardian'?(world==='A'?'Elías junto al fuego':'La fotografía de los dos niños'):'Nox en la mansión';
      image.style.cssText='display:block;width:min(100%,24rem);max-height:14rem;object-fit:cover';box.append(image);
      if(kind==='guardian'){
        const notes=el('div','mansion-reference');notes.hidden=!draft.turned;
        for(const clue of (stage.evidence||[]).filter(item=>item.role===world))notes.append(el('p',null,clue.text));
        const label=world==='B'?'Girar la fotografía':'Hablar con Elías';
        const inspect=button(label,()=>{
          draft.turned=!draft.turned;notes.hidden=!draft.turned;image.hidden=world==='B'&&draft.turned;
          inspect.setAttribute('aria-expanded',String(draft.turned));inspect.textContent=draft.turned?'Volver a la escena':label;
        });
        inspect.setAttribute('aria-expanded',String(Boolean(draft.turned)));image.hidden=world==='B'&&Boolean(draft.turned);
        if(draft.turned)inspect.textContent='Volver a la escena';
        box.append(inspect,notes);
      }
    }
    if(kind==='acta'){
      const evidence=(stage.evidence||[]).filter(clue=>clue.role===world);
      for(const clue of evidence){
        const copy=el('details','mansion-reference');copy.open=true;copy.append(el('summary',null,clue.title));
        const parts=clue.text.split(/\s+(?=Copia (?:azul|ocre))/i);
        for(const part of parts)copy.append(el('blockquote',null,part));box.append(copy);
      }
    }
    if(!realWell&&['pozo','riego','vias','presencia','intercambio'].includes(kind)){
      const bench=el('div','mansion-device-rack'),objects=inventory||[];
      bench.append(el('h4',null,'Objetos sobre la mesa'));
      if(objects.length){
        const pieces=el('ul','mansion-pieces');
        for(const object of objects)pieces.append(el('li','mansion-piece',object.title));bench.append(pieces);
      }else bench.append(el('p','mansion-reference','La mesa está vacía.'));
      box.append(bench);
    }
    if(stage.panelStatus)box.append(el('p','mansion-readout',['A','B'].map(id=>'Panel '+id+' · '+(stage.panelStatus[id]?'enclavado':'pendiente')).join(' / ')));
    const actionBox=el('div','mansion-pieces');
    for(const action of realWell?[]:actions||[]){
      const control=button('',()=>perform(action),'mansion-action');
      const icon=el('span','mansion-symbol',symbol);icon.setAttribute('aria-hidden','true');
      control.disabled=action.done===true||action.enabled===false;
      if(action.reason)control.title=action.reason;
      control.append(icon,el('span','mansion-piece-label',action.label+(action.done?' · Hecho':'')));actionBox.append(control);
    }
    if(actionBox.childElementCount)box.append(actionBox);
    if(realWell&&!stage.ready)return box;
    if(contribution?.done){
      const confirmation=el('p','mansion-readout','Tu parte está resuelta. El mecanismo conserva tu ajuste mientras se resuelve la otra casa.');
      confirmation.setAttribute('role','status');box.append(confirmation);return box;
    }
    {
      const form=el('form','mansion-controls');
      for(const original of fields){
        const field=kind==='paneles'&&original.id==='panel'?{...original,options:original.options.filter(option=>option.value===world)}:original;
        if(field.id==='panel' && !field.options?.length){
          box.append(el('p','mansion-readout','El panel de esta realidad está enclavado. El segundo panel se acciona desde la otra casa.'));return box;
        }
        const isChoice=Array.isArray(field.options)&&field.options.length;
        let control;
        if(!isChoice&&kind==='reloj')control=clock(field,draft);
        else if(kind==='radio'&&field.id==='division'&&isChoice&&window.MansionAtrezo)control=window.MansionAtrezo.radio(field,draft);
        else if(!isChoice&&kind==='radio')control=frequency(field,draft);
        else if(!isChoice&&kind==='morse')control=morse(field,draft);
        else if(!isChoice&&kind==='elementos'&&field.symbols?.length)control=sequence(field,draft,field.symbols);
        else if(!isChoice&&kind==='fotografias'&&field.id==='casilla'){
          const cells=[1,2,3].flatMap(row=>['A','B','C','D'].map(col=>({value:col+row,label:col+row})));
          control=tiles({...field,options:cells},draft,kind);
        }else control=!isChoice?textField(field,draft):dialKinds.has(kind)?dial(field,draft,kind):kind==='radio'&&field.id==='frecuencia'?tuned(field,draft):tiles(field,draft,kind,field.id==='ajuste'?plates?.redraw:null);
        form.append(control);
      }
      const send=el('button','mansion-primary',stage.submitLabel||(realWell?'Probar la cerradura':contribution?'Comprobar mi parte':'Comprobar el mecanismo'));send.type='submit';
      if(stage.ready===false){send.disabled=true;form.append(el('p','mansion-reference','Completa primero las manipulaciones del escenario en ambas casas.'));}
      const note=el('p','mansion-status');note.setAttribute('role','status');note.tabIndex=-1;
      form.append(send,note);
      form.addEventListener('submit',event=>{
        event.preventDefault();
        if(stage.ready===false)return;
        const names=fields.map(field=>field.id);
        const answers=Object.fromEntries(names.map(id=>[id,draft[id]]));
        const valid=window.MotorAventuras?.intentoValido?.({tipo:'campos',campos:names},answers)
          ?? names.every(id=>typeof answers[id]==='string'&&answers[id].trim());
        if(!valid){
          const missing=fields.find(field=>!String(answers[field.id]??'').trim());
          note.textContent=missing?'Falta ajustar '+missing.label+'.':'Revisa el ajuste del mecanismo.';
          note.focus();return;
        }
        submit(answers);
      });
      box.append(form);
    }
    return box;
  }
  window.MansionPuzzles=Object.freeze({render});
})();
