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
    photo.src=options.image;photo.alt=options.alt||options.place||'Escenario del caso';
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
    const mesaHome=el('div','ae-mesa-home');
    if(shared){mesaHome.append(mesaHost);caption.replaceChildren(place);host.replaceChildren(toolbar,heading,stage,party,setup,mesaHome,instrument);}
    else host.replaceChildren(toolbar,heading,stage,party,setup,objective,tools,instrument);
    if(story.intro||story.question)host.append(briefing);
    let lastMode,signature,currentHour,light=false,lastPoint,secondaryPanel=null,sceneContext={};
    host.addEventListener('click',event=>{const point=event.target.closest?.('button');if(point&&host.contains(point))lastPoint=point;},true);
    const back=button('Volver al escenario',()=>{
      actions('scene');
      const point=lastPoint?.isConnected&&host.contains(lastPoint)&&!lastPoint.closest('details:not([open])')?lastPoint:markers.querySelector('button');
      point?.focus({preventScroll:true});(point||stage).scrollIntoView({block:'center'});
    },'ae-back');
    function returnFrom(target){
      if(!target)return;
      if(shared){
        secondaryPanel=target.closest?.('.md-game-side,.vd-game,.md-game-help,.vd-help,.md-game-end,.vd-ending,.vhour-hotel-panel')||null;
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
      const waiting=sideOpen&&frame.dataset.playMode==='pending';
      const ficha=sideOpen?window.RetosTemporada?.ficha(options.id):null;
      const headerTitle=waiting&&ficha?ficha.title:story.title;
      if(caseTitle.textContent!==headerTitle)caseTitle.textContent=headerTitle;
      const context=waiting?'Reto de aventura · '+ancestry:ancestry;
      if(contextLabel.textContent!==context)contextLabel.textContent=context;
      const section=frame.dataset.playMode==='pending'?null:secondaryPanel;
      if(!section){
        if(mesaHost.parentElement!==mesaHome)mesaHome.append(mesaHost);
        shared.update(waiting?{...sceneContext,objective:'Elige cómo jugar para abrir el reto.',help:{context:'reto',text:ficha?.action||''}}:sceneContext);return;
      }
      if(mesaHost.parentElement!==section){
        const hero=section.querySelector('.reto-cabecera');
        if(hero && hero.parentElement===section)section.insertBefore(mesaHost,hero.nextSibling);
        else section.prepend(mesaHost);
      }
      const data=read(),base={...sceneContext,tools:[],objective:'',next:null};
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
        shared.update({...base,progress:'Consulta de pistas'});
      }else if(section.matches('.vhour-hotel-panel')){
        shared.update({...base,progress:'Hotel Medianoche',objective:'Examina el hotel y contrasta las pruebas con los testimonios.'});
      }else shared.update({...base,progress:data.progress?.choice?'Desenlace guardado':sceneContext.progress,objective:currentHour?.stage?'Termina las etapas de la investigación para abrir el desenlace.':''});
    }
    function marker(text,name,info,slot){
      const control=button('',()=>actions(name,info),'ae-marker');
      control.dataset.action=name;
      control.style.setProperty('--x',points[slot][0]+'%');control.style.setProperty('--y',points[slot][1]+'%');
      const icon=el('span','ae-glyph',slot===0?style.symbol:['','⌕','◈','↗'][slot]);icon.setAttribute('aria-hidden','true');
      control.append(icon,el('span','ae-marker-label',text));return control;
    }
    function update(hour){
      if(hour)currentHour=hour;
      const data=read(),state=currentHour||data.hour;
      if(!state)return;
      const mode=frame.dataset.playMode||'pending',paper=frame.dataset.playPaper;
      const filter=paper==='A'||paper==='B'?paper:null;
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
      const visible=(phase?.materials||[]).filter(item=>!filter||!item.role||item.role==='AB'||item.role===filter||item.role===(filter==='A'?1:2));
      const next=JSON.stringify([state.current,phase?.title,mode,filter,visible.map(item=>[item.id,item.label]),data.progress?.choice,data.progress?.deduced]);
      if(next===signature)return;
      signature=next;markers.replaceChildren();instrumentBody.replaceChildren();
      const total=state.stages?.length||0;
      progress.textContent=phase?'Etapa '+(state.current+1)+' de '+total:'Investigación completada';
      place.textContent=phase?.place||options.place||phase?.title||story.title;
      goalLabel.textContent=phase?.title||'Objetivo actual';
      goal.textContent=phase?(phase.brief===phase.task?'':phase.brief||''):data.progress?.choice?'Releer el desenlace guardado.':data.progress?.deduced?'Decidir cómo cerrar la historia.':'Contrastar la deducción final.';
      goal.hidden=!goal.textContent;
      if(shared){
        const ready=mode!=='pending';
        const step=phase?[progress.textContent,phase.title].filter(Boolean).join(' · '):progress.textContent;
        sceneContext={
          progress:ready?step:'',
          objective:ready?goal.textContent:'Elige la modalidad para abrir el escenario.',
          help:{context:together?'duo':'temporada',text:'Los puntos del escenario abren el lugar, sus pruebas y la decisión de esta etapa.',
            steps:['Examina las pruebas de tu carpeta.','Reúne los objetos en el inventario y contrasta lo que has observado.','Resuelve la etapa para abrir la siguiente estancia.']},
          tools:ready?[{id:'bag',label:style.bag,run:()=>actions('bag')},{id:'evidence',label:'Evidencias',run:()=>actions('evidence')}]:[]
        };
        syncMesa();
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
          light=!light;stage.dataset.lit=String(light);toggle.setAttribute('aria-pressed',String(light));
          toggle.textContent=light?'Apagar el farol':'Encender el farol';
        },'ae-action ae-lantern');
        toggle.textContent=light?'Apagar el farol':'Encender el farol';toggle.setAttribute('aria-pressed',String(light));
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
    update();
    const explorer=mountExplorer(host,frame,options.id);
    if(world==='umbravia'){
      function lightAt(x,y){stage.style.setProperty('--light-x',x+'%');stage.style.setProperty('--light-y',y+'%');}
      stage.addEventListener('pointermove',event=>{if(!light)return;const box=stage.getBoundingClientRect();if(box.width&&box.height)lightAt((event.clientX-box.x)*100/box.width,(event.clientY-box.y)*100/box.height);});
      markers.addEventListener('focusin',event=>{if(!light)return;const target=event.target.closest('button');if(!target)return;const box=stage.getBoundingClientRect(),spot=target.getBoundingClientRect();
        if(box.width&&box.height)lightAt((spot.x+spot.width/2-box.x)*100/box.width,(spot.y+spot.height/2-box.y)*100/box.height);});
    }
    const observer=new MutationObserver(()=>update());
    observer.observe(frame,{attributes:true,attributeFilter:['data-play-mode','data-play-paper']});
    return {update,returnFrom,focus(){markers.querySelector('button')?.focus({preventScroll:true});host.scrollIntoView({block:'start'});},destroy(){observer.disconnect();explorer.destroy();shared?.destroy();}};
  }
  window.AventuraEscena=Object.freeze({mount,mountExplorer,challengeHeader});
})();
