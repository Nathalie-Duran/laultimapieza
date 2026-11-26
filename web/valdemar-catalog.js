(() => {
  'use strict';

  const cases = [
    ['Mundos cruzados', 'La estación', 'En 1996, una voz pide que guardéis una cinta para Ada. Treinta años después, ¿dónde debe buscarla?', 'Explora la estación antes de las obras.', 'Sigue en 2026 el rastro de los objetos que sobrevivieron.', 'Una cinta de casete sobre el banco verde de una estación bajo la lluvia.'],
    ['Hotel Medianoche', 'El hotel', 'Llegan tres huéspedes con una llave cada uno. Las tres abren la habitación 14. ¿Cuál de ellos es el hermano de la mujer que llama desde dentro?', 'Desde recepción, escucha a los huéspedes y revisa las reservas.', 'En el turno de noche, atiende la centralita y consulta los planos.', 'Tres llaves y un timbre de latón sobre el mostrador del hotel.'],
    ['Cita en otra vida', 'El último tren', 'Llevas una carta que tu madre te pidió entregar. En el último tren, el pasajero de enfrente reconoce la letra de su padre. ¿Qué pasó en aquella cita de hace veinticinco años?', 'Llevas una carta que tu madre te pidió entregar.', 'Reconoces la letra de tu padre y conservas un billete sin usar.', 'Dos pasajeros frente a frente en el tren, con una carta entre ambos.'],
    ['Frecuencia 23:17', 'La emisora', 'Un padre y su hija llaman a una emisora desde años distintos. ¿A quién devolverías la llamada?', 'Escucha las dos emisiones desde la mesa de sonido.', 'Contrasta lo que oyes con las antiguas parrillas de programación.', 'Un micrófono junto a la mesa de sonido, con una onda amarilla en el monitor.'],
    ['El Consejo de la Isla', 'La isla', 'Dos pueblos aseguran que guiaron al mismo ferry. ¿Qué señales vio el patrón y cómo repartirías el presupuesto de los muelles?', 'Investiga el funcionamiento del faro desde Puerto Norte.', 'Reconstruye la travesía con el cuaderno del ferry de Cala Sur.', 'Un ferry navega entre dos luces costeras al anochecer.'],
    ['La subasta de los objetos perdidos', 'La casa de subastas', 'Amalia te da tres fichas. Entre los lotes de la subasta hay un recuerdo de su marido. ¿Por cuál pujarías?', 'Examina los lotes y busca los detalles que faltan en el catálogo.', 'Escucha a sus antiguos dueños y prepara las pujas.', 'Un reloj de bolsillo, un gemelo y un botón azul sobre terciopelo, con tres fichas delante.', '/valdemar-subasta-lotes.webp'],
    ['El negativo número 13', 'El paseo marítimo', 'La foto de un rescate convirtió a un bañista en héroe. ¿Qué pasó antes de que el fotógrafo apretara el disparador?', 'Ordena los negativos en el laboratorio fotográfico.', 'Desde la playa, comprueba qué podía ver cada testigo.', 'Una tira de negativos bajo la luz roja del laboratorio.'],
    ['El jardín de las promesas', 'El jardín', 'Dos personas esperan en bancos distintos. Cada una lleva una camelia blanca y asegura estar en el lugar de la cita. ¿Cómo pueden tener razón las dos?', 'Busca traslados y nuevas plantaciones en el archivo del jardín.', 'Recorre el parque actual a través de sus fotografías.', 'Una camelia blanca descansa sobre un banco de madera. Hay un segundo banco al fondo del invernadero.', '/valdemar-jardin-camelia.webp'],
    ['La casa de las dos herencias', 'La casa familiar', 'Dos hermanas dibujan de memoria la cocina de su infancia. ¿Por qué dan las ventanas a lugares distintos?', 'Reconstruye la casa a partir de los recuerdos de Lucía.', 'Sigue los recorridos de su hermana Mara y compáralos con el plano.', 'Dos planos sobre un caballete junto a una puerta tapiada.'],
    ['El banquete de las sillas vacías', 'El salón de bodas', 'Dos abuelos llevan treinta años sin hablarse. En la boda aparecen dos invitaciones en sobres nuevos, pero el papel lleva años doblado. ¿Quién las escribió?', 'Escucha lo que recuerda una de las familias.', 'Revisa la distribución de las mesas con la otra familia.', 'Dos sillas vacías en una mesa de boda con dos sobres entre las copas.'],
    ['La partida que nadie ganó', 'El club de juegos', 'En la vitrina del club faltan las cuatro piezas capturadas en una final. ¿Qué mensaje dejaron los jugadores en el tablero?', 'Reproduce la secuencia que Alba dejó en su cuaderno.', 'Reconstruye las respuestas anotadas por León.', 'Dos manos levantan piezas sobre el tablero de ajedrez.'],
    ['La oficina de los finales pendientes', 'El archivo municipal', 'En tres fotos del puente, el reloj de la torre siempre marca las seis. ¿Qué pasó en los once minutos que faltan?', 'Contrasta las horas en la sala del reloj.', 'Reconstruye el mismo intervalo con los testimonios del archivo.', 'Un reloj de pared sobre las estanterías del archivo, con una lámpara encendida.']
  ];
  const number = n => String(n).padStart(2,'0');
  const items = cases.map(([title,place,question,roleA,roleB,coverAlt,coverPath],i)=>Object.freeze({
    id:i+1, title, place, question, month:1+Math.floor(i/4), image:coverPath ?? '/valdemar-art-'+number(i+1)+'.webp', roleA, roleB, coverAlt
  }));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const get = id => items.find(item=>item.id===Number(id));
  const path = id => '/valdemar/'+number(id)+'/';
  function access(item,opts={}) {
    if(opts.admin===true || opts.role==='admin')return true;
    const months=opts.openedMonths??0;
    return opts.canPlay===true && (Array.isArray(months) ? months.includes(item.month) : Number(months)>=item.month);
  }
  function cards(month) {
    return '<div class="vd-cards">'+items.filter(item=>item.month===month).map(item=>
      `<article class="vd-card"><a href="${path(item.id)}" aria-label="Ver ${esc(item.title)}">
        <div class="vd-photo"><img src="${item.image}" alt="" width="764" height="508" loading="lazy" decoding="async"><span class="vd-location">${esc(item.place)}</span></div>
        <div class="vd-card-copy"><h3>${esc(item.title)}</h3><p>${esc(item.question)}</p><div class="vd-card-foot"><span>≈ 60 min · 1–2 personas</span><span class="vd-open" aria-hidden="true">→</span></div></div>
      </a></article>`
    ).join('')+'</div>';
  }
  function home() {
    return `<section class="vd-section vd-home" aria-labelledby="shelf-title"><header class="vd-head"><div><p class="vd-label">Valdemar · Primer mes</p><h2 id="shelf-title" tabindex="-1">Cuatro historias para tu próxima noche.</h2></div><nav class="vd-route-links" aria-label="Explorar Valdemar"><a class="vd-textlink" href="/#casos">Ver las 12 historias</a><a class="vd-textlink" href="/#mapa">Plano secreto</a></nav></header>${cards(1)}</section>`;
  }
  function list(opts={}) {
    const month=[1,2,3].includes(Number(opts.month))?Number(opts.month):1;
    return `<section class="vd-section vd-list"><header class="vd-head"><div><p class="vd-label">Valdemar · Temporada 1</p><h1>Las doce historias</h1><p class="vd-intro">Cuatro misterios cada mes para jugar a solas o compartir pantalla. ¿Por dónde empiezas?</p></div><a class="vd-textlink" href="/#mapa?mes=${month}">Explorar el mes en el plano</a></header><nav class="vd-months" aria-label="Mes de la temporada">${[1,2,3].map(n=>`<a href="/#casos?mes=${n}"${month===n?' aria-current="page"':''}>Mes ${n}</a>`).join('')}</nav><h2 class="vd-group" tabindex="-1">Las historias del mes ${month}</h2>${cards(month)}<p class="vd-foot"><a href="/#archivo-clasico">Visitar el archivo de casos anteriores</a></p></section>`;
  }
  function entry(item,opts,unlocked) {
    const href=unlocked?'/#valdemar-jugar?id='+item.id:'/#planes';
    return `<a class="vd-cta" href="${href}">${unlocked?'Abrir la investigación':opts.canPlay?'Ver mi pase':'Ver el pase de Valdemar'}</a>`;
  }
  function hotelCall(cta) {
    return `<section class="vd-sampler" aria-labelledby="vd-call-title"><div class="vd-sampler-intro"><p class="vd-label">Prueba gratis · 1 min</p><h2 id="vd-call-title">Recepción de noche</h2><p>Suena el teléfono de servicio. La guía de la centralita está abierta junto al auricular. ¿Desde qué ala llega el aviso?</p></div>
      <details class="vd-call" data-vd-call><summary data-vd-offhook><span aria-hidden="true" class="vd-call-led"></span>Atender la llamada<span class="vd-call-toggle" aria-hidden="true"></span></summary>
        <div class="vd-call-inner"><div class="vd-audio-actions"><button type="button" data-vd-listen>Reproducir señal</button><details data-vd-transcript><summary>Leer transcripción</summary><p>Se oyen dos timbres, una pausa y un clic seco.</p></details></div><p role="status" class="vd-sound-status" data-vd-sound-status></p>
        <div class="vd-call-guide"><h3>Guía de la centralita</h3><dl><div><dt><i class="vd-ring" aria-hidden="true"></i>Un timbre</dt><dd>Ala del patio</dd></div><div><dt><i class="vd-ring" aria-hidden="true"></i><i class="vd-ring" aria-hidden="true"></i>Dos timbres</dt><dd>Ala de la estación</dd></div><div><dt><i class="vd-click" aria-hidden="true"></i>Clic final</dt><dd>Solicitan una copia de planta</dd></div></dl></div>
        <fieldset class="vd-call-switch"><legend>¿Qué ala ha llamado?</legend><button type="button" data-vd-plug="patio">Ala del patio</button><button type="button" data-vd-plug="estacion">Ala de la estación</button></fieldset>
        <p class="vd-call-result" role="status" data-vd-call-result></p><div class="vd-call-next" data-vd-call-next hidden>${cta}</div></div>
      </details></section>`;
  }
  function detail(id,opts={}) {
    const item=get(id);
    if(!item)return '<section class="vd-section"><h1>Historia no encontrada</h1><a class="vd-textlink" href="/#casos">Volver a las doce historias</a></section>';
    const unlocked=access(item,opts);
    const message=unlocked?'Incluida en tu acceso.':opts.canPlay?`Se abre en el mes ${item.month} de tu pase.`:`Incluida en el mes ${item.month} del pase de temporada.`;
    const cta=entry(item,opts,unlocked);
    const sample=item.id===2?`<button type="button" data-vd-start class="${unlocked?'vd-ghost':'vd-cta'}">Atender la llamada</button>`:'';
    const actions=item.id===2?(unlocked?cta+sample:sample+cta.replace('class="vd-cta"','class="vd-ghost"')):cta+(unlocked?'':'<button type="button" data-action="preview-open" class="vd-ghost">Probar Clínica Vallejo gratis</button>');
    return `<article class="vd-detail"><nav class="vd-route-links" aria-label="Explorar Valdemar"><a class="vd-back" href="/#casos?mes=${item.month}">Volver al mes ${item.month}</a><a class="vd-back" href="/#mapa?mes=${item.month}&amp;lugar=${item.id}">Situar en el plano</a></nav>
      <header class="vd-feature"><figure><img src="${item.image}" width="764" height="508" alt="${esc(item.coverAlt)}" fetchpriority="high"><figcaption>${esc(item.place)}</figcaption></figure>
      <div class="vd-description"><p class="vd-label">Valdemar · Historia ${number(item.id)}</p><h1>${esc(item.title)}</h1><p class="vd-hook">${esc(item.question)}</p><p class="vd-format">≈ 60 min <span aria-hidden="true">/</span> 1–2 personas</p><div class="vd-actions">${actions}</div><p class="vd-availability">${message}</p></div></header>
      ${item.id===2?hotelCall(cta):''}
      <section class="vd-brief"><div><h2>Los papeles de esta historia</h2><p>A solas puedes consultar las dos carpetas. En pareja, compartid la pantalla y repartíos los papeles.</p></div><ol><li><strong>Papel 1</strong>${esc(item.roleA)}</li><li><strong>Papel 2</strong>${esc(item.roleB)}</li></ol></section>
      <p class="vd-method">Cruza audios, imágenes, documentos y archivos web. La primera vez que superes el reto paralelo de esta historia ganarás una llave. Puedes usarla para abrir un sobre de ayuda.</p></article>`;
  }
  window.ValdemarCatalog=Object.freeze({items:Object.freeze(items),get,path,access,home,list,detail});
})();
