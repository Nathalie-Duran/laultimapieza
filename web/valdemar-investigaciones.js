(() => {
  'use strict';

  // Cada fila corresponde a la situación y a la acción de una etapa publicada.
  const cases = {
    5: { prop:'Instrumentos de puerto', stages:[
      ['Diario de navegación','Anota los hitos de la travesía en hora del puerto.','bitacora'],
      ['Copias del vigía','Separa los sobres que documentan los dos extremos de la travesía.','sobres'],
      ['Declaración de Mara','Sella las afirmaciones que la barquera puede defender.','acta'],
      ['Caja de la cooperativa','Ensaya un gasto con la caja y coteja cada presupuesto con los horarios.','presupuesto'],
      ['Acta del consejo','Coloca una cláusula en cada hueco del acta, de A a D.','clausulas']
    ]},
    6: { prop:'Gabinete de la consignataria', stages:[
      ['Fichero de consignas','Extrae la ficha del recibo y comprueba el destino del envoltorio.','fichero'],
      ['Lupa de la aprendiz','Examina el cruce de los hilos por ambas caras y elige un calco frontal.','calcos'],
      ['Disco del remiendo','Monta cuatro surcos en el orden que oyes en la copla.','surcos'],
      ['Papeleta de puja','Presenta una estrategia de compra y reserva con la que puedas acudir a la ronda.','puja'],
      ['Cartelas de devolución','Aparta los rótulos que se puedan exponer junto a las piezas.','cartelas']
    ]},
    7: { prop:'Laboratorio del periódico', stages:[
      ['Archivo de negativos','Pide una sola hoja usando la caja, la referencia y el día.','fichero'],
      ['Tendedero de contactos','Cuelga las cuatro tomas en el orden en que se disparó la cámara.','pelicula'],
      ['Puestos de observación','Marca quién tenía línea de visión para cada momento.','testigos'],
      ['Marginador de imprenta','Desplaza la ventana de diez centímetros sobre el positivo y coteja la prueba de imprenta.','recorte'],
      ['Pie de imprenta','Reserva las tres líneas que describen lo que enseñan las copias.','cartelas']
    ]},
    8: { prop:'Gabinete del jardín', stages:[
      ['Guías del paseo','Escoge la guía cuya edición conserva el recorrido original.','fichero'],
      ['Inventario de hitos','Etiqueta las dos fichas cuyos hitos permanecen en su emplazamiento.','cartelas'],
      ['Cuaderno de senderos','Traza el paseo parada a parada desde el comienzo de la grabación.','senderos'],
      ['Correspondencia de la cita','Une el lugar de espera, la copia y el mensaje en el registro.','sobres'],
      ['Inscripción del banco','Completa Inicio, Ancla, Control y Cambio en ese orden.','inscripcion']
    ]},
    9: { prop:'Banco de restauración', stages:[
      ['Dibujos de las dos alas','Escoge un pie para cada dibujo y comprueba desde dónde se veía la escena.','cartelas'],
      ['Paso entre las cocinas','Recorre las estancias en el orden en que viajó la bolsa.','senderos'],
      ['Caja de bornes','Identifica la salida por su grabado y la cadencia que certifica el ensayo.','bornes'],
      ['Corte de la jamba','Construye la pared capa a capa desde el soporte más antiguo.','estratos'],
      ['Acta de inspección','Rubrica las tres entradas que puedes sostener ante las dos familias.','acta']
    ]},
    10: { prop:'Mesa de correspondencia del salón', stages:[
      ['Talón de entrega','Reconstruye la recogida y el gesto posterior con dos anotaciones.','bitacora'],
      ['Papeles de la receta','Aparta las piezas cuya transferencia encaja con las manchas.','sobres'],
      ['Muestrario de manos','Coloca las dos atribuciones en el orden de las cartas.','firmas'],
      ['Reparto del banquete','Escoge un sobre y colócalo en el puesto que le corresponde.','mantel'],
      ['Álbum del brindis','Selecciona los pies de foto que el expediente permite imprimir.','cartelas']
    ]},
    11: { prop:'Mesa del árbitro', stages:[
      ['Foto de la esquina','Señala la casilla del dibujo cuando hayas orientado la fotografía.','casillas'],
      ['Bandeja del árbitro','Retira las piezas por orden e indica de quién era cada una.','piezas'],
      ['Hoja de tanteo','Marca las trayectorias que alcanzan el umbral con su puntuación de turno.','tanteo'],
      ['Tablero desde la grada','Toca las cuatro casillas que quedaron vacías en el orden de retirada.','casillas'],
      ['Acta del torneo','Firma las anotaciones que resisten la comparación con las retiradas y la grabación.','acta']
    ]},
    12: { prop:'Puesto de la guardabarrera', stages:[
      ['Banco de relojes','Ajusta una lectura a hora oficial y anota las dos equivalencias.','relojes'],
      ['Parte de recorrido','Marca las cuatro paradas después de Mercado siguiendo el parte del viaje.','senderos'],
      ['Sincronizador del paso','Elige una banda de tiempo para el cierre, el timbre y la apertura.','banda'],
      ['Portanegativos','Encadena las tres exposiciones compatibles con la cámara del expediente.','pelicula'],
      ['Libro de rectificaciones','Incorpora las tres anotaciones respaldadas por una segunda fuente.','bitacora']
    ]}
  };
  const el = (tag, name, text) => {
    const node = document.createElement(tag);
    if(name) node.className = 'vi-' + name;
    if(text) node.textContent = text;
    return node;
  };
  function button(name, label, run) {
    const node = el('button', name, label);
    node.type = 'button';
    node.addEventListener('click', run);
    return node;
  }
  function integer(label, min, max, value) {
    const wrap = el('label','number',label);
    const input = el('input'); input.type='number';
    Object.assign(input,{min:String(min),max:String(max),value:String(value),step:'1'});
    wrap.append(input);
    return {wrap,input};
  }
  function clocks(root) {
    const time = el('input'); time.type='time'; time.value='18:00';
    const label = el('label','number','Lectura observada'); label.append(time);
    const offset = integer('Minutos que sumas o restas',-15,15,0);
    const result = el('output','reading');
    function update() {
      if(!time.value || !offset.input.value || !offset.input.validity.valid){result.textContent='Introduce una lectura y una corrección entre −15 y +15.';return;}
      const [h,m] = time.value.split(':').map(Number);
      const minutes=(1440+h*60+m+Number(offset.input.value))%1440;
      result.textContent='Hora reconstruida · '+[Math.floor(minutes/60),minutes%60].map(v=>String(v).padStart(2,'0')).join(':');
    }
    time.addEventListener('input',update); offset.input.addEventListener('input',update);
    root.append(label,offset.wrap,result); update();
  }
  function budget(root, materials) {
    const source=materials.find(m=>m.id==='ofertas');
    const items = String(source?.body||'').split('\n').slice(1).map(line=>line.split('|').map(v=>v.trim())).filter(row=>row.length===3 && /^\d+$/.test(row[1]));
    if(!items.length){
      root.append(el('p','note','Pide a quien tiene la hoja de precios los costes de tu propuesta y anótalos aquí.'));
      const entries=[1,2,3].map(n=>integer('Gasto '+n,0,100,0));
      const total=el('output','reading');
      const sum=()=>{total.textContent=entries.every(e=>e.input.validity.valid && e.input.value!=='')?'Suma del ensayo · '+entries.reduce((s,e)=>s+Number(e.input.value),0)+' créditos':'Revisa los importes.';};
      entries.forEach(e=>{root.append(e.wrap);e.input.addEventListener('input',sum);});
      root.append(total);sum();return;
    }
    const total=el('output','reading'), values = new Map();
    const list=el('div','coins');
    items.forEach(([name,price])=>{
      const token=button('coin',name+' · '+price,()=>{
        values.has(name)?values.delete(name):values.set(name,Number(price));
        token.setAttribute('aria-pressed',String(values.has(name)));
        total.textContent='Suma del ensayo · '+Array.from(values.values()).reduce((s,v)=>s+v,0)+' créditos';
      });
      token.setAttribute('aria-pressed','false'); list.append(token);
    });
    total.textContent='Suma del ensayo · 0 créditos';root.append(list,total);
  }
  function crop(root,materials) {
    const known=materials.some(m=>m.id==='franjas');
    const mat=el('div','optics'),frame=el('div','crop-frame');
    mat.setAttribute('aria-hidden','true');
    if(known){
      mat.dataset.positive='true';
      const photo=el('img','positive');photo.src='/valdemar-positivo-inspeccion.webp';photo.alt='';
      photo.width=860;photo.height=390;photo.loading='lazy';mat.append(photo);
      [['Uniforme',0,2],['Placa',2,1],['Niño y bañista',5,4],['Escalera',10,2]].forEach(([name,start,width])=>{
      const mark=el('span','optic-mark',name);mark.style.left=(start/12*100)+'%';mark.style.width=(width/12*100)+'%';mat.append(mark);
      });
    }
    mat.append(frame);
    const scale=el('input');scale.type='range';scale.min='0';scale.max='2';scale.step='1';scale.value='1';
    const label=el('label','range','Mover el margen izquierdo');label.append(scale);
    const result=el('output','reading');
    const update=()=>{
      const start=Number(scale.value);frame.style.left=(start/12*100)+'%';
      const detail=known?' Compara la posición de las cuatro marcas con el ejemplar.':' Pide a quien tiene la regla óptica que sitúe los rasgos del positivo.';
      result.textContent='Ventana de '+start+' a '+(start+10)+' cm.'+detail;scale.setAttribute('aria-valuetext',start+' a '+(start+10)+' centímetros');
    };
    root.append(mat,label,result);scale.addEventListener('input',update);update();
  }
  function calcs(root,materials) {
    const data=materials.find(m=>m.id==='calcos');
    if(!data){root.append(el('p','note','Tu compañero conserva las ampliaciones. Describe la cara que miraba la aprendiz y qué hilo tenía por encima.'));return;}
    const table=String(data.body||'').split('\n').slice(1).map(line=>line.split('|').map(v=>v.trim())).filter(r=>r.length===3);
    if(!table.length)return;
    const opt=el('select'), label=el('label','number','Ampliación');label.append(opt);
    table.forEach(([name],i)=>{const o=el('option',null,name);o.value=String(i);opt.append(o);});
    const plate=el('div','relief');plate.setAttribute('aria-hidden','true');
    const disc=el('div','button-disc'),light=el('i','thread-light'),dark=el('i','thread-dark'),crack=el('i','crack');
    disc.append(...Array.from({length:4},()=>el('i','hole')),light,dark,crack);plate.append(disc);
    const result=el('output','note');
    let back=false;
    const flip=button('turn','Ver el reverso',()=>{back=!back;update();});
    function update(){
      const [,corner,threads]=table[Number(opt.value)];
      const right=corner.toLowerCase().includes('derecha'), lower=corner.toLowerCase().includes('inferior');
      const lightFirst=/^claro/i.test(threads), lightDesc=/claro de 1 a 4/i.test(threads);
      disc.dataset.reversed=String(back);disc.dataset.right=String(right);disc.dataset.lower=String(lower);
      light.style.transform='rotate('+(lightDesc?45:-45)+'deg)';dark.style.transform='rotate('+(lightDesc?-45:45)+'deg)';
      light.style.zIndex=(back?!lightFirst:lightFirst)?'3':'2';dark.style.zIndex=(back?lightFirst:!lightFirst)?'3':'2';
      flip.textContent=back?'Ver la cara frontal':'Ver el reverso';
      result.textContent=back?'Reverso simulado. La grieta queda '+(lower?'abajo':'arriba')+' a la '+(right?'izquierda':'derecha')+'. La hebra que queda encima es la '+(lightFirst?'oscura':'clara')+'.':'Cara frontal. '+corner+'. '+threads+'.';
    }
    opt.addEventListener('change',update);root.append(label,plate,flip,result); update();
  }
  const experiments={relojes:clocks,presupuesto:budget,recorte:crop,calcos:calcs};

  // Estas obligan a elegir en función del expediente; su posición no indica una solución.
  function chessboard(options, create,materials) {
    const wrap=el('div','chess-wrap'),board=el('div','chess');
    board.setAttribute('role','group');board.setAttribute('aria-label','Tablero de casillas A1 a D4');
    const map=String(materials.find(m=>m.id==='mesa')?.body||'');
    const squares=[];
    for(let row=1;row<=4;row++){
      for(const col of 'ABCD'){
        const square=col+row, option=options.find(o=>new RegExp('\\b'+square+'\\b','i').test(o.label));
        const icon=map.match(new RegExp('\\b'+square+' ([^ |\\n]+)','i'))?.[1];
        const cell=option?create(option):el('span','unavailable',square+(icon?' · '+icon:''));
        if(!option)cell.setAttribute('aria-hidden','true');
        squares.push(cell);
      }
    }
    let turned=false;
    const rotate=button('turn','Girar el papel 180°',()=>{turned=!turned;paint();});
    const angle=el('output','reading');
    function paint(){board.replaceChildren(...(turned?squares.slice().reverse():squares));angle.textContent=turned?'Papel girado media vuelta.':'Papel en la orientación del tablero.';rotate.setAttribute('aria-pressed',String(turned));}
    paint();wrap.append(board,rotate,angle);return wrap;
  }
  const maps={
    8:{source:'red',points:{
      'Reloj':[11,44],'Seto de boj':[36,20],'Curva sur':[66,20],'Fuente':[89,47],
      'Olmos':[64,78],'Umbráculo':[33,65],'Vivero':[14,82]},
      paths:[['Reloj','Seto de boj','Curva sur','Fuente'],['Reloj','Fuente','Olmos','Curva sur'],['Seto de boj','Umbráculo','Vivero']]},
    9:{source:'pasos',points:{
      'Hiedra':[11,49],'Lavadero':[33,31],'Cuarto central':[57,20],'Despensa':[77,45],
      'Cocina Olmo':[57,72],'Portal oeste':[83,83],'Jardín':[33,86]},
      paths:[['Hiedra','Lavadero','Cuarto central','Despensa','Cocina Olmo','Portal oeste'],['Hiedra','Jardín','Despensa'],['Lavadero','Cocina Olmo']]},
    12:{source:'circuito',points:{
      'Mercado':[12,53],'Plaza del Corcho':[34,51],'Barrera principal':[66,19],'Talleres':[87,54],
      'Viñedos':[38,84],'Dársena':[68,81],'Puente de Barcas':[53,51]},
      paths:[['Mercado','Plaza del Corcho','Barrera principal','Talleres'],['Plaza del Corcho','Puente de Barcas','Dársena','Talleres'],['Plaza del Corcho','Viñedos','Dársena']]}
  };
  function routeMap(id,options,materials,create) {
    const plan=maps[id], visible=materials.some(m=>m.id===plan.source);
    const wrap=el('div','map-wrap'), map=el('div','route-map');
    const ns='http://www.w3.org/2000/svg',graphic=document.createElementNS(ns,'svg');
    graphic.setAttribute('viewBox','0 0 100 100');graphic.setAttribute('preserveAspectRatio','none');graphic.setAttribute('aria-hidden','true');
    function line(path,kind){
      const node=document.createElementNS(ns,'polyline');
      node.setAttribute('points',path.map(name=>plan.points[name]?.join(',')).filter(Boolean).join(' '));
      node.setAttribute('class','vi-'+kind);node.setAttribute('vector-effect','non-scaling-stroke');
      graphic.append(node);return node;
    }
    if(visible)for(const path of plan.paths)line(path,'trail');
    const drawn=line([],'traced');map.append(graphic);
    for(const [name,[x,y]] of Object.entries(plan.points)){
      const option=options.find(o=>o.label===name);
      if(!option&&!visible)continue;
      const pin=option?create(option):el('span','reference',name);
      if(x>13&&x<85)pin.dataset.interior='true';
      pin.style.left=x+'%';pin.style.top=y+'%';map.append(pin);
    }
    wrap.append(el('p','map-note',visible?'Croquis del expediente. Las líneas finas marcan los pasos descritos en tu documento.':'Croquis de trabajo. Pide a tu compañero que describa los enlaces del plano y traza tu propio recorrido.'),map);
    return {node:wrap,update(ids){
      drawn.setAttribute('points',ids.map(o=>plan.points[options.find(v=>v.id===o)?.label]?.join(',')).filter(Boolean).join(' '));
    }};
  }
  function seating(options,create,materials) {
    const group=el('div','dining'), letters=el('div','actions'), seats=el('div','seats');
    const hasPlan=materials.some(m=>m.id==='puestos');
    let active='Avellana';
    const seatsForLetter=[];
    const tabs=['Avellana','Granate'].map(name=>{
      const b=button('envelope','Sobre '+name.toLowerCase(),()=>{active=name;paint();});
      letters.append(b);return b;
    });
    // La orientación de las sillas pertenece al expediente del plano.
    for(const pos of hasPlan?[1,2,3,6,5,4]:[1,2,3,4,5,6]){
      const seat=el('div','seat');
      seat.append(el('span','seat-number','Puesto '+pos));
      for(const option of options.filter(o=>new RegExp('puesto '+pos+'\\b','i').test(o.label))){
        const b=create(option);seatsForLetter.push({b,label:option.label});seat.append(b);
      }
      seats.append(seat);
    }
    function paint(){
      tabs.forEach((b,i)=>b.setAttribute('aria-pressed',String((i===0?'Avellana':'Granate')===active)));
      seatsForLetter.forEach(({b,label})=>{b.hidden=!label.toLowerCase().startsWith(active.toLowerCase());});
    }
    group.dataset.plan=String(hasPlan);
    group.append(el('p','map-note',hasPlan?'Pared de los naranjos arriba. Pared del espejo abajo.':'Casilleros del reparto por número. Pide a quien tiene el plano que te indique qué puestos quedan enfrentados.'));
    paint();group.append(letters,seats);return group;
  }
  function wallSample(root, options){
    const diagram=el('div','cutaway'), layerStack=el('div','cutaway-layers');
    diagram.setAttribute('aria-hidden','true');
    layerStack.append(el('span','cutaway-brick','Soporte de ladrillo'));diagram.append(layerStack); root.append(diagram);
    return ids=>{
      layerStack.replaceChildren(el('span','cutaway-brick','Soporte de ladrillo'));
      for(const id of ids){
        const option=options.find(o=>o.id===id),piece=el('span','cutaway-slice',option.label);
        piece.dataset.material=option.label.slice(0,1);layerStack.append(piece);
      }
    };
  }
  function orderCaption(kind,i){
    if(kind==='clausulas')return 'Hueco '+('ABCD'[i]||String(i+1));
    if(kind==='inscripcion')return ['Inicio','Ancla','Control','Cambio'][i]||'Marca';
    if(kind==='estratos')return 'Capa '+(i+1);
    if(kind==='pelicula')return 'Fotograma '+(i+1);
    if(kind==='surcos')return 'Surco '+(i+1);
    if(kind==='piezas')return 'Retirada '+(i+1);
    if(kind==='senderos')return 'Parada '+(i+1);
    return 'Paso '+(i+1);
  }
  function sortLabel(kind){
    return {estratos:'Sección de la pared · de la base a la superficie',pelicula:'Tira que has montado',clausulas:'Cláusulas para votar',
      inscripcion:'Inscripción que propones',senderos:'Recorrido trazado',surcos:'Disco que has montado',piezas:'Bandeja de retiradas',
      casillas:'Orden de las retiradas',bitacora:'Cronología que propones'}[kind]||'Tu secuencia';
  }
  function sourceDraw(root,kind,materials) {
    const experiment=experiments[kind];
    if(!experiment)return;
    const wrapper=el('details','experiment'),title=el('summary',null,{
      relojes:'Calibrar un reloj',presupuesto:'Probar un presupuesto',calcos:'Ampliar y voltear un calco',recorte:'Probar un encuadre'
    }[kind]);
    wrapper.open=true;
    const body=el('div','experiment-body');
    experiment(body,materials);
    wrapper.append(title,body);root.append(wrapper);
  }
  function tagFor(kind, label) {
    if(kind==='bornes')return label.match(/Borne \d+/i)?.[0];
    if(kind==='banda')return label.match(/\d\d:\d\d/g)?.join(' → ');
    if(kind==='tanteo')return label.match(/^[AL]\d/)?.[0];
    if(kind==='relojes')return label.split('=')[0].match(/\d\d:\d\d/)?.[0];
    return '';
  }
  function optionNode(option,kind,i,choose) {
    const b=button('option','',()=>choose(option));
    b.dataset.viChoice=option.id;
    const tag=tagFor(kind,option.label);
    if(tag){const mark=el('span','imprint',tag);mark.setAttribute('aria-hidden','true');b.append(mark);}
    if(kind==='pelicula'||kind==='surcos'||kind==='bornes'){
      const mark=el('i','prop-shape');mark.setAttribute('aria-hidden','true');b.append(mark);
    }
    if(kind==='estratos')b.dataset.material=option.label.slice(0,1);
    const name=el('span','label',option.label);b.append(name);
    return b;
  }
  function kitchenDrawings(materials) {
    const drawings=materials.find(item=>item.id==='muesca');
    const desk=el('div','sketch-desk');
    desk.setAttribute('role','img');
    desk.setAttribute('aria-label',drawings
      ? 'Dos dibujos sin firma. En la hoja gris, el depósito con la chapa OGA. En la ocre, tres chimeneas y ropa tendida.'
      : 'Reverso de las dos hojas sin firma. El otro papel conserva los dibujos.');
    for(const color of ['gris','ocre']){
      const page=el('div','sketch-sheet');
      page.dataset.paper=color;page.setAttribute('aria-hidden','true');
      if(drawings){
        if(color==='gris'){
          page.append(el('span','sketch-tank','OGA'),el('span','sketch-handle'));
        }else{
          const roofs=el('div','sketch-roofs'),line=el('div','sketch-line');
          for(let i=0;i<3;i++){roofs.append(el('i','chimney'));line.append(el('i','linen'));}
          page.append(roofs,line);
        }
      }
      page.append(el('span','sketch-color',color));desk.append(page);
    }
    return desk;
  }
  function render({field,stage,index,caseId,role,selected,change}) {
    const story=cases[caseId], spec=story?.stages[index], opts=stage.options;
    if(!spec||!Array.isArray(opts)||!opts.length)return false;
    const [title,instructions,kind]=spec;
    const root=el('section','station');
    root.dataset.instrument=kind;root.dataset.story=String(caseId);
    const head=el('div','head'), intro=el('div','intro');
    let art;
    if(caseId===9 && index===0)art=kitchenDrawings(stage.materials||[]);
    else{
      art=el('img','prop');
      art.src=caseId===9?'/valdemar-lector-9-'+(index+1)+'.webp':'/valdemar-mesa-'+caseId+'.webp';
      art.alt='';art.loading='lazy';art.width=660;art.height=440;
    }
    intro.append(el('h5','title',title),el('p','lead',instructions));head.append(art,intro);root.append(head);
    sourceDraw(root,kind,stage.materials||[]);
    const order=stage.mode==='order', multi=stage.mode==='multi', max=order?stage.requiredCount:undefined;
    const buttons=new Map(), out=el('div','draft'), reading=el('output','reading'),rack=el('ol','rack');
    const label=el('h6','draft-title',order?sortLabel(kind):'Tu selección');
    const undo=button('undo','Deshacer el último paso',()=>{selected.pop();paint();});
    const undoAll=button('undo','Vaciar la selección',()=>{selected.length=0;paint();});
    function choose(opt) {
      const j=selected.indexOf(opt.id);
      if(j>=0){selected.splice(j,1);paint();return;}
      if(order && max && selected.length>=max){reading.textContent='Secuencia completa. Toca una pieza colocada para retirarla.';return;}
      if(!order && !multi)selected.length=0;
      // Cada sobre se mueve físicamente entre puestos y sólo puede estar en uno.
      if(kind==='mantel'){
        const letter=opt.label.split(' ')[0];
        const prev=selected.findIndex(id=>opts.find(o=>o.id===id)?.label.startsWith(letter+' '));
        if(prev>=0)selected.splice(prev,1);
      }
      selected.push(opt.id);paint();
    }
    function create(opt){
      const b=optionNode(opt,kind,opts.indexOf(opt),choose);buttons.set(opt.id,b);return b;
    }
    let tray,route;
    const materials=stage.materials||[];
    const wall=kind==='estratos'?wallSample(root,opts):null;
    const roleCanOrient=index!==0||materials.some(m=>m.id==='mesa');
    if(kind==='casillas' && roleCanOrient && opts.every(o=>/\b[A-D][1-4]\b/i.test(o.label)))tray=chessboard(opts,create,materials);
    else if(kind==='senderos' && maps[caseId] && opts.every(o=>maps[caseId].points[o.label])){
      route=routeMap(caseId,opts,stage.materials||[],create);tray=route.node;
    }
    else if(kind==='mantel')tray=seating(opts,create,materials);
    else{
      if(kind==='casillas'&&!roleCanOrient)root.append(el('p','map-note','Tu copia muestra la esquina doblada. Describe dónde aparece y pide la orientación del tablero oficial antes de señalar la casilla.'));
      tray=el('div','choices');opts.forEach(o=>tray.append(create(o)));
    }
    const visibleMap=new Map(opts.map(o=>[o.id,o.label]));
    function paint(){
      route?.update(selected);
      wall?.(selected);
      for(const [id,b] of buttons){
        const pos=selected.indexOf(id);
        b.setAttribute('aria-pressed',String(pos>=0));
        b.setAttribute('aria-disabled',String(Boolean(order && max && pos<0 && selected.length>=max)));
        if(pos>=0)b.dataset.step=order?String(pos+1):'✓';else delete b.dataset.step;
        const label=visibleMap.get(id);
        b.setAttribute('aria-label',order&&pos>=0?label+'. '+orderCaption(kind,pos)+'. Volver a tocar para retirar.':label);
      }
      rack.replaceChildren();
      const size=order?Math.max(Number(max)||0, selected.length):selected.length;
      for(let i=0;i<size;i++){
        const li=el('li','slot'),id=selected[i];
        if(order)li.append(el('span','slot-caption',orderCaption(kind,i)));
        if(id){
          const word=visibleMap.get(id),remove=button('remove',word,()=>{
            selected.splice(selected.indexOf(id),1);paint();buttons.get(id)?.focus();
          });
          remove.setAttribute('aria-label','Retirar '+word+(order?' de '+orderCaption(kind,i):''));li.append(remove);li.dataset.filled='true';
        }else{li.append(el('span','vacant','Por colocar'));}
        rack.append(li);
      }
      reading.textContent=selected.length?(order && max?selected.length+' de '+max+' piezas colocadas.':selected.length+(selected.length===1?' pieza seleccionada.':' piezas seleccionadas.')):order?'Elige la primera pieza.':'Elige una pieza para empezar.';
      undo.disabled=!selected.length;undoAll.disabled=!selected.length;change();
    }
    const actions=el('div','actions');if(order)actions.append(undo);actions.append(undoAll);
    out.append(label,reading,rack,actions);root.append(tray,out);field.append(root);paint();
    return true;
  }
  window.MesasDeCaso ||= {};
  for(const id of Object.keys(cases))window.MesasDeCaso[id]=render;
})();
