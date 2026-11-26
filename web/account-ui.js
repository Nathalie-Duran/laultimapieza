(function(root){
  'use strict';
  let bridge,authMode='login',sequence=0,unsubscribe,lastIdentity;
  let authStatus='loading';
  const A=()=>root.AccountAccess;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const action=(label,name,primary=false)=>`<button type="button" class="button${primary?' primary':''}" data-action="${name}">${label}</button>`;
  function error(message){const box=document.querySelector('#auth-error');if(box)box.textContent=message;else bridge.toast(message);}
  function verification(){
    bridge.modal(`<span class="eyebrow sage">UN ÚLTIMO PASO</span><h2 id="modal-title">Confirma tu correo.</h2><p>Abre el enlace de verificación que te hemos enviado a <span class="auth-email">${esc(A().user?.email)}</span>. Después vuelve aquí para continuar.</p><p class="micro">Si no lo encuentras, revisa la carpeta de correo no deseado.</p><div class="account-actions">${action('Ya he confirmado el correo','auth-check',true)}${action('Reenviar correo','auth-resend')}</div><p id="auth-error" class="auth-error" role="alert"></p><div class="auth-links">${action('Cerrar sesión','auth-logout')}</div>`);
  }
  function open(mode='login'){
    if(!bridge)return;
    if(authStatus==='loading'){
      bridge.modal('<h2 id="modal-title">Abriendo tu cuenta…</h2><p role="status" data-auth-loading>Conectando con el servicio de acceso.</p>');
      const pending=document.querySelector('#modal [data-auth-loading]');
      A().ready.catch(()=>{}).then(()=>{if(pending?.isConnected&&pending.closest('dialog')?.open)open(mode);});
      return;
    }
    if(authStatus!=='ready'){
      const message=authStatus==='error'?'No se ha podido conectar con el servicio de cuentas.':'El acceso con cuenta está desactivado en este momento.';
      bridge.modal('<h2 id="modal-title">Acceso a tu cuenta</h2><p>'+message+'</p>'+(authStatus==='error'?action('Reintentar conexión','auth-reload',true):'<a class="button" href="#casos">Explorar los casos</a>'));
      return;
    }
    if(A().user&&!A().user.emailVerified){verification();return;}
    authMode=mode;const register=mode==='register',reset=mode==='reset';
    bridge.modal(`<span class="eyebrow sage">TU HISTORIA CONTINÚA</span><h2 id="modal-title">${reset?'Recupera tu contraseña.':register?'Crea tu cuenta.':'Vuelve a tu historia.'}</h2><p>${reset?'Te enviaremos un enlace para elegir una nueva contraseña.':register?'Crear tu cuenta es gratis. Para jugar los casos completos necesitarás además una suscripción de pago.':'Entra para recuperar tus partidas, finales y habilidades.'}</p>${!reset?`<button type="button" class="button auth-provider" data-action="auth-google"><span aria-hidden="true">G</span> Continuar con Google</button><div class="auth-divider">o con tu correo electrónico</div>`:''}<form id="account-form" class="auth-form" data-mode="${mode}">${register?'<label class="field">Nombre o alias<input name="name" required minlength="2" maxlength="32" autocomplete="nickname" placeholder="Tu nombre de investigador"></label>':''}<label class="field">Correo electrónico<input name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="tu@correo.com"></label>${!reset?`<label class="field">Contraseña<span class="auth-password"><input id="account-password" name="password" type="password" required ${register?'minlength="12"':''} maxlength="128" autocomplete="${register?'new-password':'current-password'}" ${register?'aria-describedby="password-help"':''}><button type="button" class="text-button" data-action="auth-show-password" aria-controls="account-password" aria-pressed="false">Mostrar</button></span></label>${register?'<p class="micro" id="password-help">Al menos 12 caracteres. Puedes usar una frase fácil de recordar.</p>':''}<label class="auth-remember"><input name="remember" type="checkbox">Recordarme en este dispositivo personal</label>`:''}<div id="auth-error" class="auth-error" role="alert"></div><button class="button primary wide" type="submit">${reset?'Enviar enlace':register?'Crear mi cuenta':'Iniciar sesión'}</button></form><div class="auth-links">${reset?action('Volver a iniciar sesión','auth-login'):register?action('Ya tengo cuenta','auth-login'):action('Crear una cuenta','auth-register')}${!reset&&!register?action('He olvidado mi contraseña','auth-reset'):''}</div><p class="auth-privacy">Google gestiona la autenticación. La última pieza guarda tu perfil y tus partidas vinculados a tu cuenta. La opción «Recordarme» mantiene el acceso en este dispositivo.</p>`);
  }
  async function changed(user,force=false){
    const identity=user?user.uid+':'+user.emailVerified:'signed-out';
    if(!force&&identity===lastIdentity)return;lastIdentity=identity;
    const run=++sequence;
    bridge.reset();
    if(!user){bridge.render();return;}
    if(!user.emailVerified){bridge.render();verification();return;}
    bridge.loading(true);
    try{await bridge.load();if(run!==sequence)return;bridge.loading(false);bridge.close();bridge.render();bridge.continueSetup();}
    catch(e){if(run!==sequence)return;bridge.loading(false);bridge.render();bridge.toast(e.message);}
  }
  async function logout(){
    ++sequence;lastIdentity=undefined;bridge.reset();bridge.cancelSetup();bridge.close();location.hash='inicio';bridge.render();
    try{await A().logout();bridge.toast('Has cerrado sesión. Tus partidas siguen guardadas en tu cuenta.');}
    catch{bridge.toast('No se pudo cerrar el acceso. Vuelve a pulsar «Cerrar sesión».');}
  }
  function signInPanel(){
    if(A().user&&!A().user.emailVerified)return `<section class="account-card"><span class="eyebrow sage">TU CUENTA</span><h1>Confirma tu correo.</h1><p>Verifica ${esc(A().user.email)} para empezar a guardar tus partidas.</p><div class="account-actions">${action('Comprobar verificación','auth-check',true)}${action('Reenviar correo','auth-resend')}${action('Cerrar sesión','auth-logout')}</div></section>`;
    if(A().user)return `<section class="account-card"><h1>Recuperemos tus partidas.</h1><p>No hemos podido cargar tu cuenta. Tu progreso guardado se conserva.</p><div class="account-actions">${action('Volver a conectar','auth-retry',true)}${action('Cerrar sesión','auth-logout')}</div></section>`;
    return `<section class="account-card"><span class="eyebrow sage">TUS DECISIONES, CONTIGO</span><h1>Tu próxima historia<br><em>empieza aquí.</em></h1><p>Inicia sesión para consultar tu perfil y tu progreso. Jugar los casos completos requiere además una suscripción de pago.</p><div class="account-actions">${action('Iniciar sesión','auth-login',true)}${action('Crear cuenta','auth-register')}</div></section>`;
  }
  function localArchive(){try{const value=JSON.parse(localStorage.getItem('ultima-pieza-v2')||'null');return value&&Array.isArray(value.profiles)&&Array.isArray(value.sessions)?value:null;}catch{return null;}}
  function accountCard(){const local=localArchive();return `<section class="account-card"><span class="eyebrow sage">TU CUENTA</span><p class="auth-email">${esc(A().user?.email||'')}</p><p>Tu perfil y tu progreso guardado se conservan.</p><div class="account-actions">${local?.sessions.length?action('Recuperar partidas de este navegador','auth-import'):''}${action('Cerrar sesión','auth-logout')}</div></section>`;}
  function header(){return A().user?action('Cerrar sesión','auth-logout'):action('Iniciar sesión','auth-login');}
  async function start(value){
    bridge=value;
    try{const active=await A().ready;authStatus=active?'ready':'disabled';bridge.cloud(active);bridge.loading(false);if(active){unsubscribe=A().subscribe(changed);}else bridge.render();}
    catch{authStatus='error';bridge.cloud(true);bridge.loading(false);bridge.reset();bridge.render();bridge.toast('No hemos podido conectar con el servicio de cuentas. Recarga la página para volver a intentarlo.');}
  }
  document.addEventListener('submit',async event=>{
    if(event.target.id==='import-local-form'){
      event.preventDefault();const form=event.target,submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
      const uid=String(new FormData(form).get('profile')),local=localArchive(),sessions=(local?.sessions||[]).filter(s=>s.members?.some(m=>m.userId===uid)),accountId=A().user?.uid,run=sequence;let count=0;
      try{for(const session of sessions){if(run!==sequence||!accountId||A().user?.uid!==accountId)return;await bridge.importLocal(session,uid);count++;}if(run!==sequence)return;bridge.close();bridge.render();bridge.toast(`${count} partidas recuperadas en tu cuenta.`);}catch(e){error(`${count} partidas recuperadas. ${e.message} Puedes reintentar sin duplicarlas.`);}finally{submit.disabled=false;}return;
    }
    if(event.target.id!=='account-form')return;
    event.preventDefault();const form=event.target,submit=form.querySelector('[type="submit"]');if(submit.disabled)return;
    submit.disabled=true;const values=new FormData(form);error('');
    try{
      const email=String(values.get('email')||'').trim(),password=String(values.get('password')||''),remember=values.get('remember')==='on';
      if(form.dataset.mode==='reset'){
        await A().reset(email);bridge.modal(`<h2 id="modal-title">Revisa tu correo.</h2><p>Si existe una cuenta asociada a esa dirección, recibirás un enlace para restablecer la contraseña.</p>${action('Volver a iniciar sesión','auth-login',true)}`);
      }else if(form.dataset.mode==='register'){
        const name=String(values.get('name')||'').trim();if(name.length<2||name.length>32)throw new Error('Escribe un nombre de entre 2 y 32 caracteres.');
        await A().register(name,email,password,remember);verification();
      }else await A().login(email,password,remember);
    }catch(e){error(A().error(e));}finally{submit.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const control=event.target.closest('[data-action]'),name=control?.dataset.action;if(!name?.startsWith('auth-'))return;
    event.preventDefault();if(control.disabled)return;
    if(['auth-login','auth-register','auth-reset'].includes(name)){open(name.slice(5));return;}
    if(name==='auth-reload'){root.location.reload();return;}
    if(name==='auth-show-password'){const input=document.querySelector('#account-password');if(input){input.type=input.type==='password'?'text':'password';control.textContent=input.type==='text'?'Ocultar':'Mostrar';control.setAttribute('aria-pressed',String(input.type==='text'));}return;}
    control.disabled=true;error('');
    try{
      if(name==='auth-logout')await logout();
      if(name==='auth-google')await A().google(!!document.querySelector('[name="remember"]')?.checked);
      if(name==='auth-resend'){await A().resend();error('Correo enviado. Revisa también la carpeta de correo no deseado.');}
      if(name==='auth-check'){const user=await A().refresh();if(user.emailVerified)await changed(user,true);else error('El correo aún no está confirmado. Abre el enlace y vuelve a comprobarlo.');}
      if(name==='auth-retry')await changed(A().user,true);
      if(name==='auth-import'){
        const local=localArchive();if(!local?.profiles.length)throw new Error('No hay perfiles locales para recuperar.');
        bridge.modal(`<h2 id="modal-title">Recupera tu recorrido.</h2><p>Elige tu antiguo perfil de este navegador. Guardaremos una copia individual de sus partidas en tu cuenta. Las partidas compartidas en este dispositivo se convertirán en partidas en solitario.</p><p class="micro">Se conserva el recorrido y se recalculan los puntos con las reglas actuales. El original seguirá en este navegador. Recuperarlas otra vez no las duplica.</p><form id="import-local-form" class="auth-form"><label class="field">Tu antiguo perfil<select name="profile" required>${local.profiles.map(p=>`<option value="${esc(p.userId)}">${esc(p.name)}</option>`).join('')}</select></label><p id="auth-error" class="auth-error" role="alert"></p><button type="submit" class="button primary">Guardar una copia en mi cuenta</button></form>`);
      }
    }catch(e){error(A().error(e));}finally{control.disabled=false;}
  });
  // Back/forward-cache restoration must reconcile the currently signed-in account.
  window.addEventListener('pageshow',event=>{if(event.persisted&&bridge?.isCloud())changed(A().user,true);});
  root.AccountUI={start,open,signInPanel,accountCard,header,expired:logout};
})(window);
