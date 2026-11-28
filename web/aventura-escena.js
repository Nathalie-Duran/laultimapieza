(() => {
  'use strict';
  const boards={
    valdemar:{title:'Código Valdemar',symbol:'◇',inspect:'Inspeccionar el lugar',bag:'Inventario'},
    expedicion:{title:'La ruta prohibida',symbol:'✧',inspect:'Explorar la escala',bag:'Mochila de expedición'},
    umbravia:{title:'El tercer jugador',symbol:'◐',inspect:'Alumbrar el lugar',bag:'Objetos del camino'},
    necropolis:{title:'La ira de Ra',symbol:'◉',inspect:'Examinar el enclave',bag:'Inventario de campo'}
  };
  const points=[[30,54],[66,43],[51,68],[75,63]];
  const formats={audio:'Escuchar',ledger:'Examinar',testimony:'Leer',visual:'Examinar',web:'Consultar',text:'Leer'};
  const objectives={Elegid:'Elegir',Elige:'Elegir',Ordenad:'Ordenar',Ordena:'Ordenar',Seleccionad:'Seleccionar',Identificad:'Identificar',Escoged:'Escoger',Escoge:'Escoger',Señalad:'Señalar',Reconstruid:'Reconstruir',Guardad:'Guardar',Colocad:'Colocar',Seguid:'Seguir'};
  function stageObjective(phase,firstProof){
    const task=phase.task?.trim();
    if(!task)return firstProof?'Examina «'+firstProof.label+'» y contrasta lo que encuentres con las demás pruebas.':'Contrasta las pruebas y resuelve la decisión de esta etapa.';
    if(task.startsWith('¿')&&task.endsWith('?'))return 'Averigua '+task[1].toLocaleLowerCase('es')+task.slice(2,-1)+'.';
    return task.replace(/^\S+/,word=>objectives[word]||word);
  }
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
  function button(label,run,cls){const node=el('button',cls,label);node.type='button';node.addEventListener('click',run);return node;}
  function challengeHeader({id,world,title,photo,caseTitle,embedded=false}){
    const season=boards[world]||boards.valdemar;
    const board=world==='valdemar'?'mapa':world;
    const header=el('header','reto-cabecera');
    const image=el('img','reto-foto');
    image.src=photo;image.width=768;image.height=512;image.alt='';image.decoding='async';
    const copy=el('div','reto-cabecera-copy');
    const directory=el('a','reto-directorio','Retos de '+season.title);
    directory.href='/#desafios?mundo='+board;
    const navigation=el('nav','reto-cabecera-nav');
    navigation.setAttribute('aria-label','Salidas del reto');
    navigation.append(directory);
    const game=el('p','reto-procedencia','Juego '+String((id-1)%12+1).padStart(2,'0')+' · '+caseTitle);
    copy.append(game,el(embedded?'h2':'h1','reto-nombre',title),navigation);
    header.append(image,copy);
    return header;
  }
  function mountExplorer(target,frame,id){
    let explorer;
    function sync(){
      if(!['solo','duo'].includes(frame.dataset.playMode)){if(explorer){explorer.remove();explorer=null;}return;}
      if(!explorer){explorer=el('lup-explorador','ae-explorer');explorer.setAttribute('case-id',String(id));target.append(explorer);}
    }
    sync();const observer=new MutationObserver(sync);observer.observe(frame,{attributes:true,attributeFilter:['data-play-mode']});
    return {destroy(){observer.disconnect();}};
  }
  function mount(host,options){
    const {world,frame,story,toolbar,modeControl,read,actions}=options;
    const style=boards[world]||boards.valdemar;
    frame.dataset.adventureWorld=world;
    host.className='ae-scene';host.dataset.world=world;
    toolbar.className+=' ae-toolbar';
    const heading=el('div','ae-heading');
    const ancestry=style.title+' · Caso '+String((options.id-1)%12+1).padStart(2,'0');
    const contextLabel=el('p','ae-world-name',ancestry),caseTitle=el('h1','ae-title',story.title);
    heading.append(contextLabel,caseTitle);
    const stage=el('div','ae-stage'),photo=el('img','ae-image');
    let currentPhoto=options.image;
    photo.src=currentPhoto;photo.alt=options.alt||options.place||'Escenario del caso';
    photo.width=768;photo.height=512;photo.decoding='async';
    const caption=el('div','ae-caption'),progress=el('span','ae-progress'),place=el('h2','ae-place');
    caption.append(progress,place);
    const markers=el('div','ae-markers ae-play');markers.setAttribute('role','group');markers.setAttribute('aria-label','Puntos de inspección');
    stage.append(photo,caption,markers);
    const party=el('p','ae-team');
    const setup=el('details','ae-mode'),label=el('summary');
    setup.append(label,modeControl.entry);
    const objective=el('section','ae-objective ae-play'),goalLabel=el('h2',null,'Objetivo actual'),goal=el('p');
    objective.append(goalLabel,goal);
    const tools=el('nav','ae-actions ae-play');tools.setAttribute('aria-label','Herramientas de la aventura');
    tools.append(button(style.bag,()=>actions('bag'),'ae-action'),button('Evidencias',()=>actions('evidence'),'ae-action'));
    const instrument=el('details','ae-instrument ae-play'),instrumentTitle=el('summary',null,{
      valdemar:'Índice del expediente',expedicion:'Carta de navegación',umbravia:'Farol de inspección',necropolis:'Disco de indicios'
    }[world]||'Cuaderno de campo'),instrumentBody=el('div','ae-instrument-body');
    instrument.append(instrumentTitle,instrumentBody);
    const briefing=el('details','ae-instructions');
    briefing.append(el('summary',null,'Leer la apertura del caso'));
    if(story.question)briefing.append(el('p',null,story.question));
    if(story.intro)briefing.append(el('p',null,story.intro));
    const mesaHost=el('div','ae-mesa');
    const shared=window.MesaDeJuego?.mount(mesaHost,{family:world,title:story.title});
    const entryTools=options.blockEntry?mesaHost.querySelector('.mj-tools'):null;
    const toolHome=entryTools?.parentElement;
    entryTools?.classList.add('vd-block-tools');
    const mesaHome=el('div','ae-mesa-home');
    const dock=el('aside','mj-objective-dock');dock.hidden=true;dock.setAttribute('aria-label','Objetivo de la aventura');
    const examined=new Set();
    if(shared){mesaHome.append(mesaHost);caption.replaceChildren(place);host.replaceChildren(toolbar,heading,stage,party,setup,mesaHome,instrument);}
    else host.replaceChildren(toolbar,heading,stage,party,setup,objective,tools,instrument);
    if(options.blockEntry){toolbar.remove();heading.remove();setup.remove();}
    const readingTable=options.id>1?el('div','ae-reading-table ae-play vhour'):null;
    if(readingTable){readingTable.hidden=true;host.insertBefore(readingTable,stage);}
    const jump=readingTable?button('Ver la prueba',()=>actions('evidence'),'ae-jump-proof'):null;
    if(jump){jump.hidden=true;dock.append(jump);dock.className+=' ae-proof-dock';}
    if(story.intro||story.question)host.append(briefing);
    let lastMode,signature,currentHour,lastPoint,secondaryPanel=null,sceneContext={},area='scene',extraOrigin=null;
    let entryFocus=null;
    function cancelEntryFocus(){
      entryFocus?.abort();
      entryFocus=null;
    }
    function focusOpenEvidence(){
      if(!entryFocus||secondaryPanel||!readingTable?.isConnected||readingTable.hidden)return;
      const summary=readingTable.querySelector('.vhour-shelf:not([hidden]) .vhour-material[open]:not([hidden]) > summary');
      if(!summary?.getClientRects().length)return;
      cancelEntryFocus();
      summary.focus({preventScroll:true});
      summary.scrollIntoView({block:'start',behavior:'instant'});
    }
    function requestEntryFocus(){
      if(!readingTable)return;
      cancelEntryFocus();
      entryFocus=new AbortController();
      const opts={capture:true,signal:entryFocus.signal};
      for(const type of ['pointerdown','keydown','click'])document.addEventListener(type,cancelEntryFocus,opts);
      queueMicrotask(focusOpenEvidence);
    }
    let writes=0,saveText=options.resumed?'Partida recuperada':'',saveIssue=false;
    host.addEventListener('click',event=>{const point=event.target.closest?.('button');if(point&&host.contains(point))lastPoint=point;},true);
    const back=button('Volver al escenario',()=>{
      if(secondaryPanel?.matches('.md-game-side,.vd-game')&&window.location?.hash){
        const query=new URLSearchParams(window.location.hash.split('?')[1]);
        const source=Number(query.get('desde'));
        if(query.get('volver')==='pistas'&&Number.isInteger(source)&&source>=1&&source<=48&&source!==options.id){
          window.location.hash=(source<=12?'valdemar-jugar':'mundos-jugar')+'?id='+source+'&seccion=pistas&retomar=1';return;
        }
      }
      if(secondaryPanel?.matches('.md-game-side,.vd-game')&&extraOrigin){
        const source=extraOrigin;extraOrigin=null;const panel=actions('restore',source.view);
        const target=source.trigger?.isConnected&&!source.trigger.closest('[hidden]')?source.trigger:
          [...(panel?.querySelectorAll('button,a,summary')||[])].find(el=>el.textContent===source.label&&!el.closest('[hidden]'))||panel;
        if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});return;}
      }
      actions('scene');
      const point=lastPoint?.isConnected&&host.contains(lastPoint)&&!lastPoint.closest('details:not([open])')?lastPoint:markers.querySelector('button');
      point?.focus({preventScroll:true});(point||stage).scrollIntoView({block:'center'});
    },'ae-back');
    function returnFrom(target){
      if(!target)return;
      if(shared){
        secondaryPanel=target.closest?.('.md-game-side,.vd-game,.md-game-help,.vd-help,.md-game-end,.vd-ending,.vhour-hotel-panel')||null;
        if(secondaryPanel?.matches('.md-game-help,.vd-help'))area='hints';
        else if(target.closest?.('.expedition-inventory'))area='bag';
        else if(target.closest?.('.vhour-material,.vhour-journal')){
          area='evidence';
          const card=target.closest('.vhour-material');
          if(card?.dataset.material)examined.add((currentHour||read().hour)?.current+'|'+card.dataset.material);
        }
        else if(!secondaryPanel)area='scene';
        syncMesa();
      }
      const sideNav=target.querySelector?.('.reto-cabecera-nav');
      if(sideNav){if(back.parentElement!==sideNav)sideNav.append(back);return;}
      if(back.parentElement===target)return;
      if(target.tagName==='DETAILS'&&target.firstElementChild)target.firstElementChild.after(back);
      else target.prepend(back);
    }
    function syncMesa(){
      if(!shared)return;
      const sideOpen=secondaryPanel?.matches('.md-game-side,.vd-game')===true;
      back.textContent=sideOpen?'Volver a mi investigación':'Volver al escenario';
      const waiting=sideOpen&&frame.dataset.playMode==='pending';
      const ficha=sideOpen?options.extra||window.RetosTemporada?.ficha(options.id):null;
      const headerTitle=waiting&&ficha?ficha.title:story.title;
      if(caseTitle.textContent!==headerTitle)caseTitle.textContent=headerTitle;
      const context=waiting?'Reto de aventura · '+ancestry:ancestry;
      if(contextLabel.textContent!==context)contextLabel.textContent=context;
      const section=frame.dataset.playMode==='pending'?null:secondaryPanel;
      if(readingTable)readingTable.hidden=!!section||!readingTable.firstElementChild||
        !['solo','duo'].includes(frame.dataset.playMode);
      if(entryTools){
        const holder=section?toolHome:host;
        if(entryTools.parentElement!==holder)holder.insertBefore(entryTools,section?holder.firstChild:(readingTable||stage));
      }
      const ready=['solo','duo'].includes(frame.dataset.playMode);
      shared.dockObjective?.(dock.parentElement&&ready&&!sideOpen?dock:null);
      const canNavigate=ready&&!sideOpen;
      const controls=canNavigate?[['scene','Escenario'],['bag','Inventario'],['evidence','Evidencias'],['hints','Pistas']].map(([kind,label])=>({
        id:kind,label,selected:area===kind,run:()=>{
          actions(kind);if(kind==='scene'){const pin=markers.querySelector('button');pin?.focus({preventScroll:true});(pin||stage).scrollIntoView({block:'center'});}
        }
      })):[];
      if(!section){
        if(mesaHost.parentElement!==mesaHome)mesaHome.append(mesaHost);
        const next=ready?nextStep():null;
        shared.update(waiting?{...sceneContext,tools:[],tutorial:'',saved:'',next:null,objective:'Elige cómo jugar para abrir el reto.',help:{context:'reto',text:ficha?.action||''}}:{...sceneContext,next,tools:controls,saved:ready?saveText:''});return;
      }
      if(mesaHost.parentElement!==section){
        const hero=section.querySelector('.reto-cabecera');
        if(hero && hero.parentElement===section)section.insertBefore(mesaHost,hero.nextSibling);
        else section.prepend(mesaHost);
      }
      const data=read(),base={...sceneContext,tools:controls,saved:sideOpen?'':saveText,tutorial:'',next:null};
      if(section.matches('.md-game-side,.vd-game')){
        const complete=data.wallet?.won?.includes(options.id);
        const side=data.side;
        const pitch=section.querySelector('.vd-note')?.textContent;
        const prize=data.parallelPrize;
        const reward=Number.isInteger(prize)?prize+(prize===1?' llave':' llaves')+' al resolverlo por primera vez':'Reto de aventura';
        shared.update({...base,title:side?.title||ficha?.title||story.title,progress:complete?'Premio del reto recibido':reward,
          objective:complete?'':side?.brief||pitch||'',help:{context:'reto',text:side?.task||'Examina el tablero y utiliza sus controles para resolver el reto.',
          steps:['Consulta la consigna del reto.','Prueba una respuesta o manipula las piezas.','Al terminar puedes volver a la investigación.']}});
      }else if(section.matches('.md-game-help,.vd-help')){
        shared.update({...base,progress:'Pistas · '+(sceneContext.progress||story.title)});
      }else if(section.matches('.vhour-hotel-panel')){
        shared.update({...base,progress:'Hotel Medianoche',objective:'Examina el hotel y contrasta las pruebas con los testimonios.'});
      }else shared.update({...base,progress:data.progress?.choice?'Desenlace guardado':sceneContext.progress,objective:currentHour?.stage?'Termina las etapas de la investigación para abrir el desenlace.':sceneContext.objective});
    }
    function nextStep(){
      const data=read(),hour=currentHour||data.hour,phase=hour?.stage;
      if(!phase)return {label:data.progress?.choice?'Leer mi desenlace':'Abrir la deducción final',run:()=>actions('ending')};
      const room=hour.inventory?.rooms?.find(room=>room.index===hour.current);
      if(room&&!room.visited)return {label:'Explorar '+room.place,run:()=>actions('inspect')};
      const paper=frame.dataset.playPaper;
      const next=(phase.materials||[]).find(item=>(paper!=='A'&&paper!=='B'||!item.role||item.role==='AB'||item.role===paper||item.role===(paper==='A'?1:2))&&!examined.has(hour.current+'|'+item.id));
      return next?{label:'Examinar '+next.label,run:()=>actions('material',next.id)}:{label:'Resolver la etapa',run:()=>actions('decision')};
    }
    function update(hour){
      if(hour)currentHour=hour;
      const data=read(),state=currentHour||data.hour;
      if(!state)return;
      const mode=frame.dataset.playMode||'pending',paper=frame.dataset.playPaper;
      const filter=paper==='A'||paper==='B'?paper:null;
      const entering=(lastMode==null||lastMode==='pending')&&(mode==='solo'||mode==='duo')&&readingTable;
      if(lastMode!==mode){
        const active=setup.contains(document.activeElement);
        setup.open=mode==='pending';
        if(active&&mode!=='pending'){
          const next=secondaryPanel?.matches('.md-game-side,.vd-game')?secondaryPanel:label;
          next.focus({preventScroll:true});
          if(next===secondaryPanel)next.scrollIntoView({block:'start'});
        }
        lastMode=mode;
      }
      const names=data.names||{};
      const playerName=data.playerName||options.playerName?.();
      const together=mode==='duo';
      const partner=data.partner;
      let crew='';
      if(together&&partner){
        crew=['A','B'].map((id,index)=>{
          const real=names[id]||(partner.role!==id?partner.name:playerName);
          return real?'Papel '+(index+1)+' · '+real:'Papel '+(index+1)+(partner.role===id?' · Tú':'');
        }).join(' / ');
      }else if(together)crew='Revisión editorial · Papel '+(filter==='B'?'2':'1');
      else if(mode==='solo')crew=playerName?'En solitario · '+playerName:'En solitario';
      party.textContent=crew;party.hidden=!crew;
      label.textContent=mode==='pending'?'Cómo quieres jugar':'Cambiar modalidad';
      const phase=state.stage;
      const sceneImage=phase && window.EscenasDeCaso?.[options.id]?.(state.current);
      const imageUrl=sceneImage||options.image;
      if(currentPhoto!==imageUrl){currentPhoto=imageUrl;photo.src=imageUrl;}
      photo.alt=sceneImage?(phase.place||phase.title):(options.alt||options.place||'Escenario del caso');
      const visible=(phase?.materials||[]).filter(item=>!filter||!item.role||item.role==='AB'||item.role===filter||item.role===(filter==='A'?1:2));
      const next=JSON.stringify([state.current,phase?.title,mode,filter,visible.map(item=>[item.id,item.label]),data.progress?.choice,data.progress?.deduced]);
      if(next===signature)return;
      signature=next;markers.replaceChildren();instrumentBody.replaceChildren();
      if(entering)requestEntryFocus();
      const total=state.stages?.length||0;
      progress.textContent=phase?'Etapa '+(state.current+1)+' de '+total:'Investigación completada';
      place.textContent=phase?.place||options.place||phase?.title||story.title;
      goalLabel.textContent=phase?.title||'Objetivo actual';
      const firstProof=visible[0];
      goal.textContent=phase?stageObjective(phase,firstProof):data.progress?.choice?'Relee tu desenlace o vuelve a Mis partidas.':data.progress?.deduced?'Elige cómo cerrar la historia y guarda tu desenlace.':'Contrasta la deducción final con las pruebas recogidas.';
      goal.hidden=!goal.textContent;
      if(shared){
        const ready=mode!=='pending';
        const step=phase?[progress.textContent,phase.title].filter(Boolean).join(' · '):progress.textContent;
        sceneContext={
          progress:ready?step:'',
          objective:ready?goal.textContent:'Elige la modalidad para abrir el escenario.',
          help:{context:together?'duo':'temporada',text:'Los puntos del escenario abren el lugar, sus pruebas y la decisión de esta etapa.',
            steps:['Examina las pruebas de tu carpeta.','Reúne los objetos en el inventario y contrasta lo que has observado.','Resuelve la etapa para abrir la siguiente estancia.']},
          tutorial:ready&&phase&&state.current===0?(readingTable?'Abre los documentos de la mesa y compara sus detalles. '+(together?'Describe lo que ves a tu pareja.':'Puedes consultar las dos carpetas.')+' Pulsa «Resolver la prueba» cuando tengas una hipótesis.':'Empieza por «'+(firstProof?.label||style.inspect)+'» en la imagen.'):'',
          next:null
        };
        syncMesa();
      }
      drawScene({world,stage,markers,instrumentBody,actions,visible,state,phase,style,data});
    }
    update();
    const explorer=mountExplorer(host,frame,options.id);
    enableLamp(world,stage,markers);
    const observer=new MutationObserver(()=>update());
    observer.observe(frame,{attributes:true,attributeFilter:['data-play-mode','data-play-paper']});
    return {update,returnFrom,present(table){
      if(!readingTable)return;
      readingTable.replaceChildren(...(table?[table]:[]));
      jump.hidden=!table;
      readingTable.hidden=!table||!!secondaryPanel||!['solo','duo'].includes(frame.dataset.playMode);
      if(entryFocus)queueMicrotask(focusOpenEvidence);
    },attach(){if(shared){frame.prepend(dock);syncMesa();}},
      inventory(snapshot){const hour=currentHour||read().hour;if(hour&&snapshot&&snapshot.revision>=(hour.inventory?.revision||0)){hour.inventory=snapshot;syncMesa();}},
      rememberExtra(view){if(view&&document.activeElement&&frame.contains(document.activeElement))extraOrigin={view,trigger:document.activeElement,label:document.activeElement.textContent};},
      writing(){writes++;if(writes===1)saveIssue=false;saveText='Guardando…';syncMesa();},
      written(ok){if(ok===false)saveIssue=true;writes=Math.max(0,writes-1);saveText=writes?'Guardando…':saveIssue?'Última acción sin confirmar':ok===null?'Respuesta comprobada':'Progreso guardado';syncMesa();},
      focus(){
        const entry=readingTable&&!readingTable.hidden&&readingTable.querySelector('.vhour-shelf:not([hidden]) .vhour-material[open]:not([hidden])>summary');
        const target=entry||markers.querySelector('button');
        target?.focus({preventScroll:true});(entry||host).scrollIntoView({block:'start',behavior:'instant'});
      },destroy(){cancelEntryFocus();observer.disconnect();explorer.destroy();shared?.destroy();}};
  }
  function drawScene({world,stage,markers,instrumentBody,actions,visible,state,phase,style,data}){
    function marker(text,name,info,slot){
      const control=button('',()=>actions(name,info),'ae-marker');
      control.dataset.action=name;
      control.style.setProperty('--x',points[slot][0]+'%');control.style.setProperty('--y',points[slot][1]+'%');
      const icon=el('span','ae-glyph',slot===0?style.symbol:['','⌕','◈','↗'][slot]);icon.setAttribute('aria-hidden','true');
      control.append(icon,el('span','ae-marker-label',text));return control;
    }
    if(world==='expedicion'||world==='valdemar'){
      const list=el('ol','ae-route');
      for(const [index,step] of (state.stages||[]).entries()){
        const item=el('li'),text=step.place||step.title;
        if(index<state.current&&(state.journal||[]).some(note=>note.index===index)){
          item.append(button(text,()=>actions('journal',index),'ae-stop'));
        }else if(index===state.current&&phase){const active=button(text,()=>actions('inspect'),'ae-stop');active.setAttribute('aria-current','step');item.append(active);}
        else {const future=el('span','ae-stop',text);future.setAttribute('aria-label',text+' · etapa futura');item.append(future);}
        list.append(item);
      }
      instrumentBody.append(list);
    }else if(world==='umbravia'){
      const toggle=button('',()=>{
        const light=stage.dataset.lit!=='true';stage.dataset.lit=String(light);toggle.setAttribute('aria-pressed',String(light));
        toggle.textContent=light?'Apagar el farol':'Encender el farol';
      },'ae-action ae-lantern');
      toggle.textContent=stage.dataset.lit==='true'?'Apagar el farol':'Encender el farol';toggle.setAttribute('aria-pressed',String(stage.dataset.lit==='true'));
      instrumentBody.append(toggle,el('p',null,'Mueve el puntero sobre la imagen o recorre sus puntos con el tabulador para dirigir la luz.'));
    }else if(world==='necropolis'&&visible.length){
      let selected=0;
      const rim=el('div','ae-disc'),dial=el('span','ae-disc-face','◎'),output=el('output','ae-disc-label');
      function turn(offset){selected=(selected+offset+visible.length)%visible.length;dial.style.transform='rotate('+selected*360/visible.length+'deg)';output.textContent=(selected+1)+' / '+visible.length+' · '+visible[selected].label;}
      dial.setAttribute('aria-hidden','true');output.setAttribute('aria-live','polite');
      rim.append(dial,output,button('Girar a la izquierda',()=>turn(-1),'ae-action'),button('Girar a la derecha',()=>turn(1),'ae-action'),
        button('Examinar el indicio seleccionado',()=>actions('material',visible[selected].id),'ae-action'));turn(0);instrumentBody.append(rim);
    }else instrumentBody.append(el('p',null,'Las pruebas ya resueltas están en el cuaderno de la investigación.'));
    if(!phase){markers.append(marker(data.progress?.choice?'Tu desenlace':'Abrir la resolución','ending',null,0));return;}
    markers.append(marker(style.inspect,'inspect',null,0));
    for(const [i,item] of visible.slice(0,2).entries())markers.append(marker((formats[item.kind]||'Examinar')+' · '+item.label,'material',item.id,i+1));
    markers.append(marker('Resolver la etapa','decision',null,3));
  }
  function enableLamp(world,stage,markers){
    if(world==='umbravia'){
      function lightAt(x,y){stage.style.setProperty('--light-x',x+'%');stage.style.setProperty('--light-y',y+'%');}
      stage.addEventListener('pointermove',event=>{if(stage.dataset.lit!=='true')return;const box=stage.getBoundingClientRect();if(box.width&&box.height)lightAt((event.clientX-box.x)*100/box.width,(event.clientY-box.y)*100/box.height);});
      markers.addEventListener('focusin',event=>{if(stage.dataset.lit!=='true')return;const target=event.target.closest('button');if(!target)return;const box=stage.getBoundingClientRect(),spot=target.getBoundingClientRect();
        if(box.width&&box.height)lightAt((spot.x+spot.width/2-box.x)*100/box.width,(spot.y+spot.height/2-box.y)*100/box.height);});
    }
  }
  function caseScene(frame,options){
    const {world,story,actions}=options,style=boards[world]||boards.valdemar;
    const host=el('section','ae-scene case-scenario'),stage=el('div','ae-stage'),photo=el('img','ae-image');
    frame.dataset.adventureWorld=world;host.dataset.world=world;
    photo.width=768;photo.height=512;photo.decoding='async';
    const caption=el('div','ae-caption'),place=el('h2','ae-place');
    caption.append(place);
    const markers=el('div','ae-markers ae-play');
    markers.setAttribute('role','group');markers.setAttribute('aria-label','Puntos de inspección');
    stage.append(photo,caption,markers);
    const instrument=el('details','ae-instrument ae-play'),instrumentTitle=el('summary',null,{
      valdemar:'Índice del expediente',expedicion:'Carta de navegación',umbravia:'Farol de inspección',necropolis:'Disco de indicios'
    }[world]||'Cuaderno de campo'),instrumentBody=el('div','ae-instrument-body');
    instrument.append(instrumentTitle,instrumentBody);
    const goal=el('p','case-consigna');
    host.append(stage,goal,instrument);
    if(story.question||story.intro){
      const opening=el('details','ae-instructions');
      opening.append(el('summary',null,'Leer la apertura del caso'));
      for(const text of [story.question,story.intro])if(text)opening.append(el('p',null,text));
      host.append(opening);
    }
    const explorer=mountExplorer(host,frame,options.id);
    enableLamp(world,stage,markers);
    let lastHour,lastSignature;
    function update(hour){
      if(hour)lastHour=hour;
      const data=options.read()||{},state=lastHour||data.hour;
      if(!state)return;
      const phase=state.stage,paper=frame.dataset.playPaper,filter=['A','B'].includes(paper)?paper:null;
      const visible=(phase?.materials||[]).filter(item=>!filter||!item.role||item.role==='AB'||item.role===filter||item.role===(filter==='A'?1:2));
      const signature=JSON.stringify([state.current,phase?.title,filter,visible.map(item=>[item.id,item.label]),data.progress?.choice,state.journal?.length]);
      if(signature===lastSignature)return;
      lastSignature=signature;
      const artwork=phase&&window.EscenasDeCaso?.[options.id]?.(state.current);
      photo.src=artwork||options.image;
      photo.alt=artwork?(phase.place||phase.title):(options.alt||options.place||story.title);
      place.textContent=phase?.place||options.place||story.title;
      goal.textContent=phase?stageObjective(phase,visible[0]):'Has completado las etapas. Abre Desenlace para cerrar la investigación.';
      markers.replaceChildren();instrumentBody.replaceChildren();
      drawScene({world,stage,markers,instrumentBody,actions,visible,state,phase,style,data});
    }
    const observer=new MutationObserver(()=>update());
    observer.observe(frame,{attributes:true,attributeFilter:['data-play-paper','data-play-mode']});
    return {node:host,update,destroy(){observer.disconnect();explorer.destroy();}};
  }
  function panelNavigation(frame,onSelect,options){
    const type=options?'case':'hotel',viewId=key=>type+'-vista-'+key;
    const shell=el('div',type+'-partida'),nav=el('nav',type+'-nav'),status=el('p',type+'-progress');
    nav.setAttribute('aria-label',options?'Investigar en '+options.story.title:'Investigar en Hotel Medianoche');
    const labels={escenario:'Escenario',evidencias:'Evidencias',resolver:'Resolver',inventario:'Inventario',pistas:'Pistas',extra:'Reto extra',desenlace:'Desenlace'};
    const buttons=new Map(),screens=new Map();
    for(const [key,label] of Object.entries(labels)){
      const b=button(label,()=>onSelect(key,true),type+'-go');b.dataset[type+'Go']=key;
      b.setAttribute('aria-controls',viewId(key));nav.append(b);buttons.set(key,b);
    }
    const save=el('span',type+'-save');save.setAttribute('role','status');
    const help=el('details',type+'-instrucciones'),guide=el('ol');
    help.append(el('summary',null,'Cómo se juega'),guide);
    const tips=options?[
      'Examina los puntos de Escenario para recorrer el lugar y recoger objetos. Podrás volver a ellos en Inventario.',
      'Abre un documento en Evidencias y examina sus detalles. En pareja, cada persona aporta las pruebas de su carpeta.',
      'Reúne lo que has averiguado en Resolver para avanzar a la siguiente etapa. En Pistas puedes consultar una ayuda.'
    ]:[
      'En Evidencias, abre un documento y examina las marcas o experimenta con sus controles. En pareja, describid lo que contiene vuestra carpeta.',
      'En Escenario puedes recorrer el hotel, recoger objetos y enseñárselos a los testigos. El Inventario conserva los hallazgos.',
      'En Resolver, contrasta tu hipótesis. Si necesitas ayuda, entra en Pistas. Al completar las cinco etapas podrás decidir el desenlace.'
    ];
    for(const tip of tips)guide.append(el('li',null,tip));
    shell.append(nav,status,help);
    let pending=0,failed=false,active=null,focusRequest=null,entryObserver=null;
    function cancelEntry(){focusRequest?.abort();focusRequest=null;}
    function focusFirstEvidence(){
      if(active!=='evidencias'||!['solo','duo'].includes(frame.dataset.playMode))return;
      const slot=screens.get('evidencias');
      const card=slot?.querySelector('.vhour-material[open]:not([hidden])>summary');
      if(!card||!card.getClientRects().length)return;
      const clearance=Math.ceil(nav.getBoundingClientRect().height)+10;
      shell.style.setProperty('--'+type+'-nav-alto',(clearance-10)+'px');
      const heading=slot.querySelector('h2'),instruction=slot.querySelector('.'+type+'-consigna');
      const first=[...card.parentElement.querySelectorAll('button,input,select')].find(b=>!b.disabled&&b.getClientRects().length);
      const bottom=(first||card).getBoundingClientRect().bottom;
      const fits=node=>node&&bottom-node.getBoundingClientRect().top+clearance<innerHeight-70;
      const target=fits(heading)?heading:fits(instruction)?instruction:card;
      card.focus({preventScroll:true});
      // El documento se abre en el scroll de la página. Deja la lectura completa justo después del menú fijo.
      window.scrollBy({top:Math.round(target.getBoundingClientRect().top-clearance),behavior:'instant'});
    }
    function scheduleEntry(){
      cancelEntry();focusRequest=new AbortController();
      const check=focusRequest;
      for(const type of ['pointerdown','keydown','click','wheel','touchmove'])document.addEventListener(type,cancelEntry,{capture:true,passive:true,signal:check.signal});
      queueMicrotask(()=>{if(!check.signal.aborted)focusFirstEvidence();});
      requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!check.signal.aborted)focusFirstEvidence();}));
      const timer=setTimeout(()=>{if(check.signal.aborted)return;focusFirstEvidence();cancelEntry();},260);
      check.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
    }
    function enter(){
      entryObserver?.disconnect();
      if(['solo','duo'].includes(frame.dataset.playMode)){scheduleEntry();return;}
      entryObserver=new MutationObserver(()=>{
        if(!['solo','duo'].includes(frame.dataset.playMode))return;
        entryObserver.disconnect();scheduleEntry();
      });
      entryObserver.observe(frame,{attributes:true,attributeFilter:['data-play-mode']});
    }
    const bind=(key,node)=>{node.dataset[type+'Pane']=key;node.id=viewId(key);node.tabIndex=-1;node.hidden=true;screens.set(key,node);shell.append(node);};
    function show(key,focus){
      if(!screens.has(key)||buttons.get(key).hidden)return false;
      active=key;frame.dataset[type+'View']=key;
      for(const [id,screen] of screens){screen.hidden=id!==key;buttons.get(id).setAttribute('aria-pressed',String(id===key));}
      if(focus){const screen=screens.get(key);screen.focus({preventScroll:true});nav.scrollIntoView({block:'start',behavior:'instant'});}
      return true;
    }
    function progress(hour){
      const finished=!hour?.stage;
      buttons.get('resolver').hidden=finished;buttons.get('desenlace').hidden=!finished;
      status.replaceChildren(document.createTextNode(finished?'Investigación completada':'Etapa '+(hour.current+1)+' de '+hour.stages.length),save);
    }
    return {shell,bind,show,progress,enter,destroy(){cancelEntry();entryObserver?.disconnect();},get active(){return active;},
      writing(){if(!pending)failed=false;pending++;save.textContent='Guardando…';},
      written(ok){failed ||= ok===false;pending=Math.max(0,pending-1);save.textContent=pending?'Guardando…':failed?'Última acción sin confirmar':ok===null?'Respuesta comprobada':'Progreso guardado';}};
  }
  function hotelNavigation(frame,onSelect){return panelNavigation(frame,onSelect);}
  function caseNavigation(frame,onSelect,options){
    frame.dataset.caseUi='true';
    const scenes=caseScene(frame,options),navigation=panelNavigation(frame,onSelect,options);
    navigation.bind('escenario',scenes.node);
    const progress=navigation.progress,destroy=navigation.destroy;
    navigation.progress=hour=>{progress(hour);scenes.update(hour);};
    navigation.destroy=()=>{scenes.destroy();destroy();};
    return navigation;
  }
  window.AventuraEscena=Object.freeze({mount,mountExplorer,challengeHeader,hotelNavigation,caseNavigation});
})();
