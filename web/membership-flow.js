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
function interest(){
 if(state.waitlist)return '<section class="waiting-interest"><h3 id="pase-aviso-titulo" tabindex="-1">Ya estás en la lista de apertura</h3><p>Te avisaremos por correo cuando se abra la temporada.</p><button class="button" data-action="waitlist" data-enabled="false">Retirar el aviso de mi cuenta</button></section>';
 if(noticeReceipt)return '<section class="waiting-interest"><h3 id="pase-aviso-titulo" tabindex="-1">Ya has pedido el aviso</h3><p>Cuando abra la temporada recibirás un correo. Entonces podrás decidir si te suscribes.</p><form class="postal-list-form" data-notice="remove"><button class="button" type="submit">Retirar mi solicitud</button><p role="status"></p></form></section>';
 return `<section class="waiting-interest">
   <h3>¿Te avisamos cuando abra?</h3>
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
const openings=[
 {lead:'¿Dónde esconderías una cinta',em:'durante treinta años?',scene:'Valdemar, 1996. Una voz te pide que guardes una cinta para Ada. En 2026, Ada viene a recogerla. En pareja investigáis un año cada uno. A solas, tú conectas los dos.',month:'Cuatro noches en Valdemar'},
 {lead:'La valija nunca llegó',em:'al faro.',scene:'En el Embarcadero de Nácar terminaba el viaje de la barquera. La valija debía seguir hasta el faro. Tienes tres bocas de río por donde empezar a buscarla.',month:'Las primeras cuatro expediciones'},
 {lead:'El cuarto seis está vacío.',em:'Mira el espejo.',scene:'En la Pensión del Espejo, una mano sigue quitándose un anillo al otro lado del cristal. ¿Quién ha dejado ese gesto en una habitación vacía?',month:'Cuatro noches en Umbravía'},
 {lead:'La barca llegó',em:'contra la corriente.',scene:'La barca funeraria de Neryt ha aparecido en el muelle de arriba. El agua corre hacia abajo. Investiga cómo cruzó el río en la oscuridad.',month:'Los primeros cuatro misterios del Nilo'}
];
const valdemarHooks=[
 'Las obras van a cambiar la estación. ¿Qué escondite seguirá en pie cuando Ada regrese?',
 'Tres huéspedes llegan con tres llaves de la habitación 14. La mujer que llama desde dentro busca a su hermano.',
 'El pasajero de enfrente reconoce la letra de su padre en la carta que te dio tu madre. El tren sigue en marcha.',
 'Un padre y su hija llaman a la emisora desde años distintos. Escucha sus voces antes de decidir a quién devolver la llamada.'
];
function adminCard(){return '<section class="account-card"><span class="club-kicker">Acceso editorial</span><h2>Tienes los 48 juegos abiertos</h2><p>Guarda a tu compañero en Mi cuenta. Para jugar juntos, entrad en el mismo caso y pulsad «En pareja» desde vuestras cuentas. Tu acceso editorial incluye los cuatro tableros sin compra.</p><a class="button" href="/#perfil">Ver mi compañero de juego</a>'+root.Colecciones.menu('')+'</section>';}
function partnerTerms(){
 return config.partnerOffer?.percentOff===50 && config.partnerOffer?.regularAmountCents===2995 && config.partnerOffer?.currency==='eur' ? config.partnerOffer : null;
}
function partnerOfferCard(signed,qualified){
 const heading=qualified?'Tu próxima renovación tiene un 50 % de descuento':'Un 50 % en las renovaciones de ambos';
 const message=qualified?'El descuento se mantiene en las siguientes renovaciones mientras sigáis elegidos mutuamente y los dos tengáis una suscripción personal activa.':'Para activarlo, guarda en tu perfil el correo de tu compañero y pídele que guarde el tuyo. Con las dos suscripciones personales activas, cada uno recibe el descuento desde su próxima renovación.';
 return `<section class="pase-pareja"><h3>${heading}</h3><p>${message}</p><a href="/#perfil">${signed?'Ver mi compañero de juego':'Ir a mi perfil'}</a></section>`;
}
function questions(standalone=false){
 const heading=standalone?'h1':'h2';
 return `<section class="pase-preguntas" aria-labelledby="pase-faq"><p class="pase-supra">Antes de jugar</p><${heading} id="pase-faq" tabindex="-1">Preguntas frecuentes</${heading}>
   <details><summary>¿Puedo probar una historia antes de suscribirme?</summary><p>En Clínica Vallejo recibes una caja de archivo. Escucha la cinta, examina la ficha y cruza las pistas con el registro. Puedes probarla sin cuenta. <a href="/vallejo.html">Abrir la demo</a></p></details>
   <details><summary>¿Crear una cuenta es gratis?</summary><p>Sí. Puedes registrarte sin tarjeta, elegir tu nombre de juego y guardar el correo de tu compañero. La demo de Clínica Vallejo también está abierta sin registro. <a href="/#perfil">Abrir mi perfil</a></p></details>
   <details><summary>¿Cómo jugamos juntos?</summary><p>En Mi cuenta, guarda el correo verificado de tu compañero y pídele que guarde el tuyo. Cada cuenta puede tener un solo compañero a la vez. Cuando tengáis acceso al mismo caso, abridlo desde vuestras cuentas y pulsad «En pareja» dentro del juego. <a href="/#perfil">Elegir a mi compañero</a></p></details>
   <details><summary>¿Cómo se reparten los papeles? ¿Puedo jugar a solas?</summary><p>El primero que pulsa «En pareja» en ese caso lleva el papel 1. Cuando su compañero pulsa «En pareja», recibe el papel 2. Cada uno ve las pistas de su carpeta y las pruebas comunes. Comparad lo que habéis encontrado para decidir juntos. En solitario puedes ver ambos expedientes. Si cambias de modalidad, conservas el avance.</p></details>
   <details><summary>¿Cuándo empieza y cuándo termina el descuento de pareja?</summary><p>Al contratar o retomar un pase, la primera cuota personal es de 29,95 € con IVA. Cuando los dos os habéis elegido en el perfil y ambos tenéis una suscripción personal activa, cada uno obtiene un 50 % de descuento en su próxima renovación y en las siguientes. Si cambiáis de compañero o uno deja de tener la suscripción activa, las próximas cuotas vuelven a la tarifa general. Las facturas ya emitidas conservan su importe. <a href="/#perfil">Gestionar mi compañero</a></p></details>
   <details><summary>¿Cuántos juegos se abren y cuánto dura cada uno?</summary><p>Cada cuota mensual abre cuatro juegos de la temporada para la persona que la paga. Calcula unos 60 minutos por caso. Si haces una pausa, retoma la etapa guardada en Mis partidas.</p></details>
   <details><summary>¿Para qué sirven las llaves?</summary><p>El nuevo pase incluye una llave al contratar y otra en cada renovación confirmada. También ganas una llave al superar por primera vez un reto paralelo. Una pista orientativa cuesta una llave, una pista detallada dos y la solución explicada tres. En pareja, paga quien pide la pista y ambos pueden leerla.</p></details>
   <details><summary>¿Cómo paso al siguiente tablero?</summary><p>Con el nuevo pase personal, cada cuota abona cuatro juegos. Cuando terminas los doce casos de un tablero, puedes entrar en los bloques ya abonados del siguiente. Si todavía no has abonado ese bloque, llegará con tu siguiente cuota. Los juegos pagados se acumulan aunque avances más despacio. El recorrido empieza en Valdemar y continúa en el Tablero de Ámbar, Umbravía y la Necrópolis del Sol Velado.</p></details>
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
 const params=new URLSearchParams(typeof location==='undefined'?'':location.hash.split('?')[1]);
 if(params.get('gestion')==='aviso')return noticeManagement();
 if(params.get('seccion')==='preguntas')return '<div class="pase-temporada pase-ayuda">'+questions(true)+'<p class="pase-links"><a href="/#planes">Volver al pase</a> · <a href="/privacidad.html">Privacidad y datos</a> · <a href="/#perfil?seccion=cuenta">Gestionar mi cuenta</a></p></div>';
 if(state.role==='admin')return adminCard()+'<section class="pase-temporada">'+questions()+'</section>';
 const access=state.seasonAccess;
 const offer=access?.nextPurchase;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length && s.previousReady!==false).at(-1);
 const number=(state.ownAccess && current ? current.number : offer?.number)||current?.number||1;
 const held=current?.number===number ? current : null;
 const route=seasonRoutes[number-1],name=seasonNames[number-1];
 const requested=typeof location!=='undefined'&&new URLSearchParams(location.hash.split('?')[1]).get('revisar');
 const reviewing=!!(requested && root.GameAccountBridge?.isSignedIn() && config.checkoutAvailable && offer?.number===Number(requested) && !state.ownAccess);
 const signed=root.GameAccountBridge?.isSignedIn?.()===true;
 const termsForPartner=partnerTerms();
 const qualified=Boolean(signed && state.ownAccess && current && !current.finishAccess && termsForPartner && state.partnerOffer?.eligible===true && state.partnerOffer?.status==='eligible');
 const checkout=state.ownAccess
   ? '<button class="button primary wide" data-action="billing-portal">Gestionar mi suscripción</button>'
   : (!access||offer)
     ? `<button class="button primary wide" data-action="billing-checkout" data-season="${number}" data-plan="four-boards-v1">${reviewing?'Continuar al pago seguro':'Contratar el pase de los cuatro tableros'}</button>`
     : `<a class="button primary wide" href="#${route}">Volver a ${name}</a>`;
 const terms=[['Condiciones',config.termsUrl],['Política de privacidad',config.privacyUrl]].filter(([,url])=>typeof url==='string'&&/^https:\/\//i.test(url)).map(([label,url])=>`<a href="${esc(url)}" rel="noopener" target="_blank">${label}</a>`).join(' · ');
 const portal=state.ownAccess && state.hasCustomer;
 const freeAccount=signed?'':'<p><button type="button" class="button" data-action="auth-register">Crear cuenta gratis</button></p>';
 const action=config.checkoutAvailable||portal?checkout+(terms?'<p>'+terms+'</p>':''):held?.finishAccess?'<a class="button primary wide" href="#'+route+'">Volver a '+name+'</a>':interest();
 const cycles=offer?.number===number ? offer.remainingCycles : held ? 3-held.paidBlocks.length : 3;
 const continuous=state.ownAccess?access?.billingPlan==='four-boards-v1':true;
 const paidCount=(access?.seasons||[]).reduce((sum,s)=>sum+s.paidBlocks.length,0);
 const remaining=12-paidCount;
 const costText=continuous
   ? (remaining?'Cada cuota abona cuatro juegos, hasta cubrir los 48 del recorrido. Quedan '+remaining+(remaining===1?' cuota':' cuotas')+' para cubrir los cuatro tableros.':'Ya has abonado los 48 juegos de los cuatro tableros.')+' Los cobros terminan al abonar el último bloque. Para jugar en un tablero, termina primero los 12 casos del anterior.'
   : cycles===0 ? 'Has abonado los tres bloques de esta temporada.' :
   cycles===3 ? 'El pase termina tras tres cuotas. A tarifa general, el máximo por los doce juegos es de 89,85 €.' :
   cycles===1 ? 'Queda una cuota para completar esta temporada.' : 'Quedan dos cuotas para completar esta temporada.';
 const firstMonth=number===1?root.ValdemarCatalog.items.slice(0,4):(root.MundosCatalogo||[]).filter(s=>s.world===route).slice(0,4);
 const destination=s=>number===1?'/valdemar/'+String(s.id).padStart(2,'0')+'/':'/#'+route+'?lugar='+((s.id-1)%12+1);
 const opening=openings[number-1],first=firstMonth[0];
 const heroImage=number===1?'/valdemar-pase-estacion.webp':'/mundo-'+((number-1)*12+1)+'.webp';
 const waitForOpening=!state.ownAccess&&!config.checkoutAvailable&&!held?.finishAccess;
 const openingLink=waitForOpening?openingAction():null;
 const target=openingLink?.target||'pass-review-title';
 const mainLabel=openingLink?.label||(state.ownAccess?'Ver mi suscripción':'Ver el pase de los cuatro tableros');
 const past=current?.finishAccess && current.completed===12 && number>current.number;
 return `<section class="pase-temporada" data-season="${number}">
   ${params.get('checkout')==='complete'?`<aside class="pase-ficha" role="status"><h2>${state.ownAccess?'Tu pase está activo':'Estamos comprobando tu pase'}</h2><p>${state.ownAccess?'Ya puedes abrir un caso. Si vais a investigar juntos, elegíos en vuestros perfiles y pulsad «En pareja» dentro del mismo juego.':'Tus juegos aparecerán en el perfil cuando se confirme el pago.'}</p><a class="button" href="/#perfil">Abrir mi perfil</a></aside>`:''}
   <header class="pase-escena">
     <img class="pase-fondo" src="${heroImage}" alt="" width="1536" height="1024" fetchpriority="high">
     <div class="pase-apertura"><p class="pase-supra">${continuous?'Suscripción personal · 48 aventuras':'Pase de temporada · '+name}</p>
       <h1>${continuous?'Un pase para <em>cuatro tableros</em>':opening.lead+' <em>'+opening.em+'</em>'}</h1>
       <p class="pase-premisa">${continuous?'Empieza en Valdemar y continúa por el Tablero de Ámbar, Umbravía y la Necrópolis del Sol Velado. Cada mensualidad desbloquea cuatro aventuras para jugar a solas o en pareja.':opening.scene}</p>
       <div class="pase-acciones"><button type="button" class="pase-principal" data-action="page-section" data-target="${target}"${waitForOpening?' data-opening-action':''}>${mainLabel}</button>
         <button type="button" class="pase-demo" data-action="preview-open">Jugar la demo de Clínica Vallejo</button></div>
     </div>
     ${first?`<a class="pase-pie-foto" href="${destination(first)}">${esc(first.title)} · ${esc(first.place)} <span aria-hidden="true">↗</span></a>`:''}
   </header>
   <section class="pase-estrenos" aria-labelledby="pase-primer-mes">
     <div class="pase-seccion"><div><p class="pase-supra">El primer mes</p><h2 id="pase-primer-mes">${opening.month}</h2></div>
       <a class="pase-enlace" href="/#${route}">Ver los 12 juegos <span aria-hidden="true">→</span></a></div>
     <div class="pase-peliculas">${firstMonth.map((s,i)=>`<a class="pase-caso" href="${destination(s)}" aria-labelledby="pase-caso-${s.id}">
       <figure><img src="${esc(s.image||'/mundo-'+s.id+'.webp')}" alt="" width="764" height="508" loading="lazy" decoding="async"></figure>
       <div class="pase-caso-copy"><span class="pase-lugar">${esc(s.place)}</span><h3 id="pase-caso-${s.id}">${esc(s.title)}</h3><p>${esc(number===1?valdemarHooks[i]:s.question)}</p></div></a>`).join('')}</div>
   </section>
   <div class="pase-detalle" id="pase-detalle"><article class="pase-ficha">
     <p class="pase-supra">Pase personal · Suscripción mensual</p>
     <h2 id="pass-review-title" tabindex="-1">${reviewing?'Revisa tu pase de los cuatro tableros':continuous?'El pase de los cuatro tableros':'El pase de '+name}</h2>
     <p class="pase-incluye">Cada cuota abre cuatro investigaciones de unos 60 minutos. Juega a solas o comparte el caso con tu compañero. Cada uno sigue las pistas de su papel desde su propia cuenta.</p>
     <p class="pase-precio"><strong>29,95 €</strong> ${state.ownAccess?'por persona al mes · tarifa general':'primera cuota por persona'}</p>
     <p class="pase-estado">${config.checkoutAvailable||held?'IVA incluido.':'Precio previsto, IVA incluido. La suscripción abrirá próximamente.'}${state.ownAccess?'':' La renovación mensual a tarifa general es de 29,95 €.'}</p>
     <p class="pase-importe">${costText} ${(continuous?remaining:cycles)?'Puedes cancelar antes de la próxima renovación.':held?.finishAccess?'Los doce juegos siguen disponibles en tu cuenta.':''}</p>
     ${partnerOfferCard(signed,qualified)}
     ${past?`<p>Has completado ${seasonNames[current.number-1]}. <a href="/#${seasonRoutes[current.number-1]}">Volver a esa temporada</a></p>`:''}
     <div class="pase-decision">${action}${freeAccount}${signed && (state.ownAccess||held?.finishAccess)?'<p><a href="/#perfil">Ver mi compañero de juego</a></p>':''}</div>
   </article>${questions()}</div>
 </section>`;
}
root.ClubAccess={...old,plans,enrollment:plans,banner(){if(typeof location!=='undefined'&&['#planes','#alta-club','#suscripcion'].includes(location.hash.split('?')[0]))return '';return state.role==='admin'?'<aside class="paid-banner" aria-label="Acceso editorial"><span class="paid-dot" aria-hidden="true"></span><p><strong>Acceso editorial</strong> · Tienes los 48 juegos disponibles.</p><a href="'+(state.canManage===true?'#gestion':'#casos')+'">'+(state.canManage===true?'Abrir gestión':'Explorar retos')+'</a></aside>':(state.canPlay||state.seasonAccess?.availableCases?.length)?'':old.banner();},get checkoutAvailable(){return config.checkoutAvailable===true;},get canPlay(){return state.canPlay===true;},get state(){return state;},set(value){state=value||{canPlay:false};},account(){
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
 return '<section class="account-card"><span class="club-kicker">MI SUSCRIPCIÓN</span><h2>'+title+'</h2>'+progress+period+billing+nextLink+noticeLink+(!billing&&!nextLink&&!current?'<a class="button" href="#planes">Ver plan y disponibilidad</a>':'')+(!config.checkoutAvailable&&!current?interest():'')+(!config.checkoutAvailable&&!state.waitlist&&!current?'<button class="text-link" data-action="waitlist" data-enabled="false">Retirar los avisos asociados a mi correo verificado</button>':'')+'</section>';
}};
fetch('/api/billing/config',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>{config=c;if(root.GameAccountBridge)root.GameAccountBridge.render();}).catch(()=>{});
})(globalThis);
