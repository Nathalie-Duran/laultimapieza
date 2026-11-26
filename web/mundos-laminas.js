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
  function surveyChart(source){
    if(!/se suceden|marca inicial|filas [a-z][–-][a-z]|flecha a la|fotos del reverso|pulsos numerados|alturas relativas|puertas luminosas en los postigos/i.test(source))return null;
    const chart=canvas(288,148);
    if(!chart)return null;
    const {c,el}=chart;
    const lapis='#224f69',ochre='#9b572c',ink='#263b43';
    function line(x,y,xx,yy,color=lapis,width=2){
      c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();
    }
    function label(text,x,y,align='center'){
      c.fillStyle=ink;c.textAlign=align;c.textBaseline='middle';c.font='bold 12px system-ui';c.fillText(text,x,y);
    }
    function point(x,y,color,r=5){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fill();}
    const route=source.match(/de (sur|norte) a (sur|norte) se suceden ([^,.]{1,18}), ([^,.]{1,18}) y ([^.]{1,18})\./i);
    const readings=[...source.matchAll(/ensayo ([\p{L}]+): marca inicial (\d+), final (\d+)/giu)];
    const grid=source.match(/filas ([A-Z])[–-]([A-Z]) de arriba abajo y columnas (\d+)[–-](\d+) de izquierda a derecha/i);
    const samples=[...source.matchAll(/\b([A-Z]) = ((?:larga|corta|doble)(?:, (?:larga|corta|doble))+?) \(flecha a la (izquierda|derecha)\)/g)];
    const backs=[...source.matchAll(/\b([A-Z]) \(grieta (derecha|izquierda) (arriba|abajo), gota (derecha|izquierda) (arriba|abajo)\)/g)];
    const pulses=source.match(/pulsos numerados (\d+) a (\d+)\. Se oyen golpes en ([\d, y]+)\./i);
    const levels=source.match(/de izquierda a derecha: ([^,.]+), ([^,.]+), ([^.]+)\. Sobre la línea del agua sus alturas relativas son (\d+), (\d+) y (\d+) divisiones/i);
    const panels=[...source.matchAll(/([\p{L}]+) \((\d+) (izquierda|central|derecha) \+ (\d+) (izquierda|central|derecha)\)/gu)];
    if(route){
      const stops=route.slice(3),northbound=route[1].toLowerCase()==='sur';
      line(50,22,50,127);label('N',50,10);label('S',50,138);
      stops.forEach((name,i)=>{const y=northbound?112-i*38:36+i*38;point(50,y,ochre);line(56,y,85,y);label(name.trim(),95,y,'left');});
    }else if(readings.length>=2){
      const max=Math.max(...readings.flatMap(r=>r.slice(2).map(Number)));if(max<=0||max>100)return null;
      readings.forEach((r,i)=>{
        const y=33+i*50,x=v=>84+Number(v)/max*168;
        label(r[1],5,y,'left');line(84,y,252,y,'#adac93');
        for(let k=0;k<=max;k++)line(x(k),y-3,x(k),y+3,'#9f9d90',1);
        for(const [j,word] of ['inicio','final'].entries()){
          const value=r[j+2];point(x(value),y,j?ochre:lapis);label(word+' '+value,x(value),y+(j?15:-15));
        }
      });
    }else if(grid){
      const first=grid[1].charCodeAt(0),last=grid[2].charCodeAt(0),low=Number(grid[3]),high=Number(grid[4]);
      const red=source.match(/señal roja está en ([A-Z]\d+)/i),set=source.match(/puntos marcados:\s*([A-Z\d, y]+)\./i);
      if(!red||!set||last<first||last-first>8||high<low||high-low>8)return null;
      const dots=new Set(set[1].match(/[A-Z]\d+/g)),dy=96/(last-first+1),dx=181/(high-low+1);
      for(let y=first;y<=last;y++)for(let x=low;x<=high;x++){
        const xx=65+(x-low)*dx,yy=24+(y-first)*dy,k=String.fromCharCode(y),id=k+x;
        c.strokeStyle='#9c945f';c.lineWidth=1;c.strokeRect(xx,yy,dx,dy);
        if(x===low)label(k,xx-12,yy+dy/2);if(y===first)label(x,xx+dx/2,yy-12);
        if(dots.has(id))point(xx+dx/2,yy+dy/2,lapis);
        if(id===red[1]){c.fillStyle='#9c3b35';c.fillRect(xx+dx/2-5,yy+dy/2-5,10,10);}
      }
      label('●  Puntos marcados     ■  Señal roja',144,136);
    }else if(samples.length){
      samples.forEach((r,i)=>{
        const y=23+i*40;label(r[1],14,y);
        r[2].split(', ').forEach((shape,j)=>{
          const x=48+j*54;
          if(shape==='doble'){line(x-3,y-8,x-3,y+8);line(x+3,y-8,x+3,y+8);}
          else {const h=shape==='larga'?13:6;line(x,y-h,x,y+h,lapis,3);}
        });
        const right=r[3]==='derecha',tip=right?262:205;
        line(205,y,262,y,ochre);line(tip,y,tip+(right?-7:7),y-5,ochre);line(tip,y,tip+(right?-7:7),y+5,ochre);
      });
    }else if(backs.length){
      backs.forEach((r,i)=>{
        const x=22+i*66;label(r[1],x+22,30);
        c.lineWidth=1;c.strokeStyle=lapis;c.strokeRect(x,48,45,54);
        const at=(side,edge)=>[x+(side==='derecha'?35:10),edge==='arriba'?59:91];
        const [cx,cy]=at(r[2],r[3]),[vx,vy]=at(r[4],r[5]);
        line(cx-3,cy-6,cx+2,cy,ochre);line(cx+2,cy,cx-2,cy+6,ochre);point(vx,vy,lapis,4);
      });
      label('Grieta   ϟ       Gota   ●',144,125);
    }else if(levels){
      const names=levels.slice(1,4),heights=levels.slice(4).map(Number),maximum=Math.max(...heights);
      if(maximum<=0||maximum>16)return null;
      const base=112,step=83/maximum;line(18,base,270,base,lapis,2);
      for(let i=1;i<=maximum;i++)line(18,base-i*step,270,base-i*step,'#c5b9a0',1);
      names.forEach((name,i)=>{const x=49+i*91,y=base-heights[i]*step;line(x,base,x,y,'#99917f',1);point(x,y,ochre,5);label(heights[i],x+12,y);label(name,x,132);});
    }else if(panels.length===4){
      const columns=['izquierda','central','derecha'],indices=[...new Set(panels.flatMap(p=>[Number(p[2]),Number(p[4])]))].sort((a,b)=>a-b);
      if(indices.length>4)return null;
      panels.forEach((sample,i)=>{
        const x=27+65*i;label(sample[1],x+22,30);
        for(const [j,n] of indices.entries())for(const [k,column] of columns.entries()){
          const xx=x+15*k,yy=53+20*j;
          c.strokeStyle='#998b74';c.lineWidth=1;c.strokeRect(xx,yy,15,20);
          if(i===0&&k===0)label(n,xx-13,yy+10);
          if(n===Number(sample[2])&&column===sample[3]||n===Number(sample[4])&&column===sample[5])point(xx+7.5,yy+10,ochre,4);
        }
      });
      label('Ventanas registradas en los postigos',144,127);
    }else if(pulses){
      const a=Number(pulses[1]),b=Number(pulses[2]);if(b<a||b-a>15)return null;
      const struck=new Set(pulses[3].match(/\d+/g).map(Number)),step=252/(b-a+1);
      for(let n=a;n<=b;n++){const x=18+(n-a+.5)*step;label(n,x,107);line(x,83,x,90);if(struck.has(n))point(x,68,lapis,7);}
      line(18,86,270,86);label('Golpes registrados',144,33);
    }else return null;
    const wrap=node('div','ml-survey');wrap.append(el);return wrap;
  }
  function specimenChart(source) {
    const survey=surveyChart(source);if(survey)return survey;
    const clean=source.toLowerCase(),symbols=[];
    let caption='';
    // Only plot relations explicitly recorded by the author, never solve or infer a missing value.
    const exposures=[...clean.matchAll(/(\d+)\s*h\s*:\s*(?:dirección\s+)?(norte|este|sur|oeste)\s*,\s*(\d+)\s+losas/g)];
    const vents=[...source.matchAll(/(?:^|[.]\s+)([^.\n:]{1,24}):\s*boca\s+(?:hacia\s+)?(norte|este|sur|oeste)\s*,\s*(abierta|cerrada)/gi)];
    const measuredVents=[...source.matchAll(/(?:^|[.]\s+)([^.\n:]{1,24}):\s*(\d+),\s*boca al (norte|este|sur|oeste),\s*([^.;]+)/gi)];
    const petals=clean.match(/(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) pétalos,?\s+(\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)[^.]+?muesca/);
    const range=clean.match(/escala circular (\d+)\s*[–—-]\s*(\d+)/);
    const first=clean.match(/punto inicial\s+(\d+)/);
    const oppositePairs=[...clean.matchAll(/frente a\s+(norte|este|sur|oeste)\s*(?:está|,)\s*(norte|este|sur|oeste)/g)];
    const levels=[...source.matchAll(/\b(boca\s+(?:de(?:l| la)?\s+)?[^;,.:]{1,32}?)\s+a\s+(\d+(?:[.,]\d+)?)\s*m\b/gi)];
    if(exposures.length>=2){
      for(const [,time,distanceDir,length] of exposures)symbols.push({label:time+' h',dir:distanceDir,len:Number(length),annotation:length+' losas'});
    }else if(vents.length>=2){
      for(const [,name,dir,gate] of vents)symbols.push({label:name.trim(),dir:dir.toLowerCase(),annotation:gate});
    }else if(measuredVents.length>=2){
      for(const [,name,value,dir,gate] of measuredVents)symbols.push({label:name.trim()+' · '+value,dir:dir.toLowerCase(),annotation:gate});
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
    const numericColumns=rows[0].map((h,i)=>/^(?:altura de la |dedos a )/i.test(h)?i:-1).filter(i=>i>=0);
    const recorded=rows.slice(1).flatMap(row=>numericColumns.map(i=>Number(row[i])));
    const maxHeight=recorded.length&&recorded.every(v=>Number.isFinite(v)&&v>=0)?Math.max(...recorded):0;
    const slots=rows.map(row=>row[1]?.match(/^tapa (\d+) y (\d+)$/i));
    const slotCount=slots.length>=2&&slots.every(Boolean)?Math.max(...slots.flatMap(s=>s.slice(1).map(Number))):0;
    const scales=Array.from({length:columns},(_,i)=>{
      const values=rows.map(r=>r[i]?.trim().match(numberUnits)).filter(Boolean);
      if(values.length<2||values.length<rows.length-1||values.some(x=>x[2].toLowerCase()!==values[0][2].toLowerCase()))return null;
      const nums=values.map(x=>Number(x[1].replace(',','.')));
      return Math.min(...nums)>=0?Math.max(...nums):null;
    });
    rows.forEach((row,rowIndex)=>{
      const tr=node('tr');
      row.forEach((value,i)=>{
        const cell=node(i===0?'th':'td');
        if(i===0)cell.scope='row';
        const ink=marks(value);
        if(ink)cell.append(ink);
        if(slotCount>0&&slotCount<=12&&i===1){
          const p=canvas(slotCount*16+4,17);
          if(p){p.el.className='ml-window-strip';p.c.lineWidth=1.5;for(let n=1;n<=slotCount;n++){
            const x=3+(n-1)*16,covered=slots[rowIndex].slice(1).includes(String(n));
            p.c.strokeStyle='#31586a';p.c.strokeRect(x,3,11,11);if(covered){p.c.fillStyle='#31586a';p.c.fillRect(x,3,11,11);}
          }cell.append(p.el);}
        }
        if(numericColumns.includes(i)&&rowIndex>0&&maxHeight>0){
          const bar=node('i','ml-measure');bar.style.width=Number(value)/maxHeight*100+'%';bar.setAttribute('aria-hidden','true');cell.append(bar);
        }
        if(/^(rombo|círculo|óvalo|media luna)$/i.test(value)){
          const p=canvas(40,28);
          if(p){
            p.el.className='ml-glyph';const g=p.c;g.strokeStyle='#31586a';g.lineWidth=2;g.beginPath();
            if(value==='rombo'){g.moveTo(20,3);g.lineTo(34,14);g.lineTo(20,25);g.lineTo(6,14);g.closePath();}
            else if(value==='media luna'){g.moveTo(29,4);g.bezierCurveTo(1,-3,1,32,29,24);g.bezierCurveTo(13,23,13,6,29,4);}
            else g.ellipse(20,14,value==='óvalo'?16:10,10,0,0,2*Math.PI);
            g.stroke();cell.append(p.el);
          }
        }
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
    if(!root||!['expedicion','umbravia','necropolis'].includes(world))return;
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
