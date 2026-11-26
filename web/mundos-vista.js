(() => {
  'use strict';

  const editions = {
    expedicion: {
      number:2, offset:12, title:'El Tablero de Ámbar', short:'Tablero de Ámbar',
      genre:'Aventuras',station:'Casilla',count:'expediciones',progress:'expediciones completadas',done:'Expedición completada.',notebook:'Cuaderno de campo',
      previous:{from:'de Valdemar',back:'Volver a Valdemar',href:'#casos'},
      image:'/expedicion-tablero.webp', imageAlt:'Tablero de expedición tallado en madera, con un recorrido entre doce destinos.',
      intro:'Una barquera ha perdido su valija. En la montaña, un observatorio ha perdido el norte. Coloca el peón donde quieras empezar.',
      boardLabel:'Tablero de las doce expediciones', index:'Índice de expediciones',
      selectLabel:'Mover el peón a', launch:'Iniciar expedición', returnLabel:'Volver al tablero',
      positions:[[12,76],[17,49],[12,22],[37,18],[45,39],[34,63],[44,83],[64,72],[72,46],[64,19],[86,24],[89,64]]
    },
    umbravia: {
      number:3, offset:24, title:'Umbravía', short:'Umbravía',
      genre:'Terror psicológico',station:'Lugar',count:'lugares',progress:'faroles encendidos',done:'Caso resuelto, farol encendido.',notebook:'Archivo del pueblo',
      previous:{from:'del Tablero de Ámbar',back:'Volver al Tablero de Ámbar',href:'#expedicion'},
      image:'/umbravia-pueblo.webp', imageAlt:'Vista ilustrada de Umbravía al anochecer, con doce lugares que se pueden investigar.',
      intro:'En el cine, una silueta aparece sobre una pantalla desconectada. Elige un edificio para investigar. Cada caso resuelto enciende un farol.',
      boardLabel:'Plano del pueblo encantado de Umbravía', index:'Directorio del pueblo',
      selectLabel:'Localizar', launch:'Entrar en el caso', returnLabel:'Volver al pueblo',
      positions:[[14,26],[37,19],[58,23],[84,25],[14,49],[34,41],[59,46],[85,45],[13,74],[36,67],[60,70],[84,68]]
    },
    necropolis: {
      number:4,offset:36,title:'La Necrópolis del Sol Velado',short:'La Necrópolis',
      genre:'Aventuras en el antiguo Egipto',station:'Cámara',count:'cámaras',progress:'sellos iluminados',done:'Cámara resuelta, sello iluminado.',notebook:'Cuaderno de excavación',
      previous:{from:'de Umbravía',back:'Volver a Umbravía',href:'#umbravia'},
      image:'/necropolis-egipto.webp',imageAlt:'Sección de una necrópolis egipcia con doce cámaras distribuidas en tres niveles.',
      intro:'Bajo la arena se abren doce cámaras. Elige un umbral para examinar sus vestigios. Cada misterio resuelto ilumina un sello.',
      boardLabel:'Sección de la Necrópolis del Sol Velado',index:'Directorio de las cámaras',
      selectLabel:'Explorar',launch:'Entrar en la cámara',returnLabel:'Volver a la necrópolis',
      positions:[[13,20],[37,20],[62,20],[85,20],[13,50],[37,50],[62,50],[85,50],[13,78],[37,78],[62,78],[85,78]]
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
    return `<a class="md-pin" href="${route(world,item.id)}" style="--x:${x}%;--y:${y}%" data-md-id="${item.id}" data-md-way="pin" aria-label="${esc(edition.selectLabel+' '+item.place+'. '+item.title)}" aria-controls="md-file"${item.id===current?' aria-current="location"':''}><span class="md-pin-face">${number(local)}</span><span class="md-pin-tooltip" aria-hidden="true">${esc(item.place)}</span></a>`;
  }
  function indexEntry(edition,world,item,current) {
    const local=item.id-edition.offset;
    return `<li><a href="${route(world,item.id)}" data-md-id="${item.id}" data-md-way="index" aria-controls="md-file"${item.id===current?' aria-current="location"':''}><span>${number(local)}</span><strong>${esc(item.place)}</strong><small>${esc(item.title)}</small></a></li>`;
  }
  function trail(points) {
    const joins=points.map(([x,y])=>x+','+y).join(' ');
    const blocks=[];
    for(let i=1;i<points.length;i++){
      const [x,y]=points[i-1],[tx,ty]=points[i];
      for(const fraction of [.33,.67]){
        const left=x+(tx-x)*fraction,top=y+(ty-y)*fraction;
        blocks.push(`<rect x="${left-.55}" y="${top-.8}" width="1.1" height="1.6" rx=".25"/>`);
      }
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="md-trail" aria-hidden="true" focusable="false"><polyline class="md-trail-bed" points="${joins}"/><polyline class="md-trail-rail" points="${joins}"/><g>${blocks.join('')}</g></svg>`;
  }
  function accessMarkup(edition,item,allowed,completed,status) {
    if(allowed)return `<a class="md-cta" href="#mundos-jugar?id=${item.id}">${completed?'Ver mi desenlace':edition.launch} <span aria-hidden="true">→</span></a>`;
    const block=Math.ceil((item.id-edition.offset)/4);
    const info=status?.previousReady ? 'Este caso se abre con la mensualidad '+block+' de esta temporada.' :
      'Completa los doce casos '+edition.previous.from+' para acceder. '+(status?'Llevas '+status.previousCompleted+' de 12. ':'')+'Después se habilitan cuatro por mensualidad.';
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
    const placeType=edition.station;
    return `<section class="md-world" data-md-world="${world}" data-md-selected="${item.id}" data-md-editor="${allowed}" aria-labelledby="md-world-title">
      <header class="md-mast"><div><p class="md-caption">Temporada ${number(edition.number)} · ${esc(edition.genre)}</p><h1 id="md-world-title">${esc(edition.title)}</h1></div><div class="md-mast-end"><p>${esc(edition.intro)}</p></div></header>
      <div class="md-atlas"><div class="md-board">
        <div class="md-map-window" data-zoom="${!!enlarged}" role="region" tabindex="0" aria-label="${esc(edition.boardLabel)}"><div class="md-surface">
          <img class="md-map-art" src="${edition.image}" width="1536" height="1024" alt="${esc(edition.imageAlt)}" fetchpriority="high">
          ${world==='expedicion'?trail(edition.positions):''}<div class="md-pins">${candidates.map(v=>pin(edition,world,v,item.id)).join('')}</div></div></div>
        <div class="md-board-tools"><span class="md-board-status" data-md-progress>12 ${esc(edition.count)}</span>${world==='expedicion'?'<button type="button" class="md-roll" aria-describedby="md-roll-note" disabled>Mover el peón</button>':''}<button type="button" class="md-zoom" aria-pressed="${!!enlarged}">${enlarged?'Ver completo':'Ampliar'}</button></div>${world==='expedicion'?'<p id="md-roll-note" class="md-board-note" aria-live="polite"></p>':''}</div>
        <article class="md-file" id="md-file" aria-labelledby="md-case-title"><figure><img src="/mundo-${item.id}.webp" width="768" height="512" alt="" decoding="async"><figcaption>${esc(placeType)} ${number(local)}</figcaption></figure><div class="md-file-copy">
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
  function keyboard(event) {
    const pin=event.target.closest('.md-pin'),key=event.key;
    if (!pin || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const pins=[...event.currentTarget.querySelectorAll('.md-pin')],at=pins.indexOf(pin);
    const move={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1};
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
      if(link.hash===location.hash){event.preventDefault();focusFile(node);}
      else intent={hash:link.hash};
    });
    center(pane,selected);
    if(intent?.hash===location.hash) {intent=null;focusFile(node);}
    else intent=null;
    if(!bridge?.isSignedIn?.())return;
    (access||bridge.request('/api/valdemar/seasons')).then(data=>{
      if(board!==local || !node.isConnected || !bridge.isSignedIn())return;
      const done=new Set(data.completed || []);
      for(const link of node.querySelectorAll('[data-md-id]')){
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
