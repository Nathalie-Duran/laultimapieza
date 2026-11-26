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
    let disposed=false,pending=false,loading=false,waiting=false,timer;
    let pickerVersion=0;
    const views=[];
    const entry=element('section','gm-entry'),change=element('section','gm-change');
    const panel=element('div','gm-panel'),roles=element('div','gm-roles'),tools=element('div','gm-tools');
    const status=element('p','gm-status');status.setAttribute('role','status');status.tabIndex=-1;
    panel.append(roles,tools,status);
    const partnerName=partner?.name||'Tu pareja';
    function display(message='') {
      frame.dataset.playMode=mode||'pending';frame.dataset.playPaper=mode==='duo'?paper:'all';
      for(const {solo,duo,preview,roleLine} of views){
        solo.setAttribute('aria-pressed',String(mode==='solo'));
        duo.setAttribute('aria-pressed',String(Boolean(partner)));
        solo.disabled=duo.disabled=pending;
        if(preview){preview.setAttribute('aria-pressed',String(mode==='duo'));preview.disabled=pending;}
        if(roleLine)roleLine.textContent=mode==='duo'
          ?(editorial?'Vista editorial · Papel ':'Tu papel ')+(paper==='A'?'1':'2')+(partner?' · '+partnerName+' lleva el papel '+(paper==='A'?'2':'1'):'')
          :'';
      }
      if(message)status.textContent=message;
    }
    function tasks() {
      roles.replaceChildren();
      if(!mode)return;
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
    function movePanel(box) {
      if(panel.parentElement!==box)box.append(panel);
      pickerVersion++;
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
        mode=next;tools.replaceChildren();tasks();applyPapers();showPairTools();
        display(next==='solo'?'Estás jugando en solitario.':'Has abierto la revisión de los dos papeles en esta pantalla.');
      }catch(error){if(!disposed)display(error.message||'No se ha podido guardar la modalidad.');}
      finally{if(!disposed){pending=false;display();}}
    }
    function soloChoice(box) {
      if(pending||disposed)return;
      movePanel(box);
      if(!partner){
        if(mode!=='solo')return setMode('solo');
        else{tasks();display('Puedes consultar las pistas de ambos papeles.');}
        return;
      }
      const actions=element('div','gm-options');
      const confirm=button('Continuar en solitario',async()=>{
        confirm.disabled=back.disabled=true;
        try{await setMode('solo');}finally{confirm.disabled=back.disabled=false;}
      });
      const back=button('Seguir en pareja',()=>{movePanel(box);showPairTools();views.find(view=>view.box===box)?.duo.focus();});
      actions.append(confirm,back);
      tools.append(element('p','gm-description','Si dejas la partida en pareja, cada persona conservará lo que ya habéis resuelto.'),actions);confirm.focus();
    }
    function inviteForm(result,version) {
      const invitations=result.invitations.filter(row=>row.caseId===caseId);
      const accepted=invitations.find(row=>row.status==='accepted');
      if(accepted){
        tools.append(element('p','gm-description','Este caso ya tiene pareja. Para jugar juntos, ambos necesitáis acceso al caso desde vuestra cuenta.'));
        const check=button('Comprobar acceso',async()=>{
          check.disabled=true;
          try{const state=await readState();if(disposed||version!==pickerVersion)return;
            if(state.partner)reopen();else display('La partida compartida aún no está disponible.');
          }catch(error){if(!disposed)display(error.message);}finally{check.disabled=false;}
        });tools.append(check);return;
      }
      if(!result.availableCases.includes(caseId)){
        const a=element('a','gm-option','Ver mi pase');a.href='/#planes';
        tools.append(element('p','gm-description','Necesitas tener este caso abierto en tu pase antes de invitar o aceptar.'),a);return;
      }
      const incoming=invitations.filter(row=>row.direction==='received' && row.status==='pending');
      for(const row of incoming){
        const name=row.partnerName||row.partnerEmail||'La otra persona';
        const accept=button('Aceptar y jugar',async()=>{
          accept.disabled=true;
          try{
            await partners('/api/partners/'+encodeURIComponent(row.id)+'/accept',{});
            if(!disposed)reopen();
          }catch(error){if(!disposed)display(error.message||'No se ha podido aceptar la invitación.');}
          finally{accept.disabled=false;}
        });
        tools.append(element('p','gm-description',name+' te ha invitado a este caso.'),accept);
      }
      const outgoing=invitations.find(row=>row.direction==='sent'&&row.status==='pending');
      if(outgoing){
        waiting=true;setPolling();
        tools.append(element('p','gm-description','Has invitado a '+(outgoing.partnerEmail||outgoing.partnerName||'tu pareja')+'. La partida compartida se abrirá aquí cuando acepte.'));
      }else if(!incoming.length){
        const form=element('form','gm-form'),label=element('label',null,'Correo de tu compañero de juego');
        const input=element('input');input.type='email';input.name='partnerEmail';input.required=true;input.maxLength=254;
        input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','none');
        input.placeholder='nombre@ejemplo.es';input.value=result.preferredEmail||'';label.append(input);
        const send=element('button','gm-option','Invitar a mi compañero');send.type='submit';
        form.append(label,send);
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(send.disabled||!form.reportValidity())return;
          send.disabled=true;const email=input.value.trim();
          try{
            await partners('/api/partners',{caseId,email});
            if(disposed)return;
            waiting=true;setPolling();
            if(version!==pickerVersion)return;
            tools.replaceChildren(element('p','gm-description','Invitación guardada para '+email+'. Cuando la acepte, se abrirá aquí vuestra partida.'));
            display('Esperando a tu compañero.');
          }catch(error){if(!disposed && version===pickerVersion)display(error.message||'No se ha podido enviar la invitación.');}
          finally{send.disabled=false;}
        });
        tools.append(element('p','gm-description','Tu compañero recibirá la invitación en su cuenta. Podéis jugar desde dispositivos distintos cuando ambos tengáis acceso al caso.'),form);
      }
      const manage=element('a','gm-profile','Gestionar invitaciones en mi perfil');
      manage.href='/#perfil?seccion=pareja&juego='+caseId;tools.append(manage);
    }
    async function duoChoice(box) {
      if(pending||disposed)return;
      movePanel(box);
      if(partner){tasks();showPairTools();display();return;}
      roles.replaceChildren();
      const version=pickerVersion;display('Consultando tu pareja y tus invitaciones…');
      try{
        const result=await partners('/api/partners');
        if(disposed||version!==pickerVersion)return;
        status.textContent='';inviteForm(result,version);
      }catch(error){if(!disposed && version===pickerVersion)display(error.message||'No se han podido cargar tus invitaciones.');}
    }
    function previewChoice(box) {
      if(!editorial||partner||pending||disposed)return;
      movePanel(box);
      if(mode!=='duo')return setMode('duo');
      tasks();showPairTools();display();
    }
    function choices(box,title) {
      box.setAttribute('aria-label',title);
      const group=element('div','gm-options');group.setAttribute('role','group');group.setAttribute('aria-label','Modalidad de la partida');
      const solo=button('En solitario',()=>soloChoice(box)),duo=button('En pareja',()=>duoChoice(box));
      group.append(solo,duo);box.append(element('h2','gm-label',title),group);
      const preview=editorial?button('Revisión editorial de los dos papeles',()=>previewChoice(box)):null;
      if(preview){preview.className+=' gm-preview';box.append(preview);}
      const roleLine=box===change?element('p','gm-role-line'):null;
      if(roleLine)box.append(roleLine);
      views.push({box,solo,duo,preview,roleLine});
    }
    choices(entry,'Cómo quieres jugar');choices(change,'Modalidad de la partida');
    entry.append(panel);tasks();showPairTools();display();
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
    return {entry,change,get mode(){return mode;},
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
