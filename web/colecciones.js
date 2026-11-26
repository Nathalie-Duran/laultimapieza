(() => {
  'use strict';
  const seasons = [
    {route:'casos',name:'Valdemar',type:'Misterio',art:'/valdemar-plano.webp'},
    {route:'expedicion',name:'El Tablero de Ámbar',type:'Aventura',art:'/expedicion-tablero.webp'},
    {route:'umbravia',name:'Umbravía',type:'Terror psicológico',art:'/umbravia-pueblo.webp'}
  ];
  function menu(route) {
    return '<nav class="colecciones-nav" aria-label="Elegir colección">'+seasons.map(s=>
      `<a href="/#${s.route}"${route===s.route?' aria-current="page"':''}><small>${s.type}</small><span>${s.name}</span></a>`
    ).join('')+'</nav>';
  }
  function discover() {
    return `<section class="colecciones-home" aria-labelledby="colecciones-titulo"><h2 id="colecciones-titulo">¿Aventura o terror?</h2><div>${seasons.slice(1).map((s,i)=>`<a class="colecciones-card" href="/#${s.route}"><img src="${s.art}" width="1536" height="1024" loading="lazy" alt=""><span><small>${s.type} · 12 juegos</small><strong>${s.name}</strong><b>${i?'Entrar en el pueblo':'Explorar el tablero'} <i aria-hidden="true">↗</i></b></span></a>`).join('')}</div></section>`;
  }
  window.Colecciones = Object.freeze({menu,discover});
})();
