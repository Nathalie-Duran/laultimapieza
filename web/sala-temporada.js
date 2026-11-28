(() => {
  'use strict';
  const rooms = {expedicion:2, umbravia:3, necropolis:4};
  const seasons = {2:'La ruta prohibida', 3:'El tercer jugador', 4:'La ira de Ra'};
  const compass = {N:'Norte', E:'Este', S:'Sur', O:'Oeste'};
  const instructions = {
    select:'Toca una pieza para marcarla. Tócala de nuevo para quitar la marca.',
    order:'Lee las piezas y elige cuál ocupa cada posición de la secuencia.',
    place:'Examina las piezas y coloca cada una en el soporte que le corresponde.',
    align:'Elige una orientación en cada dial. Puedes cambiarla antes de comprobarla.'
  };
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keys=n=>n+(n===1?' llave':' llaves');
  const photo=(src,cls)=>'<img class="'+cls+'" src="'+esc(src)+'" alt="" width="768" height="512" decoding="async">';
  function normalise(game,values){
    if(!Array.isArray(values))values=[];
    const pieces=new Set(game.pieces.map(piece=>piece.id));
    if(game.kind==='select')return [...new Set(values.filter(id=>pieces.has(id)))].slice(0,game.slots.length);
    const used=new Set();
    return game.slots.map((_,i)=>{
      const value=values[i];
      if(game.kind==='align')return Object.hasOwn(compass,value)?value:'';
      if(!pieces.has(value)||used.has(value))return '';
      used.add(value);return value;
    });
  }
  function artifact(piece){
    return '<span class="sala-marca" aria-hidden="true">'+esc(piece.mark)+'</span><strong>'+esc(piece.label)+'</strong><span class="sala-lectura">'+esc(piece.note)+'</span>';
  }
  function workbench(game,values){
    if(game.kind==='select'){
      return '<div class="sala-piezas" role="group" aria-label="Piezas para marcar">'+game.pieces.map(piece=>
        '<button type="button" class="sala-pieza" data-room-piece="'+esc(piece.id)+'" aria-pressed="'+values.includes(piece.id)+'">'+artifact(piece)+'</button>'
      ).join('')+'</div>';
    }
    if(game.kind==='align'){
      return '<div class="sala-diales">'+game.slots.map((slot,i)=>{
        const piece=game.pieces[i];
        return '<fieldset class="sala-dial"><legend>'+esc(slot.label)+'</legend><div class="sala-dial-pieza">'+artifact(piece)+'</div><div class="sala-rosa" data-bearing="'+esc(values[i])+'"><span class="sala-aguja" aria-hidden="true">↑</span>'+
          Object.entries(compass).map(([dir,name])=>'<button type="button" data-room-dial="'+i+'" data-direction="'+dir+'" aria-label="'+name+'" aria-pressed="'+(values[i]===dir)+'">'+dir+'</button>').join('')+'</div></fieldset>';
      }).join('')+'</div>';
    }
    const pieces='<ul class="sala-piezas" aria-label="Piezas disponibles">'+game.pieces.map(piece=>'<li class="sala-pieza">'+artifact(piece)+'</li>').join('')+'</ul>';
    const slots=game.slots.map((slot,i)=>'<label class="sala-casilla"><span>'+esc(slot.label)+'</span><select data-room-slot="'+i+'"><option value="">Elige una pieza</option>'+
      game.pieces.map(piece=>'<option value="'+esc(piece.id)+'"'+(values[i]===piece.id?' selected':'')+'>'+esc(piece.label)+'</option>').join('')+'</select></label>').join('');
    return pieces+'<div class="sala-soportes">'+slots+'</div>';
  }
  class SalaTemporada extends HTMLElement {
    connectedCallback(){
      this.number=rooms[this.getAttribute('mundo')];this.room=window.SalasMundosCatalogo?.[this.number];
      if(!this.room){this.textContent='Esta sala no está disponible.';return;}
      this.drafts=new Map();this.won=new Set();this.pending=new Set();this.current=null;this.player=null;
      this.clickHandler=event=>this.handleClick(event);
      this.changeHandler=event=>{if(event.target.matches('select[data-room-slot]'))this.assign(Number(event.target.dataset.roomSlot),event.target.value);};
      this.addEventListener('click',this.clickHandler);this.addEventListener('change',this.changeHandler);
      this.load();
    }
    disconnectedCallback(){
      this.generation=(this.generation||0)+1;
      this.mesa?.destroy();this.mesa=null;
      this.removeEventListener('click',this.clickHandler);this.removeEventListener('change',this.changeHandler);
    }
    get endpoint(){return '/api/valdemar/salas/'+this.number;}
    get game(){return this.room.games.find(game=>game.id===this.current);}
    async load(){
      const generation=this.generation=(this.generation||0)+1;
      this.signed=window.GameAccountBridge?.isSignedIn()===true;
      this.allowed=false;this.accessError=false;this.current=null;
      if(!this.signed){this.lobby();return;}
      this.innerHTML='<p role="status">Abriendo las estaciones…</p>';
      try{
        const result=await window.GameAccountBridge.request(this.endpoint);
        if(this.generation!==generation)return;
        const games=new Map(result.games.map(game=>[game.id,game]));
        if(!this.room.games.every(game=>games.has(game.id)))throw Error('Catálogo incompleto');
        this.allowed=true;this.player=window.GameAccountBridge.playerId?.();
        this.won=new Set(result.games.filter(game=>game.solved).map(game=>game.id));
      }catch(error){
        if(this.generation!==generation)return;
        this.accessError=![401,402,403].includes(error.status);
        if(error.status===401)this.signed=false;
      }
      this.lobby();
    }
    draftKey(game){return this.player?'lup.sala.v1.'+encodeURIComponent(this.player)+'.'+this.number+'.'+game.id:null;}
    draft(game){
      if(this.drafts.has(game.id))return this.drafts.get(game.id);
      let stored;const key=this.draftKey(game);
      try{if(key)stored=JSON.parse(sessionStorage.getItem(key));}catch{}
      const values=normalise(game,stored);
      this.drafts.set(game.id,values);return values;
    }
    save(game,clear=false){
      const key=this.draftKey(game);if(!key)return;
      try{if(clear)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(this.draft(game)));}catch{}
    }
    lobby(focusId){
      if(this.finished){this.drafts.delete(this.finished);this.finished=null;}
      this.mesa?.destroy();this.mesa=null;this.current=null;
      const {room}=this,total=room.games.reduce((n,g)=>n+g.prize,0),earned=room.games.reduce((n,g)=>n+(this.won.has(g.id)?g.prize:0),0);
      const tiles=room.games.map(game=>{
        const resumed=this.allowed&&this.draft(game).some(Boolean);
        const status=this.won.has(game.id)?'Resuelta · premio recibido':resumed?'En curso · '+keys(game.prize):keys(game.prize)+' al resolver';
        return '<button class="ma87-station" type="button" data-room-station="'+esc(game.id)+'" aria-haspopup="dialog">'+photo(game.photo,'sala-estacion-foto')+'<span><small>'+esc(game.mechanic)+'</small><strong>'+esc(game.title)+'</strong><small>'+esc(status)+'</small></span></button>';
      }).join('');
      const progress=this.allowed?'<div class="ma87-progress"><strong>'+this.won.size+' de '+room.games.length+' estaciones resueltas</strong><progress aria-label="Estaciones resueltas" value="'+this.won.size+'" max="'+room.games.length+'"></progress><span>'+keys(earned)+' de '+total+'</span><a class="sala-al-juego" href="/#mundos-jugar?id='+room.caseId+'&amp;retomar=1">Ir al primer juego de la temporada</a></div>':'';
      const trouble=this.accessError?'<div class="sala-aviso" role="status">No se ha podido consultar tu acceso. <button type="button" data-room-retry>Volver a comprobar</button></div>':'';
      this.innerHTML='<section class="ma87-lobby"><header class="ma87-hero">'+photo(room.photo,'ma87-scene')+'<div class="ma87-intro"><p>'+esc(seasons[this.number])+'</p><h1>'+esc(room.title)+'</h1><p>'+esc(room.intro||room.description||'Seis estaciones independientes para investigar con los objetos de esta sala.')+'</p></div></header><div data-ma-mesa></div>'+progress+trouble+
        '<section class="ma87-section"><h2 tabindex="-1" data-room-list>Las seis estaciones</h2><p>Consigue hasta '+keys(total)+' para pedir pistas en tus juegos. Cada mesa entrega su premio la primera vez que la resuelves.</p><div class="ma87-stations">'+tiles+'</div></section></section>';
      this.mesa=window.MesaDeJuego.mount(this.querySelector('[data-ma-mesa]'),{
        family:'sala',title:room.title,next:{label:'Explorar las estaciones',run:()=>this.querySelector('[data-room-list]')?.focus()},
        help:{context:'sala',text:'Puedes jugar en '+room.title+' con acceso al primer juego de '+seasons[this.number]+'.',
          steps:['Elige «'+room.games[0].title+'» o cualquier otra estación y abre su ficha para ver la prueba.',
            'Examina el material, prepara tu respuesta y pulsa «Comprobar mi solución».',
            'Vuelve a las estaciones para probar otra mesa o continuar un intento en esta pestaña.']}
      });
      if(focusId)this.stationButton(focusId)?.focus();
    }
    stationButton(id){return [...this.querySelectorAll('[data-room-station]')].find(b=>b.dataset.roomStation===id);}
    detail(id){
      const game=this.room.games.find(g=>g.id===id);if(!game||this.querySelector('dialog[open]'))return;
      const dialog=document.createElement('dialog');dialog.className='ma87-detail';dialog.setAttribute('aria-label',game.title);
      const solved=this.won.has(id),resumed=this.allowed&&this.draft(game).some(Boolean);
      const offer=window.ClubAccess?.offerAction||{href:'/#planes',label:'Ver la suscripción'};
      const access=this.allowed?'':this.accessError?'<p>No se ha podido consultar tu acceso.</p>':'<p class="ma87-access">Esta sala se abre con el primer juego de '+esc(seasons[this.number])+'.</p>';
      const action=this.allowed?'<button class="ma87-primary" type="button" data-room-play="'+esc(id)+'">'+(solved?'Volver a jugar':resumed?'Continuar estación':'Jugar a esta estación')+'</button>':this.accessError?'<button type="button" data-room-retry>Volver a comprobar</button>':
        '<a class="ma87-primary" href="'+esc(offer.href)+'">'+esc(offer.label)+'</a>'+(this.signed?'':'<button type="button" data-room-login data-action="auth-login">Entrar con mi cuenta</button>');
      dialog.innerHTML=photo(game.photo,'sala-estacion-foto')+'<div class="ma87-detail-copy"><small>'+esc(game.mechanic)+'</small><h2 tabindex="-1">'+esc(game.title)+'</h2><p>'+esc(game.description)+'</p><p>'+(solved?'Estación resuelta · recompensa recibida.':'Primera resolución · '+keys(game.prize)+'.')+'</p>'+access+'<div class="ma87-actions">'+action+'<button type="button" data-room-close>Volver a la sala</button></div></div>';
      dialog.addEventListener('close',()=>{dialog.remove();if(!this.current&&dialog.dataset.restore!=='no')this.stationButton(id)?.focus();},{once:true});
      dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
      this.append(dialog);dialog.showModal();dialog.querySelector('h2').focus();
    }
    play(id){
      if(!this.allowed)return;
      this.mesa?.destroy();this.mesa=null;
      this.current=id;const game=this.game;if(!game){this.lobby();return;}
      this.querySelector('dialog[open]')?.close();
      const values=this.draft(game),evidence=game.evidence.map(proof=>'<div><dt>'+esc(proof.label)+'</dt><dd>'+esc(proof.text)+'</dd></div>').join('');
      this.innerHTML='<section class="ma-panel ma87-panel sala-estacion"><header class="reto-cabecera">'+photo(game.photo,'reto-foto')+'<div class="reto-cabecera-copy"><p class="reto-procedencia">'+esc(this.room.title)+' · '+esc(game.mechanic)+'</p><h1 tabindex="-1">'+esc(game.title)+'</h1></div></header><div data-ma-mesa></div>'+
        '<section class="sala-material"><h2>Pruebas de la mesa</h2><dl>'+evidence+'</dl></section><section class="sala-operacion"><h2>'+esc(game.mechanic)+'</h2><p>'+esc(instructions[game.kind])+'</p>'+workbench(game,values)+'</section>'+
        '<div class="ma87-actions"><button type="button" class="ma-check" data-room-check>Comprobar mi solución</button><span data-room-count></span></div><p data-room-feedback role="status" aria-live="polite"></p></section>';
      this.mesa=window.MesaDeJuego.mount(this.querySelector('[data-ma-mesa]'),{family:'sala',title:game.title,progress:this.won.has(id)?'Premio del reto recibido':keys(game.prize)+' al resolver por primera vez',objective:game.prompt,help:{context:'sala',text:game.hint,steps:['Lee las pruebas de la mesa.',instructions[game.kind],'Cuando termines, comprueba tu solución.']},tools:[{id:'stations',label:'Volver a las estaciones',run:()=>this.lobby(id)}]});
      this.sync();this.querySelector('h1')?.focus();
    }
    sync(){
      const game=this.game;if(!game)return;
      const values=this.draft(game),busy=this.pending.has(game.id),finished=this.finished===game.id;
      for(const b of this.querySelectorAll('[data-room-piece]'))b.setAttribute('aria-pressed',String(values.includes(b.dataset.roomPiece)));
      for(const b of this.querySelectorAll('[data-room-dial]')){
        const value=values[Number(b.dataset.roomDial)];b.setAttribute('aria-pressed',String(value===b.dataset.direction));b.parentElement.dataset.bearing=value;
      }
      for(const select of this.querySelectorAll('[data-room-slot]'))select.value=values[Number(select.dataset.roomSlot)]||'';
      for(const control of this.querySelectorAll('[data-room-piece],[data-room-dial],[data-room-slot]'))control.disabled=busy||finished;
      const check=this.querySelector('[data-room-check]');check.disabled=busy;check.textContent=finished?'Jugar de nuevo':'Comprobar mi solución';
      const n=values.filter(Boolean).length;
      this.querySelector('[data-room-count]').textContent=n+' de '+game.slots.length+(game.kind==='align'?' diales orientados':game.kind==='select'?' piezas marcadas':' piezas colocadas');
    }
    notice(msg){const status=this.querySelector('[data-room-feedback]');if(status)status.textContent=msg;}
    assign(slot,id){
      const game=this.game;if(!game||this.pending.has(game.id))return;
      const values=this.draft(game),previous=values.indexOf(id),old=values[slot];
      if(id&&previous>=0&&previous!==slot)values[previous]=old;
      values[slot]=id;this.save(game);this.sync();this.notice('');
    }
    changePiece(button){
      const game=this.game;if(!game||this.pending.has(game.id))return;
      const values=this.draft(game);
      if(button.hasAttribute('data-room-dial'))values[Number(button.dataset.roomDial)]=button.dataset.direction;
      else{
        const id=button.dataset.roomPiece,i=values.indexOf(id);
        if(i>=0)values.splice(i,1);
        else if(values.length<game.slots.length)values.push(id);
        else{this.notice('Ya están marcadas todas las piezas necesarias. Quita una marca antes de añadir otra.');return;}
      }
      this.save(game);this.sync();this.notice('');
    }
    async check(){
      const game=this.game;if(!this.allowed||!game||this.pending.has(game.id))return;
      const values=this.draft(game);
      if(this.finished===game.id){this.finished=null;this.drafts.delete(game.id);this.play(game.id);return;}
      if(values.filter(Boolean).length!==game.slots.length){this.notice(game.kind==='select'?'Marca '+game.slots.length+' piezas antes de comprobar tu selección.':'Completa todas las posiciones antes de comprobar tu solución.');return;}
      const attempt=game.kind==='select'?[...values].sort():[...values],generation=this.generation;
      this.pending.add(game.id);this.sync();this.notice('Comprobando tu solución…');
      try{
        const result=await window.GameAccountBridge.request(this.endpoint,{id:game.id,attempt},'POST');
        if(this.generation!==generation)return;
        if(!result.correct){if(this.current===game.id)this.notice(game.feedback||'Revisa las pruebas de la mesa y vuelve a intentarlo.');return;}
        this.won.add(game.id);this.save(game,true);
        if(result.awarded>0)this.dispatchEvent(new CustomEvent('season-room-reward',{bubbles:true,detail:{awarded:result.awarded}}));
        if(this.current===game.id){
          this.finished=game.id;
          this.mesa.update({progress:'Premio del reto recibido'});
          this.notice((game.success?game.success+' ':'')+(result.awarded?'Has ganado '+keys(result.awarded)+'.':'Ya recibiste las llaves de esta estación.'));
        }else{
          this.drafts.delete(game.id);
          if(!this.current)this.lobby();
        }
      }catch(error){
        if(this.generation===generation&&this.current===game.id)this.notice(error.status===401?'Tu sesión ha terminado. Entra de nuevo para comprobar la estación.':error.status===403?'Tu cuenta necesita acceso a esta sala.':'No se ha podido comprobar la solución. Puedes intentarlo otra vez.');
      }finally{
        if(this.generation===generation){
          this.pending.delete(game.id);
          if(this.current===game.id){
            this.sync();
            if(document.activeElement===document.body)this.querySelector('[data-room-check]')?.focus({preventScroll:true});
          }
        }
      }
    }
    handleClick(event){
      const b=event.target.closest('button');if(!b||!this.contains(b))return;
      if(b.hasAttribute('data-room-station'))this.detail(b.dataset.roomStation);
      else if(b.hasAttribute('data-room-play'))this.play(b.dataset.roomPlay);
      else if(b.hasAttribute('data-room-close'))this.querySelector('dialog[open]')?.close();
      else if(b.hasAttribute('data-room-login')){const d=b.closest('dialog');d.dataset.restore='no';d.close();}
      else if(b.hasAttribute('data-room-retry'))this.load();
      else if(b.hasAttribute('data-room-piece')||b.hasAttribute('data-room-dial'))this.changePiece(b);
      else if(b.hasAttribute('data-room-check'))this.check();
    }
  }
  if(!customElements.get('sala-temporada'))customElements.define('sala-temporada',SalaTemporada);
})();
