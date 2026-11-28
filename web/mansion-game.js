(() => {
  'use strict';
  const rooms=['vestibulo','salon','patio','estudio','galeria','invernadero','tunel','laboratorio'];
  const chapters=['I','II','III','IV','V'];
  const labels={A:'Casa habitada',B:'Casa abandonada'};
  const storm={title:'Escuchar la tormenta',audio:'/mansion-storm.wav',text:'Lluvia y truenos en el exterior de la mansión. No contiene palabras.'};
  const coordinates=[
    [[32,54],[66,44],[48,31]],[[53,45],[25,48],[72,62]],[[48,54],[28,46],[72,51]],[[59,52],[30,55],[74,34]],
    [[49,46],[25,48],[69,54]],[[49,60],[25,54],[73,39]],[[53,56],[24,54],[73,39]],[[51,51],[25,56],[72,52]]
  ];
  const devices=[
    ['Examinar el arco'],['Hablar con Elías','Girar la fotografía'],
    ['Examinar la manivela','Mirar dentro del pozo'],['Ajustar el reloj'],['Abrir el cajón'],
    ['Comparar las placas'],['Girar los anillos'],['Examinar el riego'],['Ajustar los desvíos'],
    ['Preparar el señuelo'],['Sintonizar la radio'],['Examinar el receptor'],
    ['Examinar el banco óptico','Examinar el inductor'],['Examinar el acta'],['Accionar el panel']
  ];
  function el(tag,cls,text){
    const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;
  }
  function button(label,fn,cls='mansion-secondary'){
    const node=el('button',cls,label);node.type='button';node.addEventListener('click',fn);return node;
  }
  function roleAllowed(x,world){return !x?.role||x.role==='both'||x.role==='AB'||x.role===world;}
  function roomImage(id,world='A'){const index=rooms.indexOf(id);return index>=0?'/mansion-'+(world==='B'?'ruin':'room')+'-'+(index+1)+'.webp':null;}
  const evidencePrints=[
    ['cuaderno-bordado','cuaderno-bronce'], ['elias','cuaderno-reverso'],
    ['cuaderno-nudo','cuaderno-cajon'], ['instrument-reloj','instrument-reloj'],
    ['taller-elementos','cuaderno-tarjeta'], ['cuaderno-placa','cuaderno-placa'],
    ['taller-esferas','taller-esferas'], ['cuaderno-herbario','taller-riego'],
    ['taller-vias','taller-vias'], ['taller-presencia','taller-presencia'],
    ['instrument-radio','instrument-radio'], ['cuaderno-cilindro','taller-morse'],
    ['taller-intercambio','taller-intercambio'], ['cuaderno-libro','taller-acta'],
    ['taller-paneles','taller-paneles']
  ];
  const albumPrints={carta:'cuaderno-carta',nox:'nox',diario:'cuaderno-libro',jardin:'cuaderno-herbario',
    puerta:'estancias-plano',foto:'finale',rosa:'cuaderno-radio-laton',radio:'instrument-radio',final:'cuaderno-cilindro'};
  function evidencePhoto(item,placeId,world){
    const stageId=String(item.id||'').match(/^prueba-(\d+)-\d+$/);
    const print=stageId?evidencePrints[Number(stageId[1])-1]?.[(item.role||world)==='B'?1:0]:Object.hasOwn(albumPrints,item.id)?albumPrints[item.id]:null;
    return print?'/mansion-'+print+'.webp':roomImage(item.roomId||placeId,world)||'/mansion-cuaderno-libro.webp';
  }
  function presentationState(state){
    const stage=state?.stage;
    if(stage?.number!==1||stage.title!=='Los cuatro guardianes')return state;
    const abandoned=stage.contributions?.B;
    const brief=stage.brief?.replace('solo giran en la casa','se colocan en la casa');
    const objective=abandoned?.objective?.replace('Para girar los dos escudos','Para colocar los dos escudos');
    if(brief===stage.brief&&objective===abandoned?.objective)return state;
    return {...state,stage:{...stage,brief,contributions:abandoned?
      {...stage.contributions,B:{...abandoned,objective}}:stage.contributions}};
  }
  const photographedBenches=new Set(['elementos','esferas','riego','vias','presencia','morse','intercambio','acta','paneles']);
  function directPositions(puzzle,fields,draft){
    const kind=puzzle.dataset.kind;
    if(kind!=='esferas'&&kind!=='vias')return;
    const dials=Array.from(puzzle.querySelectorAll('.mansion-dial'));
    for(const dial of dials){
      const legend=dial.querySelector('legend');
      const field=fields.find(field=>field.label===legend?.textContent&&field.options?.length);
      if(!field)continue;
      const positions=el('div','mansion-index-positions');
      for(const option of field.options){
        const key=el('label','mansion-position');
        const input=el('input');input.type='radio';input.name='mansion-position-'+field.id;
        input.value=String(option.value);input.checked=String(draft[field.id]??'')===input.value;
        input.addEventListener('change',()=>{if(input.checked)draft[field.id]=input.value;});
        const mark=el('span','mansion-engraving');mark.dataset.mark=input.value;mark.setAttribute('aria-hidden','true');
        key.append(input,mark,el('span','mansion-position-name',option.label));positions.append(key);
      }
      dial.className='mansion-control mansion-index-selector';dial.replaceChildren(legend,positions);
    }
  }
  function dressWorkbench(puzzle,fields,draft){
    if(!photographedBenches.has(puzzle.dataset.kind))return puzzle;
    directPositions(puzzle,fields,draft);
    const surface=el('div','mansion-bench-surface');
    const desk=el('div','mansion-bench-console');
    let inventory=null;
    const contents=Array.from(puzzle.children);
    puzzle.replaceChildren();
    for(const child of contents){
      if(child.className==='mansion-puzzle-title'||child.className==='mansion-role-objective'){
        puzzle.append(child);
      }else if(child.className==='mansion-device-rack'){
        const pieces=child.querySelector('ul');
        if(pieces){
          inventory=el('details','mansion-bench-inventory');
          inventory.append(el('summary',null,'Material disponible ('+pieces.childElementCount+')'),pieces);
        }
      }else if(child.className==='mansion-pieces'){
        child.className+=' mansion-bench-handles';surface.append(child);
      }else desk.append(child);
    }
    surface.append(desk);puzzle.append(surface);
    if(inventory)puzzle.append(inventory);
    return puzzle;
  }
  function mount(host,options){
    let state=presentationState(options.state?.mansion||options.state),role=options.role||state?.role;
    const paired=role==='A'||role==='B';
    let world=paired?role:'A',tab='scene',disposed=false,busy=false,requestId=0,activeDevice=false,selectedEvidence=null;
    let openMission=null,missionSource=null,roomId=state?.explore?.id||state?.stage?.room||rooms[0],notice='',noticeError=false,saveText=options.resumed?'Partida recuperada':'';
    let explore=state?.explore?.id===roomId?state.explore:null;
    const perspectiveKey=options.playerId&&!paired?'lup.mansion.perspectiva.'+encodeURIComponent(options.playerId):null;
    if(perspectiveKey){
      try{const previous=JSON.parse(sessionStorage.getItem(perspectiveKey));if(previous?.stage===state?.current&&previous.world==='B')world='B';}catch{}
    }
    const drafts=new Map(),seen=new Map(),audioPlayers=new Set();
    let pendingHint=null;
    const root=el('section','mansion-game'), header=el('header','mansion-header'),tabs=el('div','mansion-tabs');
    const panel=el('div','mansion-panel'),message=el('p','mansion-status');
    message.setAttribute('role','status');message.tabIndex=-1;
    root.setAttribute('aria-label','El secreto de los dos mundos');tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Cuaderno de la mansión');panel.setAttribute('role','tabpanel');panel.id='mansion-content';
    const mesaHost=el('div','mansion-objective mj-mansion-host');
    const shared=window.MesaDeJuego?.mount(mesaHost,{family:'mansion',title:state?.title||'El secreto de los dos mundos'});
    const dock=el('aside','mj-objective-dock');dock.hidden=true;dock.setAttribute('aria-label','Objetivo de la aventura');
    if(options.blockEntry){tabs.classList.add('vd-block-tools');root.append(dock,tabs,header,panel);}
    else root.append(header,dock,tabs,panel);
    host.replaceChildren(root);shared?.dockObjective?.(dock);
    const arcade=el('details','mansion-arcade-drawer');
    const summary=el('summary','season-room-door','Sala de juegos de Ada · 6 minijuegos');
    const room=window.RetosTemporada?.puertaSala('mapa',true);
    if(room)summary.innerHTML=room;
    arcade.append(summary);
    if(options.arcadeHost)options.arcadeHost.replaceChildren(arcade);
    else root.append(arcade);
    const explorer=el('lup-explorador');explorer.setAttribute('case-id','1');
    arcade.addEventListener('toggle',()=>{
      if(arcade.open&&!arcade.querySelector('mansion-arcade')){
        const games=el('mansion-arcade');games.setAttribute('embedded','');arcade.append(games);
      }
    });
    let rewardRead=0;
    arcade.addEventListener('mansion-arcade-reward',async event=>{
      const credit=event.detail?.awarded;
      if(!Number.isInteger(credit)||credit<0||disposed)return;
      const read=++rewardRead,prior=state;
      if(credit>0&&Number.isInteger(state.balance)){
        state.balance+=credit;
        if(tab==='hints')draw();
        return;
      }
      if(!options.explore)return;
      try{
        // An arcade played in pairs signals completion without sending personal balances.
        const result=await options.explore(roomId),balance=result?.mansion?.balance;
        if(disposed||state!==prior||read!==rewardRead||!Number.isInteger(balance)||state.balance===balance)return;
        state.balance=balance;
        if(tab==='hints')draw();
      }catch{/* The next successful game request will reconcile the wallet. */}
    });
    const builtTabs=new Map();
    for(const [id,label] of [['scene','Escenario'],['bag','Inventario'],['evidence','Evidencias'],['hints','Pistas']]){
      const control=button(label,()=>switchTab(id),'mansion-tab');control.id='mansion-tab-'+id;
      control.setAttribute('role','tab');control.setAttribute('aria-controls',panel.id);
      control.addEventListener('keydown',event=>{
        const order=[...builtTabs.keys()],index=order.indexOf(id);
        let next;
        if(event.key==='ArrowRight')next=order[(index+1)%order.length];
        else if(event.key==='ArrowLeft')next=order[(index+order.length-1)%order.length];
        else if(event.key==='Home')next=order[0];else if(event.key==='End')next=order.at(-1);else return;
        event.preventDefault();switchTab(next);builtTabs.get(next).focus();
      });
      builtTabs.set(id,control);tabs.append(control);
    }
    function stopAudio(){
      for(const item of audioPlayers){item.pause?.();item.close?.().catch?.(()=>{});}
      audioPlayers.clear();
      if(speaking){window.speechSynthesis?.cancel();speaking=false;}
    }
    let speaking=false;
    function switchTab(id){stopAudio();say('');missionSource=null;pendingHint=null;tab=id;draw();}
    function say(text,error=false){notice=text||'';noticeError=error;message.textContent=notice;message.dataset.error=String(error);}
    function focusTarget(selector){const target=panel.querySelector(selector);if(target){target.focus({preventScroll:true});target.scrollIntoView?.({block:'nearest'});}}
    const noteKey=(item,perspective)=>[perspective,item.id||item.title+'|'+item.text].join('|');
    function observations(){return Array.isArray(state.notebook)?state.notebook:[...seen.values()];}
    function apply(incoming,keepRoom){
      const next=incoming?.mansion||incoming?.state||incoming;
      if(!next||!Array.isArray(next.rooms))return;
      if(Number.isFinite(state?.revision)&&Number.isFinite(next.revision)&&next.revision<state.revision)return;
      const advanced=next.current!==state?.current||Boolean(next.ending)!==Boolean(state?.ending);
      state=presentationState(next);
      if(advanced){roomId=state.stage?.room||roomId;activeDevice=false;selectedEvidence=null;openMission=null;missionSource=null;pendingHint=null;}
      else if(!keepRoom&&next.explore?.id)roomId=next.explore.id;
      if(next.explore?.id===roomId)explore=next.explore;
      else if(explore?.id!==roomId)explore=null;
    }
    async function act(input,after,afterDraw){
      if(busy||disposed)return;
      const id=++requestId;
      busy=true;root.setAttribute('aria-busy','true');say('');saveText='Guardando…';shared?.update({saved:saveText});
      try {
        const result=await options.act(input);
        if(disposed||id!==requestId)return;
        const previous=state.current;
        apply(result,true);
        const failed=result?.correct===false;
        saveText=failed?'Respuesta comprobada':'Progreso guardado';
        say(result?.message||result?.feedback||'',failed);
        if(!failed)after?.(result);
        draw();
        if(!failed&&afterDraw)afterDraw();
        else if(state.current!==previous)focusTarget('.mansion-room-title');
        else if(notice)message.focus({preventScroll:true});
      }catch(err){if(!disposed&&id===requestId){saveText='Última acción sin confirmar';shared?.update({saved:saveText});say(err?.message||'No se ha podido guardar. Puedes volver a intentarlo.',true);message.focus();}}
      finally{if(!disposed&&id===requestId){busy=false;root.removeAttribute('aria-busy');}}
    }
    async function travel(id){
      if(busy||disposed)return;
      if(!state.rooms.some(room=>room.id===id&&room.unlocked))return;
      stopAudio();
      await act({op:'inspect',roomId:id},result=>{
        const incoming=result?.mansion||result?.state||result;
        roomId=id;explore=incoming.explore||null;activeDevice=false;selectedEvidence=null;tab='scene';
      });
    }
    function drawHeader(){
      header.replaceChildren();root.dataset.world=world;root.dataset.tab=tab;
      root.dataset.device=String(tab==='scene'&&activeDevice&&state.stage?.room===roomId);
      const chapter=Math.max(1,Math.min(5,Number(state.stage?.chapter)||Math.ceil(Math.min(state.current||1,15)/3)));
      const completed=state.ending?15:Math.max(0,Math.min(15,(state.current||1)-1));
      const details=el('div','mansion-heading-group');
      details.append(el('p','mansion-eyebrow','Capítulo '+chapters[chapter-1]+(state.stage?.chapter?' · '+state.stage.chapter:'')));
      if(!options.blockEntry)details.append(el('h1','mansion-title',state.title||'El secreto de los dos mundos'));
      header.append(details);
      if(shared){
        const stage=state.stage;
        shared.update({progress:completed+'/15 pruebas resueltas'+(stage?.title?' · '+stage.title:''),saved:saveText,
          objective:stage?.brief||'Revisa la fotografía final y lee el desenlace que has guardado.',
          tutorial:stage&&tab==='scene'&&completed===0&&!activeDevice?'Examina los objetos de esta casa. Lo que descubras quedará en Evidencias. '+(paired?'Coméntalo con tu pareja y encajad los escudos desde las dos casas.':'Cambia de casa para comparar lo que has encontrado.'):'',help:{context:paired?'duo':'solo',
            text:({bag:'Aquí ves los objetos que has recogido en esta casa y las misiones opcionales disponibles.',evidence:'El cuaderno guarda las observaciones de tu casa y las grabaciones que ya has descubierto.',hints:'Elige hasta dónde quieres que te ayude Ada. Verás el coste en llaves antes de confirmar.'})[tab]||(paired?'Cada persona observa una realidad de la casa. Comparad lo que ocurre en la misma habitación.':'Puedes alternar entre la casa habitada y la abandonada para comparar la misma habitación.'),
            steps:tab==='scene'?['Pulsa el objeto señalado en la fotografía para abrir el mecanismo.','Examina los detalles de la sala y consulta tus anotaciones en Evidencias.','Usa el mapa para volver a las habitaciones abiertas.']:[]},
          next:stage&&tab==='scene'&&stage.room!==roomId?{label:'Ir al objetivo',run:()=>travel(stage.room)}:null});
      }else header.append(el('p','mansion-progress',completed+'/15 pruebas resueltas'));
      const worlds=el('div','mansion-worlds');worlds.setAttribute('aria-label','Realidad de la mansión');
      const names=options.names||state.names;
      if(paired){if(!names?.[world]&&(tab!=='scene'||activeDevice))worlds.append(el('span','mansion-world-name',labels[world]));}
      else for(const id of ['A','B']){
        const control=button(labels[id],()=>{
          if(world===id||busy)return;
          stopAudio();world=id;selectedEvidence=null;
          try{if(perspectiveKey)sessionStorage.setItem(perspectiveKey,JSON.stringify({stage:state.current,world}));}catch{}
          draw();
          header.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
        },'mansion-world-choice');
        control.setAttribute('aria-pressed',String(world===id));worlds.append(control);
      }
      if(worlds.childElementCount)header.append(worlds);
      if(names && typeof names==='object'){
        const shown=['A','B'].filter(id=>typeof names[id]==='string'&&names[id].trim()).map(id=>names[id]+(paired&&world===id?' (tú)':'')+' · '+labels[id]);
        if(shown.length)header.append(el('p','mansion-names',shown.join(' / ')));
      }
      if(options.onExit)header.append(button('Volver al expediente',options.onExit,'mansion-exit'));
    }
    function soundControls(item){
      if(!item.text&&!item.signal&&!item.audio&&!item.src)return null;
      const group=el('div','mansion-audio');
      const source=item.audio||item.src;
      if(typeof source==='string'&&/^\/[^/]/.test(source)){
        const player=el('audio');player.controls=true;player.preload='none';player.src=source;
        player.addEventListener('play',()=>{audioPlayers.delete(player);stopAudio();audioPlayers.add(player);});group.append(player);
      }else if(item.signal&&/^[.\-–—\s/]+$/.test(item.signal)&&(window.AudioContext||window.webkitAudioContext)){
        group.append(button('Escuchar señal',async()=>{
          stopAudio();
          try{
            const Audio=window.AudioContext||window.webkitAudioContext,ctx=new Audio();audioPlayers.add(ctx);await ctx.resume();
            let time=ctx.currentTime+.04,unit=.13;
            for(const ch of item.signal){
              if(ch==='/'||ch===' '){time+=unit*(ch==='/'?4:2);continue;}
              const duration=unit*(ch==='.'?1:3),osc=ctx.createOscillator(),gain=ctx.createGain();
              osc.frequency.value=620;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.10,time+.009);
              gain.gain.exponentialRampToValueAtTime(.0001,time+duration);osc.connect(gain);gain.connect(window.GamePreferences?.audioOutput(ctx)||ctx.destination);
              osc.start(time);osc.stop(time+duration+.01);time+=duration+unit;
            }
          }catch{say('Puedes consultar la transcripción de la señal.',true);}
        }));
      }else if(window.speechSynthesis&&window.SpeechSynthesisUtterance&&item.text){
        group.append(button('Escuchar lectura',()=>{
          stopAudio();const speech=new window.SpeechSynthesisUtterance(item.text);speech.lang='es-ES';window.GamePreferences?.audioVoice(speech);
          speaking=true;speech.onend=()=>{speaking=false;};window.speechSynthesis.speak(speech);
        }));
      }
      if(group.childElementCount&&!group.querySelector('audio'))group.append(button('Detener audio',stopAudio));
      return group.childElementCount?group:null;
    }
    function evidencePlate(marks){
      const detail=el('details','mansion-note-detail'),table=el('table','mansion-note-grid');
      detail.append(el('summary',null,'Ver las posiciones en mi placa'));
      table.setAttribute('aria-label','Objetos visibles en la placa, por fila y columna');
      const top=el('tr');top.append(el('td'));
      for(const column of 'ABCD'){
        const head=el('th',null,column);head.scope='col';top.append(head);
      }
      table.append(top);
      for(let row=1;row<=3;row++){
        const line=el('tr'),head=el('th',null,String(row));head.scope='row';line.append(head);
        for(const column of 'ABCD'){
          const values=marks.filter(mark=>mark.cell===column+row).map(mark=>mark.label);
          const cell=el('td',null,values.join(' · ')||'—');
          if(values.length)cell.className='mansion-note-mark';
          line.append(cell);
        }
        table.append(line);
      }
      detail.append(table);return detail;
    }
    function evidenceCard(item,placeId=roomId,latest=false){
      const card=el('article','mansion-note-sheet'),body=el('div','mansion-note-body');
      const image=el('img','mansion-note-print');
      image.src=evidencePhoto(item,placeId,world);image.alt='';image.loading='lazy';image.decoding='async';
      const name=item.title===labels.A||item.title===labels.B?'Vista de la estancia':item.title||'Observación';
      const title=el('h4','mansion-note-title',name);title.tabIndex=-1;
      if(latest)body.append(el('small','mansion-note-recent','Última observación'));
      body.append(title);
      if(item.text)body.append(el('p','mansion-note-copy',item.text));
      if(item.signal)body.append(el('p','mansion-signal',item.signal));
      if(item.kind==='photo-grid'&&Array.isArray(item.marks))body.append(evidencePlate(item.marks));
      const audio=soundControls(item);
      if(audio)body.append(audio);
      card.append(image,body);return card;
    }
    function recording(entry){
      const details=el('details','mansion-recording');
      details.append(el('summary',null,entry.title),soundControls(entry),el('p','mansion-reference','Transcripción · '+entry.text));
      return details;
    }
    function displayPuzzle(stage,mission=false){
      const key=(mission?'mission-'+stage.id:'stage-'+stage.number)+'-'+world;
      if(!drafts.has(key))drafts.set(key,{});
      const params={stage:state.stage?.number||Math.min(state.current||15,15),...(mission?{mission:stage.id}:{})};
      const observed=new Set(observations().map(clue=>clue.title+'|'+clue.text));
      const shownStage={...stage,controls:(stage.controls||[]).filter(control=>roleAllowed(control,world))};
      if(stage.number===6)shownStage.evidence=(stage.evidence||[]).filter(clue=>observed.has(clue.title+'|'+clue.text));
      const puzzle=window.MansionPuzzles.render({
        stage:shownStage,mission,world,inventory:state.inventory,draft:drafts.get(key),actions:(stage.actions||[]).filter(item=>roleAllowed(item,world)),
        perform:(action,extra={})=>act({...extra,op:'act',...params,action:action.id,world}),
        submit:answers=>act({op:'solve',...params,answers,world})
      });
      return dressWorkbench(puzzle,shownStage.controls,drafts.get(key));
    }
    function drawMap(){
      const map=el('details','mansion-map mansion-atlas');
      const summary=el('summary','mansion-map-heading');
      const unlocked=state.rooms.filter(room=>room.unlocked).length;
      const count=unlocked+' de '+state.rooms.length+' estancias abiertas';
      summary.append(el('span','mansion-map-heading-title','Mapa de la mansión'),el('span','mansion-map-count',count));
      const spread=el('div','mansion-map-spread'),plate=el('div','mansion-map-plate');
      const engraving=el('img','mansion-map-engraving');
      engraving.alt='';engraving.src='/mansion-estancias-plano.webp';engraving.width=1200;engraving.height=800;
      engraving.loading='lazy';engraving.decoding='async';plate.append(engraving);
      const places=el('div','mansion-map-pins');
      const key=el('div','mansion-map-index');
      key.append(el('h3','mansion-map-index-heading','Estancias'));
      const list=el('ol','mansion-map-index-list');
      for(const [index,room] of state.rooms.entries()){
        const current=room.id===roomId,position=rooms.indexOf(room.id);
        const n=String(index+1).padStart(2,'0');
        const status=current?'Estás aquí':room.unlocked?'Abierta':'Cerrada';
        const choice=button(n,async()=>{
          await travel(room.id);
          if(disposed||roomId!==room.id||activeDevice)return;
          const heading=panel.querySelector('.mansion-room-title');
          if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView?.({block:'nearest'});}
        },'mansion-room');
        choice.id='mansion-map-room-'+room.id;
        choice.disabled=!room.unlocked;
        if(current)choice.setAttribute('aria-current','location');
        choice.setAttribute('aria-label',room.title+' · '+status);
        choice.style.setProperty('--px',([16,39,62,84][(position<0?index:position)%4])+'%');
        choice.style.setProperty('--py',(position<0?index:position)<4?'41%':'84%');
        const item=el('li'),label=el('label','mansion-map-entry');
        label.htmlFor=choice.id;
        label.dataset.roomState=current?'current':room.unlocked?'open':'locked';
        label.append(el('span','mansion-map-entry-number',n),el('span','mansion-map-entry-title',room.title),el('span','mansion-map-entry-status',status));
        item.append(label);list.append(item);
        places.append(choice);
      }
      plate.append(places);key.append(list);spread.append(plate,key);map.append(summary,spread);return map;
    }
    function drawScene(){
      const stage=state.stage;
      if(state.ending){
        const end=el('article','mansion-ending'),reveal=el('img','mansion-finale');reveal.src='/mansion-finale.webp';
        reveal.alt=state.ending.imageAlt||'La fotografía completa';reveal.style.cssText='width:100%;display:block;max-height:26rem;object-fit:cover';
        end.append(reveal,el('h3',null,state.ending.title),el('p',null,state.ending.text));
        if(state.ending.recording)end.append(recording(state.ending.recording));
        const rewards=el('aventura-resumen');rewards.dataset.case='1';end.append(rewards);
        panel.append(end);
      }
      const room=state.rooms.find(entry=>entry.id===roomId)||state.rooms[0];if(!room)return;
      const localStage=stage?.room===room.id;
      const evidence=(explore?.id===room.id?explore.evidence:localStage?stage.evidence:[])||[];
      const related=localStage?(stage.evidence||[]):[];
      const localItems=[...related,...evidence].filter((item,i,items)=>roleAllowed(item,world)&&items.findIndex(a=>a.title===item.title&&a.text===item.text)===i);
      const scene=el('section','mansion-stage'),frame=el('div','mansion-scene'),photo=el('img','mansion-photo');
      photo.src=roomImage(room.id,world);photo.alt=(room.title||'Sala')+' · '+labels[world];
      photo.width=960;photo.height=540;photo.decoding='async';frame.append(photo);
      const map=coordinates[rooms.indexOf(room.id)]||coordinates[0];
      const details=el('div','mansion-examine');details.setAttribute('role','group');details.setAttribute('aria-label','Objetos y lugares que puedes examinar');
      function marker(label,point,handler,n,detail=null){
        const primary=localStage&&n===1;
        const control=button('',handler,'mansion-marker'+(primary?' mansion-device-pin':' mansion-find'));
        control.style.setProperty('--x',point[0]+'%');control.style.setProperty('--y',point[1]+'%');
        if(primary){
          const dot=el('span','mansion-dot');dot.setAttribute('aria-hidden','true');
          control.append(dot,el('span','mansion-marker-label',label));frame.append(control);
          if(point[0]>68)control.className+=' mansion-pin-end';
        }else{
          if(detail){
            const photo=el('img','mansion-find-photo');photo.alt='';photo.width=80;photo.height=64;photo.loading='lazy';
            photo.src=evidencePhoto(detail,roomId,world);control.append(photo);
          }
          control.append(el('span','mansion-find-label',label));details.append(control);
        }
        return control;
      }
      function returnButton(index,extra=false){
        return button('Volver al escenario',()=>{
          activeDevice=false;selectedEvidence=null;stopAudio();draw();
          if(extra){const list=panel.querySelector('.mansion-room-notes');if(list)list.open=true;}
          const target=panel.querySelectorAll(extra?'.mansion-extra-find':'.mansion-marker')[index];
          target?.focus({preventScroll:true});target?.scrollIntoView?.({block:'center'});
        });
      }
      if(localStage){
        const names=devices[stage.number-1]||[];
        const point=stage.number===3?(world==='A'?[83,47]:[48,61]):map[0];
        marker(names[world==='B'?1:0]||names[0]||'Examinar el mecanismo',point,()=>{activeDevice=true;selectedEvidence=null;draw();focusTarget('.mansion-puzzle-title');},1);
      }
      function inspectItem(item,index){
        if(busy)return;
        const place=roomId,perspective=world,step=state.current;
        const open=()=>{
          if(tab!=='scene'||roomId!==place||world!==perspective||state.current!==step)return;
          selectedEvidence=index;activeDevice=false;
          if(!Array.isArray(state.notebook))seen.set(noteKey(item,world),{...item,world,roomId:place});
        };
        if(item.id&&Array.isArray(state.notebook)&&!state.notebook.some(e=>e.id===item.id&&e.world===world)){
          return act({op:'observe',stage:state.current,roomId:place,world,evidenceId:item.id},open,()=>focusTarget('.mansion-inspection h4'));
        }
        open();draw();focusTarget('.mansion-inspection h4');
      }
      function itemLabel(item){
        return item.title===labels[world]?'Observar la habitación':item.title||'Examinar un objeto';
      }
      function markReading(control,item){
        const read=observations().some(e=>noteKey(e,e.world||world)===noteKey(item,world));
        if(read){control.dataset.read='true';control.setAttribute('aria-label','Volver a examinar · '+itemLabel(item));}
      }
      for(const [i,item] of localItems.slice(0,2).entries()){
        markReading(marker(itemLabel(item),map[i+1],()=>inspectItem(item,i),i+(localStage?2:1),item),item);
      }
      const encounter=(state.missions||[]).find(m=>m.available&&m.room===room.id);
      if(encounter){
        const pin=marker(encounter.title,[24,23],()=>{
          stopAudio();activeDevice=false;selectedEvidence=null;openMission=encounter.id;missionSource=encounter.id;tab='bag';
          draw();focusTarget('.mansion-encounter-title');
        },'✦');
        pin.className+=' mansion-mission-pin';pin.setAttribute('aria-label','Misión opcional · '+encounter.title);
      }
      const caption=el('div','mansion-caption'),location=el('h3','mansion-room-title',room.title);
      location.tabIndex=-1;
      caption.append(el('span','mansion-location-world',labels[world]),location);
      frame.append(caption);scene.append(frame);panel.append(scene);
      const tools=el('aside','mansion-objective mansion-scene-tools');
      const onDevice=localStage&&activeDevice;
      if(stage){
        const heading=el('h3','mansion-tools-heading',onDevice?room.title:'Objetos de esta casa');
        tools.append(heading);
        const task=localStage&&!onDevice&&(stage.contributions?.[world]?.objective||(stage.number===3?
          (world==='A'?'Desde aquí controlas la manivela. La otra casa tiene una vista del interior del pozo.':'Desde aquí ves el fondo del pozo. La manivela se conserva en la otra casa.'):''));
        if(task)tools.append(el('p','mansion-paper-task',task));
      }
      if(details.childElementCount)tools.append(details);
      if(selectedEvidence!=null&&localItems[selectedEvidence]){
        const extra=selectedEvidence>=2;
        const inspection=el('section','mansion-inspection');
        inspection.append(evidenceCard(localItems[selectedEvidence]),returnButton(extra?selectedEvidence-2:selectedEvidence+(localStage?1:0),extra));tools.append(inspection);
      }
      if(stage){
        if(shared)tools.append(mesaHost);
        else {
          const objective=el('section','mansion-objective');
          objective.append(el('p','mansion-eyebrow','Objetivo actual'),el('h3',null,stage.title),el('p',null,stage.brief));
          if(!localStage)objective.append(button('Ir al objetivo',()=>travel(stage.room),'mansion-primary'));
          tools.append(objective);
        }
        if(onDevice){
          const back=returnButton(0);back.className+=' mansion-device-back';
          panel.append(back,displayPuzzle(stage),message);
        }
      }
      if(tools.childElementCount)panel.append(tools);
      if(stage?.recording)panel.append(recording(stage.recording));
      if(localItems.length>2){
        const ledger=el('details','mansion-room-notes');ledger.append(el('summary',null,'Otras observaciones de la sala'));
        for(const [offset,clue] of localItems.slice(2).entries()){
          const extra=button('',()=>inspectItem(clue,offset+2),'mansion-secondary mansion-extra-find');
          const thumb=el('img','mansion-find-photo');thumb.src=evidencePhoto(clue,roomId,world);thumb.alt='';thumb.width=80;thumb.height=64;thumb.loading='lazy';
          extra.append(thumb,el('span','mansion-find-label',itemLabel(clue)));
          markReading(extra,clue);
          ledger.append(extra);
        }
        panel.append(ledger);
      }
      panel.append(drawMap());
      const sounds=el('div','mansion-soundtrack');
      if(state.current===1&&state.recordings?.carta)sounds.append(recording(state.recordings.carta));
      sounds.append(recording(storm));panel.append(sounds);
      panel.append(explorer);
    }
    const inventoryObjects={
      iman:[3,'El hierro forma una herradura. Los dos extremos están pulidos por el uso.'],
      cordon:[3,'Cordón trenzado de la campana. Se puede anudar.'],
      sonda:[3,'La cuerda sujeta el imán por el arco y deja libres sus dos puntas.'],
      llave:[3,'Una llave de metal con el vástago largo y los dientes gastados.'],
      junta:[8,'Un aro flexible de caucho para sellar una unión.'],
      frasco:[9,'Un recipiente vacío de vidrio. La luz atraviesa sus paredes.'],
      recipiente:[10,'El recipiente de vidrio ha llegado en el vagón.'],
      tirador:[10,'Un tramo de cordel que se puede tensar con la mano.'],
      campanilla:[10,'Una pequeña campana con un punto de sujeción en la parte superior.'],
      reclamo:[10,'La campanilla y el cordel forman ahora una sola pieza.'],
      bobinaA:[13,'Alambre de cobre enrollado alrededor de un núcleo.'],
      bobinaB:[13,'La bobina de cobre ha cruzado la esclusa.'],
      lenteB:[13,'Una pieza de vidrio curvado que concentra la luz.'],
      lenteA:[13,'La lente de vidrio ha cruzado la esclusa.']
    };
    function inventoryImage(src,cls){
      const photo=el('img',cls);
      photo.alt='';photo.src=src;photo.loading='lazy';photo.decoding='async';
      return photo;
    }
    function inventoryReturn(){
      activeDevice=false;selectedEvidence=null;switchTab('scene');focusTarget('.mansion-room-title');
    }
    async function inventoryMechanism(){
      const stage=state.stage;
      if(!stage||busy)return;
      if(roomId!==stage.room)await travel(stage.room);
      if(roomId!==stage.room||state.stage?.number!==stage.number)return;
      activeDevice=true;selectedEvidence=null;switchTab('scene');focusTarget('.mansion-puzzle-title');
    }
    function inventoryCard(item){
      const entry=Object.hasOwn(inventoryObjects,item.id)?inventoryObjects[item.id]:null;
      const card=el('details','mansion-inventory-object');
      const top=el('summary'),name=el('span','inventory-object-name',item.title||'Objeto recogido');
      const copy=el('div','inventory-object-copy');
      const src=entry?'/inventario-ada-'+item.id.toLowerCase()+'.webp':'/inventario-ada-maletin.webp';
      const photo=inventoryImage(src,'inventory-object-img');
      photo.width=384;photo.height=384;
      top.append(photo,name,el('span','inventory-object-verb','Examinar'));
      const context=labels[item.world]||(item.world==='both'?'Compartido entre las dos casas':'');
      if(context)copy.append(el('span','inventory-object-world',context));
      const description=item.description||item.text||entry?.[1];
      if(description)copy.append(el('p',null,description));
      if(state.stage&&entry?.[0]===state.stage.number)copy.append(button('Abrir el mecanismo de esta prueba',inventoryMechanism,'mansion-secondary'));
      card.append(top,copy);return card;
    }
    function missions(){
      const list=el('section','mansion-missions'),intro=el('header','inventory-mission-heading');
      intro.append(el('h3',null,'Misiones opcionales'),el('p',null,'Completa estas historias para conseguir llaves de pista.'));
      list.append(intro);
      for(const mission of state.missions||[]){
        const section=el('article','mansion-card');
        const expanded=openMission===mission.id&&mission.available&&!mission.completed;
        section.dataset.open=String(expanded);
        section.dataset.state=mission.completed?'complete':mission.available?'available':'locked';
        const known=['nox','diario','jardin','puerta'].includes(mission.id);
        const photo=inventoryImage(known?'/mision-ada-'+mission.id+'.webp':roomImage(mission.room,world)||'/inventario-ada-maletin.webp','inventory-mission-img');
        const cover=el('div','inventory-mission-cover'),body=el('div','inventory-mission-body');
        cover.append(photo);
        if(mission.reward)cover.append(el('span','inventory-mission-reward',mission.reward+(mission.reward===1?' llave':' llaves')));
        section.append(cover,body);
        const heading=el('h4',missionSource===mission.id?'mansion-encounter-title':null,mission.title);
        heading.tabIndex=-1;body.append(heading);
        if(mission.completed){
          body.append(el('p','inventory-mission-status','Misión completada'));
        }else if(!mission.available){
          body.append(el('p','inventory-mission-status',mission.brief||'Aún por descubrir'));
        }else{
          if(mission.brief)body.append(el('p',null,mission.brief));
          const open=button(expanded?'Cerrar misión':'Abrir misión',()=>{
            openMission=expanded?null:mission.id;draw();
            if(openMission)focusTarget('.mansion-missions .mansion-puzzle-title');
            else focusTarget('.inventory-mission-button-'+mission.id);
          });
          open.className+=' inventory-mission-button-'+mission.id;
          open.setAttribute('aria-expanded',String(expanded));body.append(open);
          if(expanded){
            const work=el('div','inventory-mission-work');
            for(const clue of (mission.evidence||[]).filter(item=>roleAllowed(item,world)))work.append(evidenceCard(clue,mission.room));
            work.append(displayPuzzle(mission,true));section.append(work);
          }
        }
        if(missionSource===mission.id)body.append(button('Volver al lugar del hallazgo',()=>{
          openMission=null;switchTab('scene');focusTarget('.mansion-mission-pin');
        }));
        list.append(section);
      }
      return list;
    }
    function drawBag(){
      const items=(state.inventory||[]).filter(item=>!labels[item.world]||item.world===world);
      const header=el('header','inventory-heading'),title=el('div');
      title.append(el('h3',null,'Inventario'),el('p',null,labels[world]+' · '+items.length+(items.length===1?' objeto':' objetos')));
      header.append(title);
      if(items.length)header.append(button('Volver al escenario',inventoryReturn));
      panel.append(header);
      if(items.length){
        const shelf=el('div','inventory-shelf');shelf.setAttribute('aria-label','Objetos recogidos');
        for(const item of items)shelf.append(inventoryCard(item));
        panel.append(shelf);
      }else{
        const empty=el('section','inventory-empty'),content=el('div','inventory-empty-copy');
        const photo=inventoryImage('/inventario-ada-maletin.webp','inventory-empty-img');photo.loading='eager';
        const emptyGuide=state.stage?.number<=2?'En esta estancia buscas indicios. Al examinarlos, quedan en Evidencias. Los objetos que recojas más adelante se guardarán aquí.':'Cuando recojas un objeto en esta casa, aparecerá aquí. Lo que observes al examinar la habitación queda en Evidencias.';
        content.append(el('h4',null,'El maletín está vacío'),el('p',null,emptyGuide),button('Volver al escenario',inventoryReturn,'mansion-primary'));
        empty.append(photo,content);panel.append(empty);
      }
      if(state.missions?.length)panel.append(missions());
    }
    function drawEvidence(){
      const notebook=el('section','mansion-notebook'),heading=el('header','mansion-notebook-heading');
      const layout=el('div','mansion-notebook-layout'),pages=el('section','mansion-notebook-pages'),album=el('section','mansion-notebook-archive');
      const places=state.rooms||[],grouped=new Map(),unique=new Set(),heard=new Set();
      const entries=Object.entries(state.recordings||{});
      const normalize=text=>String(text||'').trim().replace(/^[«“"]+|[»”"]+$/g,'').trim();
      const visible=item=>roleAllowed(item,world)&&(!labels[item.world]||item.world===world);
      function addRecord(item){
        const record=entries.find(([,entry])=>normalize(entry.text)===normalize(item.text));
        if(!record)return item;
        heard.add(record[0]);return {...item,audio:record[1].audio};
      }
      for(const item of observations().filter(visible).slice().reverse()){
        const key=item.id||[item.title,item.text].join('|');
        if(unique.has(key))continue;
        unique.add(key);
        const id=places.some(room=>room.id===item.roomId)?item.roomId:'';
        if(!grouped.has(id))grouped.set(id,[]);
        grouped.get(id).push(addRecord(item));
      }
      function backToRoom(room,exploreFirst){
        const female=room.id==='galeria';
        const placeName=room.title.slice(0,1).toLocaleLowerCase('es')+room.title.slice(1);
        const label=(exploreFirst?(female?'Explorar la ':'Explorar el '):(female?'Volver a la ':'Volver al '))+placeName;
        return button(label,async()=>{
          if(busy)return;
          if(room.id===roomId){activeDevice=false;selectedEvidence=null;switchTab('scene');}
          else await travel(room.id);
          if(tab==='scene')focusTarget('.mansion-room-title');
        },'mansion-note-return');
      }
      heading.append(el('h3',null,'Evidencias'),el('p',null,labels[world]));
      pages.append(el('h4','mansion-notebook-section','Mis observaciones'));
      if(!grouped.size){
        const empty=el('div','mansion-notebook-empty'),body=el('div','mansion-notebook-empty-copy');
        const room=places.find(item=>item.id===roomId&&item.unlocked)||places.find(item=>item.unlocked);
        body.append(el('p',null,'Examina un punto marcado del escenario para guardar tu primera observación en esta casa.'));
        if(room)body.append(backToRoom(room,true));
        empty.append(body);pages.append(empty);
      }
      const latestRoom=grouped.keys().next().value;
      const openRoom=grouped.has(roomId)?roomId:latestRoom;
      for(const [id,notes] of grouped){
        const room=places.find(place=>place.id===id),group=el('details','mansion-notebook-room');
        const summary=el('summary'),list=el('div','mansion-notebook-entries');
        summary.append(el('span',null,room?.title||'Anotaciones guardadas'),el('small',null,notes.length+(notes.length===1?' indicio':' indicios')));
        group.open=id===openRoom;
        for(const [i,item] of notes.entries())list.append(evidenceCard(item,id,unique.size>1&&id===latestRoom&&i===0));
        if(room?.unlocked)list.append(backToRoom(room,false));
        group.append(summary,list);pages.append(group);
      }
      album.append(el('h4','mansion-notebook-section','Archivo de la aventura'));
      for(const item of (state.album||[]).filter(visible))album.append(evidenceCard(addRecord(item),null));
      for(const [id,entry] of entries){
        if(heard.has(id)||!visible(entry))continue;
        album.append(evidenceCard({...entry,id},null));
      }
      layout.append(pages);if(album.childElementCount>1)layout.append(album);
      notebook.append(heading,layout);panel.append(notebook);
    }
    function drawHints(){
      const stage=state.stage;
      if(!stage){
        const desk=el('section','mansion-hint-desk'),cover=el('header','mansion-hint-cover');
        const picture=el('img','mansion-hint-scene'),intro=el('div','mansion-hint-intro');
        picture.src=state.ending?'/mansion-finale.webp':roomImage(roomId,world)||'/mansion-room-1.webp';picture.alt='';
        intro.append(el('p','mansion-hint-location','Pistas'),el('h3',null,state.ending?'Investigación completada':'La mansión'),
          button(state.ending?'Ver el desenlace':'Volver al escenario',()=>{switchTab('scene');builtTabs.get('scene').focus();},'mansion-secondary mansion-hint-return'));
        cover.append(picture,intro);desk.append(cover);panel.append(desk);return;
      }
      const tiers=stage.hintOptions||[];
      const keys=n=>n+(n===1?' llave':' llaves');
      const fundsKnown=Number.isInteger(state.balance);
      const desk=el('section','mansion-hint-desk');
      const cover=el('header','mansion-hint-cover'),intro=el('div','mansion-hint-intro');
      const mechanisms=[null,null,'well-detail','instrument-reloj','taller-elementos',null,'taller-esferas',
        'taller-riego','taller-vias','taller-presencia','instrument-radio','taller-morse','taller-intercambio','taller-acta','taller-paneles'];
      const mechanism=mechanisms[stage.number-1],picture=el('img','mansion-hint-scene');
      const source=mechanism?'/mansion-'+mechanism+'.webp':roomImage(stage.room,world);
      if(source){picture.src=source;picture.alt='';picture.decoding='async';cover.append(picture);}
      intro.append(el('p','mansion-hint-location','Pistas · Prueba '+stage.number+' de '+(state.total||15)),
        el('h3',null,stage.title));
      if(fundsKnown)intro.append(el('p','mansion-hint-balance','Tu saldo · '+keys(state.balance)));
      intro.append(button('Volver a la prueba',async()=>{
        if(roomId!==stage.room)await travel(stage.room);
        if(roomId!==stage.room)return;
        activeDevice=true;selectedEvidence=null;switchTab('scene');focusTarget('.mansion-puzzle-title');
      },'mansion-secondary mansion-hint-return'));
      cover.append(intro);desk.append(cover);
      const guide={
        open:{title:'Orientación',detail:'Te indica en qué fijarte primero.',art:'lupa'},
        second:{title:'Pista detallada',detail:'Te ayuda a relacionar los indicios.',art:'cuaderno'},
        solution:{title:'Solución explicada',detail:paired?'Revela la respuesta que necesitas para tu parte.':'Revela cómo resolver esta prueba.',art:'carta'}
      };
      const list=el('div','mansion-hint-cards');
      for(const tier of tiers){
        const info=guide[tier.op];
        if(!info)continue;
        const amount=keys(tier.cost),need=fundsKnown&&state.balance<tier.cost;
        const card=el('section','mansion-hint-card');
        const art=el('img','mansion-hint-art');
        art.src='/mansion-pista-'+info.art+'.webp';art.alt='';art.decoding='async';
        const content=el('div','mansion-hint-copy');
        content.append(el('h4',null,info.title));
        if(tier.text){
          const clue=el('p','mansion-hint-answer mansion-hint-read-'+tier.op,tier.text);clue.tabIndex=-1;
          content.append(el('small','mansion-hint-owned','Pista abierta'),clue);
        }else{
          content.append(el('p','mansion-hint-purpose',info.detail));
          if(need)content.append(el('span','mansion-hint-price','Requiere '+amount));
          else if(pendingHint===tier.op){
            const sentence=tier.cost===1?'Se descontará 1 llave de tu saldo.':'Se descontarán '+amount+' de tu saldo.';
            const confirm=button('Confirmar · '+amount,()=>act({op:'hint',stage:stage.number,tier:tier.op,quotedCost:tier.cost},
              ()=>{pendingHint=null;},()=>focusTarget('.mansion-hint-read-'+tier.op)),'mansion-primary mansion-hint-confirm');
            const cancel=button('Cancelar',()=>{pendingHint=null;draw();focusTarget('.mansion-hint-buy-'+tier.op);},'mansion-secondary');
            content.append(el('p','mansion-hint-quote',sentence+' Podrás releerla cuando quieras durante esta prueba.'),confirm,cancel);
          }else{
            const buy=button('Abrir por '+amount,()=>{pendingHint=tier.op;draw();focusTarget('.mansion-hint-confirm');},
              'mansion-secondary mansion-hint-buy-'+tier.op);
            buy.setAttribute('aria-label','Abrir '+info.title.toLowerCase()+' por '+amount);content.append(buy);
          }
        }
        card.append(art,content);list.append(card);
      }
      desk.append(list);
      if(!tiers.length)desk.append(el('p',null,'Esta prueba se resuelve con los indicios del escenario.'),
        button('Consultar mis evidencias',()=>{switchTab('evidence');builtTabs.get('evidence').focus();}));
      if(tiers.some(tier=>!tier.text&&fundsKnown&&tier.cost>state.balance)){
        const vault=el('aside','mansion-hint-keys');
        vault.append(el('p',null,'La sala de Ada da llaves la primera vez que resuelves cada minijuego.'),
          button('Conseguir llaves en la sala de Ada',()=>{arcade.open=true;summary.focus({preventScroll:true});summary.scrollIntoView?.({block:'center'});},'mansion-secondary'));
        desk.append(vault);
      }
      panel.append(desk);
    }
    function draw(){
      if(disposed||!state)return;
      drawHeader();
      for(const [key,node] of builtTabs){node.setAttribute('aria-selected',String(tab===key));node.tabIndex=tab===key?0:-1;}
      panel.setAttribute('aria-labelledby','mansion-tab-'+tab);
      panel.replaceChildren();
      if(tab!=='scene'||!activeDevice||state.stage?.room!==roomId)panel.append(message);
      if(tab==='scene')drawScene();else if(tab==='bag')drawBag();else if(tab==='evidence')drawEvidence();else drawHints();
      if(shared&&(tab!=='scene'||!state.stage))header.append(mesaHost);
      message.textContent=notice;message.dataset.error=String(noticeError);
    }
    function update(value){
      const next=value?.mansion||value?.state||value;
      if(!next||next.revision===state?.revision&&next.current===state?.current&&next.explore?.id===state?.explore?.id)return;
      apply(value,true);draw();
    }
    function destroy(){disposed=true;requestId++;stopAudio();shared?.destroy();root.remove();}
    if(state)draw();
    return {update,destroy,openHints(){switchTab('hints');builtTabs.get('hints').focus();}};
  }
  window.MansionGame=Object.freeze({mount});
})();
