import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

const scripts=await Promise.all(['membership-flow','experience-actions'].map(file=>
  readFile(new URL('../web/'+file+'.js',import.meta.url),'utf8')));

async function storefront(salesOpen=true){
  let signedIn=false, opened=0;
  const clickHandlers=[], requests=[];
  const location={hash:'#planes',search:'',assign(url){this.destination=url;}};
  const bridge={
    isSignedIn:()=>signedIn, render(){}, toast(){},
    async request(path,payload){requests.push({path,season:payload.season});return {url:'https://checkout.stripe.com/pay/test'};}
  };
  const page=createContext({location,URL,URLSearchParams,GameAccountBridge:bridge,
    history:{replaceState(_state,_title,url){location.hash=url;}},
    document:{body:{dataset:{}},addEventListener(type,handler){if(type==='click')clickHandlers.push(handler);}},
    AccountUI:{open(){opened++;}},ValdemarCatalog:{items:[]},addEventListener(){},
    fetch:async()=>({ok:true,json:async()=>({checkoutAvailable:salesOpen})})});
  for(const script of scripts)runInContext(script,page);
  await new Promise(resolve=>setImmediate(resolve));
  return {
    page,location,requests,opened:()=>opened,
    login(nextSeason){
      signedIn=true;
      page.ClubAccess.set({seasonAccess:{seasons:[],nextPurchase:{number:nextSeason,remainingCycles:3}}});
    },
    async click(season){
      const button={dataset:{action:'billing-checkout',season:String(season)},disabled:false};
      const target={closest(selector){return selector==='[data-action]'?button:null;}};
      for(const fn of clickHandlers)await fn({target});
    }
  };
}

test('Entrar desde el pase recupera su resumen y espera a la confirmación para abrir Stripe',async()=>{
  const shop=await storefront();
  await shop.click(1);
  assert.equal(shop.opened(),1);
  assert.equal(shop.location.hash,'#planes?revisar=1');
  shop.login(1);
  assert.match(shop.page.ClubAccess.plans(),/Revisa tu pase de Valdemar/);
  assert.equal(shop.requests.length,0);
  await shop.click(1);
  assert.deepEqual(shop.requests,[{path:'/api/billing/checkout',season:1}]);
  assert.equal(shop.location.destination,'https://checkout.stripe.com/pay/test');
});
test('El enlace de revisión respeta tanto la temporada elegible como la preapertura',async()=>{
  const active=await storefront();
  await active.click(1);
  active.login(2);
  assert.doesNotMatch(active.page.ClubAccess.plans(),/Revisa tu pase de Valdemar/);
  assert.match(active.page.ClubAccess.plans(),/Contratar el pase de El Tablero de Ámbar/);
  const waiting=await storefront(false);
  await waiting.click(1);
  assert.equal(waiting.opened(),0);
  waiting.location.hash='#planes?revisar=1';
  waiting.login(1);
  assert.match(waiting.page.ClubAccess.plans(),/Avisarme de la apertura/);
  assert.doesNotMatch(waiting.page.ClubAccess.plans(),/data-action="billing-checkout"/);
  assert.equal(waiting.requests.length,0);
});

test('La ayuda y la retirada del aviso están disponibles sin contratar',async()=>{
  for(const salesOpen of [false,true]){
    const shop=await storefront(salesOpen);
    shop.location.hash='#planes?seccion=preguntas';
    const faq=shop.page.ClubAccess.plans();
    assert.match(faq,/<h1[^>]*>Preguntas frecuentes<\/h1>/);
    assert.match(faq,/href="\/privacidad.html"/);
    assert.doesNotMatch(faq,/data-action="billing-checkout"/);
    shop.location.hash='#planes?gestion=aviso';
    assert.match(shop.page.ClubAccess.plans(),/Este navegador no conserva el resguardo/);
    shop.login(1);
    assert.match(shop.page.ClubAccess.plans(),/Retirar los avisos de mi correo verificado/);
    assert.equal(shop.requests.length,0);
  }
});

test('La vuelta de Stripe lleva a las invitaciones y espera confirmación individual antes de anunciar el acceso',async()=>{
  const shop=await storefront();
  shop.login(1);
  shop.location.hash='#planes?checkout=complete';
  const pending=shop.page.ClubAccess.plans();
  assert.match(pending,/Estamos comprobando tu pase/);
  assert.match(pending,/href="\/#perfil\?seccion=pareja"/);
  assert.doesNotMatch(pending,/Tu pase está activo/);
  shop.page.ClubAccess.set({ownAccess:true,canPlay:true});
  assert.match(shop.page.ClubAccess.plans(),/Tu pase está activo/);
  assert.deepEqual(shop.requests,[]);
});
