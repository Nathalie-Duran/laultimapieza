/* Material from the current evidence card is the sole source of this plate. */
(() => {
  'use strict';
  function node(tag, cls, value) {
    const out=document.createElement(tag);
    if(cls)out.className=cls;
    if(value!=null)out.textContent=value;
    return out;
  }
  function button(value, cls) {
    const out=node('button',cls,value);
    out.type='button';
    return out;
  }
  function canvas(w,h) {
    const el=node('canvas');
    const scale=2;
    el.width=w*scale; el.height=h*scale;
    el.style.aspectRatio=w+' / '+h;
    el.setAttribute('aria-hidden','true');
    const c=el.getContext('2d');
    if(!c)return null;
    c.scale(scale,scale);
    return {el,c};
  }
  function marks(source) {
    const dots=source.trim();
    const pulses=dots.split(/,\s*/);
    const perforation=/^[•●]{1,10}$/.test(dots);
    const lights=pulses.every(p=>/^(?:blanca|roja) (?:fuerte|débil)$/i.test(p));
    if(!perforation&&!lights)return null;
    const count=perforation?dots.length:pulses.length;
    const paper=canvas(Math.max(30,count*17+8),24);
    if(!paper)return null;
    const {c,el}=paper;
    el.className='ml-marks';
    for(let i=0;i<count;i++){
      const x=12+i*17,y=12;
      c.beginPath();
      c.arc(x,y,perforation?4:(pulses[i].includes('débil')?3:6),0,Math.PI*2);
      c.fillStyle=perforation?'#344336':(pulses[i].startsWith('roja')?'#a64435':'#fff7d9');
      c.fill(); c.strokeStyle='#514d39'; c.lineWidth=1.25;c.stroke();
    }
    return el;
  }
  function coordinates(text) {
    return [...text.matchAll(/\b([\p{L}][\p{L}\d]{0,8})\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/gu)]
      .map(match=>({name:match[1],x:Number(match[2]),y:Number(match[3])}));
  }
  const directionNames=['norte','este','sur','oeste'];
  const numerals=['cero','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'];
  function numberOf(s) {return /^\d+$/.test(s)?Number(s):numerals.indexOf(s);}
  function specimenChart(source) {
    const clean=source.toLowerCase(),symbols=[];
    let caption='';
    // Only plot relations explicitly recorded by the author, never solve or infer a missing value.
    const exposures=[...clean.matchAll(/(\d+)\s*h\s*:\s*(?:dirección\s+)?(norte|este|sur|oeste)\s*,\s*(\d+)\s+losas/g)];
    const vents=[...source.matchAll(/(?:^|[.]\s+)([^.\n:]{1,24}):\s*boca\s+(?:hacia\s+)?(norte|este|sur|oeste)\s*,\s*(abierta|cerrada)/gi)];
    const petals=clean.match(/(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) pétalos,?\s+(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)[^.]+?muesca/);
    const range=clean.match(/escala circular (\d+)\s*[–—-]\s*(\d+)/);
    const first=clean.match(/punto inicial\s+(\d+)/);
    const oppositePairs=[...clean.matchAll(/frente a\s+(norte|este|sur|oeste)\s*(?:está|,)\s*(norte|este|sur|oeste)/g)];
    const levels=[...source.matchAll(/\b(boca\s+(?:de(?:l| la)?\s+)?[^;,.:]{1,32}?)\s+a\s+(\d+(?:[.,]\d+)?)\s*m\b/gi)];
    if(exposures.length>=2){
      for(const [,time,distanceDir,length] of exposures)symbols.push({label:time+' h',dir:distanceDir,len:Number(length),annotation:length+' losas'});
    }else if(vents.length>=2){
      for(const [,name,dir,gate] of vents)symbols.push({label:name.trim(),dir:dir.toLowerCase(),annotation:gate});
    }else if(levels.length>1 && /desde el fondo/.test(clean)){
      const p=canvas(310,210);if(!p)return null;
      const g=p.c,bottom=178,top=20,axis=44;
      const meters=levels.map(row=>Number(row[2].replace(',','.'))),ceiling=Math.ceil(Math.max(...meters));
      if(ceiling<=0)return null;
      g.strokeStyle='#817858';g.lineWidth=2;g.beginPath();g.moveTo(axis,top);g.lineTo(axis,bottom);g.lineTo(286,bottom);g.stroke();
      g.textBaseline='middle';g.font='12px system-ui';
      for(let i=0;i<=Math.min(ceiling,10);i++){
        const v=i*ceiling/Math.min(ceiling,10),y=bottom-v/ceiling*(bottom-top);
        g.fillStyle='#354b42';g.textAlign='right';g.fillText(v.toLocaleString('es-ES')+' m',axis-5,y);
      }
      levels.forEach((row,i)=>{
        const y=bottom-meters[i]/ceiling*(bottom-top),x=axis+18;
        g.strokeStyle='#927d53';g.lineWidth=1;g.beginPath();g.moveTo(axis,y);g.lineTo(x,y);g.stroke();
        g.fillStyle='#915636';g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();
        g.textAlign='left';g.fillStyle='#263e36';g.fillText(row[1]+' · '+row[2]+' m',x+7,y);
      });
      const wrap=node('div','ml-instrument');wrap.append(p.el,node('small',null,'Alturas respecto al fondo.'));return wrap;
    }else if(petals){
      const count=numberOf(petals[1]),notched=numberOf(petals[2]);
      if(count<2||count>12||notched>count||notched<0)return null;
      const c=canvas(300,98);if(!c)return null;
      const g=c.c;g.strokeStyle='#4a6045';g.fillStyle='#c7c29a';g.lineWidth=2;
      const dx=Math.min(42,270/count);
      for(let k=0;k<count;k++){
        const x=14+dx*(k+.5);
        g.beginPath();g.moveTo(x,71);g.bezierCurveTo(x-13,58,x-12,37,x-6,26);
        if(k<notched){g.lineTo(x,35);g.lineTo(x+6,26);}
        else g.quadraticCurveTo(x,18,x+6,26);
        g.bezierCurveTo(x+12,37,x+13,58,x,71);g.fill();g.stroke();
      }
      caption='Recuento de pétalos, sin indicar su posición en la flor.';
      const wrap=node('div','ml-instrument');wrap.append(c.el,node('small',null,caption));return wrap;
    }else if(range&&first){
      const start=Number(range[1]),end=Number(range[2]),initial=Number(first[1]),n=end-start+1;
      if(n<3||n>16||initial<start||initial>end)return null;
      const p=canvas(206,166);if(!p)return null;
      const g=p.c;g.lineWidth=2;g.strokeStyle='#938566';g.beginPath();g.arc(103,80,59,0,Math.PI*2);g.stroke();
      g.textBaseline='middle';g.textAlign='center';g.font='bold 14px system-ui';
      for(let i=0;i<n;i++){
        const a=i*Math.PI*2/n-Math.PI/2,x=103+59*Math.cos(a),y=80+59*Math.sin(a),value=start+i;
        g.beginPath();g.arc(x,y,11,0,Math.PI*2);g.fillStyle=value===initial?'#79532d':'#f7eed3';g.fill();g.stroke();
        g.fillStyle=value===initial?'#fff7df':'#304b40';g.fillText(value,x,y);
      }
      const wrap=node('div','ml-instrument');wrap.append(p.el,node('small',null,'Escala esquemática · Punto inicial '+initial));return wrap;
    }else if(oppositePairs.length===2&&/cruz/.test(clean)){
      const p=canvas(220,157);if(!p)return null;
      const g=p.c;g.lineWidth=6;g.strokeStyle='#a58755';g.strokeRect(60,28,100,100);
      g.strokeStyle='#3e5749';g.lineWidth=2;g.beginPath();g.moveTo(75,78);g.lineTo(145,78);g.moveTo(110,43);g.lineTo(110,113);g.stroke();
      g.fillStyle='#31443c';g.font='bold 13px system-ui';g.textAlign='center';g.textBaseline='middle';
      for(const [i,[x,y]] of [[110,14],[183,79],[110,144],[34,79]].entries())g.fillText(directionNames[i],x,y);
      const wrap=node('div','ml-instrument');wrap.append(p.el,node('small',null,'Esquema de las posiciones opuestas.'));return wrap;
    }else return null;
    const wrap=node('div','ml-direction-grid');
    const max=Math.max(1,...symbols.map(d=>d.len||1));
    for(const {label,dir,len,annotation} of symbols){
      const icon=canvas(83,76);if(!icon)return null;
      const g=icon.c;g.save();g.translate(41,38);
      g.beginPath();g.arc(0,0,29,0,Math.PI*2);g.strokeStyle='#aaa787';g.lineWidth=1;g.stroke();
      g.rotate(directionNames.indexOf(dir)*Math.PI/2);const reach=12+14*(len||1)/max;
      g.strokeStyle='#89572d';g.fillStyle='#89572d';g.lineWidth=3;g.beginPath();g.moveTo(0,13);g.lineTo(0,-reach+2);g.stroke();
      g.beginPath();g.moveTo(0,-reach);g.lineTo(-5,-reach+8);g.lineTo(5,-reach+8);g.closePath();g.fill();g.restore();
      const cell=node('div','ml-direction');cell.append(node('strong',null,label),icon.el,node('small',null,dir+' · '+annotation));wrap.append(cell);
    }
    return wrap;
  }
  function plot(rows) {
    const series=rows.map(text=>({text,points:coordinates(text)})).filter(s=>s.points.length>=2);
    if(!series.length)return null;
    const all=series.flatMap(s=>s.points);
    const joined=rows.join(' ');
    const limits=(axis,values)=>{
      const match=joined.match(new RegExp('\\b'+axis+'\\s+entre\\s+(-?\\d+)\\s+y\\s+(-?\\d+)','i'));
      return match?[Number(match[1]),Number(match[2])]:[Math.min(...values),Math.max(...values)];
    };
    const [x0,x1]=limits('x',all.map(p=>p.x)),[y0,y1]=limits('y',all.map(p=>p.y));
    if(x1<=x0||y1<=y0||x1-x0>16||y1-y0>16)return null;
    const grid=node('div','ml-coordinates');
    for(const entry of series){
      const chart=canvas(260,182);
      if(!chart)return null;
      const {c,el}=chart,l=30,r=239,t=15,b=150;
      const px=x=>l+(x-x0)/(x1-x0)*(r-l),py=y=>b-(y-y0)/(y1-y0)*(b-t);
      c.font='12px system-ui'; c.lineWidth=1;
      c.textAlign='center';c.textBaseline='middle';
      for(let x=x0;x<=x1;x++){
        c.beginPath();c.moveTo(px(x),t);c.lineTo(px(x),b);c.strokeStyle='#c0b89a';c.stroke();
        c.fillStyle='#334e47';c.fillText(x,px(x),b+13);
      }
      for(let y=y0;y<=y1;y++){
        c.beginPath();c.moveTo(l,py(y));c.lineTo(r,py(y));c.strokeStyle='#c0b89a';c.stroke();
        c.fillStyle='#334e47';c.fillText(y,l-12,py(y));
      }
      c.textAlign='left';c.font='bold 13px system-ui';
      for(const p of entry.points){
        c.beginPath();c.arc(px(p.x),py(p.y),4,0,2*Math.PI);c.fillStyle='#885026';c.fill();
        const labelX=p.x===x1?px(p.x)-14:px(p.x)+6;
        c.fillStyle='#1b3a33';c.fillText(p.name,labelX,py(p.y)+(p.y===y1?10:-7));
      }
      const part=node('section','ml-graph');
      const label=entry.text.includes(':')?entry.text.split(':')[0]:'Coordenadas';
      part.append(node('strong','ml-chart-name',label),el);
      const values=node('ul','ml-coord-labels');
      for(const p of entry.points)values.append(node('li',null,p.name+' ('+p.x+', '+p.y+')'));
      part.append(values);grid.append(part);
    }
    for(const line of rows.filter(text=>!series.some(s=>s.text===text)))grid.append(node('p','ml-observation',line));
    return grid;
  }
  function recordRows(rows) {
    const scroll=node('div','ml-table-scroll');
    scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Tabla de la lámina');
    const t=node('table','ml-table'),body=node('tbody');
    const columns=Math.max(...rows.map(r=>r.length));
    const numberUnits=/^(-?\d+(?:[.,]\d+)?)\s*(kg|g|cm|mm|m|min|s|h|vueltas|unidades)$/i;
    const scales=Array.from({length:columns},(_,i)=>{
      const values=rows.map(r=>r[i]?.trim().match(numberUnits)).filter(Boolean);
      if(values.length<2||values.length<rows.length-1||values.some(x=>x[2].toLowerCase()!==values[0][2].toLowerCase()))return null;
      const nums=values.map(x=>Number(x[1].replace(',','.')));
      return Math.min(...nums)>=0?Math.max(...nums):null;
    });
    rows.forEach(row=>{
      const tr=node('tr');
      row.forEach((value,i)=>{
        const cell=node(i===0?'th':'td');
        if(i===0)cell.scope='row';
        const ink=marks(value);
        if(ink)cell.append(ink);
        cell.append(node('span',null,value));
        const match=value.trim().match(numberUnits);
        if(scales[i]&&match){
          const bar=node('i','ml-measure');
          bar.setAttribute('aria-hidden','true');bar.style.width=(Number(match[1].replace(',','.'))*100/scales[i])+'%';
          cell.append(bar);
        }
        tr.append(cell);
      });
      body.append(tr);
    });
    t.append(body);scroll.append(t);return scroll;
  }
  function chip(text) {
    const label=text.replace(/^\[|\]$/g,'');
    const tag=node('span','ml-chip');
    const art=marks(label);if(art)tag.append(art);
    tag.append(node('span',null,label));return tag;
  }
  function drawRow(parts) {
    if(parts.length===1){
      const drawing=specimenChart(parts[0].text);
      if(!drawing)return node('p','ml-observation',parts[0].text);
      const frame=node('div','ml-diagram-note');frame.append(drawing,node('p','ml-observation',parts[0].text));return frame;
    }
    const flow=node('div','ml-path');
    for(const {kind,text} of parts){
      if(kind==='edge')flow.append(node('span','ml-edge',text));
      else if(kind==='stop')flow.append(chip(text));
      else flow.append(node('span','ml-path-note',text));
    }
    return flow;
  }
  function extract(figure) {
    const diagrams=figure.querySelector('.vhour-diagram');
    if(diagrams){
      const content=[...diagrams.children].map(row=>{
        if(row.classList.contains('vhour-flow')){
          return [...row.children].map(part=>({text:part.textContent.trim(),kind:part.classList.contains('vhour-stop')?'stop':part.classList.contains('vhour-edge')?'edge':'annotation'}));
        }
        return [{text:row.textContent.trim(),kind:'annotation'}];
      });
      return content.length?{content}:null;
    }
    const evidence=figure.querySelector('.vhour-evidence-body');
    if(!evidence)return null;
    const tables=[...evidence.children].map(part=>{
      const table=part.querySelector('table');
      return table?{rows:[...table.rows].map(r=>[...r.cells].map(v=>v.textContent.trim()))}:{text:part.textContent.trim()};
    });
    return tables.length?{tables}:null;
  }
  function createPlate(data) {
    const plate=node('div','ml-sheet');
    if(data.tables){
      for(const part of data.tables)plate.append(part.rows?.length?recordRows(part.rows):node('p','ml-observation',part.text));
    }else{
      const scatter=plot(data.content.map(row=>row.map(p=>p.text).join(' ')));
      if(scatter)plate.append(scatter);
      else for(const row of data.content)plate.append(drawRow(row));
    }
    return plate;
  }
  function enlarge(plate, source, title, world) {
    if(!source.isConnected)return;
    const dialog=node('dialog','ml-dialog');dialog.dataset.mlWorld=world;
    if(typeof dialog.showModal!=='function')return;
    const head=node('div','ml-dialog-head'),heading=node('h3',null,title),close=button('Cerrar','ml-control');
    close.autofocus=true;close.addEventListener('click',()=>dialog.close());
    const scroll=node('div','ml-dialog-scroll');scroll.tabIndex=0;
    scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Lámina ampliada');
    head.append(heading,close);scroll.append(plate);dialog.append(head,scroll);
    dialog.setAttribute('aria-label',title);
    // Keep the modal within this game. Leaving the case also releases it.
    source.parentElement.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(source.isConnected)source.focus({preventScroll:true});},{once:true});
    dialog.showModal();close.focus();
  }
  function enhance(root,world) {
    if(!root||!['expedicion','umbravia'].includes(world))return;
    for(const figure of root.querySelectorAll('.vhour-material[data-kind="visual"] .vhour-plate:not([data-ml-ready])')){
      const data=extract(figure);if(!data)continue;
      const card=figure.closest('.vhour-material');
      const title=card.querySelector('.vhour-material-name strong')?.textContent||'Lámina';
      const reading=node('details','ml-reading');
      const summary=node('summary',null,'Lectura textual de la lámina');
      reading.append(summary,...figure.childNodes);
      const plate=createPlate(data),bar=node('div','ml-tools');
      const zoom=button('Ampliar lámina','ml-control');
      zoom.addEventListener('click',()=>enlarge(createPlate(data),zoom,title,world));
      if(typeof HTMLDialogElement!=='undefined'&&typeof HTMLDialogElement.prototype.showModal==='function')bar.append(zoom);
      figure.dataset.mlReady='true';figure.dataset.mlWorld=world;
      figure.append(plate,bar,reading);
    }
  }
  window.MundosLaminas=Object.freeze({enhance});
})();
