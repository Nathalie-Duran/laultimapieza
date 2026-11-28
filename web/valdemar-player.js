(() => {
  'use strict';
  let active;
  const views = [['desk','Expediente'],['game','Reto de aventura'],['help','Sobre de ayuda'],['ending','Resolver el caso']];
  const covers = ['tren-detenido','habitacion-309','ultima-invitacion','frecuencia-17','marea-quieta','retrato-prestado','archivo-ausencias','jardin-invierno','ciudad-invisible','mesa-13','cartas-medianoche','cuaderno-investigacion'];
  const coverDescriptions = [
    'Una cinta de casete descansa en el banco de un andén bajo la lluvia.',
    'Tres llaves de latón rodean el timbre de una recepción de hotel.',
    'Dos viajeros se miran frente a una carta en el último tren.',
    'Una onda de sonido ilumina la consola y el micrófono de una emisora.',
    'Un ferry navega entre dos faros al anochecer.',
    'Un reloj, un gemelo y un botón azul sobre el paño de la subasta.',
    'Una tira de negativos fotográficos bajo la luz roja del cuarto de revelado.',
    'Una camelia blanca descansa en un banco del invernadero.',
    'Planos superpuestos ante una puerta tapiada en una casa antigua.',
    'Dos sillas vacías y dos sobres en una mesa de boda.',
    'Dos manos dejan sus piezas de madera sobre el tablero de un club.',
    'Archivadores, un reloj de pared y un libro abierto en una oficina al atardecer.'
  ];

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
  function identity(bridge) {return bridge.isSignedIn()?(bridge.playerId?.()||true):false;}
  function valid(c) {return c===active&&c.identity===identity(c.bridge);}
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
    previous.modeControl?.destroy();
    previous.entryObserver?.disconnect();
    previous.scene?.destroy();
    previous.legacyExtra?.destroy();
    previous.legacyExplorer?.destroy();
    previous.navigation?.destroy();
    previous.mansionView?.destroy();
    previous.hourView?.pause();
    pauseAudio(previous.frame);
    previous.frame?.remove();
  }
  function reopen(c,resume=true) {
    if(!valid(c))return;
    clear();render(c.id,c.bridge,{catalogHref:c.catalog,resume,freshMode:!resume});
  }
  async function request(c, action, payload) {
    if (!sessionLive(c)) throw new Error('Inicia sesión para seguir jugando.');
    const body=payload===undefined?undefined:{...payload,partnerId:c.data?.partner?.id||null};
    const tracking=body!==undefined&&(c.navigation||c.scene);
    if(tracking)tracking.writing();
    let result;
    try {
      result=await c.bridge.request('/api/valdemar/cases/'+c.id+(action?'/'+action:''),body);
    } catch(error) {
      if(tracking&&valid(c))tracking.written(false);
      if(error.code==='PAIR_CHANGED')reopen(c);
      else if(action==='pair-state' && sessionLive(c) && [401,402,403].includes(error.status))showFailure(c,error);
      throw error;
    }
    if(!sessionLive(c)) throw new Error('La partida ya no está abierta.');
    if(tracking)tracking.written(result?.correct===false?null:true);
    return result;
  }
  async function run(c, key, operation, onError) {
    if(!sessionLive(c) || c.pending.has(key)) return;
    c.pending.add(key);
    try { await operation(); }
    catch(error) {
      if(!valid(c)) return;
      if([401,402,403].includes(error?.status) || error?.code==='CASE_NOT_RELEASED') {
        c.blocked=true;pauseAudio(c.frame);c.hourView?.pause();showFailure(c,error);
      } else if(error?.status===409 && (key==='help'||key==='ending')) {
        try {
          const latest=await request(c);
          c.data.progress=latest.progress;
          if(latest.hour){c.data.hour=latest.hour;c.hourView?.update(latest.hour);}
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
    const prelude = 'const window = {Retos:{},GamePreferences:globalThis.GamePreferences,AudioContext:globalThis.AudioContext,webkitAudioContext:globalThis.webkitAudioContext,setTimeout:globalThis.setTimeout.bind(globalThis)};\n';
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
    if(c.navigation){
      const key={desk:'evidencias',hotel:'escenario',help:'pistas',game:'extra',ending:'desenlace'}[view]||view;
      if(!c.navigation.show(key,focus))return;
      if(c.view!==key){c.hourView?.pause();pauseAudio(c.frame);}
      c.view=key;c.frame.dataset.openExtra=String(key==='extra');
      if(key==='pistas')renderHelp(c);
      if(key==='extra'&&!c.gameMounted)mountGame(c);
      return;
    }
      if(view==='game'&&c.view&&view!==c.view)c.scene?.rememberExtra(c.view);
    if(view!==c.view)c.hourView?.pause();
    if(view==='help' && c.view!=='help'){
      c.helpFrom=c.view||'desk';
      renderHelp(c);
    }
    c.view=view;
    c.frame.dataset.openExtra=String(view==='game');
    const game=view==='game', desk=view==='desk';
    if(!desk)pauseAudio(c.desk);
    c.desk.hidden=!desk;c.gamePanel.hidden=!game;c.pair.hidden=!desk&&!game;
    c.help.hidden=view!=='help';c.ending.hidden=view!=='ending';
    if(c.hotel)c.hotel.hidden=view!=='hotel';
    for(const [id,b] of c.viewButtons)b.setAttribute('aria-pressed',String(id===view));
    if(desk&&!c.deskMounted) {
      if(c.id===1){if(!c.data.hour)c.station(c.evidence);}
      else window.montarMesa(c.evidence,c.data.sample,answer=>request(c,'sample',{answer}));
      c.deskMounted=true;
    }
    if(game&&!c.gameMounted) mountGame(c);
    const target=game?c.gamePanel:desk?c.desk:view==='hotel'?c.hotel:view==='help'?c.help:c.ending;
    c.scene?.returnFrom(target);
    if(focus){
      if(c.frame.dataset.playMode==='pending'){
        c.modeControl.entry.querySelector('button')?.focus();return;
      }
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
      const label=role===0?(c.modeControl?.mode==='solo'?'Aquí están los documentos de ambos papeles.':story.solo):story.roles?.[role-1];
      if(label&&!c.scene)privateArea.append(element('p',label,'vd-note'));
      const cards=(story.evidenceCards||[]).filter(card=>role===0||card.role==null||card.role==='AB'||card.role===(role===1?'A':'B')||Number(card.role)===role);
      for (const card of cards) {
        const fold=element('details',null,'vd-document');
        fold.append(element('summary',card.title),element('p',card.body));
        privateArea.append(fold);
      }
    }
    c.showModePaper=paper=>{
      const role=paper==='A'?1:paper==='B'?2:0;
      if(selected!==role)reveal(role);
    };
    ['Papel 1','Papel 2','En solitario'].forEach((name,i)=>{
      const role=i===2?0:i+1;
      const b=button(name,()=>{
        if(!c.data.partner && selected!==role)reveal(role);
      });
      b.dataset.role=String(role);b.setAttribute('aria-pressed','false');roleBar.append(b);
    });
    privateArea.append(element('p','Elige tu carpeta para ver qué sabe tu personaje. En solitario puedes consultar las dos.','vd-note'));
    roles.append(roleBar,privateArea);
    return roles;
  }
  function buildDesk(c) {
    const story=c.data.story;
    c.desk=element('section',null,'vd-panel vd-desk');c.desk.tabIndex=-1;
    c.desk.id='vd-expediente-'+c.id;
    c.evidence=element('div',null,'vd-evidence');
    c.desk.append(element('h2','Mesa de investigación'));
    if(c.data.hour && window.ValdemarHour){
      const hourNode=element('div');c.desk.append(hourNode);
      c.hourView=window.ValdemarHour.mount(hourNode,c.data.hour,{
        caseId:c.id,hotelNode:c.hotel,role:c.data.partner?.role,station:c.id===1,
        present:c.id>1&&c.scene?table=>c.scene.present(table):null,
        onScene:(hour,main)=>{c.scene?.update(hour);if(c.view==='desk')c.scene?.returnFrom(main);},
        sceneRoute:Boolean(c.scene),sceneBack:c.scene?target=>c.scene.returnFrom(target):null,
        inventory:async input=>{
          const result=await request(c,'inventory',input);
          c.scene?.inventory(result.inventory);
          if(result.wallet)updateWallet(c,result);
          return result;
        },
        submit:(index,choice,sources)=>request(c,'stage',{index,choice,...(sources?{sources}:{})}),
        reload:async()=>{const latest=await request(c);c.data.progress=latest.progress;return latest.hour;},
        change:hour=>{c.data.hour=hour;renderEnding(c);},
        visitHotel:()=>selectView(c,'hotel',true),
        finish:()=>selectView(c,'ending',true)
      });
    }
    if(c.id===1 && c.hourView)return;
    c.desk.append(buildDocuments(c),element('h3','Pruebas compartidas'),c.evidence);
    if(!c.scene)c.desk.append(button('Contrastar la deducción final',()=>selectView(c,'ending',true),'vd-primary'));
  }
  function updateWallet(c,data) {
    window.Keyring.update(c.data,data);
    const wallet=c.data.wallet;
    c.balance.textContent=wallet.balance===1?'1 llave':wallet.balance+' llaves';
    const prize=wallet.won.includes(c.id)?'Premio del reto recibido':c.data.parallelPrize+(c.data.parallelPrize===1?' llave':' llaves')+' al resolverlo por primera vez';
    if(c.legacyExtra)c.legacyExtra.update({progress:prize});
    else if(!c.scene||!window.MesaDeJuego)c.rewardStatus.textContent=prize;
    else if(c.view==='game')c.scene.returnFrom(c.gamePanel);
    renderHelp(c);
  }
  function renderHelp(c) {
    const help=c.help, envelope=element('div',null,'vd-letter'),body=element('div',null,'vd-letter-body');
    envelope.dataset.open=String(c.data.hintOptions.some(option=>option.text));
    window.Keyring.render(body,{id:c.id,data:c.data,buttonClass:'vd-link',play:()=>selectView(c,'game',true),
      buy:async (op,quotedCost)=>{updateWallet(c,await request(c,op,{quotedCost}));help.focus({preventScroll:true});}});
    const from=c.helpFrom||'desk';
    const backLabel={game:'Volver al reto',hotel:'Volver a la recepción',ending:'Volver a la resolución',desk:'Volver al expediente'}[from];
    if(c.id===2)window.HotelCuaderno?.hints(body,c.data);
    envelope.append(element('h2',c.id===2?'Sobre de la gobernanta':'Sobre de ayuda'),body);
    if(!c.navigation)envelope.append(button(backLabel,()=>selectView(c,from,true),'vd-link'));
    help.replaceChildren(envelope);
    if(c.view==='help')c.scene?.returnFrom(help);
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
      if(!valid(c)||c.play!==session || session.overflow)return;
      if(c.data.wallet.won.includes(c.id)){c.rewardStatus.textContent='Reto resuelto de nuevo. El premio ya está en tu historial.';c.restart.hidden=false;return;}
      earn(c,session);
    });
  }
  function earn(c,session) {
    run(c,'reward',async()=>{
      c.retryReward.hidden=true;c.rewardStatus.textContent='Comprobando tu victoria…';
      const result=await request(c,'reward',{proof:{moves:session.moves}});
      updateWallet(c,result);
      c.rewardStatus.textContent='Victoria registrada. Has ganado '+c.data.parallelPrize+(c.data.parallelPrize===1?' llave.':' llaves.');c.restart.hidden=false;
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
    const title=c.game.title,meta=c.id>1?window.RetosTemporada?.ficha(c.id):null;
    const heading=window.AventuraEscena.challengeHeader({
      id:c.id,world:'valdemar',title,caseTitle:c.data.story.title,embedded:!c.scene||c.id<=4,
      photo:meta?.photo||(c.id===1?'/tren-detenido.jpg':'/valdemar-art-'+String(c.id).padStart(2,'0')+'.webp')
    });
    c.gamePanel.append(heading);
    if(!c.scene&&!c.navigation){
      const links=heading.querySelector('.reto-cabecera-nav');
      links.append(button('Volver al escenario',()=>selectView(c,'desk',true),'ae-back'));
      if(window.MesaDeJuego){
        const mesa=element('div',null,'ae-mesa');c.gamePanel.append(mesa);
        c.legacyExtra=window.MesaDeJuego.mount(mesa,{family:'valdemar',title,objective:c.game.pitch,help:{context:'reto',text:c.game.pitch}});
      }else {const help=element('gameplay-help');help.setAttribute('context','reto');links.append(help);}
    }
    if(!c.legacyExtra)c.gamePanel.append(element('p',c.game.pitch,'vd-note'));
    if(c.id===1)c.gamePanel.append(element('p','Cada persona ve las vías de su época. Acordad una dirección en voz alta y pulsadla en las dos pantallas. Si os equivocáis, deshaced el movimiento en ambas.','vd-station-duo'));
    c.gamePanel.append(c.board,c.rewardStatus,c.retryReward,c.restart);
    if(!c.navigation)c.gamePanel.append(button('Consultar mi sobre',()=>selectView(c,'help',true),'vd-link'));
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
    c.scene?.update(c.data.hour);
    const {story,progress}=c.data;
    const section=c.ending;
    section.replaceChildren(element('h2','Resolver el caso'));
    if(c.view==='ending')c.scene?.returnFrom(section);
    if(!progress?.choice && c.data.hour?.stage) {
      const hour=c.data.hour;
      section.append(element('p','Estás en la etapa '+(hour.current+1)+' de '+hour.stages.length+'. Completa el recorrido para contrastar la deducción final.','vd-note'),
        button('Volver a '+hour.stage.title,()=>selectView(c,'desk',true),'vd-primary'));
      return;
    }
    if(progress?.deduced) {
      if(progress.deduction)section.append(element('p',progress.deduction,'vd-clue'));
    } else {
      section.append(decisionButtons(story.hypotheses,story.challengePrompt || '¿Qué deducción explica las pruebas?','Contrastar mi hipótesis',(hypothesis,send,status)=>run(c,'deduction',async()=>{
        send.disabled=true;
        const result=await request(c,'deduce',{hypothesis});
        if(result.progress)c.data.progress=result.progress;
        if(result.correct){ renderEnding(c);c.ending.focus({preventScroll:true}); }
        else{send.disabled=false;status.textContent='La hipótesis deja pruebas sin explicar. Revisa las dos carpetas y los documentos compartidos.';}
      },e=>{send.disabled=false;status.textContent=errorMessage(e);})),
        button('Revisar el expediente',()=>selectView(c,'desk',true),'vd-link'));
      return;
    }
    if(progress.choice) {
      const choice=story.choices.find(o=>o.id===progress.choice);
      const outcome=element('article',null,'vd-outcome');
      outcome.append(element('h3','Tu desenlace'),element('p',choice?.label||'Decisión guardada','vd-eyebrow'),element('p',progress.outcome||'Tu decisión ha quedado guardada para esta historia.'));
      section.append(outcome,window.SellosTemporada.afterCase(c.id,c.bridge,c.endingAccess),link('Regresar al catálogo',c.catalog,'vd-link'));
      const summary=element('aventura-resumen');summary.dataset.case=String(c.id);summary.dataset.navigation='seal';section.append(summary);
      return;
    }
    section.append(decisionButtons(story.choices,'¿Cómo termina vuestra historia? La decisión quedará guardada.','Guardar mi desenlace',(choice,send,status)=>run(c,'ending',async()=>{
      send.disabled=true;
      const result=await request(c,'ending',{choice});
      c.data.progress=result.progress;c.endingAccess=result.seasonAccess;renderEnding(c);c.ending.focus({preventScroll:true});
    },e=>{send.disabled=false;status.textContent=errorMessage(e);})));
  }
  function attachModeControl(c,host,story,save,onPaper,options) {
    c.modeControl=window.ModalidadJuego.create(c.frame,story,c.data.mode,save,onPaper,options);
    host.append(c.modeControl.entry);
  }
  function blockEntry(c,{title,question,photo,alt,mode,modeHelp,locked}={}) {
    const number=String(c.id).padStart(2,'0'),item=window.ValdemarCatalog?.get(c.id)||{};
    const block=Math.ceil(c.id/4);
    const entry=element('header',null,'vd-block-entry'),nav=element('nav',null,'vd-block-links');
    nav.setAttribute('aria-label','Navegación del juego');
    nav.append(link('Volver a la ficha','/valdemar/'+number+'/'),link('Ver en el plano','/#mapa?mes='+block+'&lugar='+c.id));
    if(c.balance)nav.append(c.balance);
    const content=element('div',null,'vd-block-cover'),copy=element('div',null,'vd-block-copy');
    const photoNode=element('img',null,'vd-block-photo');
    photoNode.src=photo||item.image||'/valdemar-art-'+number+'.webp';
    photoNode.alt=alt||item.coverAlt||'';photoNode.width=768;photoNode.height=512;photoNode.decoding='async';
    const heading=element('h1',title||item.title||'Código Valdemar');heading.tabIndex=-1;
    const pitch=element('p',question||item.question,'vd-block-pitch');
    copy.append(element('p','Código Valdemar · Bloque '+block+' · Juego '+number,'vd-block-label'),heading,pitch);
    if(mode){
      const setup=element('details',null,'vd-block-mode'),summary=element('summary');
      const description=element('p',modeHelp||'A solas, investigas con los dos papeles. En pareja, cada persona abre su carpeta desde su cuenta y compartís los hallazgos.','vd-block-mode-note');
      setup.append(summary,mode.entry,description);copy.append(setup);
      let previous;
      function sync(){
        const current=c.frame.dataset.playMode||'pending';
        if(previous===current)return;
        const selecting=setup.contains(document.activeElement);
        setup.open=current==='pending';
        summary.textContent=current==='pending'?'Cómo quieres jugar':'Modalidad · '+(current==='duo'?'En pareja':'En solitario');
        description.hidden=current!=='pending';entry.dataset.state=current==='pending'?'entry':'playing';
        if(previous==='pending'&&current!=='pending'&&selecting)heading.focus({preventScroll:true});
        previous=current;
      }
      sync();c.entryObserver=new MutationObserver(sync);
      c.entryObserver.observe(c.frame,{attributes:true,attributeFilter:['data-play-mode']});
    }else entry.dataset.state='entry';
    if(locked)copy.append(locked);
    content.append(photoNode,copy);entry.append(nav,content);
    c.frame.dataset.blockEntry='true';
    return entry;
  }
  function initialView(c,section){
    if(section==='reto')return 'extra';
    if(['pistas','extra','inventario','escenario','evidencias'].includes(section))return section;
    if(section==='resolver'&&c.data.hour.stage)return 'resolver';
    if(!c.data.hour.stage)return 'desenlace';
    if(c.id===4)return 'escenario';
    if(c.id===2 && c.data.hour.inventory?.shift)return 'resolver';
    return 'evidencias';
  }
  function hotelPanel(c,select){
    const shell=element('div',null,'hotel-partida'),host=element('div');
    const mesa=window.MesaDeJuego.mount(host,{family:'valdemar',title:c.data.story.title});
    const dock=element('aside',null,'mj-objective-dock'),tabs=element('nav',null,'hotel-tabs');
    dock.setAttribute('aria-label','Objetivo de la aventura');
    tabs.setAttribute('aria-label','Panel de la aventura');
    const more=element('nav',null,'hotel-related');
    more.setAttribute('aria-label','Acciones de la partida');
    shell.append(dock,tabs,host,more);
    mesa.dockObjective(dock);
    const screens=new Map(),buttons=new Map();
    function command(parent,label,run){
      const b=element('button',label);b.type='button';b.addEventListener('click',run);parent.append(b);return b;
    }
    for(const [key,label] of [['resolver','Escenario'],['inventario','Inventario'],['evidencias','Evidencias'],['pistas','Pistas']]){
      buttons.set(key,command(tabs,label,()=>select(key==='resolver'&&!hour.stage?'desenlace':key,true)));
    }
    const back=command(more,'Volver al puesto',()=>select(hour.stage?'resolver':'desenlace',true));
    const explore=command(more,'Explorar las estancias',()=>select('escenario',true));
    const extra=command(more,'Reto extra',()=>select('extra',true));
    const goals=[
      'Conecta la llamada de Candela y prepara la entrega que corresponde a su aviso.',
      'Cruza los albaranes con los planos de las obras para identificar la puerta correcta.',
      'Examina la fotografía y contrasta sus detalles con el horario de la ronda.',
      'Recoge las tres declaraciones y contrasta el croquis con el recorte del rellano.',
      'Reconstruye el recado, devuelve los objetos a su casillero y llama a Candela.'
    ];
    let hour=c.data.hour,active=null,saved=c.resume?'Partida recuperada':'',pending=0,failed=false;
    function update(){
      const stage=hour.stage,index=hour.current,shift=hour.inventory?.shift;
      const paired=c.frame.dataset.playMode==='duo',role=hour.inventory?.role||c.data.partner?.role;
      const a=shift?.done?.[index+'A'],b=shift?.done?.[index+'B'];
      let target=stage?'resolver':'desenlace',objective=stage?(shift?goals[index]:stage.task||stage.brief):'Abre el desenlace para cerrar el caso.';
      if(stage&&shift){
        if(!shift.opensAt)objective=role==='B'?'Abre el puesto de guardia para iniciar el turno.':'Descuelga el teléfono de recepción para iniciar el turno.';
        else if(a&&b)objective=index===4?'Vuelve al teléfono y llama a Candela a la hora indicada.':'Los dos puestos han terminado. Pulsa «Continuar la investigación» en Escenario.';
        else if(paired&&((role==='A'&&a)||(role==='B'&&b)))objective='Tu operación está guardada. Comparte tus hallazgos con el otro puesto mientras termina.';
        else if(!paired&&(a||b))objective='En Escenario, cambia a '+(a?'Turno de noche':'Recepción')+' para completar la otra operación.';
        else if(index===3&&(hour.inventory?.hotel?.witnesses?.length||0)<3){target='escenario';objective=goals[index];}
      }
      const selected=['desenlace','escenario'].includes(active)?'resolver':active==='extra'?'pistas':active;
      for(const [key,b] of buttons)b.setAttribute('aria-pressed',String(key===selected));
      back.hidden=active==='resolver'||active==='desenlace';
      explore.hidden=active!=='resolver';
      extra.hidden=active!=='pistas';
      mesa.update({progress:(stage?index:hour.stages.length)+'/'+hour.stages.length+' pruebas resueltas'+(stage?' · '+stage.title:''),
        objective,saved,help:false,tools:[],tutorial:'',next:null});
    }
    const observer=new MutationObserver(update);
    observer.observe(c.frame,{attributes:true,attributeFilter:['data-play-mode','data-play-paper']});
    return {shell,get active(){return active;},
      bind(key,node){node.dataset.hotelPane=key;node.id='hotel-vista-'+key;node.tabIndex=-1;node.hidden=true;screens.set(key,node);shell.insertBefore(node,more);},
      show(key,focus){if(!screens.has(key))return false;active=key;c.frame.dataset.hotelView=key;
        for(const [id,node] of screens)node.hidden=id!==key;
        update();if(focus){screens.get(key).focus({preventScroll:true});dock.scrollIntoView({block:'start'});}return true;},
      progress(value){hour=value;update();},enter(){update();},
      writing(){if(!pending)failed=false;pending++;saved='Guardando…';update();},
      written(ok){failed ||= ok===false;pending=Math.max(0,pending-1);saved=pending?'Guardando…':failed?'Última acción sin confirmar':ok===null?'Respuesta comprobada':'Progreso guardado';update();},
      destroy(){observer.disconnect();mesa.destroy();}
    };
  }
  function configureRadioDesk(c,navigation){
    const shell=navigation.shell, tabs=shell.querySelector('.case-nav');
    const status=shell.querySelector('.case-progress');
    const guide=shell.querySelector('.case-instrucciones');
    const dock=element('aside',null,'mj-objective-dock'),host=element('div');
    const mesa=window.MesaDeJuego.mount(host,{family:'valdemar',title:c.data.story.title});
    dock.setAttribute('aria-label','Objetivo de la aventura');
    c.frame.dataset.hotelUi='true';
    shell.classList.add('mansion-game','radio-desk');
    shell.prepend(dock);
    mesa.dockObjective(dock);
    tabs.className='mansion-tabs vd-block-tools';
    const buttonFor=key=>tabs.querySelector('[data-case-go="'+key+'"]');
    for(const key of ['escenario','inventario','evidencias','pistas'])tabs.append(buttonFor(key));
    const controls=element('nav',null,'hotel-related');
    controls.setAttribute('aria-label','Acciones de la partida');
    for(const key of ['resolver','desenlace','extra'])controls.append(buttonFor(key));
    for(const tab of tabs.children)tab.className='mansion-tab';
    status.hidden=true;
    shell.append(host,controls);
    const bind=navigation.bind;
    navigation.bind=(key,node)=>{
      bind(key,node);
      shell.insertBefore(node,controls);
      if(key==='evidencias')node.classList.add('hotel-evidencias','hm-evidence-shelf');
    };
    const scenario=shell.querySelector('.case-scenario');
    scenario.classList.add('radio-scenario');
    const chapter=element('header',null,'mansion-header');
    const chapterTitle=element('p',null,'mansion-eyebrow');
    const shortcuts=element('div',null,'mansion-worlds');
    shortcuts.append(button('Consultar evidencias',()=>selectView(c,'evidencias',true),'mansion-world-choice'),
      button('Resolver la etapa',()=>selectView(c,'resolver',true),'mansion-world-choice'));
    chapter.append(chapterTitle,shortcuts);
    const layout=element('div',null,'mansion-panel radio-layout');
    const stageArea=element('section',null,'mansion-stage');
    const photo=scenario.querySelector('.ae-stage');
    stageArea.append(photo);
    const sidebar=element('aside',null,'mansion-objective mansion-scene-tools');
    const objects=element('div',null,'mansion-examine');
    const task=scenario.querySelector('.case-consigna');
    task.classList.add('mansion-paper-task');
    sidebar.append(element('h3','Objetos de la cabina','mansion-tools-heading'),task,objects,guide);
    layout.append(stageArea,sidebar);
    scenario.prepend(chapter,layout);
    const markers=photo.querySelector('.ae-markers');
    function syncObjects(){
      objects.replaceChildren();
      for(const marker of markers.querySelectorAll('button')){
        const label=marker.querySelector('.ae-marker-label')?.textContent||marker.textContent;
        const item=button('',()=>marker.click(),'mansion-marker mansion-find');
        const thumbnail=element('img',null,'mansion-find-photo');
        thumbnail.src=photo.querySelector('img').src;
        thumbnail.alt='';
        thumbnail.style.objectPosition=marker.style.getPropertyValue('--x')+' '+marker.style.getPropertyValue('--y');
        item.append(thumbnail,element('span',label,'mansion-find-label'));
        objects.append(item);
      }
    }
    const sceneObserver=new MutationObserver(syncObjects);
    sceneObserver.observe(markers,{childList:true,subtree:true,characterData:true});
    syncObjects();
    let hour=c.data.hour;
    function refresh(){
      const stage=hour.stage;
      chapterTitle.textContent=stage?'Capítulo '+(['I','II','III','IV','V'][hour.current]||String(hour.current+1))+' · '+stage.title:'Investigación completada';
      shortcuts.lastElementChild.hidden=!stage;
      mesa.update({progress:hour.current+'/'+hour.stages.length+' pruebas resueltas'+(stage?' · '+stage.title:''),
        objective:stage?(stage.task||stage.brief||c.data.story.question):'Abre el desenlace para cerrar el caso.',
        saved:status.querySelector('.case-save')?.textContent||'',help:false,tools:[],tutorial:'',next:null});
    }
    const progress=navigation.progress,destroy=navigation.destroy;
    navigation.progress=value=>{hour=value;progress(value);refresh();};
    const observer=new MutationObserver(refresh);
    observer.observe(status,{childList:true,subtree:true,characterData:true});
    navigation.destroy=()=>{observer.disconnect();sceneObserver.disconnect();mesa.destroy();destroy();};
    guide.classList.add('hotel-instrucciones');
    refresh();
  }
  function buildAdventure(c,catalogItem){
    const story=c.data.story;
    const hotel=c.id===2&&Boolean(c.data.hour.hotel);
    c.frame.dataset.adventureWorld='valdemar';
    const select=(key,focus)=>selectView(c,key,focus);
    const actions=(kind,id)=>{
      const key={inspect:'inventario',material:'evidencias',journal:'evidencias',decision:'resolver',ending:'desenlace'}[kind];
      if(!key)return;
      select(key,true);
      if(['inspect','material','journal'].includes(kind))c.hourView?.open(kind,id);
    };
    const navigation=hotel?hotelPanel(c,select):
      window.AventuraEscena.caseNavigation(c.frame,select,{world:'valdemar',id:c.id,story,
        image:catalogItem?.image||'/valdemar-art-'+String(c.id).padStart(2,'0')+'.webp',place:catalogItem?.place,
        alt:coverDescriptions[c.id-1],read:()=>c.data,actions,playerName:()=>c.bridge.playerName?.()});
    if(c.id===4)configureRadioDesk(c,navigation);
    c.navigation=navigation;
    const screen=(key,cls)=>{const node=element('section',null,'vd-panel '+cls);navigation.bind(key,node);return node;};
    if(hotel){c.frame.dataset.hotelUi='true';c.hotel=screen('escenario','vhour vhour-hotel-panel');}
    c.desk=screen('evidencias',hotel?'vhour hotel-evidencias':'vhour');
    const problem=screen('resolver',hotel?'vhour hotel-resolver':'vhour'),bag=screen('inventario',hotel?'vhour hotel-inventario':'vhour');
    c.help=screen('pistas','vd-help');c.ending=screen('desenlace','vd-ending');
    const reading=element('div');c.desk.append(reading);
    const papers=element('details',null,hotel?'hotel-registro':'case-registro');
    papers.append(element('summary',hotel?'Registro inicial y declaraciones de los huéspedes':'Documentos del caso'));
    const file=element('div',null,'vd-papers');papers.append(file);c.desk.append(papers);
    function baseFiles(role){
      file.replaceChildren();
      for(const m of story.evidenceCards||[]){
        if(role&&m.role&&m.role!=='AB'&&m.role!==role&&Number(m.role)!==(role==='A'?1:2))continue;
        const doc=element('details',null,'vd-document');doc.append(element('summary',m.title),element('p',m.body));file.append(doc);
      }
    }
    buildGame(c);navigation.bind('extra',c.gamePanel);
    if(hotel&&c.data.sample&&typeof window.montarMesa==='function'){
      const service=element('details',null,'hotel-registro'),material=element('div');
      service.append(element('summary','Prueba opcional · El armario de ropa blanca'),material);
      service.addEventListener('toggle',()=>{
        if(service.open&&!material.firstChild)window.montarMesa(material,c.data.sample,answer=>request(c,'sample',{answer}));
      });
      c.gamePanel.append(service);
    }
    const query=new URLSearchParams(location.hash.split('?')[1]),source=Number(query.get('desde'));
    if(query.get('volver')==='pistas'&&Number.isInteger(source)&&source>=1&&source<=48&&source!==c.id){
      c.gamePanel.append(link('Volver a las pistas de la otra aventura','#'+(source<=12?'valdemar-jugar':'mundos-jugar')+'?id='+source+'&seccion=pistas&retomar=1','vd-link'));
    }
    const entry=blockEntry(c,{title:story.title,mode:c.modeControl});
    c.frame.replaceChildren(entry,navigation.shell);
    let lastIndex=c.data.hour.current,role=c.data.partner?.role||null;
    const controller={
      caseId:c.id,role,sample:c.data.sample,
      ...(hotel?{hotelNode:c.hotel,hotelScreens:{reading,problem,bag},visitHotel:()=>select('escenario',true)}:{screens:{reading,problem,bag}}),
      finish:()=>selectView(c,'ending',true),
      inventory:async input=>{
        const result=await request(c,'inventory',input);
        if(result.inventory&&result.inventory.revision>=(c.data.hour.inventory?.revision||0))c.data.hour.inventory=result.inventory;
        if(result.wallet)updateWallet(c,result);
        navigation.progress(c.data.hour);
        return result;
      },
      submit:(index,choice,sources)=>request(c,'stage',{index,choice,...(sources?{sources}:{})}),
      reload:async()=>{const latest=await request(c);c.data.progress=latest.progress;c.data.hour=latest.hour;return latest.hour;},
      change:hour=>{c.data.hour=hour;renderEnding(c);},
      onScene:hour=>{
        navigation.progress(hour);
        if(hour.current!==lastIndex){
          const wasInvestigating=['resolver','evidencias'].includes(navigation.active);
          lastIndex=hour.current;
          if(wasInvestigating)selectView(c,hour.stage?(hotel&&hour.inventory?.shift?'resolver':'evidencias'):'desenlace',true);
        }
      }
    };
    baseFiles(role);
    c.showModePaper=paper=>{
      const next=c.data.partner?.role||paper||null;
      if(next===role)return;
      role=next;controller.role=next;baseFiles(next);c.hourView?.update(c.data.hour);
    };
    c.hourView=window.ValdemarHour.mount(element('div'),c.data.hour,controller);
    if(hotel)c.legacyExplorer=window.AventuraEscena.mountExplorer(c.hotel,c.frame,c.id);
    renderEnding(c);updateWallet(c,c.data);c.modeControl.mount();
    c.routeSection=query.get('seccion');
    selectView(c,initialView(c,c.routeSection));
    if(navigation.active==='evidencias'||navigation.active==='escenario')navigation.enter();
    const refreshRewards=async()=>{try{const latest=await request(c);if(valid(c))updateWallet(c,latest);}catch{}};
    for(const name of ['season-room-reward','mansion-arcade-reward','editorial-challenge-solved'])c.frame.addEventListener(name,refreshRewards);
  }
  function build(c) {
    const {story}=c.data;
    const number=String(c.id).padStart(2,'0');
    const catalogItem=c.id===1 && c.episode?.legacy?{image:'/valdemar-art-01.webp',place:'La estación'}:window.ValdemarCatalog?.get(c.id);
    c.frame.dataset.vdCase=number;
    c.balance=element('span','','vd-balance');
    c.balance.setAttribute('aria-live','polite');
    const description=element('div',null,'vd-intro-copy');
    attachModeControl(c,description,story,mode=>request(c,'mode',{mode}),paper=>c.showModePaper?.(paper),{
      caseId:c.id,partner:c.data.partner,data:c.data,partners:(path,body)=>c.bridge.request(path,body),
      readState:async()=>{
        const state=await request(c,'pair-state');
        if(c.episode?.edition==='legacy' && state.edition==='mansion')reopen(c);
        return state;
      },readDossier:()=>request(c),
      onState:state=>{const advanced=window.ModalidadJuego.syncProgress(c.data,state,c.hourView,()=>renderEnding(c));updateWallet(c,state);return advanced;},reopen:()=>reopen(c)
    });
    if(c.id>=2){buildAdventure(c,catalogItem);return;}
    if(c.episode?.edition!=='legacy')throw Error('No se ha podido recuperar la partida guardada.');
    const common=c.id<=4&&Boolean(c.data.hour);
    const head=element(common?'section':'header',null,'vd-intro');
    const cover=element('img',null,'vd-cover');
    cover.addEventListener('error',()=>{cover.alt='';cover.src='/'+covers[c.id-1]+'.jpg';},{once:true});
    cover.src=catalogItem?.image || '/valdemar-art-'+number+'.webp';cover.alt=coverDescriptions[c.id-1];
    cover.width=764;cover.height=508;cover.decoding='async';
    const still=element('figure',null,'vd-still');
    still.append(cover);
    if(catalogItem?.place)still.append(element('figcaption',catalogItem.place));
    const headlinks=element('div',null,'vd-headlinks');
    headlinks.append(link('Ver en el plano','#mapa?lugar='+c.id,'vd-link'),link('Todas las historias',c.catalog,'vd-link'),c.balance);
    description.prepend(headlinks,element('p','Código Valdemar · Historia '+number,'vd-eyebrow'),element('h1',story.title));
    description.append(element('p',story.question,'vd-question'));
    if(story.intro)description.append(element('p',story.intro,'vd-narrative'));
    if(c.data.hour){
      description.append(button('Ir a mi investigación',()=>{
        selectView(c,'desk');
        c.hourView.enter();
      },'vd-primary gm-enter'));
    }
    if(c.data.hour){
      c.scene=window.AventuraEscena.mount(head,{world:'valdemar',id:c.id,frame:c.frame,story,resumed:c.resume||Boolean(c.data.mode),blockEntry:common,extra:c.id===1?{title:c.game.title,action:c.game.pitch}:null,
        image:c.id===1?'/tren-detenido.jpg':catalogItem?.image||'/valdemar-art-'+number+'.webp',alt:c.id===1?'El andén de la estación':coverDescriptions[c.id-1],place:c.id===1?'El andén':catalogItem?.place,
        toolbar:headlinks,modeControl:c.modeControl,read:()=>c.data,playerName:()=>c.bridge.playerName?.(),
        actions:(kind,id)=>{
            if(kind==='restore'){selectView(c,id);return id==='desk'?c.desk:id==='help'?c.help:id==='hotel'?c.hotel:c.ending;}
            if(kind==='hints'){selectView(c,'help',true);return;}
          if(kind==='scene'){selectView(c,'desk');return;}
          if(kind==='ending'){selectView(c,'ending',true);return;}
          selectView(c,'desk');c.hourView.open(kind,id);
        }});
    }else {
      head.append(description,still);
      if(c.id===1){
        c.legacyExplorer=window.AventuraEscena.mountExplorer(description,c.frame,1);
        description.insertAdjacentHTML('beforeend',window.RetosTemporada?.puertaSala('mapa')||'');
      }
    }
    const nav=element('nav',null,'vd-tabs');nav.setAttribute('aria-label','Mesa de juego');
    c.viewButtons=new Map();
    const availableViews=c.data.hour?.hotel&&window.ValdemarHour?[views[0],['hotel','Recepción del hotel'],...views.slice(1)]:views;
    for(const [id,label] of availableViews){const b=button(label,()=>selectView(c,id,true));b.dataset.view=id;c.viewButtons.set(id,b);nav.append(b);}
    c.pair=element('div',null,'vd-pair');c.help=element('section',null,'vd-panel vd-help');c.ending=element('section',null,'vd-panel vd-ending');
    c.help.tabIndex=-1;c.ending.tabIndex=-1;
    if(c.data.hour?.hotel && window.ValdemarHour){c.hotel=element('section',null,'vd-panel vhour vhour-hotel-panel');c.hotel.tabIndex=-1;}
    buildDesk(c);buildGame(c);renderEnding(c);updateWallet(c,c.data);
    c.pair.append(c.gamePanel,c.desk);
    c.frame.replaceChildren(head,nav,c.pair,c.help,c.ending);
    c.scene?.attach();
    if(common){
      const legacy=c.id===1&&c.episode?.legacy;
      c.frame.prepend(blockEntry(c,{title:story.title,question:legacy?story.question:undefined,
        photo:legacy?'/tren-detenido.jpg':undefined,alt:legacy?'El andén de la estación':undefined,mode:c.modeControl}));
    }
    if(c.id===1&&c.scene)head.insertAdjacentHTML('afterend',window.RetosTemporada?.puertaSala('mapa')||'');
    const roomReward=async()=>{
      try{const value=await request(c);if(valid(c)){updateWallet(c,value);if(c.view==='help')renderHelp(c);}}catch{}
    };
    for(const event of ['season-room-reward','mansion-arcade-reward','editorial-challenge-solved'])c.frame.addEventListener(event,roomReward);
    if(c.hotel){
      if(!c.scene)c.hotel.append(button('Volver a la investigación',()=>selectView(c,'desk',true),'vd-primary'));
      c.frame.append(c.hotel);
    }
    c.modeControl.mount();
    const ending=Boolean(c.data.progress?.choice || (c.resume && c.data.hour && !c.data.hour.stage));
    c.routeSection=new URLSearchParams(location.hash.split('?')[1]).get('seccion');
    const sideRequested=c.routeSection==='reto';
    const pending=c.frame.dataset.playMode==='pending';
    const hintsRequested=c.routeSection==='pistas';
    selectView(c,sideRequested?'game':hintsRequested?'help':ending?'ending':'desk',sideRequested||hintsRequested||c.resume&&(ending||pending));
    if(c.resume&&!ending&&!sideRequested&&!hintsRequested&&!pending){
      if(common&&c.id===1)c.frame.querySelector('.vd-block-entry h1').focus({preventScroll:true});
      else if(c.scene)c.scene.focus();else c.hourView?.enter();
    }
  }
  function buildMansion(c) {
    const data=c.data,arcadeHost=element('div',null,'vd-room-entry');
    c.frame.dataset.vdCase='01';
    function showBalance(amount){
      if(!Number.isInteger(amount))return;
      c.balance.textContent=amount===1?'1 llave':amount+' llaves';
    }
    c.balance=element('span','','vd-balance');c.balance.setAttribute('aria-live','polite');
    showBalance(data.mansion?.balance??data.wallet?.balance);
    const game=element('section');
    let paper=c.data.partner?.role || (data.editorialPreview && data.mode==='duo'?'A':'solo');
    async function act(input){
      try {
        const result=await request(c,'mansion',{...input,paper});
        if(result.completed)await c.bridge.refreshSeasonAccess?.().catch(()=>null);
        if(result.edition!==data.edition){reopen(c);throw Error('Ha cambiado la edición de la partida.');}
        if(result.mansionRevision>=data.mansionRevision){data.mansion=result.mansion;data.mansionRevision=result.mansionRevision;}
        showBalance(result.mansion?.balance??result.wallet?.balance);
        return result;
      }catch(error){
        if(sessionLive(c)&&[401,402,403].includes(error.status))showFailure(c,error);
        throw error;
      }
    }
    function mountGame(state){
      c.mansionView?.destroy();
      c.mansionView=window.MansionGame.mount(game,{state,role:paper,names:data.names,act,arcadeHost,blockEntry:true,
        resumed:c.resume||Boolean(data.mode&&!c.freshMode)||state.current>1||Boolean(state.ending),playerId:c.bridge.playerId?.(),explore:roomId=>act({op:'inspect',roomId})});
      c.openArcade=()=>{
        const drawer=arcadeHost.querySelector('.mansion-arcade-drawer');
        if(drawer){drawer.open=true;const trigger=drawer.querySelector('summary');trigger?.focus();trigger?.scrollIntoView({block:'center'});}
      };
      c.routeSection=new URLSearchParams(location.hash.split('?')[1]).get('seccion');
      if(c.routeSection==='reto')queueMicrotask(()=>{if(valid(c))c.openArcade();});
      if(c.routeSection==='pistas')queueMicrotask(()=>{if(valid(c))c.mansionView.openHints();});
    }
    const story={roles:['Investiga la mansión habitada de Ada.','Explora las huellas que quedan en la mansión abandonada.']};
    const modeHost=element('div');
    attachModeControl(c,modeHost,story,async mode=>{
      const result=await request(c,'mode',{mode,mansionEntry:true});
      if(sessionLive(c))reopen(c,Boolean(data.mansion));
      return result;
    },next=>{
      const nextPaper=next||'solo';
      if(!data.editorialPreview || data.partner || paper===nextPaper || !data.mansion)return;
      paper=nextPaper;
      act({op:'inspect'}).then(result=>{if(sessionLive(c)&&paper===nextPaper)mountGame(result.mansion);}).catch(error=>c.bridge.toast?.(errorMessage(error)));
    },{
      caseId:1,partner:data.partner,data,partners:(path,body)=>c.bridge.request(path,body),
      readState:()=>request(c,'pair-state'),readDossier:()=>request(c,'mansion'),
      onState:latest=>{
        if(latest.edition!==data.edition){reopen(c);return true;}
        if(latest.mansionRevision<=data.mansionRevision)return false;
        data.mansionRevision=latest.mansionRevision;data.mansion=latest.mansion;
        showBalance(latest.mansion?.balance??latest.wallet?.balance);
        c.mansionView?.update(latest.mansion);return true;
      },reopen:()=>reopen(c)
    });
    if(data.mansion){
      game.className='mansion-game-area';
      if(!window.MansionGame?.mount)throw Error('La mansión no se ha cargado. Vuelve a abrir la partida.');
      mountGame(data.mansion);
    }
    if(!arcadeHost.firstElementChild)arcadeHost.innerHTML=window.RetosTemporada?.puertaSala('mapa')||'';
    const header=blockEntry(c,{
      title:'El secreto de los dos mundos',mode:c.modeControl,
      modeHelp:'A solas, cambia de casa para comparar lo que encuentres. En pareja, cada persona explora su propia versión de la mansión desde su cuenta. Contad qué veis y usad las pistas del otro para mover vuestro mecanismo.'
    });
    c.frame.replaceChildren(header,game,arcadeHost);
    c.modeControl.mount();
    if(data.mansion&&c.routeSection!=='reto'&&c.routeSection!=='pistas'&&(c.resume||c.freshMode))header.querySelector('h1').focus({preventScroll:true});
  }
  function showFailure(c,e) {
    c.modeControl?.destroy();
    c.entryObserver?.disconnect();
    c.legacyExplorer?.destroy();
    c.navigation?.destroy();
    c.mansionView?.destroy();
    c.hourView?.pause();pauseAudio(c.frame);
    const common=c.id>=1&&c.id<=12;
    const notice=element('div',null,'vd-entry-notice');
    const guest=common&&!c.bridge.isSignedIn();
    notice.append(element('p',guest?'Entra con tu cuenta para jugar o retomar tu partida guardada.':errorMessage(e)));
    if(new URLSearchParams(location.hash.split('?')[1]).get('seccion')==='reto')notice.append(link('Volver a los retos de Código Valdemar','/#desafios?mundo=mapa','vd-link'));
    if(!c.bridge.isSignedIn() || e?.status===401){
      const login=element('button','Entrar','vd-primary');
      login.type='button';login.dataset.action='auth-login';notice.append(login);
      if(guest)notice.append(link('Ver la suscripción','/#planes','vd-link'));
    } else if(e?.status===402 || e?.status===403 || e?.code==='CASE_NOT_RELEASED')notice.append(link('Ver la suscripción','/#planes','vd-link'));
    else notice.append(button('Volver a intentar',()=>{const {id,bridge,catalog,resume}=c;clear();render(id,bridge,{catalogHref:catalog,resume});}));
    if(common){
      c.balance=null;
      c.frame.replaceChildren(blockEntry(c,{locked:notice}));
    }else{
      c.frame.replaceChildren(element('h1','La mesa de Código Valdemar'),notice,link('Volver al catálogo',c.catalog,'vd-link'));
    }
  }
  function render(value,bridge,options={}) {
    const id=Number(value),host=document.getElementById('valdemar-player');
    if(!host || !bridge)return;
    const account=identity(bridge);
    const resume=options.resume===true;
    const sameEntry=id!==1||active?.resume===resume||active?.episode?.edition==='mansion';
    if(active?.id===id && active.bridge===bridge && active.identity===account && sameEntry){
      if(host!==active.frame.parentElement)host.replaceChildren(active.frame);
      const section=new URLSearchParams(location.hash.split('?')[1]).get('seccion');
      if(active.gamePanel && section!==active.routeSection){
        active.routeSection=section;
        selectView(active,active.navigation?initialView(active,section):section==='reto'?'game':section==='pistas'?'help':'desk',true);
      }else if(active.openArcade&&section!==active.routeSection){
        active.routeSection=section;if(section==='reto')active.openArcade();else if(section==='pistas')active.mansionView?.openHints();
      }
      return;
    }
    clear();
    const catalog=options.catalogHref?.startsWith('#')?options.catalogHref:'#casos';
    const c={id,bridge,identity:account,catalog,resume,freshMode:options.freshMode===true,frame:element('div',null,'vd-player'),pending:new Set()};active=c;
    host.replaceChildren(c.frame);
    if(!Number.isInteger(id)||id<1||id>12){c.frame.append(element('p','Este expediente no existe.'),link('Volver al catálogo',catalog));return;}
    if(!sessionLive(c)){showFailure(c,{status:401});return;}
    c.frame.append(element('p','Abriendo el expediente…','vd-status'));c.frame.setAttribute('aria-busy','true');
    (async()=>{
      try{
        if(id===1){
          c.episode=await request(c,'mansion');
          c.data=c.episode;
          // La ficha abre la mansión. Al retomar se respeta la historia guardada.
          if(c.episode.edition==='choose'||(!c.resume&&c.episode.edition==='legacy')){
            const op=c.resume?'legacy':'start';
            c.episode=await request(c,'mansion',{op});
            c.data=c.episode;
          }
          if(c.episode.edition!=='legacy'){
            if(sessionLive(c))buildMansion(c);
            return;
          }
        }
        c.data=await request(c);
        if(id>=2){
          const hour=c.data.hour;
          if(!hour?.stages?.length||!Number.isInteger(hour.current)||hour.current<0||hour.current>hour.stages.length||
            (hour.current<hour.stages.length&&!hour.stage)||(id===2&&!hour.hotel)){
            throw Error('No se ha podido cargar la etapa de esta aventura. Vuelve a intentarlo para retomar tu partida.');
          }
        }
        await Promise.all([loadEngines(c),window.ArchivoObjetos?.open(id)]);
        if(sessionLive(c))build(c);
      }catch(e){if(valid(c))showFailure(c,e);}
      finally{c.frame.removeAttribute('aria-busy');}
    })();
  }
  window.ValdemarPlayer={render,clear};
})();
