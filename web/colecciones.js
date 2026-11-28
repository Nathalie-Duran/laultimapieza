(() => {
  'use strict';
  const seasons = [
    {name:'Código Valdemar', genre:'Misterio', route:'casos', board:'mapa', art:'valdemar-cartografia.webp', seal:'Rosa de los Doce Rumbos', action:'Desplegar el plano'},
    {name:'La ruta prohibida', genre:'Aventura', route:'expedicion', board:'expedicion', art:'ambar-tallado.webp', seal:'Medallón de Ámbar', action:'Abrir el tablero'},
    {name:'El tercer jugador', genre:'Terror psicológico', route:'umbravia', board:'umbravia', art:'umbravia-farol.webp', seal:'Farol del pueblo', action:'Explorar el pueblo abandonado'},
    {name:'La ira de Ra', genre:'Antiguo Egipto', route:'necropolis', board:'necropolis', art:'necropolis-descenso.webp', seal:'Disco del Sol Velado', action:'Descender a las cámaras'}
  ];
  function catalogRoute(board,month=1) {
    const world=board==='mapa'?'':'mundo='+board;
    return '/#casos'+(world||month>1?'?'+[world,month>1?'mes='+month:''].filter(Boolean).join('&'):'');
  }
  function catalogBoard() {
    const hash=window.location?.hash || '';
    const requested=hash.includes('?')?new URLSearchParams(hash.split('?')[1]).get('mundo'):'';
    return seasons.find(season=>season.board===requested)||seasons[0];
  }
  function menu(route) {
    const listing=route==='casos',current=listing?catalogBoard().board:route;
    return '<nav class="colecciones-nav'+(listing?' colecciones-catalog-nav':'')+'" aria-label="'+(listing?'Filtrar juegos por temporada':'Mapas de las temporadas')+'">'+seasons.map((s,i)=>
      `<a href="${listing?catalogRoute(s.board):'/#'+s.board}"${current===s.board?' aria-current="page"':''}>${listing?'<img src="/'+s.art+'" width="72" height="64" alt="">':''}<small>T0${i+1} · ${s.genre}</small><span>${s.name}</span></a>`
    ).join('')+'</nav>';
  }
  function breadcrumb(route,caseId) {
    const query=new URLSearchParams(window.location?.hash?.split('?')[1]||'');
    const map=seasons.find(item=>item.board===route);
    const playing=['valdemar-jugar','mundos-jugar'].includes(route);
    const season=map||((playing||route==='valdemar')&&seasons[Math.floor((caseId-1)/12)]);
    if(!season)return '';
    let href='/#tableros?mundo='+season.board,label='Temporadas';
    if(playing&&query.get('seccion')==='reto'){
      href='/#desafios?mundo='+season.board;label='Retos extra';
    }else if(!map||query.get('seccion')==='ficha'){
      const local=map?Number(query.get('lugar')):((caseId-1)%12)+1;
      href=catalogRoute(season.board,Math.ceil(local/4)||1);label='Juegos';
    }
    return '<nav aria-label="Ruta de navegación"><a class="atlas-breadcrumb" href="'+href.replace(/&/g,'&amp;')+'"><span aria-hidden="true">←</span> '+label+'</a></nav>';
  }
  function cards(access) {
    return '<div class="colecciones-cards">'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      const count=Number.isInteger(pass?.completed)?Math.max(0,Math.min(12,pass.completed)):0;
      const open = pass?.availableCases?.length || 0;
      const state = !pass ? '' : count===12 ? 'Temporada completada' :
        pass.previousReady===false ? 'Pendiente del desenlace de la temporada anterior' :
        open ? open+' de 12 aventuras disponibles' : 'Pendiente de desbloqueo';
      return `<a class="colecciones-card" data-board="${s.board}" href="/#${s.board}"><img src="/${s.art}" width="1536" height="1024" loading="lazy" decoding="async" alt=""><span><small>Temporada 0${i+1} · ${s.genre}</small><strong>${s.name}</strong><span class="colecciones-seal">${s.seal} · ${pass?count+'/12 piezas':'12 piezas'}</span>${state?'<span class="colecciones-seal">'+state+'</span>':''}<b>${s.action} <i aria-hidden="true">↗</i></b></span></a>`;
    }).join('')+'</div>';
  }
  function discover() {
    return '<section class="colecciones-home" aria-labelledby="colecciones-titulo"><h2 id="colecciones-titulo">Cuatro temporadas para explorar</h2>'+cards(window.ClubAccess?.state?.seasonAccess)+'</section>';
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const two = value => String(value).padStart(2,'0');
  const placeHref = (season,local) => '/#'+season.board+'?lugar='+local;
  function territoryData(index,access) {
    const number=index+1,base=index*12,season=seasons[index];
    const games=(index===0?window.ValdemarCatalog?.items:window.MundosCatalogo)||[];
    const items=games.filter(game=>game.id>base && game.id<=base+12).sort((a,b)=>a.id-b.id);
    const pass=access?.seasons?.find(entry=>entry.number===number);
    const allowed=new Set((pass?.availableCases??access?.availableCases??[]).filter(id=>id>base && id<=base+12));
    const earned=new Set(pass?.seal?.earned ?? (access?.completed||[]).filter(id=>id>base && id<=base+12).map(id=>id-base));
    return {number,base,season,items,pass,allowed,earned};
  }
  function nextStop(data) {
    const {base,number,season,items,pass,allowed,earned}=data;
    const next=items.find(item=>allowed.has(item.id) && !earned.has(item.id-base));
    if(next) return {line:'Siguiente aventura disponible',label:next.title,href:'/#'+(number===1?'valdemar-jugar':'mundos-jugar')+'?id='+next.id};
    if(earned.size===12) return {line:'Has reunido las doce piezas',label:'Leer el epílogo',href:'/#'+season.board+'?seccion=sello'};
    if(pass?.previousReady===false) {
      const previous=seasons[number-2];
      if(previous)return {line:'Completa los doce juegos de la temporada anterior',label:'Volver a '+previous.name,href:'/#'+previous.board};
    }
    if(pass && allowed.size)return {line:'Has terminado las aventuras disponibles',label:'Consultar mi pase',href:'/#planes'};
    if(number===1 && items[0])return {line:'Primera aventura',label:items[0].title,href:window.ValdemarCatalog.path(items[0].id)};
    return {line:'Primera parada del mapa',label:items[0]?.place||season.name,href:placeHref(season,1)};
  }
  function nextMarkup(action) {
    return '<span>'+esc(action.line)+'</span><h2><a href="'+esc(action.href)+'">'+esc(action.label)+'</a></h2>';
  }
  function sideStop(data) {
    const {number,season,items,allowed}=data;
    if(number===1) return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-1"><div><small>Reto extra</small><h3 id="atlas-side-1">Sala de juegos de la mansión</h3><p>El archivo, el relojero, el museo, las cartas de Ada, el jardín y el espejo reúnen seis minijuegos independientes.</p></div><a href="/#desafios?seccion=sala">Visitar la sala de juegos</a></aside>`;
    const stop=items.find(item=>allowed.has(item.id));
    const directory='/#desafios?mundo='+season.board;
    if(!stop){
      return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-${number}"><h3 id="atlas-side-${number}"><a href="${directory}">Explorar los retos extra de «${esc(season.name)}»</a></h3></aside>`;
    }
    return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-${number}"><div><h3 id="atlas-side-${number}">Reto en ${esc(stop.place)}</h3><p>${esc(stop.title)}</p></div><nav aria-label="Retos de ${esc(season.name)}"><a href="/#mundos-jugar?id=${stop.id}&amp;seccion=reto">Abrir el reto paralelo</a><a href="${directory}">Ver todos los retos extra</a></nav></aside>`;
  }
  function itinerary(data) {
    const {number,base,season,items,pass,allowed,earned}=data;
    const next=items.find(item=>allowed.has(item.id)&&!earned.has(item.id-base));
    return [0,1,2].map(block=>{
      const first=4*block+1;
      const pending=next && Math.floor((next.id-base-1)/4)===block;
      const links=items.filter(item=>item.id-base>=first && item.id-base<first+4).map(item=>{
        const local=item.id-base;
        const state=earned.has(local)?'done':allowed.has(item.id)?'open':pass?'closed':'preview';
        const status={done:'Pieza recuperada',open:'Disponible para jugar',closed:'Vista previa',preview:'Ver lugar'}[state];
        return `<li><a href="${placeHref(season,local)}" data-atlas-state="${state}" aria-label="${esc('Paso '+local+'. '+item.title+'. '+status)}"><span class="atlas-stop-n">${two(local)}</span><span>${esc(item.title)}</span>${state==='done'?'<i aria-hidden="true">✓</i>':''}</a></li>`;
      }).join('');
      return `<section class="atlas-block"${pending?' data-current':''} aria-labelledby="atlas-block-${number}-${block}"><h3 id="atlas-block-${number}-${block}">Bloque ${block+1}<small>${two(first)}–${two(first+3)} / 12${pending?' · Siguiente paso':''}</small></h3><ol start="${first}">${links}</ol></section>`;
    }).join('');
  }
  function territoryPanel(data,selected) {
    const {number,season,pass,allowed,earned}=data;
    const sealImage=window.SellosTemporada?.miniature?.(number,[...earned])||'';
    const count=pass?earned.size+'/12 piezas recuperadas':'12 piezas por descubrir';
    const action=nextStop(data),sealHref='/#'+season.board+'?seccion=sello';
    const relic=action.href===sealHref?'div':'a';
    return `<section class="atlas-panel" id="atlas-panel-${number}" role="tabpanel" aria-labelledby="atlas-territory-${number}"${selected?'':' hidden'}>
      <header class="atlas-panel-head"><div class="atlas-next" data-atlas-next="${number}">${nextMarkup(action)}</div><a class="atlas-open" href="/#${season.board}">${esc(season.action)}</a></header>
      <div class="atlas-direction"><${relic} class="atlas-relic"${relic==='a'?' href="'+sealHref+'"':''}><span class="ss-art atlas-relic-image" aria-hidden="true">${sealImage}</span><span><small>${count}</small><strong>${esc(season.seal)}</strong></span></${relic}>${pass?'<p class="atlas-available">'+allowed.size+'/12 aventuras disponibles</p>':''}</div>
      <div class="atlas-blocks">${itinerary(data)}</div>${sideStop(data)}</section>`;
  }
  function boards(access) {
    const territories=seasons.map((_,index)=>territoryData(index,access));
    const choice=new URLSearchParams(window.location?.hash?.split('?')[1]||'').get('mundo');
    const first=territories.find(data=>data.season.board===choice)||territories.find(data=>data.items.some(item=>data.allowed.has(item.id)&&!data.earned.has(item.id-data.base)))||territories[0];
    const tabs=territories.map(({number,season})=>{
      const active=first.number===number;
      return `<button type="button" class="atlas-territory" id="atlas-territory-${number}" data-atlas-board="${season.board}" role="tab" aria-controls="atlas-panel-${number}" aria-selected="${active}" tabindex="${active?0:-1}"><img src="/${season.art}" alt="" width="1536" height="1024" decoding="async"><span><small>${two(number)} · ${esc(season.genre)}</small><strong>${esc(season.name)}</strong></span></button>`;
    }).join('');
    return `<season-atlas class="colecciones-atlas atlas-universe"><header><h1>Temporadas</h1><p>Cada temporada reúne 12 juegos. Elige una para explorar su mapa y ver tu progreso.</p></header><div class="atlas-territories" role="tablist" aria-label="Temporadas disponibles">${tabs}</div>${territories.map(data=>territoryPanel(data,data===first)).join('')}</season-atlas>`;
  }
  if(window.customElements && !window.customElements.get('season-atlas')) {
    window.customElements.define('season-atlas',class extends HTMLElement {
      connectedCallback() {
        if(this.atlasBound)return;
        this.atlasBound=true;
        const tabs=[...this.querySelectorAll('[role="tab"]')];
        const activate=tab=>{
          for(const candidate of tabs){
            const selected=candidate===tab;
            candidate.setAttribute('aria-selected',String(selected));candidate.tabIndex=selected?0:-1;
            this.querySelector('#'+candidate.getAttribute('aria-controls')).hidden=!selected;
          }
          const url=new URL(window.location.href);url.hash='tableros?mundo='+tab.dataset.atlasBoard;
          window.history.replaceState(window.history.state,'',url);
        };
        for(const [index,tab] of tabs.entries()){
          tab.addEventListener('click',()=>activate(tab));
          tab.addEventListener('keydown',event=>{
            const to={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
            if(to==null || event.altKey || event.metaKey || event.ctrlKey)return;
            event.preventDefault();activate(tabs[to]);tabs[to].focus();
          });
        }
        this.showResumableGames();
      }
      async showResumableGames() {
        const bridge=window.GameAccountBridge;
        if(!bridge?.isSignedIn?.())return;
        try {
          const {games}=await bridge.request('/api/valdemar/partidas');
          if(!this.isConnected || !bridge.isSignedIn() || !Array.isArray(games))return;
          const records=games.filter(game=>game.available && !game.finished)
            .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id);
          for(const [index,season] of seasons.entries()){
            const game=records.find(game=>Math.ceil(game.id/12)===index+1);
            if(!game)continue;
            const catalog=index===0?window.ValdemarCatalog?.items:window.MundosCatalogo;
            const item=catalog?.find(item=>item.id===game.id);
            if(!item)continue;
            const box=this.querySelector('[data-atlas-next="'+(index+1)+'"]');
            const label=box.querySelector('span'),link=box.querySelector('a');
            label.textContent='Partida guardada en '+season.name;
            link.href='/#'+(index===0?'valdemar-jugar':'mundos-jugar')+'?id='+game.id+'&retomar=1';
            link.textContent='Continuar '+(game.title||item.title)+' →';
          }
        }catch { /* The itinerary and season access are already available from bootstrap. */ }
      }
    });
  }
  function challenges(access) {
    const games=[...window.ValdemarCatalog.items,...window.MundosCatalogo];
    const available=new Set(access?.availableCases||[]);
    const signed=window.GameAccountBridge?.isSignedIn?.()===true;
    const hash=window.location?.hash||'';
    const params=hash.includes('?')?new URLSearchParams(hash.split('?')[1]):null;
    const section=params?.get('seccion'),territory=seasons.find(s=>s.board===params?.get('mundo'));
    const back='<a class="reto-regreso" href="/#desafios">Todos los retos extra</a>';
    const balance=signed?'<challenge-keyring class="reto-saldo-breve"></challenge-keyring>':'';
    if(section==='sala'){
      return `<section class="colecciones-atlas adventure-challenges reto-local reto-sala"><nav class="reto-migas" aria-label="Navegación de la sala">${back}<a href="/#tableros?mundo=mapa">Mapa de ${esc(seasons[0].name)}</a></nav><mansion-arcade></mansion-arcade>${balance}</section>`;
    }
    if(section==='calendario'){
      return `<section class="colecciones-atlas adventure-challenges reto-local reto-agenda"><nav class="reto-migas" aria-label="Navegación del calendario">${back}</nav>${window.EditorialChallenges.view(true)}${balance}</section>`;
    }
    if(territory){
      const index=seasons.indexOf(territory),stops=games.filter(game=>Math.floor((game.id-1)/12)===index);
      const count=stops.filter(game=>available.has(game.id)).length;
      const rows=stops.map(game=>{
        const local=(game.id-1)%12+1,open=available.has(game.id);
        const href=open?'/#'+(index===0?'valdemar':'mundos')+'-jugar?id='+game.id+'&amp;seccion=reto':placeHref(territory,local)+(index===0?'':'&amp;seccion=ficha');
        const reward=game.id===1?'Sala de juegos':local<=8?'1 llave':'2 llaves';
        return `<li><a href="${href}"><span><strong>${esc(game.title)}</strong><small>${esc(game.place)}</small></span><span class="reto-parada-accion"><b>${open?'Abrir reto':'Ver ficha'}</b>${open?'<small data-reto-premio="'+game.id+'">'+reward+'</small>':''}</span></a></li>`;
      }).join('');
      const guidance=count?'Tienes '+count+' de '+stops.length+' casos disponibles. Elige «Abrir reto» para jugar.':'Puedes explorar las fichas de los '+stops.length+' casos. El reto se abre cuando tengas acceso a su aventura.';
      return `<section class="colecciones-atlas adventure-challenges reto-local"><nav class="reto-migas" aria-label="Navegación de la temporada">${back}<a href="/#tableros?mundo=${territory.board}">Mapa de ${esc(territory.name)}</a></nav><header><h1>Retos de ${esc(territory.name)}</h1><p>${guidance}</p></header>${balance}<ol class="reto-paradas">${rows}</ol></section>`;
    }
    const boards=seasons.map((s,index)=>{
      const total=games.filter(game=>Math.floor((game.id-1)/12)===index).length;
      const count=[...available].filter(id=>Math.floor((id-1)/12)===index).length;
      const pass=access?.seasons?.find(item=>item.number===index+1);
      const status=signed?(count?count+' de '+total+' disponibles':pass?.previousReady===false?'Pendiente de la temporada anterior':'Ver las fichas'):(total+' casos');
      return `<article class="challenge-board" data-territorio="${s.board}"><a class="reto-destino" href="/#desafios?mundo=${s.board}"><img src="/${s.art}" width="360" height="240" loading="lazy" alt=""><div><h3>${esc(s.name)}</h3><span>${status}</span></div></a></article>`;
    }).join('');
    const extrasAccess=available.has(1)?'Ya tienes acceso a la sala de Ada y al calendario.':'La sala de Ada y el calendario se abren con el primer caso de '+esc(seasons[0].name)+'.';
    return `<section class="colecciones-atlas adventure-challenges"><header class="reto-portada"><div><h1>Retos extra</h1><p>Son juegos opcionales. La primera vez que superas cada reto ganas llaves para pedir pistas en tus aventuras.</p>
      <div class="reto-acciones">${signed?'<a href="/#archivo">Volver a mis partidas</a>':'<a href="/#planes">Ver el pase</a><button type="button" data-action="auth-login">Ya tengo cuenta · Entrar</button>'}</div></div></header>
      <nav class="reto-opciones" aria-label="Elegir cómo jugar"><button type="button" data-action="page-section" data-target="retos-tableros"><strong>Elegir un reto de una temporada</strong><span>Juega en un caso abierto. En Hotel Medianoche, por ejemplo, te toca asignar las habitaciones a cinco huéspedes.</span><small>1 o 2 llaves según el caso</small></button>
        <a href="/#desafios?seccion=sala"><strong>Entrar en la sala de Ada</strong><span>Descifra un mensaje o repara un reloj. Puedes jugar estos seis minijuegos por separado y luego retomar tu aventura.</span><small>Hasta 8 llaves en total</small></a>
        <a href="/#desafios?seccion=calendario"><strong>Abrir el calendario</strong><span>Resuelve la prueba de hoy o completa una misión de tres etapas durante la semana.</span><small>1 llave diaria o 2 por misión semanal</small></a></nav>
      <p class="reto-condicion">${extrasAccess}</p><section aria-labelledby="retos-tableros"><h2 id="retos-tableros" tabindex="-1">Elige una temporada</h2><div class="challenge-boards">${boards}</div></section><challenge-keyring></challenge-keyring></section>`;
  }
  function seals(access,editorial=false) {
    return '<section class="colecciones-resumen"><h2>'+(editorial?'Temporadas y sellos de la edición':'Mis sellos de temporada')+'</h2><ul>'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      return `<li><a href="/#${s.board}?seccion=sello">${s.seal}</a><small>${s.name} · ${editorial?'12 juegos':(pass?.completed||0)+'/12 piezas'}</small></li>`;
    }).join('')+'</ul></section>';
  }
  window.Colecciones=Object.freeze({seasons:Object.freeze(seasons),catalogBoard,catalogRoute,breadcrumb,menu,discover,boards,seals,challenges});
})();
