(() => {
  'use strict';
  const worlds=window.Mundos;
  let current;
  function el(tag,text,cls) {
    const node=document.createElement(tag);
    if(text!=null)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  }
  function button(text,act,cls='md-action') {
    const b=el('button',text,cls);b.type='button';b.addEventListener('click',act);return b;
  }
  function link(text,href,cls='md-textlink') {
    const a=el('a',text,cls);a.href=href;return a;
  }
  function live(text='') {
    const p=el('p',text,'md-feedback');p.setAttribute('role','status');return p;
  }
  function clear() {
    if(!current)return;
    current.modeControl?.destroy();
    current.hour?.pause();
    if(current.sideVoice)window.ValdemarHour?.stopVoice?.(current.sideVoice);
    current.observer?.disconnect();
    current.frame.remove();
    current=null;
  }
  function game(id) {
    const item=worlds.story(id);
    if(!item)return '<section class="md-missing"><h1>No se encontró esta historia</h1><a href="#casos">Ver los casos</a></section>';
    return '<div id="md-game-host"><p role="status">Abriendo la investigación…</p></div>';
  }
  function active(c) {return current===c && c.bridge.isSignedIn();}
  function showAccess(c,message,reason) {
    if(c!==current)return;
    c.modeControl?.destroy();
    c.hour?.pause();
    if(c.sideVoice)window.ValdemarHour?.stopVoice?.(c.sideVoice);
    c.observer?.disconnect();
    const panel=el('article',null,'md-unavailable'),art=el('img');
    art.src='/mundo-'+c.item.id+'.webp';art.alt='';
    panel.append(art,el('h1',c.item.title),el('p',message));
    if(!c.bridge?.isSignedIn() || reason===401) {
      const login=el('button','Entrar en mi cuenta','md-cta');login.type='button';login.dataset.action='auth-login';panel.append(login);
    } else if(reason===402) {
      panel.append(el('p','Esta temporada se abre después de completar los doce desenlaces '+worlds.edition(c.item.world).previous.from+'. Cada mensualidad habilita cuatro casos.'),link('Consultar mi pase','#planes','md-cta'));
    }
    else if(reason==='gate') panel.append(link('Ver temporada anterior',worlds.edition(c.item.world).previous.href,'md-cta'));
    else panel.append(button('Volver a intentar',()=>{const {id,item,bridge}=c;clear();mountGame(id||item.id,bridge);},'md-cta'));
    panel.append(link(worlds.edition(c.item.world).returnLabel,worlds.route(c.item.world,c.item.id)));
    c.frame.replaceChildren(panel);c.frame.removeAttribute('aria-busy');
  }
  async function request(c,action,payload) {
    if(!active(c))throw Error('Vuelve a abrir tu cuenta para continuar.');
    try {
      const result=await c.bridge.request('/api/valdemar/cases/'+c.item.id+(action?'/'+action:''),payload);
      if(!active(c))throw Error('Has salido de esta investigación.');
      return result;
    } catch(error) {
      if(c===current){
        if(error.code==='CASE_NOT_RELEASED')showAccess(c,error.message,402);
        else if(error.code==='PREVIOUS_SEASON_REQUIRED')showAccess(c,error.message,'gate');
        else if([401,402,403].includes(error.status))showAccess(c,error.message,error.status);
      }
      throw error;
    }
  }
  function quiet(c,on) {
    c.silent=on;c.frame.dataset.silent=String(on);
    c.quiet.setAttribute('aria-pressed',String(on));
    if(on){c.hour?.pause();if(c.sideVoice)window.ValdemarHour.stopVoice(c.sideVoice);openTranscripts(c);}
    try{sessionStorage.setItem('mundos-lectura-silenciosa',on?'1':'0');}catch{}
  }
  function openTranscripts(c) {
    if(!c.silent)return;
    for(const d of c.frame.querySelectorAll('.vhour-recording details:not([data-md-transcript])')){
      d.dataset.mdTranscript='1';d.open=true;
    }
  }
  function select(c,tab,focus=false) {
    if(!active(c))return;
    if(tab!==c.tab){c.hour?.pause();if(c.sideVoice)window.ValdemarHour.stopVoice(c.sideVoice);}
    c.tab=tab;
    for(const [k,panel] of Object.entries(c.panels))panel.hidden=k!==tab;
    for(const [k,btn] of Object.entries(c.controls))btn.setAttribute('aria-pressed',String(k===tab));
    if(focus){const p=c.panels[tab];p.focus({preventScroll:true});p.scrollIntoView({block:'start',behavior:'instant'});}
  }
  function updateWallet(c,data) {
    if(data.wallet)c.data.wallet=data.wallet;
    if(Array.isArray(data.hints))c.data.hints=data.hints;
    const n=c.data.wallet.balance;
    c.balance.textContent=n+(n===1?' llave':' llaves');
  }
  function refreshHelp(c) {
    const h=c.panels.help,{hints=[],wallet}=c.data;
    const id=c.item.id,opened=wallet.opened.includes(id);
    const eyebrow=el('p',worlds.edition(c.item.world).notebook,'md-caption');
    h.replaceChildren(eyebrow,el('h2','Sobre de ayuda'));
    const status=live();
    async function claim(control,op) {
      if(control.disabled)return;
      control.disabled=true;
      try{updateWallet(c,await request(c,op,{}));refreshHelp(c);c.panels.help.focus({preventScroll:true});}
      catch(e){
        if(!active(c))return;
        if(e.status===409)try{
          const latest=await request(c);updateWallet(c,latest);refreshHelp(c);
          (c.panels.help.querySelector('[role="status"]')||status).textContent=e.message;return;
        }catch{}
        control.disabled=false;status.textContent=e.message;
      }
    }
    if(opened){
      for(const [i,hint] of hints.entries())h.append(el('h3',i?'Segunda orientación':'Primera orientación'),el('p',hint,'md-hint'));
      if(hints.length<2){const b=button('Leer la segunda orientación',()=>claim(b,'second'),'md-cta');h.append(b);}
    } else {
      h.append(el('p','Una llave abre las dos orientaciones de este caso. Puedes seguir investigando y volver cuando las necesites.'));
      if(wallet.balance>0){const b=button('Abrir el sobre · 1 llave',()=>claim(b,'open'),'md-cta');h.append(b);}
      else if(!wallet.won.includes(id))h.append(button('Ganar una llave en el reto paralelo',()=>select(c,'side',true),'md-cta'));
      else h.append(link('Explorar otras historias',worlds.route(c.item.world,id),'md-cta'));
    }
    h.append(status);
  }
  function concludeForm(c,options,prompt,label,action) {
    const form=el('form',null,'md-resolve-form'), group=el('fieldset'), status=live();
    group.append(el('legend',prompt));
    for(const opt of options){
      const lab=el('label'),r=el('input');r.type='radio';r.name='answer';r.value=opt.id;r.required=true;
      lab.append(r,el('span',opt.label));group.append(lab);
    }
    const send=el('button',label,'md-cta');send.type='submit';
    form.append(group,send,status);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(send.disabled)return;
      const choice=form.querySelector('input:checked')?.value;
      if(choice===undefined)return;
      send.disabled=group.disabled=true;
      try{
        const r=await request(c,action,action==='deduce'?{hypothesis:choice}:{choice});
        c.data.progress=r.progress;
        if(action==='ending')c.endingAccess=r.seasonAccess;
        if(action==='deduce' && !r.correct) status.textContent='Queda una prueba sin explicar. Contrasta las fuentes del cuaderno antes de volver a intentarlo.';
        else{renderEnd(c);c.panels.end.focus({preventScroll:true});}
      }catch(e){
        if(e.status===409 && active(c)){
          try{const latest=await request(c);c.data.progress=latest.progress;c.data.hour=latest.hour;c.hour.update(latest.hour);renderEnd(c);return;}catch{}
        }
        status.textContent=e.message;
      }finally {send.disabled=group.disabled=false;}
    });
    return form;
  }
  function renderEnd(c) {
    const target=c.panels.end,{hour,story,progress}=c.data;
    target.replaceChildren(el('p',worlds.nameOf(c.item.world),'md-caption'),el('h2','El desenlace'));
    if(hour.stage && !progress.choice){
      target.append(el('p','Has resuelto '+hour.current+' de '+hour.stages.length+' etapas. El cuaderno reúne las pruebas que necesitarás al final.'),button('Volver a la etapa actual',()=>select(c,'main',true),'md-cta'));return;
    }
    if(!progress.deduced){
      target.append(concludeForm(c,story.hypotheses,story.challengePrompt||story.question,'Contrastar la deducción','deduce'));
      return;
    }
    if(progress.deduction)target.append(el('p',progress.deduction,'md-hint'));
    if(progress.choice){
      const name=story.choices.find(o=>o.id===progress.choice)?.label;
      target.append(el('h3',name||'Tu decisión'),el('p',progress.outcome),window.SellosTemporada.afterCase(c.item.id,c.bridge,c.endingAccess),link(worlds.edition(c.item.world).returnLabel,worlds.route(c.item.world,c.item.id),'md-cta'));
    } else target.append(concludeForm(c,story.choices,'¿Cómo queréis cerrar esta historia? La decisión quedará guardada.','Guardar desenlace','ending'));
  }
  function renderSide(c,feedback) {
    const target=c.panels.side,side=c.data.side;
    target.replaceChildren(el('p','Reto paralelo · Una llave','md-caption'),el('h2',side.title));
    if(c.data.wallet.won.includes(c.item.id)){
      target.append(live(feedback||'Reto resuelto. Ya ganaste la llave de este caso.'),button('Consultar el sobre de ayuda',()=>select(c,'help',true),'md-cta'));
      return;
    }
    target.append(el('p',side.brief,'md-question'));
    const work=el('div',null,'vhour-workbench');
    c.sideVoice={voice:null};
    work.append(window.ValdemarHour.proofShelf(side.materials,c.sideVoice),window.ValdemarHour.decision(
      {...side,task:side.task||'¿Qué solución encaja con las pruebas del reto?'},0,{
        submit:async(_index,choice)=>{
          try {
            const result=await request(c,'reward',{proof:{choice}});
            updateWallet(c,result);refreshHelp(c);return {correct:true,feedback:result.feedback};
          }catch(error){
            if(error.status===422)return {correct:false,feedback:error.message};throw error;
          }
        }
      },(_data,note)=>{window.ValdemarHour.stopVoice(c.sideVoice);renderSide(c,note);target.focus({preventScroll:true});}
    ));
    target.append(work);
  }
  function build(c) {
    const {item,frame}=c,story=c.data.story;
    frame.dataset.mdWorld=item.world;
    const header=el('header',null,'md-game-intro'), copy=el('div',null,'md-game-copy'),figure=el('figure'),cover=el('img');
    cover.src='/mundo-'+item.id+'.webp';cover.alt='';cover.width=768;cover.height=512;
    figure.append(cover,el('figcaption',item.place));
    const top=el('div',null,'md-game-top');c.balance=el('span','','md-wallet');c.balance.setAttribute('aria-live','polite');
    top.append(link('← '+worlds.edition(item.world).returnLabel,worlds.route(item.world,item.id)),c.balance);
    c.modeControl=window.ModalidadJuego.create(frame,story,c.data.mode,mode=>request(c,'mode',{mode}));
    copy.append(top,el('p',worlds.nameOf(item.world)+' · '+item.place,'md-caption'),el('h1',story.title),c.modeControl.entry,el('p',story.question,'md-game-question'),el('p',story.intro,'md-game-prose'));
    header.append(copy,figure);
    const nav=el('nav',null,'md-game-tabs');nav.setAttribute('aria-label','Secciones de la partida');
    c.controls={};c.panels={};
    for(const [key,label] of [['main','Investigación'],['side','Reto paralelo'],['help','Sobre de ayuda'],['end','Desenlace']]){
      const b=button(label,()=>select(c,key,true),'md-tab');b.dataset.mdTab=key;
      const p=el('section',null,'md-game-panel md-game-'+key+(key==='side'?' vhour':''));p.hidden=true;p.tabIndex=-1;
      p.id='md-panel-'+key;p.setAttribute('aria-label',label);b.setAttribute('aria-controls',p.id);
      c.panels[key]=p;c.controls[key]=b;nav.append(b);
    }
    if(item.world==='umbravia'){
      c.quiet=button('Lectura silenciosa',()=>quiet(c,!c.silent),'md-muted-toggle');nav.append(c.quiet);
    }
    frame.replaceChildren(header,nav,c.modeControl.change,...Object.values(c.panels));
    c.hour=window.ValdemarHour.mount(c.panels.main,c.data.hour,{
      submit:(index,choice,sources)=>request(c,'stage',{index,choice,...(sources?{sources}:{})}),
      reload:async()=>{const result=await request(c);c.data.progress=result.progress;return result.hour;},
      change:hour=>{c.data.hour=hour;renderEnd(c);},
      finish:()=>select(c,'end',true)
    });
    updateWallet(c,c.data);renderSide(c);refreshHelp(c);renderEnd(c);
    if(c.quiet){
      let value=false;try{value=sessionStorage.getItem('mundos-lectura-silenciosa')==='1';}catch{}
      quiet(c,value);
    }
    const enhance=()=>{
      openTranscripts(c);
      window.MundosLaminas?.enhance(frame,item.world);
    };
    enhance();
    c.modeControl.mount();
    c.observer=new MutationObserver(enhance);
    c.observer.observe(frame,{childList:true,subtree:true});
    select(c,c.data.progress.choice?'end':'main');
  }
  function mountGame(id,bridge) {
    const host=document.getElementById('md-game-host'),item=worlds.story(id);
    if(!host || !item || !bridge)return;
    if(current?.item.id===item.id && current.bridge===bridge && current.signed===bridge.isSignedIn()){
      if(current.frame.parentElement!==host)host.replaceChildren(current.frame);return;
    }
    clear();
    const c={item,bridge,signed:bridge.isSignedIn(),frame:el('div',null,'md-game vd-player')};current=c;
    host.replaceChildren(c.frame);
    if(!c.signed){showAccess(c,'Inicia sesión para consultar tu acceso a esta temporada.',401);return;}
    c.frame.setAttribute('aria-busy','true');c.frame.append(live('Abriendo la investigación…'));
    (async()=>{
      try{
        c.data=await request(c);if(!active(c))return;
        build(c);c.frame.removeAttribute('aria-busy');
      }catch(e){
        if(c===current && !c.frame.querySelector('.md-unavailable'))showAccess(c,e.message||'No se ha podido abrir la investigación.',e.status);
      }
    })();
  }
  Object.assign(worlds,{game,mountGame,clear});
})();
