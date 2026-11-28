(() => {
  'use strict';
  const storageKey = 'lup.cinta87.demo.v1';
  const mounts = new WeakMap();
  const roles = {
    cabina:{name:'Restauración',room:'Cabina de escucha',places:['magnetofono','acetato'],
      task:'Reconoce la señal de arranque del piloto. Junto al magnetófono está el material de lectura.'},
    deposito:{name:'Archivo',room:'Depósito de cintas',places:['libro','hoja'],
      task:'Averigua qué precinto usaba la unidad móvil y recupera la hoja de las cajas trasladadas.'}
  };
  const places = {magnetofono:'Magnetófono',acetato:'Sobre de calibración',libro:'Libro de salidas',hoja:'Fichero de traslados'};
  const objects = {piloto:'Carrete piloto',acetato:'Máscara de acetato',hoja:'Hoja de contactos'};
  const photos = {magnetofono:'/c87-magnetofono.webp',acetato:'/c87-acetato.webp',libro:'/c87-registro.webp',hoja:'/c87-fichero.webp'};
  const itemPhoto=id=>photos[id==='piloto'?'magnetofono':id];
  const marks = {circulo:'Precinto circular',triangulo:'Precinto triangular',cuadrado:'Precinto cuadrado'};
  const manifestRule={tipo:'mecanica',mecanica:'cotejar-ficha',parametros:{
    senal:[1,1,3],precinto:'triangulo',fichas:[
      {id:'a4',senal:[1,1,3],precinto:'circulo'},
      {id:'b6',senal:[1,3,3],precinto:'triangulo'},
      {id:'c2',senal:[1,1,3],precinto:'triangulo'}
    ]
  }};
  const overlayMaterials={tipo:'conjunto',respuesta:['acetato','hoja']};
  const overlayEdge={tipo:'seleccion',respuesta:'izquierda'};
  const signalWords=beats=>beats.map(n=>n===1?'Corto':'Largo').join(' · ');
  function signalStrip(beats){
    return '<span class="c87-signal" aria-hidden="true">'+beats.map(length=>'<i class="'+(length===1?'short':'long')+'"></i>').join('')+'</span>';
  }
  const endings = {
    emitir:{label:'Emitir el fragmento',title:'La estación vuelve al aire',
      text:'Esa noche suena la voz de la jefa de andén en una radio encendida en el antiguo vestíbulo. Una oyente reconoce el silbato de su madre. Al día siguiente trae una fotografía para acompañar la grabación.'},
    custodiar:{label:'Custodiar el original',title:'Una copia para quienes estuvieron allí',
      text:'Guardas la bobina en una funda neutra y dejas la escucha reservada a los antiguos trabajadores. Una semana después, la jefa de andén vuelve con una carta. La carta y la cinta quedan catalogadas juntas.'}
  };
  const guidance = [
    'Reparte las dos comprobaciones. Restauración identifica el sonido y Archivo averigua qué precinto correspondía a una toma original.',
    'La muesca del acetato va sobre la franja negra de la hoja. Una vez revelada la tabla, descarta las cajas que no cumplan las dos condiciones a la vez.',
    'La señal es corto, corto, largo. A4 también la tiene, pero su precinto circular corresponde a una copia. El original está en C2 y lleva el precinto triangular.'
  ];
  let memory = null;
  let storageBlocked = false;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const otherRole = role => role==='cabina'?'deposito':'cabina';
  const unique = (value,allowed) => [...new Set(Array.isArray(value)?value.filter(v=>allowed.includes(v)):[])];
  const sections = [
    {id:'scene',view:'explore',label:'Escenario'},
    {id:'bag',view:'bag',label:'Inventario'},
    {id:'evidence',view:'evidence',label:'Evidencias'},
    {id:'hints',view:'hints',label:'Pistas'}
  ];
  const validViews = new Set([...sections.map(section=>section.view),'deduction']);
  function fresh(mode) {
    return {version:1,mode,role:'cabina',view:'explore',detail:null,seen:[],items:[],combined:false,solved:false,ending:null,hints:0};
  }
  function normalise(raw) {
    if(raw?.version!==1 || !['solo','duo'].includes(raw.mode))return null;
    const state=fresh(raw.mode);
    state.role=Object.hasOwn(roles,raw.role)?raw.role:'cabina';
    state.view=validViews.has(raw.view)?raw.view:'explore';
    state.detail=roles[state.role].places.includes(raw.detail)?raw.detail:null;
    state.seen=unique(raw.seen,['signal','register']);
    state.items=unique(raw.items,Object.keys(objects));
    state.combined=raw.combined===true && state.items.includes('acetato') && state.items.includes('hoja');
    state.solved=raw.solved===true && state.combined && state.seen.length===2;
    state.ending=state.solved && Object.hasOwn(endings,raw.ending)?raw.ending:null;
    state.hints=Number.isInteger(raw.hints)?Math.max(0,Math.min(3,raw.hints)):0;
    return state;
  }
  function read() {
    if(!storageBlocked){
      try {
        const saved=window.localStorage.getItem(storageKey);
        memory=saved?normalise(JSON.parse(saved)):null;
      }catch(error){
        if(error instanceof SyntaxError)memory=null;
        else storageBlocked=true;
      }
    }
    return memory?normalise(memory):null;
  }
  function save(state) {
    memory=state?normalise(state):null;
    try {
      if(memory)window.localStorage.setItem(storageKey,JSON.stringify(memory));
      else window.localStorage.removeItem(storageKey);
      storageBlocked=false;
    }catch{storageBlocked=true;}
  }
  const control = (action,label,value='',primary=false) =>
    '<button type="button" class="c87-control'+(primary?' c87-primary':'')+'" data-c87="'+action+'"'+
    (value?' data-value="'+safe(value)+'"':'')+'>'+safe(label)+'</button>';
  const heading = text => '<h2 tabindex="-1" data-c87-heading>'+safe(text)+'</h2>';
  const option = (value,label,selected) => '<option value="'+safe(value)+'"'+(value===selected?' selected':'')+'>'+safe(label)+'</option>';
  function select(name,label,choices,selected) {
    return '<label>'+safe(label)+'<select name="'+name+'"><option value="">Elige una opción</option>'+
      Object.entries(choices).map(([key,text])=>option(key,text,selected)).join('')+'</select></label>';
  }
  function mount(host,options={}) {
    mounts.get(host)?.destroy();
    const exitLabel=options.exitLabel||'Volver al catálogo';
    let state=read(),curtain=state?.mode==='duo'&&!state.ending,resetting=false,alternate=false;
    let transcript=false,notice='',disposed=false,draft={},worktop=null,armed='';
    function event(name){try{options.onEvent?.(name)?.catch?.(()=>{});}catch{/* Analytics do not gate play. */}}
    function commit(){save(state);}
    function stopAudio(){for(const node of host.querySelectorAll('audio'))node.pause();}
    function draw(focus=false){
      if(disposed)return;
      stopAudio();
      worktop?.destroy();worktop=null;
      let page;
      if(resetting)page=resetPage();
      else if(!state)page=prologue();
      else if(curtain)page=handoff();
      else if(state.ending)page=endingPage();
      else page=desk();
      host.innerHTML='<div class="c87">'+page+(!state||curtain||resetting||state.ending?feedback():'')+'</div>';
      if(state&&!curtain&&!resetting&&!state.ending&&window.MesaDeJuego){
        const progress=state.seen.length+state.items.filter(id=>id!=='piloto').length+Number(state.combined)+Number(state.solved);
        const objective=state.solved?'Decide qué hacer con la grabación.':nextStep().label+'.';
        worktop=window.MesaDeJuego.mount(host.querySelector('[data-c87-worktop]'),{family:'demo',title:'La cinta 87',
          progress:progress+' de 6 comprobaciones',objective,
          help:{context:'demo',text:'Reúne los indicios de la cabina y del depósito.',steps:['Explora los objetos del escenario.','Coteja los materiales en el inventario.','Relee las evidencias y contrasta tu deducción antes de abrir una caja.']},
          tools:sections.map(section=>({id:section.id,label:section.label,selected:activeSection()===section.view,run:()=>goTo(section.view)}))});
      }
      if(focus){
        const targets={notice:'[data-c87-status]',hint:'[data-c87-last-hint]',transcript:'[data-c87-transcript]'};
        host.querySelector(targets[focus]||'[data-c87-heading]')?.focus();
      }
    }
    function feedback(){return '<p class="c87-status" role="status" aria-live="polite" tabindex="-1" data-c87-status>'+safe(notice)+'</p>';}
    function prologue(){
      return '<section class="c87-opening"><div class="c87-poster"><img src="/cinta87-mesa.webp" alt="Una cinta de casete y material del archivo de radio sobre una mesa."></div>'+
        '<div class="c87-opening-copy"><p class="c87-kicker">Archivo de Radio Valdemar · Demo gratuita</p>'+
        '<h1 tabindex="-1" data-c87-heading>La cinta 87</h1><p class="c87-lead">Una casete conserva el arranque de la última emisión de la estación. La bobina original está en una de tres cajas del archivo.</p>'+
        '<p>Escucha o lee la señal en la cabina, contrasta los precintos en el depósito y decide si la grabación vuelve a las ondas.</p>'+
        '<p class="c87-meta">10-15 min aprox. · Un dispositivo · '+(storageBlocked?'Guardado durante esta visita':'Guardado local')+'</p><div class="c87-actions">'+
        control('start','Jugar en solitario','solo',true)+control('start','Jugar en pareja','duo')+'<gameplay-help context="demo"></gameplay-help></div>'+
        '<p class="c87-small">En solitario consultas ambas carpetas. En pareja os turnáis con el dispositivo. Las pistas son gratuitas y el recuerdo final se guarda en este navegador.</p>'+
        '<div class="c87-links">'+control('exit',exitLabel)+'</div></div></section>';
    }
    function handoff(){
      const role=roles[state.role];
      return '<section class="c87-curtain"><span class="c87-closed-folder" aria-hidden="true"></span><p class="c87-kicker">La cinta 87 · Relevo privado</p>'+heading('Entrega el dispositivo a '+role.name)+
        '<p>La persona que lleva '+role.name+' abre su carpeta cuando la otra haya dejado de mirar. Después podréis contaros lo que habéis averiguado.</p>'+
        '<div class="c87-actions">'+control('uncover','Ya tengo el dispositivo','',true)+control('exit',exitLabel)+'</div></section>';
    }
    function table(){
      return '<div class="c87-table"><table><caption>Hoja de traslados · Último turno</caption><thead><tr><th scope="col">Caja</th><th scope="col">Señal de arranque</th><th scope="col">Precinto</th></tr></thead>'+
        '<tbody>'+manifestRule.parametros.fichas.map(f=>'<tr><th scope="row">'+f.id.toUpperCase()+'</th><td>'+signalWords(f.senal)+'</td><td>'+marks[f.precinto]+'</td></tr>').join('')+'</tbody></table></div>';
    }
    function objectButton(id){
      if(!state.items.includes(id))return control('take','Guardar '+objects[id].toLowerCase(),id,true);
      return notice?'':'<p class="c87-filed">Guardado en el inventario</p>';
    }
    function examined(id){
      if(id==='magnetofono')return state.seen.includes('signal');
      if(id==='libro')return state.seen.includes('register');
      return state.items.includes(id);
    }
    function nextStep(){
      const here=state.role,there=otherRole(here);
      for(const role of [here,there]){
        const place=roles[role].places.find(id=>!examined(id));
        if(!place)continue;
        if(role!==here)return {type:'role',label:(state.mode==='duo'?'Dar el relevo a ':'Abrir la carpeta de ')+roles[role].name};
        const labels={magnetofono:'Escuchar el piloto',acetato:'Examinar el sobre de calibración',libro:'Consultar el libro de salidas',hoja:'Examinar el fichero de traslados'};
        return {type:'place',place,label:labels[place]};
      }
      return state.combined?{type:'view',view:'deduction',label:'Identificar la grabación'}:{type:'view',view:'bag',label:'Combinar los objetos en el inventario'};
    }
    function nextButton(){return '<div class="c87-next">'+control('next',nextStep().label,'',true)+'</div>';}
    function investigation(){
      const role=roles[state.role],id=state.detail;
      if(!id){
        const labels={magnetofono:'Escuchar el piloto',acetato:'Examinar el sobre',libro:'Leer el registro',hoja:'Examinar las fichas'};
        return '<section class="c87-room" data-c87-room="'+state.role+'"><header class="c87-room-intro"><p class="c87-kicker">'+role.name+'</p>'+heading(role.room)+'<p>'+role.task+'</p></header><div class="c87-evidence-grid">'+
          role.places.map(key=>'<button type="button" class="c87-evidence-card" data-c87="place" data-value="'+key+'"><span class="c87-object-photo"><img src="'+photos[key]+'" alt="" width="600" height="600"></span><span class="c87-object-caption"><strong>'+places[key]+'</strong><span>'+(examined(key)?'Consultado · Volver a abrir':labels[key])+'</span></span></button>').join('')+
          '</div>'+feedback()+(role.places.every(examined)?nextButton():'')+'</section>';
      }
      let detail;
      if(id==='magnetofono'){
        detail='<p>Restauración pasó el arranque de la casete 87 a este carrete piloto para escucharlo en el magnetófono. Escucha la señal que precede al soplo.</p>'+
          '<audio controls preload="none" data-c87-pilot aria-label="Cinta piloto de la última emisión"><source src="/cinta87-piloto.wav" type="audio/wav"></audio>'+
          '<div data-c87-pilot-text>'+pilotText()+'</div>'+
          (state.seen.includes('signal')&&!notice?'<p class="c87-filed">Señal del piloto examinada</p>':'');
      }else if(id==='acetato'){
        detail='<p>Una lámina opaca tiene una sola ventana transparente. En el borde, alguien ha escrito a lápiz:</p><blockquote>Para leer la última tirada, pon la muesca del acetato sobre la franja negra de la hoja de contactos.</blockquote>'+objectButton('acetato');
      }else if(id==='libro'){
        detail='<p>El parte del cierre distingue los originales de la unidad móvil de las copias que preparó la fonoteca.</p><blockquote>Original de andén: precinto triangular. Duplicado de escucha: precinto circular. En ambos puede repetirse la misma señal de arranque.</blockquote>'+
          '<p class="c87-filed">Registro consultado</p>';
      }else{
        detail='<p>Las fichas de dos turnos están impresas una encima de otra. Se distinguen tres cajas, A4, B6 y C2, pero los sellos y las señales se superponen.</p>'+
          '<blockquote>Una franja negra recorre el margen izquierdo de la hoja. En el derecho solo hay una perforación de archivador.</blockquote>'+objectButton('hoja');
      }
      return '<section class="c87-paper c87-inspection"><div class="c87-inspection-photo"><img src="'+photos[id]+'" alt="" width="600" height="600"></div><div class="c87-inspection-copy"><p class="c87-kicker">'+role.room+'</p>'+heading(places[id])+detail+feedback()+(examined(id)?nextButton():'')+
        '<div class="c87-links">'+control('back','Volver a '+role.room.toLowerCase())+'</div></div></section>';
    }
    function lightTable(){
      const objectNames=Object.fromEntries(state.items.map(id=>[id,objects[id]]));
      const slot=(field,label)=>'<button type="button" class="c87-carrier" data-c87="place-item" data-value="'+field+'" data-slot="'+field+'">'+(objectNames[draft[field]]?'<img src="'+itemPhoto(draft[field])+'" alt="">':'')+'<span>'+label+'</span><strong>'+(objectNames[draft[field]]||'Sin objeto')+'</strong></button>';
      const layer=field=>objectNames[draft[field]]?'<img class="c87-layer-'+field+'" src="'+itemPhoto(draft[field])+'" data-material="'+draft[field]+'" alt="">':'';
      return '<p>Elige un objeto y toca un soporte para colocarlo. Pon el segundo material en el otro soporte y ajusta la muesca al margen que señalan los documentos.</p><form data-c87-form="combine"><fieldset class="c87-lightbox"><legend>Revelar la ficha del último turno</legend>'+
        '<div class="c87-tray" aria-label="Objetos de la mesa">'+state.items.map(id=>'<button type="button" data-c87="arm" data-value="'+id+'" aria-pressed="'+(armed===id)+'"><img src="'+itemPhoto(id)+'" alt=""><span>'+objects[id]+'</span></button>').join('')+'</div>'+
        '<div class="c87-supports">'+slot('first','Soporte A')+slot('second','Soporte B')+'</div>'+
        '<div class="c87-registration" aria-label="Vista de las dos capas"><div class="c87-light-panel" data-aligned="'+safe(draft.side||'')+'">'+layer('first')+layer('second')+'</div><div class="c87-guides"><strong>Alinear la muesca</strong>'+['izquierda','derecha'].map(side=>'<button type="button" data-c87="align" data-value="'+side+'" aria-pressed="'+(side===draft.side)+'">'+(side==='izquierda'?'Margen izquierdo':'Margen derecho')+'</button>').join('')+'</div></div>'+
        '<details class="c87-manual"><summary>Colocar con listas de selección</summary>'+select('first','Objeto del soporte A',objectNames,draft.first)+select('second','Objeto del soporte B',objectNames,draft.second)+select('side','¿Dónde colocas la muesca?',{izquierda:'Margen izquierdo',derecha:'Margen derecho'},draft.side)+'</details>'+
        '<button type="submit" class="c87-control c87-primary">Superponer los objetos</button></fieldset></form>'+feedback();
    }
    function bag(){
      const contents=state.items.length?'<ul class="c87-inventory">'+state.items.map(id=>'<li><img src="'+itemPhoto(id)+'" width="96" height="96" alt=""><strong>'+objects[id]+'</strong></li>').join('')+'</ul>':'<p>Aún no hay objetos. Explora las dos carpetas para reunir el material.</p>';
      let work='';
      if(state.combined)work=table()+feedback()+nextButton();
      else if(state.items.includes('acetato') && state.items.includes('hoja'))work=lightTable();
      else work='<p>La mesa de cotejo necesita un material de cada carpeta.</p>'+feedback()+nextButton();
      return '<section class="c87-paper"><p class="c87-kicker">Mesa compartida</p>'+heading('Inventario')+(state.items.includes('acetato')&&state.items.includes('hoja')&&!state.combined?'':contents)+work+'</section>';
    }
    function evidence(){
      const notes=[];
      const canRead=role=>state.mode==='solo'||state.role===role;
      if(canRead('cabina')){
        if(state.seen.includes('signal'))notes.push(['magnetofono','Señal del piloto','Dos pulsos cortos y uno largo antes del soplo de la cinta.']);
        if(state.items.includes('acetato'))notes.push(['acetato','Instrucción del sobre','La muesca del acetato se alinea con la franja negra de la hoja de contactos.']);
      }
      if(canRead('deposito')){
        if(state.seen.includes('register'))notes.push(['libro','Parte de cierre','El original de andén llevaba un precinto triangular. Las copias de escucha llevaban un precinto circular.']);
        if(state.items.includes('hoja'))notes.push(['hoja','Margen de la hoja','La franja negra está a la izquierda. La perforación de la derecha es del archivador.']);
      }
      const entries=notes.map(([id,title,text])=>'<li><img src="'+photos[id]+'" width="96" height="96" alt=""><div><h3>'+title+'</h3><p>'+text+'</p></div></li>').join('');
      return '<section class="c87-paper"><p class="c87-kicker">'+(state.mode==='duo'?'Carpeta de '+roles[state.role].name:'Archivo de Radio Valdemar')+'</p>'+heading('Evidencias')+
        (entries?'<ul class="c87-notes">'+entries+'</ul>':'<p>Todavía no hay anotaciones en esta carpeta. Examina los objetos del escenario para registrar tus primeros indicios.</p>')+
        (state.combined?'<details class="c87-manifest"><summary>Releer la hoja de traslados revelada</summary>'+table()+'</details>':'')+
        '<div class="c87-actions">'+control('view',state.solved?'Volver a la grabación recuperada':'Contrastar mi deducción','deduction',true)+'</div>'+feedback()+'</section>';
    }
    function deduction(){
      if(state.solved){
        return '<section class="c87-paper"><p class="c87-kicker">Caja C2 · Original recuperado</p>'+heading('La última voz del andén')+
          '<blockquote>«Son las once y diecisiete. Hemos dejado la luz del vestíbulo encendida hasta la llegada del último tren».</blockquote>'+
          '<p>La jefa de andén grabó esa despedida antes de entregar las llaves. En la funda no dejó ninguna indicación sobre una segunda emisión.</p>'+
          feedback()+'<fieldset><legend>¿Qué haréis con la grabación?</legend><p>Podéis devolver su voz a las ondas o reservar la escucha a quienes trabajaron en la estación.</p>'+
          '<div class="c87-actions">'+Object.entries(endings).map(([key,e])=>control('ending',e.label,key)).join('')+'</div></fieldset></section>';
      }
      const missing=[];
      if(!state.seen.includes('signal'))missing.push('Escuchar el piloto o leer su transcripción en la cabina.');
      if(!state.seen.includes('register'))missing.push('Consultar el libro de salidas en el depósito.');
      if(!state.combined)missing.push('Revelar la hoja de traslados en el inventario.');
      const work=missing.length?'<p>Para identificar el original falta:</p><ul>'+missing.map(t=>'<li>'+t+'</li>').join('')+'</ul>'+feedback()+nextButton():
        '<details class="c87-manifest"><summary>Consultar la hoja de traslados en texto</summary>'+table()+'</details><form data-c87-form="deduce"><fieldset><legend>Identificar la grabación original</legend>'+
        '<fieldset class="c87-choices c87-boxes"><legend>¿Qué caja abrirás?</legend>'+manifestRule.parametros.fichas.map(({id,senal,precinto})=>'<label><input type="radio" name="box" required value="'+id+'"'+(draft.box===id?' checked':'')+'><span class="c87-box-photo"><img src="/c87-caja-bobina.webp" width="420" height="420" alt=""><span class="c87-box-tag" aria-hidden="true"><i class="c87-stamp c87-stamp-'+precinto+'"></i>'+id.toUpperCase()+'</span></span><strong>Caja '+id.toUpperCase()+'</strong>'+signalStrip(senal)+'<span class="c87-box-facts">'+signalWords(senal)+'</span><span class="c87-seal-label">'+marks[precinto]+'</span></label>').join('')+'</fieldset>'+
        '<fieldset class="c87-choices"><legend>¿Qué precinto acredita que es el original?</legend>'+Object.entries(marks).map(([id,label])=>'<label><input type="radio" name="mark" required value="'+id+'"'+(draft.mark===id?' checked':'')+'><span class="c87-stamp c87-stamp-'+id+'" aria-hidden="true"></span><span>'+label+'</span></label>').join('')+'</fieldset>'+
        '<button type="submit" class="c87-control c87-primary">Contrastar la deducción</button></fieldset></form>'+feedback();
      return '<section class="c87-paper"><p class="c87-kicker">Mesa compartida</p>'+heading('¿Dónde está la cinta 87?')+work+'</section>';
    }
    function hints(){
      return '<section class="c87-paper c87-hints">'+heading('Pistas')+
        (state.hints?'<ol>'+guidance.slice(0,state.hints).map((t,i)=>'<li'+(i===state.hints-1?' data-c87-last-hint tabindex="-1"':'')+'>'+t+'</li>').join('')+'</ol>':
          '<p>'+(state.solved?'Has identificado la grabación.':'Si te has atascado, abre una pista gratuita.')+'</p>')+
        (!state.solved&&state.hints<3?control('hint',state.hints===2?'Mostrar la solución completa':state.hints?'Abrir la siguiente pista':'Abrir la primera pista'):'')+
        (state.solved?control('view','Volver a la grabación recuperada','deduction',true):'')+feedback()+'</section>';
    }
    function activeSection(){return state.view==='deduction'?'evidence':state.view;}
    function goTo(view){
      if(!validViews.has(view))return;
      state.view=view;notice='';commit();draw(true);
    }
    function desk(){
      const role=roles[state.role];
      const fallbackNav=window.MesaDeJuego?'':'<nav class="c87-tabs" aria-label="Herramientas de juego">'+sections.map(section=>
        '<button type="button" data-c87="view" data-value="'+section.view+'"'+(activeSection()===section.view?' aria-current="page"':'')+'>'+section.label+'</button>').join('')+'</nav>';
      return '<header class="c87-bar"><div><small>Radio Valdemar · La cinta 87</small><strong>'+role.name+' · '+(state.mode==='solo'?'En solitario':'En pareja')+'</strong></div>'+
        control('role',state.mode==='duo'?'Dar el relevo a '+roles[otherRole(state.role)].name:'Cambiar a '+roles[otherRole(state.role)].name)+'</header>'+
        fallbackNav+'<div data-c87-worktop></div>'+
        ({bag,evidence,deduction,hints,explore:investigation}[state.view]())+
        '<footer class="c87-foot"><span>'+savedMessage()+'</span><div class="c87-links">'+control('exit',exitLabel)+control('reset','Reiniciar demo')+'</div></footer>';
    }
    function savedMessage(){return storageBlocked?'Guardado temporal en esta página.':'Progreso guardado en este navegador.';}
    function endingPage(){
      const key=alternate?(state.ending==='emitir'?'custodiar':'emitir'):state.ending,ending=endings[key];
      const member=window.ClubAccess?.canPlay===true;
      const offer=member?{label:'Elegir un juego',href:'/#casos'}:window.ClubAccess?.offerAction||{href:'/#planes',label:'Ver la suscripción'};
      const price=window.ClubAccess?.price;
      return '<section class="c87-ending"><figure class="c87-final-photo"><img src="/c87-caja-bobina.webp" width="640" height="640" alt="La bobina de la última emisión, recuperada en su caja de archivo."></figure><div class="c87-ending-copy"><p class="c87-kicker">'+(alternate?'Lectura alternativa':'Desenlace guardado')+'</p>'+heading(ending.title)+'<p class="c87-lead">'+ending.text+'</p>'+
        (alternate?'<p class="c87-small">Tu elección guardada sigue siendo «'+endings[state.ending].label+'».</p>':
          '<div class="c87-souvenir"><strong>Ficha de oyente · Cinta 87</strong><p>Recuerdo de muestra '+(storageBlocked?'disponible durante esta visita.':'guardado en este navegador.')+' No añade llaves al pase de temporada.</p></div>')+
        '<div class="c87-followup"><h3>La siguiente pista está en una casa de Valdemar</h3><p>En <em>El secreto de los dos mundos</em>, una fotografía de infancia os lleva hasta la casa de Ada. '+(member?'':'La suscripción abre cuatro juegos al mes. <span data-c87-offer-price>'+safe(price?price+' por persona al mes.':'')+'</span>')+'</p><a class="c87-offer-link" data-c87-offer href="'+safe(offer.href)+'">'+safe(offer.label)+'</a></div>'+
        '<div class="c87-actions">'+control('exit',exitLabel)+control('alternate',alternate?'Volver a mi desenlace':'Leer el otro desenlace')+'</div>'+
        '<div class="c87-links">'+control('reset','Volver a jugar desde el principio')+'</div></div></section>';
    }
    function resetPage(){
      return '<section class="c87-paper">'+heading('¿Reiniciar La cinta 87?')+'<p>Se perderá el progreso de esta demo en este navegador.</p>'+
        '<div class="c87-actions">'+control('cancel-reset','Conservar mi partida','',true)+control('confirm-reset','Reiniciar la demo')+'</div></section>';
    }
    function markSignal(){
      if(!state.seen.includes('signal'))state.seen.push('signal');
      if(!state.items.includes('piloto'))state.items.push('piloto');
    }
    function click(e){
      const btn=e.target.closest?.('[data-c87]');
      if(!btn||!host.contains(btn))return;
      let action=btn.dataset.c87,value=btn.dataset.value;
      notice='';
      if(action==='exit'){
        stopAudio();
        if(options.onExit)options.onExit();else window.location.assign('/#casos');
        return;
      }
      if(action==='reset'){resetting=true;draw(true);return;}
      if(action==='cancel-reset'){resetting=false;draw(true);return;}
      if(action==='confirm-reset' && resetting){state=null;save(null);resetting=false;curtain=false;alternate=false;transcript=false;armed='';draft={};draw(true);return;}
      if(resetting)return;
      if(action==='start'&&!state && ['solo','duo'].includes(value)){
        state=fresh(value);curtain=value==='duo';commit();event('start');draw(true);return;
      }
      if(!state)return;
      if(action==='uncover' && curtain){curtain=false;draw(true);return;}
      if(curtain)return;
      if(state.ending){if(action==='alternate'){alternate=!alternate;draw(true);}return;}
      if(state.view==='bag'&&!state.combined&&['arm','place-item','align'].includes(action)){
        if(action==='arm'&&state.items.includes(value))armed=value;
        else if(action==='place-item'&&['first','second'].includes(value)){
          if(state.items.includes(armed))draft[value]=armed;
          else notice='Selecciona un objeto de la bandeja primero.';
        }else if(action==='align'&&['izquierda','derecha'].includes(value))draft.side=value;
        else return;
        draw(notice?'notice':false);
        if(!notice)host.querySelector('[data-c87="'+action+'"][data-value="'+value+'"]')?.focus();
        return;
      }
      if(action==='next'){
        const step=nextStep();
        action=step.type;value=step.place||step.view;
      }
      if(action==='view'){goTo(value);return;}
      else if(action==='role'){state.role=otherRole(state.role);state.view='explore';state.detail=null;curtain=state.mode==='duo';transcript=false;draft={};}
      else if(action==='place' && roles[state.role].places.includes(value)){
        state.view='explore';state.detail=value;transcript=false;
        if(value==='libro'&&!state.seen.includes('register'))state.seen.push('register');
      }else if(action==='back'){state.detail=null;transcript=false;}
      else if(action==='transcript' && state.role==='cabina'&&state.detail==='magnetofono'){transcript=true;markSignal();}
      else if(action==='take' && ['acetato','hoja'].includes(value)&&state.detail===value && !state.items.includes(value)){
        state.items.push(value);notice=objects[value]+' en el inventario.';
      }else if(action==='hint' && state.view==='hints' && !state.solved && state.hints<3){state.hints++;event('hint');}
      else if(action==='ending' && state.solved && Object.hasOwn(endings,value)){state.ending=value;event('complete');}
      else return;
      commit();
      const focus=action==='hint'?'hint':action==='transcript'?'transcript':notice?'notice':true;
      draw(focus);
    }
    function previewSlot(e){
      const field=e.target,form=field.form;
      if(form?.dataset.c87Form==='deduce'&&['box','mark'].includes(field.name)){
        draft[field.name]=field.value;
        return;
      }
      if(form?.dataset.c87Form!=='combine'||!['first','second','side'].includes(field.name))return;
      draft[field.name]=field.value;
      const template=form.ownerDocument.createElement('template');
      template.innerHTML=lightTable();
      for(const selector of ['.c87-supports','.c87-registration'])form.querySelector(selector).replaceWith(template.content.querySelector(selector));
    }
    function submit(e){
      const form=e.target;
      if(!form.matches?.('form[data-c87-form]'))return;
      e.preventDefault();
      if(!state||curtain||resetting||state.ending)return;
      const field=name=>form.elements.namedItem(name)?.value||'';
      if(form.dataset.c87Form==='combine' && state.view==='bag' && !state.combined && state.items.includes('acetato') && state.items.includes('hoja')){
        draft.first=field('first');draft.second=field('second');draft.side=field('side');
        if(!window.MotorAventuras.evaluarPrueba(overlayMaterials,[draft.first,draft.second]))notice='La mesa necesita una lámina con ventana y una hoja impresa.';
        else if(!window.MotorAventuras.evaluarPrueba(overlayEdge,draft.side))notice='Siguen viéndose dos tiradas. Comprueba dónde estaba la franja negra de la hoja.';
        else{state.combined=true;notice='Se ve una única tirada. La tabla de cajas está lista.';event('receipt');}
      }else if(form.dataset.c87Form==='deduce' && state.view==='deduction'&&!state.solved&&state.combined&&state.seen.length===2){
        draft.box=field('box');draft.mark=field('mark');
        if(window.MotorAventuras.evaluarPrueba(manifestRule,[draft.box,draft.mark])){state.solved=true;notice='Has localizado el original.';event('solved');}
        else notice='Esa combinación no coincide con las dos pruebas. Coteja la señal y el precinto en la misma fila.';
      }else return;
      commit();draw(state.solved?true:'notice');
    }
    function pilotText(){
      if(!transcript&&!window.GamePreferences?.transcripts)return control('transcript','Ver la señal y leer la transcripción');
      const trace='<figure class="c87-trace" data-c87-transcript tabindex="-1">'+signalStrip(manifestRule.parametros.senal)+'<figcaption>Clic de arranque. Dos pulsos cortos, seguidos de un pulso largo. Después se oye el soplo de la cinta y un clic de parada.</figcaption></figure>';
      return trace+(state.seen.includes('signal')?'':control('transcript','Anotar la señal en mi carpeta'));
    }
    function updatePilotText(){
      const region=host.querySelector('[data-c87-pilot-text]');
      if(!region||!state||state.detail!=='magnetofono')return;
      const focused=region.contains(host.ownerDocument.activeElement);
      region.innerHTML=pilotText();
      if(focused)region.querySelector('button,figure')?.focus({preventScroll:true});
    }
    function audioEnded(e){
      if(!e.target.hasAttribute?.('data-c87-pilot')||!state||curtain||state.role!=='cabina'||state.detail!=='magnetofono'||disposed)return;
      markSignal();commit();notice='Señal del piloto examinada. El carrete queda en el inventario.';draw('notice');
    }
    function storage(e){
      if(e.key!==storageKey && e.key!==null)return;
      state=read();curtain=state?.mode==='duo'&&!state.ending;transcript=false;alternate=false;resetting=false;draft={};
      notice='El progreso se ha actualizado en otra pestaña.';draw();
    }
    host.addEventListener('click',click);host.addEventListener('change',previewSlot);host.addEventListener('submit',submit);host.addEventListener('ended',audioEnded,true);
    function offerReady(){
      const link=host.querySelector('[data-c87-offer]'),offer=window.ClubAccess?.offerAction;
      if(!link||!offer||window.ClubAccess?.canPlay)return;
      link.href=offer.href;link.textContent=offer.label;
      const price=host.querySelector('[data-c87-offer-price]');
      if(price&&window.ClubAccess.price)price.textContent=window.ClubAccess.price+' por persona al mes.';
    }
    window.addEventListener('storage',storage);window.addEventListener('club-offer-ready',offerReady);
    host.ownerDocument?.addEventListener('game-preferences-change',updatePilotText);
    const handle={destroy(){
      if(disposed)return;
      disposed=true;host.ownerDocument?.removeEventListener('game-preferences-change',updatePilotText);worktop?.destroy();stopAudio();host.removeEventListener('click',click);host.removeEventListener('change',previewSlot);host.removeEventListener('submit',submit);
      host.removeEventListener('ended',audioEnded,true);window.removeEventListener('storage',storage);window.removeEventListener('club-offer-ready',offerReady);host.replaceChildren();mounts.delete(host);
    }};
    mounts.set(host,handle);draw();
    return handle;
  }
  window.Cinta87Demo=Object.freeze({mount,hasProgress:()=>Boolean(read()),isComplete:()=>Boolean(read()?.ending)});
})();
