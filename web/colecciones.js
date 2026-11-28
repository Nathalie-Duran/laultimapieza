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
    let href='/#tableros?mundo='+season.board,label='Mapa de temporadas';
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
  function illustratedMap({primary=false,home=false,letter=false}={}) {
    const heading=primary?'h1':'h2';
    const pins=seasons.map((season,i)=>`<a class="universe-pin universe-pin-${i+1}" href="/#${season.board}" aria-label="Explorar ${esc(season.name)}"><span class="universe-pin-light" aria-hidden="true"></span><span><small>${esc(season.genre)}</small><strong>${esc(season.name)}</strong></span></a>`).join('');
    return `<section class="universe-front" aria-labelledby="universe-heading"><div class="universe-front-copy">
      <${heading} id="universe-heading">Mapa de temporadas</${heading}><p>Elige un destino del mapa para explorar sus doce juegos.</p></div>
      <nav class="universe-chart" aria-label="Explorar las cuatro temporadas"><img src="/atlas-cuatro-mundos.webp" width="1520" height="855" alt="" ${primary?'fetchpriority="high"':'loading="lazy"'}>${pins}</nav>
      ${home?`<div class="universe-front-actions"><a class="universe-progress" href="/#tableros">Ver el recorrido de las cuatro temporadas <span aria-hidden="true">→</span></a>
      ${letter?'<div class="universe-front-first"><span>Primer juego · Código Valdemar</span><h3>El secreto de los dos mundos</h3><p>Ada os envía una foto de vuestra infancia. Reconocéis vuestras caras, pero ninguno recuerda esa casa.</p><a class="universe-door" href="/valdemar/01/?carta=1">Abrir la carta de Ada <span aria-hidden="true">→</span></a></div>':''}</div>`:''}</section>`;
  }
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
    const directory='/#desafios?mundo='+season.board;
    const next=items.find(item=>allowed.has(item.id)) || (number===1?items[0]:null);
    const descriptions=[
      'Seis minijuegos en la sala de Ada y un reto propio en cada una de las otras once aventuras.',
      'Doce retos opcionales, uno en cada parada de la expedición.',
      'Doce retos opcionales, uno en cada lugar que investigas en el pueblo.',
      'Doce retos opcionales, uno en cada cámara de la necrópolis.'
    ];
    const entry=next&&window.RetosTemporada.ficha(next.id);
    const shortcut=entry?window.RetosTemporada.enlace(next.id,allowed.has(next.id)):null;
    return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-${number}"><img class="atlas-extra-photo" src="/extras-${season.board}.webp" width="764" height="508" alt="" decoding="async"><div class="atlas-extra-copy"><h3 id="atlas-side-${number}">Retos extra de ${esc(season.name)}</h3><p>${descriptions[number-1]}</p><div class="atlas-extra-actions"><a class="atlas-extra-open" href="${directory}">Ver todos los retos</a>${shortcut?'<a class="atlas-extra-play" href="'+esc(shortcut.href)+'">'+(next.id===1?'Visitar la sala de Ada':'Jugar a «'+esc(entry.title)+'»')+'</a>':''}</div></div></aside>`;
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
      ${sideStop(data)}<div class="atlas-blocks">${itinerary(data)}</div></section>`;
  }
  function boards(access) {
    const territories=seasons.map((_,index)=>territoryData(index,access));
    const choice=new URLSearchParams(window.location?.hash?.split('?')[1]||'').get('mundo');
    const first=territories.find(data=>data.season.board===choice)||territories.find(data=>data.items.some(item=>data.allowed.has(item.id)&&!data.earned.has(item.id-data.base)))||territories[0];
    const tabs=territories.map(({number,season})=>{
      const active=first.number===number;
      return `<button type="button" class="atlas-territory" id="atlas-territory-${number}" data-atlas-board="${season.board}" role="tab" aria-controls="atlas-panel-${number}" aria-selected="${active}" tabindex="${active?0:-1}"><img src="/${season.art}" alt="" width="1536" height="1024" decoding="async"><span><small>${two(number)} · ${esc(season.genre)}</small><strong>${esc(season.name)}</strong></span></button>`;
    }).join('');
    return `<season-atlas class="colecciones-atlas atlas-universe">${illustratedMap({primary:true})}<header><h2>Recorrido por temporada</h2><p>Consulta los juegos, el sello y los retos de la temporada que elijas.</p></header><div class="atlas-territories" role="tablist" aria-label="Temporadas disponibles">${tabs}</div>${territories.map(data=>territoryPanel(data,data===first)).join('')}</season-atlas>`;
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
  function extraCard(game,open) {
    const ficha=window.RetosTemporada.ficha(game.id);
    const local=(game.id-1)%12+1,ada=game.id===1;
    const link=window.RetosTemporada.enlace(game.id,open);
    const reward=ada?'Hasta 8 llaves':ficha.prize+(ficha.prize===1?' llave':' llaves');
    const action=ada?(open?'Jugar en la sala':'Explorar la sala'):open?link.label:'Ver ficha del reto';
    return '<li><a class="extras-tile" href="'+esc(link.href)+'" aria-labelledby="extra-title-'+game.id+' extra-action-'+game.id+'">'+
      '<img class="extras-photo" src="'+esc(ficha.photo)+'" width="600" height="360" '+(local>3?'loading="lazy" ':'')+'decoding="async" alt="">'+
      '<div class="extras-tile-body"><p class="extras-origin">Aventura '+two(local)+' · '+esc(game.title)+'</p>'+
      '<h2 id="extra-title-'+game.id+'">'+esc(ficha.title)+'</h2><p class="extras-task">'+esc(ficha.action)+'</p>'+
      '<div class="extras-tile-foot"><span class="extras-prize"'+(open&&!ada?' data-reto-premio="'+game.id+'"':'')+'>'+reward+'</span>'+
      '<strong id="extra-action-'+game.id+'" class="extras-link-label">'+action+' <span aria-hidden="true">→</span></strong></div></div></a></li>';
  }
  function extraDetail(game,season,open,back,balance) {
    const ficha=window.RetosTemporada.ficha(game.id),local=(game.id-1)%12+1;
    const directory='/#desafios?mundo='+season.board;
    const story=game.id<=12?window.ValdemarCatalog.path(game.id):placeHref(season,local)+'&amp;seccion=ficha';
    const play=game.id===1?'/#desafios?seccion=sala':'/#'+(game.id<=12?'valdemar':'mundos')+'-jugar?id='+game.id+'&amp;seccion=reto';
    const prize=game.id===1?'Hasta 8 llaves entre las seis estaciones':ficha.prize+(ficha.prize===1?' llave':' llaves')+' la primera vez que lo resuelvas';
    return '<section class="colecciones-atlas adventure-challenges extras-hall"><nav class="reto-migas" aria-label="Ruta del reto">'+back+'<a href="'+directory+'">Retos de '+esc(season.name)+'</a></nav>'+
      '<article class="extras-detail"><img class="extras-photo" src="'+esc(ficha.photo)+'" width="800" height="540" alt="">'+
      '<div><p class="extras-origin">Aventura '+two(local)+' · '+esc(game.title)+'</p><h1>'+esc(ficha.title)+'</h1><p class="extras-intro">'+esc(ficha.action)+'</p>'+
      '<p class="extras-prize"'+(open&&game.id!==1?' data-reto-premio="'+game.id+'"':'')+'>'+prize+'</p>'+
      '<p class="extras-unlock">'+(open?'Esta aventura está abierta en tu cuenta.':'Este reto se puede jugar cuando tengas acceso a «'+esc(game.title)+'».')+'</p>'+
      '<nav class="extras-actions" aria-label="Opciones del reto">'+(open||game.id===1?'<a class="extras-primary" href="'+play+'">'+(game.id===1?'Abrir la sala de Ada':'Jugar al reto')+'</a>':'<a class="extras-primary" href="/#planes">Ver la suscripción</a>')+'<a href="'+story+'">Ver la aventura</a></nav></div></article>'+balance+'</section>';
  }
  function calendarLink(season) {
    const origin=season?'&amp;mundo='+season.board:'';
    return '<a class="extras-calendar" href="/#desafios?seccion=calendario'+origin+'"><img src="/prueba-documento.webp" alt="" width="96" height="96">'+
      '<span><strong>Abrir el calendario <span aria-hidden="true">→</span></strong><small>Reto diario y misión semanal de las cuatro temporadas</small></span></a>';
  }
  function challenges(access) {
    const games=[...window.ValdemarCatalog.items,...window.MundosCatalogo];
    const available=new Set(access?.availableCases||[]);
    const signed=window.GameAccountBridge?.isSignedIn?.()===true;
    const params=new URLSearchParams((window.location?.hash||'').split('?')[1]||'');
    const section=params.get('seccion'),territory=seasons.find(s=>s.board===params.get('mundo'));
    const back='<a class="reto-regreso" href="/#desafios">Todos los retos extra</a>';
    const balance=signed?'<challenge-keyring class="reto-saldo-breve"></challenge-keyring>':'';
    if(section==='sala'){
      return '<section class="colecciones-atlas adventure-challenges reto-local reto-sala"><nav class="reto-migas" aria-label="Ruta de la sala">'+back+'<a href="/#desafios?mundo=mapa">Retos de Código Valdemar</a></nav><mansion-arcade></mansion-arcade>'+balance+'</section>';
    }
    if(section==='calendario'){
      const returnLink=territory?'<a class="reto-regreso" href="/#desafios?mundo='+territory.board+'">Volver a los retos de '+esc(territory.name)+'</a>':back;
      return '<section class="colecciones-atlas adventure-challenges reto-local reto-agenda"><nav class="reto-migas" aria-label="Navegación del calendario">'+returnLink+'</nav>'+window.EditorialChallenges.view(true)+balance+'</section>';
    }
    if(territory){
      const index=seasons.indexOf(territory),stops=games.filter(game=>Math.floor((game.id-1)/12)===index);
      const selected=stops.find(game=>String(game.id)===params.get('reto'));
      if(selected)return extraDetail(selected,territory,available.has(selected.id),back,balance);
      const count=stops.filter(game=>available.has(game.id)).length;
      const intro=index===0?'En la primera aventura te espera la sala de Ada con seis minijuegos. Cada una de las otras once aventuras tiene su propio reto.':'Cada una de las doce aventuras tiene su propio reto. Puedes jugarlo cuando tengas acceso a la aventura correspondiente.';
      const guidance=signed?'<p class="extras-access">'+(count===0?'Puedes ver las fichas. Esta temporada aún no está abierta en tu cuenta.':count===12?'Tienes acceso a las doce aventuras.':'Tienes acceso a '+count+' de las doce aventuras.')+'</p>':'';
      return '<section class="colecciones-atlas adventure-challenges reto-local extras-hall"><nav class="reto-migas" aria-label="Ruta de la temporada">'+back+'<a href="/#tableros?mundo='+territory.board+'">Mapa de '+esc(territory.name)+'</a></nav>'+
        '<header class="extras-season-head"><div><h1>Retos de '+esc(territory.name)+'</h1><p class="extras-intro">'+intro+'</p>'+guidance+calendarLink(territory)+'</div>'+
        '<img src="/extras-'+territory.board+'.webp" alt="" width="760" height="360" decoding="async"></header>'+
        '<ol class="extras-list" aria-label="Retos por aventura">'+stops.map(game=>extraCard(game,available.has(game.id))).join('')+'</ol>'+balance+'</section>';
    }
    const boards=seasons.map((season,index)=>{
      const first=index*12+1;
      const count=games.filter(game=>game.id>=first&&game.id<first+12&&available.has(game.id)).length;
      const status=signed?(count?(count===1?'1 aventura abierta':count+' aventuras abiertas'):'Vista previa'):'';
      const description=index===0?'Descifra los sellos de Ada, arregla su reloj o investiga los otros rincones de Valdemar.':window.RetosTemporada.ficha(first).action;
      const countText=index===0?'Sala de Ada (6 minijuegos) + 11 retos':'12 retos · Uno por aventura';
      return '<li><a class="extras-tile extras-season" href="/#desafios?mundo='+season.board+'" aria-labelledby="extra-season-'+first+'">'+
        '<img class="extras-photo" src="/extras-'+season.board+'.webp" alt="" width="760" height="400" decoding="async">'+
        '<div class="extras-tile-body"><p class="extras-origin">'+countText+'</p><h2 id="extra-season-'+first+'">'+esc(season.name)+'</h2><p class="extras-task">'+esc(description)+'</p>'+
        '<div class="extras-tile-foot">'+(status?'<span class="extras-access">'+status+'</span>':'')+'<strong class="extras-link-label">Ver retos <span aria-hidden="true">→</span></strong></div></div></a></li>';
    }).join('');
    return '<section class="colecciones-atlas adventure-challenges extras-hall"><header class="extras-home-head"><div><h1>Retos extra</h1><p class="extras-intro">Elige una temporada para descubrir sus juegos opcionales. La primera vez que superas un reto ganas llaves para pedir pistas en tus aventuras.</p>'+
      '<div class="reto-acciones extras-actions">'+(signed?'<a href="/#archivo">Volver a mis partidas</a>':'<a href="/#planes">Ver la suscripción</a><button type="button" data-action="auth-login">Entrar</button>')+'</div></div>'+calendarLink()+'</header>'+
      '<ul class="extras-seasons" aria-label="Elige una temporada">'+boards+'</ul>'+
      '<challenge-keyring></challenge-keyring></section>';
  }
  function seals(access,editorial=false) {
    return '<section class="colecciones-resumen"><h2>'+(editorial?'Temporadas y sellos de la edición':'Mis sellos de temporada')+'</h2><ul>'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      return `<li><a href="/#${s.board}?seccion=sello">${s.seal}</a><small>${s.name} · ${editorial?'12 juegos':(pass?.completed||0)+'/12 piezas'}</small></li>`;
    }).join('')+'</ul></section>';
  }
  window.Colecciones=Object.freeze({seasons:Object.freeze(seasons),catalogBoard,catalogRoute,breadcrumb,menu,discover,illustratedMap,boards,seals,challenges});
})();
