(() => {
  'use strict';

  const cases = [
    ['El secreto de los dos mundos', 'La mansión de Valdemar', 'Ada os envía una fotografía de vuestra infancia. Reconocéis vuestras caras. Ninguno recuerda esa casa.', 'Explora la mansión habitada. Habla con Elías y pon en marcha los mecanismos de Ada.', 'Cruza su versión abandonada. Lee los rastros que han sobrevivido y envía objetos al otro lado.', 'La verja y la fachada de piedra de Valdemar bajo la tormenta.', '/mansion-room-1.webp'],
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
  function cards(month,listing) {
    const games=listing?.games||items.filter(item=>item.month===month);
    return '<div class="vd-cards">'+games.map(item=>{
      const local=(item.id-1)%12+1;
      const href=item.world?'/#'+item.world+'?lugar='+local+'&amp;seccion=ficha':path(item.id);
      const photo=`<div class="vd-photo"><img src="${item.image||'/mundo-'+item.id+'.webp'}" alt="" width="764" height="508" loading="lazy" decoding="async"><span class="vd-location">${esc(item.place)}</span></div>`;
      const summary=`<h3>${esc(item.title)}</h3><p>${esc(item.question)}</p>`;
      if(!listing)return `<article class="vd-card"><a href="${href}" aria-label="Ver ${esc(item.title)}">${photo}<div class="vd-card-copy">${summary}<div class="vd-card-foot"><span>${item.id===1?'75–90 min':'≈ 60 min'} · 1–2 personas</span><span class="vd-open" aria-hidden="true">→</span></div></div></a></article>`;
      const available=listing.allowed.has(item.id),recovered=listing.done.has(item.id);
      const play='/#'+(item.world?'mundos-jugar':'valdemar-jugar')+'?id='+item.id;
      const label=available?(recovered?'Ver mi desenlace':'Jugar'):'Ver ficha';
      const extra=available?`<a class="vd-card-info" href="${href}" aria-label="Ver ficha de ${esc(item.title)}">Ficha</a>`:'';
      const facts=[item.id===1?'75–90 min':'',recovered?'Pieza recuperada':''].filter(Boolean);
      return `<article class="vd-card"><div class="vd-card-layout">${photo}<div class="vd-card-copy">${summary}${facts.length?'<small class="vd-card-state">'+facts.join(' · ')+'</small>':''}<div class="vd-card-foot"><a class="vd-card-action" href="${available?play:href}" aria-label="${esc(label+' · '+item.title)}">${label}</a>${extra}</div></div></div></article>`;
    }).join('')+'</div>';
  }
  function home() {
    return `<section class="vd-section vd-home" aria-labelledby="shelf-title"><header class="vd-head"><div><p class="vd-label">Código Valdemar · Primer mes</p><h2 id="shelf-title" tabindex="-1">Cuatro historias para tu próxima noche.</h2></div><nav class="vd-route-links" aria-label="Explorar Código Valdemar"><a class="vd-textlink" href="/#casos">Ver los 12 juegos</a><a class="vd-textlink" href="/#mapa">Plano secreto</a></nav></header>${cards(1)}</section>`;
  }
  function list(opts={}) {
    const collections=window.Colecciones;
    const season=collections?.catalogBoard?.()||{name:'Código Valdemar',board:'mapa',genre:'Misterio',action:'Desplegar el plano'};
    const world=season.board;
    const month=[1,2,3].includes(Number(opts.month))?Number(opts.month):1;
    const first=(month-1)*4+1;
    const inWorld=world==='mapa'?items:(window.MundosCatalogo||[]).filter(item=>item.world===world);
    const games=inWorld.filter(item=>Math.floor(((item.id-1)%12)/4)+1===month);
    const seasonAccess=opts.seasonAccess||window.ClubAccess?.state?.seasonAccess;
    const allowed=new Set(seasonAccess?.availableCases||[]),done=new Set(seasonAccess?.completed||opts.completed||[]);
    if(opts.admin||window.ClubAccess?.state?.role==='admin')inWorld.forEach(item=>allowed.add(item.id));
    else if(world==='mapa'&&!seasonAccess)items.filter(item=>access(item,opts)).forEach(item=>allowed.add(item.id));
    const map=world==='mapa'?'mapa?mes='+month:world+'?lugar='+first;
    const monthLink=n=>collections?.catalogRoute?.(world,n)||'/#casos?mes='+n;
    return `<section class="vd-section vd-list" data-catalog-world="${world}"><header class="vd-head"><div><h1>Juegos</h1><p class="vd-catalog-intro">Elige una temporada para ver sus juegos. Puedes explorar las fichas o jugar a las aventuras que tengas disponibles.</p><p class="vd-label">1–2 participantes · ≈ 60 min por juego</p></div><nav class="vd-route-links" aria-label="Mapa de la temporada elegida"><a class="vd-textlink" href="/#${map}">Ver el mapa de esta temporada ↗</a><a class="vd-textlink" href="/#como-se-juega">Cómo se juega</a></nav></header>
      ${collections?.menu?.('casos')||''}
      <nav class="vd-months" aria-label="Bloques de ${esc(season.name)}">${[1,2,3].map(n=>`<a href="${esc(monthLink(n))}"${month===n?' aria-current="page"':''}>Bloque ${n} <small>${number((n-1)*4+1)}–${number(n*4)}</small></a>`).join('')}</nav>
      ${cards(month,{games,done,allowed})}
      ${world==='mapa'?'<p class="vd-foot"><a href="/#archivo-clasico">Visitar el archivo de casos anteriores</a></p>':''}</section>`;
  }
  function entry(item,opts,unlocked) {
    const href=unlocked?'/#valdemar-jugar?id='+item.id:'/#planes';
    const label=unlocked?(opts.completed?.includes(item.id)?'Ver mi desenlace':'Abrir la investigación'):opts.canPlay?'Ver mi pase':'Ver la suscripción mensual';
    return `<a class="vd-cta" href="${href}">${label}</a>`;
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
  function mansionCover(detailView=false,unlocked=false) {
    const letter=detailView
      ? '<button type="button" data-mansion-letter>Abrir la carta de Ada</button>'
      : '<a href="/valdemar/01/?carta=1">Abrir la carta de Ada</a>';
    const enter='<a href="/#valdemar-jugar?id=1">Entrar en la mansión</a>';
    const alternate=detailView ? '<a href="/cinta-87.html?caso=01">Jugar la demo de La cinta 87</a>' : '<a href="/cinta-87.html">Jugar la demo de La cinta 87</a>';
    return `<section class="mansion-entry mansion-entry-cover" aria-labelledby="mansion-entry-title">
      <div class="mansion-entry-art"><img src="/mansion-room-1.webp" alt="La verja de hierro entreabierta da paso a la mansión de Valdemar." width="800" height="520" fetchpriority="high"></div>
      <div class="mansion-entry-copy"><p class="mansion-entry-kicker">Código Valdemar · Episodio 01</p><h1 id="mansion-entry-title">El secreto de los dos mundos</h1>
      <p>Ada os envía una foto de vuestra infancia tomada frente a una casa que ninguno recuerda. Cuando llegáis, uno encuentra luz en las ventanas. El otro las ve tapiadas.</p>
      <div class="mansion-entry-actions">${unlocked?enter+letter:letter+alternate}</div>
      ${detailView?(window.RetosTemporada?.acceso(1,unlocked)||''):''}
      <p class="mansion-entry-format">Aventura gráfica · 1–2 jugadores · 75–90 min estimados</p></div></section>`;
  }
  function mansionDetail(unlocked,message) {
    return `<article class="mansion-public"><nav class="vd-route-links" aria-label="Explorar Código Valdemar"><a class="vd-back" href="/#casos?mes=1">Volver a los juegos de Código Valdemar</a></nav>
      ${mansionCover(true,unlocked)}
      <details class="mansion-letter" id="carta-de-ada"><summary>El sobre de Ada <span>Prólogo gratuito</span></summary>
        <div class="mansion-letter-inside"><div><p class="mansion-paper-label">Correspondencia privada</p><h2>«No confiéis en los relojes»</h2>
        <p>Si estáis leyendo esto, significa que he fracasado. Debéis regresar a Valdemar. No confiéis en vuestros recuerdos. No confiéis en los relojes. Y, sobre todo, si escucháis mi voz detrás de una puerta, no la abráis.</p>
        <p>Lo que ocurrió aquella noche no fue un accidente. Tenéis que encontrar la primera pieza.</p><p class="mansion-signature">A.</p>
        <audio controls preload="none" aria-label="Escuchar la carta de Ada" src="/mansion-ada-letter.wav"></audio></div>
        <figure class="mansion-postcard"><img src="/mansion-photo.webp" alt="Dos niños de la mano ante la verja de Valdemar. Una mano adulta asoma en el borde." width="640" height="420" loading="lazy"><figcaption>En el reverso, con tinta azul: «Antes de que se separara la casa».</figcaption></figure></div>
        <div class="mansion-threshold"><h3>Al otro lado de la verja</h3><p>Examina la entrada desde los ojos de cada protagonista.</p>
        <div class="mansion-era-controls" role="group" aria-label="Perspectiva"><button type="button" data-mansion-world="A" aria-pressed="true">La casa habitada</button><button type="button" data-mansion-world="B" aria-pressed="false">La casa abandonada</button></div>
        <figure><img data-mansion-threshold-image src="/mansion-room-1.webp" width="800" height="520" alt="La entrada de la mansión habitada" loading="lazy"><figcaption data-mansion-threshold-note aria-live="polite">Hay luz en las ventanas. El guardián espera junto a la verja.</figcaption></figure>
        <p>Cinco capítulos, ocho escenarios y quince pruebas os separan de la cámara de resonancia.</p>
        <div class="mansion-era-controls"><a href="${unlocked?'/#valdemar-jugar?id=1':'/#planes'}">${unlocked?'Entrar en la mansión':'Ver el pase para continuar'}</a></div><small>${esc(message)}</small></div>
      </details></article>`;
  }
  function detail(id,opts={}) {
    const item=get(id);
    if(!item)return '<section class="vd-section"><h1>Historia no encontrada</h1><a class="vd-textlink" href="/#casos">Volver a los juegos</a></section>';
    const unlocked=access(item,opts);
    const message=unlocked?(opts.fullyPaid?'Incluida en tus bloques abonados de Código Valdemar.':'Incluida en tu acceso.'):opts.canPlay?`Se abre en el mes ${item.month} de tu pase.`:`Incluida en el mes ${item.month} de tu temporada.`;
    const cta=entry(item,opts,unlocked);
    if(item.id===1)return mansionDetail(unlocked,message);
    const sample=item.id===2?`<button type="button" data-vd-start class="${unlocked?'vd-ghost':'vd-cta'}">Atender la llamada</button>`:'';
    const demo=unlocked?'':`<a class="vd-textlink" href="/cinta-87.html?caso=${number(item.id)}">Probar gratis la demo de La cinta 87</a>`;
    const actions=item.id===2?(unlocked?cta+sample:sample+cta.replace('class="vd-cta"','class="vd-ghost"')):cta;
    const adjacent=[get(item.id-1),get(item.id+1)].filter(Boolean).map(other=>
      `<a href="${path(other.id)}"><span>${other.id<item.id?'Expediente anterior':'Expediente siguiente'}</span><strong>${esc(other.title)}</strong></a>`
    ).join('');
    return `<article class="vd-detail"><nav class="vd-route-links" aria-label="Explorar Código Valdemar"><a class="vd-back" href="/#casos?mes=${item.month}">Volver a los juegos del bloque ${item.month}</a><a class="vd-back" href="/#mapa?mes=${item.month}&amp;lugar=${item.id}">Situar en el plano</a></nav>
      <header class="vd-feature"><figure><img src="${item.image}" width="764" height="508" alt="${esc(item.coverAlt)}" fetchpriority="high"><figcaption>${esc(item.place)}</figcaption></figure>
      <div class="vd-description"><p class="vd-label">Código Valdemar · Historia ${number(item.id)}</p><h1>${esc(item.title)}</h1><p class="vd-hook">${esc(item.question)}</p><p class="vd-format">≈ 60 min <span aria-hidden="true">/</span> 1–2 personas</p><div class="vd-actions">${actions}</div>${window.RetosTemporada?.acceso(item.id,unlocked)||''}${unlocked?'':'<p class="vd-availability">'+esc(message)+'</p>'}</div></header>
      ${item.id===2?hotelCall(cta):''}
      <section class="vd-brief"><div><h2>Los dos papeles</h2><details class="vd-modes-help"><summary>Cómo repartirse las pistas</summary><p>A solas puedes abrir ambas carpetas. En pareja, elegíos en vuestros perfiles y pulsad «En pareja» en el caso. Cada uno recibe una carpeta.</p><a class="vd-textlink" href="/#perfil">Ver mi compañero de juego</a></details></div><ol><li><strong>Papel 1</strong>${esc(item.roleA)}</li><li><strong>Papel 2</strong>${esc(item.roleB)}</li></ol></section>
      <nav class="vd-case-steps" aria-label="Otros expedientes de Código Valdemar">${adjacent}</nav>${demo}</article>`;
  }
  window.ValdemarCatalog=Object.freeze({items:Object.freeze(items),get,path,access,home,list,detail,mansionCover});
})();
