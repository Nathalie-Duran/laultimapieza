(() => {
  'use strict';
  const cases = {
    25: ['Gabinete del azogue', ['El calco de las puertas', 'La mesa del cristalero', 'El contador de la cámara', 'El resguardo de depósito', 'El registro de recepción'], ['doors','files','seconds','files','strip']],
    26: ['Archivo de la verbena', ['La vuelta al carrusel', 'El armario de rollos', 'Las pantallas del puesto', 'La caja de billetes', 'El rollo de la taquillera'], ['mirror','files','files','files','strip']],
    27: ['Cabina del proyeccionista', ['El circuito de la sombra','El carro de placas','El guardarropa','La pizarra de sincronía','La empalmadora'], ['files','wheel','files','seconds','strip']],
    28: ['Mesa de la estafeta', ['El cuño de noviembre','La lámina traslúcida','El reparto de la saca','La carta reparada','El buzón de la estatua'], ['stamp','files','strip','files','files']],
    29: ['Lavadero de guardia', ['Las siluetas en la cal','La prueba del agua','El torno del lavadero','El recibo de secado','Los relojes del refugio'], ['files','waterway','strip','files','clock']],
    30: ['Cabina del repetidor', ['El calendario de emisiones','La centralita de líneas','La cinta cortada','Las dos escuchas','La hoja de turnos'], ['files','patchbay','strip','files','files']],
    31: ['Taller de miniaturas', ['La regla de la maquetista','El alzado de la calle','El reloj del taller','Las capas del edificio','La caja de custodia'], ['scale','files','clock','strip','files']],
    32: ['Puesto de señales del Tejo', ['El reloj del telégrafo','El croquis de ecos','La mesa de equipajes','La hoja de marcha','Los sellos de tránsito'], ['train','files','files','clock','files']],
    33: ['Banco del invernadero', ['El banco de dos caras','Las fichas de herbario','La libreta de riegos','Las hojas de la agenda','El inventario de la entrega'], ['mirror','files','files','files','files']],
    34: ['Taller del campanero', ['El calco de la esquila','Las dos pistas de campanas','El ensayo del reflector','El turno de vísperas','La inspección del martillo'], ['files','seconds','echo','strip','files']],
    35: ['El brocal del aljibe', ['El nivel del conducto','El calco acústico','El carrete de copias','El relevo de las vecinas','Los sobres de control'], ['depth','files','files','strip','files']],
    36: ['Archivo del padrón', ['El puesto de la silla','Los pliegos certificados','El registro de custodias','La mesa de sellado','La hoja que falta'], ['files','files','custody','strip','files']]
  };
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function button(label, action, className) {
    const control = node('button', label, className);
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }
  function visible(material, role) {
    const side = { A:'A', B:'B', 1:'A', 2:'B' };
    return !side[role] || !side[material.role] || side[role] === side[material.role];
  }
  const getBody = material => typeof material?.body === 'string' ? material.body : '';
  const split = material => getBody(material).split(/\r?\n+/).map(line => line.trim()).filter(Boolean);
  const table = materials => materials.flatMap(split).filter(line => line.includes('|')).map(line => line.split('|').map(cell => cell.trim()));
  const quote = (mats, regex) => mats.find(m => regex.test(m.label));
  const announce = () => {
    const message = node('p', '', 'tj-readout');
    message.setAttribute('role', 'status');
    return message;
  };
  function input(label, type, value, min, max, step) {
    const wrap = node('label', label, 'tj-input');
    const control = node('input');
    control.type = type; control.value = value;
    if (min != null) control.min = min;
    if (max != null) control.max = max;
    if (step != null) control.step = step;
    wrap.append(control);
    return {wrap, control};
  }
  function paper(label, body) {
    const slip = node('div', null, 'tj-slip');
    slip.append(node('strong', label), node('span', body));
    return slip;
  }
  function evidenceBench(mats) {
    const panel = node('details', null, 'tj-notebook');
    panel.append(node('summary', 'Comparar fragmentos de mis pruebas'));
    const panelContent = node('div', null, 'tj-notebook-body');
    const cards = node('div', null, 'tj-pins'), selector = node('select');
    const materialSelect = node('label', 'Documento', 'tj-input');
    materialSelect.append(selector);
    for (const mat of mats) selector.append(new Option(mat.label, String(selector.options.length)));
    const passage = node('select'), passageLabel = node('label', 'Fragmento', 'tj-input');
    passageLabel.append(passage);
    const sample = node('p', '', 'tj-quote'), picks = [];
    const dots = node('div', null,'tj-pin-actions');
    const note = announce();
    function show() {
      const material = mats[Number(selector.value)];
      const raw = split(material);
      const lines = raw.length > 1 ? raw : (raw[0]?.split(/(?<=[.!?])\s+(?=[«¿¡A-ZÁÉÍÓÚÑ])/u) || raw);
      passage.replaceChildren(...lines.map((line,i) => new Option(String(i+1), line.trim())));
      sample.textContent = passage.value;
    }
    for (let i=0; i<2; i++) dots.append(button('Fijar en '+(i===0?'la izquierda':'la derecha'), () => {
      if (!passage.value) return;
      picks[i] = [mats[Number(selector.value)].label, passage.value];
      cards.replaceChildren(...Array.from({length:2}, (_,j) => picks[j] ? paper(...picks[j]) : paper('Espacio libre','Fija otro fragmento para cotejarlos.')));
      note.textContent='Fragmento fijado '+(i===0?'a la izquierda.':'a la derecha.');
    }));
    selector.addEventListener('change', show); passage.addEventListener('change', () => sample.textContent=passage.value);
    show();
    const selection=node('div',null,'tj-instrument-controls'); selection.append(materialSelect,passageLabel);
    panelContent.append(selection,sample,dots,cards,note);panel.append(panelContent);return panel;
  }
  function doors(mats) {
    const rows = table(mats).filter(row => /^\d+$/.test(row[0]) && row.length===4);
    if (!rows.length) return null;
    const box=node('div',null,'tj-tool'), rack=node('div',null,'tj-door-rack'), detail=announce();
    box.append(node('p','Abre una puerta del calco para examinar sus bisagras, su ventana y el zócalo.','tj-instruction'));
    for (const [number,hinge,view,mark] of rows) {
      const b=button('Puerta '+number, () => {
        for(const item of rack.children)item.setAttribute('aria-pressed',String(item===b));
        detail.textContent='Puerta '+number+' · Bisagras a la '+hinge+' · Ventana al '+view+' · Zócalo con '+mark+'.';
      },'tj-door');
      b.dataset.hinge=hinge;b.dataset.mark=mark;b.setAttribute('aria-pressed','false');rack.append(b);
    }
    box.append(rack,detail);return box;
  }
  function mirror(mats, garden) {
    const photo=quote(mats, garden?/Foto desde dentro/i:/Copia del escaparate/i);
    const pieces=[...getBody(photo).matchAll(/\[([^\]]+)\]/g)].map(x=>x[1]);
    if(!pieces.length)return null;
    const box=node('div',null,'tj-tool'),rack=node('ol',null,'tj-track'),note=announce();
    const face=garden?'Desde el invernadero':'Imagen del escaparate', other=garden?'Desde el exterior':'Orden sin reflejo';
    let flipped=false;
    const flip=button(garden?'Mirar desde el otro lado':'Dar la vuelta a la copia',()=>{flipped=!flipped;paint();});
    function paint(){
      rack.replaceChildren(...(flipped?[...pieces].reverse():pieces).map(name=>node('li',name)));
      note.textContent=flipped?other:face;flip.setAttribute('aria-pressed',String(flipped));
    }
    box.append(node('p',garden?'Gira el banco para comparar el punto de vista de ambas caras del cristal.':'Invierte el escaparate para reconstruir la disposición de sus anclajes.','tj-instruction'),rack,flip,note);paint();return box;
  }
  function wheel(mats) {
    const stock=quote(mats,/Carro visto/i);
    const pieces=[...getBody(stock).matchAll(/\[([^\]]+)\]/g)].map(x=>x[1]);
    if(!pieces.length)return null;
    const box=node('div',null,'tj-tool'),rack=node('div',null,'tj-wheel'),note=announce(),buttons=node('div',null,'tj-instrument-controls');
    let i=0;
    function paint(){rack.textContent=pieces[i];note.textContent='Placa en la ventanilla · '+pieces[i];}
    for(const [step,label] of [[-1,'Girar en sentido antihorario'],[1,'Girar en sentido horario']])buttons.append(button(label,()=>{i=(i+step+pieces.length)%pieces.length;paint();}));
    box.append(node('p','Sitúa en la ventanilla la placa de partida. Mueve el carro un paso por pulsación.','tj-instruction'),rack,buttons,note);paint();return box;
  }
  function stamp(mats) {
    const archive=quote(mats,/Archivo filatélico/i), specimen=quote(mats,/Ampliación del cuño/i);
    if(!archive&&!specimen)return null;
    const box=node('div',null,'tj-tool'),body=node('div',null,'tj-instrument-controls'),viewer=node('div',null,'tj-stamp-view');
    if(specimen) {
      viewer.append(node('strong','14 NOV'),node('span',getBody(specimen)));
      const zoom=button('Ampliar la impronta',()=>{const active=viewer.classList.toggle('is-zoomed');zoom.setAttribute('aria-pressed',String(active));});
      zoom.setAttribute('aria-pressed','false');body.append(zoom);
    }
    if(archive){
      const strip=node('div',null,'tj-tabs'), note=announce();
      for(const [year,...details] of table([archive]))strip.append(button(year,()=>{note.textContent=year+' · '+details.join(' · ');}));
      body.append(strip,note);
    }
    box.append(node('p','Examina las marcas disponibles en tus fuentes y coteja los años de circulación.','tj-instruction'),viewer,body);return box;
  }
  function waterway(mats) {
    const map=quote(mats,/Canaletas/i),paths=split(map).map(x=>x.split('→').map(v=>v.trim())).filter(x=>x.length===3);
    if(!paths.length)return null;
    const box=node('div',null,'tj-tool'),buttons=node('div',null,'tj-instrument-controls'),rack=node('ol',null,'tj-track'),note=announce();
    for(const path of paths)buttons.append(button(path[0],()=>{
      rack.replaceChildren(...path.map(p=>node('li',p)));note.textContent='Recorrido del plano · '+path.join(' → ')+'.';
    }));
    box.append(node('p','Abre una toma para seguir el recorrido pintado. Aplica después los desvíos del libro de guardia.','tj-instruction'),buttons,rack,note);return box;
  }
  function clock(mats, kind){
    const seconds=kind==='seconds',box=node('div',null,'tj-tool');
    const label=seconds?'Desfase en segundos':'Desfase en minutos', source=mats.flatMap(split).join(' ');
    const match=source.match(/\b([012]\d):([0-5]\d)(?::([0-5]\d))?/);
    const start=input('Lectura de origen','time',match?match[1]+':'+match[2]+(seconds?':'+(match[3]||'00'):''):(seconds?'00:00:00':'00:00'),null,null,seconds?1:60);
    const adjustment=input(label,'number','0',seconds?-3600:-1440,seconds?3600:1440,1),note=announce();
    function tick(){
      const parts=start.control.value.split(':').map(Number), offset=Number(adjustment.control.value);
      if(!start.control.value||!adjustment.control.validity.valid||!adjustment.control.value||!Number.isFinite(offset)){note.textContent='Introduce la hora y el desfase.';return;}
      const t=(((parts[0]*3600+parts[1]*60+(parts[2]||0)+offset*(seconds?1:60))%86400)+86400)%86400;
      note.textContent='Lectura corregida · '+[Math.floor(t/3600),Math.floor(t%3600/60),...(seconds?[t%60]:[])].map(n=>String(n).padStart(2,'0')).join(':');
    }
    const controls=node('div',null,'tj-instrument-controls');
    controls.append(start.wrap,adjustment.wrap);
    start.control.addEventListener('input',tick);adjustment.control.addEventListener('input',tick);
    box.append(node('p','Ajusta la lectura de origen y su desfase para contrastar los registros.','tj-instruction'),controls,note);
    tick();return box;
  }
  function patchbay(mats){
    const box=clock(mats,'clock'),ab=quote(mats,/Factura de conexión/i);
    const names=[...new Set(getBody(ab).match(/L\d+/g)||[])];
    const windows=new Map(table(mats).filter(r=>/^L\d+$/.test(r[0])).map(r=>[r[0],r[1]]));
    if(!names.length)return box;
    const rack=node('div',null,'tj-patchbay'),note=announce();
    for(const name of names){
      const b=button(name,()=>{
        for(const other of rack.children)other.setAttribute('aria-pressed',String(other===b));
        note.textContent='Clavija en '+name+' · '+(windows.get(name)||'La factura solo identifica la extensión. Contrasta su horario con la centralita.');
      },'tj-socket');
      b.setAttribute('aria-pressed','false');rack.append(b);
    }
    box.append(node('p','Cambia la clavija para comprobar una extensión. Compara su ventana con el momento de la llamada.','tj-instruction'),rack,note);return box;
  }
  function fogWindow(mats){
    const box=node('div',null,'tj-tool'),controls=node('div',null,'tj-instrument-controls'),track=node('div',null,'tj-specimens');
    const start=input('Comienzo del claro','time','00:00'),end=input('Fin del claro','time','00:00'),offset=input('Desfase del telégrafo (minutos)','number','0',-1440,1440,1),note=announce();
    const trains=table(mats).filter(r=>/^Tren /i.test(r[0])&&/\d\d:\d\d/.test(r[1]));
    const mins=v=>{const [h,m]=v.split(':').map(Number);return h*60+m;};
    const stamp=m=>[Math.floor(m/60),m%60].map(n=>String(n).padStart(2,'0')).join(':');
    function adjust(){
      track.replaceChildren();
      if(!start.control.value||!end.control.value||!offset.control.value||!offset.control.validity.valid){note.textContent='Introduce los dos extremos y la diferencia entre relojes.';return;}
      const shift=Number(offset.control.value),first=(mins(start.control.value)+shift+1440)%1440,last=(mins(end.control.value)+shift+1440)%1440;
      note.textContent='Ventana en hora civil · '+stamp(first)+' a '+stamp(last)+'.';
      for(const [name,value] of trains){
        const t=mins(value.match(/\d\d:\d\d/)[0]);const visible=first<=last?(first<=t&&t<=last):(t>=first||t<=last);
        const slip=paper(name,value+' · '+(visible?'Dentro del claro':'Fuera del claro'));slip.dataset.inWindow=String(visible);track.append(slip);
      }
    }
    controls.append(start.wrap,end.wrap,offset.wrap);
    box.append(node('p','Delimita el claro observado y aplica el desfase del telégrafo para compararlo con el paso de los trenes.','tj-instruction'),controls,note,track);
    for(const control of [start,end,offset])control.control.addEventListener('input',adjust);adjust();return box;
  }
  function scale(mats) {
    const rows=table(mats).filter(r=>/^\d+ modelo/.test(r[1]) && /^\d+ edificio/.test(r[2]));
    if(!rows.length)return null;
    const box=node('div',null,'tj-tool'), selection=node('select'), label=node('label','Pieza de la maqueta','tj-input'), rule=input('Factor de la regla','number','1',1,1000,1),note=announce();
    rows.forEach((r,i)=>selection.append(new Option(r[0],i)));
    function measure(){const r=rows[Number(selection.value)],factor=Number(rule.control.value);note.textContent=rule.control.validity.valid&&factor?'Según tu regla · '+parseFloat(r[1])*factor+' cm. Medición del edificio · '+parseFloat(r[2])+' cm.':'Introduce un factor de escala.';}
    label.append(selection);const controls=node('div',null,'tj-instrument-controls');controls.append(label,rule.wrap);
    box.append(node('p','Elige una pieza y prueba un factor para convertir la medida de la maqueta en centímetros reales.','tj-instruction'),controls,note);
    selection.addEventListener('change',measure);rule.control.addEventListener('input',measure);measure();return box;
  }
  function echo(mats) {
    const map=quote(mats,/Croquis del reflector/i),rows=table(map?[map]:[]),box=node('div',null,'tj-tool');
    if(!rows.length)return null;
    const sound=input('Segundos de los golpes, separados por espacios','text',''), candidates=node('div',null,'tj-tabs'),note=announce();
    for(const [name,text] of rows) {
      const gap=Number(text.match(/(?:tras|después de) (\d+)\s*s/i)?.[1]);if(!gap)continue;
      candidates.append(button('Probar '+name,()=>{
        const beats=sound.control.value.trim().split(/[\s,]+/).map(Number);
        if(!sound.control.value.trim()||beats.some(x=>!Number.isFinite(x)||x<0)||beats.length>24){note.textContent='Introduce de uno a veinticuatro instantes en segundos.';return;}
        const chosen=/tercer/i.test(text)?beats.slice(2,3):/primer/i.test(text)?beats.slice(0,1):beats;
        note.textContent='Retornos simulados · '+(chosen.length?chosen.map(x=>(x+gap)+' s').join(' · '):'Ninguno');
      }));
    }
    if(!candidates.childElementCount)return null;
    box.append(node('p','Introduce los golpes directos de la plaza y aplica por separado cada reflector del croquis.','tj-instruction'),sound.wrap,candidates,note);return box;
  }
  function depth(mats) {
    const sketch=quote(mats,/Sección del aljibe/i);
    const mouths=[...getBody(sketch).matchAll(/(?:de |del )?(cocina|telar|patio) a (\d+[,.]\d+)\s*m/gi)].map(m=>[m[1],Number(m[2].replace(',','.'))]);
    if(!mouths.length)return null;
    const box=node('div',null,'tj-tool'),level=input('Nivel del agua en metros','number','0',0,10,0.1),bar=node('div',null,'tj-ducts'),note=announce();
    function test(){
      const n=Number(level.control.value);
      if(!level.control.value||!level.control.validity.valid){note.textContent='Introduce un nivel entre 0 y 10 m.';bar.replaceChildren();return;}
      bar.replaceChildren(...mouths.map(([name,height])=>paper(name+' · '+height.toLocaleString('es-ES')+' m',n>=height?'Bajo el agua':'Por encima del agua')));
      note.textContent='Nivel del ensayo · '+n.toLocaleString('es-ES')+' m.';
    }
    box.append(node('p','Sube el agua hasta la altura indicada en el parte. Comprueba también el estado de las compuertas.','tj-instruction'),level.wrap,bar,note);
    level.control.addEventListener('input',test);test();return box;
  }
  function custody(mats) {
    const rows=table(mats).filter(r=>r.length===4&&!/entrega/i.test(r[1]));
    if(!rows.length)return null;
    const box=node('div',null,'tj-tool'),tags=node('div',null,'tj-tabs'),track=node('ol',null,'tj-track'),note=announce();
    for(const [color,from,to,sign] of rows)tags.append(button(color,()=>{
      track.replaceChildren(...[from,to,sign].map(v=>node('li',v)));note.textContent='Entrega · '+from+'. Recibe · '+to+'. Marca · '+sign+'.';
    }));
    box.append(node('p','Saca una hoja de su carpeta. Sigue la entrega hasta la firma para deducir cuándo cambia la marca.','tj-instruction'),tags,track,note);return box;
  }
  function ledgerLab(mats) {
    const sources=mats.map(material=>({material,rows:table([material])})).filter(record=>record.rows.length>=2);
    if(!sources.length)return null;
    const box=node('div',null,'tj-tool'),controls=node('div',null,'tj-instrument-controls'),result=node('div',null,'tj-specimens');
    const list=node('select'),sourceLabel=node('label','Registro','tj-input'),column=node('select'),colLabel=node('label','Agrupar por','tj-input');
    const note=announce();sourceLabel.append(list);colLabel.append(column);
    sources.forEach(({material},i)=>list.append(new Option(material.label,i)));
    function paint(){
      const {rows}=sources[Number(list.value)],key=Number(column.value);
      const groups=new Map();
      for(const row of rows){
        const val=row[key];
        if(!val)continue;
        if(!groups.has(val))groups.set(val,[]);
        groups.get(val).push(row.filter((_,i)=>i!==key).join(' · '));
      }
      result.replaceChildren(...Array.from(groups,([name,other])=>paper(name,other.join('\n'))));
      note.textContent=groups.size+(groups.size===1?' grupo de anotaciones.':' grupos de anotaciones.');
    }
    function source(){
      const {rows}=sources[Number(list.value)],size=Math.min(6,...rows.map(r=>r.length));
      column.replaceChildren(...Array.from({length:size},(_,i)=>new Option('Columna '+(i+1),i)));
      paint();
    }
    list.addEventListener('change',source);column.addEventListener('change',paint);
    controls.append(sourceLabel,colLabel);
    box.append(node('p','Reúne las anotaciones por una misma columna para detectar coincidencias y repeticiones.','tj-instruction'),controls,result,note);source();return box;
  }
  function opticsLab(mats){
    const plates=mats.flatMap(material=>split(material).flatMap(line=>line.split(/\s+(?:·|\/)(?=\s)/)).map(line=>{
      const marks=[...line.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
      return {label:line.split('[')[0].trim().replace(/[:·]$/,'' )||material.label,marks};
    }).filter(plate=>plate.marks.length));
    if(!plates.length)return null;
    const box=node('div',null,'tj-tool'),clips=node('div',null,'tj-tabs'),contact=node('div',null,'tj-specimens'),note=announce(),selected=new Set();
    plates.forEach((plate,i)=>{
      const b=button(plate.label,()=>{
        if(selected.has(i))selected.delete(i);
        else if(selected.size<2)selected.add(i);
        else{note.textContent='Retira una ampliación para colocar otra.';return;}
        b.setAttribute('aria-pressed',String(selected.has(i)));
        contact.replaceChildren(...Array.from(selected,j=>paper(plates[j].label,plates[j].marks.join(' · '))));
        note.textContent=selected.size+' de 2 ampliaciones en el visor.';
      });b.setAttribute('aria-pressed','false');clips.append(b);
    });
    box.append(node('p','Lleva dos ampliaciones al visor y coteja sus marcas. Tócalas otra vez para retirarlas.','tj-instruction'),clips,contact,note);return box;
  }
  function traceLab(mats){
    const paths=mats.flatMap(material=>split(material).flatMap(line=>line.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/u)).filter(line=>line.includes('→')).map(line=>line.split('→').map(p=>p.trim())));
    if(!paths.length)return null;
    const box=node('div',null,'tj-tool'),buttons=node('div',null,'tj-tabs'),track=node('ol',null,'tj-track'),note=announce();
    for(const parts of paths)buttons.append(button(parts[0],()=>{
      track.replaceChildren(...parts.map(p=>node('li',p)));note.textContent=parts.join(' → ');
    }));
    box.append(node('p','Elige el origen de un recorrido para seguir todas las conexiones dibujadas en tu documento.','tj-instruction'),buttons,track,note);return box;
  }
  function counterLab(unit) {
    const box=node('div',null,'tj-tool'), controls=node('div',null,'tj-instrument-controls'),note=announce();
    const origin=input('Lectura de origen ('+unit+')','number','0',0,999999,1),offset=input('Desfase ('+unit+')','number','0',-999999,999999,1);
    function move(){const valid=origin.control.validity.valid&&offset.control.validity.valid&&origin.control.value&&offset.control.value;
      note.textContent=valid?'Lectura corregida · '+(Number(origin.control.value)+Number(offset.control.value))+' '+unit+'.':'Completa las dos lecturas.';}
    controls.append(origin.wrap,offset.wrap);box.append(node('p','Traslada la lectura entre las dos pistas aplicando el desfase que calcules.','tj-instruction'),controls,note);
    origin.control.addEventListener('input',move);offset.control.addEventListener('input',move);move();return box;
  }
  const tools={doors,mirror,wheel,stamp,waterway,clock,patchbay,train:fogWindow,seconds:clock,scale,echo,depth,custody};
  function hypothesis(stage, selected, change, count) {
    const box=node('div',null,'tj-hypothesis'),tray=node('div',null,'tj-card-tray'),result=node('div',null,'tj-placement'),note=announce();
    const order=stage.mode==='order',multi=stage.mode==='multi',buttons=new Map();
    const label=order?'Montaje de la secuencia':multi?'Indicios para el informe':'Tu conclusión';
    box.append(node('h5',label),node('p',order?'Coloca las piezas en orden. Usa las flechas para corregir su posición.':multi?'Coloca los indicios que se sostienen juntos. Toca de nuevo una ficha para retirarla.':'Escoge la hipótesis que respaldan tus pruebas. Puedes cambiarla antes de contrastar.','tj-instruction'));
    function paint(focusId,action){
      result.replaceChildren();
      if(order||multi) for(const [position,id] of selected.entries()){
        const option=stage.options.find(o=>o.id===id),row=node('div',null,'tj-placed');
        row.append(node('span',order?String(position+1):'✓','tj-seal'),node('span',option.label));
        const controls=node('div',null,'tj-piece-actions');
        function move(delta){[selected[position],selected[position+delta]]=[selected[position+delta],selected[position]];paint(id,delta<0?'up':'down');}
        if(order)for(const [delta,mark,verb,key] of [[-1,'↑','Adelantar','up'],[1,'↓','Retrasar','down']]){
          const b=button(mark,()=>move(delta));b.disabled=position+delta<0||position+delta>=selected.length;b.setAttribute('aria-label',verb+' '+option.label);b.dataset.move=key;controls.append(b);
        }
        const remove=button('×',()=>{selected.splice(position,1);paint();buttons.get(id)?.focus();});
        remove.setAttribute('aria-label','Retirar '+option.label);controls.append(remove);row.append(controls);row.dataset.tjPiece=id;result.append(row);
      }
      for(const [id,b] of buttons){
        const index=selected.indexOf(id);b.setAttribute('aria-pressed',String(index>=0));
        b.firstChild.textContent=index>=0?(order?String(index+1):'✓'):'';
      }
      note.textContent=order||multi?selected.length+(count?' de '+count:'')+(order?' piezas colocadas.':' indicios seleccionados.'):selected.length?'Hipótesis elegida.':'Elige una hipótesis.';
      change();
      if(focusId){const row=[...result.children].find(r=>r.dataset.tjPiece===focusId);(row?.querySelector('[data-move="'+action+'"]:not(:disabled)')||row?.querySelector('button:not(:disabled)'))?.focus();}
    }
    for(const option of stage.options){
      const b=button('',()=>{
        const index=selected.indexOf(option.id);
        if(order||multi){
          if(index>=0)selected.splice(index,1);
          else if(!count||selected.length<count)selected.push(option.id);
          else{note.textContent='Retira una ficha antes de colocar otra.';return;}
        }else selected.splice(0,selected.length,option.id);
        paint();
      },'tj-choice');
      const seal=node('span','','tj-choice-mark');seal.setAttribute('aria-hidden','true');
      b.append(seal,node('span',option.label));b.dataset.vhValue=option.id;b.setAttribute('aria-label',option.label);buttons.set(option.id,b);tray.append(b);
    }
    box.append(tray,result,note);paint();return box;
  }
  function mount({field,stage,index,caseId,role,selected,change}) {
    const data=cases[caseId];
    if(!data||!data[1][index]||!Array.isArray(stage.options)||!stage.options.length)return false;
    const mats=(stage.materials||[]).filter(m=>visible(m,role));
    const box=node('div',null,'tj-desk'),hero=node('header',null,'tj-hero'),head=node('div',null,'tj-head');
    const art=node('img');art.alt='';art.src='/tercer-objeto-'+caseId+'.webp';art.addEventListener('error',()=>{if(!art.src.endsWith('/mundo-'+caseId+'.webp'))art.src='/mundo-'+caseId+'.webp';},{once:true});
    head.append(node('span',data[0]),node('h4',data[1][index]));hero.append(art,head);box.append(hero);
    const kind=data[2][index],tool=tools[kind];
    let panel;
    if(Number(caseId)===27&&index===3)panel=counterLab('fotogramas');
    else if(Number(caseId)===34&&index===1)panel=counterLab('segundos');
    else if(tool)panel=kind==='mirror'?tool(mats,Number(caseId)===33):tool(mats,kind);
    else if(kind==='files')panel=traceLab(mats)||opticsLab(mats)||ledgerLab(mats);
    if(panel)box.append(panel);
    if(mats.length){const notebook=evidenceBench(mats);notebook.open=!panel&&kind!=='strip';box.append(notebook);}
    const count=Number(stage.requiredCount)||(stage.mode==='order'?(Number(caseId)===30&&index===2?4:3):stage.mode==='multi'?2:1);
    field.dataset.requiredChoices=String(count);field.dataset.vhPrueba='tercer-jugador-'+caseId+'-'+(index+1);
    box.append(hypothesis(stage,selected,change,count));box.dataset.tjKind=kind;
    field.append(box);return true;
  }
  window.MesasDeCaso ||= {};
  for(const id of Object.keys(cases))window.MesasDeCaso[id]=mount;
})();
