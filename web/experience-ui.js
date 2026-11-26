(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const places=['Correos','El teatro','El archivo','El faro','La emisora','El invernadero','La galería','El restaurante','La estación','El barrio invisible','La fonoteca','La casa de las doce mesas'];
const icons=[
 'M3 5h18v14H3z M3 5l9 8 9-8',
 'M3 4h18v16H3z M8 4v16m8-16v16 M8 15l4-3 4 3',
 'M4 3h16v18H4z M8 7h8M8 11h8M8 15h5',
 'M8 21l2-12h4l2 12M8 9h8V5H8zM12 2v3M3 6h3m12 0h3M6 21h12',
 'M5 10h14v11H5zM8 15h3m4 0h1M10 10V6l6-4M8 18h3',
 'M3 11l9-9 9 9v10H3zM12 3v18M3 12h18M7 7v14m10-14v14',
 'M3 4h18v16H3zM6 17l5-6 4 4 3-3 3 5M16 8h.01',
 'M4 4v6q0 3 3 3V4M10 4v6q0 3-3 3v8M18 4v17M18 4q-5 4-2 8h2',
 'M7 3h10q3 0 3 3v10q0 3-3 3H7q-3 0-3-3V6q0-3 3-3zM4 12h16M8 7h8M8 16h.01m8 0h.01M7 19l-2 3m12-3 2 3',
 'M2 6l6-3 8 3 6-3v15l-6 3-8-3-6 3zM8 3v15m8-12v15',
 'M9 18V5l11-2v13M9 8l11-2M9 18q-5-3-6 1t6-1M20 16q-5-3-6 1t6-1',
 'M3 10l9-8 9 8M5 8v13h14V8M10 21v-8h4v8'
];
const icon=i=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[i%12]}"></path></svg>`;
const season=m=>(m.stories||[]).filter(s=>s.season===1).sort((a,b)=>a.episode-b.episode);
const stop=(m,id)=>m.journey?.stops?.find(s=>s.caseId===id);
const count=m=>m.journey?.completed||0;
const session=(m,id)=>(m.sessions||[]).find(s=>s.id===id&&s.members.some(p=>p.userId===m.userId));
const detailsButton=(s,label='Ver experiencia',cls='button')=>`<button class="${cls}" data-action="case-details" data-case="${esc(s.id)}">${label}<span aria-hidden="true"> ↗</span></button>`;
function callToPlay(s,m){
 const p=stop(m,s.id),saved=p&&session(m,p.sessionId);
 if(p?.completed&&saved)return `<button class="button primary" data-action="archive-open" data-id="${esc(saved.id)}">Ver mi desenlace</button>`;
 if(!m.canPlay)return '<a class="button primary" href="#planes">Ver suscripción · 29,95 €/mes</a>';
 if(root.MonthlyAccess&&!root.MonthlyAccess.allowed(s,m))return root.MonthlyAccess.label(s,m)+'<a class="button" href="#planes">Ver mi suscripción</a>';
 return saved?`<button class="button primary" data-action="resume" data-id="${esc(saved.id)}">Continuar · ${p.decisions}/${p.totalDecisions} decisiones</button>`:`<button class="button primary" data-action="setup" data-case="${esc(s.id)}">Empezar esta experiencia</button>`;
}
function seasonMeter(m){return `<div class="season-meter"><span><b>${count(m)}</b> de 12 piezas recuperadas</span><span>${Math.round(count(m)/12*100)}%</span><progress max="12" value="${count(m)}" aria-label="Experiencias completadas">${count(m)} de 12</progress></div>`;}
function invitationPath(s){return '/caso/'+encodeURIComponent(s.id)+'/';}

function shareBox(s,path){if(!s)return '';const url='https://www.laultimapieza.es'+(path||invitationPath(s))+'?via=invitacion';const message='¿Resolvemos «'+s.title+'» juntos? '+url;return `<details class="case-share"><summary>¿Con quién lo resolverías?</summary><div><a href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Proponerlo por WhatsApp ↗</a><button type="button" data-copy-invite="${esc(url)}">Copiar enlace</button></div><p role="status" aria-live="polite"></p></details>`;}

function invitation(s,m){if(!s)return home(m);const i=s.episode-1;const month=s.season===1?Math.ceil(s.episode/4):0;const hook=s.season===1&&openingQuestions[i];return `<article class="invite-page"><div class="invite-content"><a class="text-link" href="${month?'#archivo-clasico?mes='+month:'#archivo-clasico'}">${month?'Ver el mes '+month+' del archivo clásico':'Ver el archivo clásico'}</a><p class="ui-kicker">${month?'ARCHIVO CLÁSICO · MES '+month:'CASO ADICIONAL'} · ${s.id==='cartas-medianoche'?'≈60':month?'30–45':'15–25'} MIN · 1–2 PERSONAS</p><h1>${esc(s.title)}</h1>${hook?`<p class="invite-question">${esc(hook)}</p>`:''}<p class="invite-description">${esc(s.description)}</p>${m.canPlay?callToPlay(s,m):`<button class="button primary" data-action="preview-open">Jugar a Clínica Vallejo gratis</button><p class="action-note">Abre la caja 87-V de la Clínica Vallejo. Sin cuenta ni tarjeta.</p><a class="text-link" href="#planes">Ver la temporada · 29,95 €/mes</a>`}${shareBox(s)}${m.referred?`<details class="invite-privacy"><summary>Privacidad de esta visita</summary><label><input type="checkbox" data-invite-counts ${root.InvitationCounts?.enabled?'checked':''}> Permitir contadores anónimos de la visita, el inicio de la demo y la solicitud de aviso. Opcional.</label></details>`:''}</div><figure class="invite-poster"><img src="${sceneImage(s)||invitationPath(s)+'portada.png'}" width="1200" height="630" alt="" fetchpriority="high"></figure></article>`;}
const sceneCovers = new Set(["cartas-medianoche","ultima-funcion","archivo-ausencias","marea-quieta","habitacion-309","frecuencia-17","jardin-invierno","retrato-prestado","mesa-13","tren-detenido","ciudad-invisible","ultimo-coro","ultima-invitacion"]);
function sceneImage(s){return s && sceneCovers.has(s.id) ? '/' + s.id + '.jpg' : '';}

function coverStory(m) {
 const materials = [
   ['image','Imagen','Ficha de admisión'],
   ['audio','Audio','Timbre del depósito'],
   ['text','Texto','Correo del Archivo'],
   ['web','Archivo web','Registro de digitalización']
 ];
 return `<section class="vh-hero v87-cover" aria-labelledby="vh-title">
   <div class="vh-copy">
     <p class="vh-kicker">Demo gratuita · Clínica Vallejo</p>
     <h1 id="vh-title">¿Qué ocurrió en la <em>Sala 7?</em></h1>
     <p class="vh-lead">En 1987 desapareció el doctor Vallejo. Sus seis pacientes sobrevivieron, pero ninguno recuerda aquella noche. Esta madrugada, el Archivo te ha enviado la primera ficha de la caja 87-V.</p>
     <div class="vh-actions">
       <button type="button" class="button primary" data-action="preview-open">Jugar la demo gratis</button>
       ${m.canPlay?'<a class="vh-secondary" href="#casos">Ir a mis casos</a>':'<button type="button" class="vh-secondary" data-action="page-section" data-target="shelf-title">Ver los casos del primer mes</button>'}
     </div>
     <p class="vh-meta">A solas o en pareja · Sin cuenta ni tarjeta</p>
   </div>
   <figure class="v87-cover-art">
     <img src="/vallejo-mesa-87v.webp" width="1536" height="1024" alt="Una casete, un plano y la fotografía de un pasillo en la mesa del archivo." fetchpriority="high">
     <figcaption><span>Del correo de apertura</span><q>Le recomendamos no trabajar de noche.</q></figcaption>
   </figure>
   <div class="v87-evidence-launch" role="group" aria-label="Abrir una pista de la demo">
     ${materials.map(([key,type,label])=>`<button type="button" class="v87-format" data-action="preview-open" data-vp-format="${key}"><span class="v87-mini v87-mini-${key}" aria-hidden="true"></span><span class="v87-format-name"><small>${type}</small><strong>${label}</strong></span><span class="v87-open" aria-hidden="true">↗</span></button>`).join('')}
   </div>
 </section>`;
}

function homeSeasonOffer(m) {
 if(m.canPlay)return `<section class="season-strip vh-member-map"><div><h2>Tu colección de Valdemar</h2><p>Explora las mesas de pistas y consigue llaves con los retos de cada historia.</p></div><a class="shelf-link" href="#casos">Abrir la temporada</a></section>`;
 const open=root.ClubAccess?.checkoutAvailable===true;
 const label=open?'Ver la suscripción':m.membership?.waitlist?'Ver mi aviso de apertura':'Avísame cuando abra';
 return `<section class="vh-offer" aria-labelledby="vh-offer-title">
   <div><p class="cover-caption">La suscripción · Temporada 01</p><h2 id="vh-offer-title">Doce historias en Valdemar.</h2>
   <p>Cuatro historias cada mes para investigar a solas o compartir pantalla. Recibes una llave al contratar y puedes ganar más con los retos paralelos.</p></div>
   <div class="vh-terms"><p class="vh-price"><strong>29,95 €</strong><span>/mes</span></p><p class="vh-offer-note">${open?'IVA incluido':'Precio previsto · Próxima apertura'}</p><a href="#planes" class="button primary">${label}</a></div>
 </section>`;
}

function home(m){
 const cases=season(m);
 const latest=(m.sessions||[]).find(s=>s.status!=='finished'&&s.members.some(p=>p.userId===m.userId));
 const resumed=latest&&(m.stories||[]).find(s=>s.id===latest.caseId);
 const returning=m.userId?`<section class="return-strip"><div><span class="ui-kicker">Tu investigación</span><h2>${resumed?esc(resumed.title):'Tu plano del archivo clásico'}</h2><p>${resumed?latest.history.length+' decisiones completadas':count(m)+' de 12 piezas recuperadas'}</p></div>${resumed&&m.canPlay?`<button class="button primary" data-action="resume" data-id="${esc(latest.id)}">Continuar mi partida</button>`:'<a class="button" href="#mapa-clasico">Abrir el plano clásico</a>'}</section>`:'';
 return `${returning}${coverStory(m)}
 <div class="cover-tail vh-tail">${shareBox({title:'Clínica Vallejo'},'/vallejo.html')}</div>
 ${root.ValdemarCatalog ? root.ValdemarCatalog.home({canPlay:m.canPlay,admin:m.membership?.role==='admin'}) : ''}
 ${homeSeasonOffer(m)}`;
}
const openingQuestions = ["¿Dónde se esconde la última carta de Valdemar?","¿Cómo desapareció el faro durante el ensayo?","¿Por qué el catálogo borra un recuerdo de Teresa?","¿Qué ocurrió en el faro de Marea quieta?"];
function card(s,m){
 const progress=stop(m,s.id),i=s.episode-1,photo=sceneImage(s),duration=s.id==='cartas-medianoche'?'≈60':'30–45';
 const state=progress?.completed?'Pieza recuperada':progress?.status==='in_progress'?'En curso · '+progress.decisions+'/5':null;
 const visual=photo?`<img src="${photo}" alt="" loading="lazy" decoding="async">`:`<div class="shelf-symbol" aria-hidden="true">${icon(i)}</div>`;
 const title=esc(s.title), label=state?'Ver mi progreso':'Ver el caso';
 const link=m.userId?`<button type="button" class="shelf-open" data-action="case-details" data-case="${esc(s.id)}" aria-label="${label}: ${title}">${label}</button>`:`<a class="shelf-open" href="${invitationPath(s)}" aria-label="Ver ${title}">Ver el caso</a>`;
 return `<article class="shelf-card tint-${i%4}"><div class="shelf-visual">${visual}<span>${esc(places[i]||'')}</span></div><div class="shelf-body"><h3>${title}</h3><p>${esc(openingQuestions[i]||s.description)}</p><div class="shelf-foot"><small>${duration} min · 1–2 personas</small>${link}</div>${state?`<small class="shelf-state">${esc(state)}</small>`:''}${m.userId&&!state?root.MonthlyAccess?.label(s,m)||'':''}</div></article>`;
}

function catalog(m){
 const cases=season(m),month=[1,2,3].includes(m.catalogMonth)?m.catalogMonth:1;
 const bonus=(m.stories||[]).find(s=>s.id==='habitacion-309');
 return `<section class="season-catalog"><header><p class="cover-caption">Archivo clásico · Doce noches</p><h1>Las primeras historias de Valdemar.</h1><p>Cada mes se abren cuatro misterios. Elige en qué orden investigarlos.</p><a class="text-link" href="/#mapa-clasico">Ver el plano de las doce piezas</a></header><section class="season-strip vh-catalog" aria-labelledby="catalog-demo"><div><p class="cover-caption">Caso de prueba gratuito</p><h2 id="catalog-demo">Clínica Vallejo</h2><p>Abre la caja 87-V e investiga la desaparición del doctor Vallejo.</p></div><button type="button" class="button primary" data-action="preview-open">Jugar la demo</button></section><nav class="month-nav" aria-label="Casos por mes">${[1,2,3].map(n=>`<a href="#archivo-clasico?mes=${n}" ${n===month?'aria-current="page"':''}>Mes ${n}</a>`).join('')}</nav><div class="shelf-grid" aria-label="Cuatro casos del mes ${month}">${cases.slice((month-1)*4,month*4).map(s=>card(s,m)).join('')}</div>${bonus?`<div class="season-strip bonus-line"><div><p class="cover-caption">Caso adicional · 15–25 min</p><h2>${esc(bonus.title)}</h2><p>Una joya desaparece la última noche del Bellamar.</p></div>${m.userId?detailsButton(bonus,'Ver el caso','shelf-link'):`<a class="shelf-link" href="${invitationPath(bonus)}">Ver el caso adicional</a>`}</div>`:''}</section>`;
}

function classicStation(s,m){
 const p=stop(m,s.id),n=String(s.episode).padStart(2,'0'),photo=sceneImage(s);
 const active=p?.status==='in_progress',pending=p?.status==='needs_solution',complete=p?.completed;
 const lock=root.MonthlyAccess?.label(s,m)||'';
 const state=complete?'Pieza recuperada':pending?'Enigma pendiente':active?'En curso':'Por explorar';
 const progress=complete?'Letra '+esc(p.letter):pending?'Resolver el enigma':active?p.decisions+' de '+(p.totalDecisions||s.decisionCount||5)+' decisiones':'Abrir el expediente';
 return '<button type="button" class="map-station '+(complete?'completed':active||pending?'in-progress':'')+'" data-action="case-details" data-case="'+esc(s.id)+'">'+
  (photo?'<img class="classic-station-photo" src="'+photo+'" alt="" width="506" height="335" loading="lazy" decoding="async">':'')+
  '<span class="station-top"><b>'+n+'</b><span>'+state+'</span></span>'+
  '<span class="station-place">'+esc(places[s.episode-1])+'</span><strong>'+esc(s.title)+'</strong>'+lock+
  '<span class="station-bottom">'+progress+' <span aria-hidden="true">↗</span></span></button>';
}
function classicPlate(stories,m){
 return stories.map(s=>{
  const n=Number(s.episode),letter=stop(m,s.id)?.letter,label=String(n).padStart(2,'0');
  return '<li class="cipher-cell'+(letter?' revealed':'')+'" style="--plate-x:'+((n-1)%4)*100/3+'%;--plate-y:'+Math.floor((n-1)/4)*50+'%" aria-label="Pieza '+label+' de '+esc(s.title)+(letter?', letra '+esc(letter):', pendiente')+'">'+
   '<small aria-hidden="true">'+label+'</small>'+(letter?'<b aria-hidden="true">'+esc(letter)+'</b>':'')+'</li>';
 }).join('');
}
function map(m){
 const stories=season(m),done=count(m),canSolve=done===12,next=stories.find(s=>s.id===m.journey?.nextCaseId);
 const remaining=12-done,guidance=canSolve?'Ya puedes introducir las doce letras. Se admiten espacios.':remaining===1?'Queda una pieza para abrir la cerradura.':'La cerradura se abre cuando reúnas las doce piezas.';
 return `<div class="classic-sheet"><section class="map-heading" aria-labelledby="classic-map-title">
  <img class="classic-cover" src="/archivo-ausencias.jpg" alt="" width="506" height="335" fetchpriority="high">
  <div class="classic-cover-copy"><a class="classic-back" href="#mapa"><span aria-hidden="true">←</span> Volver a Valdemar</a><p class="ui-kicker">Archivo clásico</p><h1 id="classic-map-title">El plano de<br><em>las doce noches.</em></h1>
  <p class="classic-lead">En doce lugares del archivo se esconde una misma marca. Termina cada historia y resuelve su enigma para recuperar una de las letras del sello.</p>
  <div class="intro-actions"><button type="button" class="button primary" data-action="page-section" data-target="city-map">Explorar los lugares <span aria-hidden="true">↓</span></button><button type="button" class="text-link" data-action="page-section" data-target="cipher-title">Ver mi sello <span aria-hidden="true">↓</span></button></div></div>
  <div class="map-summary">${seasonMeter(m)}<p>${m.userId?'Tu colección se guarda en tu cuenta.':'Inicia sesión para guardar las letras que recuperes.'}</p>${!m.userId?'<button class="button" data-action="auth-login">Iniciar sesión</button>':next?detailsButton(next,'Mi siguiente experiencia','button'):canSolve?'<span class="collection-complete">Colección completa</span>':''}</div></section>
  <section class="city-map" id="city-map" tabindex="-1" aria-labelledby="classic-city-title"><div class="classic-index-head"><div><p class="ui-kicker">Los escenarios</p><h2 id="classic-city-title">Doce lugares del archivo</h2></div><div class="map-legend" aria-label="Leyenda"><span><i class="legend-dot"></i> Por explorar</span><span><i class="legend-dot underway"></i> En curso</span><span><i class="legend-dot complete"></i> Completada</span></div></div><div class="city-stations">${stories.map(s=>classicStation(s,m)).join('')}</div></section>
  <section class="cipher-section" aria-labelledby="cipher-title"><div class="classic-cipher-copy"><span class="ui-kicker">La cerradura del archivo</span><h2 id="cipher-title" tabindex="-1">El sello de<br><em>las doce piezas.</em></h2>
  <p class="classic-cipher-lead">Cada caso resuelto devuelve una letra a la placa. Cuando las doce estén en su sitio, podrás abrir el epílogo.</p></div>
  <div class="cipher-box"><div class="classic-plate-head"><span>Tu sello</span><strong>${done} de 12 piezas</strong></div><ol class="cipher-grid" aria-label="Sello de tres filas y cuatro columnas">${classicPlate(stories,m)}</ol>
  ${m.journey?.solvedAt?'<div class="cipher-success" role="status">✓ Clave resuelta. Tu epílogo está abierto.</div>':`<form id="season-key-form"><label class="field" for="season-key">Clave del epílogo<input id="season-key" name="key" autocomplete="off" spellcheck="false" maxlength="40" placeholder="Escribe las 12 letras" required ${canSolve?'':'disabled'} aria-describedby="season-key-help"></label><p id="season-key-help">${guidance}</p><button class="button primary wide" type="submit" ${canSolve?'':'disabled'}>Abrir el epílogo secreto <span aria-hidden="true">→</span></button><p id="season-key-error" class="auth-error" role="alert"></p></form>`}</div><div class="classic-cipher-copy classic-cipher-notes"><div class="classic-seal-instructions">
  <p>Las piezas se colocan por número, de izquierda a derecha. Para descifrar la clave, lee <strong>cada columna de arriba abajo</strong>, empezando por la izquierda.</p><p class="cipher-rule">Orden de lectura: 01 → 05 → 09 · 02 → 06 → 10 · 03 → 07 → 11 · 04 → 08 → 12.</p></div>
  <p class="classic-seal-fine">Cada historia del archivo aporta una pieza. La escena gratuita y La habitación 309 quedan fuera de la colección.</p>
  ${!canSolve?'<button type="button" class="classic-next" data-action="page-section" data-target="city-map">'+(done?'Volver a los casos del archivo':'Elegir mi primer caso')+' <span aria-hidden="true">↗</span></button>':''}</div></section>
 ${m.journey?.solvedAt?`<section class="secret-epilogue" aria-labelledby="epilogue-title"><span class="ui-kicker">EPÍLOGO SECRETO · COLECCIÓN COMPLETA</span><h2 id="epilogue-title">Al otro lado del umbral.</h2><p>La cerradura cede sin ruido. Dentro no hay una decimotercera prueba, sino una mesa con doce huecos. Dejáis una carta, una entrada, una ficha, un cuaderno… y, por primera vez, veis el conjunto.</p><p>Cada lugar os pidió algo distinto: escuchar antes de decidir, comprobar antes de acusar, preguntar antes de contar una historia ajena. Las piezas nunca estuvieron perdidas. Esperaban a alguien capaz de mirar dos veces.</p><p>En el reverso del plano hay una última frase: <strong>«La pieza que faltaba era vuestra manera de mirar».</strong></p><span class="epilogue-seal">12 EXPERIENCIAS · UNA MIRADA NUEVA</span><a class="button" href="#archivo">Volver a mis desenlaces →</a></section>`:''}</div>`;}
function detail(s,m){const p=stop(m,s.id);return `<div class="case-detail"><span class="ui-kicker">${s.season===1?'EXPERIENCIA '+String(s.episode).padStart(2,'0')+' / TEMPORADA 01':'EXPERIENCIA ADICIONAL'}</span>${sceneImage(s)?`<img class="case-detail-photo" src="${sceneImage(s)}" alt="" width="506" height="335">`:''}<h2 id="modal-title">${esc(s.title)}</h2><p>${esc(s.description)}</p><div class="detail-facts"><span><b>${s.id==='cartas-medianoche'?'≈60':s.season===1?'30–45':'15–25'} min</b>duración orientativa</span><span><b>1–2 personas</b>solo o con un cómplice</span><span><b>${s.decisionCount||4} decisiones</b>4 finales posibles</span></div><h3>Así avanzarás</h3><p>Lee la escena, consulta las pistas disponibles y elige un camino. La ruta te indica en todo momento cuántas decisiones te faltan.</p>${s.season===1?`<div class="detail-reward">${icon(s.episode-1)}<p>${p?.completed?'Pieza '+String(s.episode).padStart(2,'0')+' recuperada: <strong>'+esc(p.letter)+'</strong>.':'Al completar este caso revelarás la <strong>pieza '+String(s.episode).padStart(2,'0')+'</strong> del plano secreto.'}</p></div>`:''}${shareBox(s)}<div class="actions">${callToPlay(s,m)}<button class="text-link" data-action="open-map">Ver el plano completo →</button></div>${!m.canPlay&&!p?.completed? `<p class="detail-payment">${root.ClubAccess?.checkoutAvailable ? 'Los casos completos se abren con una suscripción activa.' : 'La suscripción abrirá próximamente. Puedes pedir un aviso en la página de suscripción.'}</p>`:''}</div>`;}
function roadmap(s,c,selected=s.history?.length||0){
 const total=c.decisionCount||4,done=Math.min(s.history?.length||0,total),finished=s.status==='finished',remaining=Math.max(0,total-done),labels=total===5?['Entrar','Investigar','Contrastar','Valorar','Decidir']:Array.from({length:total},(_,i)=>'Decisión '+(i+1));
 return `<section class="case-roadmap" aria-label="Avance de la experiencia"><div class="roadmap-summary"><div><span class="ui-kicker">TU RUTA EN ESTE CASO</span><strong>${finished?'Experiencia completada':s.status==='waiting'?'Esperando a tu cómplice':'Estás en la decisión '+Math.min(done+1,total)+' de '+total}</strong></div><span class="roadmap-counter">${done}<small> / ${total}</small></span></div><progress max="${total}" value="${done}" aria-label="Decisiones completadas">${done} de ${total}</progress><ol class="roadmap-stops">${labels.map((label,i)=>`<li class="${i<done?'done':i===done&&!finished?'current':''}" ${i===done&&!finished?'aria-current="step"':''}><button data-action="scene-view" data-index="${i}" ${i>done?'disabled':''} ${i===selected?'aria-current="step"':''}><b>${i<done?'✓':i+1}</b><span>${label}</span></button></li>`).join('')}<li class="${finished?'done':''}"><button data-action="scene-view" data-index="${done}" ${finished?'':'disabled'}><b>${finished?'✓':'◇'}</b><span>Tu final</span></button></li></ol><p>${finished?'Tu desenlace y tu progreso están guardados.':remaining+' '+(remaining===1?'decisión pendiente':'decisiones pendientes')+' para descubrir tu final.'} ${!finished&&s.mode==='duo'?'Un voto pendiente no hace avanzar la ruta.':''}</p></section>`;
}
function reward(s,m){if(s.status!=='finished')return '';const p=stop(m,s.caseId);if(!p?.letter)return '';return `<section class="piece-award"><span class="award-letter">${esc(p.letter)}</span><div><span class="ui-kicker">PIEZA ${String(p.episode).padStart(2,'0')} RECUPERADA</span><h2>Tu plano acaba de cambiar.</h2><p>${count(m)} de 12 experiencias completadas. Esta letra ya está guardada en tu colección.</p><a class="button primary" href="#mapa-clasico">Colocar mi pieza en el plano →</a></div></section>`;}
root.ExperienceUI={home,catalog,map,detail,roadmap,reward,invitation,artworkPath:s=>icons[(s.episode||1)-1]||icons[0]};
})(typeof window!=='undefined'?window:globalThis);
