(() => {
  'use strict';

  const cases = [
    ['El secreto de los dos mundos', 'La mansión de Valdemar', 'Ada os envía una fotografía de vuestra infancia. Reconocéis vuestras caras. Ninguno recuerda esa casa.', 'Explora la mansión habitada. Habla con Elías y pon en marcha los mecanismos de Ada.', 'Cruza su versión abandonada. Lee los rastros que han sobrevivido y envía objetos al otro lado.', 'La verja y la fachada de piedra de Valdemar bajo la tormenta.', '/mansion-room-1.webp'],
    ['Hotel Medianoche', 'El hotel', 'Llegan tres huéspedes con una llave cada uno. Las tres abren la habitación 14. ¿Cuál de ellos es el hermano de la mujer que llama desde dentro?', 'Desde recepción, escucha a los huéspedes y revisa las reservas.', 'En el turno de noche, atiende la centralita y consulta los planos.', 'Tres llaves y un timbre de latón sobre el mostrador del hotel.'],
    ['Cita en otra vida', 'El último tren', 'En el último tren, el pasajero de enfrente reconoce la letra de su padre en tu carta. ¿Qué pasó en aquella cita de hace veinticinco años?', 'Investiga a quién iba dirigida la carta que te confió tu madre.', 'Reconoces la letra de tu padre y conservas un billete sin usar.', 'Dos pasajeros frente a frente en el tren, con una carta entre ambos.'],
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
    id:i+1, title, place, question, month:1+Math.floor(i/4), image:coverPath ?? '/valdemar-art-'+number(i+1)+'.webp', roleA, roleB, coverAlt,
    duration:i===0?'75–90 min':'60 min'
  }));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const get = id => items.find(item=>item.id===Number(id));
  const path = id => '/valdemar/'+number(id)+'/';
  function access(item,opts={}) {
    if(opts.admin===true || opts.role==='admin')return true;
    const available=opts.seasonAccess?.availableCases??opts.availableCases;
    if(Array.isArray(available))return available.includes(item.id);
    const months=opts.openedMonths??0;
    return opts.canPlay===true && (Array.isArray(months) ? months.includes(item.month) : Number(months)>=item.month);
  }
  function playAction(item,finished,games) {
    const href='/#'+(item.id>12?'mundos-jugar':'valdemar-jugar')+'?id='+item.id;
    const saved=games?.find(game=>game.id===item.id);
    if(saved?.edition==='legacy')return {href,label:'Jugar'};
    if(saved?.finished||(!saved&&finished))return {href,label:'Ver mi desenlace'};
    if(saved?.mode||saved?.current>0)return {href:href+'&retomar=1',label:'Continuar'};
    return {href,label:'Jugar'};
  }
  function playLink(item,finished,games,className) {
    const action=playAction(item,finished,games);
    return `<a class="${className}" href="${esc(action.href)}" aria-label="${esc(action.label+' · '+item.title)}" data-vd-play="${item.id}">${action.label}</a>`;
  }
  // Update the existing links so a progress refresh preserves keyboard focus.
  if(window.customElements&&!window.customElements.get('vd-block-progress')){
    let pending;
    function readProgress(bridge,player) {
      if(pending?.bridge===bridge&&pending.player===player)return pending.request;
      const request=bridge.request('/api/valdemar/partidas').finally(()=>{
        if(pending?.request===request)pending=null;
      });
      pending={bridge,player,request};
      return request;
    }
    window.customElements.define('vd-block-progress',class extends window.HTMLElement {
      async connectedCallback(){
        const bridge=window.GameAccountBridge;
        if(!bridge?.isSignedIn?.() || this.hasAttribute('data-progress-known'))return;
        const player=bridge.playerId?.();
        const links=this.querySelectorAll('[data-vd-play]');
        if(!links.length)return;
        try {
          const report=await readProgress(bridge,player);
          if(!this.isConnected||player!==bridge.playerId?.()||!Array.isArray(report.games))return;
          for(const link of links){
            const id=Number(link.dataset.vdPlay),item=get(id)||window.MundosCatalogo?.find(game=>game.id===id);
            if(!item)continue;
            const action=playAction(item,report.access?.completed?.includes(id),report.games);
            link.textContent=action.label;
            link.setAttribute('href',action.href);
            link.setAttribute('aria-label',action.label+' · '+item.title);
          }
        }catch{ /* The standard game link still opens the player's case. */ }
      }
    });
  }
  function cards(month,listing) {
    const games=listing?.games||items.filter(item=>item.month===month);
    const firstBlock=month===1&&games[0]?.id===1;
    const contents='<div class="vd-cards">'+games.map(item=>{
      const local=(item.id-1)%12+1;
      const href=item.world?'/#'+item.world+'?lugar='+local+'&amp;seccion=ficha':path(item.id);
      const photo=`<div class="vd-photo"><img src="${item.image||'/mundo-'+item.id+'.webp'}" alt="${firstBlock?esc(item.coverAlt):''}" width="764" height="508" loading="lazy" decoding="async"><span class="vd-location">${esc(item.place)}</span></div>`;
      const summary=`<h3>${esc(item.title)}</h3><p>${esc(item.question)}</p>`;
      if(!listing)return `<article class="vd-card"><a href="${href}" aria-label="Ver ${esc(item.title)}">${photo}<div class="vd-card-copy">${summary}<div class="vd-card-foot"><span>${item.duration} · A solas o en pareja</span><span class="vd-open" aria-hidden="true">→</span></div></div></a></article>`;
      const available=listing.allowed.has(item.id),recovered=listing.done.has(item.id);
      const extra=available?`<a class="vd-card-info" href="${href}" aria-label="Ver ficha de ${esc(item.title)}">Ficha</a>`:'';
      const facts=[firstBlock?item.duration:'',recovered?'Pieza recuperada':listing.member&&!available?'Bloque pendiente':''].filter(Boolean);
      const mainAction=available?playLink(item,recovered,listing.progress,'vd-card-action'):`<a class="vd-card-action" href="${href}" aria-label="Ver ficha · ${esc(item.title)}">Ver ficha</a>`;
      return `<article class="vd-card"><div class="vd-card-layout">${photo}<div class="vd-card-copy">${summary}${facts.length?'<small class="vd-card-state">'+facts.join(' · ')+'</small>':''}<div class="vd-card-foot">${mainAction}${extra}</div></div></div></article>`;
    }).join('')+'</div>';
    return listing?`<vd-block-progress${firstBlock?' class="vd-block-shelf"':''}${listing.progress?' data-progress-known':''}>${contents}</vd-block-progress>`:contents;
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
    const guest=!opts.canPlay&&!opts.admin&&!window.ClubAccess?.canPlay;
    const offer=window.ClubAccess?.offerAction||{href:'/#planes',label:'Ver la suscripción'};
    const price=window.ClubAccess?.price;
    const intro=guest?'Abre una ficha para descubrir qué misterio te espera. La suscripción empieza con los cuatro primeros juegos de Código Valdemar. Cada temporada reúne doce.':'Elige una temporada para ver sus juegos. Abre una ficha o continúa una aventura disponible.';
    const actions=guest?`<nav class="vd-actions" aria-label="Suscripción y demo"><a class="vd-cta" href="${esc(offer.href)}">${esc(offer.label)}</a><a class="vd-textlink" href="/cinta-87.html" data-action="preview-open">Probar la demo sin cuenta</a></nav>`:'';
    return `<section class="vd-section vd-list" data-catalog-world="${world}"><header class="vd-head"><div><h1>Juegos</h1><p class="vd-catalog-intro">${intro}</p><p class="vd-label">1–2 participantes${world==='mapa'&&month===1?'':' · ≈ 60 min por juego'}${guest&&price?' · '+esc(price)+' por persona al mes':''}</p>${actions}</div><nav class="vd-route-links" aria-label="Mapa y guía"><a class="vd-textlink" href="/#${map}">Ver el mapa de esta temporada ↗</a>${guest?'':'<a class="vd-textlink" href="/#como-se-juega">Cómo se juega</a>'}</nav></header>
      ${collections?.menu?.('casos')||''}
      <nav class="vd-months" aria-label="Bloques de ${esc(season.name)}">${[1,2,3].map(n=>`<a href="${esc(monthLink(n))}"${month===n?' aria-current="page"':''}>Bloque ${n} <small>${number((n-1)*4+1)}–${number(n*4)}</small></a>`).join('')}</nav>
      ${collections?.proximoBloque?.(games[0]?.id)||''}${cards(month,{games,done,allowed,progress:opts.games,member:!guest})}
      </section>`;
  }
  function entry(item,opts,unlocked) {
    if(unlocked)return '<vd-block-progress'+(opts.games?' data-progress-known':'')+'>'+playLink(item,opts.completed?.includes(item.id),opts.games,'vd-cta')+'</vd-block-progress>';
    return `<a class="vd-cta" href="${opts.canPlay?'/#suscripcion':'/#planes'}">${opts.canPlay?'Ver mi suscripción':'Ver la suscripción'}</a>`;
  }
  function hotelCall() {
    return `<section class="vd-sampler" aria-labelledby="vd-call-title"><div class="vd-sampler-intro"><p class="vd-label">Prueba gratis · 1 min</p><h2 id="vd-call-title">Recepción de noche</h2><p>Suena el teléfono de servicio. La guía de la centralita está abierta junto al auricular. ¿Desde qué ala llega el aviso?</p></div>
      <details class="vd-call" data-vd-call><summary data-vd-offhook><span aria-hidden="true" class="vd-call-led"></span>Atender la llamada<span class="vd-call-toggle" aria-hidden="true"></span></summary>
        <div class="vd-call-inner"><div class="vd-audio-actions"><button type="button" data-vd-listen>Reproducir señal</button><details data-vd-transcript data-game-transcript><summary>Leer transcripción</summary><p>Se oyen dos timbres, una pausa y un clic seco.</p></details></div><p role="status" class="vd-sound-status" data-vd-sound-status></p>
        <div class="vd-call-guide"><h3>Guía de la centralita</h3><dl><div><dt><i class="vd-ring" aria-hidden="true"></i>Un timbre</dt><dd>Ala del patio</dd></div><div><dt><i class="vd-ring" aria-hidden="true"></i><i class="vd-ring" aria-hidden="true"></i>Dos timbres</dt><dd>Ala de la estación</dd></div><div><dt><i class="vd-click" aria-hidden="true"></i>Clic final</dt><dd>Solicitan una copia de planta</dd></div></dl></div>
        <fieldset class="vd-call-switch"><legend>¿Qué ala ha llamado?</legend><button type="button" data-vd-plug="patio">Ala del patio</button><button type="button" data-vd-plug="estacion">Ala de la estación</button></fieldset>
        <p class="vd-call-result" role="status" data-vd-call-result></p><div class="vd-call-next" data-vd-call-next hidden></div></div>
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
  function mansionLetter() {
    return `<details class="mansion-letter" id="carta-de-ada"><summary>Abrir la carta de Ada <span>Prólogo gratuito</span></summary>
        <div class="mansion-letter-inside"><div><p class="mansion-paper-label">Correspondencia privada</p><h2>«No confiéis en los relojes»</h2>
        <p>Si estáis leyendo esto, significa que he fracasado. Debéis regresar a Valdemar. No confiéis en vuestros recuerdos. No confiéis en los relojes. Y, sobre todo, si escucháis mi voz detrás de una puerta, no la abráis.</p>
        <p>Lo que ocurrió aquella noche no fue un accidente. Tenéis que encontrar la primera pieza.</p><p class="mansion-signature">A.</p>
        <audio controls preload="none" aria-label="Escuchar la carta de Ada" src="/mansion-ada-letter.wav"></audio></div>
        <figure class="mansion-postcard"><img src="/mansion-photo.webp" alt="Dos niños de la mano ante la verja de Valdemar. Una mano adulta asoma en el borde." width="640" height="420" loading="lazy"><figcaption>En el reverso, con tinta azul: «Antes de que se separara la casa».</figcaption></figure></div>
        <div class="mansion-threshold"><h3>Al otro lado de la verja</h3><p>Examina la entrada desde los ojos de cada protagonista.</p>
        <div class="mansion-era-controls" role="group" aria-label="Perspectiva"><button type="button" data-mansion-world="A" aria-pressed="true">La casa habitada</button><button type="button" data-mansion-world="B" aria-pressed="false">La casa abandonada</button></div>
        <figure><img data-mansion-threshold-image src="/mansion-room-1.webp" width="800" height="520" alt="La entrada de la mansión habitada" loading="lazy"><figcaption data-mansion-threshold-note aria-live="polite">Hay luz en las ventanas. El guardián espera junto a la verja.</figcaption></figure>
        <p>Cinco capítulos, ocho escenarios y quince pruebas os separan de la cámara de resonancia.</p>
        </div></details>`;
  }
  const perspectives=[
    ['La casa habitada','La casa abandonada'],['Recepción','El turno de noche'],
    ['Quien entrega la carta','Quien reconoce la letra'],['La mesa de sonido','El archivo de la radio']
  ];
  function nearbyFiles(item) {
    const links=[get(item.id-1),get(item.id+1)].filter(Boolean).map(other=>
      `<a href="${path(other.id)}"><span>${other.id<item.id?'Expediente anterior':'Expediente siguiente'}</span><strong>${esc(other.title)}</strong></a>`
    ).join('');
    return `<nav class="vd-case-steps" aria-label="Otros expedientes de Código Valdemar">${links}</nav>`;
  }
  function firstBlockDetail(item,opts,unlocked) {
    const roles=perspectives[item.id-1];
    const finished=(opts.seasonAccess?.completed??opts.completed??[]).includes(item.id);
    const mainAction=unlocked
      ? playLink(item,finished,opts.games,'vd-cta')
      : `<a class="vd-cta" href="${opts.canPlay?'/#suscripcion':'/#planes'}">${opts.canPlay?'Ver mi suscripción':'Ver la suscripción'}</a>`;
    const demo=unlocked?'':`<a class="vd-textlink" href="/cinta-87.html?caso=${number(item.id)}">Probar la demo gratuita</a>`;
    const extra=window.RetosTemporada?.acceso(item.id,unlocked)||'';
    const sample=item.id===1?mansionLetter():item.id===2?hotelCall():'';
    return `<article class="vd-detail vd-first-file">
      <nav class="vd-route-links" aria-label="Explorar Código Valdemar"><a class="vd-back" href="/#casos?mes=1">Volver al bloque 1</a><a class="vd-back" href="/#mapa?mes=1&amp;lugar=${item.id}">Situar en el plano</a></nav>
      <header class="vd-file-hero">
        <figure class="vd-file-photo"><img src="${item.image}" alt="${esc(item.coverAlt)}" width="764" height="508" fetchpriority="high"><figcaption>${esc(item.place)}</figcaption></figure>
        <div class="vd-file-intro"><p class="vd-label">Código Valdemar · Bloque 1</p>
          <h1 tabindex="-1">${esc(item.title)}</h1><p class="vd-hook">${esc(item.question)}</p>
          <ul class="vd-file-facts" aria-label="Datos del juego"><li>${item.duration} estimados</li><li>A solas o en pareja</li></ul>
          <vd-block-progress${opts.games?' data-progress-known':''}><div class="vd-actions">${mainAction}${demo}</div></vd-block-progress>
        </div>
      </header>
      <section class="vd-brief vd-file-roles" aria-labelledby="vd-file-roles-title"><div><h2 id="vd-file-roles-title">Las dos perspectivas</h2><p>A solas investigas desde ambos lados. En pareja, cada persona sigue uno y compartís lo que descubrís.</p><a class="vd-textlink" href="/#como-se-juega">Cómo se juega</a></div>
        <ol><li><strong>${roles[0]}</strong>${esc(item.roleA)}</li><li><strong>${roles[1]}</strong>${esc(item.roleB)}</li></ol>
      </section>
      ${unlocked?'':window.Colecciones?.proximoBloque?.(item.id)||''}
      ${sample}${extra}${window.Colecciones?.reliquiaDeJuego?.(item.id,opts.seasonAccess)||''}${nearbyFiles(item)}
    </article>`;
  }
  function detail(id,opts={}) {
    const item=get(id);
    if(!item)return '<section class="vd-section"><h1>Historia no encontrada</h1><a class="vd-textlink" href="/#casos">Volver a los juegos</a></section>';
    const unlocked=access(item,opts);
    if(item.id<=4)return firstBlockDetail(item,opts,unlocked);
    const message=unlocked?(opts.fullyPaid?'Incluida en tus bloques abonados de Código Valdemar.':'Incluida en tu acceso.'):opts.canPlay?`Se abre en el mes ${item.month} de tu pase.`:`Incluida en el mes ${item.month} de tu temporada.`;
    const cta=entry(item,opts,unlocked);
    const demo=unlocked?'':`<a class="vd-textlink" href="/cinta-87.html?caso=${number(item.id)}">Probar gratis la demo de La cinta 87</a>`;
    return `<article class="vd-detail"><nav class="vd-route-links" aria-label="Explorar Código Valdemar"><a class="vd-back" href="/#casos?mes=${item.month}">Volver a los juegos del bloque ${item.month}</a><a class="vd-back" href="/#mapa?mes=${item.month}&amp;lugar=${item.id}">Situar en el plano</a></nav>
      <header class="vd-feature"><figure><img src="${item.image}" width="764" height="508" alt="${esc(item.coverAlt)}" fetchpriority="high"><figcaption>${esc(item.place)}</figcaption></figure>
      <div class="vd-description"><p class="vd-label">Código Valdemar · Historia ${number(item.id)}</p><h1>${esc(item.title)}</h1><p class="vd-hook">${esc(item.question)}</p><p class="vd-format">≈ 60 min <span aria-hidden="true">/</span> 1–2 personas</p><div class="vd-actions">${cta}</div>${window.RetosTemporada?.acceso(item.id,unlocked)||''}${unlocked?'':'<p class="vd-availability">'+esc(message)+'</p>'}</div></header>
      <section class="vd-brief"><div><h2>Los dos papeles</h2><details class="vd-modes-help"><summary>Cómo repartirse las pistas</summary><p>A solas puedes abrir ambas carpetas. En pareja, elegíos en vuestros perfiles y pulsad «En pareja» en el caso. Cada uno recibe una carpeta.</p><a class="vd-textlink" href="/#perfil">Ver mi compañero de juego</a></details></div><ol><li><strong>Papel 1</strong>${esc(item.roleA)}</li><li><strong>Papel 2</strong>${esc(item.roleB)}</li></ol></section>
      ${unlocked?'':window.Colecciones?.proximoBloque?.(item.id)||''}
      ${window.Colecciones?.reliquiaDeJuego?.(item.id,opts.seasonAccess)||''}${nearbyFiles(item)}${demo}</article>`;
  }
  window.ValdemarCatalog=Object.freeze({items:Object.freeze(items),get,path,access,home,list,detail,mansionCover});
})();
