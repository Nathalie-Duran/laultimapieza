(() => {
  'use strict';
  const items = [
  {
    "id": 1,
    "title": "Mundos cruzados",
    "question": "¿Dónde esconderías una cinta en 1996 para que alguien la encuentre en 2026?",
    "month": 1,
    "image": "/tren-detenido.jpg",
    "place": "La estación"
  },
  {
    "id": 2,
    "title": "Hotel Medianoche",
    "question": "Tres huéspedes traen la misma llave. ¿A quién espera realmente la mujer de la habitación 14?",
    "month": 1,
    "image": "/habitacion-309.jpg",
    "place": "El hotel"
  },
  {
    "id": 3,
    "title": "Cita en otra vida",
    "question": "Dos desconocidos reconocen una carta en el último tren. ¿Qué ocurrió la noche en que sus caminos debieron cruzarse?",
    "month": 1,
    "image": "/ultima-invitacion.jpg",
    "place": "El último tren"
  },
  {
    "id": 4,
    "title": "Frecuencia 23:17",
    "question": "Un padre y su hija llaman a una emisora desde años distintos. ¿A quién devolverías la llamada?",
    "month": 1,
    "image": "/frecuencia-17.jpg",
    "place": "La emisora"
  },
  {
    "id": 5,
    "title": "El Consejo de la Isla",
    "question": "Dos pueblos reclaman haber guiado el último ferry. ¿Qué se veía realmente desde el puente?",
    "month": 2,
    "image": "/marea-quieta.jpg",
    "place": "La isla"
  },
  {
    "id": 6,
    "title": "La subasta de los objetos perdidos",
    "question": "Solo tienes tres fichas. ¿Qué objeto guarda el recuerdo que Amalia ha venido a recuperar?",
    "month": 2,
    "image": "/retrato-prestado.jpg",
    "place": "La casa de subastas"
  },
  {
    "id": 7,
    "title": "El negativo número 13",
    "question": "Una fotografía convirtió a un bañista en héroe. ¿Qué ocurrió justo antes del disparo?",
    "month": 2,
    "image": "/archivo-ausencias.jpg",
    "place": "El paseo marítimo"
  },
  {
    "id": 8,
    "title": "El jardín de las promesas",
    "question": "Dos desconocidos esperan con la misma flor en bancos distintos. ¿En qué lugar les prometieron encontrarse?",
    "month": 2,
    "image": "/jardin-invierno.jpg",
    "place": "El jardín"
  },
  {
    "id": 9,
    "title": "La casa de las dos herencias",
    "question": "Dos hermanas recuerdan casas diferentes detrás de una misma puerta. ¿Qué estancia falta en sus planos?",
    "month": 3,
    "image": "/ciudad-invisible.jpg",
    "place": "La casa familiar"
  },
  {
    "id": 10,
    "title": "El banquete de las sillas vacías",
    "question": "Dos abuelos distanciados llegan a la misma boda con cartas firmadas por el otro. ¿Quién hizo llegar los sobres?",
    "month": 3,
    "image": "/mesa-13.jpg",
    "place": "El salón de bodas"
  },
  {
    "id": 11,
    "title": "La partida que nadie ganó",
    "question": "Los dos finalistas intentaron perder. ¿Qué mensaje dejaron en el tablero al entregar sus piezas?",
    "month": 3,
    "image": "/cartas-medianoche.jpg",
    "place": "El club de juegos"
  },
  {
    "id": 12,
    "title": "La oficina de los finales pendientes",
    "question": "Tres testigos quieren corregir la misma tarde del archivo. ¿Qué pasó en los once minutos que el reloj no contó?",
    "month": 3,
    "image": "/cuaderno-investigacion.jpg",
    "place": "El archivo municipal"
  }
];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const number = n => String(n).padStart(2,'0');
  const get = id => items.find(item=>item.id===Number(id));
  const path = id => '/valdemar/'+number(id)+'/';
  const access = (item,opts={}) => {
    if(opts.admin===true || opts.role==='admin')return true;
    const months=opts.openedMonths??0;
    return opts.canPlay===true && (Array.isArray(months) ? months.includes(item.month) : Number(months)>=item.month);
  };
  function cards(month) {
    return '<div class="vd-cards">'+items.filter(c=>c.month===month).map(item=>`<article class="vd-card"><a href="${path(item.id)}" aria-label="Ver ${esc(item.title)}"><div class="vd-photo"><img src="${item.image}" alt="" width="506" height="335" loading="lazy" decoding="async"></div><div class="vd-card-copy"><p class="vd-location">${esc(item.place)}</p><h3>${esc(item.title)}</h3><p>${esc(item.question)}</p><span class="vd-open">Ver historia</span></div></a></article>`).join('')+'</div>';
  }
  function home(opts={}) {
    return `<section class="vd-section vd-home" aria-labelledby="shelf-title"><header class="vd-head"><div><p class="vd-label">Valdemar · Primer mes</p><h2 id="shelf-title" tabindex="-1">Cuatro historias para tu próxima noche.</h2></div><a class="vd-textlink" href="/#casos">Ver las 12 historias</a></header>${cards(1)}</section>`;
  }
  function list(opts={}) {
    const month=[1,2,3].includes(Number(opts.month))?Number(opts.month):1;
    return `<section class="vd-section vd-list"><header class="vd-head"><div><p class="vd-label">Temporada 01 · Valdemar</p><h1>Las doce historias</h1><p class="vd-intro">Escucha, investiga y decide cómo termina cada misterio. Una persona puede seguir las pruebas mientras la otra juega un reto para ganar una llave.</p></div></header><nav class="vd-months" aria-label="Mes de la temporada">${[1,2,3].map(n=>`<a href="/#casos?mes=${n}"${month===n?' aria-current="page"':''}>Mes ${n}</a>`).join('')}</nav><h2 class="vd-group" tabindex="-1">Las historias del mes ${month}</h2>${cards(month)}<p class="vd-foot"><a href="/#archivo-clasico">Visitar el archivo de casos anteriores</a></p></section>`;
  }
  function detail(id, opts={}) {
    const item=get(id);
    if(!item)return '<section class="vd-section"><h1>Historia no encontrada</h1><a class="vd-textlink" href="/#casos">Volver a las doce historias</a></section>';
    const unlocked=access(item,opts);
    const message=unlocked?'Esta historia está incluida en tu acceso.':opts.canPlay?`Esta historia se abre en el mes ${item.month} de tu pase.`:`Esta historia forma parte del mes ${item.month} del pase de temporada.`;
    const primary=unlocked?`<a class="vd-cta" href="/#valdemar-jugar?id=${item.id}">Abrir la investigación</a>`:`<a class="vd-cta" href="/#planes">${opts.canPlay?'Ver mi pase':'Ver el pase de Valdemar'}</a>`;
    return `<article class="vd-detail"><a class="vd-back" href="/#casos?mes=${item.month}">Volver al mes ${item.month}</a><div class="vd-feature"><div class="vd-description"><p class="vd-label">Mes ${item.month} · Historia ${number(item.id)}</p><h1>${esc(item.title)}</h1><p class="vd-hook">${esc(item.question)}</p><p class="vd-format">A solas o en compañía · Investigación multimedia</p><p class="vd-availability">${message}</p><div class="vd-actions">${primary}${unlocked?'':'<button type="button" data-action="preview-open" class="vd-ghost">Probar Clínica Vallejo gratis</button>'}</div></div><figure><img src="${item.image}" width="506" height="335" alt="" fetchpriority="high"><figcaption>${esc(item.place)}</figcaption></figure></div><section class="vd-brief"><h2>Dentro de la historia</h2><p>Cruza una grabación, una imagen, un documento y un archivo web de Valdemar. El reto paralelo permite ganar una llave para abrir un sobre de ayuda. La decisión final queda guardada en tu partida.</p></section></article>`;
  }
  const exports = Object.freeze({items:Object.freeze(items.map(Object.freeze)), get, path, access, home, list, detail});
  window.ValdemarCatalog=exports;
})();
