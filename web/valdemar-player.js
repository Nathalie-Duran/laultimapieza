(() => {
  'use strict';
  let active;
  const views = [['desk','Expediente'],['game','Reto paralelo'],['dual','Mesa doble'],['help','Sobre de ayuda'],['ending','Resolver el caso']];
  const covers = ['tren-detenido','habitacion-309','ultima-invitacion','frecuencia-17','marea-quieta','retrato-prestado','archivo-ausencias','jardin-invierno','ciudad-invisible','mesa-13','cartas-medianoche','cuaderno-investigacion'];

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(label, action, style) {
    const control = element('button',label,style);
    control.type = 'button';
    control.addEventListener('click',action);
    return control;
  }
  function link(label, href, className) {
    const a = element('a',label,className);
    a.href = href;
    return a;
  }
  function announcement() {
    const node = element('p','','vd-status');
    node.setAttribute('role','status');
    return node;
  }
  function valid(c) {return c === active;}
  function sessionLive(c) {return valid(c) && c.bridge.isSignedIn();}
  function errorMessage(error) {
    if (error?.status === 401) return 'Tu sesión ha terminado. Entra de nuevo para recuperar la partida.';
    if (error?.status === 402 || error?.status === 403) return 'Esta historia requiere acceso activo a la temporada.';
    if (error?.code === 'CASE_NOT_RELEASED') return 'Esta historia se abre con un bloque posterior de tu suscripción.';
    return error?.message || 'La conexión se ha interrumpido. Puedes volver a intentarlo.';
  }
  function pauseAudio(node) {
    if(node) for(const sound of node.querySelectorAll('audio')) if(!sound.paused) sound.pause();
  }
  function clear() {
    if (!active) return;
    const previous = active;
    active = null;
    pauseAudio(previous.frame);
    previous.frame?.remove();
  }
  async function request(c, action, payload) {
    if (!sessionLive(c)) throw new Error('Inicia sesión para seguir jugando.');
    const result = await c.bridge.request('/api/valdemar/cases/'+c.id+(action?'/'+action:''),payload);
    if(!sessionLive(c)) throw new Error('La partida ya no está abierta.');
    return result;
  }
  async function run(c, key, operation, onError) {
    if(!sessionLive(c) || c.pending.has(key)) return;
    c.pending.add(key);
    try { await operation(); }
    catch(error) {
      if(!valid(c)) return;
      if([401,402,403].includes(error?.status) || error?.code==='CASE_NOT_RELEASED') {
        c.blocked=true;pauseAudio(c.frame);showFailure(c,error);
      } else if(error?.status===409 && (key==='help'||key==='ending')) {
        try {
          const latest=await request(c);
          c.data.progress=latest.progress;
          updateWallet(c,latest);
          renderEnding(c);
          c.bridge.toast?.(errorMessage(error));
        } catch { if(sessionLive(c))onError(error); }
      } else onError(error);
    } finally {c.pending.delete(key);}
  }

  // These modules come from the authenticated, same-origin case bundle.
  // Isolate their browser exports so switching accounts never reuses another player's module.
  async function loadEngines(c) {
    if (typeof c.data.gameScript !== 'string' || (c.id===1 && typeof c.data.stationScript!=='string')) throw new Error('El expediente todavía no está disponible.');
    const prelude = 'const window = {Retos:{},AudioContext:globalThis.AudioContext,webkitAudioContext:globalThis.webkitAudioContext,setTimeout:globalThis.setTimeout.bind(globalThis)};\n';
    const source = [prelude,c.data.gameScript,c.id===1?c.data.stationScript:'','\nexport default window;'];
    const url=URL.createObjectURL(new Blob(source,{type:'text/javascript'}));
    try {
      const module=await import(url);
      if(!valid(c)) return;
      c.game=module.default.Retos[c.id];
      c.station=module.default.muestraEstacion;
      if(typeof c.game?.mount!=='function' || (c.id===1 && typeof c.station!=='function')) throw new Error('Faltan los documentos de este expediente.');
    } finally {URL.revokeObjectURL(url);}
  }
  function selectView(c,view,focus=false) {
    if(!valid(c) || c.blocked) return;
    c.view=view;
    const desk=view==='desk'||view==='dual', game=view==='game'||view==='dual';
    if(!desk)pauseAudio(c.desk);
    c.desk.hidden=!desk;c.gamePanel.hidden=!game;c.pair.hidden=!desk&&!game;
    c.pair.classList.toggle('vd-dual',view==='dual');
    c.dualTools.hidden=view!=='dual';
    c.help.hidden=view!=='help';c.ending.hidden=view!=='ending';
    for(const [id,b] of c.viewButtons)b.setAttribute('aria-pressed',String(id===view));
    if(desk&&!c.deskMounted) {
      if(c.id===1)c.station(c.evidence);
      else window.montarMesa(c.evidence,c.data.sample,answer=>request(c,'sample',{answer}));
      c.deskMounted=true;
    }
    if(game&&!c.gameMounted) mountGame(c);
    if(focus){
      const target=view==='dual'?c.dualTools:desk?c.desk:game?c.gamePanel:view==='help'?c.help:c.ending;
      target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
    }
  }
  function buildDocuments(c) {
    const story=c.data.story;
    const roles=element('section',null,'vd-folders');
    roles.append(element('h3','Carpetas de investigación'));
    const roleBar=element('div',null,'vd-controls');
    roleBar.setAttribute('aria-label','Elegir carpeta de investigación');
    const privateArea=element('div',null,'vd-papers');
    let selected=null;
    function reveal(role) {
      selected=role;
      for(const b of roleBar.querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.role)===role));
      privateArea.replaceChildren();
      const label=role===0?story.solo:story.roles?.[role-1];
      if(label)privateArea.append(element('p',label,'vd-note'));
      const cards=(story.evidenceCards||[]).filter(card=>role===0 || Number(card.role)===role);
      for (const card of cards) {
        const fold=element('details',null,'vd-document');
        fold.append(element('summary',card.title),element('p',card.body));
        privateArea.append(fold);
      }
    }
    ['Papel 1','Papel 2','En solitario'].forEach((name,i)=>{
      const role=i===2?0:i+1;
      const b=button(name,()=>{if(selected!==role)reveal(role);});
      b.dataset.role=String(role);b.setAttribute('aria-pressed','false');roleBar.append(b);
    });
    privateArea.append(element('p','Elige tu carpeta para ver qué sabe tu personaje. En solitario puedes consultar las dos.','vd-note'));
    roles.append(roleBar,privateArea);
    return roles;
  }
  function buildDesk(c) {
    const story=c.data.story;
    c.desk=element('section',null,'vd-panel vd-desk');c.desk.tabIndex=-1;
    c.evidence=element('div',null,'vd-evidence');
    c.desk.append(element('h2','Mesa de investigación'),buildDocuments(c),element('h3','Pruebas compartidas'),c.evidence);
    c.desk.append(button('Contrastar la deducción final',()=>selectView(c,'ending',true),'vd-primary'));
  }
  function updateWallet(c,data) {
    if(data.wallet)c.data.wallet=data.wallet;
    if(Array.isArray(data.hints))c.data.hints=data.hints;
    const wallet=c.data.wallet;
    c.balance.textContent=wallet.balance===1?'1 llave':wallet.balance+' llaves';
    c.rewardStatus.textContent=wallet.won.includes(c.id)?'Ya has recibido la llave de este reto.':'La primera victoria en este reto añade una llave a tu suscripción.';
    renderHelp(c);
  }
  function renderHelp(c) {
    const {wallet,hints=[]}=c.data;
    const open=wallet.opened.includes(c.id);
    const help=c.help;
    const body=element('div'),status=announcement();
    if(!open) {
      body.append(element('p','Una llave abre las dos orientaciones de este caso. Podrás leerlas por separado y volver a consultarlas.'));
      if(wallet.balance>0) {
        const consume=button('Abrir el sobre · 1 llave',()=>run(c,'help',async()=>{
          consume.disabled=true;
          updateWallet(c,await request(c,'open',{}));
        },e=>{consume.disabled=false;status.textContent=errorMessage(e);}),'vd-primary');
        body.append(consume);
      } else {
        body.append(element('p','Tu llavero está vacío. Puedes seguir consultando las pruebas o ganar una llave en un reto pendiente.','vd-note'));
        if(!wallet.won.includes(c.id))body.append(button('Ir al reto paralelo',()=>selectView(c,'game',true),'vd-primary'));
        else body.append(link('Elegir otro caso',c.catalog,'vd-link'));
      }
    } else {
      body.append(element('h3','Primera orientación'),element('p',hints[0] || 'Recupera la partida para consultar esta orientación.','vd-clue'));
      if(hints.length>1) body.append(element('h3','Segunda orientación'),element('p',hints[1],'vd-clue'));
      else {
        const second=button('Leer la segunda orientación · incluida',()=>run(c,'help',async()=>{
          second.disabled=true;updateWallet(c,await request(c,'second',{}));
        },e=>{second.disabled=false;status.textContent=errorMessage(e);}));
        body.append(second);
      }
    }
    help.replaceChildren(element('h2','Sobre de ayuda'),body,status);
  }
  function trackGame(c,board,session) {
    const record = (event,select) => {
      if(session.overflow || session.finished || !valid(c))return;
      const target=select?event.target:event.target.closest?.('button');
      if(!target || !board.contains(target) || target.disabled || (select&&target.tagName!=='SELECT'))return;
      if(!select&&c.id===4&&['ref','actual'].includes(target.dataset.control))return;
      const all=Array.from(board.querySelectorAll('button,select'));
      const index=all.indexOf(target);
      if(index<0)return;
      if(session.moves.length>=1024) {
        session.overflow=true;
        c.rewardStatus.textContent='Este intento ha alcanzado el límite de movimientos. Puedes reiniciar el reto para intentar ganar la llave.';
        c.restart.hidden=false; return;
      }
      session.moves.push(select?[index,target.selectedIndex]:index);
    };
    board.addEventListener('click',e=>record(e,false),true);
    board.addEventListener('change',e=>record(e,true),true);
  }
  function mountGame(c) {
    const board=element('div',null,'vd-board');
    const session={moves:[],overflow:false,finished:false};
    c.board.replaceChildren(board);c.retryReward.hidden=true;c.restart.hidden=true;
    c.play=session;c.gameMounted=true;
    trackGame(c,board,session);
    c.game.mount(board,()=>{
      session.finished=true;
      if(!valid(c)||c.play!==session || session.overflow || c.data.wallet.won.includes(c.id))return;
      earn(c,session);
    });
  }
  function earn(c,session) {
    run(c,'reward',async()=>{
      c.retryReward.hidden=true;c.rewardStatus.textContent='Comprobando tu victoria…';
      const result=await request(c,'reward',{proof:{moves:session.moves}});
      updateWallet(c,result);
      c.rewardStatus.textContent='Victoria registrada. La llave de este reto se ha entregado a tu suscripción.';
    },e=>{
      c.rewardStatus.textContent=errorMessage(e);
      if(e?.status===422)c.restart.hidden=false;
      else c.retryReward.hidden=false;
    });
  }
  function buildGame(c) {
    c.gamePanel=element('section',null,'vd-panel vd-game');c.gamePanel.tabIndex=-1;
    c.board=element('div');
    c.rewardStatus=announcement();
    c.retryReward=button('Volver a comprobar la victoria',()=>earn(c,c.play));c.retryReward.hidden=true;
    c.restart=button('Reiniciar el reto',()=>mountGame(c));c.restart.hidden=true;
    c.gamePanel.append(element('p','Reto paralelo','vd-eyebrow'),element('h2',c.game.title),
      element('p',c.game.pitch,'vd-note'),c.board,c.rewardStatus,c.retryReward,c.restart,
      button('Consultar mi sobre',()=>selectView(c,'help',true),'vd-link'));
  }
  function decisionButtons(items,legend,submitLabel,submit,primary=true) {
    const form=element('form',null,'vd-decision');
    const group=element('fieldset');group.append(element('legend',legend));
    const choices=[];
    for(const item of items||[]){
      const label=element('label');const radio=element('input');
      radio.type='radio';radio.name='decision';radio.value=item.id;radio.required=true;
      label.append(radio,element('span',item.label));group.append(label);choices.push(radio);
    }
    const send=element('button',submitLabel,primary?'vd-primary':'');send.type='submit';
    const status=announcement();
    form.append(group,send,status);
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const chosen=choices.find(r=>r.checked);
      if(chosen && !send.disabled)submit(chosen.value,send,status);
    });
    return form;
  }
  function renderEnding(c) {
    const {story,progress}=c.data;
    const section=c.ending;
    section.replaceChildren(element('h2','Resolver el caso'));
    if(progress?.deduced) {
      if(progress.deduction)section.append(element('p',progress.deduction,'vd-clue'));
    } else {
      section.append(decisionButtons(story.hypotheses,story.challengePrompt || '¿Qué deducción explica las pruebas?','Contrastar mi hipótesis',(hypothesis,send,status)=>run(c,'deduction',async()=>{
        send.disabled=true;
        const result=await request(c,'deduce',{hypothesis});
        if(result.progress)c.data.progress=result.progress;
        if(result.correct){ renderEnding(c);c.ending.focus({preventScroll:true}); }
        else{send.disabled=false;status.textContent='La hipótesis deja pruebas sin explicar. Revisa las dos carpetas y los documentos compartidos.';}
      },e=>{send.disabled=false;status.textContent=errorMessage(e);})));
      return;
    }
    if(progress.choice) {
      const choice=story.choices.find(o=>o.id===progress.choice);
      section.append(element('h3','Tu desenlace'),element('p',choice?.label||'Decisión guardada','vd-eyebrow'),element('p',progress.outcome||'Tu decisión ha quedado guardada para esta historia.'),link('Regresar al catálogo',c.catalog,'vd-link'));
      return;
    }
    section.append(decisionButtons(story.choices,'¿Cómo termina vuestra historia? La decisión quedará guardada.','Guardar mi desenlace',(choice,send,status)=>run(c,'ending',async()=>{
      send.disabled=true;
      const result=await request(c,'ending',{choice});
      c.data.progress=result.progress;renderEnding(c);c.ending.focus({preventScroll:true});
    },e=>{send.disabled=false;status.textContent=errorMessage(e);})));
  }
  function build(c) {
    const {story}=c.data;
    const head=element('header',null,'vd-intro');
    const cover=element('img',null,'vd-cover');
    cover.src='/'+covers[c.id-1]+'.jpg';cover.alt='';head.append(cover);
    const headlinks=element('div',null,'vd-headlinks');c.balance=element('span','','vd-balance');
    c.balance.setAttribute('aria-live','polite');
    headlinks.append(link('Todas las historias',c.catalog,'vd-link'),c.balance);
    head.append(headlinks,element('p','Valdemar · Historia '+String(c.id).padStart(2,'0'),'vd-eyebrow'),element('h1',story.title),element('p',story.question,'vd-question'));
    if(story.intro)head.append(element('p',story.intro,'vd-narrative'));
    const nav=element('nav',null,'vd-tabs');nav.setAttribute('aria-label','Mesa de juego');
    c.viewButtons=new Map();
    for(const [id,label] of views){const b=button(label,()=>selectView(c,id));c.viewButtons.set(id,b);nav.append(b);}
    c.pair=element('div',null,'vd-pair');c.help=element('section',null,'vd-panel');c.ending=element('section',null,'vd-panel');
    c.help.tabIndex=-1;c.ending.tabIndex=-1;c.dualTools=element('div',null,'vd-dual-tools');c.dualTools.tabIndex=-1;
    c.dualTools.append(element('p','Una persona contrasta las pruebas y la otra intenta ganar la llave. Si juegas a solas, cambia de mesa cuando quieras.'),
      button('Ir a las pruebas',()=>{c.desk.focus();c.desk.scrollIntoView({block:'start'});}),
      button('Ir al tablero',()=>{c.gamePanel.focus();c.gamePanel.scrollIntoView({block:'start'});}));
    buildDesk(c);buildGame(c);renderEnding(c);updateWallet(c,c.data);
    c.pair.append(c.desk,c.gamePanel);
    c.frame.replaceChildren(head,nav,c.dualTools,c.pair,c.help,c.ending);
    selectView(c,c.data.progress?.choice?'ending':'desk');
  }
  function showFailure(c,e) {
    c.frame.replaceChildren(element('h1','La mesa de Valdemar'),element('p',errorMessage(e)));
    if(!c.bridge.isSignedIn() || e?.status===401){
      const login=element('button','Entrar','vd-primary');
      login.type='button';login.dataset.action='auth-login';c.frame.append(login);
    } else if(e?.status===402 || e?.code==='CASE_NOT_RELEASED') c.frame.append(link('Ver mi suscripción','#planes','vd-link'));
    else c.frame.append(button('Volver a intentar',()=>{const {id,bridge,catalog}=c;clear();render(id,bridge,{catalogHref:catalog});}));
    c.frame.append(link('Volver al catálogo',c.catalog,'vd-link'));
  }
  function render(value,bridge,options={}) {
    const id=Number(value),host=document.getElementById('valdemar-player');
    if(!host || !bridge)return;
    if(active?.id===id && active.bridge===bridge){
      if(host!==active.frame.parentElement)host.replaceChildren(active.frame);
      return;
    }
    clear();
    const catalog=options.catalogHref?.startsWith('#')?options.catalogHref:'#casos';
    const c={id,bridge,catalog,frame:element('div',null,'vd-player'),pending:new Set()};active=c;
    host.replaceChildren(c.frame);
    if(!Number.isInteger(id)||id<1||id>12){c.frame.append(element('p','Este expediente no existe.'),link('Volver al catálogo',catalog));return;}
    if(!sessionLive(c)){showFailure(c,{status:401});return;}
    c.frame.append(element('p','Abriendo el expediente…','vd-status'));c.frame.setAttribute('aria-busy','true');
    (async()=>{
      try{
        c.data=await request(c);await loadEngines(c);
        if(sessionLive(c))build(c);
      }catch(e){if(valid(c))showFailure(c,e);}
      finally{c.frame.removeAttribute('aria-busy');}
    })();
  }
  window.ValdemarPlayer={render,clear};
})();
