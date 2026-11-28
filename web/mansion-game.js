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
  function el(tag,cls,text){
    const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;
  }
  function button(label,fn,cls='mansion-secondary'){
    const node=el('button',cls,label);node.type='button';node.addEventListener('click',fn);return node;
  }
  function roleAllowed(x,world){return !x?.role||x.role==='both'||x.role==='AB'||x.role===world;}
  function roomImage(id,world='A'){const index=rooms.indexOf(id);return index>=0?'/mansion-'+(world==='B'?'ruin':'room')+'-'+(index+1)+'.webp':null;}
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
    if(options.blockEntry){tabs.classList.add('vd-block-tools');root.append(dock,tabs,header,panel,message);}
    else root.append(header,dock,tabs,panel,message);
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
    function switchTab(id){stopAudio();missionSource=null;tab=id;draw();}
    function say(text,error=false){notice=text||'';noticeError=error;message.textContent=notice;message.dataset.error=String(error);}
    function focusTarget(selector){const target=panel.querySelector(selector);if(target){target.focus({preventScroll:true});target.scrollIntoView?.({block:'nearest'});}}
    function observe(items){
      for(const [i,item] of (items||[]).entries()){
        if(!roleAllowed(item,world))continue;
        const key=item.id||[world,item.title,item.text||'',i].join('|');
        if(!seen.has(key))seen.set(key,item);
      }
    }
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
      observe(state.stage?.evidence);
    }
    async function act(input,after){
      if(busy||disposed)return;
      const id=++requestId;
      busy=true;root.setAttribute('aria-busy','true');say('');saveText='Guardando…';shared?.update({saved:saveText});
      try {
        const result=await options.act(input);
        if(disposed||id!==requestId)return;
        apply(result,true);
        const failed=result?.correct===false;
        saveText=failed?'Respuesta comprobada':'Progreso guardado';
        say(result?.message||result?.feedback||'',failed);
        if(!failed)after?.(result);
        draw();
        if(notice)message.focus({preventScroll:true});
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
        observe(explore?.evidence);
      });
    }
    function drawHeader(){
      header.replaceChildren();root.dataset.world=world;root.dataset.tab=tab;
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
          tutorial:stage&&completed===0?'Abre un objeto marcado en la fotografía y lee lo que observas. '+(paired?'Compara ese detalle con lo que ve tu pareja en la otra casa.':'Cambia de casa para ver la misma habitación desde el otro papel.')+' Después abre el mecanismo y prueba tu deducción.':'',help:{context:paired?'duo':'solo',
            text:paired?'Cada persona observa una realidad de la casa. Comparad lo que ocurre en la misma habitación.':'Puedes alternar entre la casa habitada y la abandonada para comparar la misma habitación.',
            steps:['Abre los puntos de la fotografía para examinar los objetos.','Consulta las evidencias y opera el mecanismo de la sala.','Usa el mapa para volver a las habitaciones abiertas.']},
          next:stage&&tab==='scene'&&stage.room!==roomId?{label:'Ir al objetivo',run:()=>travel(stage.room)}:null});
      }else header.append(el('p','mansion-progress',completed+'/15 pruebas resueltas'));
      const worlds=el('div','mansion-worlds');worlds.setAttribute('aria-label','Realidad de la mansión');
      const names=options.names||state.names;
      if(paired){if(!names?.[world])worlds.append(el('span','mansion-world-name',labels[world]));}
      else for(const id of ['A','B']){
        const control=button(labels[id],()=>{
          if(world===id||busy)return;
          stopAudio();world=id;selectedEvidence=null;
          try{if(perspectiveKey)sessionStorage.setItem(perspectiveKey,JSON.stringify({stage:state.current,world}));}catch{}
          observe(state.stage?.evidence);observe(explore?.evidence);draw();
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
      const observed=new Set([...seen.values()].map(clue=>clue.title+'|'+clue.text));
      const shownStage=stage.number===6?{...stage,evidence:(stage.evidence||[]).filter(clue=>observed.has(clue.title+'|'+clue.text))}:stage;
      return window.MansionPuzzles.render({
        stage:shownStage,mission,world,inventory:state.inventory,draft:drafts.get(key),actions:(stage.actions||[]).filter(item=>roleAllowed(item,world)),
        perform:action=>act({op:'act',...params,action:action.id}),
        submit:answers=>act({op:'solve',...params,answers})
      });
    }
    function drawMap(){
      const map=el('details','mansion-map');map.append(el('summary',null,'Mapa de la mansión'));
      const places=el('div','mansion-rooms');
      for(const [index,room] of state.rooms.entries()){
        const choice=button('',()=>travel(room.id),'mansion-room');
        choice.append(el('span','mansion-room-number',String(index+1).padStart(2,'0')),el('span',null,room.title));
        choice.disabled=!room.unlocked;
        if(room.id===roomId)choice.setAttribute('aria-current','location');
        if(!room.unlocked)choice.append(el('small',null,'Cerrado'));
        places.append(choice);
      }
      map.append(places);return map;
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
      observe(localItems);
      const scene=el('section','mansion-stage'),frame=el('div','mansion-scene'),photo=el('img','mansion-photo');
      photo.src=roomImage(room.id,world);photo.alt=(room.title||'Sala')+' · '+labels[world];
      photo.width=960;photo.height=540;photo.decoding='async';frame.append(photo);
      const map=coordinates[rooms.indexOf(room.id)]||coordinates[0];
      function marker(label,point,handler,n){
        const control=button('',handler,'mansion-marker');
        if(localStage&&n===1)control.className+=' mansion-device-pin';
        control.style.setProperty('--x',point[0]+'%');control.style.setProperty('--y',point[1]+'%');
        const dot=el('span','mansion-dot');dot.dataset.number=String(n);dot.setAttribute('aria-hidden','true');
        control.append(dot,el('span','mansion-marker-label',label));frame.append(control);return control;
      }
      function returnButton(n){
        return button('Volver al escenario',()=>{
          activeDevice=false;selectedEvidence=null;stopAudio();draw();
          const target=panel.querySelectorAll('.mansion-marker')[n-1];
          target?.focus({preventScroll:true});target?.scrollIntoView?.({block:'center'});
        });
      }
      if(localStage)marker('Abrir el mecanismo',map[0],()=>{activeDevice=true;selectedEvidence=null;draw();focusTarget('.mansion-puzzle-title');},1);
      for(const [i,item] of localItems.slice(0,2).entries()){
        const point=i<2?map[i+1]:[18+(i%4)*18,70+Math.min(2,Math.floor(i/4))*7];
        marker(item.title||'Examinar',point,()=>{selectedEvidence=i;activeDevice=false;draw();focusTarget('.mansion-inspection h4');},i+(localStage?2:1));
      }
      const encounter=(state.missions||[]).find(m=>m.available&&m.room===room.id);
      if(encounter){
        const pin=marker(encounter.title,[24,23],()=>{
          stopAudio();activeDevice=false;selectedEvidence=null;openMission=encounter.id;missionSource=encounter.id;tab='bag';
          draw();focusTarget('.mansion-encounter-title');
        },'✦');
        pin.className+=' mansion-mission-pin';pin.setAttribute('aria-label','Misión opcional · '+encounter.title);
      }
      const caption=el('div','mansion-caption');caption.append(el('h3','mansion-room-title',room.title));
      scene.append(frame,caption);panel.append(scene);
      if(selectedEvidence!=null&&localItems[selectedEvidence]){
        const inspection=el('section','mansion-inspection');inspection.append(evidenceCard(localItems[selectedEvidence]),returnButton(selectedEvidence+(localStage?2:1)));panel.append(inspection);
      }
      if(stage){
        if(shared)panel.append(mesaHost);
        else {
          const objective=el('section','mansion-objective');
          objective.append(el('p','mansion-eyebrow','Objetivo actual'),el('h3',null,stage.title),el('p',null,stage.brief));
          if(!localStage)objective.append(button('Ir al objetivo',()=>travel(stage.room),'mansion-primary'));
          panel.append(objective);
        }
        if(localStage&&activeDevice)panel.append(displayPuzzle(stage),returnButton(1));
      }
      if(state.current===1&&state.recordings?.carta)panel.append(recording(state.recordings.carta));
      if(stage?.recording)panel.append(recording(stage.recording));
      if(localItems.length>2){
        const ledger=el('details','mansion-room-notes');ledger.append(el('summary',null,'Otras observaciones de la sala'));
        for(const clue of localItems.slice(2))ledger.append(evidenceCard(clue));panel.append(ledger);
      }
      panel.append(drawMap());
      panel.append(recording(storm));
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
      for(const item of [...(state.album||[]),...(state.stage?.evidence||[]),...seen.values()]){
        const key=[item.title,item.text].join('|');
        if(!roleAllowed(item,world)||unique.has(key))continue;
        const record=entries.find(entry=>normalize(entry.text)===normalize(item.text));
        unique.add(key);if(record)heard.add(record);
        cards.append(evidenceCard(record?{...item,audio:record.audio}:item));
      }
      if(!cards.childElementCount)cards.append(el('p',null,'Las observaciones que descubras aparecerán aquí.'));
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
    if(state){observe(state.stage?.evidence);draw();}
    return {update,destroy,openHints(){switchTab('hints');builtTabs.get('hints').focus();}};
  }
  window.MansionGame=Object.freeze({mount});
})();
