import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

const scripts=await Promise.all(['membership-flow','experience-actions'].map(file=>
  readFile(new URL('../web/'+file+'.js',import.meta.url),'utf8')));

const offerPolicy={percentOff:50,regularAmountCents:2995,amountCents:null,currency:'eur'};
const catalogs=await Promise.all(['valdemar-catalog','mundos-catalogo'].map(name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8')));

async function storefront(salesOpen=true,partnerOffer=offerPolicy){
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
  page.window=page;
  for(const script of [...catalogs,...scripts])runInContext(script,page);
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
  assert.match(shop.page.ClubAccess.plans(),/Revisa tu suscripción/);
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
  assert.doesNotMatch(active.page.ClubAccess.plans(),/Revisa tu suscripción/);
  assert.match(active.page.ClubAccess.plans(),/Suscribirme/);
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

test('La cuota muestra cuatro juegos enlazados y tres bloques en la temporada',async()=>{
  const shop=await storefront(false);
  const guest=shop.page.ClubAccess.plans();
  assert.deepEqual([...guest.matchAll(/<strong>(\d+)<span> \/ 12 juegos/g)].map(match=>Number(match[1])),[4,8,12]);
  assert.match(guest,/Cuatro juegos <em>cada mes/);
  assert.match(guest,/href="\/#tableros">Ver las temporadas/);
  for(const id of ['01','02','03','04'])assert.ok(guest.includes('href="/valdemar/'+id+'/"'));
  assert.match(guest,/Hotel Medianoche/);
  assert.match(guest,/automáticamente al abonar los 48 juegos/);
  assert.match(guest,/Ya tengo cuenta · Entrar/);
  assert.equal((guest.match(/29,95 €/g)||[]).length,1);
  assert.match(guest,/por persona al mes · IVA incluido/);
  assert.match(guest,/href="\/#alta-club"/);
  assert.doesNotMatch(guest,/class="pase-preguntas"|data-notice="join"|pase-peliculas/);
  shop.login(1);
  assert.match(shop.page.ClubAccess.plans(),/Volver a mis partidas/);
});

test('alta, gestión y preguntas muestran solo las acciones del destino',async()=>{
  const waiting=await storefront(false);
  waiting.location.hash='#alta-club';
  assert.match(waiting.page.ClubAccess.plans(),/data-notice="join"/);
  assert.doesNotMatch(waiting.page.ClubAccess.plans(),/pase-recorrido|pase-preguntas|billing-checkout/);
  waiting.location.hash='#suscripcion';
  assert.match(waiting.page.ClubAccess.plans(),/data-action="auth-login"/);
  assert.doesNotMatch(waiting.page.ClubAccess.plans(),/data-notice|pase-recorrido/);
  waiting.login(1);
  waiting.page.ClubAccess.set({ownAccess:true,hasCustomer:true,seasonAccess:{seasons:[]}});
  assert.match(waiting.page.ClubAccess.plans(),/data-action="billing-portal"/);
  assert.doesNotMatch(waiting.page.ClubAccess.plans(),/pase-recorrido|billing-checkout/);
  waiting.location.hash='#planes?seccion=preguntas';
  const faq=waiting.page.ClubAccess.plans();
  assert.match(faq,/<h2>Juego en pareja<\/h2>/);
  assert.match(faq,/<h2>Desbloqueos y llaves<\/h2>/);
  waiting.location.hash='#desafios';
  assert.equal(waiting.page.ClubAccess.banner(),'');
  waiting.page.ClubAccess.set({role:'admin',canManage:true});
  assert.match(waiting.page.ClubAccess.banner(),/Acceso editorial/);
  assert.doesNotMatch(waiting.page.ClubAccess.banner(),/<a\b/);
});

test('El primer cobro y la recontratación siempre muestran el precio íntegro',async()=>{
  const policy={percentOff:50,regularAmountCents:2995,amountCents:null,currency:'eur'};
  const shop=await storefront(true,policy);
  assert.match(shop.page.ClubAccess.plans(),/La primera cuota se cobra al contratar/);
  for(const status of ['no_partner','saved','eligible']){
    shop.login(1,{...policy,status,eligible:status==='eligible'});
    const quote=shop.page.ClubAccess.plans();
    assert.match(quote,/29,95 €<\/strong> <span>por persona al mes/);
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
  assert.match(waiting.page.ClubAccess.plans(),/contratación aún está cerrada/);
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
  assert.match(html,/En la demo La cinta 87 os turnáis con un mismo dispositivo y podéis jugar sin cuenta/);
  assert.match(html,/En las aventuras del pase, cada persona entra con su propia cuenta/);
  assert.match(html,/<summary>¿Cómo se reparten los papeles en las aventuras del pase\?/);
  assert.match(html,/un solo compañero a la vez/);
  assert.match(html,/primero que pulsa «En pareja» en ese caso lleva el papel 1/);
  assert.match(html,/pulsa «En pareja», recibe el papel 2/);
  assert.match(html,/primera cuota personal es de 29,95/);
  assert.match(html,/ambos tenéis una suscripción personal activa/);
  assert.match(html,/facturas ya emitidas conservan su importe/);
  assert.match(html,/href="\/#perfil\?seccion=pareja">Elegir a mi compañero/);
  assert.match(html,/href="\/#perfil\?seccion=pareja">Gestionar mi compañero/);
  assert.doesNotMatch(html,/correo.*otro para ese caso|elegir una pareja distinta|acepta desde su perfil/);
  shop.location.hash='#planes';
  assert.match(shop.page.ClubAccess.plans(),/href="\/#perfil\?seccion=pareja">Elegir a mi compañero/);
  shop.login(1);
  assert.match(shop.page.ClubAccess.plans(),/href="\/#perfil\?seccion=pareja">Ver mi compañero de juego/);
  shop.page.Colecciones={menu:()=>''};
  shop.page.ClubAccess.set({role:'admin'});
  assert.match(shop.page.ClubAccess.plans(),/href="\/#perfil\?seccion=pareja">Ver mi compañero de juego/);
});

test('El catálogo abonado, el plan antiguo y el acceso editorial no ofrecen otra compra',async()=>{
  const shop=await storefront(true);
  shop.login(1);
  const seasons=Array.from({length:4},(_,index)=>({number:index+1,paidBlocks:[1,2,3],previousReady:index===0,completed:0,finishAccess:false}));
  for(const ownAccess of [true,false]){
    shop.page.ClubAccess.set({ownAccess,hasCustomer:true,partnerOffer:{status:'eligible',eligible:true},seasonAccess:{seasons,nextPurchase:null,billingPlan:'four-boards-v1'}});
    for(const target of ['#planes','#suscripcion']){
      shop.location.hash=target;
      const page=shop.page.ClubAccess.plans();
      assert.match(page,/catálogo (está )?abonado|Catálogo abonado/i);
      assert.doesNotMatch(page,/billing-checkout|Tu próxima renovación tiene|data-notice="join"/);
    }
  }
  shop.location.hash='#planes';
  shop.page.ClubAccess.set({ownAccess:true,seasonAccess:{seasons:[seasons[0]],billingPlan:'season'}});
  assert.match(shop.page.ClubAccess.plans(),/cobros de este pase de temporada han terminado/);
  shop.page.ClubAccess.set({role:'admin'});
  assert.match(shop.page.ClubAccess.plans(),/48 juegos abiertos/);
  assert.doesNotMatch(shop.page.ClubAccess.plans(),/billing-checkout|data-notice|Suscribirme/);
});

test('Una configuración sin disponibilidad confirmada ofrece reintentar y conserva la demo',async()=>{
  const shop=await storefront(null);
  assert.equal(shop.page.ClubAccess.salesState,'unknown');
  assert.match(shop.page.ClubAccess.plans(),/Volver a consultar/);
  assert.match(shop.page.ClubAccess.plans(),/href="\/cinta-87.html"/);
  assert.doesNotMatch(shop.page.ClubAccess.plans(),/billing-checkout|Avisarme de la apertura/);
});

test('Al retomar, el resumen corresponde al bloque que se puede abonar',async()=>{
  const shop=await storefront(true);
  shop.login(2);
  shop.page.ClubAccess.set({seasonAccess:{seasons:[{number:2,paidBlocks:[1],previousReady:true,completed:4}],nextPurchase:{number:2,blocks:[2,3],remainingCycles:2}}});
  const page=shop.page.ClubAccess.plans();
  assert.match(page,/juegos del bloque 2/);
  assert.match(page,/href="\/#expedicion\?lugar=5"/);
  assert.doesNotMatch(page,/href="\/valdemar\/01\//);
});

test('Portada y pase comparten la disponibilidad y la tarifa general configurada',async()=>{
  for(const open of [true,false]){
    const shop=await storefront(open,offerPolicy);
    assert.equal(shop.page.ClubAccess.salesState,open?'open':'waitlist');
    assert.equal(shop.page.ClubAccess.price,'29,95 €');
    assert.ok(shop.page.ClubAccess.plans().includes('<strong>'+shop.page.ClubAccess.price+'</strong>'));
  }
});
