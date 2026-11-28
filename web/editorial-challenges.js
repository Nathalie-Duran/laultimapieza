(() => {
  'use strict';
  const labels = {draft:'Borrador',published:'Publicado',withdrawn:'Retirado'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const request = (path,input,method) => window.GameAccountBridge.request(path,input,method);
  const canManage = () => window.ClubAccess?.state?.canManage===true;
  const publicPath = '/api/published-challenges', adminPath = '/api/admin/challenges';
  if(typeof customElements!=='undefined' && !customElements.get('challenge-keyring'))customElements.define('challenge-keyring',class extends HTMLElement {
    connectedCallback(){
      this.panel=this.closest('.adventure-challenges');
      this.refresh=()=>this.showWallet();
      this.panel?.addEventListener('mansion-arcade-reward',this.refresh);
      this.panel?.addEventListener('editorial-challenge-solved',this.refresh);
      this.showWallet();
      this.showResume();
    }
    disconnectedCallback(){
      this.panel?.removeEventListener('mansion-arcade-reward',this.refresh);
      this.panel?.removeEventListener('editorial-challenge-solved',this.refresh);
    }
    async showResume(){
      if(!window.GameAccountBridge?.isSignedIn())return;
      const link=this.panel?.querySelector('.reto-acciones a[href="/#archivo"]');
      if(!link)return;
      try{
        const {games}=await request('/api/valdemar/partidas');
        if(!link.isConnected)return;
        const latest=games.filter(game=>game.available&&!game.finished && Number.isInteger(game.id)&&game.id>=1&&game.id<=48)
          .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id)[0];
        if(!latest)return;
        const title=latest.title || [...(window.ValdemarCatalog?.items||[]),...(window.MundosCatalogo||[])].find(game=>game.id===latest.id)?.title;
        link.href='/#'+(latest.id<=12?'valdemar-jugar':'mundos-jugar')+'?id='+latest.id+'&retomar=1';
        link.textContent=title?'Continuar '+title:'Continuar mi partida';
      }catch{/* The saved-games link remains usable if the latest checkpoint is unavailable. */}
    }
    async showWallet(){
      this.innerHTML='<div><h2>Tu llavero</h2><p>Una pista orientativa cuesta una llave. Una pista detallada cuesta dos y la solución explicada cuesta tres.</p></div>';
      if(!window.GameAccountBridge?.isSignedIn())return;
      const status=document.createElement('p');
      status.setAttribute('role','status');
      status.textContent='Consultando saldo…';
      this.append(status);
      try{
        const {wallet}=await request('/api/valdemar/seasons');
        if(!status.isConnected || !wallet)return;
        status.textContent=wallet.balance+(wallet.balance===1?' llave disponible':' llaves disponibles');
        const won=new Set(wallet.won);
        for(const label of this.panel.querySelectorAll('[data-reto-premio]')){
          if(won.has(Number(label.dataset.retoPremio)))label.textContent='Premio recibido';
        }
      }catch{if(status.isConnected)status.textContent='El saldo se mostrará cuando recuperes la conexión.';}
    }
  });
  function view() {
    return '<section class="account-card reto-calendario" id="calendar-challenges"><h2>El calendario de juego</h2><ul class="reto-periodos"><li><strong>Desafío diario</strong><span>Una prueba · 1 llave</span></li><li><strong>Misión semanal</strong><span>Tres pruebas de lunes a domingo · 2 llaves</span></li></ul><p>Participa cuando te apetezca. Si dejas pasar una edición, conservas las llaves y el avance de tus aventuras. Los periodos cambian a medianoche, hora de Madrid.</p><p role="status" aria-live="polite"></p><div data-challenges></div></section>'+
      '<section class="account-card" id="published-challenges"><h2>Desafíos de la edición</h2><p>Pruebas adicionales que el equipo publica para los casos del tablero.</p><p role="status" aria-live="polite"></p><div data-challenges></div></section>';
  }
  function question(item){
    return `<fieldset><legend>Prueba ${item.index+1} de ${item.total} · ${esc(item.prompt)}</legend>
      ${item.options.map((opt,index)=>`<label class="field"><span><input name="option" type="radio" value="${index}" required> ${esc(opt)}</span></label>`).join('')}</fieldset>
      <button type="submit" class="button primary">Comprobar respuesta</button>`;
  }
  async function mount() {
    await Promise.all([mountPanel('published-challenges',publicPath,false),mountPanel('calendar-challenges','/api/calendar-challenges',true)]);
  }
  async function mountPanel(panelId,path,calendar) {
    const panel=document.getElementById(panelId);
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound='1';
    const status=panel.querySelector('[role=status]'), list=panel.querySelector('[data-challenges]');
    if (!window.GameAccountBridge?.isSignedIn()) {
      status.textContent=calendar?'El calendario se abre con el primer caso de Valdemar.':'Inicia sesión para consultar los desafíos de tus casos.';
      return;
    }
    status.textContent='Cargando desafíos…';
    try {
      const {items}=await request(path);
      if (!panel.isConnected) return;
      status.textContent=calendar?(items.length?'Ediciones disponibles ahora.':'El calendario se abre con el primer caso de Valdemar.'):(items.length?'Gana una llave la primera vez que resuelvas cada desafío.':'Todavía no hay desafíos editoriales publicados para tus casos disponibles.');
      list.innerHTML=items.map(item=>`<details class="account-card"><summary>${calendar?esc(scheduleKinds[item.schedule.kind])+' · ':''}${esc(item.title)}${item.solved?' · Resuelto':''}</summary>
        <p>Tablero ${Math.ceil(item.caseId/12)} · Caso ${(item.caseId-1)%12+1} · ${item.total} ${item.total===1?'prueba':'pruebas'} ${scheduleCaption(item.schedule)}</p>
        ${calendar?'<p>'+item.prize+(item.prize===1?' llave':' llaves')+' por la primera resolución.</p>':''}<form data-challenge="${esc(item.id)}" data-index="${item.index}" data-revision="${item.revision}">
        <p role="status" aria-live="polite"></p><div data-question>${question(item)}</div></form></details>`).join('');
      list.onsubmit=async event=>{
        const form=event.target;
        if(!form.matches('[data-challenge]'))return;
        event.preventDefault();
        const button=form.querySelector('button'), feedback=form.querySelector('[role=status]');
        if(button.disabled)return;
        button.disabled=true;
        try {
          const result=await request(path,{id:form.dataset.challenge,revision:Number(form.dataset.revision),index:Number(form.dataset.index),option:Number(form.elements.option.value)},'POST');
          if(!panel.isConnected)return;
          feedback.textContent=result.correct?result.explanation:'Revisa las pistas y prueba otra respuesta.';
          if(result.correct && !result.next.solved){
            form.dataset.index=String(result.next.index);
            form.querySelector('[data-question]').innerHTML=question(result.next);
            form.querySelector('input').focus();
          }
          if(result.correct && result.next.solved){
            const summary=form.closest('details').querySelector('summary');
            if(!summary.textContent.endsWith(' · Resuelto'))summary.textContent+=' · Resuelto';
            panel.dispatchEvent(new CustomEvent('editorial-challenge-solved',{bubbles:true}));
          }
        } catch(error){
          if(!panel.isConnected)return;
          if(calendar && error.status===404){
            delete panel.dataset.bound;
            await mountPanel(panelId,path,true);
            status.textContent='El calendario ha cambiado. Elige una de las ediciones disponibles.';
          }else feedback.textContent=error.message||'No se ha podido comprobar la respuesta.';
        }
        finally{button.disabled=false;}
      };
    } catch(error) {
      if(!panel.isConnected)return;
      status.textContent=error.message||'No se pudieron cargar los desafíos.';
      list.innerHTML='<button type="button" class="button">Reintentar</button>';
      list.querySelector('button').onclick=()=>{delete panel.dataset.bound;list.replaceChildren();mountPanel(panelId,path,calendar);};
    }
  }
  const scheduleKinds={always:'Permanente',daily:'Desafío diario',weekly:'Misión semanal',event:'Evento especial'};
  function scheduleFields(schedule={}) {
    const current=schedule||{},kind=current.kind||'always';
    return `<challenge-window><fieldset><legend>Calendario de publicación</legend>
      <label>Tipo de edición<select name="scheduleKind">${Object.entries(scheduleKinds).map(([value,label])=>`<option value="${value}" ${kind===value?'selected':''}>${label}</option>`).join('')}</select></label>
      <label data-start>Primer día de juego<input type="date" name="scheduleStart" value="${esc(current.startsOn)}"></label>
      <label data-end>Último día incluido<input type="date" name="scheduleEnd" value="${esc(current.endsOn)}"></label>
      <p class="mg-note" data-note></p></fieldset></challenge-window>`;
  }
  function readSchedule(controls) {
    return {kind:controls.namedItem('scheduleKind').value,startsOn:controls.namedItem('scheduleStart').value,
      endsOn:controls.namedItem('scheduleEnd').value};
  }
  function scheduleCaption(schedule) {
    if(!schedule||schedule.kind==='always')return '';
    const date=s=>s.split('-').reverse().join('/');
    const dates=schedule.startsOn===schedule.endsOn?date(schedule.startsOn):date(schedule.startsOn)+' – '+date(schedule.endsOn);
    return ' · '+esc(scheduleKinds[schedule.kind])+' · '+esc(dates)+' (Madrid)';
  }
  if(window.customElements && !customElements.get('challenge-window'))customElements.define('challenge-window',class extends HTMLElement {
    connectedCallback() {
      const select=this.querySelector('select');
      if(!select || this.bound)return;
      this.bound=true;
      const refresh=()=>{
        const kind=select.value;
        const hasStart=kind!=='always',hasEnd=kind==='event';
        for(const [selector,shown] of [['[data-start]',hasStart],['[data-end]',hasEnd]]){
          const wrap=this.querySelector(selector);wrap.hidden=!shown;
          const input=wrap.querySelector('input');input.required=shown;input.disabled=!shown;
        }
        this.querySelector('[data-note]').textContent={
          always:'Estará disponible mientras esté publicado.',
          daily:'Se juega durante el día elegido, de medianoche a medianoche en Madrid.',
          weekly:'Se juega durante siete días consecutivos desde la apertura, en horario de Madrid.',
          event:'Estará disponible desde el primer día hasta la medianoche posterior al último, en horario de Madrid.'
        }[kind];
      };
      select.addEventListener('change',refresh);
      refresh();
    }
  });
  function adminView(){
    return canManage()?'<section class="mg-panel mg-block" id="mg-challenge-editor"><h2>Editar desafíos y aventuras</h2><p class="mg-note">Vincula un desafío a un caso de cualquier tablero. Añade hasta ocho pruebas sucesivas para convertirlo en una aventura. El progreso se guarda al resolver cada prueba.</p><button class="mg-refresh" type="button" data-open-editor>Abrir editor</button><div data-editor></div><p role="status" aria-live="polite"></p></section>':'';
  }
  function adminMount(){
    const panel=document.getElementById('mg-challenge-editor');
    if(!panel||!canManage()||panel.dataset.bound)return;
    panel.dataset.bound='1';
    const open=panel.querySelector('[data-open-editor]'), host=panel.querySelector('[data-editor]'), message=panel.querySelector('[role=status]');
    let items=[], draft;
    function stageFields(stage={},optional=false,metrics){
      return `<fieldset data-stage><legend>${optional?'Prueba adicional':'Primera prueba'}</legend>
        ${metrics?`<p class="mg-note">Han respondido ${Number(metrics.attempted)} cuentas. Han resuelto la prueba ${Number(metrics.solved)}. Pendientes: ${Number(metrics.attempted)-Number(metrics.solved)}.</p>`:''}
        <label>Enunciado y pistas<textarea name="prompt" required rows="3" maxlength="1500">${esc(stage.prompt)}</textarea></label>
        <label>Opciones, una por línea (de 2 a 6)<textarea name="options" required rows="4" maxlength="1090">${esc((stage.options || []).join('\n'))}</textarea></label>
        <label>Número de la opción correcta<input type="number" name="answer" required min="1" max="6" value="${(stage.answer || 0)+1}"></label>
        <label>Explicación al acertar<textarea name="explanation" required maxlength="800">${esc(stage.explanation)}</textarea></label>
        ${optional?'<button class="mg-refresh" type="button" data-remove-stage>Quitar esta prueba</button>':''}</fieldset>`;
    }
    function fields(item){
      draft=item || {id:crypto.randomUUID(),revision:0,status:'draft',caseId:1,options:[],answer:0};
      return `<form class="mg-review">
        <label>Título<input name="title" required maxlength="90" value="${esc(draft.title)}"></label>
        <label>Caso que da acceso<select name="caseId">${Array.from({length:48},(_,i)=>`<option value="${i+1}" ${draft.caseId===i+1?'selected':''}>Tablero ${Math.floor(i/12)+1} · Caso ${i%12+1}</option>`).join('')}</select></label>
        <div data-stages>${stageFields(draft,false,draft.metrics?.[0])}${(draft.steps||[]).map((stage,i)=>stageFields(stage,true,draft.metrics?.[i+1])).join('')}</div>
        <button class="mg-refresh" type="button" data-add-stage ${(draft.steps||[]).length>=7?'disabled':''}>Añadir otra prueba</button>
        ${scheduleFields(draft.schedule)}
        <label>Estado<select name="status">${Object.entries(labels).map(([k,label])=>`<option value="${k}" ${draft.status===k?'selected':''}>${label}</option>`).join('')}</select></label>
        <p class="mg-note">${draft.revision ? 'Cuentas que probaron este desafío: '+draft.attempted+'. Cuentas que lo resolvieron: '+draft.solved+'.' : 'El borrador solo está disponible en gestión.'}</p>
        <button type="submit" class="mg-refresh">Guardar edición</button></form>`;
    }
    function render(selected){
      host.innerHTML=`<label class="mg-review">Desafío o aventura<select data-select-game><option value="">Crear nuevo</option>${items.map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(v.title)} · ${labels[v.status]}</option>`).join('')}</select></label><div data-game-fields>${fields(items.find(v=>v.id===selected))}</div>`;
    }
    open.onclick=async()=>{
      open.disabled=true;
      try{
        ({items}=await request(adminPath));
        if(!panel.isConnected||!canManage())return;
        render();open.hidden=true;
      }catch(error){message.textContent=error.message||'No se pudo abrir el editor.';}
      finally{open.disabled=false;}
    };
    host.addEventListener('change',event=>{
      if(!event.target.matches('[data-select-game]'))return;
      message.textContent='';
      host.querySelector('[data-game-fields]').innerHTML=fields(items.find(v=>v.id===event.target.value));
    });
    host.addEventListener('click',event=>{
      const add=host.querySelector('[data-add-stage]'), stages=host.querySelector('[data-stages]');
      if(event.target.matches('[data-add-stage]') && stages.children.length<8) {
        stages.insertAdjacentHTML('beforeend',stageFields({},true));
        stages.lastElementChild.querySelector('textarea').focus();
      } else if(event.target.matches('[data-remove-stage]')) event.target.closest('[data-stage]').remove();
      else return;
      add.disabled=stages.children.length>=8;
    });
    host.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.target, controls=form.elements;
      if(!canManage()||form.dataset.saving)return;
      const value=key=>controls.namedItem(key).value.trim();
      const stages=Array.from(form.querySelectorAll('[data-stage]'),section=>{
        const field=key=>section.querySelector('[name="'+key+'"]').value.trim();
        return {prompt:field('prompt'),options:field('options').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
          answer:Number(field('answer'))-1,explanation:field('explanation')};
      });
      const payload={id:draft.id,revision:draft.revision,title:value('title'),caseId:Number(value('caseId')),
        ...stages[0],steps:stages.slice(1),schedule:readSchedule(controls),status:value('status')};
      const select=host.querySelector('[data-select-game]');
      form.dataset.saving='1'; select.disabled=true;
      for(const el of controls)el.disabled=true;
      try{
        const saved=await request(adminPath,payload,'PUT');
        if(!panel.isConnected||!canManage())return;
        const previous=items.find(v=>v.id===saved.id);
        const item={attempted:0,solved:0,...previous,...payload,...saved};
        items=items.filter(v=>v.id!==saved.id).concat(item);
        render(saved.id);
        message.textContent='Edición guardada. Estado: '+labels[saved.status]+'.';
      }catch(error){if(panel.isConnected)message.textContent=error.message||'No se ha podido guardar la edición.';}
      finally{select.disabled=false;delete form.dataset.saving;for(const el of controls)el.disabled=false;}
    });
  }
  window.EditorialChallenges=Object.freeze({view,mount,adminView,adminMount});
})();
