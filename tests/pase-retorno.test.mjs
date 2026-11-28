import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

const scripts=await Promise.all(['membership-flow','experience-actions'].map(file=>
  readFile(new URL('../web/'+file+'.js',import.meta.url),'utf8')));

async function storefront(salesOpen=true,partnerOffer){
  let signedIn=false, opened=0;
  const clickHandlers=[], requests=[];
  const location={hash:'#planes',search:'',assign(url){this.destination=url;}};
  const bridge={
    isSignedIn:()=>signedIn, render(){}, toast(){},
    async request(path,payload){requests.push({path,...payload});return {url:'https://checkout.stripe.com/pay/test'};}
  };
  const page=createContext({location,URL,URLSearchParams,GameAccountBridge:bridge,
    history:{replaceState(_state,_title,url){location.hash=url;}},
    document:{body:{dataset:{}},addEventListener(type,handler){if(type==='click')clickHandlers.push(handler);}},
    AccountUI:{open(){opened++;}},ValdemarCatalog:{items:[]},addEventListener(){},
    fetch:async()=>({ok:true,json:async()=>({checkoutAvailable:salesOpen,partnerOffer})})});
  for(const script of scripts)runInContext(script,page);
  await new Promise(resolve=>setImmediate(resolve));
  return {
    page,location,requests,opened:()=>opened,
    login(nextSeason,personalOffer){
      signedIn=true;
      page.ClubAccess.set({partnerOffer:personalOffer,seasonAccess:{seasons:[],nextPurchase:{number:nextSeason,remainingCycles:3}}});
    },
    async click(season){
      const button={dataset:{action:'billing-checkout',season:String(season),plan:'four-boards-v1'},disabled:false};
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
  assert.match(shop.page.ClubAccess.plans(),/Revisa tu pase de los cuatro tableros/);
  assert.equal(shop.requests.length,0);
  await shop.click(1);
  assert.match(shop.page.ClubAccess.plans(),/data-plan="four-boards-v1"/);
  assert.deepEqual(shop.requests,[{path:'/api/billing/checkout',season:1,plan:'four-boards-v1'}]);
  assert.equal(shop.location.destination,'https://checkout.stripe.com/pay/test');
});
test('El enlace de revisión respeta tanto la temporada elegible como la preapertura',async()=>{
  const active=await storefront();
  await active.click(1);
  active.login(2);
  assert.doesNotMatch(active.page.ClubAccess.plans(),/Revisa tu pase de los cuatro tableros/);
  assert.match(active.page.ClubAccess.plans(),/Contratar el pase de los cuatro tableros/);
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

test('el pase explica el orden de cuatro tableros, los tres bloques y el retorno de un miembro',async()=>{
  const shop=await storefront(false);
  const guest=shop.page.ClubAccess.plans();
  assert.deepEqual([...guest.matchAll(/<strong>(\d+)<span> \/ 12 aventuras/g)].map(match=>Number(match[1])),[4,8,12]);
  for(const board of ['mapa','expedicion','umbravia','necropolis'])assert.ok(guest.includes('href="/#'+board+'"'));
  assert.match(guest,/Ya tengo cuenta · Entrar/);
  assert.match(guest,/Tarifa prevista · 29,95/);
  shop.login(1);
  assert.match(shop.page.ClubAccess.plans(),/Volver a mis partidas/);
});

test('El primer cobro y la recontratación siempre muestran el precio íntegro',async()=>{
  const policy={percentOff:50,regularAmountCents:2995,amountCents:null,currency:'eur'};
  const shop=await storefront(true,policy);
  assert.match(shop.page.ClubAccess.plans(),/primera cuota por persona/);
  for(const status of ['no_partner','saved','eligible']){
    shop.login(1,{...policy,status,eligible:status==='eligible'});
    const quote=shop.page.ClubAccess.plans();
    assert.match(quote,/29,95 €<\/strong> primera cuota por persona/);
    assert.match(quote,/próxima renovación/);
    assert.doesNotMatch(quote,/data-partner-offer|Tu próxima renovación tiene|14,9[78]/);
    await shop.click(1);
    assert.deepEqual(shop.requests.at(-1),{path:'/api/billing/checkout',season:1,plan:'four-boards-v1'});
  }
  shop.page.ClubAccess.set({ownAccess:true,hasCustomer:true,partnerOffer:{...policy,status:'eligible',eligible:true},
    seasonAccess:{seasons:[{number:1,paidBlocks:[1],completed:2,finishAccess:false}],nextPurchase:null}});
  const quote=shop.page.ClubAccess.plans();
  assert.match(quote,/Tu próxima renovación tiene un 50 %/);
  assert.match(quote,/suscripción personal activa/);
  assert.doesNotMatch(quote,/data-action="billing-checkout"|14,9[78]/);
  const waiting=await storefront(false,policy);
  waiting.login(1,{...policy,status:'eligible',eligible:true});
  assert.match(waiting.page.ClubAccess.plans(),/abrirá próximamente/);
  assert.doesNotMatch(waiting.page.ClubAccess.plans(),/data-action="billing-checkout"/);
});

test('La vuelta de Stripe lleva al perfil y espera confirmación individual antes de anunciar el acceso',async()=>{
  const shop=await storefront();
  shop.login(1);
  shop.location.hash='#planes?checkout=complete';
  const pending=shop.page.ClubAccess.plans();
  assert.match(pending,/Estamos comprobando tu pase/);
  assert.match(pending,/href="\/#perfil"/);
  assert.doesNotMatch(pending,/Tu pase está activo/);
  shop.page.ClubAccess.set({ownAccess:true,canPlay:true});
  assert.match(shop.page.ClubAccess.plans(),/Tu pase está activo/);
  assert.deepEqual(shop.requests,[]);
});

test('La ayuda separa la elección mutua del papel y de la renovación',async()=>{
  const shop=await storefront(false);
  shop.location.hash='#planes?seccion=preguntas';
  const html=shop.page.ClubAccess.plans();
  assert.match(html,/un solo compañero a la vez/);
  assert.match(html,/primero que pulsa «En pareja» en ese caso lleva el papel 1/);
  assert.match(html,/pulsa «En pareja», recibe el papel 2/);
  assert.match(html,/primera cuota personal es de 29,95/);
  assert.match(html,/ambos tenéis una suscripción personal activa/);
  assert.match(html,/facturas ya emitidas conservan su importe/);
  assert.doesNotMatch(html,/correo.*otro para ese caso|elegir una pareja distinta|acepta desde su perfil/);
});
