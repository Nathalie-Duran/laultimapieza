(function(root){
'use strict';
let state={canPlay:false},config={},configStatus='loading';
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
if(typeof document!=='undefined')document.addEventListener('click',event=>{if(event.target.closest?.('[data-reload-offer]'))root.location.reload();});
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
const seasonNames=['Código Valdemar','La ruta prohibida','El tercer jugador','La ira de Ra'];
const seasonRoutes=['casos','expedicion','umbravia','necropolis'];
function passMap(number,held){
 const paid=new Set(held?.paidBlocks||[]);
 return `<section class="pase-recorrido" aria-labelledby="pase-progresion"><h2 id="pase-progresion">Así completas una temporada</h2>
  <ol class="pase-bloques">${[1,2,3].map(block=>`<li${paid.has(block)?' class="pase-abonado"':''}><small>Cuota ${block}${paid.has(block)?' · abonada':''}</small><strong>${block*4}<span> / 12 juegos</span></strong></li>`).join('')}</ol>
  <p>Al terminar los doce juegos de ${seasonNames[number-1]}, ${number===4?'completas la última temporada.':'puedes jugar los bloques que ya hayas abonado de la siguiente temporada.'} <a href="/#tableros">Ver las temporadas</a></p></section>`;
}
function blockGames(number,block){
 const offset=(number-1)*12,first=offset+(block-1)*4+1;
 const catalog=number===1?root.ValdemarCatalog?.items:root.MundosCatalogo;
 const games=(catalog||[]).filter(game=>game.id>=first&&game.id<first+4);
 if(!games.length)return '';
 return `<section class="pase-seleccion" aria-labelledby="pase-juegos"><div class="pase-seccion"><div><p class="pase-supra">Temporada ${number} · ${seasonNames[number-1]}</p><h2 id="pase-juegos">${block===1?'Los primeros cuatro juegos':'Los cuatro juegos del bloque '+block}</h2></div></div>
  <ol class="pase-caratulas">${games.map(game=>{
   const id=String(game.id).padStart(2,'0');
   const link=number===1?'/valdemar/'+id+'/':'/#'+seasonRoutes[number-1]+'?lugar='+(game.id-offset);
   const image=number===1?game.image:'/mundo-'+game.id+'.webp';
   return `<li><a href="${link}"><img src="${esc(image)}" alt="" width="320" height="180" loading="lazy"><span><small>Juego ${id}</small><strong>${esc(game.title)}</strong></span></a></li>`;
  }).join('')}</ol></section>`;
}
function adminCard(){return '<section class="account-card"><span class="club-kicker">Acceso editorial</span><h2>Tienes los 48 juegos abiertos</h2><p>Para jugar en pareja, guarda a tu compañero en Mi cuenta y pulsad «En pareja» en el mismo juego desde vuestras cuentas.</p><a class="button" href="/#casos">Abrir Juegos</a> <a class="button" href="/#perfil?seccion=pareja">Ver mi compañero de juego</a></section>';}
function catalogPaid(access){return (access?.seasons||[]).reduce((sum,season)=>sum+season.paidBlocks.length,0)>=12;}
function duesRemaining(access,held){
 if(catalogPaid(access))return false;
 if(access?.billingPlan==='season')return Boolean(held&&held.paidBlocks.length<3);
 return true;
}
function monthlyPrice(){
 const regular=config.partnerOffer?.regularAmountCents;
 const cents=config.partnerOffer?.currency==='eur'&&Number.isSafeInteger(regular)&&regular>0?regular:2995;
 return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(cents/100).replace(/\s/g,' ');
}
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
   <details><summary>¿Puedo probar una historia antes de suscribirme?</summary><p>En La cinta 87 investigas la última emisión de Radio Valdemar. Escucha la señal o lee su transcripción y contrástala con las fichas del archivo. Puedes probarla sin cuenta. <a href="/cinta-87.html">Abrir la demo</a></p></details>
   <details><summary>¿Crear una cuenta es gratis?</summary><p>Sí. Puedes registrarte sin tarjeta y elegir tu nombre de juego. La demo de La cinta 87 también está abierta sin registro. <a href="/#perfil">Abrir mi perfil</a></p></details>
   <h2>Juego en pareja</h2>
   <details><summary>¿Necesitamos dos cuentas para jugar en pareja?</summary><p>En la demo La cinta 87 os turnáis con un mismo dispositivo y podéis jugar sin cuenta. En las aventuras del pase, cada persona entra con su propia cuenta. En la sección Pareja de Mi cuenta, guarda el correo verificado de tu compañero y pídele que guarde el tuyo. Cada cuenta puede tener un solo compañero a la vez. Cuando tengáis acceso al mismo caso, abridlo desde vuestras cuentas y pulsad «En pareja» dentro del juego. <a href="/#perfil?seccion=pareja">Elegir a mi compañero</a></p></details>
   <details><summary>¿Cómo se reparten los papeles en las aventuras del pase? ¿Puedo jugar a solas?</summary><p>El primero que pulsa «En pareja» en ese caso lleva el papel 1. Cuando su compañero pulsa «En pareja», recibe el papel 2. Cada uno ve las pistas de su carpeta y las pruebas comunes. Comparad lo que habéis encontrado para decidir juntos. En solitario puedes ver ambos expedientes. Si cambias de modalidad, conservas el avance.</p></details>
   <details><summary>¿Cuándo empieza y cuándo termina el descuento de pareja?</summary><p>Al contratar o retomar un pase, la primera cuota personal es de ${monthlyPrice()} con IVA. Cuando los dos os habéis elegido en el perfil y ambos tenéis una suscripción personal activa, cada uno obtiene un 50 % de descuento en su próxima renovación y en las siguientes. Si cambiáis de compañero o uno deja de tener la suscripción activa, las próximas cuotas vuelven a la tarifa general. Las facturas ya emitidas conservan su importe. <a href="/#perfil?seccion=pareja">Gestionar mi compañero</a></p></details>
   <h2>Desbloqueos y llaves</h2>
   <details><summary>¿Cuántos juegos se abren y cuánto dura cada uno?</summary><p>Cada cuota mensual abona cuatro juegos. Si empiezas desde el principio, la primera abre los juegos 01 a 04. La segunda suma los casos 05 a 08 y la tercera completa los doce con los casos 09 a 12. Calcula unos 60 minutos por caso. Puedes volver al punto guardado desde <a href="/#archivo">Mis partidas</a>.</p></details>
   <details><summary>¿Para qué sirven las llaves?</summary><p>El nuevo pase incluye una llave al contratar y otra en cada renovación confirmada. Los retos de los dos primeros bloques de cada temporada dan una llave. Los del tercer bloque dan dos. En la mansión de Ada hay además seis minijuegos que suman hasta ocho llaves. Cada premio se acredita la primera vez. Una pista orientativa cuesta una llave, una pista detallada dos y la solución explicada tres. En pareja, paga quien pide la pista y ambos pueden leerla. <a href="/#desafios">Explorar Retos extra</a></p></details>
   <details><summary>¿Qué ocurre si me salto un desafío diario o una misión semanal?</summary><p>Tu partida y tus llaves se conservan. Desde el primer caso de Código Valdemar puedes jugar una prueba diaria por una llave y una misión de tres etapas por dos llaves cada semana. Cada edición indica cuándo cierra, en horario de Madrid. <a href="/#desafios">Ver los Retos extra disponibles</a></p></details>
   <details><summary>¿Cómo paso a la siguiente temporada?</summary><p>Al guardar los doce desenlaces de una temporada puedes jugar los bloques ya abonados de la siguiente. Cada cuota nueva se acumula aunque avances más despacio. <a href="/#tableros">Ver las cuatro temporadas en orden</a></p></details>
   <h2>Cobros, privacidad y avisos</h2>
   <details><summary>¿Cómo gestiono o cancelo mi suscripción?</summary><p>En Mi cuenta, abre Cuenta y elige «Gestionar mi suscripción». Puedes cancelar antes del siguiente cobro. Conservas el acceso durante el periodo abonado. Después podrás terminar las temporadas que hayas abonado por completo, en orden. Con la suscripción mensual actual los cobros terminan automáticamente cuando quedan abonados los 48 juegos. Los pases de temporada contratados anteriormente conservan su calendario original. <a href="/#perfil?seccion=cuenta">Ir a Mi cuenta</a></p></details>
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
function presentOffer(number,held,offer,reviewing,focused,signed){
 const access=state.seasonAccess,paid=catalogPaid(access);
 const ready=configStatus==='ready',eligible=!signed||!access||Boolean(offer);
 const open=ready&&config.checkoutAvailable===true;
 const waiting=ready&&!open&&!state.ownAccess&&!paid&&eligible;
 const nextBill=duesRemaining(access,held);
 const qualified=Boolean(signed&&state.ownAccess&&nextBill&&partnerTerms()&&state.partnerOffer?.eligible===true&&state.partnerOffer?.status==='eligible');
 const block=offer?.number===number&&offer.blocks?.length?offer.blocks[0]:Math.max(1,...(held?.paidBlocks||[]));
 const goBack='<a href="/#planes">Volver al pase</a>',help='<a href="/#planes?seccion=preguntas">Preguntas frecuentes</a>';
 const terms=[['Condiciones',config.termsUrl],['Política de privacidad',config.privacyUrl]].filter(([,url])=>typeof url==='string'&&/^https:\/\//i.test(url)).map(([label,url])=>`<a href="${esc(url)}" rel="noopener" target="_blank">${label}</a>`).join(' · ');
 if(focused&&waiting)return `<section class="pase-temporada pase-sencillo"><p class="pase-links">${goBack}</p><article class="pase-ficha"><h1>Aviso de apertura</h1><p>Te escribiremos cuando puedas suscribirte a los cuatro juegos mensuales. Pedir el aviso es gratis.</p><div class="pase-decision">${interest(false)}</div></article></section>`;
 const completedSeason=state.ownAccess&&access?.billingPlan==='season'&&!nextBill;
 const returning=state.ownAccess||paid||(!eligible&&ready);
 let action;
 if(returning){
  action=state.ownAccess?'<a class="button primary" href="/#suscripcion">Gestionar mi suscripción</a>':`<a class="button primary" href="/#${seasonRoutes[number-1]}">Volver a ${seasonNames[number-1]}</a>`;
 }else if(!ready){
  action=configStatus==='error'?'<button type="button" class="button" data-reload-offer>Volver a consultar</button>':'<span role="status">Consultando disponibilidad…</span>';
 }else if(waiting){
  action=`<a class="button primary" href="/#alta-club">${noticeReceipt||state.waitlist?openingAction().label:'Avisarme de la apertura'}</a>`;
 }else{
  action=`<button type="button" class="button primary" data-action="billing-checkout" data-season="${number}" data-plan="four-boards-v1">${reviewing?'Continuar al pago seguro':'Suscribirme'}</button>`;
 }
 const status=paid?'Los 48 juegos están abonados. Los cobros del catálogo han terminado.':completedSeason?'Has abonado los doce juegos. Los cobros de este pase de temporada han terminado.':state.ownAccess?(access?.billingPlan==='season'?'Tu pase de temporada termina cuando abones los tres bloques.':'Cada renovación confirmada abona el siguiente bloque de cuatro juegos.') : !eligible?'Consulta los juegos y bloques disponibles en tu cuenta.':waiting?'La contratación aún está cerrada. Te avisamos por correo cuando abra.':configStatus==='error'?'No hemos podido consultar si la contratación está abierta.':'La primera cuota se cobra al contratar.';
 const detail=paid||completedSeason?'Puedes terminar a tu ritmo las temporadas abonadas, en orden.':state.ownAccess&&access?.billingPlan==='season'?'Puedes cancelar antes del siguiente cobro. Tu pase conserva su calendario original.':'Puedes cancelar antes del siguiente cobro. Si continúas, la suscripción termina automáticamente al abonar los 48 juegos de las cuatro temporadas.';
 const price=returning?'':'<p class="pase-cuota"><strong>'+monthlyPrice()+'</strong> <span>por persona al mes · IVA incluido</span></p>';
 const partner=paid||completedSeason||!partnerTerms()?'':partnerOfferCard(signed,qualified);
 if(focused)return `<section class="pase-temporada pase-sencillo"><p class="pase-links">${goBack}</p><article class="pase-ficha"><h1 id="pass-review-title" tabindex="-1">${reviewing?'Revisa tu suscripción':'Suscripción mensual'}</h1>
    ${price}<p>Cuatro juegos por cuota. El bloque ${block} corresponde a ${seasonNames[number-1]}.</p><p>${status} ${detail}</p>
    <div class="pase-decision">${action}${terms?'<p>'+terms+'</p>':''}</div>${partner}</article><p class="pase-links">${help}</p></section>`;
 const heroImage=number===1?'/mansion-room-1.webp':'/mundo-'+((number-1)*12+1)+'.webp';
 const title=paid?'Tu catálogo está abonado':returning?'Tus juegos de '+seasonNames[number-1]:'Cuatro juegos <em>cada mes</em>';
 return `<section class="pase-temporada" data-season="${number}"><header class="pase-escena pase-resumen">
    <img class="pase-fondo" src="${heroImage}" alt="" width="1536" height="1024" fetchpriority="high">
    <div class="pase-apertura"><p class="pase-supra">Suscripción personal</p><h1>${title}</h1>${price}
    <p class="pase-premisa">${returning?status:'Investiga a solas o en pareja. Cada juego dura unos 60 minutos.'}</p>
    <div class="pase-acciones">${action}${signed?'<a class="pase-muestra" href="/#archivo">Volver a mis partidas</a>':'<a class="pase-muestra" href="/cinta-87.html">Probar la demo de La cinta 87</a>'}</div>
    ${!returning?'<p class="pase-disponibilidad" role="status">'+(configStatus==='loading'?'':status)+'</p>':''}</div></header>
    ${blockGames(number,block)}
    <div class="pase-comparativa">${passMap(number,held)}<section class="pase-condiciones"><h2>Cuotas y renovación</h2><p>${detail}</p>${partner}${terms?'<p>'+terms+'</p>':''}</section></div>
    <p class="pase-links">${help} · <a href="/#casos">Explorar Juegos</a>${!signed?' · <button type="button" class="pase-login" data-action="auth-login">Ya tengo cuenta · Entrar</button>':''}</p></section>`;
}
function plans(){
 const hash=typeof location==='undefined'?'#planes':location.hash;
 const [page,query]=hash.split('?'),params=new URLSearchParams(query||'');
 const help='<a href="/#planes?seccion=preguntas">Preguntas frecuentes</a>';
 const back='<a href="/#planes">Volver al pase</a>';
 const signed=root.GameAccountBridge?.isSignedIn?.()===true;
 if(params.get('gestion')==='aviso')return noticeManagement();
 if(params.get('seccion')==='preguntas')return '<div class="pase-temporada pase-ayuda"><p class="pase-links">'+back+'</p>'+questions()+'</div>';
 if(params.get('checkout')==='complete')return `<section class="pase-temporada pase-sencillo"><article class="pase-ficha" role="status"><h1>${state.ownAccess?'Tu pase está activo':'Estamos comprobando tu pase'}</h1><p>${state.ownAccess?'Tu pago está confirmado. En tu perfil puedes ver los juegos que ya puedes abrir.':'Tus juegos aparecerán en el perfil cuando se confirme el pago.'}</p><a class="button primary" href="/#perfil">Abrir mi perfil</a></article></section>`;
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
 const requested=params.get('revisar');
 const reviewing=Boolean(requested && signed && config.checkoutAvailable && offer?.number===Number(requested) && !state.ownAccess);
 const focused=page==='#alta-club'||reviewing;
 return presentOffer(number,held,offer,reviewing,focused,signed);
}
root.ClubAccess={...old,plans,enrollment:plans,gate(){
 const signed=root.GameAccountBridge?.isSignedIn?.()===true;
 const action=configStatus==='ready'&&!config.checkoutAvailable?'Ver el pase y pedir el aviso':'Ver la suscripción mensual';
 return '<section class="pase-temporada pase-acceso"><div class="pase-ficha"><h1>Este juego forma parte de la suscripción</h1><p>Cuatro juegos por '+monthlyPrice()+' por persona al mes, IVA incluido. Cada temporada reúne doce juegos.</p><div class="pase-acciones"><a class="button primary" href="/#planes">'+action+'</a>'+(signed?'<a class="button" href="/#archivo">Ver mis partidas</a>':'<button type="button" class="button" data-action="auth-login">Ya tengo cuenta · Entrar</button>')+'<a href="/cinta-87.html">Jugar la demo gratuita</a></div></div></section>';
},banner(){
 if(state.role!=='admin')return '';
 const page=typeof location==='undefined'?'':location.hash.split('?')[0];
 if(['#planes','#alta-club','#suscripcion','#gestion'].includes(page))return '';
 return '<aside class="paid-banner" aria-label="Acceso editorial"><span class="paid-dot" aria-hidden="true"></span><p><strong>Acceso editorial</strong> · 48 aventuras disponibles.</p></aside>';
},get salesState(){return configStatus==='ready'?(config.checkoutAvailable?'open':'waitlist'):'unknown';},get price(){return monthlyPrice();},get checkoutAvailable(){return config.checkoutAvailable===true;},get canPlay(){return state.canPlay===true;},get state(){return state;},set(value){state=value||{canPlay:false};},account(standalone=false){
 if(state.role==='admin') return adminCard();
 const access=state.seasonAccess;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length && s.previousReady!==false).at(-1);
 const next=access?.nextPurchase;
 const canFinish=current?.finishAccess && current.completed<12;
 const title=catalogPaid(access)?'Catálogo abonado':current?.finishAccess&&current.completed===12?'Temporada completada':state.ownAccess?'Tu temporada está activa':canFinish?'Tu temporada está pendiente de terminar':current?'Tu pase está en pausa':'Cuenta gratuita';
 const progress=(access?.seasons||[]).filter(s=>s.paidBlocks.length).map(s=>{
   const name=seasonNames[s.number-1];
   const paid=s.finishAccess?'Temporada abonada':s.paidBlocks.length+' de 3 bloques abonados';
   if(s.previousReady===false)return '<p><strong>'+name+'</strong> · '+paid+' · Termina la temporada anterior para acceder.</p>';
   return '<p><strong>'+name+'</strong> · '+paid+' · '+s.completed+' de 12 juegos terminados.</p><a class="button" href="#'+seasonRoutes[s.number-1]+'">Volver a '+name+'</a>';
 }).join('');
 const noticeLink='<p><a href="/#planes?gestion=aviso">Gestionar avisos de apertura</a> · <a href="/privacidad.html">Privacidad y datos</a></p>';
 const nextLink=!state.ownAccess&&next?'<a class="button" href="#planes">Ver la suscripción mensual</a>':'';
 const period=state.periodEnd?'<p>Periodo abonado hasta el '+new Date(state.periodEnd).toLocaleDateString('es-ES')+'.</p>':'';
 const billing=state.hasCustomer?'<button class="button" data-action="billing-portal">Gestionar mi suscripción</button>':'';
 const subtitle=standalone?'':'<span class="club-kicker">Mi suscripción</span>';
 const personalOffer=standalone&&state.ownAccess&&duesRemaining(access,current)&&partnerTerms()&&state.partnerOffer?.eligible===true&&state.partnerOffer?.status==='eligible'?partnerOfferCard(true,true):'';
 const action=!current&&!billing&&!nextLink?'<a class="button" href="/#planes">Ver plan y disponibilidad</a>':'';
 return '<section class="account-card">'+subtitle+'<h2>'+title+'</h2>'+(catalogPaid(access)?'<p>Las doce cuotas están cubiertas. Puedes seguir jugando sin nuevas renovaciones.</p>':'')+progress+period+personalOffer+billing+nextLink+action+noticeLink+'</section>';
}};
fetch('/api/billing/config',{cache:'no-store'}).then(async response=>{
 if(!response.ok)throw Error('config');
 const value=await response.json();
 if(typeof value.checkoutAvailable!=='boolean')throw Error('config');
 config=value;configStatus='ready';
}).catch(()=>{configStatus='error';}).finally(()=>root.GameAccountBridge?.render());
})(globalThis);
