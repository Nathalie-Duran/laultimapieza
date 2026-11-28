(() => {
  'use strict';
  const bridge=()=>window.GameAccountBridge;
  const query=()=>new URLSearchParams(location.hash.split('?')[1]);
  const validId=id=>typeof id==='string' && /^[a-z][a-z0-9-]{1,62}$/.test(id);
  const pathFor=id=>'/api/aventuras/'+encodeURIComponent(id);
  const seasonOf=id=>window.Colecciones.seasons[Math.floor((id-1)/12)];
  function node(tag,text,cls){
    const el=document.createElement(tag);
    if(text!=null)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  }
  function link(label,href){
    const el=node('a',label,'button');el.href=href;return el;
  }
  function button(label,run,cls='button'){
    const el=node('button',label,cls);el.type='button';el.addEventListener('click',run);return el;
  }
  function photo(file,fallback){
    const img=node('img');
    img.alt='';
    img.src=typeof file==='string' && /^\/?[a-z\d][a-z\d_.-]*\.(webp|png|jpe?g)$/i.test(file)?'/'+file.replace(/^\//,''):fallback;
    if(img.src.endsWith(fallback)===false)img.addEventListener('error',()=>{img.src=fallback;},{once:true});
    return img;
  }
  const cover=id=>id>=13?'/mundo-'+id+'.webp':'/valdemar-art-'+String(id).padStart(2,'0')+'.webp';
  function disclosure(label,children){
    const el=node('details');el.append(node('summary',label),...children);return el;
  }
  function showPanel(item,open=false){
    if(open)item.open=true;
    const target=open?item.querySelector('summary'):item;
    target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'center'});
  }
  function gameLink(a,continueGame){
    const url='/#aventura?juego='+encodeURIComponent(a.id)+'&caso='+a.caseId+(continueGame?'&modo='+(a.modo==='duo'?'duo':'solo'):'');
    const card=link('',url);card.className='ap-card';
    card.append(photo(null,cover(a.caseId)),node('strong',a.titulo),node('span',a.completada?'Revisar desenlace':a.empezada?'Continuar partida':'Abrir aventura'));
    return card;
  }
  class AdventureList extends HTMLElement {
    async connectedCallback(){
      if(!bridge()?.isSignedIn())return;
      const owner=bridge().playerId(),req=this.requestId=(this.requestId||0)+1;
      try{
        const {aventuras}=await bridge().request('/api/aventuras');
        if(!this.isConnected||this.requestId!==req||owner!==bridge().playerId())return;
        const started=this.hasAttribute('en-curso');
        const list=aventuras.filter(a=>validId(a.id)&&(started?a.empezada:seasonOf(a.caseId)?.board===window.Colecciones.catalogBoard().board));
        if(!list.length)return;
        const section=node('section',null,'ap-list'),cards=node('div',null,'ap-grid');
        section.append(node('h2',started?'Tus aventuras de autor':'Aventuras de autor de esta temporada'),cards);
        for(const a of list)cards.append(gameLink(a,a.empezada));
        this.replaceChildren(section);
      }catch(error){
        if(!this.isConnected||this.requestId!==req||owner!==bridge().playerId()||error.name==='AbortError')return;
        this.replaceChildren(button('Volver a cargar las aventuras de autor',()=>this.connectedCallback()));
      }
    }
  }
  class PublishedAdventure extends HTMLElement {
    connectedCallback(){
      this.generation=(this.generation||0)+1;this.slug=query().get('juego');this.owner=bridge()?.playerId();
      if(!validId(this.slug)){this.replaceChildren(node('h1','Aventura no disponible'),link('Explorar los juegos','/#casos'));return;}
      if(!bridge()?.isSignedIn()){
        const section=node('section',null,'account-card');
        section.append(node('h1','Abre tu aventura'),node('p','Entra con la cuenta que tiene acceso a esta temporada.'));
        if(window.AccountUI?.signInPanel){const entry=node('div');entry.innerHTML=window.AccountUI.signInPanel();section.append(entry);}
        section.append(link('Ver la suscripción','/#planes'));this.replaceChildren(section);return;
      }
      const mode=query().get('modo');
      if(['solo','duo'].includes(mode))this.open(mode);else this.choose();
    }
    disconnectedCallback(){this.generation++;clearInterval(this.poll);this.mesa?.destroy();}
    current(gen){return this.isConnected&&gen===this.generation&&this.owner===bridge()?.playerId();}
    choose(message=''){
      clearInterval(this.poll);this.generation++;this.busy=false;this.mesa?.destroy();this.state=null;
      const section=node('section',null,'ap-entry account-card');
      section.append(node('h1','¿Cómo vas a investigar?'),node('p','A solas puedes consultar las dos perspectivas. En pareja, cada persona abre su expediente desde su cuenta.'));
      if(message)section.append(node('p',message,'ap-feedback'));
      const actions=node('div',null,'ap-options');
      actions.append(button('Jugar a solas',()=>this.open('solo'),'button primary'),button('Jugar en pareja',()=>this.open('duo')),link('Volver a Juegos','/#casos'));
      const id=Number(query().get('caso'));
      if(message&&Number.isInteger(id)&&id>=1&&id<=48)actions.append(link('Abrir el juego para vincular a mi compañero','/#'+(id<=12?'valdemar-jugar':'mundos-jugar')+'?id='+id));
      section.append(actions);this.replaceChildren(section);
    }
    async open(mode,role){
      const gen=++this.generation;this.busy=true;clearInterval(this.poll);
      if(!this.state){const loading=node('p','Abriendo tu expediente…');loading.setAttribute('role','status');this.replaceChildren(loading);}
      try{
        const data=await bridge().request(pathFor(this.slug)+'?modo='+mode+(role?'&papel='+role:''));
        if(!this.current(gen))return;
        this.state=data;this.draw();this.busy=false;
        if(mode==='duo'&&!data.completada)this.poll=setInterval(()=>this.refreshPair(),5000);
      }catch(error){if(this.current(gen))this.choose(error.message);}
    }
    async refreshPair(){
      if(document.hidden||this.busy||!this.state||this.state.completada)return;
      const gen=this.generation;this.busy=true;
      try{
        const data=await bridge().request(pathFor(this.slug)+'?modo=duo');
        if(!this.current(gen))return;
        if(data.paso!==this.state.paso||data.pareja!==this.state.pareja){
          this.state=data;this.draw('Tu compañero ha actualizado la partida.',true);
        }
      }catch(error){if(this.current(gen)&&[401,403,404,409].includes(error.status))this.choose(error.message);}
      finally{if(this.current(gen))this.busy=false;}
    }
    async play(action,answer){
      if(this.sending||!this.state)return;
      // A submitted move takes priority over a pending background read.
      const gen=++this.generation,state=this.state;this.busy=this.sending=true;
      this.feedback.textContent='Comprobando la acción…';
      try{
        const data=await bridge().request(pathFor(this.slug),{modo:state.modo,revision:state.revision,pareja:state.pareja,paso:state.paso,
          escena:state.vista.escena.id,accion:action.id,papel:state.papel,intento:answer});
        if(!this.current(gen))return;
        if(!data.ok){this.feedback.textContent=data.mensaje||'Revisa los materiales e inténtalo de nuevo.';this.feedback.focus();return;}
        this.state=data;this.draw(data.mensaje||'Acción guardada.',true);
      }catch(error){
        if(!this.current(gen))return;
        if(error.status===409)await this.open(state.modo,state.modo==='solo'?state.papel:null);
        if(this.isConnected&&this.feedback){this.feedback.textContent=error.message;this.feedback.focus();}
      }finally{this.sending=false;if(this.current(gen))this.busy=false;}
    }
    draw(message='',focus=false){
      this.mesa?.destroy();
      const s=this.state,v=s.vista,scene=v.escena,section=node('article',null,'ap-player'),header=node('header',null,'ap-hero');
      const picture=node('div',null,'ap-picture');picture.append(photo(scene.imagen,cover(s.caseId)));header.append(picture);
      const intro=node('div');intro.append(node('p',seasonOf(s.caseId)?.name,'eyebrow'),node('h1',s.titulo),node('p',s.modo==='solo'?'A solas · Expediente '+s.papel:'En pareja · Tu expediente '+s.papel));
      header.append(intro);section.append(header);
      const desk=node('div'),body=node('section',null,'ap-scene'),title=node('h2',scene.titulo),tasks=node('div',null,'ap-tasks');
      this.feedback=node('p',message,'ap-feedback');this.feedback.tabIndex=-1;this.feedback.setAttribute('role','status');
      title.tabIndex=-1;body.append(title,node('p',scene.texto),this.feedback);
      if(scene.mundo)title.before?.(node('small',scene.mundo,'eyebrow'));
      if(typeof scene.audio==='string'&&/^\/?[a-z\d][\w.-]*\.(mp3|ogg|wav|m4a)$/i.test(scene.audio)){
        const player=node('audio');player.controls=true;player.preload='none';player.src='/'+scene.audio.replace(/^\//,'');player.setAttribute('aria-label','Audio de '+scene.titulo);body.append(player);
        if(scene.transcripcion){const text=disclosure('Leer la transcripción',[node('p',scene.transcripcion)]);text.setAttribute('data-game-transcript','');body.append(text);}
      }
      const panels=[],evidencePanels=[];
      for(const action of s.completada?[]:v.acciones){
        const form=node('form',null,'ap-task');form.append(node('h3',action.titulo));
        if(action.instrucciones)form.append(node('p',action.instrucciones));
        for(const material of action.materiales||[]){
          const evidence=node('div',null,'ap-evidence');
          if(window.MotorAventuras?.montarMaterial)window.MotorAventuras.montarMaterial(evidence,material);
          else evidence.append(node('strong',material.titulo),node('p',material.texto));
          form.append(evidence);evidencePanels.push(evidence);
        }
        const answer=window.ControlesPrueba.montar(form,action);
        const send=node('button',action.tipo==='prueba'?'Comprobar respuesta':action.titulo,'button primary');
        send.type='submit';form.append(send);form.addEventListener('submit',e=>{e.preventDefault();this.play(action,answer?.()??null);});
        if(action.zona&&[action.zona.x,action.zona.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)){
          const marker=button(String(panels.length+1),()=>{form.scrollIntoView({block:'center'});form.querySelector('input,select,button')?.focus({preventScroll:true});},'ap-marker');
          marker.setAttribute('aria-label','Examinar '+action.titulo);marker.style.left=action.zona.x+'%';marker.style.top=action.zona.y+'%';picture.append(marker);
        }
        tasks.append(form);panels.push(form);
      }
      const shelf=node('div',null,'ap-shelf');
      const inventory=disclosure('Inventario ('+v.inventario.length+')',v.inventario.length?v.inventario.map(item=>{
        const p=node('div',null,'ap-evidence');if(item.imagen)p.append(photo(item.imagen,cover(s.caseId)));p.append(node('strong',item.nombre),node('p',item.descripcion));return p;
      }):[node('p','Aquí aparecerán los objetos que recojas con este expediente.')]);
      const notes=disclosure('Cuaderno ('+v.cuaderno.length+')',v.cuaderno.length?v.cuaderno.map(t=>node('p',t)):[node('p','Aquí se guardarán tus descubrimientos.')]);
      const hints=node('section',null,'ap-evidence');hints.hidden=true;
      const orientacion=s.completada?'Revisa el cuaderno para reconstruir cómo llegaste al desenlace.':
        evidencePanels.length?'Lee primero los materiales de la acción. Busca qué dato aporta cada uno antes de comprobar tu respuesta.':
        v.acciones.some(a=>a.tipo==='transferir')?'Comprueba qué objeto puedes enviar y qué necesita el otro expediente.':
        v.acciones.some(a=>a.tipo==='combinar')?'Abre el inventario de este expediente y comprueba qué piezas podrían encajar.':
        !panels.length?(s.modo==='solo'?'Consulta el otro expediente para encontrar la acción pendiente.':'Compara con tu compañero lo que ve en su expediente.'):
        'Examina los puntos del escenario y consulta los objetos de tu expediente.';
      hints.append(node('h3','Pistas'),node('p',orientacion),node('small','Esta orientación es gratuita.'));
      shelf.append(inventory,notes);
      if(s.modo==='solo'&&!s.completada)shelf.append(button('Consultar el expediente '+(s.papel==='A'?'B':'A'),()=>this.open('solo',s.papel==='A'?'B':'A')));
      if(!s.completada&&!panels.length)tasks.append(node('p',s.modo==='duo'?'Ahora le toca actuar a tu compañero. Verás aquí su avance.':'Consulta el otro expediente para seguir investigando.'));
      if(s.completada)tasks.append(node('h3','Aventura completada'),link('Ver mis partidas','/#archivo'));
      section.append(desk,body,shelf,hints,tasks,link('Salir a Mis partidas','/#archivo'));this.replaceChildren(section);
      this.mesa=window.MesaDeJuego.mount(desk,{title:s.titulo,family:'temporada',objective:s.completada?'Revisa tu desenlace y los descubrimientos del cuaderno.':v.acciones[0]?.titulo||(s.modo==='solo'?'Consulta el otro expediente.':'Comenta tus hallazgos con tu compañero.'),
        progress:s.completada?'Desenlace':scene.titulo,saved:s.paso?'Progreso guardado en tu cuenta.':'La primera acción guardará tu partida.',
        tools:[{id:'scene',label:'Escenario',run:()=>showPanel(title)},
          {id:'bag',label:'Inventario',run:()=>showPanel(inventory,true)},
          {id:'evidence',label:'Evidencias',run:()=>evidencePanels.length?showPanel(evidencePanels[0]):showPanel(notes,true)},
          {id:'hints',label:'Pistas',run:()=>{hints.hidden=false;showPanel(hints);}}],
        tutorial:s.paso?'':'Lee la escena y examina los materiales. Utiliza el inventario y el cuaderno para contrastar lo que descubres.',
        next:panels.length?{label:'Ir a la acción',run:()=>{panels[0].scrollIntoView({block:'center'});panels[0].querySelector('input,select,button')?.focus({preventScroll:true});}}:null});
      document.title=s.titulo+' · La Última Pieza';if(focus)(message?this.feedback:title).focus();
    }
  }
  customElements.define('aventura-publicada',PublishedAdventure);
  customElements.define('aventuras-publicadas',AdventureList);
})();
