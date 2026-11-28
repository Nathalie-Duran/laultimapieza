(function(root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const illustrations = {
    'archivo-ausencias':'archivo-ausencias.jpg', 'ciudad-invisible':'partida-barrio-archivo.webp',
    'frecuencia-17':'frecuencia-17.jpg', 'habitacion-309':'habitacion-309.jpg',
    'jardin-invierno':'jardin-invierno.jpg', 'marea-quieta':'marea-quieta.jpg',
    'mesa-13':'mesa-13.jpg', 'retrato-prestado':'retrato-prestado.jpg',
    'tren-detenido':'tren-detenido.jpg', 'ultima-funcion':'ultima-funcion.jpg',
    'ultima-invitacion':'ultima-invitacion.jpg', 'ultimo-coro':'ultimo-coro.jpg'
  };
  const paragraphs = lines => (lines || []).map(line => '<p>'+escape(line)+'</p>').join('');

  function evidence(entry, role) {
    if (!entry) return '';
    return `<section class="evidence pe-role" data-role="${escape(role)}">
      <div class="pe-meta">Tu expediente · ${escape(role)}</div>
      <h3>${escape(entry.title)}</h3><p>${escape(entry.text)}</p></section>`;
  }

  function reading(story, node, role, solo, first) {
    const introduction = first && story.introduction?.length
      ? `<details class="pe-context"><summary>Quiénes sois en esta historia</summary>${paragraphs(story.introduction)}</details>`
      : '';
    const otherRole = role === 'B' ? 'A' : 'B';
    const otherEvidence = solo && node.evidence?.[otherRole]
      ? `<details class="pe-alternate"><summary>Consultar también el expediente ${otherRole}</summary>${evidence(node.evidence[otherRole],otherRole)}</details>`
      : '';
    return `<div class="pe-reading">${paragraphs(node.text)}</div>
      ${evidence(node.evidence?.[role],role)}${otherEvidence}${introduction}`;
  }

  function endReading(session, story, ending) {
    const explanation = session.investigation?.solvedAt || story.season !== 1
      ? `<section class="evidence pe-role"><h3>Así encajaban las piezas.</h3><p>${escape(ending.explanation)}</p></section>`
      : '<p class="investigation-state">La explicación completa se abre al contrastar tu enigma. Tus decisiones narrativas ya están guardadas.</p>';
    let coda;
    if (story.season === 1) {
      coda = `<p>${escape(ending.professionalCoda)}</p>`;
      if (ending.romanticCoda && ending.romanticCoda !== ending.professionalCoda) {
        coda += `<details class="optional-coda pe-alternate"><summary>Un momento más entre los dos</summary><p>${escape(ending.romanticCoda)}</p><p class="micro">Una escena opcional entre los personajes. Puedes leerla sin cambiar vuestro final ni la puntuación.</p></details>`;
      }
    } else {
      const romantic = session.history.some(turn => (turn.effects?.romanticismo || 0) > 0);
      coda = `<p>${escape(romantic ? ending.romanticCoda : ending.professionalCoda)}</p>`;
    }
    return `<div class="pe-reading">${paragraphs(ending.text)}</div>${explanation}
      <div class="pe-reading"><p class="ending-reflection">${escape(ending.reflection)}</p>${coda}</div>`;
  }

  function chapter(session, story, node, ending, role, first) {
    const meta = ending ? ['Desenlace', ending.subtitle] : [node.chapter,story.roles?.[role]?.name || 'Investigador '+role];
    const title = ending ? ending.title : node.title;
    const illustration = illustrations[story.id];
    const image = illustration ? `<img class="pe-photo" src="/${illustration}" alt="" decoding="async">` : '';
    const body = ending ? endReading(session,story,ending) : reading(story,node,role,session.mode === 'solo',first);
    return `<article id="game-reading" class="chapter pe-dossier${ending ? ' pe-ending' : ''}" tabindex="-1" aria-labelledby="pe-chapter-title">
      <header class="pe-cover${image ? '' : ' pe-no-photo'}"><div class="pe-title"><span class="pe-meta">${meta.filter(Boolean).map(escape).join(' · ')}</span>
      <h1 id="pe-chapter-title">${escape(title)}</h1></div>${image}</header>
      <div class="pe-body">${body}</div></article>`;
  }

  function shortcuts(session, ending, review, hasMedia) {
    const items = [['game-reading',ending ? 'Leer desenlace' : 'Leer historia']];
    if (hasMedia) items.push(['media-desk-title','Ver pistas']);
    if (ending) items.push(['game-epilogue','Ver epílogo']);
    else if (review) items.push(['game-choices','Revisar decisión']);
    else if (session.status === 'waiting') items.push(['game-team','Ver equipo']);
    else items.push(['game-choices','Elegir camino']);
    return `<nav class="game-shortcuts pe-steps" aria-label="Acciones de la escena">${items.map(([target,label],i) =>
      `<button type="button" data-action="game-section" data-target="${target}"><span class="pe-step-number" aria-hidden="true">${i+1}</span><span>${label}</span></button>`
    ).join('')}</nav>`;
  }
  const objectives={
    'ultima-funcion':'Relaciona el reloj de la cámara con el de sala y averigua quién pudo entrar en utilería.',
    'archivo-ausencias':'Compara el folio en papel con el historial digital para reconocer la copia fiel.',
    'marea-quieta':'Encuentra los diez minutos en que coinciden el paso habilitado, la archivera y el carro.',
    'frecuencia-17':'Reconstruye la cadena de tarjetas de la emisora para identificar su canal.',
    'jardin-invierno':'Contrasta las horas de las mismas temperaturas en el termómetro y en el sensor.',
    'retrato-prestado':'Identifica la tabla custodiada en el armario a partir de las marcas del reverso.',
    'mesa-13':'Reconstruye la distribución definitiva de la mesa después del cambio de plazas.',
    'tren-detenido':'Usa el reloj del vagón y el horario de marcha para localizar la parada del depósito.',
    'ciudad-invisible':'Sigue los giros desde el punto de partida y localiza el destino en la cuadrícula.',
    'ultimo-coro':'Enlaza el comienzo de cada toma con el final de la anterior para reconstruir la cinta.',
    'ultima-invitacion':'Relaciona las letras del catálogo con las doce casillas y lee el sello.'
  };

  let mesa;
  function clearMesa(){mesa?.destroy();mesa=null;}
  function mountMesa(scope,session,story,index,uid){
    if(!root.MesaDeJuego||!scope||!session||story?.season!==1)return;
    const coop=story.id==='cartas-medianoche',workspace=scope.querySelector('.coop-workspace');
    const previous=coop?workspace?.querySelector('.case-compass'):scope.querySelector('.game-shortcuts');
    if(!previous)return;
    const host=document.createElement('div');host.className='pe-game-tools';previous.before(host);
    const history=session.history,review=index<history.length,waiting=session.status==='waiting';
    const final=session.status==='finished',solved=Boolean(session.investigation?.solvedAt);
    const role=session.members.find(m=>m.userId===uid)?.role||'A';
    const stages=story.puzzle?.stages||[],active=stages.find(s=>!session.investigation?.stages?.[s.id]?.solvedAt);
    const pinnedVote=session.votes?.some(v=>v.userId===uid);
    function go(target){
      const el=scope.querySelector(target);
      if(!el)return;
      for(let parent=el.parentElement;parent&&parent!==scope;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      if(!el.hasAttribute('tabindex')&&!el.matches('button,a,input,select'))el.tabIndex=-1;
      el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});
    }
    function tab(name,target){
      workspace?.querySelector('.case-tabs [data-coop-tab="'+name+'"]')?.click();
      go(target||'[data-coop-panel="'+name+'"]');
    }
    const at=(selector,label)=>({label,run:()=>go(selector)});
    const view=(name,label)=>({label,run:()=>tab(name)});
    const puzzleHere=coop?active&&active.requiredDecisions<=history.length:scope.querySelector('#puzzle-form');
    let objective=coop?active?.title:objectives[story.id];
    let next,tools=[];
    if(review){
      objective='Estás releyendo una decisión guardada. Vuelve al punto actual para continuar la partida.';
      const resume=scope.querySelector('[data-action="scene-view"][data-index="'+history.length+'"]');
      if(resume)next={label:'Volver a mi avance',run:()=>resume.click()};
    }else if(waiting){
      objective='Abre las opciones del equipo y comparte la invitación con tu compañero.';
      next=coop?{label:'Abrir el equipo',run:()=>{tab('historia');go('#game-team');}}:at('#game-team','Abrir el equipo');
    }else if(final&&solved){
      objective='El relato y el enigma están completos. Ya puedes leer el epílogo.';
      next=coop?view('historia','Leer el desenlace'):at('#game-epilogue','Leer el epílogo');
    }else if(final){
      objective=coop?active?.title:objectives[story.id];
      next=coop?view('resolver','Abrir el enigma pendiente'):at('#puzzle-title','Abrir el enigma pendiente');
    }else if(coop&&puzzleHere){
      next=view('pistas','Examinar las pistas del reto');
    }else{
      if(solved||coop)objective='Contrasta los dos caminos de esta escena y decide cómo continúa la historia.';
      if(pinnedVote)objective='Tu voto está registrado. Podéis cambiar de opción hasta coincidir.';
      next=coop?{label:'Comparar los caminos',run:()=>{tab('historia');go('#game-choices');}}:at('#game-choices','Comparar los caminos');
    }
    if(!coop){
      tools=[at('#game-reading',final&&!review?'Desenlace':'Leer la escena')];
      if(scope.querySelector('#media-desk-title'))tools.push(at('#media-desk-title','Documentos y pistas'));
      if(!review&&!final&&puzzleHere)tools.push(at('#puzzle-title','Contrastar el enigma'));
      tools=tools.map((tool,i)=>({...tool,id:String(i)}));
    }
    const directions=session.mode==='solo'?'En solitario puedes consultar los dos expedientes.':
      'Juegas con el expediente '+role+'. Cuenta a tu compañero lo que observas y escuchad lo que aporta el otro papel. Los dos debéis coincidir para avanzar.';
    const progress=coop?((stages.filter(s=>session.investigation?.stages?.[s.id]?.solvedAt).length)+' de '+stages.length+' retos resueltos · '+history.length+' de '+story.decisionCount+' decisiones'):
      history.length+' de '+story.decisionCount+' decisiones';
    mesa=root.MesaDeJuego.mount(host,{family:'clasico',title:story.title,objective,progress,next,tools,
      help:{context:'clasico',text:directions,steps:coop?['Lee la escena en Historia.','Consulta las pistas del reto y prueba tu deducción en Resolver.','Cuando se abra una decisión, vuelve a Historia para elegir.']:
        ['Lee la escena y compara los documentos disponibles.','Elige uno de los dos caminos. Puedes consultar después las decisiones guardadas.','Contrasta el enigma con las pruebas para completar el expediente.']}});
    if(coop){
      const skills=previous.querySelector('.coop-skill')?.parentElement;
      if(skills){skills.className='pe-classic-skills';host.after(skills);}
    }
    previous.remove();
  }
  root.EscenaClasica = {chapter,shortcuts,mountMesa,clearMesa};
})(window);
