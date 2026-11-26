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
    const {caseId,partner,readState,readDossier,data,onState,reopen}=options;
    // A legacy shared-screen record has the same saved progress as a solo record.
    let mode=partner?'duo':initial?'solo':null;
    const paper=partner?.role==='B'?'B':'A';
    const partnerName=partner?.name||'tu compañero';
    let pending=false,disposed=false,confirming=false,loading=false,timer;
    const views=[];
    const href='/#perfil?seccion=pareja&juego='+caseId;
    function applyPapers() {
      window.ValdemarHour.filterByRole(frame,partner?paper:'');
      onPaper?.(partner?paper:'');
    }
    function display(message='') {
      frame.dataset.playMode=mode||'pending';
      frame.dataset.playPaper=partner?paper:'all';
      summary.textContent=partner?'Tu partida con '+partnerName:mode?'Modalidad · En solitario':'Elegir modalidad';
      for(const view of views) {
        view.solo.setAttribute('aria-pressed',String(mode==='solo'));
        view.solo.disabled=pending;
        view.confirm.hidden=!confirming;
        view.confirmButton.disabled=view.cancelButton.disabled=pending;
        view.notes.hidden=mode!=='solo'||!story.roles?.length;
        view.status.textContent=message;
      }
    }
    async function saveSolo() {
      if(disposed||pending||mode==='solo')return;
      pending=true;display('Guardando modalidad…');
      try {
        const result=await save('solo');
        if(disposed)return;
        if(result?.mode!=='solo')throw Error('Vuelve a intentarlo para guardar la modalidad.');
        if(partner){reopen();return;}
        mode='solo';display('Partida en solitario guardada.');applyPapers();
      } catch(error) {
        if(!disposed)display(error.message||'No se ha podido guardar la modalidad.');
      } finally {
        pending=false;
        for(const view of views)view.solo.disabled=view.confirmButton.disabled=view.cancelButton.disabled=false;
      }
    }
    function panel(box) {
      const group=element('div','gm-options');
      group.setAttribute('role','group');group.setAttribute('aria-label','Modalidad de la partida');
      const solo=button('En solitario',()=>{
        if(partner){confirming=true;display();confirmButton.focus();}
        else saveSolo();
      });
      const invite=element('a','gm-option',partner?'Gestionar pareja':'Invitar a alguien');
      invite.href=href;group.append(solo,invite);
      const description=element('p','gm-description',partner
        ?'Juegas con '+partnerName+'. Tú llevas el papel '+(paper==='A'?'1':'2')+'. Las etapas y el desenlace se guardan en las dos cuentas.'
        :'A solas puedes consultar los dos papeles. Para investigar con otra persona, invítala a este caso desde tu perfil.');
      const confirm=element('div','gm-confirm');
      const confirmButton=button('Continuar en solitario',saveSolo);
      const cancelButton=button('Seguir en pareja',()=>{confirming=false;display();solo.focus();});
      const actions=element('div','gm-options');actions.append(confirmButton,cancelButton);
      confirm.append(element('p','gm-description','La partida dejará de estar compartida. Cada persona conservará lo que ya habéis resuelto.'),actions);
      const notes=element('details','gm-solo-notes'),tasks=element('ol');
      for(const text of story.roles||[])tasks.append(element('li',null,text));
      notes.append(element('summary',null,'Ver tus dos tareas'),tasks);
      const status=element('p','gm-status');status.setAttribute('role','status');
      box.append(group,description);
      const instruction=partner&&story.roles?.[paper==='A'?0:1];
      if(instruction)box.append(element('p','gm-instruction',instruction));
      box.append(confirm,notes,status);
      views.push({solo,confirm,confirmButton,cancelButton,notes,status});
    }
    const entry=element('section','gm-entry'),heading=element('h2','gm-label',partner?'Investigación compartida':'Tu mesa de juego');
    entry.setAttribute('aria-label','Modalidad de la partida');entry.append(heading);panel(entry);
    const change=element('details','gm-change'),summary=element('summary');
    change.append(summary);const inner=element('div','gm-change-body');change.append(inner);panel(inner);
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
        if(!partner||!progressChanged(data,state))return;
        const latest=await readDossier();
        if(disposed||pending)return;
        if(latest.partner?.id!==partner.id){reopen();return;}
        if(onState(latest))display('Tu pareja ha actualizado la investigación.');
      } catch(error) {
        if(!disposed && partner)display(error.message||'No se ha podido actualizar la partida. Volveremos a intentarlo.');
      } finally {loading=false;}
    }
    display();
    return {entry,change,get mode(){return mode;},
      mount(){
        applyPapers();observer.observe(frame,{childList:true,subtree:true});
        document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
        if(partner)timer=window.setInterval(refresh,8000);
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
    return current>data.hour.current||(!data.progress.deduced&&state.progress.deduced)||(!data.progress.choice&&state.progress.choice);
  }
  function syncProgress(data,state,hourView,renderEnding) {
    if(!progressChanged(data,state))return false;
    const current=state.hour.current;
    const newerStage=current>data.hour.current;
    // Poll responses can arrive after the player's own successful submission.
    const newerDecision=(!data.progress.deduced&&state.progress.deduced)||(!data.progress.choice&&state.progress.choice);
    if(newerStage){data.hour=state.hour;hourView.update(state.hour);}
    if(newerDecision)data.progress=state.progress;
    renderEnding();return true;
  }
  window.ModalidadJuego=Object.freeze({create,syncProgress});
})();
