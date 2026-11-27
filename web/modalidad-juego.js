(() => {
  'use strict';

  function element(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text)node.textContent=text;
    return node;
  }
  function button(label,action) {
    const node=element('button','gm-option',label);
    node.type='button';
    node.addEventListener('click',action);
    return node;
  }
  function create(frame,story,initial,save,onPaper,options) {
    const {caseId,partner,readState,readDossier,data,onState,reopen,partners}=options;
    const editorial=data.editorialPreview===true && !partner;
    let mode=partner?'duo':editorial&&initial==='duo'?'duo':initial?'solo':null;
    let paper=partner?.role==='B'?'B':'A';
    let disposed=false,pending=false,loading=false,waiting=Boolean(data.waitingForPartner && !partner),timer;
    
    const entry=element('section','gm-entry');
    const panel=element('div','gm-panel'),roles=element('div','gm-roles'),tools=element('div','gm-tools');
    const status=element('p','gm-status');status.setAttribute('role','status');status.tabIndex=-1;
    const roleLine=element('p','gm-role-line');
    const group=element('div','gm-options');
    entry.setAttribute('aria-label','Cómo quieres jugar');
    group.setAttribute('role','group');group.setAttribute('aria-label','Modalidad de la partida');
    const solo=button('En solitario',soloChoice),duo=button('En pareja',duoChoice);
    const preview=editorial?button('Revisión editorial de los dos papeles',previewChoice):null;
    group.append(solo,duo);
    entry.append(element('h2','gm-label','Cómo quieres jugar'),group);
    if(preview){preview.className+=' gm-preview';entry.append(preview);}
    panel.append(roles,tools,status);
    entry.append(roleLine,panel);
    const partnerName=partner?.name||'Tu pareja';
    function display(message='') {
      frame.dataset.playMode=waiting?'pending':mode||'pending';frame.dataset.playPaper=waiting?'':mode==='duo'?paper:'all';
      frame.dataset.pairWaiting=String(waiting);
      solo.setAttribute('aria-pressed',String(mode==='solo'&&!waiting));
      duo.setAttribute('aria-pressed',String(Boolean(partner)||waiting));
      solo.disabled=duo.disabled=pending;
      if(preview){preview.setAttribute('aria-pressed',String(mode==='duo'&&!waiting));preview.disabled=pending;}
      roleLine.textContent=!waiting&&mode==='duo'
        ?(editorial?'Vista editorial · Papel ':'Tu papel ')+(paper==='A'?'1':'2')+(partner?' · '+partnerName+' lleva el papel '+(paper==='A'?'2':'1'):'')
        :'';
      if(message)status.textContent=message;
    }
    function tasks() {
      roles.replaceChildren();
      if(!mode||waiting)return;
      for(const [index,text] of (story.roles||[]).entries()){
        const own=(index===0?'A':'B')===paper,number=index+1;
        const card=element('div',own&&mode==='duo'?'gm-task gm-own':'gm-task');
        const who=mode==='solo'?'':editorial?(own?' · vista actual':' · otra vista'):(own?' · tú':' · '+partnerName);
        card.append(element('strong',null,'Papel '+number+who),element('p',null,text));roles.append(card);
      }
    }
    function applyPapers() {
      window.ValdemarHour.filterByRole(frame,mode==='duo'?paper:'');
      onPaper?.(mode==='duo'?paper:'');
    }
    function clearTools() {
      tools.replaceChildren();status.textContent='';
    }
    function showPairTools() {
      if(!partner&&!editorial)return;
      if(editorial && mode==='duo'){
        tools.append(element('p','gm-description','Revisión en esta pantalla. Alterna entre los dos papeles para comprobar las pistas de cada jugador.'));
        const group=element('div','gm-options');
        for(const [i,r] of ['A','B'].entries()){
          const btn=button('Revisar papel '+(i+1),()=>{
            paper=r;tasks();applyPapers();display();
            for(const b of group.children)b.setAttribute('aria-pressed',String(b===btn));
          });
          btn.setAttribute('aria-pressed',String(paper===r));group.append(btn);
        }
        tools.append(group);
      } else if(partner) {
        tools.append(element('p','gm-description','Cada persona ve las pistas de su papel. Contad lo que habéis descubierto antes de acordar la respuesta.'));
      }
    }
    function setPolling() {
      window.clearInterval(timer);
      if(partner||waiting)timer=window.setInterval(refresh,8000);
    }
    async function setMode(next) {
      if(pending||disposed)return;
      pending=true;display('Guardando modalidad…');
      try{
        const result=await save(next);
        if(disposed)return;
        if(result?.mode!==next)throw Error('No se ha podido cambiar la modalidad. Vuelve a intentarlo.');
        if(partner){reopen();return;}
        waiting=false;setPolling();mode=next;tools.replaceChildren();tasks();applyPapers();showPairTools();
        display(next==='solo'?'Estás jugando en solitario.':'Has abierto la revisión de los dos papeles en esta pantalla.');
      }catch(error){if(!disposed)display(error.message||'No se ha podido guardar la modalidad.');}
      finally{if(!disposed){pending=false;display();}}
    }
    function soloChoice() {
      if(pending||disposed)return;
      clearTools();
      if(!partner){
        if(waiting||mode!=='solo')return setMode('solo');
        else{tasks();display('Puedes consultar las pistas de ambos papeles.');}
        return;
      }
      const actions=element('div','gm-options');
      const confirm=button('Continuar en solitario',async()=>{
        confirm.disabled=back.disabled=true;
        try{await setMode('solo');}finally{confirm.disabled=back.disabled=false;}
      });
      const back=button('Seguir en pareja',()=>{clearTools();showPairTools();duo.focus();});
      actions.append(confirm,back);
      tools.append(element('p','gm-description','Si dejas la partida en pareja, cada persona conservará lo que ya habéis resuelto.'),actions);confirm.focus();
    }
    function profileLink(label) {
      const link=element('a','gm-profile',label);
      link.href='/#perfil';return link;
    }
    function showWaiting() {
      tools.replaceChildren(element('p','gm-description','Ya has elegido «En pareja». Tu compañero debe abrir este juego y elegir también «En pareja». Entonces veréis vuestros papeles.'));
      roles.replaceChildren();display('Esperando a tu compañero.');setPolling();
    }
    async function choosePair(input) {
      const result=await partners('/api/partners/play',input);
      if(disposed)return;
      if(result.status==='accepted'){reopen();return;}
      if(result.status!=='pending')throw Error('No se ha podido confirmar la modalidad de este caso.');
      waiting=true;showWaiting();
    }
    function showReceived(incoming) {
      tools.replaceChildren(element('p','gm-description','Todavía no has guardado un compañero. Si eliges a alguien de esta lista, quedará como la única persona en tu perfil y se abrirá vuestra partida.'));
      for(const row of incoming){
        const name=row.partnerName||row.partnerEmail||'tu compañero';
        const identify=[row.partnerName,row.partnerEmail].filter(Boolean).join(' · ');
        if(identify)tools.append(element('p','gm-description',identify));
        tools.append(button('Guardar y jugar en pareja con '+name,async()=>{
          if(pending||disposed)return;
          pending=true;display('Guardando tu elección…');
          try { await choosePair({caseId,invitationId:row.id,saveIfEmpty:true}); }
          catch(error){if(!disposed)display(error.message||'No se ha podido abrir vuestra partida.');}
          finally {if(!disposed){pending=false;display();}}
        }));
      }
      tools.append(profileLink('Elegir mi compañero desde el perfil'));
    }
    async function duoChoice() {
      if(pending||disposed)return;
      clearTools();
      if(partner){tasks();showPairTools();display();return;}
      pending=true;roles.replaceChildren();display('Comprobando este juego…');
      try {
        const result=await partners('/api/partners');
        if(disposed)return;
        if(!result.availableCases.includes(caseId)){
          const pass=element('a','gm-option','Ver mi pase');pass.href='/#planes';
          tools.append(element('p','gm-description','Necesitas acceso a este caso para jugar en pareja.'),pass);
          status.textContent='';return;
        }
        if(!result.preferredEmail){
          const incoming=result.invitations.filter(row=>row.caseId===caseId && row.direction==='received' && row.status==='pending');
          if(incoming.length)showReceived(incoming);
          else tools.append(element('p','gm-description','Guarda a tu compañero en Mi cuenta y volved a este juego. Cada persona debe elegir «En pareja» desde su cuenta.'),profileLink('Añadir mi compañero en Mi cuenta'));
          status.textContent='';return;
        }
        await choosePair({caseId});
      }catch(error){
        if(!disposed){display(error.message||'No se ha podido guardar tu elección.');tools.append(profileLink('Ver mi compañero'));}
      }finally{if(!disposed){pending=false;display();}}
    }
    function previewChoice() {
      if(!editorial||partner||pending||disposed)return;
      if(waiting){display('Para revisar los papeles, retira primero tu elección pasando a solitario.');return;}
      clearTools();
      if(mode!=='duo')return setMode('duo');
      tasks();showPairTools();display();
    }
    tasks();if(waiting)showWaiting();else showPairTools();display();
    const observer=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes) {
        if(node.nodeType===1 && (node.matches('.vhour-shelf')||node.querySelector('.vhour-shelf'))){
          applyPapers();return;
        }
      }
    });
    async function refresh() {
      if(disposed||pending||loading||document.hidden)return;
      loading=true;
      try {
        const state=await readState();
        if(disposed||pending)return;
        if((state.partner?.id||null)!==(partner?.id||null)){reopen();return;}
        if(waiting&&state.waitingForPartner===false){reopen();return;}
        if(!partner||!progressChanged(data,state))return;
        const latest=await readDossier();
        if(disposed||pending)return;
        if(latest.partner?.id!==partner.id){reopen();return;}
        if(onState(latest))display('Tu pareja ha actualizado la investigación.');
      } catch(error) {
        if(!disposed && partner)display(error.message||'No se ha podido actualizar la partida. Volveremos a intentarlo.');
      } finally {loading=false;}
    }
    return {entry,get mode(){return mode;},
      mount(){
        applyPapers();observer.observe(frame,{childList:true,subtree:true});
        document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);setPolling();
      },
      destroy(){
        disposed=true;observer.disconnect();window.clearInterval(timer);
        document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);
      }
    };
  }

  function progressChanged(data,state) {
    const current=state.hour?.current;
    if(!Number.isInteger(current)||current<data.hour.current||!state.progress)return false;
    return (state.sharedHintCount||0)>(data.sharedHintCount||0)||(state.hour.inventory?.revision||0)>(data.hour.inventory?.revision||0)||current>data.hour.current||(!data.progress.deduced&&state.progress.deduced)||(!data.progress.choice&&state.progress.choice);
  }
  function syncProgress(data,state,hourView,renderEnding) {
    if(!progressChanged(data,state))return false;
    const current=state.hour.current;
    const newerStage=current>data.hour.current;
    // Poll responses can arrive after the player's own successful submission.
    const newerDecision=(!data.progress.deduced&&state.progress.deduced)||(!data.progress.choice&&state.progress.choice);
    if(newerStage){data.hour=state.hour;hourView.update(state.hour);}
    if(!newerStage && (state.hour.inventory?.revision||0)>(data.hour.inventory?.revision||0)){
      data.hour.inventory=state.hour.inventory;hourView.updateInventory?.(state.hour.inventory);
    }
    if(newerDecision)data.progress=state.progress;
    renderEnding();return true;
  }
  window.ModalidadJuego=Object.freeze({create,syncProgress});
})();
