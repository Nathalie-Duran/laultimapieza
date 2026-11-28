(() => {
  'use strict';
  const seasons = [
    {name:'Valdemar', genre:'Misterio', route:'casos', board:'mapa', art:'valdemar-cartografia.webp', seal:'Rosa de los Doce Rumbos', action:'Desplegar el plano'},
    {name:'El Tablero de Ámbar', genre:'Aventura', route:'expedicion', board:'expedicion', art:'ambar-tallado.webp', seal:'Medallón de Ámbar', action:'Abrir el tablero'},
    {name:'Umbravía', genre:'Terror psicológico', route:'umbravia', board:'umbravia', art:'umbravia-farol.webp', seal:'Farol de Umbravía', action:'Explorar el pueblo abandonado'},
    {name:'La Necrópolis del Sol Velado', genre:'Antiguo Egipto', route:'necropolis', board:'necropolis', art:'necropolis-descenso.webp', seal:'Disco del Sol Velado', action:'Descender a las cámaras'}
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
    return '<nav class="colecciones-nav'+(listing?' colecciones-catalog-nav':'')+'" aria-label="'+(listing?'Catálogos de los cuatro mundos':'Mapas de los cuatro mundos')+'">'+seasons.map((s,i)=>
      `<a href="${listing?catalogRoute(s.board):'/#'+s.board}"${current===s.board?' aria-current="page"':''}>${listing?'<img src="/'+s.art+'" width="72" height="64" alt="">':''}<small>T0${i+1} · ${s.genre}</small><span>${s.name}</span></a>`
    ).join('')+'</nav>';
  }
  function cards(access) {
    return '<div class="colecciones-cards">'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      const count=Number.isInteger(pass?.completed)?Math.max(0,Math.min(12,pass.completed)):0;
      const open = pass?.availableCases?.length || 0;
      const state = !pass ? '' : count===12 ? 'Tablero completado' :
        pass.previousReady===false ? 'Pendiente del desenlace del tablero anterior' :
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
      if(previous)return {line:'Termina los doce pasos del tablero anterior',label:'Volver a '+previous.name,href:'/#'+previous.board};
    }
    if(pass && allowed.size)return {line:'Has terminado las aventuras disponibles',label:'Consultar mi pase',href:'/#planes'};
    if(number===1 && items[0])return {line:pass?'Primera parada de Valdemar':'Empieza en Valdemar',label:items[0].title,href:window.ValdemarCatalog.path(items[0].id)};
    return {line:'Primera parada del territorio',label:items[0]?.place||season.name,href:placeHref(season,1)};
  }
  function nextMarkup(action) {
    return '<span>'+esc(action.line)+'</span><a href="'+esc(action.href)+'">'+esc(action.label)+' <i aria-hidden="true">→</i></a>';
  }
  function sideStop(data) {
    const {number,season,items,allowed}=data;
    if(number===1) return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-1"><div><small>Actividad secundaria · Valdemar</small><h3 id="atlas-side-1">Sala de juegos de la mansión</h3><p>El archivo, el relojero, el museo, las cartas de Ada, el jardín y el espejo reúnen seis minijuegos independientes.</p></div><a href="/#desafios?seccion=sala">Visitar la sala de juegos</a></aside>`;
    const stop=items.find(item=>allowed.has(item.id))||items[0];
    if(!stop)return '';
    const local=(stop.id-1)%12+1,play=allowed.has(stop.id);
    const location=placeHref(season,local)+'&amp;seccion=ficha';
    const href=play?'/#mundos-jugar?id='+stop.id+'&amp;seccion=reto':location;
    return `<aside class="atlas-side-stop" aria-labelledby="atlas-side-${number}"><div><small>Actividad secundaria · Reto paralelo</small><h3 id="atlas-side-${number}">${esc(stop.place)}</h3><p>El reto de «${esc(stop.title)}» está en esta parada.</p></div><nav aria-label="Actividades de ${esc(season.name)}"><a href="${href}">${play?'Abrir el reto paralelo':'Ver la parada'}</a><a href="/#desafios?mundo=${season.board}">Ver los retos del tablero</a></nav></aside>`;
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
    const availability=pass?allowed.size+'/12 aventuras disponibles':'Tres bloques de cuatro aventuras';
    return `<section class="atlas-panel" id="atlas-panel-${number}" role="tabpanel" aria-labelledby="atlas-territory-${number}"${selected?'':' hidden'}>
      <header class="atlas-panel-head"><div><h2>${esc(season.name)}</h2><p>${availability}</p></div><a class="atlas-open" href="/#${season.board}">${esc(season.action)} <i aria-hidden="true">↗</i></a></header>
      <div class="atlas-direction"><div class="atlas-next" data-atlas-next="${number}">${nextMarkup(nextStop(data))}</div><a class="atlas-relic" href="/#${season.board}?seccion=sello"><span class="ss-art atlas-relic-image" aria-hidden="true">${sealImage}</span><span><small>${count}</small><strong>${esc(season.seal)}</strong></span></a></div>
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
    return `<season-atlas class="colecciones-atlas atlas-universe"><header><h1>Mapa de los cuatro tableros</h1><p>Elige un territorio para recorrer sus doce paradas y descubrir las piezas de su sello.</p></header><div class="atlas-territories" role="tablist" aria-label="Territorios del universo">${tabs}</div>${territories.map(data=>territoryPanel(data,data===first)).join('')}</season-atlas>`;
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
    const monthCases = [...window.ValdemarCatalog.items, ...window.MundosCatalogo];
    const available = new Set(access?.availableCases || []);
    const signed=window.GameAccountBridge?.isSignedIn?.()===true;
    const hash=window.location?.hash||'';
    const params=hash.includes('?')?new URLSearchParams(hash.split('?')[1]):null;
    if(params?.get('seccion')==='sala'){
      return '<section class="colecciones-atlas adventure-challenges reto-local"><a class="reto-regreso" href="/#tableros?mundo=mapa">Volver al mapa de Valdemar</a><header><h1>Sala de juegos de la mansión</h1></header><mansion-arcade></mansion-arcade></section>';
    }
    const territory=seasons.find(s=>s.board===params?.get('mundo'));
    if(territory){
      const index=seasons.indexOf(territory),games=monthCases.filter(game=>Math.floor((game.id-1)/12)===index);
      const stops=games.map(game=>{
        const local=(game.id-1)%12+1;
        const open=available.has(game.id);
        const href=open?'/#'+(index===0?'valdemar':'mundos')+'-jugar?id='+game.id+'&amp;seccion=reto':placeHref(territory,local)+(index===0?'':'&amp;seccion=ficha');
        return `<li><a href="${href}"><span><strong>${esc(game.place)}</strong><small>${esc(game.title)}</small></span><b>${open?'Abrir reto':'Ver parada'}</b></a></li>`;
      }).join('');
      return `<section class="colecciones-atlas adventure-challenges reto-local"><a class="reto-regreso" href="/#tableros?mundo=${territory.board}">Volver al mapa de ${esc(territory.name)}</a><header><h1>Retos de ${esc(territory.name)}</h1><p>Elige una parada para examinar su ficha o jugar el reto si tienes acceso al caso.</p></header><ol class="reto-paradas">${stops}</ol></section>`;
    }
    const descriptions=[
      'Abre el archivo de la ciudad. Empareja señales, recompón mensajes y prueba los mecanismos de cada caso.',
      'Sigue los cuadernos de expedición. Orienta cartas y coteja los objetos recogidos durante la travesía.',
      'Interpreta los rastros del pueblo y reconstruye las señales que han dejado sus habitantes.',
      'Desciende a las cámaras, examina los registros del templo y contrasta las marcas de sus piezas.'
    ];
    const chapters = seasons.map((season, i) => {
      const games = monthCases.filter(game => Math.floor((game.id - 1) / 12) === i);
      const open = games.filter(game => available.has(game.id));
      const links = open.map(game => {
        const route = i === 0 ? 'valdemar-jugar' : 'mundos-jugar';
        const prize=game.id===1?'Sala de juegos':(game.id-1)%12<8?'1 llave':'2 llaves';
        return `<li><a href="/#${route}?id=${game.id}&amp;seccion=reto"><span>${esc(game.title)}</span><small data-reto-premio="${game.id}">${prize}</small></a></li>`;
      }).join('');
      const pass=access?.seasons?.find(s=>s.number===i+1);
      const availability=open.length?open.length+' de '+games.length+' casos con retos disponibles':pass?.previousReady===false?'Se abre al terminar el tablero anterior.':signed?'Tus retos se abren con los bloques de este tablero.':'Cuatro casos con retos por bloque.';
      return `<article class="challenge-board" data-territorio="${season.board}"><img src="/${season.art}" width="360" height="240" loading="lazy" alt=""><div><p class="reto-genero">Tablero ${i+1} · ${season.genre}</p><h3>${season.name}</h3><p>${descriptions[i]}</p><p class="reto-disponible">${availability}</p>${links ? '<details'+(i===0?' open':'')+'><summary>Elegir un caso</summary><ul>'+links+'</ul></details>' : ''}<a class="text-link" href="/#${season.board}">Explorar el tablero</a></div></article>`;
    }).join('');
    return `<section class="colecciones-atlas adventure-challenges"><header class="reto-portada"><div><p class="reto-genero">El llavero de la investigación</p><h1>Desafíos</h1><p>Resuelve un reto para ganar llaves con las que pedir pistas durante tus aventuras. Cada premio se guarda la primera vez que lo consigues.</p>
      <div class="reto-acciones">${signed?'<a href="/#archivo">Volver a mis partidas</a>':'<a href="/#planes">Ver el pase</a><button type="button" data-action="auth-login">Ya tengo cuenta · Entrar</button>'}<button type="button" data-action="page-section" data-target="retos-mansion">Ver los seis minijuegos</button></div></div></header>
      <challenge-keyring></challenge-keyring><section aria-labelledby="retos-tableros"><h2 id="retos-tableros">Retos de los cuatro tableros</h2><p>Los retos de los bloques primero y segundo dan una llave. Los del tercer bloque dan dos.</p><div class="challenge-boards">${chapters}</div></section>
      <mansion-arcade id="retos-mansion" tabindex="-1"></mansion-arcade>${window.EditorialChallenges.view()}</section>`;
  }
  function seals(access,editorial=false) {
    return '<section class="colecciones-resumen"><h2>'+(editorial?'Tableros y sellos de la edición':'Mis sellos de temporada')+'</h2><ul>'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      return `<li><a href="/#${s.board}?seccion=sello">${s.seal}</a><small>${s.name} · ${editorial?'12 juegos':(pass?.completed||0)+'/12 piezas'}</small></li>`;
    }).join('')+'</ul></section>';
  }
  window.Colecciones=Object.freeze({seasons:Object.freeze(seasons),catalogBoard,catalogRoute,menu,discover,boards,seals,challenges});
})();
