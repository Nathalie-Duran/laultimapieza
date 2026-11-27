(function(root){
'use strict';
(function bindInvitationActions(root){const arrived=(!!document.body.dataset.featuredCase||document.body.dataset.vallejoStandalone==='true')&&new URLSearchParams(location.search).get('via')==='invitacion';const sent=new Set();let allowed=false;function count(event){if(!arrived||!allowed||sent.has(event))return;sent.add(event);fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,consent:true}),keepalive:true}).then(r=>{if(!r.ok)sent.delete(event)}).catch(()=>sent.delete(event));}root.InvitationCounts={get enabled(){return arrived&&allowed;},setConsent(value){allowed=value;if(allowed)count('ref_visit');},start(){count('ref_demo');}};document.addEventListener('change',event=>{if(event.target.matches('[data-invite-counts]'))root.InvitationCounts.setConsent(event.target.checked);});document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy-invite]');if(!button)return;const status=button.closest('.case-share').querySelector('[role=status]');try{await navigator.clipboard.writeText(button.dataset.copyInvite);status.textContent='Enlace copiado. Ya puedes enviarlo.';}catch{const field=document.createElement('input');field.readOnly=true;field.value=button.dataset.copyInvite;field.setAttribute('aria-label','Enlace público para compartir');status.replaceChildren(document.createTextNode('Copia este enlace para compartir la página. '),field);field.focus();field.select();}});})(root);
if(document.body.dataset.vallejoStandalone==='true')return;
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]'),action=button?.dataset.action;
 if(!['waitlist','billing-checkout','billing-portal','season-ending'].includes(action))return;
 const bridge=root.GameAccountBridge;
 if(!bridge.isSignedIn()){
   if(action==='billing-checkout'){
     const season=Number(button.dataset.season);
     if(!root.ClubAccess.checkoutAvailable||![1,2,3,4].includes(season))return;
     history.replaceState(history.state,'','#planes?revisar='+season);
     root.AccountUI.open();
     bridge.toast('Entra en tu cuenta para revisar tu pase.');
   }else{
     root.AccountUI.open();
     bridge.toast('Inicia sesión para continuar.');
   }
   return;
 }
 if(button.disabled)return;button.disabled=true;
 try{
  if(action==='waitlist'){await bridge.request('/api/waitlist',{enabled:button.dataset.enabled==='true'},'PUT');await bridge.refresh();bridge.toast(button.dataset.enabled==='true'?'Solicitud de aviso guardada. No se ha realizado ningún cobro.':'Solicitud retirada.');}
  if(action==='season-ending'){const r=await bridge.request('/api/season/ending',{choice:button.dataset.choice});bridge.applyJourney(r.journey);bridge.toast('Tu decisión final está guardada.');}
  if(action==='billing-checkout'||action==='billing-portal'){
   const path=action==='billing-portal'||root.ClubAccess.state.ownAccess?'portal':'checkout';
   const season=Number(button.dataset.season);
   const payload=path==='checkout'&&[1,2,3,4].includes(season)?{season}:{};
   if(path==='checkout' && button.dataset.plan==='four-boards-v1')payload.plan=button.dataset.plan;
   const r=await bridge.request('/api/billing/'+path,payload),url=new URL(r.url);
   if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('No se ha podido abrir el pago seguro.');
   location.assign(url.href);
  }
 }catch(error){bridge.toast(error.message);button.disabled=false;}
});
// A payment return never grants access: refresh server-verified membership.
root.addEventListener('hashchange',()=>{if(location.hash.includes('checkout=complete')&&root.GameAccountBridge.isSignedIn())root.GameAccountBridge.refresh().catch(e=>root.GameAccountBridge.toast(e.message));});
})(globalThis);
