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
  const boxNames = {a4:'A4',b6:'B6',c2:'C2'};
  const marks = {circulo:'Precinto circular',triangulo:'Precinto triangular',cuadrado:'Precinto cuadrado'};
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
  function fresh(mode) {
    return {version:1,mode,role:'cabina',view:'explore',detail:null,seen:[],items:[],combined:false,solved:false,ending:null,hints:0};
  }
  function normalise(raw) {
    if(raw?.version!==1 || !['solo','duo'].includes(raw.mode))return null;
    const state=fresh(raw.mode);
    state.role=Object.hasOwn(roles,raw.role)?raw.role:'cabina';
    state.view=['explore','bag','deduction'].includes(raw.view)?raw.view:'explore';
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
    return '<label>'+safe(label)+'<select name="'+name+'" required><option value="">Elige una opción</option>'+
      Object.entries(choices).map(([key,text])=>option(key,text,selected)).join('')+'</select></label>';
  }
  function mount(host,options={}) {
    mounts.get(host)?.destroy();
    const exitLabel=options.exitLabel||'Volver al catálogo';
    let state=read(),curtain=state?.mode==='duo'&&!state.ending,resetting=false,alternate=false;
    let transcript=false,showHints=false,notice='',disposed=false,draft={};
    function event(name){try{options.onEvent?.(name)?.catch?.(()=>{});}catch{/* Analytics do not gate play. */}}
    function commit(){save(state);}
    function stopAudio(){for(const node of host.querySelectorAll('audio'))node.pause();}
    function draw(focus=false){
      if(disposed)return;
      stopAudio();
      let page;
      if(resetting)page=resetPage();
      else if(!state)page=prologue();
      else if(curtain)page=handoff();
      else if(state.ending)page=endingPage();
      else page=desk();
      host.innerHTML='<div class="c87">'+page+(!state||curtain||resetting||state.ending?feedback():'')+'</div>';
      if(focus){
        const targets={notice:'[data-c87-status]',hint:'[data-c87-last-hint]',hints:'[data-c87-hint-heading]',transcript:'[data-c87-transcript]'};
        host.querySelector(targets[focus]||'[data-c87-heading]')?.focus();
      }
    }
    function feedback(){return '<p class="c87-status" role="status" aria-live="polite" tabindex="-1" data-c87-status>'+safe(notice)+'</p>';}
    function prologue(){
      return '<section class="c87-opening"><div class="c87-poster"><img src="/cinta87-mesa.webp" alt="Una cinta de casete y material del archivo de radio sobre una mesa."></div>'+
        '<div class="c87-opening-copy"><p class="c87-kicker">Archivo de Radio Valdemar · Demo gratuita</p>'+
        '<h1 tabindex="-1" data-c87-heading>La cinta 87</h1><p class="c87-lead">La última emisión de la estación está a punto de salir en antena otra vez. En el archivo quedan tres cajas y una sola contiene la grabación original.</p>'+
        '<p>Escucha la cinta piloto, localiza la bobina y decide qué hacer con su contenido.</p>'+
        '<p class="c87-meta">10–15 min aprox. · Un dispositivo · Guardado local</p><div class="c87-actions">'+
        control('start','Jugar en solitario','solo',true)+control('start','Jugar en pareja','duo')+'</div>'+
        '<p class="c87-small">En solitario consultas ambas carpetas. En pareja os turnáis con el dispositivo y compartís en voz alta vuestras pistas.</p>'+
        '<div class="c87-links">'+control('archive','Archivo de Marta y Tomás')+control('exit',exitLabel)+'</div></div></section>';
    }
    function handoff(){
      const role=roles[state.role];
      return '<section class="c87-curtain"><p class="c87-kicker">La cinta 87 · Relevo privado</p>'+heading('Entrega el dispositivo a '+role.name)+
        '<p>La persona que lleva '+role.name+' abre su carpeta cuando la otra haya dejado de mirar. Después podréis contaros lo que habéis averiguado.</p>'+
        '<div class="c87-actions">'+control('uncover','Ya tengo el dispositivo','',true)+control('exit',exitLabel)+'</div></section>';
    }
    function table(){
      return '<div class="c87-table"><table><caption>Hoja de traslados · Último turno</caption><thead><tr><th scope="col">Caja</th><th scope="col">Señal de arranque</th><th scope="col">Precinto</th></tr></thead>'+
        '<tbody><tr><th scope="row">A4</th><td>Corto · corto · largo</td><td>Circular</td></tr><tr><th scope="row">B6</th><td>Corto · largo · largo</td><td>Triangular</td></tr>'+
        '<tr><th scope="row">C2</th><td>Corto · corto · largo</td><td>Triangular</td></tr></tbody></table></div>';
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
        return '<section class="c87-room" data-c87-room="'+state.role+'"><div class="c87-room-art"><img src="/cinta87-mesa.webp" alt="" loading="lazy"></div><div>'+
          '<p class="c87-kicker">'+role.name+'</p>'+heading(role.room)+'<p>'+role.task+'</p><div class="c87-stations">'+
          role.places.map(key=>'<button type="button" data-c87="place" data-value="'+key+'"><strong>'+places[key]+'</strong><span>'+(examined(key)?'✓ Consultado':labels[key])+'</span></button>').join('')+
          '</div>'+feedback()+(role.places.every(examined)?nextButton():'')+'</div></section>';
      }
      let detail;
      if(id==='magnetofono'){
        detail='<p>El carrete piloto conserva el arranque de la última emisión. La ficha de su caja se perdió. Escucha la señal que precede al soplo.</p>'+
          '<audio controls preload="none" data-c87-pilot aria-label="Cinta piloto de la última emisión"><source src="/cinta87-piloto.wav" type="audio/wav"></audio>'+
          (transcript?'<blockquote data-c87-transcript tabindex="-1">Clic de arranque. Dos pulsos cortos, seguidos de un pulso largo. Después se oye el soplo de la cinta y un clic de parada.</blockquote>':control('transcript','Leer la transcripción'))+
          (state.seen.includes('signal')?'<p class="c87-filed">Señal del piloto examinada</p>':'');
      }else if(id==='acetato'){
        detail='<p>Una lámina opaca tiene una sola ventana transparente. En el borde, alguien ha escrito a lápiz:</p><blockquote>Para leer la última tirada, pon la muesca del acetato sobre la franja negra de la hoja de contactos.</blockquote>'+objectButton('acetato');
      }else if(id==='libro'){
        detail='<p>El parte del cierre distingue los originales de la unidad móvil de las copias que preparó la fonoteca.</p><blockquote>Original de andén: precinto triangular. Duplicado de escucha: precinto circular. En ambos puede repetirse la misma señal de arranque.</blockquote>'+
          '<p class="c87-filed">Registro consultado</p>';
      }else{
        detail='<p>Las fichas de dos turnos están impresas una encima de otra. Se distinguen tres cajas, A4, B6 y C2, pero los sellos y las señales se superponen.</p>'+
          '<blockquote>Una franja negra recorre el margen izquierdo de la hoja. En el derecho solo hay una perforación de archivador.</blockquote>'+objectButton('hoja');
      }
      return '<section class="c87-paper"><p class="c87-kicker">'+role.room+'</p>'+heading(places[id])+detail+feedback()+(examined(id)?nextButton():'')+
        '<div class="c87-links">'+control('back','Volver a '+role.room.toLowerCase())+'</div></section>';
    }
    function bag(){
      const held=Object.fromEntries(state.items.map(id=>[id,objects[id]]));
      const contents=state.items.length?'<ul class="c87-inventory">'+state.items.map(id=>'<li>'+objects[id]+'</li>').join('')+'</ul>':'<p>Aún no hay objetos. Explora las dos carpetas para reunir el material.</p>';
      let work='';
      if(state.combined)work=table()+feedback()+nextButton();
      else if(state.items.includes('acetato') && state.items.includes('hoja'))work='<form data-c87-form="combine"><fieldset><legend>Revelar la ficha del último turno</legend>'+
        select('first','Primer objeto',held,draft.first)+select('second','Segundo objeto',held,draft.second)+
        select('side','¿Dónde colocas la muesca?',{izquierda:'Margen izquierdo',derecha:'Margen derecho'},draft.side)+
        '<button type="submit" class="c87-control c87-primary">Superponer los objetos</button></fieldset></form>'+feedback();
      else work='<p>La mesa de cotejo necesita un material de cada carpeta.</p>'+feedback()+nextButton();
      return '<section class="c87-paper"><p class="c87-kicker">Mesa compartida</p>'+heading('Inventario')+contents+work+'</section>';
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
        table()+'<form data-c87-form="deduce"><fieldset><legend>Identificar la grabación original</legend>'+
        select('box','¿Qué caja abrirás?',boxNames,draft.box)+select('mark','¿Qué precinto acredita que es el original?',marks,draft.mark)+
        '<button type="submit" class="c87-control c87-primary">Contrastar la deducción</button></fieldset></form>'+feedback();
      return '<section class="c87-paper"><p class="c87-kicker">Mesa compartida</p>'+heading('¿Dónde está la cinta 87?')+work+'</section>';
    }
    function hints(){
      if(!showHints)return '';
      return '<aside class="c87-hints"><h3 data-c87-hint-heading tabindex="-1">Ayudas de la demo</h3>'+
        (state.hints?'<ol>'+guidance.slice(0,state.hints).map((t,i)=>'<li'+(i===state.hints-1?' data-c87-last-hint tabindex="-1"':'')+'>'+t+'</li>').join('')+'</ol>':'<p>Abre una orientación si te has atascado.</p>')+
        (state.hints<3?control('hint',state.hints===2?'Mostrar la solución completa':state.hints?'Abrir la siguiente pista':'Abrir la primera pista'):'')+'</aside>';
    }
    function desk(){
      const role=roles[state.role];
      return '<header class="c87-bar"><div><small>Demo gratuita · La cinta 87</small><strong>'+role.name+' · '+(state.mode==='solo'?'En solitario':'En pareja')+'</strong></div>'+
        control('role',state.mode==='duo'?'Dar el relevo a '+roles[otherRole(state.role)].name:'Cambiar a '+roles[otherRole(state.role)].name)+'</header>'+
        '<nav class="c87-tabs" aria-label="Mesa de investigación">'+[['explore','Explorar'],['bag','Inventario'],['deduction','Deducción']].map(([key,label])=>
          '<button type="button" data-c87="view" data-value="'+key+'"'+(state.view===key?' aria-current="page"':'')+'>'+label+'</button>').join('')+'</nav>'+
        (state.view==='bag'?bag():state.view==='deduction'?deduction():investigation())+
        (state.solved?'':'<div class="c87-links">'+control('hints',showHints?'Cerrar ayudas':'Pedir una pista')+'</div>'+hints())+
        '<footer class="c87-foot"><span>'+savedMessage()+'</span><div class="c87-links">'+control('exit',exitLabel)+control('reset','Reiniciar demo')+'</div></footer>';
    }
    function savedMessage(){return storageBlocked?'Guardado temporal en esta página.':'Progreso guardado en este navegador.';}
    function endingPage(){
      const key=alternate?(state.ending==='emitir'?'custodiar':'emitir'):state.ending,ending=endings[key];
      return '<section class="c87-ending"><p class="c87-kicker">'+(alternate?'Lectura alternativa':'Desenlace guardado')+'</p>'+heading(ending.title)+'<p class="c87-lead">'+ending.text+'</p>'+
        (alternate?'<p class="c87-small">Tu elección guardada sigue siendo «'+endings[state.ending].label+'».</p>':
          '<div class="c87-souvenir"><strong>Ficha de oyente · Cinta 87</strong><p>Recuerdo de muestra guardado en este navegador. No añade llaves al pase de temporada.</p></div>')+
        '<div class="c87-actions">'+control('exit',exitLabel,'',true)+control('alternate',alternate?'Volver a mi desenlace':'Leer el otro desenlace')+'</div>'+
        '<div class="c87-links">'+control('archive','Archivo de Marta y Tomás')+control('reset','Volver a jugar desde el principio')+'</div></section>';
    }
    function resetPage(){
      return '<section class="c87-paper">'+heading('¿Reiniciar La cinta 87?')+'<p>Se perderá el progreso de esta demo en este navegador. Los expedientes de Marta y Tomás se guardan por separado.</p>'+
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
      if(action==='exit'||action==='archive'){
        stopAudio();
        const callback=action==='exit'?options.onExit:options.onArchive;
        if(callback)callback();else if(action==='exit')window.location.assign('/#casos');else window.location.assign('/cinta-87.html?archivo=1');
        return;
      }
      if(action==='reset'){resetting=true;draw(true);return;}
      if(action==='cancel-reset'){resetting=false;draw(true);return;}
      if(action==='confirm-reset' && resetting){state=null;save(null);resetting=false;curtain=false;alternate=false;transcript=false;showHints=false;draft={};draw(true);return;}
      if(resetting)return;
      if(action==='start'&&!state && ['solo','duo'].includes(value)){
        state=fresh(value);curtain=value==='duo';commit();event('start');draw(true);return;
      }
      if(!state)return;
      if(action==='uncover' && curtain){curtain=false;draw(true);return;}
      if(curtain)return;
      if(state.ending){if(action==='alternate'){alternate=!alternate;draw(true);}return;}
      if(action==='next'){
        const step=nextStep();
        action=step.type;value=step.place||step.view;
      }
      if(action==='view' && ['explore','bag','deduction'].includes(value)){state.view=value;showHints=false;}
      else if(action==='role'){state.role=otherRole(state.role);state.view='explore';state.detail=null;curtain=state.mode==='duo';transcript=false;showHints=false;draft={};}
      else if(action==='place' && roles[state.role].places.includes(value)){
        state.view='explore';state.detail=value;transcript=false;
        if(value==='libro'&&!state.seen.includes('register'))state.seen.push('register');
      }else if(action==='back'){state.detail=null;transcript=false;}
      else if(action==='transcript' && state.role==='cabina'&&state.detail==='magnetofono'){transcript=true;markSignal();}
      else if(action==='take' && ['acetato','hoja'].includes(value)&&state.detail===value && !state.items.includes(value)){
        state.items.push(value);notice=objects[value]+' en el inventario.';
      }else if(action==='hints'){showHints=!showHints;}
      else if(action==='hint' && showHints && state.hints<3){state.hints++;event('hint');}
      else if(action==='ending' && state.solved && Object.hasOwn(endings,value)){state.ending=value;event('complete');}
      else return;
      commit();
      const focus=action==='hint'?'hint':action==='hints'&&showHints?'hints':action==='transcript'?'transcript':notice?'notice':true;
      draw(focus);
    }
    function submit(e){
      const form=e.target;
      if(!form.matches?.('form[data-c87-form]'))return;
      e.preventDefault();
      if(!state||curtain||resetting||state.ending)return;
      const field=name=>form.elements.namedItem(name)?.value||'';
      if(form.dataset.c87Form==='combine' && state.view==='bag' && !state.combined && state.items.includes('acetato') && state.items.includes('hoja')){
        draft.first=field('first');draft.second=field('second');draft.side=field('side');
        const selected=new Set([draft.first,draft.second]);
        if(!selected.has('acetato')||!selected.has('hoja'))notice='La mesa necesita una lámina con ventana y una hoja impresa.';
        else if(draft.side!=='izquierda')notice='Siguen viéndose dos tiradas. Comprueba dónde estaba la franja negra de la hoja.';
        else{state.combined=true;notice='Se ve una única tirada. La tabla de cajas está lista.';event('receipt');}
      }else if(form.dataset.c87Form==='deduce' && state.view==='deduction'&&!state.solved&&state.combined&&state.seen.length===2){
        draft.box=field('box');draft.mark=field('mark');
        if(draft.box==='c2' && draft.mark==='triangulo'){state.solved=true;notice='Has localizado el original.';event('solved');}
        else notice='Esa combinación no coincide con las dos pruebas. Coteja la señal y el precinto en la misma fila.';
      }else return;
      commit();draw(state.solved?true:'notice');
    }
    function audioEnded(e){
      if(!e.target.hasAttribute?.('data-c87-pilot')||!state||curtain||state.role!=='cabina'||state.detail!=='magnetofono'||disposed)return;
      markSignal();commit();notice='Señal del piloto examinada. El carrete queda en el inventario.';draw('notice');
    }
    function storage(e){
      if(e.key!==storageKey && e.key!==null)return;
      state=read();curtain=state?.mode==='duo'&&!state.ending;showHints=false;transcript=false;alternate=false;resetting=false;draft={};
      notice='El progreso se ha actualizado en otra pestaña.';draw();
    }
    host.addEventListener('click',click);host.addEventListener('submit',submit);host.addEventListener('ended',audioEnded,true);
    window.addEventListener('storage',storage);
    const handle={destroy(){
      if(disposed)return;
      disposed=true;stopAudio();host.removeEventListener('click',click);host.removeEventListener('submit',submit);
      host.removeEventListener('ended',audioEnded,true);window.removeEventListener('storage',storage);host.replaceChildren();mounts.delete(host);
    }};
    mounts.set(host,handle);draw();
    return handle;
  }
  window.Cinta87Demo=Object.freeze({mount,hasProgress:()=>Boolean(read()),isComplete:()=>Boolean(read()?.ending)});
})();
