(() => {
  'use strict';
  function resetLocalSessions(sessions,userId) {
    const remaining=[];
    for(const original of sessions){
      if(!original.members?.some(member=>member.userId===userId)){
        remaining.push(original);
        continue;
      }
      if(!original.members.some(member=>member.userId!==userId))continue;
      const session=structuredClone(original);
      session.members=session.members.filter(member=>member.userId!==userId);
      session.ownerId=session.members[0].userId;
      session.mode='solo';
      if(session.status==='waiting')session.status='active';
      session.inviteActive=false;
      session.version=(session.version||0)+1;
      session.votes=(session.votes||[]).filter(vote=>vote.userId!==userId);
      delete session.firstVotes?.[userId];
      delete session.firstVoteEffects?.[userId];
      for(const step of session.history||[]){
        delete step.preferences?.[userId];
        delete step.preferenceEffects?.[userId];
      }
      remaining.push(session);
    }
    return remaining;
  }
  function open(context) {
    const requestId=context.online?crypto.randomUUID():null;
    const explanation=context.online?
      'Se borrarán tus partidas, desenlaces, piezas, llaves y modalidades guardadas. Conservarás tu cuenta y los bloques abonados. Para volver a abrir la temporada siguiente tendrás que terminar de nuevo los doce casos anteriores.':
      'Se borrarán las partidas, desenlaces y puntos de este perfil en este navegador.';
    context.modal('<h2 id="modal-title">Reiniciar mi progreso</h2><p>'+explanation+'</p><p>Quienes hayan jugado contigo conservarán su avance. Este reinicio es definitivo.</p>'+
      '<form id="progress-reset-form"><label class="field" for="progress-reset-word">Escribe REINICIAR para confirmar</label><input id="progress-reset-word" name="word" autocomplete="off" autocapitalize="characters" spellcheck="false" required>'+
      '<p role="status" aria-live="polite"></p><div class="actions"><button type="button" class="button" data-action="close">Cancelar</button><button type="submit" class="button primary" disabled>Reiniciar mi progreso</button></div></form>');
    const form=document.getElementById('progress-reset-form'),word=form.elements.word,submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
    let pending=false,resetConfirmed=false;
    const ready=()=>word.value.trim()==='REINICIAR';
    word.addEventListener('input',()=>{submit.disabled=pending||!ready();});
    word.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(pending||!ready()||!context.isCurrent())return;
      pending=true;word.readOnly=true;submit.disabled=true;
      status.textContent=resetConfirmed?'Consultando tu progreso…':'Reiniciando tu progreso…';
      try{
        if(!resetConfirmed){await context.reset(requestId);resetConfirmed=true;}
        if(!context.isCurrent())return;
        await context.refresh();
        if(context.isCurrent())context.done(form);
      }catch(error){
        if(!context.isCurrent())return;
        status.textContent=resetConfirmed?'Tu reinicio se ha guardado. Pulsa para volver a consultar tu cuenta.':error.message||'Vuelve a intentarlo.';
        if(resetConfirmed)submit.textContent='Volver a consultar mi cuenta';
      }finally{
        pending=false;word.readOnly=resetConfirmed;submit.disabled=!ready();
      }
    });
  }
  window.ProgressReset=Object.freeze({open,resetLocalSessions});
})();
