(function(root){
'use strict';
let state={canPlay:false,checkoutAvailable:false},config={checkoutAvailable:false};
const old=root.ClubAccess,esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const noticeKey='lup-opening-notice-v1';
let noticeReceipt='';
try{noticeReceipt=localStorage.getItem(noticeKey)||'';}catch{}
function interest(){
 if(state.waitlist)return '<section class="waiting-interest"><h3>Ya estás en la lista de apertura</h3><p>Te avisaremos por correo cuando se abra la temporada.</p><button class="button" data-action="waitlist" data-enabled="false">Retirar el aviso de mi cuenta</button></section>';
 if(noticeReceipt)return '<section class="waiting-interest"><h3>Ya has pedido el aviso</h3><p>Cuando abra la temporada recibirás un correo. Entonces podrás decidir si te suscribes.</p><form class="postal-list-form" data-notice="remove"><button class="button" type="submit">Retirar mi solicitud</button><p role="status"></p></form></section>';
 return `<section class="waiting-interest">
   <h3>¿Te avisamos cuando abra?</h3>
   <form class="postal-list-form" data-notice="join">
     <label>Tu correo electrónico<input type="email" name="email" maxlength="254" autocomplete="email" placeholder="tu@correo.es" required></label>
     <label class="notice-consent"><input type="checkbox" name="consent" required> <span>Quiero recibir un correo cuando abra la temporada.</span></label>
     <button class="button primary" type="submit">Avisarme de la apertura</button>
     <p class="micro">Aviso gratuito, sin cuenta ni tarjeta. Puedes retirarlo desde este navegador.</p>
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
   const section=form.closest('.waiting-interest');section.outerHTML=interest();
   const next=document.querySelector('.waiting-interest h3');if(next){next.tabIndex=-1;next.focus();}
 }catch(error){status.textContent=error.message||'No hay conexión. Vuelve a intentarlo.';button.disabled=false;}
});
const seasonNames=['Valdemar','El Tablero de Ámbar','Umbravía'];
const seasonRoutes=['casos','expedicion','umbravia'];
function adminCard(){return '<section class="account-card"><span class="club-kicker">ADMINISTRADORA</span><h2>Tu acceso editorial</h2><p>Puedes probar los 36 juegos de las tres temporadas y consultar el archivo clásico.</p>'+root.Colecciones.menu('')+'</section>';}
function plans(){
 if(state.role==='admin')return adminCard();
 const access=state.seasonAccess;
 const offer=access?.nextPurchase;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length).at(-1);
 const number=(state.ownAccess && current ? current.number : offer?.number)||current?.number||1;
 const held=current?.number===number ? current : null;
 const route=seasonRoutes[number-1],name=seasonNames[number-1];
 const checkout=state.ownAccess
   ? '<button class="button primary wide" data-action="billing-portal">Gestionar mi suscripción</button>'
   : (!access||offer)
     ? `<button class="button primary wide" data-action="billing-checkout" data-season="${number}">Contratar el pase de ${name} · 29,95 €/mes</button>`
     : `<a class="button primary wide" href="#${route}">Volver a ${name}</a>`;
 const terms=`<p><a href="${esc(config.termsUrl)}" rel="noopener" target="_blank">Condiciones</a> · <a href="${esc(config.privacyUrl)}" rel="noopener" target="_blank">Privacidad</a></p>`;
 const action=config.checkoutAvailable?checkout+terms:held?.finishAccess?'<a class="button primary wide" href="#'+route+'">Volver a '+name+'</a>':interest();
 const cycles=offer?.number===number ? offer.remainingCycles : held ? 3-held.paidBlocks.length : 3;
 const costText=cycles===0 ? 'Has abonado los tres bloques de esta temporada.' :
   cycles===3 ? 'Temporada completa de 12 juegos por 89,85 € en tres pagos.' :
   cycles===1 ? 'Queda un bloque de 29,95 € para completar esta temporada.' :
   'Quedan dos bloques de 29,95 €, 59,90 € en total, para completar esta temporada.';
 const firstMonth=number===1?root.ValdemarCatalog.items.slice(0,4):(root.MundosCatalogo||[]).filter(s=>s.world===route).slice(0,4);
 const destination=s=>number===1?'/valdemar/'+String(s.id).padStart(2,'0')+'/':'/#'+route+'?lugar='+((s.id-1)%12+1);
 return `<section class="club-plans season-offer">
   <header>
     <p class="cover-caption">Temporada 0${number} · ${name}</p>
     <h1>Cuatro misterios al mes.</h1>
     <p class="season-intro">Empieza en Valdemar. Tras resolver sus doce juegos podrás seguir en El Tablero de Ámbar. Cuando completes esa expedición, se abrirá el camino a Umbravía.</p>
     ${current?.finishAccess && current.completed===12 && number>current.number ? '<p>Has completado '+seasonNames[current.number-1]+'. Su pase ya está abonado. Puedes volver a <a href="#'+seasonRoutes[current.number-1]+'">tus doce juegos</a> o contratar esta nueva temporada.</p>' : ''}
   </header>
   <div class="club-plan-grid">
     <article class="club-plan season-pass">
       <h2>El pase de ${name}</h2>
       <p class="club-price"><strong>29,95 €</strong><span>/ mes</span></p>
       <p class="club-small offer-availability">${config.checkoutAvailable||held?'IVA incluido.':'Precio previsto, IVA incluido. La suscripción abrirá próximamente.'}</p>
       <p class="pass-benefit"><strong>Cuatro historias con cada pago mensual.</strong> Comparte la pantalla o juega a solas. Investiga audios, imágenes, documentos y archivos web, con un reto paralelo en cada historia.</p>
       <p class="postal-terms">${costText} ${cycles?'Puedes cancelar antes de la próxima renovación.':held?.finishAccess?'Puedes volver a los doce juegos desde tu cuenta.':'Cuando termines la temporada anterior se abrirán los juegos de este pase.'}</p>
       <p>Recibes una única llave de bienvenida con tu primer pase. Cada reto superado por primera vez da otra llave. Una llave abre un sobre con dos ayudas.</p>
       ${action}
     </article>
     <div class="club-plan-aside">
       <article class="plan-cases">
         <h2>El primer bloque de ${name}</h2>
         <ul>${firstMonth.map(s=>`<li><a href="${destination(s)}"><img src="${esc(s.image||'/mundo-'+s.id+'.webp')}" width="74" height="50" loading="lazy" alt=""><span>${esc(s.title)}</span></a></li>`).join('')}</ul>
         <a class="text-link" href="#${route}">Explorar los 12 juegos</a>
       </article>
       <div class="plan-faq">
         <details><summary>¿Cómo se abren los juegos?</summary><p>Cada cuota mensual abre cuatro juegos de la misma temporada. Una temporada tiene tres bloques. Para acceder a la siguiente debes guardar el desenlace de los doce juegos y contratar su pase.</p></details>
         <details><summary>¿Y si me falta un juego al terminar el pase?</summary><p>Si ya abonaste los tres bloques, puedes terminar los juegos pendientes de esa temporada. Tú decides cuándo contratar la siguiente. Si cancelas antes del tercer bloque, podrás jugar hasta el final del periodo pagado y retomar los bloques pendientes más adelante.</p></details>
       </div>
       <button class="button plan-demo" data-action="preview-open">Jugar gratis a Clínica Vallejo</button>
     </div>
   </div>
 </section>`;
}
root.ClubAccess={...old,plans,enrollment:plans,banner(){return state.role==='admin'?'<aside class="paid-banner" aria-label="Acceso de administradora"><span class="paid-dot" aria-hidden="true"></span><p><strong>Administradora: todos los retos disponibles.</strong> Sin suscripci&oacute;n ni cobros.</p><a href="'+(state.canManage===true?'#gestion':'#casos')+'">'+(state.canManage===true?'Abrir gestión':'Explorar retos')+'</a></aside>':old.banner();},get checkoutAvailable(){return config.checkoutAvailable===true;},get canPlay(){return state.canPlay===true;},get state(){return state;},set(value){state=value||{canPlay:false};},account(){
 if(state.role==='admin') return adminCard();
 const access=state.seasonAccess;
 const current=access?.seasons?.filter(s=>s.paidBlocks.length).at(-1);
 const next=access?.nextPurchase;
 const canFinish=current?.finishAccess && current.completed<12;
 const title=current?.finishAccess&&current.completed===12?'Temporada completada':state.ownAccess?'Tu temporada está activa':canFinish?'Tu temporada está pendiente de terminar':current?'Tu pase está en pausa':state.canPlay?'Acceso como invitado':'Sin suscripción activa';
 const progress=(access?.seasons||[]).filter(s=>s.paidBlocks.length).map(s=>{
   const name=seasonNames[s.number-1];
   const paid=s.finishAccess?'Pase abonado':s.paidBlocks.length+' de 3 bloques abonados';
   return '<p><strong>'+name+'</strong> · '+paid+' · '+s.completed+' de 12 juegos terminados.</p><a class="button" href="#'+seasonRoutes[s.number-1]+'">Volver a '+name+'</a>';
 }).join('');
 const nextLink=!state.ownAccess&&next?'<a class="button" href="#planes">Ver el pase de '+seasonNames[next.number-1]+'</a>':'';
 const period=state.periodEnd?'<p>Periodo abonado hasta el '+new Date(state.periodEnd).toLocaleDateString('es-ES')+'.</p>':'';
 const billing=state.hasCustomer?'<button class="button" data-action="billing-portal">Gestionar mi suscripción</button>':'';
 return '<section class="account-card"><span class="club-kicker">MI SUSCRIPCIÓN</span><h2>'+title+'</h2>'+progress+period+billing+nextLink+(!billing&&!nextLink&&!current?'<a class="button" href="#planes">Ver plan y disponibilidad</a>':'')+(!config.checkoutAvailable&&!current?interest():'')+(!config.checkoutAvailable&&!state.waitlist&&!current?'<button class="text-link" data-action="waitlist" data-enabled="false">Retirar los avisos asociados a mi correo verificado</button>':'')+'</section>';
}};
fetch('/api/billing/config',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>{config=c;if(root.GameAccountBridge)root.GameAccountBridge.render();}).catch(()=>{});
})(globalThis);
