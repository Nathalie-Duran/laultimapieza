(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const button=(op,label)=>'<button type="button" data-coop-op="'+op+'">'+esc(label)+'</button>';

  class EstacionCompartida extends HTMLElement {
    connectedCallback(){
      if(!this.options)return;
      this.paint();
      this.tick();
    }
    disconnectedCallback(){clearTimeout(this.timer);}
    get coop(){return this.options.room.coop;}
    get state(){return this.coop?.stations?.[this.options.id];}
    get mine(){return this.state?.joined===true&&this.state.round!==this.soloRound;}
    configure(options){
      this.options=options;this.serial=0;this.note='';
      this.addEventListener('click',event=>{
        const control=event.target.closest('button[data-coop-op]');if(!control||this.busy)return;
        const op=control.dataset.coopOp,answer=this.querySelector('input:checked')?.value;
        if(op==='solo'){this.soloRound=this.state.round;this.paint();return;}
        if(op==='prepare'&&!answer){this.message('Elige una respuesta para compartir tu observación.');return;}
        this.act(op,op==='prepare'?{answer}:{}).catch(error=>this.message(error.message));
      });
    }
    paint(){
      const {id}=this.options,coop=this.coop,state=this.state;
      const previous=this.querySelector('details');
      const open=previous?.open||this.mine||!!state?.partnerJoined;
      const choice=this.querySelector('input:checked')?.value;
      const focused=this.contains(document.activeElement)?document.activeElement:null;
      const focusOp=focused?.dataset?.coopOp,focusChoice=focused?.value;
      const phase=state?.phase;
      let body='';
      if(!coop){
        const room=this.options.room,caseId=room.room?.caseId||1;
        const route='/#'+(caseId===1?'valdemar-jugar':'mundos-jugar')+'?id='+caseId+'&amp;retomar=1';
        body='<p>Vinculad vuestras cuentas en <a href="/#perfil?seccion=pareja">Mi cuenta · Pareja</a>. Después, entrad los dos en el <a href="'+route+'">primer juego de esta temporada</a> y elegid «En pareja». Volved a abrir esta estación para investigar juntos.</p>';
      }else if(!this.mine&&phase!=='solved'){
        body='<p>'+(state?.partnerJoined?esc(coop.partnerName)+' te espera en esta estación.':'Podéis investigar desde dos cuentas. Cada persona recibirá una pista distinta.')+'</p>'+button('join',state?.partnerJoined?'Aceptar y jugar con '+coop.partnerName:'Jugar con '+coop.partnerName);
      }else if(phase==='solved'){
        body='<p>'+(this.mine?'Habéis resuelto la estación. Podéis repetirla con otras pistas.':'Estás jugando en solitario. Podéis abrir otra variante en pareja cuando queráis.')+'</p>'+button('replay','Probar otra variante en pareja')+(this.mine?button('solo','Continuar en solitario'):'');
      }else if(phase==='waiting'){
        body='<p>Esperando a '+esc(coop.partnerName)+'. Pídele que abra esta misma estación y acepte jugar contigo.</p>';
      }else if(phase==='prepare'){
        const card=state.card;
        if(card){
          body='<h4>Tu material · Papel '+esc(coop.role)+'</h4><ul>'+card.material.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>';
          if(!state.prepared){
            body+='<fieldset><legend>'+esc(card.prompt)+'</legend>'+card.options.map(o=>'<label><input type="radio" name="coop-'+esc(id)+'" value="'+esc(o.id)+'"'+(o.id===choice?' checked':'')+'> '+esc(o.label)+'</label>').join('')+'</fieldset>'+button('prepare','Confirmar mi observación');
          }
        }
        if(state.prepared)body+='<p>Tu observación está confirmada. Esperando la de '+esc(coop.partnerName)+'.</p>';
        else body+='<p>Contad al otro qué veis. Cada persona confirma la observación desde su cuenta.</p>';
      }else if(phase==='play'){
        body='<p>Habéis confirmado las dos observaciones. Ya podéis usar las piezas de la estación y comprobar juntos la solución.</p>';
      }
      if(this.mine&&phase!=='solved')body+=button('leave','Continuar en solitario');
      this.innerHTML='<details class="estacion-pareja"'+(open?' open':'')+'><summary>Jugar en pareja</summary><div>'+body+'<p data-coop-status role="status" aria-live="polite">'+esc(this.note)+'</p></div></details>';
      if(focused){
        const controls=[...this.querySelectorAll('button,input,summary')];
        (controls.find(c=>focusOp?c.dataset.coopOp===focusOp:focusChoice?c.value===focusChoice:c.tagName==='SUMMARY')||controls[0])?.focus({preventScroll:true});
      }
    }
    message(text){
      this.note=text;
      const line=this.querySelector('[data-coop-status]');if(line)line.textContent=text;
    }
    adopt(coop,remote=false){
      const before=this.state,previous=this.coop;
      this.options.room.coop=coop;
      if(JSON.stringify(previous)===JSON.stringify(coop))return;
      const next=this.state;
      this.paint();
      if(remote&&next?.phase==='solved'&&before?.phase!=='solved')this.options.onSolved?.();
      if(before?.phase==='solved'&&next&&next.phase!=='solved')this.options.onReplay?.();
    }
    async refresh(){
      const sequence=this.serial;
      const data=await window.GameAccountBridge.request(this.options.endpoint);
      if(this.isConnected&&sequence===this.serial&&!this.busy)this.adopt(data.coop??null,true);
    }
    tick(){
      clearTimeout(this.timer);
      this.timer=setTimeout(async()=>{
        if(!this.isConnected)return;
        try{if(!document.hidden&&!this.busy&&(this.mine||this.querySelector('details')?.open))await this.refresh();}catch{/* The next poll can recover the shared state. */}
        if(this.isConnected)this.tick();
      },4500);
    }
    async act(op,extra={},attempt){
      if(this.busy)throw Error('Espera a que se confirme la acción anterior.');
      const coop=this.coop,state=this.state;
      if(!coop)throw Error('Vuelve a consultar el vínculo de pareja.');
      this.busy=true;this.serial++;
      const payload={id:this.options.id,coop:{op,partnerId:coop.partnerId,...(state?{round:state.round}:{}),...extra}};
      if(attempt!==undefined)payload.attempt=attempt;
      try{
        const result=await window.GameAccountBridge.request(this.options.endpoint,payload,'POST');
        this.note=result.correct===false?'La observación no encaja. Compara de nuevo las dos pistas.':'';
        if(this.isConnected){this.adopt(result.coop??null);this.message(this.note);}
        return result;
      }catch(error){
        if(error.status===409&&this.isConnected){
          const data=await window.GameAccountBridge.request(this.options.endpoint);
          if(this.isConnected)this.adopt(data.coop??null);
        }
        throw error;
      }finally{this.busy=false;}
    }
    solve(attempt){
      if(!this.mine)return window.GameAccountBridge.request(this.options.endpoint,{id:this.options.id,attempt},'POST');
      if(this.state.phase!=='play')throw Error(this.state.phase==='solved'?'Esta estación ya está resuelta. Puedes abrir otra variante en «Jugar en pareja».':'Para comprobar la solución en pareja, ambos debéis confirmar vuestra observación.');
      return this.act('solve',{},attempt);
    }
  }
  customElements.define('estacion-compartida',EstacionCompartida);
  window.EstacionCompartida={
    mount(slot,options){
      let control=options.room.coopControl;
      if(!control||control.options.id!==options.id){
        control=document.createElement('estacion-compartida');control.configure(options);options.room.coopControl=control;
      }
      slot.append(control);return control;
    }
  };
})();
