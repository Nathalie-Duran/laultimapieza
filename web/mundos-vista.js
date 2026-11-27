(() => {
  'use strict';

  const editions = {
    expedicion: {
      number:2, offset:12, title:'El Tablero de Ámbar', short:'Tablero de Ámbar',
      genre:'Aventuras',station:'Casilla',count:'expediciones',progress:'expediciones completadas',done:'Expedición completada.',notebook:'Cuaderno de campo',
      previous:{from:'de Valdemar',back:'Volver a Valdemar',href:'#casos'},
      image:'/ambar-tallado.webp', imageAlt:'Tablero de madera abierto, con animales tallados, dados y caminos de losas que rodean una gema de ámbar.',
      intro:'Coloca tu peón en una de las doce casillas. Toca el ámbar del centro para ver las piezas que has recuperado.',
      seal:'Medallón de Ámbar', sealCenter:[52,46.7],
      boardLabel:'Tablero de las doce expediciones', index:'Índice de expediciones',
      selectLabel:'Mover el peón a', launch:'Iniciar expedición', returnLabel:'Volver al tablero',
      positions:[[19.2,89],[49.8,89],[78,72.7],[80.9,37],[51.1,17.8],[24.7,37.5],[28.3,66],[44.4,75.5],[36.2,50.9],[50.6,31.1],[68.1,48.3],[53.9,61.5]]
    },
    umbravia: {
      number:3, offset:24, title:'Umbravía', short:'Umbravía',
      genre:'Terror psicológico',station:'Lugar',count:'lugares',progress:'faroles encendidos',done:'Caso resuelto, farol encendido.',notebook:'Archivo del pueblo',
      previous:{from:'del Tablero de Ámbar',back:'Volver al Tablero de Ámbar',href:'#expedicion'},
      image:'/umbravia-farol.webp', imageAlt:'Un farol de vidrio verde ilumina el pueblo abandonado. Entre la niebla se distinguen el carrusel, el cine y el campanario.',
      intro:'En el cine, una silueta cruza la pantalla desconectada. Elige una puerta para investigar o toca el farol verde para ver las piezas de tu sello.',
      seal:'Farol de Umbravía',sealCenter:[52.3,78.7],
      boardLabel:'Calles del pueblo abandonado de Umbravía', index:'Directorio del pueblo',
      selectLabel:'Localizar', launch:'Entrar en el caso', returnLabel:'Volver al pueblo',
      positions:[[17,27],[36,28],[63,28],[80,30],[13,46],[36,44],[60,49],[84,45],[17,77],[36,70],[61,73],[87,76]]
    },
    necropolis: {
      number:4,offset:36,title:'La Necrópolis del Sol Velado',short:'La Necrópolis',
      genre:'Aventuras en el antiguo Egipto',station:'Cámara',count:'cámaras',progress:'cámaras resueltas',done:'Cámara resuelta, pieza del disco recuperada.',notebook:'Cuaderno de excavación',
      previous:{from:'de Umbravía',back:'Volver a Umbravía',href:'#umbravia'},
      image:'/necropolis-descenso.webp',imageAlt:'Corte de la necrópolis de Neryt. Bajo el disco solar, las escaleras comunican tres niveles de cámaras pintadas.',
      intro:'Del embarcadero a la tumba de Neryt, doce cámaras descienden bajo la arena. Elige un cartucho para explorar su cámara.',
      seal:'Disco del Sol Velado',sealCenter:[50,0],
      boardLabel:'Las doce cámaras de la Necrópolis del Sol Velado',index:'Directorio de las cámaras',
      selectLabel:'Explorar',launch:'Entrar en la cámara',returnLabel:'Volver a la necrópolis',
      positions:[[14,38.8],[37.5,38.8],[62,38.8],[87.6,38.8],[13.5,63.5],[37.8,63.5],[63.9,63.5],[87.3,63.5],[12.5,93.5],[37.5,93.5],[61.8,93.5],[86.7,93.5]]
    }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = n => String(n).padStart(2,'0');
  const catalog = () => window.MundosCatalogo || [];
  const story = id => catalog().find(item=>item.id===Number(id));
  const route = (world,id) => '#'+world+'?lugar='+(id-editions[world].offset);
  const nameOf = world => editions[world]?.title || '';
  let board, intent;

  function boardData(world) {
    const edition=editions[world];
    if (!edition) return {};
    const candidates=catalog().filter(item=>item.world===world).sort((a,b)=>a.id-b.id);
    const requested=new URLSearchParams(location.hash.split('?')[1] || '').get('lugar');
    const stop=/^(?:[1-9]|1[0-2])$/.test(requested || '') ? Number(requested):1;
    return {edition,candidates,item:candidates.find(item=>item.id===edition.offset+stop) || candidates[0]};
  }
  function pin(edition,world,item,current) {
    const local=item.id-edition.offset;
    const [x,y]=edition.positions[local-1];
    return `<a class="md-pin" href="${route(world,item.id)}" style="--x:${x}%;--y:${y}%" data-md-edge="${x<24?'left':x>76?'right':'center'}" data-md-id="${item.id}" data-md-way="pin" aria-label="${esc(edition.selectLabel+' '+item.place+'. '+item.title)}" aria-controls="md-file"${item.id===current?' aria-current="location"':''}><span class="md-pin-face">${number(local)}</span><span class="md-pin-tooltip" aria-hidden="true">${esc(item.place)}</span></a>`;
  }
  function indexEntry(edition,world,item,current) {
    const local=item.id-edition.offset;
    return `<li><a href="${route(world,item.id)}" data-md-id="${item.id}" data-md-way="index" aria-controls="md-file"${item.id===current?' aria-current="location"':''}><span>${number(local)}</span><strong>${esc(item.place)}</strong><small>${esc(item.title)}</small></a></li>`;
  }
  function sealLink(edition,world,local,onBoard=false) {
    if(!edition.seal)return '';
    let label='Ver el '+edition.seal;
    if(world==='necropolis'&&!onBoard)label='Ver las piezas del disco';
    if(world==='umbravia'&&onBoard)label='Abrir el sello del Farol de Umbravía';
    const position=onBoard?` style="--x:${edition.sealCenter[0]}%;--y:${edition.sealCenter[1]}%"`:'';
    return `<a class="${onBoard?'md-gem-link':'md-seal-link'}" href="#${world}?lugar=${local}&amp;seccion=sello"${position}>${onBoard?'<span>'+esc(label)+'</span>':esc(label)}</a>`;
  }
  const levels=['I','II','III'];
  function chamberLevels(edition,world,level) {
    return '<nav class="md-strata" aria-label="Niveles de la necrópolis">'+levels.map((numeral,index)=>{
      const start=1+index*4, id=edition.offset+start;
      return `<a href="${route(world,id)}" data-md-way="level" data-md-id="${id}" aria-label="Nivel ${numeral}, cámaras ${start} a ${start+3}"${index===level?' aria-current="true"':''}><span>Nivel ${numeral}</span><small>${number(start)}–${number(start+3)}</small></a>`;
    }).join('')+'</nav>';
  }
  function accessMarkup(edition,item,allowed,completed,status) {
    if(allowed)return `<a class="md-cta" href="#mundos-jugar?id=${item.id}">${completed?'Ver mi desenlace':edition.launch} <span aria-hidden="true">→</span></a>`;
    const block=Math.ceil((item.id-edition.offset)/4);
    const info=status?.previousReady ? 'Este caso pertenece al bloque '+block+' de este tablero. Consulta los bloques abonados en tu pase.' :
      'Completa los doce casos '+edition.previous.from+' para acceder. '+(status?'Llevas '+status.previousCompleted+' de 12. ':'')+'Al terminar podrás jugar a los bloques que tengas abonados.';
    return `<p class="md-locked-note">${esc(info)}</p><a class="md-cta md-cta-secondary" href="${status?.previousReady?'#planes':edition.previous.href}">${status?.previousReady?'Consultar mi pase':edition.previous.back} <span aria-hidden="true">→</span></a>`;
  }
  function view(world,options={}) {
    const {edition,candidates,item}=boardData(world);
    if (!edition || !item) return '<section class="md-missing"><h1>Colección no disponible</h1><a href="#casos">Volver a los casos</a></section>';
    const local=item.id-edition.offset, previous=candidates[(local+10)%12], next=candidates[local%12];
    const old=board?.element?.isConnected && board.world===world ? board.element : null;
    const enlarged=old?.querySelector('.md-map-window')?.dataset.zoom==='true';
    const open=old?.querySelector('.md-directory')?.open;
    const allowed=options.admin===true || options.role==='admin' || options.membership?.role==='admin';
    const egypt=world==='necropolis', level=Math.floor((local-1)/4);
    const figureCaption=(egypt?'Nivel '+levels[level]+' · ':'')+edition.station+' '+number(local);
    return `<section class="md-world" data-md-world="${world}" data-md-selected="${item.id}" data-md-editor="${allowed}" aria-labelledby="md-world-title">
      <header class="md-mast"><div><p class="md-caption">Temporada ${number(edition.number)} · ${esc(edition.genre)}</p><h1 id="md-world-title">${esc(edition.title)}</h1></div><div class="md-mast-end"><p>${esc(edition.intro)}</p>${world==='umbravia'||egypt?sealLink(edition,world,local):''}</div></header>
      <div class="md-atlas"><div class="md-board">
        <div class="md-map-window" data-zoom="${!!enlarged}" role="region" tabindex="0" aria-label="${esc(edition.boardLabel)}"><div class="md-surface">
          <img class="md-map-art" src="${edition.image}" width="1536" height="1024" alt="${esc(edition.imageAlt)}" fetchpriority="high">
          <div class="md-pins">${candidates.map(v=>pin(edition,world,v,item.id)).join('')}${edition.sealCenter?sealLink(edition,world,local,true):''}</div></div></div>
        ${egypt?chamberLevels(edition,world,level):''}<div class="md-board-tools"><span class="md-board-status" data-md-progress>12 ${esc(edition.count)}</span>${world==='expedicion'?'<button type="button" class="md-roll" aria-describedby="md-roll-note" disabled>Mover el peón</button>':''}<button type="button" class="md-zoom" aria-pressed="${!!enlarged}">${enlarged?'Ver completo':'Ampliar'}</button></div>${world==='expedicion'?'<p id="md-roll-note" class="md-board-note" aria-live="polite"></p>':''}</div>
        <article class="md-file" id="md-file" aria-labelledby="md-case-title"><figure><img src="/mundo-${item.id}.webp" width="768" height="512" alt="" decoding="async"><figcaption>${esc(figureCaption)}</figcaption></figure><div class="md-file-copy">
          <p class="md-caption">${esc(item.place)}</p><h2 id="md-case-title" tabindex="-1">${esc(item.title)}</h2><p class="md-question">${esc(item.question)}</p>
          <p class="md-facts"><span>≈ 60 min</span><span>1–2 personas</span><span>Bloque ${Math.ceil(local/4)} de 3</span></p>
          <div class="md-access">${accessMarkup(edition,item,allowed,false)}</div><button type="button" class="md-back-pin">${esc(edition.returnLabel)}</button>
          </div><nav class="md-stepper" aria-label="Recorrer los doce casos"><a href="${route(world,previous.id)}" data-md-way="step" data-md-id="${previous.id}" aria-label="Anterior. ${esc(previous.place)}">← Anterior</a><span>${number(local)} / 12</span><a href="${route(world,next.id)}" data-md-way="step" data-md-id="${next.id}" aria-label="Siguiente. ${esc(next.place)}">Siguiente →</a></nav></article></div>
      <details class="md-directory"${open?' open':''}><summary>${esc(edition.index)} <span>12</span></summary><ol>${candidates.map(v=>indexEntry(edition,world,v,item.id)).join('')}</ol></details></section>`;
  }
  function center(node,pin) {
    if (!pin || node.scrollWidth<=node.clientWidth+2 && node.scrollHeight<=node.clientHeight+2) return;
    const s=pin.getBoundingClientRect(), bounds=node.getBoundingClientRect();
    if(s.left<bounds.left+8 || s.right>bounds.right-8) node.scrollLeft+=(s.left+s.right-bounds.left-bounds.right)/2;
    if(s.top<bounds.top+8 || s.bottom>bounds.bottom-8) node.scrollTop+=(s.top+s.bottom-bounds.top-bounds.bottom)/2;
  }
  function focusFile(node) {
    const title=node.querySelector('#md-case-title');
    title.focus({preventScroll:true});
    const r=title.getBoundingClientRect();
    if(r.top<88 || r.bottom>window.innerHeight-58) node.querySelector('.md-file').scrollIntoView({block:'start',behavior:'instant'});
  }
  function focusPin(pane,pin) {
    center(pane,pin);
    pin.focus({preventScroll:true});
    pin.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  }
  function keyboard(event) {
    const pin=event.target.closest('.md-pin'),key=event.key;
    if (!pin || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const pins=[...event.currentTarget.querySelectorAll('.md-pin')],at=pins.indexOf(pin);
    const vertical=event.currentTarget.dataset.mdWorld==='necropolis'?4:1;
    const move={ArrowRight:1,ArrowDown:vertical,ArrowLeft:-1,ArrowUp:-vertical};
    let target;
    if (key in move) target=pins[(at+move[key]+pins.length)%pins.length];
    else if(key==='Home')target=pins[0]; else if(key==='End')target=pins.at(-1); else return;
    event.preventDefault();center(event.currentTarget.querySelector('.md-map-window'),target);target.focus({preventScroll:true});
  }
  function mount(world,bridge,access) {
    const node=document.querySelector('.md-world[data-md-world="'+world+'"]');
    if(!node || board?.element===node)return;
    const local={world,element:node};board=local;
    const id=Number(node.dataset.mdSelected),item=story(id),edition=editions[world];
    const pane=node.querySelector('.md-map-window'),selected=node.querySelector('.md-pin[aria-current]');
    const roll=node.querySelector('.md-roll'),note=node.querySelector('#md-roll-note');
    const destinations=catalog().filter(entry=>entry.world===world);
    let possible=[];
    function updateRoll(items,message) {
      if(!roll)return;
      possible=items;roll.disabled=items.length===0;
      note.textContent=message;
    }
    const suggestion=intent?.hash===location.hash && intent.roll ? 'Destino sugerido: '+item.place+'. ' : '';
    if(!bridge?.isSignedIn?.())updateRoll(destinations,suggestion+'El peón te lleva a la vista previa de una expedición al azar.');
    else updateRoll([],'Consultando tus expediciones abiertas…');
    node.addEventListener('keydown',keyboard);
    node.addEventListener('click',event=>{
      if(event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || event.button!==0)return;
      if(event.target.closest('.md-roll') && possible.length){
        const others=possible.filter(v=>v.id!==id);
        const pool=others.length?others:possible;
        const pick=pool[Math.floor(Math.random()*pool.length)];
        const dest=route(world,pick.id);
        if(dest===location.hash){note.textContent='Destino sugerido: '+pick.place+'.';focusFile(node);}
        else {intent={hash:dest,roll:true};location.hash=dest;}
        return;
      }
      const zoom=event.target.closest('.md-zoom');
      if(zoom){
        const next=pane.dataset.zoom!=='true';pane.dataset.zoom=String(next);
        zoom.setAttribute('aria-pressed',String(next));zoom.textContent=next?'Ver completo':'Ampliar';
        center(pane,selected);return;
      }
      if(event.target.closest('.md-back-pin')){
        center(pane,selected);selected.focus({preventScroll:true});selected.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return;
      }
      const link=event.target.closest('a[data-md-id]');
      if(!link)return;
      const level=link.dataset.mdWay==='level';
      if(link.hash===location.hash){event.preventDefault();if(level)focusPin(pane,selected);else focusFile(node);}
      else intent={hash:link.hash,level};
    });
    center(pane,selected);
    if(intent?.hash===location.hash) {if(intent.level)focusPin(pane,selected);else focusFile(node);}
    intent=null;
    if(!bridge?.isSignedIn?.())return;
    (access||bridge.request('/api/valdemar/seasons')).then(data=>{
      if(board!==local || !node.isConnected || !bridge.isSignedIn())return;
      const done=new Set(data.completed || []);
      for(const link of node.querySelectorAll('[data-md-way="pin"],[data-md-way="index"],[data-md-way="step"]')){
        if(done.has(Number(link.dataset.mdId))){
          link.dataset.mdComplete='true';
          if(link.dataset.mdWay==='pin')link.setAttribute('aria-label',link.getAttribute('aria-label')+'. '+edition.done);
        }
      }
      const count=destinations.filter(v=>done.has(v.id)).length;
      node.querySelector('[data-md-progress]').textContent=count+' de 12 '+edition.progress;
      const status=data.seasons?.find(season=>season.number===edition.number);
      const available=new Set(data.availableCases || []);
      node.querySelector('.md-access').innerHTML=accessMarkup(edition,item,available.has(id),done.has(id),status);
      const ready=destinations.filter(v=>available.has(v.id) && !done.has(v.id));
      const exhausted=destinations.some(v=>available.has(v.id));
      updateRoll(ready,ready.length?suggestion+'El peón elige una expedición abierta que aún no has terminado.':exhausted?'Has completado todas tus expediciones abiertas.':'El peón estará disponible al desbloquear esta temporada.');
    }).catch(()=>{if(board===local)updateRoll([],'No se ha podido consultar qué expediciones tienes abiertas.');});
  }
  window.Mundos={view,mount,story,route,nameOf,edition:world=>editions[world]};
})();
