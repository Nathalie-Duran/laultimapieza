(function(){
'use strict';
function experienceModel(){return {stories:window.STORIES,sessions:data.sessions,userId:me()?.userId,journey:journeyState,canPlay:window.ClubAccess.canPlay,membership:window.ClubAccess.state};}
function homeWithPlans(){return window.ExperienceUI.home(experienceModel());}
function valdemarState(membership={}) {
  membership ||= {};
  const admin = membership.role === 'admin';
  const season = membership.seasonAccess;
  if (Array.isArray(season?.availableCases)) {
    const openedMonths = [...new Set(season.availableCases.filter(id=>Number.isInteger(id)&&id>=1&&id<=12).map(id=>Math.ceil(id/4)))];
    const valdemar=season.seasons?.find(s=>s.number===1);
    return {admin,canPlay:admin||openedMonths.length>0,openedMonths:admin?[1,2,3]:openedMonths,fullyPaid:!!valdemar?.finishAccess,completed:season.completed||[]};
  }
  const released = new Set(membership.calendar?.unlockedCaseIds || []);
  const blocks = membership.calendar?.blocks || [];
  const openedMonths = admin ? [1,2,3] : membership.ownAccess ? blocks.filter(b => b.caseIds?.some(id => released.has(id))).map(b => Number(b.number)) : [];
  return {admin, canPlay:admin || membership.ownAccess === true, openedMonths};
}
function seasonMonth() {
  const value=Number(new URLSearchParams(location.hash.split('?')[1]||'').get('mes'));
  return [1,2,3].includes(value) ? value : 1;
}
function seasonId() {
  const params=new URLSearchParams(location.hash.split('?')[1] || '');
  return Number(params.has('id') ? params.get('id') : document.body.dataset.valdemarCase);
}
function resumeCaseRequested(){return new URLSearchParams(location.hash.split('?')[1]||'').get('retomar')==='1';}
function experienceCatalog(){return window.ValdemarCatalog.list({...valdemarState(window.ClubAccess.state),month:seasonMonth()})+(online?'<aventuras-publicadas></aventuras-publicadas>':'');}

function valdemarDetail(membership){return window.ValdemarCatalog.detail(seasonId(),valdemarState(membership));}
function valdemarGame(){
  if(!window.ValdemarCatalog.get(seasonId()))return valdemarDetail({});
  if(!online||!valdemarState(window.ClubAccess.state).canPlay)return valdemarDetail(window.ClubAccess.state);
  return '<section id="valdemar-player" aria-label="Mesa de juego de Código Valdemar" aria-busy="true"><p role="status">Abriendo el expediente…</p></section>';
}
function seasonMap(membership) { return window.Colecciones.menu('mapa')+window.ValdemarPlano.view(valdemarState(membership))+window.SellosTemporada.view(1); }

function worldView(route, membership) {
  const view=window.Mundos.view(route,membership||{});
  if(new URLSearchParams(location.hash.split('?')[1]).get('seccion')==='ficha')return view;
  return window.Colecciones.menu(route)+view+window.SellosTemporada.view(window.Mundos.edition(route).number);
}
function mountWorld(route) {
  const number=route==='mapa'?1:window.Mundos?.edition(route)?.number;
  if(!number)return;
  const bridge=window.GameAccountBridge;
  const access=bridge?.isSignedIn()?bridge.request('/api/valdemar/seasons'):undefined;
  if(number!==1)window.Mundos.mount(route,bridge,access);
  window.SellosTemporada.mount(number,bridge,access);
  if(new URLSearchParams(location.hash.split('?')[1]).get('seccion')==='sello'){
    const title=document.getElementById('ss-heading');
    requestAnimationFrame(()=>{
      if(!title?.isConnected)return;
      title.focus({preventScroll:true});title.closest('section').scrollIntoView({block:'start',behavior:'instant'});
    });
  }
}
let sealEntryPending = true;
function sealRequested() {
  const [page, query] = location.hash.split('?');
  return page === '#archivo' && new URLSearchParams(query).get('seccion') === 'piezas';
}
function openRequestedSeal() {
  if (!sealEntryPending || !sealRequested()) return;
  const title = document.getElementById('cipher-title');
  if (!title) return;
  requestAnimationFrame(() => {
    if (!title.isConnected || !sealEntryPending || !sealRequested()) return;
    sealEntryPending = false;
    title.closest('.cipher-section').scrollIntoView({block:'start', behavior:'instant'});
    title.focus({preventScroll:true});
  });
}
function displaySettings(){return '<section class="account-card"><h1>Accesibilidad</h1><display-preferences></display-preferences></section>';}
function profileWithSubscription(){return profile();}
function plans(){return window.ClubAccess.plans();}
function enrollment(){return plans();}
function subscription(){return plans();}
const $=s=>document.querySelector(s),E=window.GameEngine,SKILLS={inteligencia:'Inteligencia',perspicacia:'Perspicacia',romanticismo:'Romanticismo',empatia:'Empatía',creatividad:'Creatividad',valentia:'Valentía'},COLORS=['#b1846b','#a7b6a0','#dca6a1','#a2b2c9'];
let journeyState=null;
let seasonRead=0;
const seasonAccountPages=new Set(['#planes','#alta-club','#suscripcion','#perfil']);
const sceneViews=new Map();

let cloudMode=false,accountGeneration=0,accountAbort=new AbortController(),accountLoading=true,saveState='saved';
const STORAGE='ultima-pieza-v2';let data={profiles:[],activeId:null,sessions:[]},online=false,connectionError=false,activeSessionId=null,filter='todos',busy=false,polling=false,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved&&Array.isArray(saved.profiles)&&Array.isArray(saved.sessions))data=saved;}catch{}
activeSessionId=data.activeSessionId||null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me=()=>data.profiles.find(p=>p.userId===data.activeId);const current=()=>data.sessions.find(s=>s.id===activeSessionId&&s.members.some(member=>member.userId===data.activeId));const story=id=>window.STORIES.find(s=>s.id===id);const initials=n=>(n||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
function save(){if(cloudMode||online)return;try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch{toast('El navegador no permite guardar. Esta sesión funcionará hasta que cierres la página.');}}
function toast(t){$('#toast').textContent=t;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',5000);}
const portraits={detective:'Iniciales',cobre:'Cobre',jade:'Jade',ambar:'Ámbar',tinta:'Tinta',coral:'Coral',plata:'Plata'};
function portraitContent(p){return p?.avatar&&p.avatar!=='detective'&&Object.hasOwn(portraits,p.avatar)?`<img src="/avatar-${p.avatar}.jpg" alt="" width="64" height="64">`:esc(initials(p?.name||'?'));}

function avatar(p,large=false){
 const person=data.profiles.find(entry=>entry.userId===p?.userId)||p;
 const color=COLORS.includes(person?.color)?person.color:'#b1846b';
 return `<span class="avatar ${large?'large':''}" style="--avatar:${color}" aria-hidden="true">${portraitContent(person)}</span>`;
}

function avatarPicker(p){const value=Object.hasOwn(portraits,p?.avatar)?p.avatar:'detective';return `<fieldset class="portrait-field"><legend>Tu avatar</legend><div class="portrait-choices">${Object.entries(portraits).map(([key,label])=>`<label><input type="radio" name="avatarChoice" value="${key}" ${value===key?'checked':''}><span class="portrait-tile">${key==='detective'?`<span class="portrait-initials">${esc(initials(p?.name||'Yo'))}</span>`:`<img src="/avatar-${key}.jpg" width="64" height="64" alt="">`}<span>${label}</span></span></label>`).join('')}</div></fieldset>`;}

function notebookNav(section){
  const collection=[['logros','Logros'],['archivo-secreto','Archivo secreto'],['llaves','Mi llavero']];
  const classic=['estilo','Mi estilo de juego'];
  const sections=[['progreso','Mi progreso'],...(cloudMode?[['suscripcion','Suscripción']]:[]),['partidas','Mis partidas'],...(cloudMode?[['trayectoria','Trayectoria'],['coleccion','Colección'],['pareja','Jugar en pareja']]:[classic]),['cuenta','Cuenta'],['preferencias','Preferencias']];
  const parent=collection.some(([id])=>id===section)?'coleccion':section==='estilo'&&cloudMode?'trayectoria':section;
  const links=rows=>rows.map(([id,label])=>{
    const href=id==='progreso'?'#perfil':id==='suscripcion'?'#suscripcion':id==='partidas'?'#archivo':id==='preferencias'?'#accesibilidad?volver=perfil':'#perfil?seccion='+id;
    const selected=section===id?' aria-current="page"':parent===id?' class="pn-parent"':'';
    return `<a href="${href}"${selected}>${label}</a>`;
  }).join('');
  const children=cloudMode?(parent==='coleccion'?collection:parent==='trayectoria'?[classic]:[]):[];
  return '<nav class="notebook-nav" aria-label="Secciones de mi cuenta">'+links(sections)+
    (window.ClubAccess.state?.canManage===true?'<a class="notebook-management" href="#gestion">Gestión de la web</a>':'')+'</nav>'+
    (children.length?'<nav class="notebook-nav pn-subnav" aria-label="'+(parent==='coleccion'?'Secciones de la colección':'Mi historial de decisiones')+'">'+links(children)+'</nav>':'');
}
function notebookHeader(p,section){
  return `<header class="profile-heading notebook-heading">${avatar(p,true)}<div><span class="eyebrow sage">Cuaderno del aventurero</span><h1>${esc(p.name)}</h1></div>${button('Editar perfil y avatar','edit-profile')}</header>`+notebookNav(section);
}
function notebookAccess(archive=false){
  if(window.AccountAccess?.user)return window.AccountUI.signInPanel();
  return `<section class="account-card pn-access"><h1>${archive?'Mis partidas':'Mi cuaderno'}</h1><p>${archive?'Entra para retomar tus partidas guardadas.':'Entra para consultar tu progreso, tu colección y tus invitaciones.'}</p><div class="account-actions">${button('Iniciar sesión','auth-login','',true)}${button('Crear cuenta gratis','auth-register')}</div></section>`;
}

function playerViewModel(p,sessions,totals){const model=experienceModel();return {sessions,stories:window.STORIES,activeSessionId,pieces:journeyState?.completed??null,totals,canPlay:window.ClubAccess.canPlay,membership:window.ClubAccess.state,userId:p.userId,online,caseAllowed:id=>{const item=story(id);return !!item&&window.MonthlyAccess.allowed(item,{...model,sessions:[]});}};}
function notebookProgress(p,sessions,totals){return window.PlayerNotebook.progress(playerViewModel(p,sessions,totals));}
function button(text,action,attrs='',primary=false){const small=attrs.includes('class="small"');return `<button class="button${primary?' primary':''}${small?' small':''}" data-action="${action}" ${attrs.replace('class="small"','')}>${text}</button>`;}
function showSaveState(value){saveState=value;const status=$('#connection-status');if(status&&cloudMode&&online){status.dataset.save=value;status.textContent=value==='saving'?'Guardando…':value==='error'?'Sin guardar · reintenta':'Guardado';}}
async function api(path,body,method){
  const generation=accountGeneration,headers=body?{'Content-Type':'application/json'}:{};
  if(cloudMode)headers.Authorization='Bearer '+await window.AccountAccess.token();
  if(generation!==accountGeneration)throw new Error('La cuenta ha cambiado.');
  const write=!!body;if(write)showSaveState('saving');
  try{
    const response=await fetch(path,{method:method||(body?'POST':'GET'),headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:accountAbort.signal});
    let value;try{value=await response.json();}catch{throw new Error('No se ha podido conectar con el servidor.');}
    if(generation!==accountGeneration)throw new Error('La cuenta ha cambiado.');
    if(!response.ok){const error=new Error(typeof value.error==='string'?value.error:'No se pudo completar la acción.');error.status=response.status;error.code=value.code;if(response.status===401)window.AccountUI.expired();throw error;}
    if(write)showSaveState('saved');return value;
  }catch(error){if(write&&generation===accountGeneration)showSaveState('error');throw error;}
}
function upsert(s){const stop=journeyState?.stops?.find(p=>p.caseId===s.caseId);if(stop&&!stop.completed&&s.status!=='finished'){stop.status='in_progress';stop.sessionId=s.id;stop.decisions=s.history?.length||0;}const i=data.sessions.findIndex(x=>x.id===s.id);if(i<0)data.sessions.unshift(s);else data.sessions[i]=s;data.activeSessionId=s.id;save();}
function modal(html){$('#modal').classList.remove('media-dialog');$('#modal-content').innerHTML=html;$('#modal').showModal();}
function close(){ $('#modal').close(); $('#modal').classList.remove('media-dialog'); }
let mediaFilter='all';
const puzzleHintCounts=new Map();
const theoryChecks=new Map();
const mediaTypes={image:{label:'Imagen',icon:'◇'},audio:{label:'Audio',icon:'◉'},video:{label:'Vídeo',icon:'▷'},website:{label:'Web',icon:'↗'},pdf:{label:'PDF',icon:'▤'}};
function resolveAsset(src){
  const item=window.OFFLINE_ASSETS?.[src];
  if(!item)return src;
  if(typeof item==='string')return item;
  if(item.url)return item.url;
  if(item.base64)return 'data:'+(item.contentType||'application/octet-stream')+';base64,'+item.body;
  return 'data:'+(item.contentType||'text/plain')+';charset=utf-8,'+encodeURIComponent(item.body||'');
}
function mediaPlan(caseId){return caseId==='habitacion-309'?window.MEDIA_PLAN:window.SEASON_MEDIA?.[caseId];}
function discoveredMedia(s){
  const member=s?.members.find(m=>m.userId===me()?.userId);if(!member)return [];
  const scenes=new Set([s.nodeId,...(s.history||[]).map(h=>h.nodeId)]);
  return (mediaPlan(s.caseId)?.artifacts||[]).filter(a=>a.nodes?.some(n=>scenes.has(n))&&(s.mode==='solo'||a.roles?.includes(member.role))&&(!a.requiresStage||s.investigation?.stages?.[a.requiresStage]?.solvedAt));
}
function puzzleKey(s){return s.id+':'+(me()?.userId||'');}
function normaliseAnswer(value){return String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ');}
function puzzleAvailable(s){const puzzle=story(s.caseId)?.puzzle;if(!puzzle)return null;const scenes=new Set([s.nodeId,...(s.history||[]).map(h=>h.nodeId)]);return puzzle.unlockNodes?.some(id=>scenes.has(id))?puzzle:null;}
function puzzlePanel(s){const puzzle=puzzleAvailable(s);return puzzle?window.InvestigationUI.render(s,puzzle):'';}
function sceneHints(node){const hints=(node.hints?.length?node.hints:[node.hint]).filter(Boolean).slice(0,3);return `<section class="panel scene-hints"><h3>Una pequeña ayuda.</h3>${hints.map((hint,i)=>`<details><summary>Ayuda ${i+1}${i===0?' · una orientación':i===1?' · dónde mirar':' · la conexión'}</summary><p class="hint-box">${esc(hint)}</p></details>`).join('')}<p class="micro">Abridlas en orden y solo si las necesitáis. Pedir ayuda no resta puntos.</p></section>`;}

function transcriptBlock(a){return `<details class="media-transcript" data-game-transcript><summary>${a.type==='video'?'Leer el registro completo':a.type==='audio'?'Leer transcripción':'Leer versión accesible'}</summary><p>${esc(a.transcript||'')}</p></details>`;}
function mediaCard(a){
  const meta=mediaTypes[a.type]||{label:'Pista',icon:'◇'},src=resolveAsset(a.src),pilot=current()?.caseId==='habitacion-309';
  let content='';
  if(a.type==='audio')content=`<div class="audio-motif" aria-hidden="true"><span>♪</span><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><audio controls preload="none" src="${esc(src)}" aria-label="Escuchar ${esc(a.title)}">Tu navegador no reproduce este audio. La transcripción contiene toda la información.</audio><p class="media-origin">Voz sintética · mensaje ficticio</p>`;
  if(a.type==='video')content=`<video controls playsinline preload="metadata" src="${esc(src)}" aria-label="Ver y escuchar ${esc(a.title)}">Tu navegador no reproduce el vídeo. Consulta su transcripción.</video><p class="media-origin">Personaje y voz generados con IA · ficción</p><details class="audio-only"><summary>Escuchar sin imagen</summary><audio controls preload="none" src="${esc(src)}" aria-label="Solo audio de ${esc(a.title)}"></audio><p class="micro">Es el mismo testimonio, no una pista adicional.</p></details>`;
  if(a.type==='image')content=`<a class="evidence-image-link" href="${esc(src)}" target="_blank" rel="noopener" aria-label="Ampliar ${esc(a.title)}"><img class="evidence-image" src="${esc(src)}" alt="${esc(a.title)}. Descripción completa disponible debajo." loading="lazy"></a><a class="button" href="${esc(src)}" target="_blank" rel="noopener">Ampliar imagen ↗</a>`;
  if(a.type==='website')content=current()?.caseId==='cartas-medianoche'?window.SceneNavigation.archiveCard(a):`<div class="web-clue-preview ${pilot?'':'season-web-preview'}"><span class="web-clue-wordmark">${pilot?'BELLAMAR':'ARCHIVO DEL CASO'}</span><span>FUENTE FICTICIA · CONSULTA LOCAL</span><div>${esc(a.page?.title||a.title)}<br><em>Leed. Comparad. Conectad.</em></div></div><div class="actions">${button('Abrir el archivo web','open-evidence-web',`data-media="${esc(a.id)}"`)}</div><p class="media-origin">Web ficticia integrada en la historia</p>`;
  if(a.type==='pdf')content=`<div class="pdf-clue-preview" aria-hidden="true"><span>${pilot?'ARCHIVO / 309':'DOCUMENTO DEL EXPEDIENTE A'}</span><b>${esc(a.document?.title||a.title)}</b><i></i><i></i><i></i><span>LECTURA Y CONTRASTE</span></div><a class="button" href="${esc(src)}" download="${esc(a.id)}.pdf">Descargar el PDF</a><p class="media-origin">Documento ficticio · consulta o imprime a tu ritmo</p>`;
  return `<article class="media-card ${a.type==='image'?'image-card':a.type==='website'&&current()?.caseId==='cartas-medianoche'?'postal-card':''}" data-artifact="${esc(a.id)}"><div class="media-card-meta"><span>${meta.icon} ${meta.label}</span><span>EXPEDIENTE ${esc((a.roles||[]).join(' / '))}</span></div><h3>${esc(a.title)}</h3><p class="media-card-description">${esc(a.description)}</p>${content}${transcriptBlock(a)}<div class="clue-question"><span>AL EXAMINARLA, FIJAOS EN ESTO</span><p>${esc(a.question||'¿Qué confirma esta prueba y qué necesita otra fuente?')}</p></div></article>`;
}

function theoryPanel(s){
  const found=new Set([s.nodeId,...s.history.map(h=>h.nodeId)]);
  if(!['archivo','catalogo','resguardo'].some(id=>found.has(id)))return '';
  const key=s.id+':'+(me()?.userId||''),result=theoryChecks.get(key);
  return `<section class="theory-panel" aria-labelledby="theory-title"><div><span class="eyebrow sage">EL HALLAZGO ESTÁ ENTRE DOS PRUEBAS</span><h3 id="theory-title">Contrastar las versiones.</h3><p>El catálogo del hotel utiliza la referencia R-98-17 para justificar la propiedad de la Luna. Contrastadla con la imagen de la factura original.</p><p class="micro">Compartid lo que aparece en cada expediente. Esta comprobación es opcional y no cambia los puntos ni bloquea la historia.</p></div><form id="theory-form"><label class="field">¿Qué objeto identifica realmente R-98-17?<input name="answer" required maxlength="100" autocomplete="off" placeholder="Escribid el objeto que habéis encontrado" aria-describedby="theory-result"></label><button class="button" type="submit">Comprobar la conexión ↗</button><div id="theory-result" class="theory-result ${result?.correct?'correct':''}" role="status">${result?esc(result.message):''}</div></form></section>`;
}
function mediaDesk(s,ending){if(s.caseId==='cartas-medianoche')mediaFilter='all';
  const plan=mediaPlan(s.caseId);if(!plan)return puzzlePanel(s);
  const artifacts=discoveredMedia(s),types=[...new Set(artifacts.map(a=>a.type))];
  if(mediaFilter!=='all'&&!types.includes(mediaFilter))mediaFilter='all';
  const selected=artifacts.filter(a=>mediaFilter==='all'||a.type===mediaFilter),document=ending&&plan.finalDocuments?.[ending.id];
  const endingCard=document?.src?`<article class="ending-document"><span class="ending-document-symbol" aria-hidden="true">◇</span><div><span class="eyebrow sage">LA HUELLA DE VUESTRO DESENLACE</span><h3>${esc(document.title||ending.title)}</h3><p>${esc(document.description||'El documento correspondiente al final que habéis elegido.')}</p><a class="button light" href="${esc(resolveAsset(document.src))}" download="Desenlace_${esc(s.caseId)}_${esc(ending.id)}.pdf">Descargar vuestro desenlace</a><small>Documento ficticio del juego. No tiene validez legal.</small></div></article>`:'';
  return `<section class="media-desk" aria-labelledby="media-desk-title"><div class="media-desk-heading"><div><span class="eyebrow sage">ABRE · ESCUCHA · CONTRASTA</span><h2 id="media-desk-title">Tu mesa de pruebas.</h2><p>${s.mode==='solo'?'En solitario puedes consultar los dos expedientes.':'Estas son las pistas de tu expediente. Tu compañero tiene otras piezas de la historia.'}</p></div><span class="media-count">${artifacts.length} ${artifacts.length===1?'pista descubierta':'pistas descubiertas'}</span></div>${artifacts.length?`<div class="media-filters" aria-label="Filtrar pruebas por formato">${[['all','Todas'],...types.map(t=>[t,mediaTypes[t]?.label||t])].map(([id,label])=>`<button class="filter ${mediaFilter===id?'active':''}" type="button" data-action="media-filter" data-value="${esc(id)}" aria-pressed="${mediaFilter===id}">${esc(label)}</button>`).join('')}</div><div class="media-grid">${selected.map(mediaCard).join('')}</div>${s.caseId==='habitacion-309'?theoryPanel(s):puzzlePanel(s)}`:`<div class="media-locked"><div aria-hidden="true">◇ &nbsp; ♪ &nbsp; ▷ &nbsp; ▤</div><h3>El próximo hallazgo abre una nueva fuente.</h3><p>Elegid vuestra primera línea de investigación. Las imágenes, los audios y las páginas web aparecerán cuando lleguéis a la escena que los descubre.</p></div>`}${endingCard}<p class="media-access-note">Todos los materiales pertenecen a una obra de ficción. Cada formato aporta una parte diferente del caso. La transcripción o descripción accesible sustituye a su propia fuente; no es una pista adicional.</p></section>`;
}

function offlineWebDocument(src){
  const direct=window.OFFLINE_HTML?.[src]||window.OFFLINE_HTML?.[src+'index.html'];
  if(direct)return direct;
  const value=window.OFFLINE_ASSETS?.[src]||window.OFFLINE_ASSETS?.[src+'index.html'];
  if(!value)return null;
  if(typeof value==='object')return value.base64?new TextDecoder().decode(Uint8Array.from(atob(value.body),c=>c.charCodeAt(0))):value.body;
  if(value.startsWith('data:text/html')){const comma=value.indexOf(',');return value.slice(0,comma).includes(';base64')?new TextDecoder().decode(Uint8Array.from(atob(value.slice(comma+1)),c=>c.charCodeAt(0))):decodeURIComponent(value.slice(comma+1));}
  return null;
}
function restrictEvidenceLinks(html,s){
  const parser=new DOMParser(),doc=parser.parseFromString(html,'text/html'),available=new Set(discoveredMedia(s).map(a=>a.src));
  for(const artifact of mediaPlan(s.caseId)?.artifacts||[]){
    if(available.has(artifact.src))continue;
    for(const element of [...doc.querySelectorAll('[href],[src]')]){
      const source=element.getAttribute('href')||element.getAttribute('src')||'';
      if(source===artifact.src||source===resolveAsset(artifact.src)){
        const note=doc.createElement('span');note.textContent='Esta prueba pertenece al otro expediente o todavía no se ha descubierto.';element.replaceWith(note);
      }
    }
  }
  for(const element of doc.querySelectorAll('[href],[src]')){for(const attribute of ['href','src']){const path=element.getAttribute(attribute);if(path&&available.has(path))element.setAttribute(attribute,resolveAsset(path));}}
  return '<!doctype html>'+doc.documentElement.outerHTML;
}
async function openEvidenceWeb(id){
  const s=current(),a=s&&discoveredMedia(s).find(item=>item.id===id&&item.type==='website');if(!a)return;
  modal(`<span class="eyebrow sage">UNA WEB DENTRO DE LA INVESTIGACIÓN</span><h2 id="modal-title">${esc(a.title)}</h2><p class="media-modal-note">Archivo ficticio de «${esc(story(s.caseId)?.title)}». Consultadlo y contrastad sus datos con el otro expediente.</p><iframe id="evidence-web-frame" title="${esc(a.title)} · archivo ficticio" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer"></iframe><div class="actions">${button('Volver a nuestra mesa','close')}</div>`);
  $('#modal').classList.add('media-dialog');const frame=$('#evidence-web-frame');let documentHtml=offlineWebDocument(a.src);
  if(!documentHtml){try{const response=await fetch(a.src,{cache:'no-store'});if(response.ok)documentHtml=await response.text();}catch{}}
  if(documentHtml)frame.srcdoc=restrictEvidenceLinks(documentHtml,s);
  else frame.srcdoc=`<!doctype html><html lang="es"><meta charset="utf-8"><title>${esc(a.title)}</title><body style="font:18px/1.7 system-ui;padding:24px;background:#f6f0e4;color:#172a3b"><p>Archivo ficticio · versión accesible</p><h1>${esc(a.title)}</h1><p>${esc(a.transcript)}</p></body></html>`;
}

function mediaIsPlaying(){return [...document.querySelectorAll('audio,video')].some(el=>!el.paused&&!el.ended&&el.currentTime>0);}
document.addEventListener('click',async event=>{const control=event.target.closest('[data-action]');if(!control)return;if(control.dataset.action==='media-filter'){mediaFilter=control.dataset.value;render();}if(control.dataset.action==='open-evidence-web')openEvidenceWeb(control.dataset.media);if(control.dataset.action==='puzzle-hint'){const s=current();if(!s||control.disabled)return;control.disabled=true;try{const r=await api('/api/sessions/'+s.id+'/puzzle',{action:'hint',stage:control.dataset.stage});upsert(r.session);journeyState=r.journey;render();document.querySelector('.puzzle-hints')?.scrollIntoView({block:'nearest'});}catch(e){toast(e.message);control.disabled=false;}}});
document.addEventListener('submit',event=>{if(event.target.id!=='theory-form')return;event.preventDefault();const s=current();if(!s)return;const value=String(new FormData(event.target).get('answer')||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const correct=/\breloj\b/.test(value)&&!/(?:no\s+(?:es\s+)?(?:un\s+|el\s+)?)reloj\b/.test(value);const message=correct?'Conexión comprobada: R-98-17 identifica un reloj mural, no la Luna. El acuerdo mantiene la propiedad de Elvira. La ficha del catálogo mezcla una factura de otro objeto con una declaración de propiedad que las fuentes no sostienen.':'Volved a la línea «Concepto» de la factura original y comparad su referencia con el catálogo. El nombre de la joya en la web no demuestra que la factura corresponda a esa pieza.';theoryChecks.set(s.id+':'+(me()?.userId||''),{correct,message});$('#theory-result').textContent=message;$('#theory-result').className='theory-result'+(correct?' correct':'');});
document.addEventListener('submit',async event=>{if(event.target.id!=='puzzle-form')return;event.preventDefault();const s=current(),submit=event.target.querySelector('[type="submit"]');if(!s||submit.disabled)return;const answer=String(new FormData(event.target).get('answer')||'');submit.disabled=true;try{const r=await api('/api/sessions/'+s.id+'/puzzle',{answer,stage:event.target.dataset.stage});upsert(r.session);journeyState=r.journey;render();const result=document.querySelector('#puzzle-result');if(result){result.textContent=r.message;result.className='theory-result'+(r.correct?' correct':'');result.scrollIntoView({block:'nearest'});}if(r.correct&&r.complete===false)toast('Conexión guardada. Se ha abierto la siguiente prueba.');else if(r.correct)toast('Deducción guardada. '+(r.session.status==='finished'?'Tu pieza ya está en el plano.':'Termina la historia para recuperar tu pieza.'));}catch(e){toast(e.message);submit.disabled=false;}});
function lineArt(type='hotel'){
  if(type==='piece')return '<svg class="case-illustration blueprint-illustration" viewBox="0 0 600 360" fill="none" aria-hidden="true" focusable="false"><path d="M40 50h520M40 100h520M40 150h520M40 200h520M40 250h520M40 300h520M100 25v310M200 25v310M300 25v310M400 25v310M500 25v310" stroke="#a6c3d8" stroke-opacity=".13"/><rect x="51" y="31" width="498" height="298" rx="3" stroke="#c1d3dc" stroke-opacity=".35"/><path d="M235 53c-12 33 1 60 37 78M365 53c12 33-1 60-37 78" stroke="#b9cbd5" stroke-width="3"/><circle cx="300" cy="157" r="26" stroke="#e4d5ac" stroke-width="3"/><path d="M300 181c-49 31-77 63-61 96 18 38 103 38 121 0 16-33-12-65-60-96Z" fill="#d8c7a5" fill-opacity=".12" stroke="#e4d5ac" stroke-width="3"/><path d="M317 205c-21 6-34 23-30 41 5 20 23 28 43 24-12 17-41 22-59 5-23-24-6-58 19-67Z" fill="#e4d5ac" fill-opacity=".9"/><path d="M180 182h-45v106h46M420 182h45v106h-46M286 157h28M300 143v28M130 182h10M130 288h10M460 182h10M460 288h10" stroke="#bdcbd2" stroke-width="1.5"/><path d="M75 72h64m-64 11h40m321 209h82m-52 11h52" stroke="#c1d3dc" stroke-opacity=".6"/><circle cx="483" cy="75" r="16" stroke="#e4d5ac"/><path d="m473 75 7 7 13-15" stroke="#e4d5ac" stroke-width="2"/></svg>';
  if(type==='letters')return '<svg class="case-illustration envelope-illustration" viewBox="0 0 600 360" aria-hidden="true" focusable="false"><path d="M68 78c89-44 304-52 453 9M80 287c127 32 319 29 429-15" fill="none" stroke="#d4ac87" stroke-opacity=".35"/><g transform="rotate(-9 300 180)"><rect x="167" y="35" width="266" height="239" rx="3" fill="#efe4c8"/><path d="M200 79h187M200 98h159M200 118h177M200 138h128M200 170c38-8 54 13 85 0s45 3 74 0" fill="none" stroke="#8f7464" stroke-width="2" stroke-opacity=".6"/><path d="M196 56h52" stroke="#b47959" stroke-width="2"/></g><g transform="rotate(5 300 216)"><rect x="121" y="129" width="358" height="172" rx="3" fill="#d9c4a2"/><path d="m121 129 179 118 179-118" fill="#e6d6b6" stroke="#b9a17f" stroke-width="1.5"/><path d="m121 301 121-104M479 301 358 197" fill="none" stroke="#b9a17f" stroke-width="1.5"/><circle cx="300" cy="236" r="27" fill="#a64e3c"/><circle cx="300" cy="236" r="20" fill="none" stroke="#e2b091" stroke-opacity=".7"/><path d="M306 222c-13-2-22 10-15 21 5 9 18 10 24 2-10 2-18-13-9-23Z" fill="#e2b091"/></g><path d="m81 162 5 15 15 5-15 5-5 15-5-15-15-5 15-5ZM509 75l4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#c6916b"/></svg>';
  return '<svg class="case-illustration" viewBox="0 0 600 360" fill="none" aria-hidden="true" focusable="false"><path d="M110 335V35h380v300M154 335V74h292v261M220 335V142h160v193" stroke="#cbb78d" stroke-width="3"/><path d="M285 335V187h31v148" stroke="#cbb78d"/><circle cx="342" cy="263" r="6" fill="#cbb78d"/></svg>';
}
function clubTour(){location.hash='planes';}
function futureCase(){location.hash='casos';}
document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='club-tour')clubTour();if(b.dataset.action==='future-case')futureCase();});

function sessionRow(s){return `<div class="session-row"><div><h3>${esc(story(s.caseId)?.title||s.caseId)}</h3><small>${s.members.map(m=>esc(m.name)).join(' + ')} · ${s.status==='finished'?'Final descubierto':s.status==='waiting'?'Esperando al equipo':'Decisión '+((s.history?.length||0)+1)}</small></div>${button(s.status==='finished'?'Ver desenlace ↗':'Continuar ↗','resume',`data-id="${esc(s.id)}"`)}</div>`;}
function team(){if(cloudMode)return profile('pareja');const p=me();const people=data.profiles;return `<div class="title-row"><span class="eyebrow sage">NADIE VE TODAS LAS PISTAS</span><h1>Elige a tu<br><em>cómplice.</em></h1><p>Crea perfiles para jugar por turnos en este dispositivo. Los perfiles locales no son cuentas de acceso.</p><div class="actions">${button('Añadir un perfil','new-profile','',true)}</div></div>${people.length?`<div class="team-grid">${people.map(person=>`<article class="person"><div class="person-head">${avatar(person,true)}<div><h3>${esc(person.name)}</h3><span class="tagline">${person.userId===p?.userId?'TU PERFIL ACTIVO':'PERFIL DE ESTE DISPOSITIVO'}</span></div></div><div class="team-traits">${skillBars(E.totals(data.sessions,person.userId))}</div><div class="actions">${person.userId!==p?.userId?button('Usar este perfil','switch',`data-id="${esc(person.userId)}"`):''}<a class="button" href="/#casos">Elegir un juego</a></div></article>`).join('')}</div>`:`<div class="empty"><span class="small-star">♧</span><h3>Una buena historia empieza con alguien.</h3><p>Añade el primer perfil para empezar. Solo necesitamos un nombre o alias.</p></div>`}`;}
function traitIcon(key){
const drawings={inteligencia:'<path d="m24 5 18 19-18 19L6 24Z"/><path d="M6 24h36M24 5l-8 19 8 19 8-19Z"/>',perspicacia:'<path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24Z"/><circle cx="24" cy="24" r="6"/>',romanticismo:'<path d="M24 40 8 24C-4 11 14 1 24 14 34 1 52 11 40 24Z"/><path d="m16 24 5 5 11-11"/>',empatia:'<path d="M21 9H9a5 5 0 0 0-5 5v12a5 5 0 0 0 5 5h3l6 6v-6h3a5 5 0 0 0 5-5V14a5 5 0 0 0-5-5Z"/><path d="M30 17h9a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-3l-5 5v-5h-3M10 18h10M10 23h7"/>',creatividad:'<path d="M17 32c0-6-6-7-6-15a13 13 0 0 1 26 0c0 8-6 9-6 15Z"/><path d="M17 37h14M20 42h8M24 25v7M20 21l4 4 4-4M4 15H1M47 15h-3"/>',valentia:'<path d="m24 4 17 6v12c0 11-11 19-17 22C18 41 7 33 7 22V10Z"/><path d="m24 13-7 14h7l-2 10 10-17h-8Z"/>'};return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(drawings[key]||drawings.inteligencia)+'</svg>';
}
function signatureSeal(){return `<svg class="portrait-seal" viewBox="0 0 220 220" fill="none" aria-hidden="true"><circle cx="110" cy="110" r="93" stroke="currentColor" opacity=".2"/><circle cx="110" cy="110" r="75" stroke="currentColor" opacity=".25" stroke-dasharray="1 8"/><path d="m110 48 54 94H56Z" stroke="currentColor" opacity=".5"/><path d="m110 70 35 61H75Z" fill="currentColor" opacity=".06"/><circle cx="110" cy="48" r="8" fill="#b8c7ac"/><circle cx="164" cy="142" r="8" fill="#d6ac70"/><circle cx="56" cy="142" r="8" fill="#dfa5ad"/><path d="m110 90 16 20-16 20-16-20Z" stroke="currentColor" stroke-width="1.5"/><path d="M110 16v13M110 191v13M16 110h13M191 110h13" stroke="currentColor"/></svg>`;}
function skillBars(v,limit=0){const skills=window.ProfileModel.fromTotals(v).skills;return (limit?skills.slice(0,limit):skills).map(s=>`<div class="mini-trait ${s.key}"><div class="mini-trait-row"><span>${traitIcon(s.key)}${esc(s.label)}</span><strong>${s.points?esc(s.points)+' pts':'Por descubrir'}</strong></div><div class="mini-trait-track" aria-hidden="true"><i style="width:${s.progress}%"></i></div><small>${s.points?esc(s.stage):'Tu historia lo revelará'}</small></div>`).join('');}
function traitCard(s){return `<article class="trait-card ${s.key}"><div class="trait-card-head"><span class="trait-icon">${traitIcon(s.key)}</span><span class="trait-stage">${s.points?(s.level?'NIVEL '+s.level:'EN FORMACIÓN'):'POR DESCUBRIR'}</span></div><h3 class="trait-name">${esc(s.label)}</h3><p class="trait-subtitle">${esc(s.description)}</p><div class="trait-progress-label"><strong>${s.points?esc(s.stage):'Tu primera huella'}</strong><span>${s.points?esc(s.points)+' pts de juego':'Aún por explorar'}</span></div><div class="trait-progress" role="progressbar" aria-label="Avance hacia el siguiente hito de ${esc(s.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.progress}" aria-valuetext="${s.points} puntos de juego${s.nextThreshold===null?', último hito alcanzado':', próximo hito en '+s.nextThreshold+' puntos'}"><i style="width:${s.progress}%"></i></div><p class="trait-next">${s.nextThreshold===null?'Has alcanzado el último hito. Tu historia sigue creciendo.':s.points?`Te ${s.remaining===1?'falta 1 punto':'faltan '+s.remaining+' puntos'} para el siguiente hito.`:'Se descubre con las decisiones de tus casos.'}</p><details class="trait-evidence"><summary>¿Qué decisiones cuentan?</summary>${s.evidence.length?s.evidence.slice(0,2).map(e=>`<p><b>+${e.points} · ${esc(e.choiceLabel)}</b><br><small>${esc(e.caseTitle)} · ${esc(e.nodeTitle)}</small></p>`).join(''):'<p>Cuando una de tus elecciones aporte puntos a esta habilidad, aparecerá aquí con su escena. No hay una respuesta obligatoria: elegid el camino que os interese.</p>'}</details></article>`;}
function profile(initialSection){
  if(cloudMode&&!online)return notebookAccess();
  const p=me();if(!p)return `<div class="title-row"><span class="eyebrow sage">TU SELLO EN CADA HISTORIA</span><h1>Descubre cómo<br><em>juegas tú.</em></h1><p>Conecta pruebas, comprende a los personajes, imagina caminos y atrévete a elegir. Tus elecciones en las historias darán forma a tu estilo narrativo.</p>${button('Crear mi perfil','new-profile','',true)}</div>`;
  const model=window.ProfileModel.describe(data.sessions,p.userId,window.STORIES),t=model.totals,sessions=data.sessions.filter(s=>s.members.some(m=>m.userId===p.userId));
  const requested=initialSection||new URLSearchParams(location.hash.split('?')[1]||'').get('seccion');
  const section=['estilo','cuenta',...(cloudMode?['pareja','trayectoria','coleccion','logros','archivo-secreto','llaves']:[])].includes(requested)?requested:'progreso';
  const top='<div class="profile-dashboard">'+notebookHeader(p,section);
  if(section==='progreso')return top+notebookProgress(p,sessions,t)+'</div>';
  if(section==='trayectoria')return top+'<profile-collection data-career></profile-collection></div>';
  if(section==='coleccion')return top+'<profile-collection data-collection></profile-collection><lup-explorador collection></lup-explorador></div>';
  if(section==='logros')return top+'<profile-collection></profile-collection></div>';
  if(section==='archivo-secreto')return top+'<profile-collection data-archive></profile-collection></div>';
  if(section==='llaves')return top+'<profile-collection data-keys></profile-collection></div>';
  if(section==='pareja')return top+'<preferred-partner></preferred-partner><profile-partners></profile-partners></div>';
  if(section==='cuenta')return top+(cloudMode&&online?window.ClubAccess.account()+'<play-notice-preferences></play-notice-preferences>'+window.AccountUI.accountCard():'<p>Tu perfil se guarda en este dispositivo.</p>')+'</div>';
  const continuing=sessions.find(s=>s.status==='active');
  if(!model.hasDecisions)return top+'<section class="pn-career"><h2>Tu estilo de juego</h2><p>Tu primera decisión guardada mostrará cómo has abordado el caso y qué habilidades has usado.</p>'+
    (continuing&&window.ClubAccess.canPlay?button('Continuar mi historia','resume',`data-id="${esc(continuing.id)}"`,true):'<a class="button primary" href="/#casos">Explorar los juegos</a>')+'</section></div>';
  const decisions=model.recent.length?'<ol class="decision-list">'+model.recent.slice(0,3).map(item=>
    `<li><small>${esc(item.caseTitle)} · ${esc(item.nodeTitle)}</small><h4>${esc(item.choiceLabel)}</h4><div class="decision-tags">${E.KEYS.filter(key=>(item.points?.[key]||0)>0).map(key=>`<span class="${key}">+${item.points[key]} ${SKILLS[key]}</span>`).join('')}</div></li>`).join('')+'</ol>':
    '<p>Se conservan tus puntos. Estas partidas no tienen una preferencia individual guardada.</p>';
  return `${top}<section class="identity-panel" aria-labelledby="identity-title"><div class="identity-copy"><span class="identity-kicker">Mi estilo de juego</span><h2 id="identity-title" class="identity-title">${esc(model.signature.title)}</h2><p class="identity-description">${esc(model.signature.description)}</p><div class="profile-stats"><div><b>${t.decisions}</b><span>decisiones completadas</span></div><div><b>${t.finished}</b><span>historias terminadas</span></div><div><b>${t.endings}</b><span>finales descubiertos</span></div></div></div><div class="identity-emblem" aria-hidden="true">${signatureSeal()}</div></section>
    <section class="section" aria-labelledby="traits-title"><h2 id="traits-title">Mis habilidades</h2><div class="trait-grid">${model.skills.map(traitCard).join('')}</div></section>
    <div class="profile-lower section"><section class="decision-panel panel" aria-labelledby="decisions-title"><h2 id="decisions-title">Mis últimas decisiones</h2>${decisions}</section>
    <section class="badge-panel panel" aria-labelledby="badges-title"><h2 id="badges-title">Mis hitos</h2><div class="badge-grid">${model.achievements.map((a,i)=>`<article class="badge-item ${a.unlocked?'unlocked':''}"><span class="badge-icon" aria-hidden="true">${['✦','◇','✧','♧','❋','⌘'][i]}</span><div><h4>${esc(a.title)}</h4><p>${esc(a.description)}</p><span class="badge-state">${a.unlocked?'Conseguido':'Pendiente'}</span></div></article>`).join('')}</div></section></div>
    <details class="profile-note"><summary>Cómo se calculan mis habilidades</summary><p>Al completar una decisión se suman los puntos de tu primera preferencia, incluso si después acordáis otro camino. Cambiar de voto conserva la puntuación inicial.</p><p>Los hitos se alcanzan con 2, 6, 12 y 24 puntos por habilidad. Cada nueva partida conserva su recorrido y suma sus propias decisiones.</p></details></div>`;
}

function game(){const s=current();if(!s)return '<section class="empty"><h1>No hay una partida seleccionada</h1><a class="button primary" href="/#casos">Elegir un juego</a></section>';if(!window.ClubAccess.canPlay)return window.ClubAccess.gate();if(cloudMode&&!online)return window.AccountUI.signInPanel();const viewIndex=Math.min(sceneViews.get(s.id)??s.history.length,s.history.length),review=viewIndex<s.history.length,viewNode=review?s.history[viewIndex].nodeId:s.nodeId,c=story(s.caseId),n=c.nodes[viewNode],ending=c.endings[viewNode],p=me(),member=s.members.find(m=>m.userId===p?.userId)||s.members[0],role=member.role||'A',vote=s.votes?.find(v=>v.userId===p?.userId),ready=s.status==='active'&&!review;const ev=n?.evidence?.[role],editorial=c.id!=='cartas-medianoche'&&window.EscenaClasica;return `${editorial?'<div class="pe-partida">':''}<div class="game-top"><div><span class="eyebrow sage">${s.mode==='solo'?'EXPLORACIÓN INDIVIDUAL':'VUESTRA PARTIDA'}</span><h2>${esc(c.title)}</h2></div><a class="button small" href="#inicio">Salir al inicio ↗</a></div>${editorial?'<details class="pe-reference"><summary>Recorrido y puntuación</summary>':''}${c.season===1?`<p class="case-connection"><span aria-hidden="true">◉</span> Expediente ${c.episode} / 12 · En el reverso aparece la misma marca: un ojo y doce pequeñas señales. Su conexión se revela en el plano.</p>`:''}${c.id==='cartas-medianoche'?`<section class="cartas-intro"><img src="/cartas-portada.png" alt="Cuatro sobres en una oficina postal de noche. Imagen de ambientación, sin pistas."/><div><span class="eyebrow">Código Valdemar · EXPEDIENTE 01</span><h2>Cuatro cartas.<br>Veinte años de silencio.</h2><p>Descifra el mensaje. Reconstruye el desvío.<br>Decide qué ocurre cuando por fin llegan.</p><small>Ambientación y testimonio creados con IA · obra de ficción</small></div></section>`:''}${window.ExperienceUI.roadmap(s,c,viewIndex)}${c.id==='cartas-medianoche'?`<details class="cartas-scoring"><summary>Cómo puntuar · máximos y ayudas</summary>${window.ScoringGuide.panel(c,s,p?.userId)}</details>`:window.ScoringGuide.panel(c,s,p?.userId)}${editorial?'</details>':''}${review?'':window.ExperienceUI.reward(s,experienceModel())}${window.SceneNavigation.bar(s,c,viewIndex)}${editorial?editorial.shortcuts(s,ending,review,!!mediaPlan(s.caseId)):`<nav class="game-shortcuts" aria-label="Acciones de la escena"><button data-action="game-section" data-target="game-reading">1. Leer historia</button><button data-action="game-section" data-target="media-desk-title">2. Ver pistas</button><button data-action="game-section" data-target="game-choices">3. Elegir camino</button></nav>`}<div class="game-layout${editorial?' pe-layout':''}"><div>${editorial?editorial.chapter(s,c,n,ending,role,viewIndex===0):`<article class="chapter" id="game-reading" tabindex="-1">${ending?`<div class="ending-mark">✧</div><span class="eyebrow">VUESTRO DESENLACE · ${esc(ending.subtitle||'')}</span><h1>${esc(ending.title)}</h1>${(ending.text||[]).map(t=>`<p>${esc(t)}</p>`).join('')}${s.investigation?.solvedAt||c.season!==1?`<div class="evidence"><h3>Así encajaban las piezas.</h3><p>${esc(ending.explanation)}</p></div>`:`<p class="investigation-state">La explicación completa se abre al contrastar tu enigma. Tus decisiones narrativas ya están guardadas.</p>`}<p class="ending-reflection">${esc(ending.reflection)}</p>${c.season===1?`<p>${esc(ending.professionalCoda)}</p>${ending.romanticCoda&&ending.romanticCoda!==ending.professionalCoda?`<details class="optional-coda"><summary>Un momento más entre los dos</summary><p>${esc(ending.romanticCoda)}</p><p class="micro">Una escena opcional entre los personajes. Puedes leerla sin cambiar vuestro final ni la puntuación.</p></details>`:''}`:`<p>${esc(s.history.some(h=>(h.effects?.romanticismo||0)>0)?ending.romanticCoda:ending.professionalCoda)}</p>`}`:`<span class="eyebrow">${esc(n.chapter)} · ${esc(c.roles[role]?.name||'Investigador '+role)}</span><h1>${esc(n.title)}</h1>${viewIndex===0?`<details><summary>Antes de empezar: quiénes sois en esta historia</summary>${c.introduction.map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}${n.text.map(t=>`<p>${esc(t)}</p>`).join('')}${ev?`<div class="evidence"><div class="eyebrow">SOLO EN TU EXPEDIENTE · ${role}</div><h3>${esc(ev.title)}</h3><p>${esc(ev.text)}</p></div>`:''}${s.mode==='solo'&&n.evidence?.B?`<details><summary>Consultar también el expediente B</summary><div class="evidence"><h3>${esc(n.evidence.B.title)}</h3><p>${esc(n.evidence.B.text)}</p></div></details>`:''}`}</article>`}${mediaDesk(s,ending)}${ending?`<div id="game-epilogue" class="panel" tabindex="-1" style="margin-top:20px"><span class="eyebrow sage">EL EPÍLOGO ES VUESTRO</span><h3>Ahora, mirad cómo llegasteis hasta aquí.</h3><p class="muted">Revisad vuestras primeras preferencias, comentad el desenlace y guardad un recuerdo del camino acordado.</p><div class="actions">${button('Abrir nuestro epílogo','archive-open',`data-id="${esc(s.id)}"`,true)}<a class="button" href="#archivo">Ver nuestro archivo ↗</a></div><div class="actions" style="margin-top:15px"><a class="button primary" href="/#casos">Elegir otro juego</a><a class="button" href="#perfil">Ver mis habilidades ↗</a></div></div>`:review?window.SceneNavigation.choices(s,c,viewIndex,p?.userId,window.ScoringGuide):ready?`<div class="section-heading" id="game-choices" tabindex="-1" style="margin:24px 0 8px"><div><span class="eyebrow sage">VUESTRA PRÓXIMA PÁGINA</span><h3 style="margin:8px 0">¿Qué queréis hacer?</h3></div></div><div class="choices">${n.choices.map((v,i)=>`<button class="choice ${vote?.choiceId===v.id?'selected':''}" data-action="choose" data-choice="${esc(v.id)}" data-node="${esc(n.id)}" data-version="${s.version}" aria-pressed="${vote?.choiceId===v.id}" ${busy?'disabled':''}><span class="letter">${i?'B':'A'}</span><b>${esc(v.label)}</b><small>${esc(v.description)}</small>${window.ScoringGuide.chips(v)}</button>`).join('')}</div><div class="choice-status" role="status" aria-live="polite">${s.mode==='solo'?'Tu elección abre la siguiente escena.':s.votes?.length===2?'Habéis elegido caminos distintos. Conversad y cambiad un voto para avanzar juntos.':s.votes?.length?'Una preferencia registrada. Falta la elección del otro jugador.':'Cada persona elige desde su perfil. Avanzáis cuando ambos acordáis el mismo camino.'}</div>`:`<div class="waiting" id="game-choices" tabindex="-1"><h3>Falta tu compañero de investigación.</h3><p>Cuando se incorpore el segundo perfil podréis decidir juntos desde esta escena.</p>${!online?button('Añadir compañero','add-local-member'):button('Ver invitación','invite',`data-id="${esc(s.id)}"`)}</div>`}</div><aside class="game-side${editorial?' pe-rail':''}"><section id="game-team" class="panel${editorial?' pe-team':''}" tabindex="-1">${editorial?'':'<span class="eyebrow sage">LA MESA DE INVESTIGACIÓN</span>'}<h3 style="margin-top:10px">${editorial?(s.mode==='solo'?'Tu partida':'Vuestro equipo'):'Vuestro equipo.'}</h3>${s.members.map(m=>`<div class="member-row">${avatar(m)}<div><b>${esc(m.name)}${m.userId===p?.userId?' · tú':''}</b><small>Expediente ${m.role} · ${s.votes?.some(v=>v.userId===m.userId)?'Preferencia registrada':'Leyendo la historia'}</small></div>${!online&&m.userId!==p?.userId?`<button class="text-button" data-action="switch" data-id="${esc(m.userId)}">Cambiar</button>`:''}</div>`).join('')}<p class="micro">${online?'Los cambios se actualizan automáticamente.':s.mode==='solo'?'Tu partida se guarda en este dispositivo.':'Partida local: cambiad de perfil para leer las pistas y elegir por turnos.'}</p>${online&&s.ownerId===p?.userId&&s.status==='waiting'?button('Invitar al segundo jugador','invite',`data-id="${esc(s.id)}"`):''}${modeControl(s)}</section>${!ending?sceneHints(n):''}<section class="panel${editorial?' pe-history':''}">${editorial?'':'<span class="eyebrow sage">EL CAMINO RECORRIDO</span>'}<h3 style="margin-top:10px">Vuestras decisiones.</h3>${s.history.length?`<ol class="timeline">${s.history.map((h,i)=>`<li><button class="timeline-scene" data-action="scene-view" data-index="${i}">${esc(c.nodes[h.nodeId]?.title)}</button><small>${esc(c.nodes[h.nodeId]?.choices.find(x=>x.id===h.choiceId)?.label)}</small></li>`).join('')}</ol>`:'<p class="micro">Vuestra primera decisión abrirá el camino.</p>'}</section></aside></div>${editorial?'</div>':''}`;}
function archiveArgs(sessionId){return {cases:window.CASES,sessions:data.sessions,userId:me()?.userId,sessionId};}
function archivePage(){
  const p=me();
  if(cloudMode&&!online)return notebookAccess(true);
  if(!p)return '<section class="archive-landing"><h1>Mis partidas</h1><p>Crea tu perfil para guardar tus investigaciones.</p>'+button('Crear mi perfil','new-profile','',true)+'</section>';
  if(sealRequested()&&data.sessions.some(s=>s.members?.some(member=>member.userId===p.userId)&&story(s.caseId)?.season===1))return notebookNav('partidas')+window.ExperienceUI.map(experienceModel());
  const list=window.PlayerNotebook.archive(playerViewModel(p,data.sessions));
  const pieces=(journeyState?.completed||0)>0?'<p><a class="button" href="/#archivo?seccion=piezas">Ver mis piezas de Las doce noches</a></p>':'';
  const finished=data.sessions.some(s=>s.status==='finished' && s.members?.some(member=>member.userId===p.userId));
  const memories=finished?'<details class="archive-memories"><summary>Mis desenlaces guardados</summary>'+
    window.NightArchive.render(archiveArgs()).replace(/<h1(\s[^>]*)?>/,'<h2$1>').replace('</h1>','</h2>')+'</details>':'';
  return notebookNav('partidas')+list+'<aventuras-publicadas en-curso></aventuras-publicadas>'+pieces+memories+'<details class="pn-archive-options"><summary>Opciones de guardado</summary><div class="pn-actions">'+button('Reiniciar mi progreso','progress-reset-open')+'</div></details>';
}
function openProgressReset(){
  const userId=me()?.userId;
  if(!userId||cloudMode&&!online)return;
  const generation=accountGeneration,connected=online;
  const isCurrent=()=>generation===accountGeneration&&connected===online&&me()?.userId===userId;
  window.ProgressReset.open({
    online:connected,isCurrent,modal,
    async reset(requestId){
      if(connected){
        const result=await api('/api/me/progress/reset',{confirmation:'REINICIAR',requestId});
        if(result?.reset!==true)throw Error('No se ha podido confirmar el reinicio.');
      }else{
        const sessions=window.ProgressReset.resetLocalSessions(data.sessions,userId);
        const selected=current()?.members?.some(member=>member.userId===userId)?null:activeSessionId;
        const next={...data,sessions,activeSessionId:selected};
        localStorage.setItem(STORAGE,JSON.stringify(next));
        data=next;activeSessionId=selected;
      }
    },
    async refresh(){
      if(connected)await window.GameAccountBridge.load();
    },
    done(form){
      if(form.isConnected&&$('#modal').open)close();
      render();
      document.getElementById('pn-sessions-title')?.setAttribute('tabindex','-1');
      document.getElementById('pn-sessions-title')?.focus({preventScroll:true});
      const classics=data.sessions.filter(s=>s.members?.some(m=>m.userId===userId)).length;
      const completed=window.ClubAccess.state?.seasonAccess?.completed;
      const official=connected&&Array.isArray(completed)?' · '+completed.length+' desenlaces de temporada':'';
      toast('Progreso reiniciado. Partidas narrativas en tu perfil: '+classics+official+'.');
    }
  });
}
function downloadMemory(id){const file=window.NightArchive.exportSession(archiveArgs(id));if(!file)throw new Error('Este recuerdo no está disponible para tu perfil.');const url=URL.createObjectURL(new Blob([file.html],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=file.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Recuerdo descargado. Puedes guardarlo o imprimirlo.');}
function renderPendingAccount(route) {
  if(route==='como-se-juega')return window.ComoSeJuega.view();
  if(route==='accesibilidad') return displaySettings();
  const publicModel = { stories: window.STORIES || [], canPlay: false, sessions: [] };
  if (route === 'inicio') return window.ExperienceUI.home(publicModel);
  if (route === 'valdemar') return valdemarDetail({});
  if (route === 'desafios') return window.Colecciones.challenges();
  if (route === 'tableros') return window.Colecciones.boards();
  if (route === 'mapa') return seasonMap({});
  if (['expedicion','umbravia','necropolis'].includes(route)) return worldView(route,{});
  if (route === 'casos') return window.ValdemarCatalog.list({month:seasonMonth(),canPlay:false,openedMonths:[]});
  return '<div class="auth-loading" role="status">Cargando tu cuenta…</div>';
}
function updateSiteNavigation(route,personal,management){
  const section=new URLSearchParams(location.hash.split('?')[1]).get('seccion');
  const groups={aventura:'casos',valdemar:'casos',invitacion:'casos',
    partida:'archivo',equipo:'perfil',suscripcion:'perfil','alta-club':'planes','edicion-valdemar':'gestion'};
  let destination=groups[route]||route;
  if(['mapa','expedicion','umbravia','necropolis'].includes(route))destination=section==='ficha'?'casos':'tableros';
  if(['valdemar-jugar','mundos-jugar'].includes(route))destination=section==='reto'?'desafios':'casos';
  if(personal&&destination==='planes')destination='perfil';
  for(const link of document.querySelectorAll('[data-nav]')){
    const audience=link.dataset.navAudience;
    if(audience)link.hidden=audience==='member'?!personal:personal;
    if(link.dataset.nav==='gestion')link.hidden=!management;
    const active=!link.hidden&&link.dataset.nav===destination;
    link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current',route===destination?'page':'location');
    else link.removeAttribute('aria-current');
  }
}
function updatePageTitle(route){
  const fixed={aventura:'Aventura de autor',inicio:'Juegos de misterio online','como-se-juega':'Cómo se juega',casos:'Juegos',tableros:'Mapa de temporadas',perfil:'Mi cuenta',equipo:'Mi equipo',archivo:'Mis partidas',partida:'Mi partida',gestion:'Gestión'};
  let label=fixed[route];
  if(route==='casos'&&window.Colecciones)label='Juegos · '+window.Colecciones.catalogBoard().name;
  if(route==='valdemar'||route==='valdemar-jugar'){
    const item=window.ValdemarCatalog.get(seasonId());
    if(item)label=item.title+' · '+window.Colecciones.seasons[0].name;
  }
  if(route==='mundos-jugar'){
    const item=window.Mundos.story(seasonId());
    if(item)label=item.title+' · '+window.Mundos.nameOf(item.world);
  }
  const edition=window.Mundos?.edition?.(route);
  if(edition){
    const query=new URLSearchParams(location.hash.split('?')[1]);
    const item=query.get('seccion')==='ficha'&&window.Mundos.story(edition.offset+Number(query.get('lugar')));
    label=item?.world===route?item.title+' · '+edition.title:edition.title;
  }
  if(!label)label=document.querySelector('#main h1')?.textContent?.trim();
  document.title=(label?label.replace(/\s+/g,' ')+' · ':'')+'La Última Pieza';
}
function canonicalPage(){
  const [page,query]=location.hash.split('?');
  const retiredCatalog=['#archivo-clasico','#historias-clasicas','#catalogo-clasico','#casos-clasicos','#invitacion'];
  if(retiredCatalog.includes(page)||(!page&&document.body.dataset.featuredCase)){
    const month=new URLSearchParams(query).get('mes');
    const next='/#casos'+(['1','2','3'].includes(month)?'?mes='+month:'');
    history.replaceState(null,'',next);
  }else if(page==='#mapa-clasico'){
    history.replaceState(null,'','/#archivo?seccion=piezas');
  }
}
function render(){canonicalPage();window.CartasWorkspace?.capture();window.EscenaClasica?.clearMesa?.();const route=(location.hash.slice(1)||(document.body.dataset.valdemarCase?'valdemar':'inicio')).split('?')[0];if(route!=='valdemar-jugar')window.ValdemarPlayer?.clear();if(route!=='mundos-jugar')window.Mundos?.clear();const management=!accountLoading&&online&&window.ClubAccess.state?.canManage===true;document.body.classList.toggle('management-owner',management);document.querySelector('.management-nav').hidden=!management;if(route!=='gestion'||!management)window.ManagementUI?.clear();$('#membership-dock').hidden=true;updateSiteNavigation(route,!accountLoading&&(online||Boolean(me())),management);
const mapCrumb=window.Colecciones?.breadcrumb?.(route,seasonId());
if(mapCrumb)$('#breadcrumb').innerHTML=mapCrumb;
else $('#breadcrumb').textContent=({'como-se-juega':'Guía de juego',desafios:'Actividades opcionales',inicio:'Inicio',casos:'Catálogo',tableros:'Mapas y progreso',aventura:'MESA DE JUEGO','mundos-jugar':'LA PARTIDA',equipo:'TU EQUIPO',perfil:'MI CUADERNO',gestion:'GESTIÓN DE LA WEB',partida:'DENTRO DE LA HISTORIA',planes:'SUSCRIPCIÓN AL CLUB','alta-club':'SUSCRIBIRME AL CLUB',valdemar:'Código Valdemar','valdemar-jugar':'MESA DE JUEGO','edicion-valdemar':'Edición de Código Valdemar',archivo:'VUESTRO ARCHIVO',suscripcion:'MI SUSCRIPCIÓN'})[route]||'VUESTRO ESPACIO';
if(accountLoading){
  document.body.classList.toggle('postal-visitor',['inicio','como-se-juega','invitacion','valdemar','valdemar-jugar','casos','tableros','desafios','mapa','expedicion','umbravia','necropolis','mundos-jugar','planes','alta-club'].includes(route));
  for(const id of ['sidebar-profile','account-shortcut','mode-note']) document.getElementById(id).replaceChildren();
  $('#profile-button').textContent='+';
  $('#connection-status').textContent='Cargando cuenta…';
  $('#main').innerHTML=renderPendingAccount(route);
  if(route==='desafios')window.EditorialChallenges.mount();
if(route==='mapa')window.ValdemarPlano.mount();
  mountWorld(route);
  return;
}
const p=me();document.body.classList.toggle('postal-visitor', !p && !online && ['inicio','como-se-juega','invitacion','valdemar','valdemar-jugar','casos','tableros','desafios','mapa','expedicion','umbravia','necropolis','mundos-jugar','planes','alta-club'].includes(route));$('#sidebar-profile').innerHTML=p?`<a class="profile-mini" href="#perfil">${avatar(p)}<span><b>${esc(p.name)}</b><small>${online?'Tu cuenta':'Perfil local'}</small></span></a>`:(cloudMode?window.AccountUI.header():button('Crear mi perfil','new-profile'));$('#profile-button').innerHTML=p?portraitContent(p):'+';$('#connection-status').textContent=cloudMode?(accountLoading?'Cargando cuenta…':online?'Guardado':'Sin iniciar sesión'):'En este dispositivo';if(cloudMode&&online)showSaveState(saveState);$('#account-shortcut').innerHTML=cloudMode?window.AccountUI.header():'';$('#mode-note').innerHTML=window.ClubAccess.banner();const pageViews={aventura:()=>'<aventura-publicada></aventura-publicada>',inicio:homeWithPlans,casos:experienceCatalog,'como-se-juega':()=>window.ComoSeJuega.view(),accesibilidad:displaySettings,desafios:()=>window.Colecciones.challenges(window.ClubAccess.state?.seasonAccess),tableros:()=>window.Colecciones.boards(window.ClubAccess.state?.seasonAccess),expedicion:()=>worldView('expedicion',window.ClubAccess.state),umbravia:()=>worldView('umbravia',window.ClubAccess.state),necropolis:()=>worldView('necropolis',window.ClubAccess.state),'mundos-jugar':()=>window.Mundos.game(seasonId(),window.ClubAccess.state),valdemar:()=>valdemarDetail(window.ClubAccess.state),'valdemar-jugar':valdemarGame,'edicion-valdemar':()=>management?window.ValdemarEdicion.view():'<p>Acceso reservado a la propietaria.</p>',mapa:()=>seasonMap(online?window.ClubAccess.state:{}),equipo:team,perfil:profileWithSubscription,gestion:()=>management?window.ManagementUI.view():'<section class="account-card"><h1>Gestión de la web</h1><p>Esta sección está reservada a la cuenta propietaria.</p><a class="button" href="#perfil">Mi cuenta</a></section>',partida:game,planes:plans,'alta-club':enrollment,archivo:archivePage,suscripcion:subscription};
$('#main').innerHTML=Object.hasOwn(pageViews,route)?pageViews[route]():'<section class="account-card"><h1>Página no encontrada</h1><p>Comprueba la dirección o elige un destino.</p><div class="actions"><a class="button primary" href="/#inicio">Ir al inicio</a><a class="button" href="/#tableros">Ver las temporadas</a></div></section>';
if(route==='gestion'&&management)window.ManagementUI.mount();
updatePageTitle(route);
window.ClubAccess.mountRenewal?.();
if(route==='desafios')window.EditorialChallenges.mount();
if(route==='mapa')window.ValdemarPlano.mount();
mountWorld(route);
if(route==='mundos-jugar')window.Mundos.mountGame(seasonId(),window.GameAccountBridge,resumeCaseRequested());
if(route==='archivo')openRequestedSeal();
if(route==='edicion-valdemar'&&management)window.ValdemarEdicion.mount(window.GameAccountBridge);
if(route==='valdemar-jugar' && document.getElementById('valdemar-player')){const id=seasonId();window.ValdemarPlayer.render(id, window.GameAccountBridge,{catalogHref:'#casos?mes='+Math.ceil(id/4),resume:resumeCaseRequested()});}if(route==='partida'){const gameSession=current(),gameStory=story(gameSession?.caseId),sceneIndex=sceneViews.get(gameSession?.id)??gameSession?.history.length;window.CartasWorkspace?.mount(gameSession,gameStory,sceneIndex,p?.userId);window.EscenaClasica?.mountMesa?.(document.getElementById('main'),gameSession,gameStory,sceneIndex,p?.userId);}}
function profileModal(edit=false){if(cloudMode&&!online)return window.AccountUI.open();const p=edit?me():null;modal(`<span class="eyebrow sage">TU IDENTIDAD EN LA HISTORIA</span><h2 id="modal-title">${edit?'Editar mi perfil':'¿Cómo te llamamos?'}</h2><p>${online?'Tu perfil se vincula a tu sesión de acceso.':'Un nombre o alias para jugar en este dispositivo. No es necesario introducir correo ni contraseña.'}</p><form id="profile-form" data-edit="${!!edit}"><label class="field">Nombre o alias<input name="name" maxlength="32" minlength="2" required autocomplete="nickname" value="${esc(p?.name||'')}" placeholder="Tu nombre de investigador"></label>${window.ProfilePortraitPreview?.markup()||''}${avatarPicker(p)}<fieldset style="border:0;padding:0;margin:18px 0"><legend style="font-size:11px">Tu color</legend><div class="color-options">${COLORS.map((color,i)=>`<label class="color-option"><input type="radio" name="color" value="${color}" ${(p?.color||COLORS[0])===color?'checked':''}><span class="color-dot" style="background:${color}"></span><span class="sr-only">${['Terracota','Salvia','Rosa','Azul'][i]}</span></label>`).join('')}</div></fieldset><div id="form-error"></div><button class="button primary wide" type="submit">${edit?'Guardar cambios':'Crear mi perfil'} ↗</button></form>`);window.ProfilePortraitPreview?.mount(document.getElementById('profile-form'));}
let newPartnerFor=null;
function modeControl(s){
  if(s.ownerId!==me()?.userId||s.status==='finished')return '';
  return button(s.mode==='solo'?'Pasar a jugar en pareja':'Continuar en solitario','classic-mode-preview');
}
function previewClassicMode(){
  const s=current();
  if(!window.ClubAccess.canPlay||!s||s.ownerId!==me()?.userId||s.status==='finished')return;
  const solo=s.mode==='duo';
  const message=solo?(s.members.length===2?'Tu acompañante dejará de tener acceso a esta partida. Podrás volver a invitarle más adelante.':'La invitación pendiente quedará anulada.'):(online?'Podrás compartir un código privado. Cuando se una la otra persona recibiréis expedientes distintos y elegiréis juntos.':'Podrás elegir el segundo perfil para que compartáis las pistas y decidáis por turnos.');
  modal(`<h2 id="modal-title">${solo?'¿Continuar en solitario?':'¿Abrir la partida a otra persona?'}</h2><p>${message}</p><p>Conservas la escena actual, las decisiones acordadas y las pruebas resueltas.</p><div class="actions">${button(solo?'Continuar en solitario':'Pasar a jugar en pareja','classic-mode-confirm',`data-id="${esc(s.id)}" data-mode="${solo?'solo':'duo'}" data-version="${s.version}"`,true)}${button('Volver','close')}</div>`);
}
async function changeClassicMode(control){
  const s=current();
  if(!window.ClubAccess.canPlay||busy||!s||s.id!==control.dataset.id||s.ownerId!==me()?.userId)return;
  busy=true;control.disabled=true;
  try{
    const body={mode:control.dataset.mode,version:Number(control.dataset.version)};
    const result=online?await api('/api/sessions/'+encodeURIComponent(s.id)+'/mode',body,'PUT'):{session:E.changePlayMode(s,me().userId,body.mode,body.version)};
    upsert(result.session);close();render();
    if(body.mode==='solo'){toast('Ya puedes continuar desde ambos expedientes.');return;}
    if(online)await showInvite(s.id);
    else selectLocalPartner();
  }finally{busy=false;control.disabled=false;}
}
function selectLocalPartner(){
  const s=current();
  if(!window.ClubAccess.canPlay||online||!s||s.ownerId!==me()?.userId||s.status!=='waiting')return;
  const others=data.profiles.filter(profile=>profile.userId!==s.ownerId);
  modal(`<h2 id="modal-title">¿Con quién vas a jugar?</h2><p>El segundo perfil leerá el expediente B en esta pantalla.</p><div class="actions">${others.map(profile=>button(esc(profile.name),'pick-member',`data-id="${esc(profile.userId)}"`)).join('')}${button('Crear el segundo perfil','classic-new-partner')}</div>`);
}
function setup(){location.hash='casos';}

async function showInvite(id,code){if(!online){toast('Inicia sesión para invitar a alguien desde otro dispositivo.');return;}const s=data.sessions.find(s=>s.id===id);if(!code){const result=await api(`/api/sessions/${encodeURIComponent(id)}/invite`,{});code=result.inviteCode;}modal(`<span class="eyebrow sage">INVITACIÓN PRIVADA</span><h2 id="modal-title">Esta historia es para dos.</h2><p>Comparte este código con la persona que quieres añadir. Después de iniciar sesión, encontrará «Unirme con un código» en Mis partidas.</p><div class="invite-code" id="invite-code">${esc(code)}</div>${button('Copiar código','copy-code','',true)}<p class="micro">Generar otra invitación invalida el código anterior. La web conserva sus permisos de acceso actuales.</p>`);}
function join(){if(!online){modal(`<span class="eyebrow sage">JUGAR JUNTOS</span><h2 id="modal-title">Compartid esta pantalla.</h2><p>Esta vista guarda los perfiles en este dispositivo. Añade el perfil de tu compañero y seleccionad ambos al abrir una partida.</p><p>Inicia sesión para jugar desde dos dispositivos.</p>${button('Añadir otro perfil','new-profile','',true)}`);return;}if(!me()){profileModal();return;}modal(`<span class="eyebrow sage">TE ESTÁN ESPERANDO</span><h2 id="modal-title">Entrar en la historia.</h2><form id="join-form"><label class="field">Código de invitación<input name="code" required maxlength="160" autocomplete="off" spellcheck="false" placeholder="Pega aquí tu código"></label><div id="form-error"></div><button class="button primary wide" type="submit">Unirme a la partida ↗</button></form>`);}
document.addEventListener('click',async event=>{const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;try{
if(action==='progress-reset-open'){openProgressReset();return;}
if(action==='classic-mode-preview')return previewClassicMode();
if(action==='classic-mode-confirm')return await changeClassicMode(b);
if(action==='classic-new-partner'){const s=current();if(online||s?.ownerId!==me()?.userId||s?.status!=='waiting')return;newPartnerFor=s.id;close();profileModal();return;}
if(action==='scene-view'){const s=current(),i=Number(b.dataset.index);if(!s||!Number.isInteger(i)||i<0||i>s.history.length)return;sceneViews.set(s.id,i);render();document.querySelector('.scene-navigation')?.scrollIntoView({block:'start'});document.querySelector('#game-reading')?.focus({preventScroll:true});return;}
if(action==='revise-preview'){const s=current();if(!s||busy)return;modal(window.SceneNavigation.confirm(s,story(s.caseId),Number(b.dataset.index),b.dataset.choice));return;}
if(action==='revise-confirm'){if(busy)return;busy=true;b.disabled=true;try{const s=current(),body={index:Number(b.dataset.index),choiceId:b.dataset.choice,version:Number(b.dataset.version)};const result=online?await api('/api/sessions/'+encodeURIComponent(s.id)+'/revise',body):E.revise(s,me().userId,body.index,body.choiceId,body.version);upsert(result.session);if(result.journey)journeyState=result.journey;sceneViews.delete(s.id);close();render();document.querySelector('.scene-navigation')?.scrollIntoView({block:'start'});toast(result.transitioned?'Recorrido actualizado. Los puntos se han recalculado.':'Cambio propuesto. Tu compañero debe elegir para continuar.');}finally{busy=false;b.disabled=false;}return;}
if(action==='case-details'){const c=story(b.dataset.case);if(c?.id==='habitacion-309'){location.hash='casos';return;}if(c&&!me()){location.hash='casos';return;}if(c)modal(window.ExperienceUI.detail(c,experienceModel()));return;}
if(action==='open-map'){if($('#modal').open)close();location.hash='archivo?seccion=piezas';render();return;}
if(action==='game-section'||action==='page-section'){const target=document.getElementById(b.dataset.target);if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.focus({preventScroll:true});}return;}
if(['resume','choose','invite','pick-member','add-local-member'].includes(action)&&!window.ClubAccess.canPlay){if($('#modal').open)close();location.hash='planes';render();return;}if(action==='close'){newPartnerFor=null;return close();}if(action==='archive-open'){modal(window.NightArchive.renderSession(archiveArgs(b.dataset.id)));return;}if(action==='archive-download'){downloadMemory(b.dataset.id);return;}if(action==='profile'){location.hash='perfil';return;}if(action==='team'){location.hash='equipo';return;}if(action==='new-profile'){if($('#modal').open)close();return profileModal();}if(action==='edit-profile')return profileModal(true);if(action==='setup'){if($('#modal').open)close();return setup(b.dataset.partner,b.dataset.case);}if(action==='join')return join();if(action==='filter'){filter=b.dataset.value;render();return;}if(action==='switch'){if(online)return;data.activeId=b.dataset.id;save();render();toast('Ahora juega '+me().name);return;}if(action==='resume'){activeSessionId=b.dataset.id;data.activeSessionId=activeSessionId;save();if(online){const r=await api('/api/sessions/'+encodeURIComponent(activeSessionId));upsert(r.session);await api('/api/active-session',{sessionId:activeSessionId},'PUT');}location.hash='partida';render();return;}if(action==='invite')return await showInvite(b.dataset.id);if(action==='copy-code'){try{await navigator.clipboard.writeText($('#invite-code').textContent);toast('Código copiado.');}catch{const range=document.createRange();range.selectNodeContents($('#invite-code'));getSelection().removeAllRanges();getSelection().addRange(range);toast('Seleccionado. Copia el código con Ctrl+C.');}return;}if(action==='add-local-member')return selectLocalPartner();if(action==='pick-member'){const s=current(),p=data.profiles.find(profile=>profile.userId===b.dataset.id);if(!online&&s?.ownerId===me()?.userId&&p){upsert(E.joinTeam(s,p));close();render();}return;}if(action==='choose'){if(busy)return;const votingId=current()?.id,choice=b.dataset.choice;let moved=false;busy=true;b.disabled=true;try{const s=current(),body={nodeId:b.dataset.node,choiceId:b.dataset.choice,version:Number(b.dataset.version)};const result=online?await api(`/api/sessions/${encodeURIComponent(s.id)}/choose`,body):E.vote(s,me().userId,body.nodeId,body.choiceId,body.version);upsert(result.session);if(result.transitioned)sceneViews.delete(s.id);if(result.journey)journeyState=result.journey;moved=!!result.transitioned;toast(moved?'Habéis abierto un nuevo camino.':'Preferencia guardada.');}finally{busy=false;if(location.hash==='#partida'&&activeSessionId===votingId){render();if(moved)focusScene();else{const options=[...document.querySelectorAll('[data-action="choose"]')];(options.find(el=>el.dataset.choice===choice)||document.getElementById('game-choices'))?.focus({preventScroll:true});}}}return;}}catch(err){toast(err.message);if(['choose','revise-confirm','classic-mode-confirm'].includes(action)&&online){if(action==='classic-mode-confirm'&&$('#modal').open)close();await refreshGame();}}});
document.querySelector('#modal')?.addEventListener('cancel',()=>{newPartnerFor=null;});
document.addEventListener('submit',async event=>{const form=event.target;if(!['profile-form','join-form'].includes(form.id))return;event.preventDefault();const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;const values=new FormData(form);try{if(form.id==='profile-form'){const name=String(values.get('name')||'').trim();if(name.length<2||name.length>32)throw new Error('Escribe entre 2 y 32 caracteres.');const color=values.get('color'),avatarChoice=String(values.get('avatarChoice')||'detective');let p;if(online){p=(await api('/api/profile',{name,color,avatarChoice},'PUT')).profile;data.profiles=[p];}else{const edit=form.dataset.edit==='true';p={userId:edit?me().userId:E.uid(),name,color,avatar:avatarChoice};if(edit){data.profiles=data.profiles.map(x=>x.userId===p.userId?p:x);data.sessions.forEach(s=>s.members.forEach(m=>{if(m.userId===p.userId)Object.assign(m,{name,color,avatar:avatarChoice});}));}else data.profiles.push(p);}if(newPartnerFor&&!online){const id=newPartnerFor;newPartnerFor=null;const s=current();if(s&&s.id===id&&s.ownerId===me()?.userId&&s.status==='waiting'){upsert(E.joinTeam(s,p));close();render();toast('El segundo perfil ya puede jugar.');return;}}data.activeId=p.userId;save();close();render();toast('Perfil guardado.');return;}if(form.id==='join-form'){
    const code=String(values.get('code')||'').trim();
    if(!/^[A-Za-z0-9_-]{32}$/.test(code))throw new Error('Pega el código completo de 32 caracteres que te ha enviado tu cómplice.');
    const joined=await api('/api/join',{code});
    try{await window.GameAccountBridge.load();}catch(error){if(!online||error?.name==='AbortError')throw error;close();location.hash='archivo';render();toast('Tu incorporación está guardada. Recarga Mis partidas para recuperar el acceso.');return;}
    if(!data.sessions.some(item=>item.id===joined.session.id))throw new Error('Recarga Mis partidas para consultar tu acceso.');
    activeSessionId=joined.session.id;close();location.hash='partida';render();return;
  }}catch(err){const errorBox=$('#form-error');if(errorBox){errorBox.textContent=err.message;errorBox.className='error';}else if(err.name!=='AbortError')toast(err.message);submit.disabled=false;}});
function focusScene(){const section=document.getElementById('game-reading')||document.querySelector('.coop-workspace .mj-goal, .cartas-workspace .mj-goal, .coop-workspace .case-compass h3, .cartas-workspace .case-compass h3')||document.querySelector('main h1, main h2');if(section){if(!section.hasAttribute('tabindex'))section.tabIndex=-1;section.focus({preventScroll:true});section.scrollIntoView({block:'start'});}}
function gameFocusKey(element){if(!element)return '';if(element.id)return 'id:'+element.id;if(element.matches('summary'))return 'summary:'+element.textContent.trim();if(element.dataset.action)return [element.dataset.action,element.dataset.choice||element.dataset.index||element.dataset.target||element.dataset.id||element.textContent.trim()].join(':');return '';}
async function refreshGame(){
  if(!online||polling||busy||document.hidden||location.hash!=='#partida'||!activeSessionId)return;
  if(current()?.ownerId===me()?.userId&&($('#modal').open||mediaIsPlaying()))return;
  const id=activeSessionId;polling=true;
  try{const r=await api('/api/sessions/'+encodeURIComponent(id));
    if(activeSessionId!==id||location.hash!=='#partida'||busy||$('#modal').open||mediaIsPlaying()||JSON.stringify(r.session)===JSON.stringify(current()))return;
    const before=current(), changedScene=before?.nodeId!==r.session.nodeId, main=$('#main'), hadFocus=main.contains(document.activeElement), key=hadFocus?gameFocusKey(document.activeElement):'';
    const openPanels=new Set([...main.querySelectorAll('details[open] > summary')].map(gameFocusKey)), scroll=window.scrollY;
    upsert(r.session);if(r.journey)journeyState=r.journey;render();
    if(!changedScene){for(const summary of main.querySelectorAll('details > summary'))if(openPanels.has(gameFocusKey(summary)))summary.parentElement.open=true;}
    if(changedScene&&hadFocus){focusScene();return;}
    if(hadFocus&&key){const control=[...main.querySelectorAll('[id],[data-action],summary')].find(item=>gameFocusKey(item)===key&&!item.disabled);(control||main).focus({preventScroll:true});}
    window.scrollTo({top:scroll,behavior:'instant'});
  }catch(err){
    if(err.status===404&&id===activeSessionId&&online){
      if($('#modal').open)close();
      data.sessions=data.sessions.filter(session=>session.id!==id);activeSessionId=null;data.activeSessionId=null;sceneViews.delete(id);
      location.hash='archivo';render();
      try{await window.GameAccountBridge.load();render();}catch{}
      toast('Esta partida ha dejado de compartirse contigo.');
    }else if(err.name!=='AbortError')$('#connection-status').textContent='Sin sincronizar';
  }finally{polling=false;}
}
document.addEventListener('submit',async event=>{
 if(event.target.id!=='season-key-form')return;event.preventDefault();const form=event.target,submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
 try{const result=await api('/api/season/solve',{key:String(new FormData(form).get('key')||'')});journeyState=result.journey;render();document.querySelector('.secret-epilogue')?.scrollIntoView({block:'start',behavior:'smooth'});toast('La clave encaja. Tu epílogo secreto está abierto.');}
 catch(error){const box=document.querySelector('#season-key-error');if(box)box.textContent=error.message;submit.disabled=false;}
});
document.querySelector('a.skip')?.addEventListener('click',event=>{event.preventDefault();const main=$('#main');main.focus({preventScroll:true});main.scrollIntoView({block:'start'});});
window.addEventListener('hashchange',event=>{
  if($('#modal').open)close();
  const [oldRoute,oldQuery]=new URL(event.oldURL).hash.split('?');
  const [route,query]=location.hash.split('?');
  sealEntryPending = true;
  render();
  if(online && seasonAccountPages.has(route))window.GameAccountBridge.refreshSeasonAccess().catch(()=>{});
  const oldSection=new URLSearchParams(oldQuery).get('seccion');
  const newSection=new URLSearchParams(query).get('seccion');
  const staysOnMap=['#mapa','#expedicion','#umbravia','#necropolis'].includes(route)&&oldRoute===route&&oldSection!=='ficha'&&newSection!=='ficha';
  if(staysOnMap||(sealRequested()&&document.getElementById('cipher-title'))||window.ClubAccess.renewalRequested?.())return;
  window.scrollTo({top:0,behavior:'instant'});
  const main=$('#main');
  const worldChanged=route==='#casos' && (new URLSearchParams(oldQuery).get('mundo')||'mapa')!==(new URLSearchParams(query).get('mundo')||'mapa');
  const activeSelector=worldChanged?'.colecciones-catalog-nav [aria-current="page"]':'.notebook-nav [aria-current="page"],.month-nav [aria-current="page"],.vd-months [aria-current="page"]';
  const selected=route===oldRoute?main.querySelector(activeSelector):null;
  (selected||main).focus({preventScroll:true});
});
window.GameAccountBridge={
  playerId:()=>online?me()?.userId:null,
  playerName:()=>me()?.name||'',
  cloud(value){cloudMode=value;if(value)this.reset();},isCloud(){return cloudMode;},
  loading(value){accountLoading=value;render();},
  reset(){window.Mundos?.clear();window.ValdemarPlayer?.clear();window.ManagementUI?.clear();window.ClubAccess.set(null);journeyState=null;accountGeneration++;accountAbort.abort();accountAbort=new AbortController();accountLoading=false;online=false;saveState='saved';data={profiles:[],activeId:null,sessions:[]};activeSessionId=null;theoryChecks.clear();puzzleHintCounts.clear();sceneViews.clear();},
  async refreshSeasonAccess(){
    if(!online)return;
    const requestNumber=++seasonRead;
    const {availableCases,completed,seasons,nextPurchase,billingPlan}=await api('/api/valdemar/seasons');
    if(requestNumber!==seasonRead || !online)return;
    const seasonAccess={availableCases,completed,seasons,nextPurchase,billingPlan};
    if(JSON.stringify(window.ClubAccess.state.seasonAccess)===JSON.stringify(seasonAccess))return seasonAccess;
    window.ClubAccess.set({...window.ClubAccess.state,seasonAccess});
    if(seasonAccountPages.has(location.hash.split('?')[0]))render();
    return seasonAccess;
  },
  async load(){const state=await api('/api/bootstrap');window.ClubAccess.set(state.membership);journeyState=state.journey||null;data={profiles:[state.profile],activeId:state.profile.userId,sessions:state.sessions};activeSessionId=state.sessions.some(s=>s.id===state.activeSessionId)?state.activeSessionId:null;online=true;},
  async importLocal(session,localUserId){const result=await api('/api/import-local',{localSessionId:session.id,caseId:session.caseId,history:(session.history||[]).map(h=>({nodeId:h.nodeId,choiceId:h.choiceId,preferenceId:h.preferences?.[localUserId]||h.choiceId}))});upsert(result.session);if(result.journey)journeyState=result.journey;return result;},
  async request(path,body,method){
    const result=await api(path,body,method);
    if(result?.progress?.choice && /^\/api\/valdemar\/cases\/\d+\/ending$/.test(path)){
      // A failure reading the new pass must not undo an ending already saved on the server.
      result.seasonAccess=await this.refreshSeasonAccess().catch(()=>null);
    }
    return result;
  },
  isSignedIn:()=>online,async refresh(){await this.load();render();},applyJourney(value){journeyState=value;render();},render,modal,close,toast
};
setInterval(refreshGame,10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGame();});
async function init(){render();await window.AccountUI.start(window.GameAccountBridge);}
init();
})();
