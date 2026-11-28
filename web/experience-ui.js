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
function callToPlay(s,m){
 const p=stop(m,s.id),saved=p&&session(m,p.sessionId);
 if(p?.completed&&saved)return `<button class="button primary" data-action="archive-open" data-id="${esc(saved.id)}">Ver mi desenlace</button>`;
 if(!m.canPlay)return '<a class="button primary" href="#planes">Ver suscripción</a>';
 if(root.MonthlyAccess&&!root.MonthlyAccess.allowed(s,m))return root.MonthlyAccess.label(s,m)+'<a class="button" href="#planes">Ver mi suscripción</a>';
 if(saved&&p.status==='needs_solution')return `<button class="button primary" data-action="resume" data-id="${esc(saved.id)}">Resolver el enigma pendiente</button>`;
 return saved?`<button class="button primary" data-action="resume" data-id="${esc(saved.id)}">Continuar · ${p.decisions}/${p.totalDecisions} decisiones</button>`:`<a class="button primary" href="/#casos">Elegir un juego</a>`;
}
function seasonMeter(m){return `<div class="season-meter"><span><b>${count(m)}</b> de 12 piezas recuperadas</span><span>${Math.round(count(m)/12*100)}%</span><progress max="12" value="${count(m)}" aria-label="Experiencias completadas">${count(m)} de 12</progress></div>`;}
const sceneCovers = new Set(["cartas-medianoche","ultima-funcion","archivo-ausencias","marea-quieta","habitacion-309","frecuencia-17","jardin-invierno","retrato-prestado","mesa-13","tren-detenido","ciudad-invisible","ultimo-coro","ultima-invitacion"]);
function sceneImage(s){return s && sceneCovers.has(s.id) ? '/' + s.id + '.jpg' : '';}

function clubCover(m) {
 const offer=m.canPlay?{href:'/#casos',label:'Elegir un juego'}:root.ClubAccess?.offerAction||{href:'/#planes',label:'Ver la suscripción'};
 const price=root.ClubAccess?.price;
 const tag=m.userId?'h2':'h1';
 return `<section class="front-club" aria-labelledby="front-club-title"><div class="front-club-copy">
   <p class="front-club-kicker">Suscripción de misterio</p><${tag} id="front-club-title">Cuatro juegos de misterio al mes</${tag}>
   <p>¿Qué detalle de una foto contradice el testimonio? Compara las pruebas y decide el desenlace. A solas reúnes las dos carpetas. En pareja, cada uno recibe pistas que el otro necesita.</p>
   <div class="front-club-offer"><a class="front-join" href="${esc(offer.href)}">${esc(offer.label)}</a>${m.canPlay||!price?'':'<span><strong>'+esc(price)+'</strong> por persona al mes · IVA incluido</span>'}</div><a class="front-guide" href="/#como-se-juega">Cómo se juega</a></div>
   <a class="front-demo" href="/cinta-87.html" data-action="preview-open" data-home-demo>
    <span class="front-demo-photo"><img src="/cinta87-mesa.webp" width="1536" height="1024" fetchpriority="high" alt=""></span>
    <span class="front-demo-copy"><small>Demo sin cuenta · 10–15 min</small><strong>La cinta 87</strong>
    <span class="front-demo-hook">Sigue el rastro de la última emisión de Radio Valdemar.</span>
    <span class="front-demo-label" data-home-demo-label>${demoAction()}</span></span></a></section>`;
}

function demoAction(){
 if(root.CasePreview?.isComplete?.())return 'Revisar mi desenlace';
 return root.CasePreview?.hasProgress?.()?'Continuar la demo':'Jugar la demo gratis';
}
root.addEventListener?.('case-preview-progress',()=>{
 const button=root.document?.querySelector('[data-home-demo-label]');
 if(button)button.textContent=demoAction();
});


function activityTime(value){
 const stamp=typeof value==='number'?value:Date.parse(value);
 return Number.isFinite(stamp)?stamp:0;
}
function classicActivity(game){
 return activityTime(game?.updatedAt)||activityTime(game?.history?.at(-1)?.createdAt)||activityTime(game?.createdAt);
}
function classicReturn(m){
 if(!m.canPlay)return null;
 let recent=null;
 for(const game of m.sessions||[]){
   if(game.caseId==='habitacion-309'||game.status==='finished'||(game.ownerId!==m.userId&&!game.members?.some(p=>p.userId===m.userId)))continue;
   const story=m.stories?.find(s=>s.id===game.caseId);
   if(!story)continue;
   if(root.MonthlyAccess&&!root.MonthlyAccess.allowed(story,m))continue;
   const time=classicActivity(game);
   if(recent&&recent.time>=time)continue;
   const moves=game.history?.length||0;
   recent={time,title:story.title,image:sceneImage(story),sessionId:game.id,
     detail:(game.mode==='duo'?'En pareja':'En solitario')+' · '+moves+(moves===1?' decisión completada':' decisiones completadas')};
 }
 return recent;
}
function officialCase(id){
 const first=id<=12;
 const story=first?root.ValdemarCatalog?.get(id):root.Mundos?.story(id);
 if(!story)return null;
 return {title:story.title,seasonNumber:Math.ceil(id/12),image:first?story.image:'/mundo-'+id+'.webp',
   href:'#'+(first?'valdemar-jugar':'mundos-jugar')+'?id='+id};
}
function seasonReturn(games){
 const eligible=games.filter(g=>g.available&&!g.finished&&Number.isInteger(g.id)&&g.id>=1&&g.id<=48)
   .sort((a,b)=>activityTime(b.updatedAt)-activityTime(a.updatedAt)||b.current-a.current||a.id-b.id);
 for(const game of eligible){
   const card=officialCase(game.id);
   if(!card)continue;
   if(game.title)card.title=game.title;
   if(game.edition==='legacy')card.image='/valdemar-art-01.webp';
   const stage=game.current>=game.total?'Desenlace pendiente':'Etapa '+(game.current+1)+' de '+game.total;
   const season=root.Colecciones?.seasons[card.seasonNumber-1]?.name;
   const detail=[season,stage,game.edition==='mansion'?game.checkpoint?.title:'',
     game.mode==='duo'?'En pareja':game.mode==='solo'?'En solitario':''].filter(Boolean).join(' · ');
   return {...card,time:activityTime(game.updatedAt),detail,href:card.href+'&retomar=1'};
 }
 return null;
}
function returnCard(game){
 if(!game)return '<section class="return-strip"><div><h2>Tus tableros de temporada</h2><p>Cada juego que terminas recupera una pieza de su sello.</p></div><a class="button" href="#tableros">Ver mis temporadas</a></section>';
 const label=(game.fresh?'Jugar a ':'Continuar ')+game.title;
 const action=game.href?`<a class="button primary" href="${esc(game.href)}" aria-label="${esc(label)}">${game.fresh?'Abrir el caso':'Continuar mi partida'}</a>`:
   `<button class="button primary" data-action="resume" data-id="${esc(game.sessionId)}" aria-label="${esc(label)}">Continuar mi partida</button>`;
 return `<section class="return-strip vh-resume-card">${game.image?`<img src="${esc(game.image)}" alt="" width="160" height="100" decoding="async">`:''}<div><span class="ui-kicker">${game.fresh?'Tu próximo caso':'Tu partida en curso'}</span><h2>${esc(game.title)}</h2><p>${esc(game.detail)}</p></div>${action}</section>`;
}
function seasonOnHome(games,preferred){
 const access=root.ClubAccess?.state?.seasonAccess;
 if(!Array.isArray(access?.seasons)||!root.Colecciones?.seasons)return null;
 const finished=new Set(games.filter(g=>g.finished).map(g=>g.id));
 const passes=access.seasons.filter(pass=>Number.isInteger(pass.number)&&root.Colecciones.seasons[pass.number-1]);
 const played=new Set(games.map(g=>Math.ceil(g.id/12)));
 const pass=passes.find(p=>p.number===preferred)
   ||passes.filter(p=>p.paidBlocks?.length).at(-1)
   ||passes.filter(p=>played.has(p.number)).at(-1)
   ||passes.find(p=>p.number===1);
 if(!pass)return null;
 const start=(pass.number-1)*12,metadata=root.Colecciones.seasons[pass.number-1];
 const earned=Array.from({length:12},(_,i)=>i+1).filter(i=>finished.has(start+i));
 const allowed=pass.availableCases??access.availableCases??[];
 const nextId=allowed.find(id=>id>start&&id<=start+12&&!finished.has(id));
 const first=nextId?officialCase(nextId):null;
 const next=first?{...first,fresh:true,detail:metadata.name+' · Unos 60 minutos'}:null;
 return {n:pass.number,metadata,earned,next};
}
function sealKeepsake({n,metadata,earned}){
 const complete=earned.length===12;
 const count=earned.length+' de 12 piezas recuperadas';
 const link=complete?'Ver el sello y su epílogo':'Ver mi sello';
 return `<section class="vh-keepsake" data-home-seal="${n}" data-complete="${complete}" aria-label="Tu sello de temporada">
   <div class="ss-art vh-seal-art" aria-hidden="true">${root.SellosTemporada?.miniature?.(n,earned)||''}</div>
   <div><span class="vh-seal-count">${count}</span><h2>${esc(metadata.seal)}</h2>
     <a href="#${esc(metadata.board)}?seccion=sello" aria-label="${esc(link+' · '+metadata.seal)}">${link}</a></div></section>`;
}
if(root.customElements&&!root.customElements.get('home-resume')){
 root.customElements.define('home-resume',class extends HTMLElement{
   async connectedCallback(){
     const bridge=root.GameAccountBridge;
     if(!bridge?.isSignedIn())return;
     const load=this.loadToken=Symbol();
     const current=()=>this.isConnected&&this.loadToken===load&&bridge.isSignedIn();
     try{
       const {games}=await bridge.request('/api/valdemar/partidas');
       if(!current())return;
       const latest=seasonReturn(games),card=this.querySelector('.return-strip');
       const resume=latest&&latest.time>=Number(this.dataset.classicTime)?latest:null;
       const collection=seasonOnHome(games,resume?.seasonNumber);
       const primary=resume||(!card?.querySelector('[data-action="resume"]')&&collection?.next);
       if(primary&&card){
         const focused=card.contains(document.activeElement);
         card.outerHTML=returnCard(primary);
         if(focused)this.querySelector('.button')?.focus({preventScroll:true});
       }
       if(collection){
         this.querySelector('.vh-keepsake')?.remove();
         this.insertAdjacentHTML('beforeend',sealKeepsake(collection));
         this.classList.add('vh-home-collection');
       }
     }catch{
       if(!current()||this.querySelector('[data-action="resume"]'))return;
       const status=this.querySelector('p'), link=this.querySelector('a');
       if(status)status.textContent='Puedes consultar tus partidas guardadas en el archivo.';
       if(link){link.href='#archivo';link.textContent='Ver mis partidas';}
     }
   }
   disconnectedCallback(){this.loadToken=null;}
 });
}
function home(m){
 const latest=m.userId?classicReturn(m):null;
 const returning=m.userId&&m.canPlay?`<home-resume data-classic-time="${latest?.time||0}">${returnCard(latest)}</home-resume>`:'';
 const map=root.Colecciones.illustratedMap({primary:Boolean(m.userId),home:true,letter:!m.canPlay});
 return m.userId?map+returning+clubCover(m):clubCover(m)+map;
}
function classicPlate(stories,m){
 return stories.map(s=>{
  const n=Number(s.episode),letter=stop(m,s.id)?.letter,label=String(n).padStart(2,'0');
  return '<li class="cipher-cell'+(letter?' revealed':'')+'" style="--plate-x:'+((n-1)%4)*100/3+'%;--plate-y:'+Math.floor((n-1)/4)*50+'%" aria-label="Pieza '+label+' de '+esc(s.title)+(letter?', letra '+esc(letter):', pendiente')+'">'+
   '<small aria-hidden="true">'+label+'</small>'+(letter?'<b aria-hidden="true">'+esc(letter)+'</b>':'')+'</li>';
 }).join('');
}
function map(m){
 const stories=season(m),done=count(m),canSolve=done===12;
 const remaining=12-done,guidance=canSolve?'Ya puedes introducir las doce letras. Se admiten espacios.':remaining===1?'Queda una pieza para abrir la cerradura.':'La cerradura se abre cuando reúnas las doce piezas.';
 return `<div class="classic-sheet"><section class="map-heading" aria-labelledby="classic-map-title">
  <img class="classic-cover" src="/archivo-ausencias.jpg" alt="" width="506" height="335" fetchpriority="high">
  <div class="classic-cover-copy"><a class="classic-back" href="/#archivo">Volver a Mis partidas</a><h1 id="classic-map-title">Mis piezas de Las doce noches</h1><p class="classic-lead">Cada enigma resuelto en tus partidas añade una letra al sello.</p></div>
  <div class="map-summary">${seasonMeter(m)}</div></section>
  <section class="cipher-section" aria-labelledby="cipher-title"><div class="classic-cipher-copy"><span class="ui-kicker">La cerradura del archivo</span><h2 id="cipher-title" tabindex="-1">El sello de<br><em>las doce piezas.</em></h2>
  </div>
  <div class="cipher-box"><div class="classic-plate-head"><span>Tu sello</span><strong>${done} de 12 piezas</strong></div><ol class="cipher-grid" aria-label="Sello de tres filas y cuatro columnas">${classicPlate(stories,m)}</ol>
  ${m.journey?.solvedAt?'<div class="cipher-success" role="status">✓ Clave resuelta. Tu epílogo está abierto.</div>':`<form id="season-key-form"><label class="field" for="season-key">Clave del epílogo<input id="season-key" name="key" autocomplete="off" spellcheck="false" maxlength="40" placeholder="Escribe las 12 letras" required ${canSolve?'':'disabled'} aria-describedby="season-key-help"></label><p id="season-key-help">${guidance}</p><button class="button primary wide" type="submit" ${canSolve?'':'disabled'}>Abrir el epílogo secreto <span aria-hidden="true">→</span></button><p id="season-key-error" class="auth-error" role="alert"></p></form>`}</div><div class="classic-cipher-copy classic-cipher-notes"><div class="classic-seal-instructions">
  <p>Las piezas se colocan por número, de izquierda a derecha. Para descifrar la clave, lee <strong>cada columna de arriba abajo</strong>, empezando por la izquierda.</p><p class="cipher-rule">Orden de lectura: 01 → 05 → 09 · 02 → 06 → 10 · 03 → 07 → 11 · 04 → 08 → 12.</p></div>
  
  </div></section>
 ${m.journey?.solvedAt?`<section class="secret-epilogue" aria-labelledby="epilogue-title"><span class="ui-kicker">EPÍLOGO SECRETO · COLECCIÓN COMPLETA</span><h2 id="epilogue-title">Al otro lado del umbral.</h2><p>La cerradura cede sin ruido. Dentro no hay una decimotercera prueba, sino una mesa con doce huecos. Dejáis una carta, una entrada, una ficha, un cuaderno… y, por primera vez, veis el conjunto.</p><p>Cada lugar os pidió algo distinto: escuchar antes de decidir, comprobar antes de acusar, preguntar antes de contar una historia ajena. Las piezas nunca estuvieron perdidas. Esperaban a alguien capaz de mirar dos veces.</p><p>En el reverso del plano hay una última frase: <strong>«La pieza que faltaba era vuestra manera de mirar».</strong></p><span class="epilogue-seal">12 EXPERIENCIAS · UNA MIRADA NUEVA</span><a class="button" href="#archivo">Volver a mis desenlaces →</a></section>`:''}</div>`;}
function detail(s,m){if(!s||s.id==='habitacion-309')return '<a class="button" href="/#casos">Ver los juegos</a>';const p=stop(m,s.id);return `<div class="case-detail"><span class="ui-kicker">${s.season===1?'EXPERIENCIA '+String(s.episode).padStart(2,'0')+' / TEMPORADA 01':'EXPERIENCIA ADICIONAL'}</span>${sceneImage(s)?`<img class="case-detail-photo" src="${sceneImage(s)}" alt="" width="506" height="335">`:''}<h2 id="modal-title">${esc(s.title)}</h2><p>${esc(s.description)}</p><div class="detail-facts"><span><b>${s.id==='cartas-medianoche'?'≈60':s.season===1?'30–45':'15–25'} min</b>duración orientativa</span><span><b>1–2 personas</b>solo o con un cómplice</span><span><b>${s.decisionCount||4} decisiones</b>4 finales posibles</span></div><h3>Así avanzarás</h3><p>Lee la escena, consulta las pistas disponibles y elige un camino. La ruta te indica en todo momento cuántas decisiones te faltan.</p>${s.season===1?`<div class="detail-reward">${icon(s.episode-1)}<p>${p?.completed?'Pieza '+String(s.episode).padStart(2,'0')+' recuperada: <strong>'+esc(p.letter)+'</strong>.':'Al completar este caso revelarás la <strong>pieza '+String(s.episode).padStart(2,'0')+'</strong> del plano secreto.'}</p></div>`:''}<div class="actions">${callToPlay(s,m)}<button class="text-link" data-action="open-map">Ver el plano completo →</button></div>${!m.canPlay&&!p?.completed? `<p class="detail-payment">${root.ClubAccess?.checkoutAvailable ? 'Los casos completos se abren con una suscripción activa.' : 'La suscripción abrirá próximamente. Puedes pedir un aviso en la página de suscripción.'}</p>`:''}</div>`;}
function roadmap(s,c,selected=s.history?.length||0){
 const total=c.decisionCount||4,done=Math.min(s.history?.length||0,total),finished=s.status==='finished',remaining=Math.max(0,total-done),labels=total===5?['Entrar','Investigar','Contrastar','Valorar','Decidir']:Array.from({length:total},(_,i)=>'Decisión '+(i+1));
 return `<section class="case-roadmap" aria-label="Avance de la experiencia"><div class="roadmap-summary"><div><span class="ui-kicker">TU RUTA EN ESTE CASO</span><strong>${finished?'Experiencia completada':s.status==='waiting'?'Esperando a tu cómplice':'Estás en la decisión '+Math.min(done+1,total)+' de '+total}</strong></div><span class="roadmap-counter">${done}<small> / ${total}</small></span></div><progress max="${total}" value="${done}" aria-label="Decisiones completadas">${done} de ${total}</progress><ol class="roadmap-stops">${labels.map((label,i)=>`<li class="${i<done?'done':i===done&&!finished?'current':''}" ${i===done&&!finished?'aria-current="step"':''}><button data-action="scene-view" data-index="${i}" ${i>done?'disabled':''} ${i===selected?'aria-current="step"':''}><b>${i<done?'✓':i+1}</b><span>${label}</span></button></li>`).join('')}<li class="${finished?'done':''}"><button data-action="scene-view" data-index="${done}" ${finished?'':'disabled'}><b>${finished?'✓':'◇'}</b><span>Tu final</span></button></li></ol><p>${finished?'Tu desenlace y tu progreso están guardados.':remaining+' '+(remaining===1?'decisión pendiente':'decisiones pendientes')+' para descubrir tu final.'} ${!finished&&s.mode==='duo'?'Un voto pendiente no hace avanzar la ruta.':''}</p></section>`;
}
function reward(s,m){if(s.status!=='finished')return '';const p=stop(m,s.caseId);if(!p?.letter)return '';return `<section class="piece-award"><span class="award-letter">${esc(p.letter)}</span><div><span class="ui-kicker">PIEZA ${String(p.episode).padStart(2,'0')} RECUPERADA</span><h2>Tu plano acaba de cambiar.</h2><p>${count(m)} de 12 experiencias completadas. Esta letra ya está guardada en tu colección.</p><a class="button primary" href="/#archivo?seccion=piezas">Colocar mi pieza en el plano →</a></div></section>`;}
root.ExperienceUI={home,map,detail,roadmap,reward,classicActivity,seasonReturn,artworkPath:s=>icons[(s.episode||1)-1]||icons[0]};
})(typeof window!=='undefined'?window:globalThis);
