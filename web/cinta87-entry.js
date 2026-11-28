(() => {
  'use strict';
  const standalone=document.body.dataset.vallejoStandalone==='true';
  const here=new URL(location.href);
  if(document.body.dataset.cintaAlias!==undefined){
    here.pathname='/cinta-87.html';
    location.replace(here.href);
    return;
  }
  const archive=standalone && here.searchParams.get('archivo')==='1';
  const sharedLink='https://www.laultimapieza.es/cinta-87.html?via=invitacion';
  const events={start:'demo_start',receipt:'demo_receipt',solved:'demo_solved',complete:'demo_complete',hint:'demo_hint'};
  let running=null,trigger=null,consent=false,started=false,countedStart=false;
  const owned=()=>!standalone && history.state?.cinta87Dialog===location.href;
  const signal=()=>window.dispatchEvent(new CustomEvent('case-preview-progress'));
  function caseCode(){
    const requested=here.searchParams.get('caso') || document.body.dataset.valdemarCase;
    return /^(?:0?[1-9]|[1-3][0-9]|4[0-8])$/.test(requested||'')?String(requested).padStart(2,'0'):null;
  }
  function casePath(){
    const code=caseCode();
    if(!code)return null;
    const id=Number(code);
    if(id<=12)return '/valdemar/'+code+'/';
    const world=['expedicion','umbravia','necropolis'][Math.floor((id-13)/12)];
    return '/#'+world+'?lugar='+((id-1)%12+1)+'&seccion=ficha';
  }
  function archiveUrl(){
    const url=new URL('/cinta-87.html',location.origin);
    url.searchParams.set('archivo','1');
    const code=caseCode();if(code)url.searchParams.set('caso',code);
    if(here.searchParams.get('via')==='invitacion')url.searchParams.set('via','invitacion');
    return url.pathname+url.search;
  }
  function track(key){
    if(!Object.hasOwn(events,key))return;
    if(key==='start')started=true;
    if(key==='start'||key==='complete')signal();
    if(!consent || (key==='start'&&countedStart))return;
    if(key==='start'){countedStart=true;window.InvitationCounts?.start();}
    fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({event:events[key],consent:true})}).catch(()=>{});
  }
  function options(){
    const box=document.createElement('details');box.className='c87-utilities case-share';
    const summary=document.createElement('summary');summary.textContent='Compartir y privacidad';
    const row=document.createElement('div'),copy=document.createElement('button'),label=document.createElement('label');
    copy.type='button';copy.dataset.copyInvite=sharedLink;copy.textContent='Copiar enlace público a la demo';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=consent;
    checkbox.addEventListener('change',()=>{
      consent=checkbox.checked;window.InvitationCounts?.setConsent(consent);if(consent&&started)track('start');
    });
    label.append(checkbox,document.createTextNode(' Permitir contadores anónimos de uso'));
    const status=document.createElement('p');status.setAttribute('role','status');
    row.append(copy,label,status);box.append(summary,row);return box;
  }
  function exit(){
    if(standalone){location.assign(casePath()||'/#casos');return;}
    if(owned()){close();history.back();}else close();
  }
  function close(){
    if(!running)return;
    running.destroy?.();running=null;
    if(!standalone){
      const dialog=document.getElementById('scene-preview');
      if(dialog.open)dialog.close();
      dialog.classList.remove('c87-dialog');dialog.replaceChildren();
      dialog.removeAttribute('aria-label');dialog.setAttribute('aria-labelledby','scene-title');
      const target=trigger?.isConnected?trigger:document.querySelector('[data-action="preview-open"]');
      target?.focus({preventScroll:true});trigger=null;
    }
    signal();
  }
  function open(origin){
    if(archive||running)return;
    const host=document.getElementById(standalone?'cinta87-standalone-host':'scene-preview');
    if(!host||!window.Cinta87Demo)return;
    consent=consent||Boolean(window.InvitationCounts?.enabled);
    started=false;countedStart=false;
    if(!standalone){
      trigger=origin||document.activeElement;
      const modal=document.getElementById('modal');if(modal?.open)modal.close();
      if(!owned())history.pushState({...history.state,cinta87Dialog:location.href},'');
      host.removeAttribute('aria-labelledby');host.setAttribute('aria-label','La cinta 87');
      host.classList.add('c87-dialog');
    }else{
      host.classList.remove('v87-paused');host.classList.add('c87-page');
    }
    const game=document.createElement('div');host.replaceChildren(game,options());
    if(!standalone&&!host.open)host.showModal();
    const exitLabel=standalone?(caseCode()?'Volver a la ficha':'Volver al catálogo'):'Cerrar la demo';
    running=window.Cinta87Demo.mount(game,{exitLabel,onArchive:()=>location.assign(archiveUrl()),onExit:exit,onEvent:track});
  }
  window.CasePreview={open:(_format,origin)=>open(origin),close:exit,
    hasProgress:()=>Boolean(window.Cinta87Demo?.hasProgress()),isComplete:()=>Boolean(window.Cinta87Demo?.isComplete())};
  if(archive)return;
  document.addEventListener('click',event=>{
    const origin=event.target.closest?.('[data-action="preview-open"]');
    if(origin && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (event.button??0)===0){
      event.preventDefault();open(origin);
    }
  });
  if(!standalone){
    const dialog=document.getElementById('scene-preview');
    dialog?.addEventListener('cancel',event=>{if(running){event.preventDefault();exit();}});
    window.addEventListener('popstate',()=>{if(owned())open();else close();});
    window.addEventListener('hashchange',()=>{if(!owned())close();});
  }
  if(standalone || owned())open();
})();
