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
function adminCard(){return '<section class="account-card"><span class="club-kicker">ADMINISTRADORA</span><h2>Acceso completo, sin suscripción.</h2><p>Los doce retos y La habitación 309 están disponibles desde ahora. Puedes repetirlos y guardar tu avance, sin esperar desbloqueos ni realizar pagos.</p><a class="button primary" href="#casos">Explorar todos los retos</a><a class="button" href="#mapa">Ver mi plano</a></section>';}
function plans(){
 if(state.role==='admin')return adminCard();
 const action=config.checkoutAvailable?`<button class="button primary wide" data-action="${state.hasCustomer&&state.ownAccess?'billing-portal':'billing-checkout'}">${state.ownAccess?'Gestionar mi suscripción':'Empezar el primer mes por 29,95 €'}</button><p><a href="${esc(config.termsUrl)}" rel="noopener" target="_blank">Condiciones</a> · <a href="${esc(config.privacyUrl)}" rel="noopener" target="_blank">Privacidad</a></p>`:interest();
 const firstMonth=(root.STORIES||[]).filter(s=>s.season===1&&s.episode>=1&&s.episode<=4).sort((a,b)=>a.episode-b.episode);
 return `<section class="club-plans season-offer">
   <header>
     <p class="cover-caption">Temporada 01 · Valdemar</p>
     <h1>Cuatro misterios al mes.</h1>
     <p class="season-intro">Una carta escondida, un ensayo que sale mal, un recuerdo borrado y un faro en silencio. ¿Por dónde empezarías?</p>
   </header>
   <div class="club-plan-grid">
     <article class="club-plan season-pass">
       <h2>El pase de Valdemar</h2>
       <p class="club-price"><strong>29,95 €</strong><span>/ mes</span></p>
       <p class="club-small offer-availability">${config.checkoutAvailable?'IVA incluido.':'Precio previsto, IVA incluido. La suscripción abrirá próximamente.'}</p>
       <p class="pass-benefit"><strong>4 casos con cada pago mensual.</strong> Elige el orden y juega a solas o con una persona invitada por partida.</p>
       <p class="postal-terms">Temporada completa de 12 casos por 89,85 € en tres pagos. Puedes cancelar antes de la próxima renovación.</p>
       ${action}
     </article>
     <div class="club-plan-aside">
       <article class="plan-cases">
         <h2>Tu primer mes en Valdemar</h2>
         <ul>${firstMonth.map(s=>`<li><a href="/caso/${encodeURIComponent(s.id)}/"><img src="/${encodeURIComponent(s.id)}.jpg" width="74" height="50" loading="lazy" alt=""><span>${esc(s.title)}</span></a></li>`).join('')}</ul>
         <a class="text-link" href="#casos">Explorar los 12 casos</a>
       </article>
       <div class="plan-faq">
         <details><summary>¿Cómo se abren los casos?</summary><p>Con cada pago se abren cuatro casos de golpe. Los anteriores siguen disponibles mientras tengas acceso activo. La temporada termina tras el tercer pago. Al reunir las doce piezas descubrirás el epílogo.</p></details>
         <details><summary>¿Qué pasa con mis partidas si cancelo?</summary><p>Puedes jugar hasta el final del periodo pagado. Guardamos tus partidas y las piezas que hayas reunido. Para continuar un caso completo necesitas acceso activo.</p></details>
       </div>
       <button class="button plan-demo" data-action="preview-open">Jugar gratis a Clínica Vallejo</button>
     </div>
   </div>
 </section>`;
}
root.ClubAccess={...old,plans,enrollment:plans,banner(){return state.role==='admin'?'<aside class="paid-banner" aria-label="Acceso de administradora"><span class="paid-dot" aria-hidden="true"></span><p><strong>Administradora: todos los retos disponibles.</strong> Sin suscripci&oacute;n ni cobros.</p><a href="'+(state.canManage===true?'#gestion':'#casos')+'">'+(state.canManage===true?'Abrir gestión':'Explorar retos')+'</a></aside>':old.banner();},get checkoutAvailable(){return config.checkoutAvailable===true;},get canPlay(){return state.canPlay===true;},get state(){return state;},set(value){state=value||{canPlay:false};},account(){if(state.role==='admin')return adminCard();return `<section class="account-card"><span class="club-kicker">MI SUSCRIPCIÓN</span><h2>${state.ownAccess?'Tu temporada está activa':state.canPlay?'Acceso como invitado':'Sin suscripción activa'}</h2>${state.periodEnd?`<p>Acceso pagado hasta el ${new Date(state.periodEnd).toLocaleDateString('es-ES')}.</p>`:''}${state.hasCustomer?'<button class="button" data-action="billing-portal">Gestionar o cancelar mi suscripción</button>':'<a class="button" href="#planes">Ver plan y disponibilidad</a>'}${!config.checkoutAvailable?interest():''}${!config.checkoutAvailable&&!state.waitlist?'<button class="text-link" data-action="waitlist" data-enabled="false">Retirar los avisos asociados a mi correo verificado</button>':''}</section>`;}};
fetch('/api/billing/config',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>{config=c;if(root.GameAccountBridge)root.GameAccountBridge.render();}).catch(()=>{});
})(globalThis);
