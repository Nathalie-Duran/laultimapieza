import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
async function appHarness({fullAccess=false,navLinks=[]}={}){
  const elements=new Map();
  const windowEvents=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',dataset:{},open:false,hidden:false,
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},replaceChildren(){this.innerHTML='';},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(selector);};
  let fetcher=async()=>Response.json({}),bridge;
  const context=createContext({crypto:globalThis.crypto,structuredClone,AbortController,Response,URL,URLSearchParams,console,
    document:{body:element('body'),getElementById:id=>element('#'+id),querySelector:element,querySelectorAll:selector=>selector==='[data-nav]'?navLinks:[],addEventListener(){}},
    location:{hash:'#perfil'},localStorage:{getItem:()=>null,setItem(){}},
    history:{replaceState(_state,_title,url){context.location.hash=url.slice(url.indexOf('#'));}},
    requestAnimationFrame(callback){callback();},setTimeout:()=>0,clearTimeout(){},setInterval(){},FormData,
    fetch:(...args)=>fetcher(...args),
    AccountAccess:{token:async()=>'test-token'},EditorialChallenges:{view:()=>'',mount(){}},
    AccountUI:{start:async value=>{bridge=value;},signInPanel:()=>'<h1>Iniciar sesión</h1>',header:()=>'',accountCard:()=>'',open(){}},
    addEventListener(event,callback){windowEvents.set(event,callback);},scrollTo(){}});
  context.window=context;
  for(const file of ['stories.js','season.js','engine.js','profile-model.js','membership.js',...(fullAccess?['membership-flow.js']:[]),'monthly-access.js','experience-ui.js','profile-notebook.js','archive.js','como-se-juega.js','retos-temporada.js','salas-mundos-catalogo.js','colecciones.js','valdemar-catalog.js','mundos-catalogo.js'])runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  runInContext(source,context);bridge.cloud(true);bridge.loading(false);
  return {bridge,element,membership:context.ClubAccess,setFetch(value){fetcher=value;},credential(value){context.AccountAccess.user=value;},
    followHash(from,hash){
      const oldURL='https://juego.test/'+from;
      context.location.hash=hash;windowEvents.get('hashchange')({oldURL});
    },
    visit(hash){context.location.hash=hash;bridge.render();return element('#main').innerHTML;}};
}
test('el menú de escritorio y el móvil ofrecen los mismos destinos y adaptan la cuenta al entrar y salir',async()=>{
  const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const menus=['<nav aria-label="Principal">','<nav class="mobile-nav"'].map(start=>{
    const from=html.indexOf(start),section=html.slice(from,html.indexOf('</nav>',from));
    return [...section.matchAll(/<a (.*?)>([\s\S]*?)<\/a>/g)].map(([,attrs,body])=>({
      label:attrs.match(/aria-label="([^"]+)"/)?.[1]||body.replace(/<span aria-hidden="true">[^<]*<\/span>|<[^>]+>/g,''),
      href:attrs.match(/href="([^"]+)"/)[1],dataset:{nav:attrs.match(/data-nav="([^"]+)"/)[1],navAudience:attrs.match(/data-nav-audience="([^"]+)"/)?.[1]},
      hidden:attrs.includes(' hidden'),classList:{toggle(){}},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];}
    }));
  });
  const app=await appHarness({navLinks:menus.flat()});
  const verify=(names,active)=>menus.forEach(links=>{
    const showing=links.filter(link=>!link.hidden);
    assert.deepEqual(showing.map(link=>link.label),names);
    assert.deepEqual(showing.filter(link=>link['aria-current']).map(link=>link.dataset.nav),[active]);
  });
  const base=['Juegos','Mapa de temporadas','Retos extra'];
  assert.match(app.visit('#casos'),/<h1>Juegos<\/h1>/);
  verify([...base,'Suscripción'],'casos');
  assert.match(app.visit('#tableros'),/<h1 id="universe-heading">Mapa de temporadas<\/h1>/);
  verify([...base,'Suscripción'],'tableros');
  app.setFetch(async()=>Response.json({profile:{userId:'persona',name:'Mi perfil'},sessions:[],activeSessionId:null,membership:{canPlay:false}}));
  await app.bridge.load();app.visit('#archivo');
  verify([...base,'Mis partidas','Mi cuenta'],'archivo');
  app.bridge.reset();app.visit('#casos');
  verify([...base,'Suscripción'],'casos');
});

test('el mapa ilustrado conserva los cuatro destinos durante el acceso, al cambiar de cuenta y en la ruta permanente',async()=>{
  const app=await appHarness();
  const verify=(html)=>{
    assert.equal(html.split('/atlas-cuatro-mundos.webp').length-1,1);
    const section=html.match(/<nav class="universe-chart"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(section);
    assert.deepEqual([...section.matchAll(/href="\/#([^"]+)"/g)].map(match=>match[1]),['mapa','expedicion','umbravia','necropolis']);
  };
  for(const loading of [true,false]){
    app.bridge.loading(loading);
    verify(app.visit('#inicio'));
    verify(app.visit('#tableros?mundo=necropolis'));
  }
  for(const [userId,role,canPlay] of [['libre','member',false],['abonado','member',true],['editor','admin',true]]){
    app.setFetch(async()=>Response.json({profile:{userId,name:userId},sessions:[],membership:{role,canPlay}}));
    await app.bridge.load();
    const home=app.visit('#inicio');
    verify(home);
    assert.ok(home.startsWith('<section class="universe-front"'));
    assert.match(home,/href="\/#tableros">Ver el recorrido/);
    verify(app.visit('#tableros?mundo=expedicion'));
    app.bridge.reset();
    verify(app.visit('#inicio'));
  }
});

test('la guía se abre sin cuenta incluso durante la carga y el catálogo la enlaza en un clic',async()=>{
  const app=await appHarness();
  assert.match(app.visit('#como-se-juega'),/<h1 id="how-title">Cómo se juega<\/h1>/);
  app.bridge.loading(true);
  assert.match(app.visit('#como-se-juega'),/<guide-comparison>/);
  const shell=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(shell,/<a class="site-how-link" href="\/#como-se-juega"/);
  const catalog=await readFile(new URL('../web/valdemar-catalog.js',import.meta.url),'utf8');
  assert.match(catalog,/href="\/#como-se-juega">Cómo se juega<\/a>/);
});

test('Los enlaces antiguos llevan al único catálogo y los guardados personales siguen en Mis partidas',async()=>{
  const nav={dataset:{nav:'casos'},classList:{toggle(){}},setAttribute(){},removeAttribute(){}};
  const app=await appHarness({fullAccess:true,navLinks:[nav]});
  for(const route of ['#historias-clasicas','#archivo-clasico?mes=2','#invitacion']){
    const page=app.visit(route);
    assert.match(page,/<h1>Juegos<\/h1>/);
    assert.doesNotMatch(page,/archivo clásico|href="\/?#archivo-clasico/i);
  }
  const catalogueAction=/<a class="button primary" href="\/#casos">Elegir un juego<\/a>/;
  assert.match(app.visit('#partida'),catalogueAction);
  assert.match(app.visit('#mapa-clasico?seccion=sello'),/<h1>Mis partidas<\/h1>/);
  const session={id:'guardada-1',caseId:'cartas-medianoche',ownerId:'persona',members:[{userId:'persona',name:'Ada'}],mode:'solo',history:[],status:'active'};
  const response={profile:{userId:'persona',name:'Ada'},sessions:[session],activeSessionId:session.id,membership:{canPlay:true,ownAccess:true,calendar:{unlockedCaseIds:[session.caseId]}}};
  app.setFetch(async()=>Response.json({...response,sessions:[],activeSessionId:null}));
  await app.bridge.load();
  assert.match(app.visit('#partida'),catalogueAction);
  app.setFetch(async()=>Response.json(response));
  await app.bridge.load();
  assert.match(app.visit('#archivo'),/data-action="resume" data-id="guardada-1"/);
  const pieces=app.visit('#mapa-clasico');
  assert.match(pieces,/Mis piezas de Las doce noches/);
  assert.doesNotMatch(pieces,/data-action="setup"|archivo clásico/i);
  assert.match(source,/href="\/#casos">Elegir otro juego<\/a>/);
  assert.doesNotMatch(source,/<select name="caseId"|<form id="setup-form"/);
});
test('Cambiar de cuenta limpia la vista y una respuesta anterior no puede restaurar sus datos',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null,membership:{canPlay:true}}));
  await app.bridge.load();app.bridge.render();assert.match(app.element('#main').innerHTML,/Alice privada/);
  assert.equal(app.membership.canPlay,true);
  let release,started;const issued=new Promise(resolve=>{started=resolve;});
  app.setFetch(()=>new Promise(resolve=>{release=resolve;started();}));
  const pending=app.bridge.load();await issued;
  app.bridge.reset();app.bridge.render();assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
  assert.equal(app.membership.canPlay,false);
  release(Response.json({profile:{userId:'alice',name:'Alice privada'},sessions:[],activeSessionId:null}));
  await assert.rejects(pending,/cuenta ha cambiado/);
  app.setFetch(async()=>Response.json({profile:{userId:'bob',name:'Bob independiente'},sessions:[],activeSessionId:null}));
  await app.bridge.load();app.bridge.render();
  assert.equal(app.membership.canPlay,false);
  assert.match(app.element('#main').innerHTML,/Bob independiente/);assert.doesNotMatch(app.element('#main').innerHTML,/Alice privada/);
});
test('Cerrar sesión durante una carga quita el estado de espera y los datos de la cuenta',async()=>{
  const app=await appHarness();app.bridge.loading(true);assert.match(app.element('#main').innerHTML,/Cargando/);
  app.bridge.reset();app.bridge.render();assert.match(app.element('#main').innerHTML,/Iniciar sesión/);assert.doesNotMatch(app.element('#main').innerHTML,/Cargando/);
});

test('las rutas del cuaderno de un titular sin cuota conservan cuenta, archivo y colección y cierran al salir',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'lector',name:'Alicia'},sessions:[],activeSessionId:null}));
  await app.bridge.load();
  assert.equal(app.bridge.playerName(),'Alicia');
  const routes=[['#perfil','Cuaderno del aventurero'],['#perfil?seccion=trayectoria','profile-collection data-career'],
    ['#perfil?seccion=coleccion','lup-explorador collection'],['#perfil?seccion=logros','<profile-collection>'],
    ['#perfil?seccion=coleccion&ver=hallazgos','lup-explorador collection'],
    ['#perfil?seccion=archivo-secreto','profile-collection data-archive'],['#perfil?seccion=llaves','profile-collection data-keys'],
    ['#perfil?seccion=pareja','<profile-partners>'],['#perfil?seccion=cuenta','<play-notice-preferences>'],['#archivo','Mis partidas']];
  for(const [route,expected] of routes)assert.ok(app.visit(route).includes(expected),route);
  app.bridge.reset();assert.equal(app.bridge.playerName(),'');
  for(const [route] of routes)assert.match(app.visit(route),/Iniciar sesión/);
});

test('al abrir Mis hallazgos desde el perfil o una partida el foco va a las muestras de la colección',async()=>{
  const app=await appHarness();
  app.setFetch(async()=>Response.json({profile:{userId:'lectora',name:'Alicia'},sessions:[]}));
  await app.bridge.load();
  const focused=[],scrolled=[];
  const target=label=>({focus(){focused.push(label);},scrollIntoView(){scrolled.push(label);}});
  const summary=target('Mis hallazgos'),tab=target('Colección'),main=app.element('#main');
  Object.assign(app.element('lup-explorador[collection] summary'),summary);
  main.focus=()=>focused.push('contenido principal');
  main.querySelector=selector=>selector.includes('summary')?summary:tab;
  for(const origin of ['#perfil?seccion=coleccion','#valdemar-jugar?id=1']){
    focused.length=0;scrolled.length=0;
    app.followHash(origin,'#perfil?seccion=coleccion&ver=hallazgos');
    assert.equal(focused.at(-1),'Mis hallazgos',origin);
    assert.equal(scrolled.at(-1),'Mis hallazgos',origin);
  }
});

test('el directorio de Mi cuenta enlaza cada tarea a su panel y conserva el acceso directo a la suscripción',async()=>{
  const app=await appHarness({fullAccess:true});
  const home=app.visit('#inicio');
  assert.match(home,/Cuatro juegos de misterio al mes/);
  assert.match(home,/demo gratis/i);
  assert.match(home,/habilidades de tu personaje/);
  assert.match(home,/retos extra te dan llaves/i);
  assert.doesNotMatch(app.visit('#perfil'),/data-personal-menu/);
  app.setFetch(async()=>Response.json({profile:{userId:'jugadora',name:'Ada'},sessions:[],membership:{canPlay:false}}));
  await app.bridge.load();
  const menu=app.visit('#perfil').match(/<nav class="notebook-nav"[^>]*data-personal-menu>[\s\S]*?<\/nav>/)[0];
  assert.match(menu,/<details class="pn-menu-group"><summary>Personaje y recompensas<\/summary>/);
  const expected=[
    ['Mi aventura',/class="pn-dashboard"/],['Los cuatro mundos',/id="universe-heading"/],
    ['Retos extra',/adventure-challenges/],['Mis partidas',/id="pn-sessions-title"/],
    ['Mi personaje',/<profile-collection data-career>/],['Mi compañero',/<preferred-partner>/],
    ['Mis llaves',/<profile-collection data-keys>/],['Mis logros',/<profile-collection>/],
    ['Archivo secreto',/<profile-collection data-archive>/],['Mi colección',/<profile-collection data-collection>/],
    ['Mi suscripción',/Dar de baja mi suscripción/],['Configuración',/<play-notice-preferences>/]
  ];
  const links=[...menu.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([,href,label])=>({href,label}));
  for(const [label,content] of expected){
    const matches=links.filter(link=>link.label===label);
    assert.equal(matches.length,1,label);
    const page=app.visit(matches[0].href);
    assert.match(page,content,label);
    if(matches[0].href.includes('#perfil?seccion=')&&label!=='Configuración'){
      assert.ok(page.includes(' aria-current="page">'+label+'</a>'),label);
      assert.match(page,/<details class="pn-menu-group" open>/);
    }
  }
  assert.match(menu,/<div class="pn-menu-shortcuts">[^<]*(?:<a [^>]+>[^<]+<\/a>)*<a href="#suscripcion">Mi suscripción<\/a>/);
  const settings=app.visit('#perfil?seccion=cuenta');
  assert.match(settings,/href="#accesibilidad\?volver=perfil"/);
  assert.match(app.visit('#accesibilidad?volver=perfil'),/<display-preferences>/);
  app.bridge.reset();
  assert.doesNotMatch(app.visit('#perfil?seccion=llaves'),/data-personal-menu/);
});

test('cada entrada del cuaderno muestra la acción de acceso, pareja y archivo en su destino',async()=>{
  const app=await appHarness({fullAccess:true});
  assert.match(app.visit('#archivo'),/<h1>Mis partidas<\/h1>/);
  assert.match(app.visit('#perfil'),/<h1>Mi cuaderno<\/h1>/);
  for(const hash of ['#archivo','#perfil']){
    const guest=app.visit(hash);
    assert.equal(guest.match(/data-action="auth-login"/g)?.length,1);
    assert.equal(guest.match(/data-action="auth-register"/g)?.length,1);
  }
  app.credential({emailVerified:false});
  assert.equal(app.visit('#perfil'),'<h1>Iniciar sesión</h1>');
  app.credential(null);
  for(const membership of [{canManage:false,canPlay:false},{canManage:false,canPlay:true},{canManage:true,canPlay:true,role:'admin'}]){
    app.setFetch(async()=>Response.json({profile:{userId:'persona',name:'Mi perfil'},sessions:[],activeSessionId:null,membership}));
    await app.bridge.load();
    const main=app.visit('#perfil');
    assert.equal(main.includes('notebook-management'),membership.canManage);
    assert.doesNotMatch(main,/preferred-partner|Noches para recordar|Mis reliquias|Aún no tienes partidas del archivo clásico/);
    const nav=main.match(/<nav class="notebook-nav"[\s\S]*?<\/nav>/)[0];
    assert.equal(nav.match(/href="#archivo"/g)?.length,1);
    const paired=app.visit('#perfil?seccion=pareja');
    assert.equal(paired.match(/<preferred-partner>/g)?.length,1);
    assert.equal(paired.match(/<profile-partners>/g)?.length,1);
    const style=app.visit('#perfil?seccion=estilo');
    assert.match(style,/Tu estilo de juego/);assert.doesNotMatch(style,/class="trait-grid"|Descubre tu sello/);
    const archive=app.visit('#archivo');
    assert.doesNotMatch(archive,/archive-memories/);
    assert.match(archive,/<details class="pn-archive-options">[\s\S]*data-action="progress-reset-open"/);
  }
});
