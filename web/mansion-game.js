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
  const photographedBenches=new Set(['elementos','esferas','riego','vias','presencia','morse','intercambio','acta','paneles']);
  function dressWorkbench(puzzle){
    if(!photographedBenches.has(puzzle.dataset.kind))return puzzle;
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
    let state=options.state?.mansion||options.state,role=options.role||state?.role;
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
    arcade.addEventListener('mansion-arcade-reward',event=>{
      if(Number.isInteger(event.detail?.awarded)&&Number.isInteger(state.balance))state.balance+=event.detail.awarded;
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
    function switchTab(id){stopAudio();say('');missionSource=null;tab=id;draw();}
    function say(text,error=false){notice=text||'';noticeError=error;message.textContent=notice;message.dataset.error=String(error);}
    function focusTarget(selector){const target=panel.querySelector(selector);if(target){target.focus({preventScroll:true});target.scrollIntoView?.({block:'nearest'});}}
    const noteKey=(item,perspective)=>[perspective,item.id||item.title+'|'+item.text].join('|');
    function observations(){return Array.isArray(state.notebook)?state.notebook:[...seen.values()];}
    function apply(incoming,keepRoom){
      const next=incoming?.mansion||incoming?.state||incoming;
      if(!next||!Array.isArray(next.rooms))return;
      if(Number.isFinite(state?.revision)&&Number.isFinite(next.revision)&&next.revision<state.revision)return;
      const advanced=next.current!==state?.current||Boolean(next.ending)!==Boolean(state?.ending);
      state=next;
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
          tutorial:stage&&completed===0&&!activeDevice?'Examina un objeto del escenario. Lo que descubras quedará en Evidencias. '+(paired?'Coméntalo con tu pareja y probad vuestra deducción desde las dos casas.':'Cambia de casa para comparar los hallazgos y probar tu deducción.'):'',help:{context:paired?'duo':'solo',
            text:paired?'Cada persona observa una realidad de la casa. Comparad lo que ocurre en la misma habitación.':'Puedes alternar entre la casa habitada y la abandonada para comparar la misma habitación.',
            steps:['Abre los puntos de la fotografía para examinar los objetos.','Consulta las evidencias y opera el mecanismo de la sala.','Usa el mapa para volver a las habitaciones abiertas.']},
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
    function evidenceCard(item){
      const card=el('article','mansion-card');
      const title=el('h4',null,item.title||'Observación');title.tabIndex=-1;card.append(title);
      if(item.role==='A'||item.role==='B')card.append(el('small',null,labels[item.role]));
      if(item.text)card.append(el('p','mansion-reference',item.text));
      if(item.signal)card.append(el('p','mansion-signal',item.signal));
      const audio=soundControls(item);if(audio)card.append(audio);
      return card;
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
      return dressWorkbench(puzzle);
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
      function marker(label,point,handler,n){
        const primary=localStage&&n===1;
        const control=button('',handler,'mansion-marker'+(primary?' mansion-device-pin':' mansion-find'));
        control.style.setProperty('--x',point[0]+'%');control.style.setProperty('--y',point[1]+'%');
        if(primary){
          const dot=el('span','mansion-dot');dot.setAttribute('aria-hidden','true');
          control.append(dot,el('span','mansion-marker-label',label));frame.append(control);
          if(point[0]>68)control.className+=' mansion-pin-end';
        }else{
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
          if(!Array.isArray(state.notebook))seen.set(noteKey(item,world),{...item,world});
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
        markReading(marker(itemLabel(item),map[i+1],()=>inspectItem(item,i),i+(localStage?2:1)),item);
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
          const extra=button(itemLabel(clue),()=>inspectItem(clue,offset+2),'mansion-secondary mansion-extra-find');
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
    function missions(){
      const list=el('section','mansion-missions');list.append(el('h3',null,'Misiones opcionales'));
      for(const mission of state.missions||[]){
        const section=el('article','mansion-card');
        const heading=el('h4',missionSource===mission.id?'mansion-encounter-title':null,mission.title);
        heading.tabIndex=-1;section.append(heading,el('p',null,mission.brief||''));
        if(mission.reward)section.append(el('p','mansion-readout',mission.reward+(mission.reward===1?' llave':' llaves')));
        if(mission.completed)section.append(el('p','mansion-readout','Misión completada'));
        else if(!mission.available)section.append(el('p','mansion-readout','Aún por descubrir'));
        else {
          const open=button(openMission===mission.id?'Cerrar misión':'Abrir misión',()=>{openMission=openMission===mission.id?null:mission.id;draw();if(openMission)focusTarget('.mansion-missions .mansion-puzzle-title');});
          open.setAttribute('aria-expanded',String(openMission===mission.id));section.append(open);
          if(openMission===mission.id){
            for(const clue of (mission.evidence||[]).filter(item=>roleAllowed(item,world)))section.append(evidenceCard(clue));
            section.append(displayPuzzle(mission,true));
          }
        }
        if(missionSource===mission.id)section.append(button('Volver al lugar del hallazgo',()=>{
          openMission=null;switchTab('scene');focusTarget('.mansion-mission-pin');
        }));
        list.append(section);
      }
      return list;
    }
    function drawBag(){
      panel.append(el('h3',null,'Inventario'));
      const items=(state.inventory||[]).filter(item=>!labels[item.world]||item.world===world),cards=el('div','mansion-cards');
      if(!items.length)cards.append(el('p',null,'Todavía no hay objetos en esta carpeta. Explora la habitación y examina sus puntos marcados.'));
      for(const item of items){
        const card=el('article','mansion-card');card.append(el('h4',null,item.title));
        if(labels[item.world])card.append(el('small',null,labels[item.world]));
        if(item.text||item.description)card.append(el('p',null,item.text||item.description));cards.append(card);
      }
      panel.append(cards,missions());
    }
    function drawEvidence(){
      panel.append(el('h3',null,'Evidencias'));
      const cards=el('div','mansion-cards'),unique=new Set(),heard=new Set();
      const entries=Object.values(state.recordings||{});
      const normalize=text=>String(text||'').trim().replace(/^[«“"]+|[»”"]+$/g,'').trim();
      for(const item of [...(state.album||[]),...observations()]){
        const key=[item.title,item.text].join('|');
        if(!roleAllowed(item,world)||labels[item.world]&&item.world!==world||unique.has(key))continue;
        const record=entries.find(entry=>normalize(entry.text)===normalize(item.text));
        unique.add(key);if(record)heard.add(record);
        cards.append(evidenceCard(record?{...item,audio:record.audio}:item));
      }
      if(!observations().some(item=>roleAllowed(item,world)&&(!labels[item.world]||item.world===world)))cards.prepend?.(el('p','mansion-notebook-empty','Examina un objeto del escenario para guardar aquí tu primer hallazgo de esta casa.'));
      panel.append(cards);
      for(const entry of entries)if(!heard.has(entry))panel.append(recording(entry));
    }
    function drawHints(){
      panel.append(el('h3',null,'Pistas'));
      const stage=state.stage;if(!stage){panel.append(el('p',null,'Has completado la investigación.'));return;}
      panel.append(el('h4',null,stage.title));
      if(Number.isInteger(state.balance))panel.append(el('p','mansion-readout','Tu saldo · '+state.balance+(state.balance===1?' llave':' llaves')));
      const names={open:'Orientación',second:'Pista detallada',solution:'Solución explicada'};
      for(const tier of stage.hintOptions||[]){
        const card=el('section','mansion-card'),amount=tier.cost+(tier.cost===1?' llave':' llaves');
        card.append(el('h4',null,names[tier.op]||'Pista'));
        if(tier.text)card.append(el('p','mansion-reference',tier.text));
        else if(pendingHint===tier.op){
          card.append(el('p',null,'Se descontarán '+amount+' de tu saldo. Después podrás releer esta pista.'),
            button('Confirmar · '+amount,()=>act({op:'hint',stage:stage.number,tier:tier.op,quotedCost:tier.cost},()=>{pendingHint=null;}),'mansion-primary'),
            button('Cancelar',()=>{pendingHint=null;draw();}));
        }else card.append(button('Abrir por '+amount,()=>{pendingHint=tier.op;draw();focusTarget('.mansion-card .mansion-primary');}));
        panel.append(card);
      }
      panel.append(button('Volver a mis evidencias',()=>switchTab('evidence')));
    }
    function draw(){
      if(disposed||!state)return;
      drawHeader();
      for(const [key,node] of builtTabs){node.setAttribute('aria-selected',String(tab===key));node.tabIndex=tab===key?0:-1;}
      panel.setAttribute('aria-labelledby','mansion-tab-'+tab);
      panel.replaceChildren();
      if(tab!=='scene'||!activeDevice||state.stage?.room!==roomId)panel.append(message);
      if(tab==='scene')drawScene();else if(tab==='bag')drawBag();else if(tab==='evidence')drawEvidence();else drawHints();
      if(shared&&(tab!=='scene'||!state.stage))root.insertBefore(mesaHost,options.blockEntry?panel:tabs);
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
