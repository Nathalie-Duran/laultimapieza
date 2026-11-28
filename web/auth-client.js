(function(root){
  'use strict';
  let sdk,auth,settings,enabled=false;
  const messages={
    'auth/invalid-credential':'El correo o la contraseña no son correctos.',
    'auth/invalid-login-credentials':'El correo o la contraseña no son correctos.',
    'auth/user-not-found':'El correo o la contraseña no son correctos.',
    'auth/wrong-password':'El correo o la contraseña no son correctos.',
    'auth/invalid-email':'Introduce un correo electrónico válido.',
    'auth/email-already-in-use':'No se pudo crear la cuenta. Si ya tienes una, inicia sesión o recupera tu contraseña.',
    'auth/weak-password':'Elige una contraseña de al menos 12 caracteres.',
    'auth/password-does-not-meet-requirements':'La contraseña no cumple los requisitos de seguridad.',
    'auth/too-many-requests':'Espera unos minutos antes de volver a intentarlo.',
    'auth/network-request-failed':'No hay conexión. Inténtalo de nuevo cuando se restablezca.',
    'auth/popup-blocked':'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web y vuelve a pulsar.',
    'auth/popup-closed-by-user':'Has cerrado la ventana de Google. Puedes volver a intentarlo.',
    'auth/cancelled-popup-request':'Ya hay una ventana de acceso abierta.',
    'auth/unauthorized-domain':'El acceso con Google aún no está habilitado para esta dirección.',
    'auth/operation-not-allowed':'Este método de acceso aún no está disponible.',
    'auth/account-exists-with-different-credential':'Ya existe una cuenta con otro método de acceso. Entra con el método que usaste al registrarte.',
    'auth/user-disabled':'Esta cuenta no está disponible.'
  };
  const unavailable=()=>{throw new Error('El acceso con cuenta todavía no está disponible. Inténtalo más tarde.');};
  const ready=(async()=>{
    const response=await fetch('/api/auth/config',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('No se ha podido conectar con el servicio de cuentas.');
    settings=await response.json();enabled=settings.enabled===true;
    if(!enabled)return false;
    const [app,authSdk]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js')
    ]);
    sdk=authSdk;auth=sdk.getAuth(app.initializeApp(settings.firebase));auth.languageCode='es';
    await auth.authStateReady();
    return true;
  })();
  // Keep initialization errors observable by the app without an unhandled rejection.
  ready.catch(()=>{});
  async function persistence(remember){await ready;if(!auth)unavailable();await sdk.setPersistence(auth,remember?sdk.browserLocalPersistence:sdk.browserSessionPersistence);}
  function returnRoute(hash=location.hash){
    if(hash==='#suscripcion'||hash==='#suscripcion?seccion=baja')return hash;
    if(/^#valdemar-jugar\?id=(?:[1-9]|1[0-2])$/.test(hash) || /^#mundos-jugar\?id=(?:1[3-9]|[23]\d|4[0-8])$/.test(hash))return hash;
    if(/^#planes\?(revisar=[1-4]|gestion=aviso)$/.test(hash))return hash;
    if(/^#perfil(?:\?seccion=(?:cuenta|pareja|archivo-secreto)(?:&juego=(?:[1-9]|[1-3]\d|4[0-8]))?)?$/.test(hash))return hash;
    return '#perfil';
  }
  const options=()=>({url:location.origin+'/'+returnRoute(),handleCodeInApp:false});
  root.AccountAccess={
    ready,returnRoute,
    get enabled(){return enabled;},
    get user(){return auth?.currentUser||null;},
    error(error){return messages[error?.code]|| (error?.code?'No se ha podido completar el acceso. Inténtalo de nuevo.':error?.message)||'No se ha podido completar la acción.';},
    subscribe(callback){if(!auth){callback(null);return ()=>{};}return sdk.onIdTokenChanged(auth,callback);},
    async token(){if(!auth?.currentUser)throw new Error('Inicia sesión para continuar.');return auth.currentUser.getIdToken();},
    async login(email,password,remember){await persistence(remember);return sdk.signInWithEmailAndPassword(auth,email.trim(),password);},
    async register(name,email,password,remember){
      if(password.length<12)throw new Error('Elige una contraseña de al menos 12 caracteres.');
      await persistence(remember);
      const result=await sdk.createUserWithEmailAndPassword(auth,email.trim(),password);
      await sdk.updateProfile(result.user,{displayName:name.trim()});
      await sdk.sendEmailVerification(result.user,options());
      return result;
    },
    async google(remember){await persistence(remember);const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return sdk.signInWithPopup(auth,provider);},
    async reset(email){await ready;if(!auth)unavailable();try{await sdk.sendPasswordResetEmail(auth,email.trim(),options());}catch(error){if(error.code!=='auth/user-not-found')throw error;}},
    async resend(){if(!auth?.currentUser)unavailable();await sdk.sendEmailVerification(auth.currentUser,options());},
    async refresh(){if(!auth?.currentUser)unavailable();await sdk.reload(auth.currentUser);await auth.currentUser.getIdToken(true);return auth.currentUser;},
    async logout(){if(auth)await sdk.signOut(auth);}
  };
})(window);
