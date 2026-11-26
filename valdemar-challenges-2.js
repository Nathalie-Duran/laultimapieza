(function () {
  'use strict';

  function tag(name, text, className) {
    const element = document.createElement(name);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function control(label, action, className) {
    const element = tag('button', label, className);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  }

  function gamePanel(host, instructions) {
    const section = tag('div', undefined, 'juego');
    const body = tag('div');
    const status = tag('p', '', 'estado');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.append(tag('p', instructions), body, status);
    host.replaceChildren(section);
    return { body, status };
  }

  function winOnce(callback) {
    let awarded = false;
    return () => {
      if (awarded) return;
      awarded = true;
      callback();
    };
  }

  function tidalBridge(host, award) {
    const finish = winOnce(award);
    const {body, status} = gamePanel(host,
      'El ferry llega en 15 minutos de juego. La pasarela admite a una o dos personas con el único farol. Un cruce dura lo que tarde la persona más lenta. Lleva a las cuatro al embarcadero. Puedes pensar sin límite de tiempo y deshacer cualquier travesía.');
    const crew = [
      { name: 'Ema, la cartera', time: 1 },
      { name: 'Leo, el farero', time: 2 },
      { name: 'Vera, la ceramista', time: 5 },
      { name: 'Pau, el relojero', time: 8 }
    ];
    let positions = [0,0,0,0], light = 0, elapsed = 0;
    let chosen = new Set();
    const history = [];
    function paint() {
      const landed = positions.every(position => position === 1);
      const view = tag('div');
      view.append(tag('p', 'Farol en '+(light ? 'el embarcadero' : 'el pueblo')+' · '+elapsed+' de 15 min empleados.'));
      for (const side of [0,1]) {
        const group = tag('fieldset');
        group.append(tag('legend', side ? 'Embarcadero' : 'Pueblo'));
        const row = tag('div', undefined, 'opciones');
        crew.forEach((person, index) => {
          if(positions[index] !== side) return;
          const label = person.name+' · '+person.time+' min';
          if(side !== light || landed) { row.append(tag('span', label, 'pieza')); return; }
          const choose = control(label, () => {
            if(chosen.has(index)) chosen.delete(index);
            else if(chosen.size < 2) chosen.add(index);
            else { status.textContent = 'Ya has elegido a dos. Quita a una persona antes de añadir otra.'; return; }
            choose.setAttribute('aria-pressed', String(chosen.has(index)));
            status.textContent = chosen.size ? 'Con el farol: '+[...chosen].map(i => crew[i].name.split(',')[0]).join(' y ')+'.' : 'Elige quién lleva el farol.';
          }, 'pieza');
          choose.setAttribute('aria-pressed', String(chosen.has(index)));
          row.append(choose);
        });
        if(!row.childElementCount) row.append(tag('span','Todavía no hay nadie.'));
        group.append(row);
        view.append(group);
      }
      const actions = tag('div', undefined, 'opciones');
      if(!landed) actions.append(control(light ? 'Volver al pueblo' : 'Cruzar al embarcadero', () => {
        if(!chosen.size){ status.textContent = 'Elige al menos una persona en la orilla del farol.'; return; }
        const cost = Math.max(...[...chosen].map(i => crew[i].time));
        if(elapsed + cost > 15){ status.textContent = 'Este cruce acabaría en el minuto '+(elapsed+cost)+'. Deshaz una travesía para probar otra combinación.'; return; }
        history.push({positions:[...positions],light,elapsed});
        light = 1-light; elapsed += cost;
        chosen.forEach(i => { positions[i] = light; });
        chosen.clear();
        const complete = positions.every(position => position === 1);
        status.textContent = complete ? '¡Los cuatro están en el embarcadero! El ferry los espera.' : 'Cruce completado en '+cost+' min. Quedan '+(15-elapsed)+'.';
        paint();
        if(complete) finish();
      }));
      if(history.length) actions.append(control('Deshacer último cruce', () => {
        ({positions, light, elapsed} = history.pop());
        chosen.clear(); status.textContent = 'Has regresado a la travesía anterior.'; paint();
      }, 'secundario'));
      view.append(actions);
      body.replaceChildren(view);
    }
    paint();
  }

  const auctionLots = [
    {label:'Campanilla del tranvía', category:'Sonido', range:[3,5], rival:3, detail:'El coleccionista del tranvía ha anotado un tope de 3 fichas.'},
    {label:'Postal de la modista', category:'Firma', range:[2,4], rival:3, detail:'El museo textil ha reservado 3 fichas para la firma de Adela.'},
    {label:'Juguete de hojalata de 1967', category:'Antigüedad', range:[3,5], rival:4, detail:'El hijo del fabricante ha traído 4 fichas para esta pieza.'},
    {label:'Diapasón del afinador', category:'Sonido', range:[1,2], rival:1, detail:'La academia de música dispone de 1 ficha para el diapasón.'},
    {label:'Plano de la dársena de 1951', category:'Antigüedad', range:[2,3], rival:2, detail:'El archivo cartográfico tiene 2 fichas libres para el plano.'},
    {label:'Programa firmado de la verbena', category:'Firma', range:[4,6], rival:5, detail:'La familia de la cantante ofrece hasta 5 fichas.'}
  ];
  const categories = ['Sonido', 'Firma', 'Antigüedad'];
  function lostAuction(host, award) {
    const finish = winOnce(award);
    const {body, status} = gamePanel(host,
      'Monta una exposición con tres piezas distintas: una que suene, una firmada y una anterior a 1970. Dispones de 10 fichas y dos inspecciones para leer el tope exacto de una puja rival. El empate favorece al rival. Solo pagas si ganas y pagas exactamente lo que ofreces.');
    let index, budget, passes, inspected, collection, history;
    function reset(){
      index=0; budget=10; passes=2; inspected=new Set(); collection=new Set(); history=[];
      status.textContent='Se abre la sala. Puedes consultar los lotes de toda la sesión.'; paint();
    }
    function advance(offer){
      const lot = auctionLots[index];
      let feedback;
      if(offer === null) feedback='Pasaste el turno.';
      else if(offer > lot.rival){ budget-=offer; collection.add(lot.category); feedback='Adjudicado por '+offer+' fichas.'; }
      else feedback='El rival se lo lleva. Conservas tus fichas.';
      history.push(lot.label+' · '+feedback+' El rival ofrecía '+lot.rival+'.');
      index++;
      const won = categories.every(type => collection.has(type));
      if(won) status.textContent='Las tres vitrinas están completas. Sobran '+budget+' fichas.';
      else if(index === auctionLots.length) status.textContent='Cerró la subasta. Faltan: '+categories.filter(type => !collection.has(type)).join(', ')+'. Puedes volver a pujar desde el principio.';
      else status.textContent=history[history.length-1];
      paint(); if(won) finish();
    }
    function paint(){
      const view=tag('div');
      view.append(tag('p','Caja: '+budget+' fichas · Inspecciones: '+passes+' · Vitrinas: '+(Array.from(collection).join(', ')||'vacías')+'.'));
      const catalogue=tag('details');
      catalogue.append(tag('summary','Catálogo completo y estimaciones'));
      const list=tag('ol');
      auctionLots.forEach(l=>list.append(tag('li',l.label+' · '+l.category+' · tope rival estimado de '+l.range[0]+' a '+l.range[1]+'.')));
      catalogue.append(list); view.append(catalogue);
      if(history.length) {
        const record=tag('details'), log=tag('ol');
        record.append(tag('summary','Resultados de los lotes anteriores')); history.forEach(entry => log.append(tag('li',entry))); record.append(log); view.append(record);
      }
      if(index < auctionLots.length && collection.size !== categories.length){
        const lot=auctionLots[index];
        view.append(tag('h4','Lote '+(index+1)+' · '+lot.label),tag('p',lot.category+' · Tope rival estimado: '+lot.range.join(' a ')+' fichas.'));
        const actions=tag('div',undefined,'opciones');
        if(inspected.has(index))view.append(tag('p',lot.detail,'estado'));
        else if(passes>0) actions.append(control('Usar una inspección',()=>{passes--;inspected.add(index);status.textContent=lot.detail;paint();},'secundario'));
        const label=tag('label','Mi oferta en fichas '), select=tag('select');
        for(let n=1;n<=budget;n++){const option=tag('option',String(n));option.value=String(n);select.append(option);}
        label.append(select);
        if(budget>0)actions.append(label,control('Pujar por el lote',()=>advance(Number(select.value))));
        actions.append(control('Dejar pasar este lote',()=>advance(null),'secundario'));
        view.append(actions);
      }
      if(index > 0) view.append(control('Reiniciar la subasta',reset,'secundario'));
      body.replaceChildren(view);
    }
    reset();
  }

  const scenery = {
    Faro: '⚓', Lonja: '⚖', Teatro: '♫', Puente: '≋', Fuente: '♒', Estación: '◷'
  };
  const plates = [
    {id:'C', edges:['Puente','Teatro']}, {id:'F',edges:['Estación','Fuente']},
    {id:'A',edges:['Faro','Lonja']}, {id:'D',edges:['Lonja','Puente']},
    {id:'B',edges:['Lonja','Teatro']}, {id:'E',edges:['Lonja','Fuente']}
  ];
  function contactSheet(host, award){
    const finish=winOnce(award);
    const {body,status}=gamePanel(host,
      'Seis placas panorámicas se mezclaron en el revelado. Cada una muestra dos lugares. Colócalas como un paseo: el lugar de salida de una placa debe coincidir con el de entrada en la siguiente. Puedes dar la vuelta a cualquier placa.');
    let order=[], reversed=new Set();
    function edges(id){
      const sides=plates.find(p=>p.id===id).edges;
      return reversed.has(id)?[sides[1],sides[0]]:sides;
    }
    function inspect(){
      if(order.length!==6){status.textContent='Has colocado '+order.length+' de seis placas.';return;}
      const route=order.map(edges);
      if(route[0][0]!=='Faro'){status.textContent='La primera imagen debe entrar por el faro. Revisa su orientación.';return;}
      for(let n=1;n<route.length;n++)if(route[n][0]!==route[n-1][1]){status.textContent='Salto entre las placas '+n+' y '+(n+1)+': la primera termina en '+route[n-1][1].toLowerCase()+' y la siguiente empieza en '+route[n][0].toLowerCase()+'.';return;}
      if(route[5][1]!=='Estación'){status.textContent='La última placa debe terminar en la estación.';return;}
      const places=[route[0][0],...route.map(pair=>pair[1])];
      if(places.indexOf('Teatro')>places.indexOf('Puente')){status.textContent='La tira encaja, pero has llegado al puente antes de pasar por el teatro. Revisa la vuelta por la lonja.';return;}
      status.textContent='El paseo coincide con el cuaderno. Las seis placas forman una única panorámica.';finish();
    }
    function card(id,selected){
      const frame=tag('div',undefined,'pieza'), sides=edges(id);
      frame.append(tag('strong',selected ? 'Posición '+(order.indexOf(id)+1)+' · Placa '+id : 'Placa '+id));
      const panorama=tag('div');
      panorama.style.cssText='display:flex;margin:.45rem 0;gap:2px;color:#fff9e9;';
      for(const side of sides){
        const scene=tag('span');
        scene.style.cssText='flex:1;text-align:center;padding:.4rem .2rem;background:linear-gradient(155deg,#454d4c,#252c29);border:1px solid #8b826c;border-radius:3px;';
        const icon=tag('span',scenery[side]);
        icon.setAttribute('aria-hidden','true'); icon.style.cssText='display:block;font-size:1.6rem;line-height:1.2;';
        scene.append(icon,tag('small',side));panorama.append(scene);
      }
      frame.append(panorama);
      const actions=tag('div',undefined,'opciones');
      const rotate=control('Voltear '+id,()=>{if(reversed.has(id))reversed.delete(id);else reversed.add(id);status.textContent='Placa '+id+' volteada.';paint();},'secundario');
      actions.append(rotate);
      if(selected)actions.append(control('Retirar '+id,()=>{order=order.filter(x=>x!==id);status.textContent='Placa '+id+' devuelta a la mesa.';paint();},'secundario'));
      else actions.append(control('Añadir '+id,()=>{order.push(id);status.textContent='Placa '+id+' colocada en la posición '+order.length+'.';paint();}));
      frame.append(actions);return frame;
    }
    function paint(){
      const view=tag('div'), desk=tag('div',undefined,'tablero'), strip=tag('div',undefined,'tablero');
      for(const grid of [desk,strip]) grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.55rem;';
      view.append(tag('blockquote','«Salí del faro para coger el tren. Oí el ensayo del teatro antes de pisar el puente». — Cuaderno del fotógrafo'));
      plates.filter(p=>!order.includes(p.id)).forEach(p=>desk.append(card(p.id,false)));
      order.forEach(id=>strip.append(card(id,true)));
      if(desk.childElementCount)view.append(tag('h4','Mesa de placas'),desk);
      view.append(tag('h4','Tira de contacto · '+order.length+'/6'),strip);
      if(order.length){
        const opts=tag('div',undefined,'opciones');
        opts.append(control('Comprobar continuidad',inspect),control('Vaciar la tira',()=>{order=[];reversed=new Set();status.textContent='Las placas vuelven a la mesa.';paint();},'secundario'));
        view.append(opts);
      }
      body.replaceChildren(view);
    }
    paint();
  }

  const channels=[
    {cols:3, layout:['s','s','c','c','s','c','c','s','s'], rotations:[0,0,1,0,1,2,2,1,0], flowers:{1:'Violeta',4:'Dalia',7:'Lirio'}},
    {cols:4, layout:['c','c','c','c','s','s','s','s','c','c','c','s'], rotations:[1,3,1,0,1,0,0,1,1,2,0,0], flowers:{4:'Salvia',5:'Menta',6:'Melisa'}}
  ];
  const directionNames=['norte','este','sur','oeste'];
  const pipeSigns={s:['│','─'],c:['└','┌','┐','┘']};
  function paperGarden(host, award){
    const finish=winOnce(award);
    const {body,status}=gamePanel(host,
      'Restaura los dos riegos del vivero. Pulsa un tramo para girarlo un cuarto de vuelta. El agua entra por la izquierda de la primera casilla y debe pasar por los tres bancales con nombre, antes de salir por la derecha de la última casilla.');
    let level=0, rotations=[...channels[0].rotations], solved=false;
    function exits(i){
      const kind=channels[level].layout[i], r=rotations[i];
      return kind==='s' ? [r%2,r%2+2] : [r%4,(r+1)%4];
    }
    function trace(){
      const map=channels[level], visited=new Set();let pos=0, entry=3;
      while(!visited.has(pos)){
        const ends=exits(pos),name=map.flowers[pos]?' ('+map.flowers[pos]+')':'';
        if(!ends.includes(entry))return {ok:false,visited,message:'El agua intenta entrar en el tramo '+(pos+1)+name+' por el '+directionNames[entry]+'. Gira su canal o revisa el tramo anterior.'};
        visited.add(pos);
        const exit=ends.find(x=>x!==entry);
        if(pos===map.layout.length-1 && exit===1){
          const dry=Object.keys(map.flowers).filter(i=>!visited.has(Number(i))).map(i=>map.flowers[i]);
          return dry.length ? {ok:false,visited,message:'El agua salió, pero siguen secos estos bancales: '+dry.join(', ')+'.'} : {ok:true,visited};
        }
        const row=Math.floor(pos/map.cols), col=pos%map.cols, nr=row+[-1,0,1,0][exit], nc=col+[0,1,0,-1][exit];
        if(nr<0||nc<0||nr>=map.layout.length/map.cols||nc>=map.cols)return {ok:false,visited,message:'El agua se pierde por el borde '+directionNames[exit]+' del tramo '+(pos+1)+'.'};
        pos=nr*map.cols+nc;entry=(exit+2)%4;
      }
      return {ok:false,visited,message:'El riego da una vuelta cerrada. Necesita una salida.'};
    }
    function paint(wet=new Set()){
      const map=channels[level], view=tag('div'), grid=tag('div',undefined,'tablero');
      view.append(tag('h4',(level?'Huerto aromático':'Patio de flores')+' · '+(level+1)+'/2'),tag('p','Entrada desde el oeste al tramo 1. Salida hacia el este desde el tramo '+map.layout.length+'. Arriba es el norte.'));
      grid.style.cssText='display:grid;gap:.3rem;grid-template-columns:repeat('+map.cols+',minmax(0,1fr));max-width:29rem;';
      for(let i=0;i<map.layout.length;i++){
        const kind=map.layout[i], sign=pipeSigns[kind][rotations[i]%(kind==='s'?2:4)];
        const name=map.flowers[i]||'';
        const tile=control('',()=>{
          rotations[i]=(rotations[i]+1)%(kind==='s'?2:4);
          status.textContent='Tramo '+(i+1)+': '+exits(i).map(d=>directionNames[d]).join(' y ')+'.';
          paint(); body.querySelector('[data-pipe="'+i+'"]')?.focus();
        },'pieza');
        tile.dataset.pipe=String(i);
        tile.setAttribute('aria-label','Tramo '+(i+1)+(name?', '+name:'')+', '+exits(i).map(d=>directionNames[d]).join(' y ')+'. Girar');
        tile.style.cssText='display:grid;align-content:center;justify-items:center;padding:.15rem;min-width:0;min-height:3.8rem;'+(wet.has(i)?'box-shadow:inset 0 0 0 2px #65bfb1;':'');
        const glyph=tag('span',sign);glyph.style.cssText='font-family:monospace;font-size:1.7rem;line-height:1;';glyph.setAttribute('aria-hidden','true');
        const label=tag('small',(i+1)+(name?' · '+name:'')); label.style.cssText='font-size:.72rem;line-height:1.15;';
        tile.append(glyph,label);tile.disabled=solved;grid.append(tile);
      }
      view.append(grid);
      const opts=tag('div',undefined,'opciones');
      if(!solved)opts.append(control('Probar el riego',()=>{
        const result=trace();
        if(!result.ok){status.textContent=result.message;paint(result.visited);return;}
        solved=true;paint(result.visited);
        status.textContent=level ? 'Ambos jardines reciben agua. Las seis plantas están regadas.' : 'Los tres parterres han recibido agua. Se abre la compuerta del huerto aromático.';
        if(level===1)finish();
      }),control('Recolocar este jardín',()=>{rotations=[...map.rotations];status.textContent='Canales devueltos a su posición inicial.';paint();},'secundario'));
      if(solved&&level===0)opts.append(control('Abrir el huerto aromático',()=>{level=1;solved=false;rotations=[...channels[level].rotations];status.textContent='El segundo riego está listo para reparar.';paint();}));
      view.append(opts);body.replaceChildren(view);
    }
    paint();
  }

  Object.assign(window.Retos, {
    5:{title:'La pasarela de la marea',pitch:'El consejo ensaya el acceso al embarcadero para la próxima llegada del ferry. Cuatro viajeros tienen quince minutos y un solo farol para cruzar la pasarela. Decide quién lo lleva y quién vuelve a buscar al resto.',mount:tidalBridge},
    6:{title:'Tres vitrinas, diez fichas',pitch:'La sala organiza otra puja para montar una exposición. La caja de la exposición tiene diez fichas propias. Las tres que te confió Amalia quedan reservadas para su encargo. Consigue una pieza para cada vitrina.',mount:lostAuction},
    7:{title:'El paseo de las seis placas',pitch:'El fotoclub conserva, además de los negativos del rescate, una serie panorámica del paseo. Las seis placas han llegado sueltas al laboratorio. Usa los lugares de sus extremos para reconstruir el recorrido.',mount:contactSheet},
    8:{title:'Los canales del vivero',pitch:'En el vivero del jardín hay dos circuitos de riego por recomponer. Gira los tramos de acequia y sigue el agua hasta los tres bancales de cada circuito.',mount:paperGarden}
  });
})();
