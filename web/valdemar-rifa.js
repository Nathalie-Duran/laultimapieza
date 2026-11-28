(() => {
  'use strict';
  const names=['peonza','golondrina','ancla','caracol','llave','liebre','molino','botón','uva','lazo','farol','nube','azulejo','pera','bota','faro'];
  const pieces=['alfil','caballo','torre','peón'];
  const catalog=['mesa','neg','peon','onda','tiras','marca','reglas','valores','variantes','papeletas','descanso','cora','copias','editor'];
  const el=(tag,cls,txt)=>{
    const node=document.createElement(tag);if(cls)node.className='rifa-'+cls;if(txt)node.textContent=txt;return node;
  };
  function btn(cls,txt,action){const node=el('button',cls,txt);node.type='button';node.addEventListener('click',action);return node;}
  const fold=(v)=>String(v||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const coord=(p)=>String.fromCharCode(65+p%4)+(1+Math.floor(p/4));
  const publicFile=(m,role)=>m&&(!role||!['A','B'].includes(role)||!m.role||m.role==='AB'||m.role===role||m.role===(role==='A'?1:2));
  function icon(name){
    const i=names.findIndex(n=>fold(n)===fold(name)),p=pieces.findIndex(n=>fold(n)===fold(name)),span=el('span','icon');
    span.setAttribute('aria-hidden','true');
    if(i>=0 || p>=0){
      const index=i>=0?i:p,side=i>=0?4:2;span.dataset.sheet=i>=0?'simbolos':'piezas';
      span.style.backgroundPosition=(index%side/(side-1)*100)+'% '+(Math.floor(index/side)/(side-1)*100)+'%';
    }
    return span;
  }
  function line(root,text){const node=el('p','caption',text);root.append(node);return node;}
  function tokens(text,list){
    const clean=fold(text);
    return list.filter(word=>new RegExp('(?:^|[^a-z])'+fold(word)+'(?:$|[^a-z])').test(clean));
  }
  function notice(text){const n=el('p','readout',text);n.setAttribute('role','status');n.setAttribute('aria-atomic','true');return n;}
  function medal(name,sub){
    const wrap=el('div','medal');wrap.append(icon(name),el('strong',null,name));if(sub)wrap.append(el('small',null,sub));return wrap;
  }
  function grid(m){
    const visual=el('div','board-reader'),official=m.id==='mesa',rotation=!official;
    const board=el('div','board'),plate=el('div','board-frame'),tools=el('div','tools'),details=notice('');
    const zoom=el('div','enlarged');
    board.setAttribute('role','group');board.setAttribute('aria-label',official?'Tablero oficial de dieciséis casillas':'Positivo tal como se imprimió en el periódico');
    plate.append(board);visual.append(plate,tools,zoom,details);
    const description=official?'Toca una casilla para ampliar su dibujo y leer su coordenada.':'La fotografía conserva dos dibujos legibles, un doblez y un punto de registro. Puedes girar el papel sobre la mesa.';
    const positions=new Map();
    if(official){
      // La etiqueta se toma de esta prueba; el atlas sólo traduce nombres de objetos en imágenes.
      for(const match of m.body.matchAll(/\b([A-D])([1-4])\s+([\p{L}]+)/gu)){
        const p=(Number(match[2])-1)*4+match[1].charCodeAt(0)-65;
        positions.set(p,match[3]);
      }
    }else{
      // Sólo las dos marcas que el reverso autoriza conocer en el papel del fotógrafo.
      if(/faro/i.test(m.body))positions.set(0,'faro');
      if(/peonza/i.test(m.body))positions.set(15,'peonza');
    }
    let turns=0,active=-1;
    const slots=Array.from({length:16},(_,p)=>{
      const label=positions.get(p),ref=!official&&p===5,crease=!official&&p===15;
      const tile=btn('tile','',()=>inspect(p));
      tile.dataset.square=String(p);tile.setAttribute('aria-pressed','false');
      if(official)tile.append(el('span','coord',coord(p)));
      if(label){tile.append(icon(label));if(official)tile.append(el('span','tile-label',label));}
      else if(!ref){const blur=el('span','ghost');blur.setAttribute('aria-hidden','true');tile.append(blur);}
      if(ref){tile.dataset.register='true';const dot=el('span','register');dot.setAttribute('aria-hidden','true');tile.append(dot);}
      if(crease)tile.dataset.crease='true';
      tile.setAttribute('aria-label',official?coord(p)+', '+(label||'sin identificación'):'Fila '+(1+Math.floor(p/4))+', columna '+(1+p%4)+' en la copia original. '+(label||'Dibujo ilegible')+(ref?'. Punto de registro':'')+(crease?'. Esquina doblada':''));
      tile.addEventListener('keydown',e=>{
        const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4},d=deltas[e.key];
        if(d===undefined)return;
        const order=[...board.children],at=order.indexOf(tile),next=order[at+d];
        if(next && (Math.abs(d)===4||Math.floor(at/4)===Math.floor((at+d)/4))){e.preventDefault();next.focus();}
      });
      return tile;
    });
    function rotateIndex(p,turn){
      let x=p%4,y=Math.floor(p/4);
      while(turn--){[x,y]=[3-y,x];}
      return 4*y+x;
    }
    function inspect(p){
      active=p;slots.forEach((s,j)=>s.setAttribute('aria-pressed',String(j===active)));
      const name=positions.get(p);
      zoom.replaceChildren();
      if(name)zoom.append(icon(name));
      const loc=rotateIndex(p,turns),place='fila '+(Math.floor(loc/4)+1)+', columna '+(loc%4+1);
      const words=official?coord(p)+' · '+(name||'Dibujo ilegible'):p===5?'Punto de registro':p===15?'Esquina doblada · '+(name||'dibujo ilegible'):name||'Emulsión ilegible';
      zoom.append(el('strong',null,words));details.textContent=official?'Tablero oficial, '+place+'.':'En la posición actual del papel, '+place+'.';
    }
    function paint(){
      const sorted=slots.map((tile,i)=>[rotateIndex(i,turns),tile]).sort((a,b)=>a[0]-b[0]);board.replaceChildren(...sorted.map(item=>item[1]));
      plate.dataset.turn=String(turns);plate.dataset.paper=official?'tablero':'positivo';
      if(active>=0)inspect(active);else details.textContent=description+(rotation&&turns?' Giro acumulado de '+(turns*90)+' grados.':'');
    }
    if(rotation){
      tools.append(btn('tool','Girar el positivo 90°',()=>{turns=(turns+1)%4;paint();}),btn('tool','Restablecer la orientación',()=>{turns=0;active=-1;zoom.replaceChildren();slots.forEach(t=>t.setAttribute('aria-pressed','false'));paint();}));
    }
    paint();return visual;
  }
  function beats(text){
    const wrap=el('div','beats');wrap.setAttribute('role','img');wrap.setAttribute('aria-label',text);
    const clean=fold(text).replace(/dos golpes(?: seguidos)?/g,'golpe golpe'),marks=clean.match(/campana(?:da)?|golpe|clic/g)||[];
    for(const mark of marks){const hit=el('span','beat');hit.dataset.sound=mark.startsWith('campana')?'campana':mark;hit.append(el('i'),el('small',null,mark));wrap.append(hit);}return wrap;
  }
  function soundProof(m){
    const root=el('div','shelf-paper');
    // La grabación real y su transcripción permanecen en el reproductor original.
    if(m.id==='onda'){line(root,'Marcas audibles desde el comienzo de la cinta');root.append(beats(m.body.split('El árbitro')[0]));}
    else if(m.id==='peon'){
      const paper=el('div','turn-paper'),sheet=el('div','paper-hinge','Hoja de ensayo');sheet.dataset.angle='0';
      const status=notice('Esquina doblada arriba a la izquierda en esta hoja de ensayo.');
      let t=0;paper.append(sheet);root.append(paper,btn('tool','Girar hoja de ensayo',()=>{t=(t+1)%4;sheet.style.transform='rotate('+t*90+'deg)';status.textContent='Esquina doblada '+['arriba a la izquierda','arriba a la derecha','abajo a la derecha','abajo a la izquierda'][t]+'.';}),status);
    }else{
      line(root,'Tres tiras que compara el presidente');
      const strips=[['I','B2 → A3','golpe, golpe, clic'],['II','C2 → A1','golpe, clic, golpe'],['III','B2 → C1','golpe, clic, golpe']];
      strips.forEach(([n,coords,sound])=>{if(m.body.includes(coords.split(' → ')[0])){const row=el('div','strip');row.append(el('strong',null,'Tira '+n+' · '+coords),beats(sound));root.append(row);}});
    }
    return root;
  }
  function receipts(m){
    const r=el('div','receipt-grid');
    for(const row of m.body.split('\n')){
      const a=row.split('|').map(s=>s.trim());if(a.length<2||/momento/i.test(a[0]))continue;
      const slip=el('div','receipt'),all=tokens(row,pieces),symbol=tokens(row,names);
      slip.append(el('strong',null,a[0]));
      const band=el('div','sample-row');
      for(const word of [...all,...symbol])band.append(medal(word));
      if(band.children.length)slip.append(band);
      slip.append(el('span',null,a.slice(1).join(' · ')));r.append(slip);
    }
    return r;
  }
  function vitrine(m){
    const r=el('div','shelf-paper'),supports=el('div','case-slots'),info=notice('Examina una almohadilla de la vitrina.');
    for(const p of tokens(m.body,pieces)){
      const key=btn('specimen','',()=>{info.textContent='La almohadilla conserva una marca de base de '+p+'.';
        for(const n of supports.children)n.setAttribute('aria-pressed',String(n===key));
      });
      key.setAttribute('aria-pressed','false');key.append(icon(p),el('span',null,p));supports.append(key);
    }
    const sample=btn('sample-click','Casillero de ensayo',()=>{info.textContent='La etiqueta dice «clic». Este casillero carece de almohadilla.';for(const n of supports.children)n.setAttribute('aria-pressed','false');});
    r.append(supports,sample,info);return r;
  }
  function scoreboard(m){
    const r=el('div','shelf-paper'),form=el('div','counter'),digits=[];
    const certified=/\b8\b/.test(m.body)&&/\b12\b/.test(m.body);
    if(!certified)return r;
    line(r,'Tanteo de un turno · salida de 8 puntos, meta de 12');
    const out=notice('Introduce los puntos de ambas casillas y el coste de la pieza.');
    for(const word of ['Primera casilla','Segunda casilla','Coste de la pieza']){
      const label=el('label','counter-part',word),n=el('input');n.type='number';n.min='0';n.max='12';n.step='1';n.placeholder='0';n.inputMode='numeric';label.append(n);form.append(label);digits.push(n);
    }
    const update=()=>{if(!digits.every(n=>n.value!==''&&n.validity.valid)){out.textContent='Completa las tres cifras con valores entre 0 y 12.';return;}
      const [a,b,c]=digits.map(n=>Number(n.value));out.textContent='Tu ensayo · 8 + '+a+' + '+b+' − '+c+' = '+(8+a+b-c)+' puntos.';};
    digits.forEach(n=>n.addEventListener('input',update));r.append(form,out);return r;
  }
  function values(m){
    const r=el('div','shelf-paper');
    for(const lineText of m.body.split('\n').slice(0,2)){
      const [head,body]=lineText.split(':');if(!body)continue;
      r.append(el('strong',null,head));const shelf=el('div','values');
      for(const match of body.matchAll(/([\p{L}]+)\s+(\d+)/gu)){shelf.append(medal(match[1],match[2]+(match[2]==='1'?' punto':' puntos')));}
      r.append(shelf);
    }
    return r;
  }
  function strips(m){
    const r=el('div','shelf-paper');
    for(const lineText of m.body.split('\n').filter(line=>line.startsWith('Tira '))){
      const [n,frames,sound]=lineText.split('|').map(v=>v.trim()),row=el('div','strip');
      row.append(el('strong',null,n),el('span','frames',frames),beats(sound));r.append(row);
    }
    return r;
  }
  function note(m){
    const r=el('div','shelf-paper'),row=el('div','word-rail');
    line(r,'Cuaderno de Cora · ensaya la lectura desde la grada');
    for(let i=0;i<4;i++){const field=el('input');field.type='text';field.maxLength=1;field.setAttribute('aria-label','Inicial de la retirada '+(i+1));field.autocomplete='off';row.append(field);}
    r.append(row);return r;
  }
  function revision(m){
    const r=el('div','shelf-paper');
    for(const item of m.body.split('\n').slice(1)){
      const split=item.split(' · ');if(split.length<2)continue;
      const d=el('details','revision'),s=el('summary',null,split[0]);d.append(s);
      if(split[0]==='MARCADOR')d.append(scoreboard({body:item}));
      if(split[0]==='RIFA'){const rail=el('div','sample-row');for(const word of tokens(item,names))rail.append(medal(word));d.append(rail);}
      d.append(el('p',null,split.slice(1).join(' · ')));r.append(d);
    }
    return r;
  }
  const plans={mesa:grid,neg:grid,peon:soundProof,onda:soundProof,tiras:receipts,marca:vitrine,reglas:scoreboard,valores:values,variantes:receipts,papeletas:receipts,descanso:strips,cora:note,copias:revision,editor:soundProof};
  function create({stage,index,role,abrirDocumento,materialId}){
    const available=(stage?.materials||[]).filter(m=>publicFile(m,role)&&catalog.includes(m.id));
    const relevant=materialId?available.filter(m=>m.id===materialId):available;
    if(!relevant.length)return null;
    const section=el('section','viewer'),pane=el('div','pane'),menu=el('div','library'),actions=el('div','tools');
    const heading=el('h4','heading');
    if(!materialId){section.append(heading);if(relevant.length>1)section.append(menu);}
    section.append(pane,actions);
    let current;
    function select(m){
      current=m;section.dataset.evidence=m.id;heading.textContent=m.label;
      for(const b of menu.children)b.setAttribute('aria-pressed',String(b.dataset.id===m.id));
      pane.replaceChildren(plans[m.id](m));actions.replaceChildren();
      if(!materialId && typeof abrirDocumento==='function')actions.append(btn('tool','Abrir el documento completo',()=>abrirDocumento(current.id)));
    }
    if(!materialId&&relevant.length>1)for(const m of relevant){
      const b=btn('tab',m.label,()=>select(m));b.dataset.id=m.id;menu.append(b);
    }
    // Las dos primeras lecturas se abren directamente sobre su evidencia más gráfica.
    const preferred=[['mesa','neg','peon'],['marca','tiras','onda'],['valores','variantes','reglas'],['descanso','papeletas','cora'],['copias','editor']][index]||[];
    select(preferred.map(id=>relevant.find(m=>m.id===id)).find(Boolean)||relevant[0]);return section;
  }
  window.ValdemarRifa={crear:create};
  window.ArchivosDeCaso ||= {};
  window.ArchivosDeCaso[11]=({stage,index,role,shelf})=>{
    for(const card of shelf.querySelectorAll('details[data-material]')){
      const materialId=card.dataset.material;
      const node=create({stage,index,role,materialId});
      if(!node)continue;
      const title=card.querySelector('summary');
      if(!title)continue;
      if(materialId==='mesa'){
        const transcript=el('details','written'),summary=el('summary',null,'Leer las coordenadas en una tabla');
        transcript.append(summary,...[...card.children].filter(n=>n!==title));card.append(transcript);
      }
      title.after(node);
    }
  };
})();
