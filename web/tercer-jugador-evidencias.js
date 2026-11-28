(() => {
  'use strict';
  const captions = {
    visual:'Lámina de observación', audio:'Grabación del archivo', ledger:'Hoja del registro',
    web:'Archivo de consulta', testimony:'Declaración', text:'Documento'
  };
  const vocab = [
    /bisagras?|ventanas?|zócalos?|cristal(?:es)?|muescas?|clavos?|marcos?|resguardos?|anillos?|filigranas?|gestos?|cámara/gi,
    /caballo|liebre|poste|pez|luna|anclajes?|motor|madera|risa|taquill\w*|lona|taller|regreso|maestro|billetes?/gi,
    /gasa|cabina|cuarto de costura|carro|zapato|abrigo|lámpara|manivela|hebilla|jabón|fotogramas?|g[aá]sa|empalmes?/gi,
    /cuño|trazo|fibra\w*|tinta|banda|sobre\w*|estafeta|capilla|fuente|mercado|boca|peana|cajetín|buzón|ranura/gi,
    /lámparas?|sombras?|postigo|galería|pila|canal|compuertas?|torno|pedal|tabla|chaqueta|refugio|lavadero/gi,
    /jueves|lluvia|viento|corte eléctrico|repetidor|Silvina|cabina|patio|empalme|ladrido|maestra|escuela|indicativo/gi,
    /casa azul|puente|almacén|fuente|patio|balcón|fachada|luz|reloj|ventana|flechas?|tarima|cable|madera/gi,
    /tren|señal|reloj|telégrafo|claro|silbato|campanillas?|carro|familia|vado|puente|vía|estación|Vivero|Tejo/gi,
    /manchas?|banco|hojas?|nervios?|tallo|macetas?|tiesto|grifo|lluvia|agua|puerta|etiqueta|apellido|tarjeta/gi,
    /esquila|badajo|martill\w*|labio|bronce|torre|plaza|reloj|reflector|compuerta|golpes?|escalera|fuente|toque/gi,
    /boca|agua|compuerta|telar|patio|cocina|golpe|ataque|silencio|picaduras?|cilindro|sobre|carrete|voz|relevo/gi,
    /silla|rostros?|abrigo|hojas?|custodia|registro|tránsito|recepción|relevo|traslado|cierre|sellos?|ojo|raya|pliego/gi
  ];
  function el(tag,text,cls) {
    const n=document.createElement(tag);
    if(text!=null)n.textContent=text;
    if(cls)n.className=cls;
    return n;
  }
  function control(text,fn,cls){
    const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;
  }
  const lines=body=>body.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  function excerpt(body) {
    return lines(body).flatMap(x=>x.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ«¿¡])|;\s+(?=\S)/u)).filter(Boolean);
  }
  function pinLabel(text,id,index){
    const time=text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/);
    if(time)return time[0];
    const keys=[...new Set(Array.from(text.matchAll(vocab[id-25]),m=>m[0].toLocaleLowerCase('es')))].slice(0,2);
    if(keys.length)return keys.join(' · ');
    const words=text.replace(/^[^\p{L}\p{N}]+/u,'').split(/\s+/u).slice(0,4).join(' ').replace(/[,;.]+$/,'');
    return words||'Fragmento '+(index+1);
  }
  function marks(words,name){
    const row=el('ol',null,'tjp-track');
    row.setAttribute('aria-label',name);
    for(const word of words)row.append(el('li',word));
    return row;
  }
  function selectable(panel,items,label,show) {
    const nav=el('div',null,'tjp-tabs');nav.setAttribute('role','group');nav.setAttribute('aria-label',label);
    const window=el('div',null,'tjp-read');
    window.setAttribute('aria-live','polite');
    const buttons=[];
    items.forEach((item,i)=>{
      const b=control(item.label,()=>select(i));buttons.push(b);nav.append(b);
    });
    function select(i) {
      buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
      window.replaceChildren(show(items[i],i));
    }
    panel.append(nav,window);select(0);
  }
  function note(text){return el('p',text,'tjp-note');}
  function sourceFigure(kind,title) {
    const box=el('section',null,'tjp-graphic');box.dataset.graphic=kind;
    box.append(el('h5',title));return box;
  }
  function chronology(body,id) {
    const parts=excerpt(body);
    const times=[];
    for(const part of parts)for(const m of part.matchAll(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g)){
      if(Number(m[1])<24&&Number(m[2])<60)times.push({label:m[0],part,value:Number(m[1])*3600+Number(m[2])*60+Number(m[3]||0)});
    }
    if(times.length<2)return null;
    const panel=sourceFigure('horas','Marcas de tiempo del documento'),strip=el('div',null,'tjp-timeline');
    strip.setAttribute('aria-hidden','true');
    const ordered=[...times].sort((a,b)=>a.value-b.value),min=ordered[0].value,max=ordered.at(-1).value;
    for(const time of times){
      const marker=el('i');marker.style.left=(max===min?50:3+94*(time.value-min)/(max-min))+'%';strip.append(marker);
    }
    panel.append(strip);
    selectable(panel,times,'Lecturas en el orden en que aparecen',item=>note(item.part));
    return panel;
  }
  function timedMarks(body) {
    const groups=excerpt(body).map(part=>{
      const times=[];
      for(const m of part.matchAll(/\b(?:segundos?\s+(\d+(?:(?:\s*,\s*|\s+y\s+)\d+)*)|(\d+(?:(?:\s*,\s*|\s+y\s+)\d+)*)\s*(?:segundos?|s)\b)/gi))
        times.push(...(m[1]||m[2]).match(/\d+/g).map(Number));
      return {part,times};
    }).filter(group=>group.times.length);
    const all=groups.flatMap(g=>g.times),max=Math.max(...all);
    if(all.length<2||new Set(all).size<2||max>86400)return null;
    const panel=sourceFigure('segundos','Marcas en segundos'),rack=el('div',null,'tjp-signals');
    for(const g of groups){
      const row=el('div',null,'tjp-signal-lane'),rail=el('div',null,'tjp-timeline');
      rail.setAttribute('aria-hidden','true');
      for(const x of g.times){const pulse=el('i');pulse.style.left=(3+94*x/max)+'%';rail.append(pulse);}
      row.append(el('strong',g.times.map(x=>x+' s').join(' · ')),rail,note(g.part));rack.append(row);
    }
    panel.append(rack);return panel;
  }
  function gallery(body) {
    const rows=lines(body).flatMap(x=>x.split(/\s+·\s+|\s+\/\s+(?=\p{L}[^[]*\[)/u)).map((part,i)=>{
      const details=[...part.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
      const before=part.slice(0,part.indexOf('[')).trim().replace(/[:.]$/,'');
      return {label:before||'Lámina '+(i+1),details};
    }).filter(r=>r.details.length);
    if(!rows.length)return null;
    const panel=sourceFigure('marcas','Marcas visibles en el original');
    if(rows.length===1){
      if(rows[0].label)panel.append(el('p',rows[0].label,'tjp-legend'));
      const strip=marks(rows[0].details,'Marcas en el orden del documento');
      panel.append(strip);
      if(/reflejad|desde dentro|desde el otro lado|mirando hacia/i.test(body)&&rows[0].details.length>1){
        let reversed=false;
        const flip=control('Invertir la vista',()=>{
          reversed=!reversed;
          const order=reversed?[...rows[0].details].reverse():rows[0].details;
          strip.replaceChildren(...order.map(value=>el('li',value)));
          flip.textContent=reversed?'Volver a la vista original':'Invertir la vista';flip.setAttribute('aria-pressed',String(reversed));
        });
        flip.className='tjp-flip';flip.setAttribute('aria-pressed','false');panel.append(flip);
      }
    }else selectable(panel,rows,'Elegir ampliación',r=>marks(r.details,'Detalles de '+r.label));
    return panel;
  }
  function pathway(body) {
    const paths=lines(body).flatMap(x=>x.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/u)).filter(x=>/[→↔]/.test(x)).map(line=>{
      const entries=line.split(/\s*[→↔]\s*/).filter(Boolean);
      return {label:entries[0],entries,both:line.includes('↔')};
    }).filter(p=>p.entries.length>1);
    if(!paths.length)return null;
    const panel=sourceFigure('recorrido','Conexiones del croquis');
    const render=path=>{
      const list=marks(path.entries,'Recorrido indicado en la fuente');
      list.classList.add('tjp-path');list.dataset.link=path.both?'↔':'→';return list;
    };
    if(paths.length===1)panel.append(render(paths[0]));
    else selectable(panel,paths,'Elegir recorrido',render);
    return panel;
  }
  function tableGraphic(body) {
    const rows=lines(body).filter(s=>s.includes('|')).map(line=>line.split('|').map(v=>v.trim()));
    if(rows.length<2)return null;
    const header=/^(?:puerta actual|punto|talón|prueba|fotograma|hojas|situación|lugar|señal|medición)$/iu.test(rows[0][0])?rows.shift():null;
    if(!rows.length)return null;
    const entries=rows.map(r=>({label:r[0],values:r.slice(1)}));
    const panel=sourceFigure('fichero','Fichero de anotaciones');
    function render(r){
      const list=el('dl',null,'tjp-values');
      for(const [i,cell] of r.values.entries()){
        const cellNode=el('div'), chunks=cell.split(/,\s+(?=[\p{L}\d])/u).filter(Boolean);
        cellNode.append(el('dt',header?.[i+1]||r.label));
        const val=el('dd');
        if(chunks.length>=3&&chunks.every(x=>x.length<=32))val.append(marks(chunks,'Elementos del registro'));
        else val.textContent=cell;
        cellNode.append(val);list.append(cellNode);
      }
      return list;
    }
    selectable(panel,entries,'Abrir una anotación',render);return panel;
  }
  function elevation(body) {
    if(!/Puerta actual\s*\|\s*Bisagras/i.test(body))return null;
    const rooms=lines(body).filter(line=>/^\d+\s*\|/.test(line)).map(line=>line.split('|').map(cell=>cell.trim()));
    if(!rooms.length)return null;
    const panel=sourceFigure('puertas','Alzado de la galería'),wall=el('div',null,'tjp-doorwall'),detail=el('p',null,'tjp-note');
    detail.setAttribute('aria-live','polite');
    function open(i){
      const [num,hinge,view,mark]=rooms[i];
      for(const [j,b] of [...wall.children].entries())b.setAttribute('aria-pressed',String(j===i));
      detail.textContent='Puerta '+num+' · Bisagras a la '+hinge+' · Ventana al '+view+' · Marca del zócalo · '+mark+'.';
    }
    rooms.forEach(([num,side,,mark],i)=>{
      const b=control('',()=>open(i),'tjp-doorproof');
      const leaf=el('span',null,'tjp-leaf');leaf.setAttribute('aria-hidden','true');leaf.dataset.side=side;leaf.dataset.mark=mark;
      b.append(leaf,el('span',num));b.setAttribute('aria-label','Examinar puerta '+num);
      wall.append(b);
    });
    panel.append(wall,detail);open(0);return panel;
  }
  function soundTrack(body) {
    const rows=lines(body).map(line=>line.split('|').map(v=>v.trim())).filter(r=>r.length>=2&&/madera,|risa,/.test(r[1]));
    if(rows.length<2)return null;
    const panel=sourceFigure('rollos','Bandas de los rollos');
    selectable(panel,rows.map(r=>({label:r[0],sounds:r[1].split(/,\s*/),note:r.slice(2).join(' · ')})),'Elegir un rollo',r=>{
      const strip=el('div'),track=marks(r.sounds,'Sucesión de sonidos');track.classList.add('tjp-sounds');
      [...track.children].forEach((cell,i)=>{cell.dataset.rest=String(/descanso|silencio/i.test(r.sounds[i]));});strip.append(track);
      if(r.note)strip.append(note(r.note));return strip;
    });
    return panel;
  }
  function custody(body){
    if(!/Quien entrega\s*\|\s*Quien recibe/iu.test(body))return null;
    const rows=lines(body).map(line=>line.split('|').map(x=>x.trim())).filter(r=>r.length===4&&/^(ojo|raya)$/iu.test(r[3]));
    if(!rows.length)return null;
    const panel=sourceFigure('custodia','Firmas del relevo');
    selectable(panel,rows.map(r=>({label:r[0],from:r[1],to:r[2],sign:r[3]})),'Elegir una hoja',r=>{
      const slip=el('div',null,'tjp-receipt'),track=marks([r.from,r.to],'Entrega y recepción');track.classList.add('tjp-path');
      const stamp=el('strong',r.sign,'tjp-custody');stamp.dataset.sign=r.sign;
      slip.append(track,stamp);return slip;
    });return panel;
  }
  function measurements(body) {
    const entries=Array.from(body.matchAll(/(?:de |del )?(cocina|telar|patio) a (\d+[,.]\d+)\s*m/gi),m=>({label:m[1],value:Number(m[2].replace(',','.')),text:m[2]+' m'}));
    if(entries.length<2)return null;
    const panel=sourceFigure('alturas','Altura de las bocas sobre el fondo'),chart=el('div',null,'tjp-bars'),max=Math.max(...entries.map(r=>r.value));
    for(const row of entries){
      const line=el('div'),fill=el('span',null,'tjp-bar');fill.style.setProperty('--reach',(row.value/max*100)+'%');
      line.append(el('strong',row.label),fill,el('span',row.text));chart.append(line);
    }
    panel.append(chart);return panel;
  }
  function depthsAndModels(body) {
    const models=Array.from(body.matchAll(/^([^|\r\n]+)\|\s*(\d+) modelo\s*\|\s*(\d+) edificio/gm),m=>({label:m[1].trim(),small:+m[2],large:+m[3]}));
    if(models.length<2)return measurements(body);
    const panel=sourceFigure('regla','Lecturas de la regla'),max=Math.max(...models.map(x=>x.small)),maxB=Math.max(...models.map(x=>x.large));
    selectable(panel,models,'Elegir pieza medida',item=>{
      const chart=el('div',null,'tjp-bars');
      for(const [label,value,upper] of [['Maqueta',item.small,max],['Edificio',item.large,maxB]]){
        const line=el('div'),bar=el('span',null,'tjp-bar');bar.style.setProperty('--reach',(value/upper*100)+'%');
        line.append(el('strong',label),bar,el('span',value+' cm'));chart.append(line);
      }
      chart.append(note('Cada regla usa su propia escala.'));return chart;
    });
    return panel;
  }
  function waveform(clip) {
    if(typeof clip!=='string'||!clip.startsWith('data:audio/wav;base64,'))return null;
    try{
      const stream=atob(clip.slice(clip.indexOf(',')+1)),byte=i=>stream.charCodeAt(i),u16=i=>byte(i)+256*byte(i+1),u32=i=>u16(i)+65536*u16(i+2);
      if(stream.slice(0,4)!=='RIFF'||stream.slice(8,12)!=='WAVE')return null;
      let fmt,payload;
      for(let p=12;p+8<=stream.length;){
        const tag=stream.slice(p,p+4),size=u32(p+4),start=p+8;
        if(tag==='fmt ')fmt={codec:u16(start),bits:u16(start+14),align:u16(start+12)};
        if(tag==='data'){payload={start,size:Math.min(size,stream.length-start)};break;}
        p=start+size+(size%2);
      }
      if(fmt?.codec!==1||![8,16].includes(fmt.bits)||!fmt.align||!payload)return null;
      const count=Math.floor(payload.size/fmt.align),bins=Math.min(64,count);
      if(bins<2)return null;
      const levels=[];
      for(let b=0;b<bins;b++){
        const start=Math.floor(count*b/bins),end=Math.floor(count*(b+1)/bins),step=Math.max(1,Math.floor((end-start)/48));
        let peak=0;
        for(let j=start;j<end;j+=step){
          const pos=payload.start+j*fmt.align,v=fmt.bits===8?(byte(pos)-128)/128:((u16(pos)+32768)%65536-32768)/32768;
          peak=Math.max(peak,Math.abs(v));
        }
        levels.push(peak);
      }
      return levels;
    }catch{return null;}
  }
  function narrative(item,id) {
    const parts=excerpt(item.body), entries=parts.map((text,i)=>({text,label:pinLabel(text,id,i)}));
    const spoken=item.kind==='audio'||item.kind==='testimony';
    const panel=sourceFigure(spoken?'escucha':'fragmentos',spoken?'Cuaderno de escucha':'Lectura por fragmentos');
    if(item.kind==='audio'&&item.clip){
      const levels=waveform(item.clip);
      if(levels){
        const tape=el('div',null,'tjp-wave');tape.setAttribute('role','img');tape.setAttribute('aria-label','Forma de onda de la grabación original');
        const max=Math.max(...levels,0.001);
        for(const level of levels){const bar=el('i');bar.style.height=(4+94*level/max)+'%';tape.append(bar);}panel.append(tape);
      }
    }
    if(!entries.length)return null;
    const render=e=>{const snippet=el('blockquote');snippet.append(el('p',e.text));return snippet;};
    if(entries.length===1)panel.append(render(entries[0]));
    else selectable(panel,entries,'Localizar un fragmento de esta fuente',render);
    return panel;
  }
  function sourceArt(id,index,item) {
    const props={A:'a',B:'b',1:'a',2:'b'},side=props[item.role];
    if(!side||(id===25&&index===3&&item.id==='fuente3')){
      const slot=side?12:id-25;
      return {url:'/tercer-fuentes-compartidas.webp',size:'500% 300%',pos:(slot%5*25)+'% '+(Math.floor(slot/5)*50)+'%'};
    }
    const first=25+3*Math.floor((id-25)/3);
    return {url:'/tercer-fuentes-'+first+'-'+side+'.webp',size:'500% 300%',pos:(index*25)+'% '+((id-first)*50)+'%'};
  }
  function appearance(element,art) {
    element.style.setProperty('--tj-proof-image','url("'+art.url+'")');
    element.style.setProperty('--tj-proof-size',art.size);
    element.style.setProperty('--tj-proof-pos',art.pos);
  }
  function mount({stage,index,caseId,role,shelf}) {
    const id=Number(caseId);
    if(!Number.isInteger(index)||index<0||index>=5||id<25||id>36||!shelf)return;
    const roles={A:'A',B:'B',1:'A',2:'B'},assigned=roles[role];
    const allowed=(stage.materials||[]).filter(m=>m&&m.body&&(!assigned||!roles[m.role]||roles[m.role]===assigned));
    const items=new Map(allowed.map(m=>[String(m.id),m]));
    for(const material of shelf.querySelectorAll('details.vhour-material')){
      const item=items.get(material.dataset.material),summary=material.querySelector(':scope > summary');
      if(!item||!summary||material.dataset.tjPlate)continue;
      material.dataset.tjPlate='true';
      const art=sourceArt(id,index,item),thumb=summary.querySelector('.vhour-format-photo');
      const original=summary.nextElementSibling;
      if(thumb){thumb.classList.add('tjp-thumb');appearance(thumb,art);}
      function display(){
        if(!material.open||material.querySelector(':scope > .tjp-plate'))return;
        const plate=el('figure',null,'tjp-plate');appearance(plate,art);plate.dataset.story=String(id);plate.dataset.stage=String(index+1);
        const scene=el('div',null,'tjp-prop');
        scene.setAttribute('aria-hidden','true');
        const caption=el('figcaption',(captions[item.kind]||'Fuente del archivo')+' · recreación del soporte');
        const graphic=(item.kind==='audio'&&item.clip?narrative(item,id):null)||elevation(item.body)||soundTrack(item.body)||custody(item.body)||depthsAndModels(item.body)||pathway(item.body)||gallery(item.body)||chronology(item.body,id)||timedMarks(item.body)||tableGraphic(item.body)||narrative(item,id);
        plate.append(scene,caption);if(graphic)plate.append(graphic);
        summary.after(plate);
        if(original&&!original.matches('.vhour-recording')){
          const full=el('details',null,'tjp-original');
          full.append(el('summary',item.kind==='web'?'Buscar en el registro completo':'Consultar el documento completo'));
          original.before(full);full.append(original);
        }
      }
      material.addEventListener('toggle',display);display();
    }
  }
  window.ArchivosDeCaso ||= {};
  for(let id=25;id<=36;id++)window.ArchivosDeCaso[id]=mount;
})();
