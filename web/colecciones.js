(() => {
  'use strict';
  const seasons = [
    {name:'Valdemar', genre:'Misterio', route:'casos', board:'mapa', art:'valdemar-cartografia.webp', seal:'Rosa de los Doce Rumbos', action:'Desplegar el plano'},
    {name:'El Tablero de Ámbar', genre:'Aventura', route:'expedicion', board:'expedicion', art:'ambar-tallado.webp', seal:'Medallón de Ámbar', action:'Abrir el tablero'},
    {name:'Umbravía', genre:'Terror psicológico', route:'umbravia', board:'umbravia', art:'umbravia-farol.webp', seal:'Farol de Umbravía', action:'Explorar el pueblo abandonado'},
    {name:'La Necrópolis del Sol Velado', genre:'Antiguo Egipto', route:'necropolis', board:'necropolis', art:'necropolis-descenso.webp', seal:'Disco del Sol Velado', action:'Descender a las cámaras'}
  ];
  function menu(route) {
    return '<nav class="colecciones-nav" aria-label="Elegir temporada">'+seasons.map((s,i)=>
      `<a href="/#${route==='mapa'?s.board:s.route}"${route===s.route||route===s.board?' aria-current="page"':''}><small>T0${i+1} · ${s.genre}</small><span>${s.name}</span></a>`
    ).join('')+'</nav>';
  }
  function cards(access) {
    return '<div class="colecciones-cards">'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      const count=Number.isInteger(pass?.completed)?Math.max(0,Math.min(12,pass.completed)):0;
      return `<a class="colecciones-card" data-board="${s.board}" href="/#${s.board}"><img src="/${s.art}" width="1536" height="1024" loading="lazy" decoding="async" alt=""><span><small>Temporada 0${i+1} · ${s.genre}</small><strong>${s.name}</strong><span class="colecciones-seal">${s.seal} · ${pass?count+'/12 piezas':'12 piezas'}</span><b>${s.action} <i aria-hidden="true">↗</i></b></span></a>`;
    }).join('')+'</div>';
  }
  function discover() {
    return '<section class="colecciones-home" aria-labelledby="colecciones-titulo"><h2 id="colecciones-titulo">Cuatro temporadas para explorar</h2>'+cards(window.ClubAccess?.state?.seasonAccess)+'</section>';
  }
  function boards(access) {
    return '<section class="colecciones-home colecciones-atlas"><header><h1>Los cuatro tableros</h1><p>Elige un tablero para visitarlo. Cada historia que terminas recupera una pieza de su sello. Con las doce piezas descubres su epílogo y puedes pasar a la siguiente temporada.</p></header>'+cards(access)+'</section>';
  }
  function seals(access,editorial=false) {
    return '<section class="colecciones-resumen"><h2>'+(editorial?'Tableros y sellos de la edición':'Mis sellos de temporada')+'</h2><ul>'+seasons.map((s,i)=>{
      const pass=access?.seasons?.find(p=>p.number===i+1);
      return `<li><a href="/#${s.board}?seccion=sello">${s.seal}</a><small>${s.name} · ${editorial?'12 juegos':(pass?.completed||0)+'/12 piezas'}</small></li>`;
    }).join('')+'</ul></section>';
  }
  window.Colecciones=Object.freeze({seasons:Object.freeze(seasons),menu,discover,boards,seals});
})();
