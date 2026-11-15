(function(root){
'use strict';
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]'),action=button?.dataset.action;
 if(!['waitlist','billing-checkout','billing-portal','season-ending'].includes(action))return;
 const bridge=root.GameAccountBridge;if(!bridge.isSignedIn()){root.AccountUI.open();bridge.toast('Inicia sesión y vuelve a pulsar para confirmar tu solicitud.');return;}
 if(button.disabled)return;button.disabled=true;
 try{
  if(action==='waitlist'){await bridge.request('/api/waitlist',{enabled:button.dataset.enabled==='true'},'PUT');await bridge.refresh();bridge.toast(button.dataset.enabled==='true'?'Solicitud de aviso guardada. No se ha realizado ningún cobro.':'Solicitud retirada.');}
  if(action==='season-ending'){const r=await bridge.request('/api/season/ending',{choice:button.dataset.choice});bridge.applyJourney(r.journey);bridge.toast('Tu decisión final está guardada.');}
  if(action==='billing-checkout'||action==='billing-portal'){
   const path=action==='billing-portal'||root.ClubAccess.state.ownAccess?'portal':'checkout';
   const r=await bridge.request('/api/billing/'+path,{}),url=new URL(r.url);
   if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('No se ha podido abrir el pago seguro.');
   location.assign(url.href);
  }
 }catch(error){bridge.toast(error.message);button.disabled=false;}
});
// A payment return never grants access: refresh server-verified membership.
root.addEventListener('hashchange',()=>{if(location.hash.includes('checkout=complete')&&root.GameAccountBridge.isSignedIn())root.GameAccountBridge.refresh().catch(e=>root.GameAccountBridge.toast(e.message));});
})(globalThis);
