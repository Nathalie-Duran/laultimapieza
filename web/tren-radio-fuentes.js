(() => {
  'use strict';
  function node(tag, cls, text) {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!=null)n.textContent=text;
    return n;
  }
  function pick(label,run) {
    const b=node('button','trf-tab',label);b.type='button';b.addEventListener('click',run);return b;
  }
  function match(body,spec) {
    return spec.flatMap(([title,re])=>{
      const excerpt=body.match(re)?.[1];
      return excerpt?[[title,excerpt.trim()]]:[];
    });
  }
  function sentences(body,labels) {
    const text=body.replace(/^[«“]|[»”]$/g,'').match(/[^.!?]+(?:[.!?]+|$)/g)||[];
    return text.map((part,i)=>[labels[i]||'Apunte '+(i+1),part.trim()]);
  }
  function lines(body){
    return body.split(/\r?\n/).filter(Boolean);
  }
  const labels={
    voz:['El sobre del recetario','Levanta una esquina para ver qué guardó la madre.','sobre'],
    kiosco:['Hemeroteca del barrio','Pon un recorte bajo la lupa.','recorte'],
    voces:['Dos voces en la estación','Sintoniza uno de los testimonios.','voces'],
    apuntes:['Mesa de restauración','Alterna la copia y el espejo. Observa qué se invierte en cada uno.','espejo'],
    tiempos:['Tablón de transbordos','Sigue un tramo del trayecto para consultar su duración.','trayecto'],
    tiquet:['Billete anotado','Gira el billete para comparar el recuerdo y la nota de ajuste.','billete'],
    limites:['Álbum de la línea','Abre una casilla o da la vuelta a la ficha.','album'],
    dueto:['El intercambio de notas','Desdobla la nota de cada viajero.','notas'],
    ensayos:['Catálogo de efectos','Extrae un cartucho y lee sus marcas.','bobina'],
    vivas:['Monitor de escucha','Alterna los canales y compara la voz con su sonido de fondo.','monitor'],
    boletin:['Mesa de datación','Coteja los criterios de archivo antes de asignar una fecha.','archivo'],
    guion:['Parte de montaje','Levanta cada solapa del parte para comprobar las instrucciones de emisión.','guion'],
    cortes:['Estuche de canutillos','Extrae una tira para ver su duración y su función.','bobina'],
    jefa:['Mesa de continuidad','Recorre las marcas de la locutora en orden de emisión.','emision'],
    'final-a':['Escucha de la línea A','Acerca el monitor a cada voz y al ambiente de fondo.','monitor'],
    'final-b':['Tarjeta de dedicatoria','Lee el anverso y levanta el borde con las condiciones de entrega.','dedicatoria']
  };
  function slots(item) {
    const s=item.body;
    switch(item.id){
      case 'voz':return match(s,[
        ['Recuerdo del recetario',/«(Era la noche[^.]+\. Compré[^.]+\.)/],
        ['Marca del pliegue',/(Al doblar[^»]+)/],
        ['Remite',/(No puso[^.]+\.)/]
      ]);
      case 'kiosco':return match(s,[
        ['Apertura del puesto',/(El puesto[^.]+\.)/],['Cambio de imprenta',/(La nueva imprenta[^.]+\.)/],['Tinta anterior',/(Antes del cambio[^.]+\.)/]
      ]);
      case 'voces':return match(s,[['Florista',/Florista:\s*«([^»]+)»/],['Revisora',/Revisora:\s*«([^»]+)»/] ]);
      case 'apuntes':return match(s,[
        ['Voltear toda la copia',/(Una copia[^.]+\.)/],['Observar el espejo',/(Un espejo[\s\S]*?las nueve\.)/],['Horario del puesto',/(El puesto[^.]+\.)/]
      ]);
      case 'tiempos':return lines(s).flatMap(line=>line.match(/[^.]+(?:\.|$)/g)||[]).map((part,i)=>[
        ['Central → lanzadera','Lanzadera → torno','Torno → reloj','Reloj → asiento','Río → Central','Lanzadera de vuelta'][i]||'Otro tramo',part.trim()
      ]);
      case 'tiquet':return match(s,[['Anotación del viajero',/«([^»]+)»/],['Ajuste de relojes',/»\.\s*([\s\S]+)/]]);
      case 'limites':return sentences(s,['Primera casilla','Segunda casilla','Reverso','Margen']);
      case 'dueto':return [...s.matchAll(/«([^»]+)»/g)].map((m,i)=>['Nota '+(i+1),m[1]]);
      case 'ensayos':
      case 'cortes':return lines(s).map(row=>row.split('|').map(x=>x.trim())).map(parts=>[parts.shift(),parts.join(' · ')]);
      case 'vivas':return match(s,[['Línea A',/A:\s*([\s\S]*?)\s+B:/],['Línea B',/B:\s*([\s\S]+)/]]);
      case 'boletin':return match(s,[
        ['Colecciones',/(Las dos colecciones[^.]+\.)/],['Criterio de fecha',/(El archivo[^;]+)/],['Exclusión del lector C',/;\s*([\s\S]+)$/]
      ]);
      case 'guion':return match(s,[
        ['Toma de trabajo',/«([^»]+)»/],['Marcas de la cinta',/(La prueba compartida[^.]+\.)/],
        ['Voces privadas',/(Para la copia pública[^.]+\.)/],['Señales autorizadas',/(Conservad[^.]+\.)/]
      ]);
      case 'jefa':return sentences(s,['Confirmación','Pausas','Dos cortes','Última consonante']);
      case 'final-a':return match(s,[
        ['Voz cercana',/Un hombre:\s*«([^»]+)»/],['Voz distante',/Una voz de niña, más lejos:\s*«([^»]+)»/],['Sonido de fondo',/(Al fondo[^.]+\.)/]
      ]);
      case 'final-b':return [...s.matchAll(/«([^»]+)»/g)].map((m,i)=>[i?'Condiciones de entrega':'Anverso de la dedicatoria',m[1]]);
      default:return [];
    }
  }
  function clock() {
    const face=node('span','trf-clock');
    face.setAttribute('aria-hidden','true');
    for(const [i,n] of ['12','3','6','9'].entries()){
      const number=node('i','trf-hour trf-h'+i,n);face.append(number);
    }
    face.append(node('i','trf-hand'));return face;
  }
  function graphic(kind,pages,field){
    const panel=node('div','trf-figure trf-'+kind);
    panel.setAttribute('aria-hidden','true');
    if(kind==='espejo'){
      const paper=node('span','trf-print'),glass=node('span','trf-glass');
      paper.append(node('b','','BORDE'),clock());
      glass.append(node('b','','REFLEJO'),clock());
      panel.append(paper,glass);
    }else if(kind==='trayecto'){
      for(const p of pages){const stop=node('span','trf-stop');stop.append(node('i'),node('b','',p[0]));panel.append(stop);}
    }else if(['monitor','voces','emision','archivo','guion','bobina'].includes(kind)){
      panel.append(node('i','trf-reel'),node('span','trf-scale'),node('i','trf-reel'));
      const readout=node('b','trf-readout');panel.append(readout);
    }else{
      const paper=node('span','trf-paper');
      paper.append(node('i','trf-mark'),node('b','trf-paper-name'));
      panel.append(paper);
    }
    field.append(panel);
    return i=>{
      panel.dataset.face=String(i);
      for(const [j,stop] of [...panel.querySelectorAll('.trf-stop')].entries())stop.classList.toggle('trf-on',i===j);
      for(const name of panel.querySelectorAll('.trf-paper-name,.trf-readout'))name.textContent=pages[i][0];
    };
  }
  function instrument(item,caseId) {
    const info=labels[item.id];if(!info||typeof item.body!=='string')return null;
    const pages=slots(item);if(!pages.length)return null;
    const [title,help,kind]=info;
    const wrap=node('section','trf-instrument');
    wrap.dataset.trfWorld=caseId===3?'tren':'radio';
    const heading=node('h5','',title),bar=node('div','trf-tabs'),result=node('p','trf-quote');
    bar.setAttribute('role','group');bar.setAttribute('aria-label',title);result.setAttribute('aria-live','polite');
    wrap.append(heading,node('p','trf-guide',help));
    const draw=graphic(kind,pages,wrap);
    let buttons;
    function display(i){
      buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
      draw(i);result.textContent=pages[i][1];
    }
    buttons=pages.map(([label],i)=>pick(label,()=>display(i)));
    bar.append(...buttons);wrap.append(bar,result);display(0);
    return wrap;
  }
  function addSources({caseId,shelf,stage}) {
    for(const card of shelf.querySelectorAll('[data-material]')){
      if(card.querySelector('.tr-inspector,.trf-instrument'))continue;
      const item=stage.materials.find(m=>m.id===card.dataset.material);
      if(!item)continue;
      const reader=instrument(item,caseId);
      if(!reader)continue;
      const summary=card.querySelector('summary');
      if(!summary)continue;
      const scene=card.querySelector(':scope > .tr-object-photo');
      const original=node('details','trf-source');
      const contents=[...card.children].filter(n=>n!==scene && n!==summary);
      original.append(node('summary','','Consultar la fuente íntegra'),...contents);
      card.append(reader,original);
    }
  }
  window.CompletarFuentesDeCaso ||= {};
  for(const id of [3,4])window.CompletarFuentesDeCaso[id]=addSources;
})();
