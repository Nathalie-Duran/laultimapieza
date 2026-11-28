(function(root){
'use strict';
let state={canPlay:false,checkoutAvailable:false},config={checkoutAvailable:false};
const old=root.ClubAccess,esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const noticeKey='lup-opening-notice-v1';
let noticeReceipt='';
try{noticeReceipt=localStorage.getItem(noticeKey)||'';}catch{}
function openingAction(){
 return noticeReceipt||state.waitlist?{label:'Ver mi aviso de apertura',target:'pase-aviso-titulo'}:{label:'Avísame cuando abra',target:'pase-correo-apertura'};
}
function interest(withHeading=true){
 if(state.waitlist)return '<section class="waiting-interest"><h3 id="pase-aviso-titulo" tabindex="-1">Ya estás en la lista de apertura</h3><p>Te avisaremos por correo cuando se abra la temporada.</p><button class="button" data-action="waitlist" data-enabled="false">Retirar el aviso de mi cuenta</button></section>';
 if(noticeReceipt)return '<section class="waiting-interest"><h3 id="pase-aviso-titulo" tabindex="-1">Ya has pedido el aviso</h3><p>Cuando abra la temporada recibirás un correo. Entonces podrás decidir si te suscribes.</p><form class="postal-list-form" data-notice="remove"><button class="button" type="submit">Retirar mi solicitud</button><p role="status"></p></form></section>';
 return `<section class="waiting-interest">
   ${withHeading?'<h3>¿Te avisamos cuando abra?</h3>':''}
   <form class="postal-list-form" data-notice="join">
     <label>Tu correo electrónico<input id="pase-correo-apertura" type="email" name="email" maxlength="254" autocomplete="email" placeholder="tu@correo.es" required></label>
     <label class="notice-consent"><input type="checkbox" name="consent" required> <span>Quiero recibir un correo cuando abra la temporada.</span></label>
     <button class="button primary" type="submit">Avisarme de la apertura</button>
     <p class="micro">Puedes retirar el aviso desde este navegador. <a href="/privacidad.html#avisos">Cómo usamos tu correo</a></p>
     <p role="status"></p>
   </form>
 </section>`;
}
if(typeof document!=='undefined')document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches?.('form[data-notice]'))return;
 event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');if(button.disabled)return;
 const join=form.dataset.notice==='join';button.disabled=true;status.textContent='Guardando…';
 try{
   const payload=join?{email:form.elements.email.value,consent:form.elements.consent.checked,referralMetrics:root.InvitationCounts?.enabled===true}:{receipt:noticeReceipt};
   const response=await fetch('/api/opening-notice',{method:join?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const result=await response.json();if(!response.ok||result.accepted!==true)throw Error(result.error||'No hemos podido guardar el cambio. Vuelve a intentarlo.');
   noticeReceipt=join?result.receipt:'';try{if(join)localStorage.setItem(noticeKey,noticeReceipt);else localStorage.removeItem(noticeKey);}catch{}
   const section=form.closest('.waiting-interest');
   if(section.hasAttribute('data-manage-notice')){
     section.innerHTML='<h3 tabindex="-1">Solicitud de retirada procesada</h3><p>Si el aviso estaba vinculado a este resguardo, ha quedado retirado.</p>';
   }else section.outerHTML=interest();
   const shortcut=document.querySelector('[data-opening-action]');
   if(shortcut){const next=openingAction();shortcut.textContent=next.label;shortcut.dataset.target=next.target;}
   const next=document.querySelector('.waiting-interest h3');if(next){next.tabIndex=-1;next.focus();}
 }catch(error){status.textContent=error.message||'No hay conexión. Vuelve a intentarlo.';button.disabled=false;}
});
const seasonNames=['Valdemar','El Tablero de Ámbar','Umbravía','La Necrópolis del Sol Velado'];
const seasonRoutes=['casos','expedicion','umbravia','necropolis'];
const boardArt=['valdemar-cartografia.webp','ambar-tallado.webp','umbravia-farol.webp','necropolis-descenso.webp'];
function passMap(number,held){
 const paid=new Set(held?.paidBlocks||[]);
 return `<section class="pase-recorrido" aria-labelledby="pase-progresion"><h2 id="pase-progresion">Así se abre cada tablero</h2>
  <ol class="pase-bloques">${[1,2,3].map(block=>`<li${paid.has(block)?' class="pase-abonado"':''}><small>Cuota ${block}${paid.has(block)?' · abonada':''}</small><strong>${block*4}<span> / 12 aventuras</span></strong><span>Casos ${String((block-1)*4+1).padStart(2,'0')} a ${String(block*4).padStart(2,'0')}</span></li>`).join('')}</ol>
  <h3>Los cuatro tableros, en orden</h3><ol class="pase-mundos">${seasonNames.map((name,i)=>`<li><a href="/#${i===0?'mapa':seasonRoutes[i]}"><img src="/${boardArt[i]}" width="180" height="116" loading="lazy" alt=""><span><small>Tablero ${i+1}</small><strong>${name}</strong></span></a></li>`).join('')}</ol>
  <p>Al guardar los doce desenlaces de ${seasonNames[number-1]}, ${number===4?'completas el último tablero.':'puedes pasar al siguiente y jugar los bloques que ya hayas abonado.'}</p></section>`;
}
function adminCard(){return '<section class="account-card"><span class="club-kicker">Acceso editorial</span><h2>Tienes los 48 juegos abiertos</h2><p>Guarda a tu compañero en la sección Pareja de Mi cuenta. Para jugar juntos, entrad en el mismo caso y pulsad «En pareja» desde vuestras cuentas. Tu acceso editorial incluye los cuatro tableros sin compra.</p><a class="button" href="/#perfil?seccion=pareja">Ver mi compañero de juego</a>'+root.Colecciones.menu('')+'</section>';}
function partnerTerms(){
 return config.partnerOffer?.percentOff===50 && config.partnerOffer?.regularAmountCents===2995 && config.partnerOffer?.currency==='eur' ? config.partnerOffer : null;
}
function partnerOfferCard(signed,qualified){
 const heading=qualified?'Tu próxima renovación tiene un 50 % de descuento':'Un 50 % en las renovaciones de ambos';
 const message=qualified?'El descuento se mantiene en las siguientes renovaciones mientras sigáis elegidos mutuamente y los dos tengáis una suscripción personal activa.':'Para activarlo, guarda en tu perfil el correo de tu compañero y pídele que guarde el tuyo. Con las dos suscripciones personales activas, cada uno recibe el descuento desde su próxima renovación.';
 return `<section class="pase-pareja"><h3>${heading}</h3><p>${message}</p><a href="/#perfil?seccion=pareja">${signed?'Ver mi compañero de juego':'Elegir a mi compañero'}</a></section>`;
}
function questions(){
 return `<section class="pase-preguntas" aria-labelledby="pase-faq"><h1 id="pase-faq" tabindex="-1">Preguntas frecuentes</h1>
   <h2>Cuenta y acceso</h2>
   <details><summary>¿Puedo probar una historia antes de suscribirme?</summary><p>En Clínica Vallejo recibes una caja de archivo. Escucha la cinta, examina la ficha y cruza las pistas con el registro. Puedes probarla sin cuenta. <a href="/vallejo.html">Abrir la demo</a></p></details>
   <details><summary>¿Crear una cuenta es gratis?</summary><p>Sí. Puedes registrarte sin tarjeta y elegir tu nombre de juego. La demo de Clínica Vallejo también está abierta sin registro. <a href="/#perfil">Abrir mi perfil</a></p></details>
   <h2>Juego en pareja</h2>
   <details><summary>¿Cómo jugamos juntos?</summary><p>En la sección Pareja de Mi cuenta, guarda el correo verificado de tu compañero y pídele que guarde el tuyo. Cada cuenta puede tener un solo compañero a la vez. Cuando tengáis acceso al mismo caso, abridlo desde vuestras cuentas y pulsad «En pareja» dentro del juego. <a href="/#perfil?seccion=pareja">Elegir a mi compañero</a></p></details>
   <details><summary>¿Cómo se reparten los papeles? ¿Puedo jugar a solas?</summary><p>El primero que pulsa «En pareja» en ese caso lleva el papel 1. Cuando su compañero pulsa «En pareja», recibe el papel 2. Cada uno ve las pistas de su carpeta y las pruebas comunes. Comparad lo que habéis encontrado para decidir juntos. En solitario puedes ver ambos expedientes. Si cambias de modalidad, conservas el avance.</p></details>
   <details><summary>¿Cuándo empieza y cuándo termina el descuento de pareja?</summary><p>Al contratar o retomar un pase, la primera cuota personal es de 29,95 € con IVA. Cuando los dos os habéis elegido en el perfil y ambos tenéis una suscripción personal activa, cada uno obtiene un 50 % de descuento en su próxima renovación y en las siguientes. Si cambiáis de compañero o uno deja de tener la suscripción activa, las próximas cuotas vuelven a la tarifa general. Las facturas ya emitidas conservan su importe. <a href="/#perfil?seccion=pareja">Gestionar mi compañero</a></p></details>
   <h2>Desbloqueos y llaves</h2>
   <details><summary>¿Cuántos juegos se abren y cuánto dura cada uno?</summary><p>Con la primera cuota personal se abren los casos 01 a 04. La segunda suma los casos 05 a 08 y la tercera completa los doce con los casos 09 a 12. Calcula unos 60 minutos por caso. Puedes volver al punto guardado desde <a href="/#archivo">Mis partidas</a>.</p></details>
   <details><summary>¿Para qué sirven las llaves?</summary><p>El nuevo pase incluye una llave al contratar y otra en cada renovación confirmada. Los retos de los dos primeros bloques de cada tablero dan una llave. Los del tercer bloque dan dos. En la mansión de Ada hay además seis minijuegos que suman hasta ocho llaves. Cada premio se acredita la primera vez. Una pista orientativa cuesta una llave, una pista detallada dos y la solución explicada tres. En pareja, paga quien pide la pista y ambos pueden leerla. <a href="/#desafios">Explorar los desafíos</a></p></details>
   <details><summary>¿Qué ocurre si me salto un desafío diario o una misión semanal?</summary><p>Tu partida y tus llaves se conservan. Desde el primer caso de Valdemar puedes jugar una prueba diaria por una llave y una misión de tres etapas por dos llaves cada semana. Cada edición indica cuándo cierra, en horario de Madrid. <a href="/#desafios">Ver los desafíos disponibles</a></p></details>
   <details><summary>¿Cómo paso al siguiente tablero?</summary><p>Con el nuevo pase personal, cada cuota abona cuatro juegos. Cuando terminas los doce casos de un tablero, puedes entrar en los bloques ya abonados del siguiente. Si todavía no has abonado ese bloque, llegará con tu siguiente cuota. Los juegos pagados se acumulan aunque avances más despacio. El recorrido empieza en Valdemar y continúa en el Tablero de Ámbar, Umbravía y la Necrópolis del Sol Velado.</p></details>
   <h2>Cobros, privacidad y avisos</h2>
   <details><summary>¿Cómo gestiono o cancelo mi suscripción?</summary><p>En Mi cuenta, abre Cuenta y elige «Gestionar mi suscripción». Puedes cancelar antes del siguiente cobro. Conservas el acceso durante el periodo abonado. Después podrás terminar los tableros que hayas abonado por completo, en orden. Los pases de temporada contratados anteriormente conservan su calendario original. <a href="/#perfil?seccion=cuenta">Ir a Mi cuenta</a></p></details>
   <details><summary>¿Qué datos guardáis y cómo puedo gestionarlos?</summary><p>La cuenta conserva tus partidas, etapas y desenlaces para que puedas volver a ellos. La demo recuerda tu avance en el navegador. Consulta tus controles o escribe al Equipo de LaUltimaPieza.es en <a href="mailto:info@laultimapieza.es">info@laultimapieza.es</a> para ejercer tus derechos. <a href="/privacidad.html">Ver privacidad y datos</a></p></details>
   <details><summary>¿Puedo retirar el aviso de apertura?</summary><p>Abre la gestión de avisos en el navegador donde lo solicitaste. Si usas otro dispositivo, puedes retirarlo desde una cuenta con ese mismo correo verificado. <a href="/#planes?gestion=aviso">Gestionar mi aviso</a></p></details>
 </section>`;
}
function noticeManagement(){
 const signed=root.GameAccountBridge?.isSignedIn?.();
 const browser=noticeReceipt?'<form class="postal-list-form" data-notice="remove"><button class="button" type="submit">Retirar mi solicitud</button><p role="status"></p></form>':
   '<p>Este navegador no conserva el resguardo de un aviso de apertura.</p>';
 const account=signed?'<button type="button" class="button" data-action="waitlist" data-enabled="false">Retirar los avisos de mi correo verificado</button>':
   '<button type="button" class="button" data-action="auth-login">Entrar con mi cuenta</button>';
 return `<section class="pase-temporada"><div class="pase-detalle"><article class="pase-ficha"><p class="pase-supra">Privacidad y datos</p><h1>Gestionar mi aviso</h1>
 <div class="waiting-interest" data-manage-notice><h3 tabindex="-1">Aviso de apertura</h3>${browser}</div>
 <p>Con una cuenta que tenga el mismo correo verificado también puedes retirar el aviso que solicitaste desde otro navegador.</p>${account}
 <p class="pase-links"><a href="/privacidad.html#avisos">Privacidad del aviso</a> · <a href="/#planes">Volver al pase</a></p>
 </article></div></section>`;
}
function plans(){
 const hash=typeof location==='undefined'?'#planes':location.hash;
 const [page,query]=hash.split('?'),params=new URLSearchParams(query||'');
 const help='<a href="/#planes?seccion=preguntas">Preguntas frecuentes</a>';
 const back='<a href="/#planes">Volver al pase</a>';
 const signed=root.GameAccountBridge?.isSignedIn?.()===true;
 if(params.get('gestion')==='aviso')return noticeManagement();
 if(params.get('seccion')==='preguntas')return '<div class="pase-temporada pase-ayuda"><p class="pase-links">'+back+'</p>'+questions()+'</div>';
 if(params.get('checkout')==='complete')return `<section class="pase-temporada pase-sencillo"><article class="pase-ficha" role="status"><h1>${state.ownAccess?'Tu pase está activo':'Estamos comprobando tu pase'}</h1><p>${state.ownAccess?'Los juegos de tu bloque ya están disponibles.':'Tus juegos aparecerán en el perfil cuando se confirme el pago.'}</p><a class="button primary" href="/#perfil">Abrir mi perfil</a></article></section>`;
 if(page==='#suscripcion'||(page==='#alta-club'&&signed&&state.ownAccess)){
   if(signed)return '<section class="pase-temporada pase-sencillo"><h1>Mi suscripción</h1>'+root.ClubAccess.account(true)+'<p class="pase-links">'+help+'</p></section>';
   return '<section class="pase-temporada pase-sencillo"><article class="pase-ficha"><h1>Mi suscripción</h1><p>Entra para consultar tus bloques y gestionar tu pase personal.</p><div class="pase-acciones"><button class="button primary" data-action="auth-login">Entrar con mi cuenta</button><a href="/#planes">Ver el pase</a></div></article></section>';
 }
 if(state.role==='admin')return '<section class="pase-temporada pase-sencillo"><h1>Tu acceso editorial</h1>'+adminCard()+'<p class="pase-links">'+help+'</p></section>';
 const access=state.seasonAccess;
 const offer=access?.nextPurchase;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length && s.previousReady!==false).at(-1);
 const number=(state.ownAccess && current ? current.number : offer?.number)||current?.number||1;
 const held=current?.number===number ? current : null;
 const route=seasonRoutes[number-1],name=seasonNames[number-1];
 const requested=params.get('revisar');
 const reviewing=Boolean(requested && signed && config.checkoutAvailable && offer?.number===Number(requested) && !state.ownAccess);
 const focused=page==='#alta-club'||reviewing;
 const termsForPartner=partnerTerms();
 const qualified=Boolean(signed && state.ownAccess && current && !current.finishAccess && termsForPartner && state.partnerOffer?.eligible===true && state.partnerOffer?.status==='eligible');
 const checkout=state.ownAccess
   ? '<button class="button primary wide" data-action="billing-portal">Gestionar mi suscripción</button>'
   : (!access||offer)
     ? `<button class="button primary wide" data-action="billing-checkout" data-season="${number}" data-plan="four-boards-v1">${reviewing?'Continuar al pago seguro':'Contratar el pase de los cuatro tableros'}</button>`
     : `<a class="button primary wide" href="#${route}">Volver a ${name}</a>`;
 const terms=[['Condiciones',config.termsUrl],['Política de privacidad',config.privacyUrl]].filter(([,url])=>typeof url==='string'&&/^https:\/\//i.test(url)).map(([label,url])=>`<a href="${esc(url)}" rel="noopener" target="_blank">${label}</a>`).join(' · ');
 const portal=state.ownAccess && state.hasCustomer;
 const waitForOpening=!state.ownAccess&&!config.checkoutAvailable&&!held?.finishAccess;
 const opening=openingAction();
 const notify=`<a class="button primary wide" href="/#alta-club">${noticeReceipt||state.waitlist?opening.label:'Avisarme de la apertura'}</a>`;
 const openBoard='<a class="button primary wide" href="/#'+route+'">Volver a '+name+'</a>';
 const action=waitForOpening?notify:held?.finishAccess&&!state.ownAccess&&!offer?openBoard:state.ownAccess&&!focused
   ? '<a class="button primary wide" href="/#suscripcion">Gestionar mi suscripción</a>'
   : (config.checkoutAvailable||portal)?checkout+(terms?'<p>'+terms+'</p>':''):openBoard;
 if(focused&&waitForOpening)return '<section class="pase-temporada pase-sencillo"><p class="pase-links">'+back+'</p><article class="pase-ficha"><h1>Aviso de apertura</h1><div class="pase-decision">'+interest(false)+'</div></article><p class="pase-links">'+help+'</p></section>';
 const cycles=offer?.number===number ? offer.remainingCycles : held ? 3-held.paidBlocks.length : 3;
 const continuous=state.ownAccess?access?.billingPlan==='four-boards-v1':true;
 const paidCount=(access?.seasons||[]).reduce((sum,s)=>sum+s.paidBlocks.length,0);
 const remaining=12-paidCount;
 const costText=continuous
   ? (remaining?'Quedan '+remaining+(remaining===1?' cuota':' cuotas')+' para cubrir los cuatro tableros.':'Ya has abonado los 48 juegos de los cuatro tableros.')+' Los cobros terminan al abonar el último bloque.'
   : cycles===0 ? 'Has abonado los tres bloques de esta temporada.' :
   cycles===3 ? 'El pase termina tras tres cuotas. A tarifa general, el máximo por los doce juegos es de 89,85 €.' :
   cycles===1 ? 'Queda una cuota para completar esta temporada.' : 'Quedan dos cuotas para completar esta temporada.';
 const heroImage=number===1?'/mansion-room-1.webp':'/mundo-'+((number-1)*12+1)+'.webp';
 const title=reviewing?'Revisa tu pase de los cuatro tableros':focused?'Alta del pase personal':'Precio y condiciones';
 const heading=focused?'h1':'h2';
 const price=`<article class="pase-ficha"><${heading} id="pass-review-title" tabindex="-1">${title}</${heading}>
     <p class="pase-precio"><strong>29,95 €</strong> ${state.ownAccess?'por persona al mes · tarifa general':'primera cuota por persona'}</p>
     <p class="pase-estado">${waitForOpening?'Precio previsto, IVA incluido. La suscripción abrirá próximamente.':'IVA incluido.'}${state.ownAccess?'':' Las renovaciones mantienen la tarifa general salvo descuento de pareja.'}</p>
     <p class="pase-importe">${costText} ${(continuous?remaining:cycles)?'Puedes cancelar antes de la próxima renovación.':held?.finishAccess?'Los doce juegos siguen disponibles en tu cuenta.':''}</p>
     ${partnerOfferCard(signed,qualified)}
     <div class="pase-decision">${action}${focused&&!signed&&!waitForOpening?'<button type="button" class="button" data-action="auth-register">Crear cuenta gratis</button>':''}</div></article>`;
 if(focused)return `<section class="pase-temporada pase-sencillo"><p class="pase-links">${back}</p>${price}<p class="pase-links">${help}</p></section>`;
 return `<section class="pase-temporada" data-season="${number}"><header class="pase-escena pase-resumen">
     <img class="pase-fondo" src="${heroImage}" alt="" width="1536" height="1024" fetchpriority="high">
     <div class="pase-apertura"><h1>${continuous?'Un pase para <em>cuatro tableros</em>':'Tu pase de '+name}</h1>
       <p class="pase-premisa">Investiga a solas o en pareja desde tu propia cuenta. Cada aventura dura unos 60 minutos.</p>
       <div class="pase-acciones">${signed?'<a class="pase-demo" href="/#archivo">Volver a mis partidas</a>':'<button type="button" class="pase-demo" data-action="auth-login">Ya tengo cuenta · Entrar</button>'}
         <a class="pase-muestra" href="/vallejo.html">Probar la demo de Clínica Vallejo</a></div>
     </div></header>
   <div class="pase-comparativa">${price}${passMap(number,held)}</div>
   <p class="pase-links">${help} · <a href="/#casos">Explorar el catálogo</a></p></section>`;
}
root.ClubAccess={...old,plans,enrollment:plans,gate(){
 const signed=root.GameAccountBridge?.isSignedIn?.()===true;
 return '<section class="pase-temporada pase-acceso"><div class="pase-ficha"><p class="pase-supra">Acceso a los casos completos</p><h1>Investiga con tu pase personal</h1><p>La cuota de 29,95 € por persona, IVA incluido, abre cuatro aventuras del tablero. '+(config.checkoutAvailable?'Puedes consultar las condiciones y los bloques disponibles antes de contratar.':'La contratación está en preapertura. Puedes pedir un aviso por correo.')+'</p><div class="pase-acciones"><a class="button primary" href="/#planes">'+(config.checkoutAvailable?'Ver el pase':'Ver el pase y pedir el aviso')+'</a>'+(signed?'<a class="button" href="/#archivo">Ver mis partidas</a>':'<button type="button" class="button" data-action="auth-login">Ya tengo cuenta · Entrar</button>')+'<a href="/vallejo.html">Jugar la demo gratuita</a></div></div></section>';
},banner(){
 if(state.role!=='admin')return '';
 const page=typeof location==='undefined'?'':location.hash.split('?')[0];
 if(['#planes','#alta-club','#suscripcion','#gestion'].includes(page))return '';
 return '<aside class="paid-banner" aria-label="Acceso editorial"><span class="paid-dot" aria-hidden="true"></span><p><strong>Acceso editorial</strong> · 48 aventuras disponibles.</p></aside>';
},get checkoutAvailable(){return config.checkoutAvailable===true;},get canPlay(){return state.canPlay===true;},get state(){return state;},set(value){state=value||{canPlay:false};},account(standalone=false){
 if(state.role==='admin') return adminCard();
 const access=state.seasonAccess;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length && s.previousReady!==false).at(-1);
 const next=access?.nextPurchase;
 const canFinish=current?.finishAccess && current.completed<12;
 const title=current?.finishAccess&&current.completed===12?'Temporada completada':state.ownAccess?'Tu temporada está activa':canFinish?'Tu temporada está pendiente de terminar':current?'Tu pase está en pausa':'Cuenta gratuita';
 const progress=(access?.seasons||[]).filter(s=>s.paidBlocks.length).map(s=>{
   const name=seasonNames[s.number-1];
   const paid=s.finishAccess?'Pase abonado':s.paidBlocks.length+' de 3 bloques abonados';
   if(s.previousReady===false)return '<p><strong>'+name+'</strong> · '+paid+' · Termina el tablero anterior para acceder.</p>';
   return '<p><strong>'+name+'</strong> · '+paid+' · '+s.completed+' de 12 juegos terminados.</p><a class="button" href="#'+seasonRoutes[s.number-1]+'">Volver a '+name+'</a>';
 }).join('');
 const noticeLink='<p><a href="/#planes?gestion=aviso">Gestionar avisos de apertura</a> · <a href="/privacidad.html">Privacidad y datos</a></p>';
 const nextLink=!state.ownAccess&&next?'<a class="button" href="#planes">Ver el pase de los cuatro tableros</a>':'';
 const period=state.periodEnd?'<p>Periodo abonado hasta el '+new Date(state.periodEnd).toLocaleDateString('es-ES')+'.</p>':'';
 const billing=state.hasCustomer?'<button class="button" data-action="billing-portal">Gestionar mi suscripción</button>':'';
 const subtitle=standalone?'':'<span class="club-kicker">Mi suscripción</span>';
 const personalOffer=standalone&&state.ownAccess&&current&&!current.finishAccess&&partnerTerms()&&state.partnerOffer?.eligible===true&&state.partnerOffer?.status==='eligible'?partnerOfferCard(true,true):'';
 const action=!current&&!billing&&!nextLink?'<a class="button" href="/#planes">Ver plan y disponibilidad</a>':'';
 return '<section class="account-card">'+subtitle+'<h2>'+title+'</h2>'+progress+period+personalOffer+billing+nextLink+action+noticeLink+'</section>';
}};
fetch('/api/billing/config',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>{config=c;if(root.GameAccountBridge)root.GameAccountBridge.render();}).catch(()=>{});
})(globalThis);
