(() => {
  'use strict';

  function el(tag,text='',className='') {
    const node=document.createElement(tag);
    if(text) node.textContent=text;
    if(className) node.className=className;
    return node;
  }
  function button(text,action) {
    const node=el('button',text);
    node.type='button';
    node.addEventListener('click',action);
    return node;
  }
  function shell(data) {
    const root=el('section','','vd-taller');
    root.append(el('h4',data.title),el('p',data.instructions));
    return root;
  }
  function choose(label,values,onChange) {
    const wrap=el('label',label+' ','vt-item'), select=el('select');
    values.forEach((value,i)=>{
      const option=el('option',value); option.value=String(i); select.append(option);
    });
    select.addEventListener('change',()=>onChange(Number(select.value)));
    wrap.append(select);return wrap;
  }
  function picker(labels,callback) {
    const row=el('div','','vt-controls');
    const buttons=labels.map((name,index)=>button(name,()=>callback(index)));
    row.append(...buttons);
    return {row,mark(index){buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)));}};
  }
  function canvas(width,height) {
    const c=el('canvas');c.width=width;c.height=height;c.setAttribute('aria-hidden','true');
    c.style.cssText='display:block;width:100%;height:auto;border-radius:.35rem';
    return c;
  }
  function live() {
    const p=el('p','','vt-result');p.setAttribute('role','status');return p;
  }
  function landscape(canvas,view) {
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const w=canvas.width,h=canvas.height;
    const sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#182d43');sky.addColorStop(.7,'#889a97');sky.addColorStop(1,'#455b66');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    const x=w*.52,y=h*(1-view.height);
    ctx.strokeStyle='#dfd4a2';ctx.lineWidth=2;ctx.setLineDash([3,6]);
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#fff0ab';ctx.shadowColor='#ffe89b';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#293c43';ctx.beginPath();ctx.moveTo(0,h);
    view.profile.forEach((v,i)=>ctx.lineTo(i*w/(view.profile.length-1),h*(1-v)));
    ctx.lineTo(w,h);ctx.closePath();ctx.fill();
    ctx.fillStyle='#294e59';ctx.fillRect(0,h*.80,w,h*.20);
    ctx.strokeStyle='#72918c';ctx.lineWidth=1;
    for(let i=0;i<4;i++){const waveY=h*(.84+i*.035);ctx.beginPath();ctx.moveTo(w*(.03+i*.08),waveY);ctx.lineTo(w*(.82-i*.08),waveY);ctx.stroke();}
  }
  function lookout(data) {
    const root=shell(data);let position=0,direction=0;
    const places=picker(data.positions.map(p=>p.name),i=>{position=i;update();});
    const directions=picker(data.directions,i=>{direction=i;update();});
    const image=canvas(720,175),caption=live(),board=el('div','','vt-board');
    function update() {
      const from=data.positions[position],view=from.views[direction];
      places.mark(position);directions.mark(direction);landscape(image,view);
      caption.textContent=from.name+'. '+from.marks+' '+data.directions[direction]+'. '+view.light;
    }
    board.append(image,caption);
    root.append(places.row,directions.row,board);update();return root;
  }

  // Render short foley reconstructions locally. Each clip's score and caption come from the stage.
  function recording(clips) {
    const rate=16000, gap=.15, pause=.45;
    const length=Math.ceil(clips.reduce((seconds,c)=>seconds+c.sounds.reduce((sum,e)=>sum+e[2]/1000+gap,0)+pause,0)*rate);
    const bytes=new ArrayBuffer(44+2*length),view=new DataView(bytes);
    function word(offset,text){for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));}
    word(0,'RIFF');view.setUint32(4,36+2*length,true);word(8,'WAVE');word(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);
    view.setUint16(34,16,true);word(36,'data');view.setUint32(40,length*2,true);
    let offset=0,seed=43;
    for(const clip of clips) {
      for(const [kind,pitch,millis,gain] of clip.sounds) {
        const total=Math.floor(rate*millis/1000);let filtered=0;
        for(let i=0;i<total;i++) {
          const t=i/rate,u=i/total,phase=2*Math.PI*pitch*t;
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          filtered+=(seed/2147483648-1-filtered)*Math.min(.95,pitch/rate);
          let signal=kind==='noise'?filtered*2.1:Math.sin(phase);
          if(kind==='ring')signal=.62*signal+.38*Math.sin(phase*2.72);
          const envelope=Math.min(1,i/45,(total-i)/70)*(kind==='noise'?Math.sin(Math.PI*u):Math.exp(-(kind==='tap'?7:3)*u));
          view.setInt16(44+2*(offset+i),Math.round(32767*Math.max(-1,Math.min(1,signal*gain*envelope))),true);
        }
        offset+=total+Math.floor(rate*gap);
      }
      offset+=Math.floor(rate*pause);
    }
    return new Blob([bytes],{type:'audio/wav'});
  }
  function soundDesk(data) {
    const root=shell(data),board=el('div','','vt-board'),sequence=[],status=live();
    const audio=el('audio');audio.preload='metadata';audio.controls=true;audio.hidden=true;
    audio.style.maxWidth='100%';let resource=null,observer=null;
    function stop() {
      if(!resource)return;
      audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(resource);
      resource=null;audio.hidden=true;
      observer?.disconnect();observer=null;
      document.removeEventListener?.('visibilitychange',leave);
    }
    function leave() {if(document.hidden||!root.isConnected||root.closest('[hidden], [aria-hidden="true"]'))stop();}
    function play(indices) {
      if(!indices.length)return;
      stop();
      const copy=indices.map(i=>data.clips[i]);
      status.textContent=copy.map(c=>c.name+' · '+c.caption).join(' / ');
      resource=URL.createObjectURL(recording(copy));audio.src=resource;audio.hidden=false;
      if(typeof MutationObserver!=='undefined') {
        observer=new MutationObserver(leave);
        observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-hidden']});
        document.addEventListener('visibilitychange',leave);
      }
      const started=audio.play();started?.catch(err=>{
        if(resource&&err.name!=='AbortError')status.textContent+=' Puedes usar el reproductor para iniciar el audio.';
      });
    }
    const index=el('div','','vt-grid');
    const addButtons=data.clips.map((clip,i)=>{
      const box=el('div','','vt-item'),line=el('div','','vt-controls');
      const listen=button('Escuchar',()=>play([i])),add=button('Añadir',()=>{sequence.push(i);update();listen.focus();});
      listen.setAttribute('aria-label','Escuchar '+clip.name);add.setAttribute('aria-label','Añadir '+clip.name);
      line.append(listen,add);box.append(el('h5',clip.name),line);index.append(box);return add;
    });
    const list=el('ol','','vt-board'),tools=el('div','','vt-toolbar');
    const run=button('Escuchar montaje',()=>play(sequence)),clear=button('Vaciar montaje',()=>{stop();sequence.length=0;update();addButtons[0].focus();});
    tools.append(run,clear);
    function update(focusAt=null) {
      list.replaceChildren();const rowControls=[];
      sequence.forEach((index,pos)=>{
        const item=el('li','','vt-row'),actions=el('div','','vt-controls'),name=data.clips[index].name;
        const up=button('Subir',()=>{stop();[sequence[pos-1],sequence[pos]]=[sequence[pos],sequence[pos-1]];update(pos-1);});
        const down=button('Bajar',()=>{stop();[sequence[pos+1],sequence[pos]]=[sequence[pos],sequence[pos+1]];update(pos+1);});
        const remove=button('Quitar',()=>{stop();sequence.splice(pos,1);update(Math.min(pos,sequence.length-1));if(!sequence.length)addButtons[index].focus();});
        up.disabled=pos===0;down.disabled=pos===sequence.length-1;
        for(const b of [up,down,remove])b.setAttribute('aria-label',b.textContent+' '+name);
        actions.append(up,down,remove);item.append(el('strong',name),actions);list.append(item);rowControls.push(remove);
      });
      addButtons.forEach((b,i)=>{b.disabled=sequence.includes(i);});
      list.hidden=!sequence.length;run.disabled=clear.disabled=!sequence.length;
      if(focusAt!==null)rowControls[focusAt]?.focus();
    }
    board.append(el('h5','Montaje de prueba'),list,tools,status,audio);
    root.append(index,board);update();return root;
  }

  function stripSketch(canvas,strip,landmarks,center) {
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const w=canvas.width,h=canvas.height;ctx.fillStyle='#252c2a';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#bec2ae';ctx.fillRect(8,11,w-16,h-22);
    ctx.fillStyle='#e1e0d3';
    for(let x=12;x<w-5;x+=15){ctx.fillRect(x,3,7,4);ctx.fillRect(x,h-7,7,4);}
    if(center) {
      ctx.save();ctx.translate(9,12);ctx.scale((w-18)/100,(h-24)/40);
      for(const [kind,a,b,d,e,tone] of strip.shapes) {
        ctx.strokeStyle=tone||'#465649';ctx.fillStyle=tone||'#465649';ctx.lineWidth=.85;
        if(kind==='rect')ctx.fillRect(a,b,d,e);
        else if(kind==='line'){ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(d,e);ctx.stroke();}
        else {ctx.beginPath();ctx.ellipse(a,b,d,e,0,0,Math.PI*2);kind==='ring'?ctx.stroke():ctx.fill();}
      }
      ctx.restore();return;
    }
    if(strip.ballAt===null){
      ctx.strokeStyle='#756f5c';ctx.strokeRect(w*.2,h*.23,w*.6,h*.51);
      ctx.fillStyle='#373b34';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText(strip.mark,w*.5,h*.56);return;
    }
    const y=h*.49;
    landmarks.forEach((label,i)=>{
      const x=w*(.14+.24*i);
      ctx.strokeStyle='#58695c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y+10);ctx.stroke();
      ctx.fillStyle='#273c36';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(label,x,h*.75);
    });
    const x=w*(.14+.24*strip.ballAt);
    ctx.fillStyle='#f5ebcb';ctx.strokeStyle='#2e463d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-7,8,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-6,y-11);ctx.lineTo(x+5,y-3);ctx.stroke();
  }
  function contacts(data) {
    const root=shell(data),panes=el('div','','vt-grid'),status=live();
    for(let side=0;side<2;side++) {
      let index=side,mode=0;const card=el('div','','vt-item'),img=canvas(360,116),read=el('p');
      const select=choose(side?'Tira derecha':'Tira izquierda',data.strips.map(s=>s.name),value=>{index=value;update(true);});
      select.querySelector('select').value=String(side);
      const tabs=picker(['Margen','Centro'],value=>{mode=value;update(true);});
      function update(announce=false) {
        const strip=data.strips[index];tabs.mark(mode);
        stripSketch(img,strip,data.landmarks,mode===1);
        read.textContent=mode?strip.center:strip.edge;
        if(announce)status.textContent=(side?'Derecha: ':'Izquierda: ')+strip.name+'. '+(mode?'Centro. ':'Margen. ')+read.textContent;
      }
      card.append(select,tabs.row,img,read);panes.append(card);update();
    }
    status.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    root.append(panes,status);return root;
  }

  function paths(data) {
    const root=shell(data),stops=new Map(data.stops.map(s=>[s.id,s])),visited=[data.start];
    const image=canvas(590,212),moves=el('div','','vt-controls'),log=live(),board=el('div','','vt-board');
    const undo=button('Deshacer tramo',()=>{visited.pop();update(true);});
    function draw() {
      const c=image.getContext('2d');if(!c)return;
      const w=image.width,h=image.height;c.fillStyle='#e5e6d3';c.fillRect(0,0,w,h);
      function point(id){const s=stops.get(id);return [s.x*w/100,s.y*h/100];}
      function line(a,b,color,width) {
        c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...point(a));c.lineTo(...point(b));c.stroke();
      }
      data.edges.forEach(([a,b])=>line(a,b,'#879486',3));
      visited.slice(1).forEach((id,i)=>line(visited[i],id,'#275c51',5));
      data.stops.forEach(s=>{
        const [x,y]=point(s.id),active=s.id===visited[visited.length-1];c.beginPath();c.arc(x,y,active?7:4,0,Math.PI*2);
        c.fillStyle=active?'#b16f38':'#34534b';c.fill();c.fillStyle='#253f35';c.font='bold 15px system-ui';c.textAlign='center';c.fillText(s.name,x,y+20);
      });
    }
    function update(restore=false) {
      const current=visited[visited.length-1];moves.replaceChildren();
      const neighbors=data.edges.filter(e=>e.includes(current)).map(([a,b])=>a===current?b:a);
      for(const id of neighbors) {
        if(visited.includes(id))continue;
        const b=button(stops.get(id).name,()=>{visited.push(id);update(true);});
        moves.append(b);
      }
      if(!moves.childElementCount)moves.append(el('p','No quedan senderos sin recorrer desde esta parada.'));
      undo.disabled=visited.length<=1;log.textContent=visited.map(id=>stops.get(id).name).join(' → ')+'. '+stops.get(current).detail;
      draw();if(restore)(moves.querySelector('button')||undo).focus();
    }
    board.append(image,log);root.append(board,el('h5','Senderos desde tu parada'),moves,undo);update();return root;
  }
  window.ValdemarTalleres ||= {};
  Object.assign(window.ValdemarTalleres,{5:lookout,6:soundDesk,7:contacts,8:paths});
})();
