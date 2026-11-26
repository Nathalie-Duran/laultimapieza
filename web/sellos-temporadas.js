(() => {
  'use strict';
  const seals=[
    {world:'mapa',name:'Rosa de los Doce Rumbos',season:'Valdemar',color:'#71c6c3',ink:'#173f4c',motif:'brújula'},
    {world:'expedicion',name:'Medallón de Ámbar',season:'El Tablero de Ámbar',color:'#d99d51',ink:'#2f5744',motif:'medallón de latón y malaquita'},
    {world:'umbravia',name:'Farol de Umbravía',season:'Umbravía',color:'#abe0a5',ink:'#254746',motif:'farol de vidrio verde'},
    {world:'necropolis',name:'Disco del Sol Velado',season:'La Necrópolis del Sol Velado',color:'#e5b861',ink:'#254968',motif:'disco solar de oro y lapislázuli'}
  ];
  const esc=s=>String(s??'').replace(/[<>&"']/g,k=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[k]));
  const number=n=>String(n).padStart(2,'0');
  const point=(angle,r)=>{const a=(angle-90)*Math.PI/180;return (150+r*Math.cos(a)).toFixed(2)+' '+(150+r*Math.sin(a)).toFixed(2);};
  const wedge=(a,b,r)=>'M150 150 L'+point(a,r)+' A'+r+' '+r+' 0 0 1 '+point(b,r)+' Z';
  const arc=(a,b,r,t)=>'M'+point(a,r)+' A'+r+' '+r+' 0 0 1 '+point(b,r)+' L'+point(b,t)+' A'+t+' '+t+' 0 0 0 '+point(a,t)+' Z';
  function drawing(n) {
    const p='ss'+n,s=seals[n-1],gold='url(#'+p+'-gold)',stone='url(#'+p+'-stone)';
    let icon='';
    if(n===1){
      for(let i=0;i<8;i++){
        const len=i%2?54:79;
        icon+='<g transform="rotate('+i*45+' 150 150)"><path d="M150 '+(150-len)+' L163 150 L150 144 Z" fill="'+gold+'"/><path d="M150 '+(150-len)+' L150 144 L137 150 Z" fill="#426b75" stroke="#d7bb85" stroke-width="1.2"/></g>';
      }
      icon+='<circle cx="150" cy="150" r="13" fill="'+gold+'"/><circle cx="150" cy="150" r="7" fill="'+stone+'"/>';
    }else if(n===2){
      icon='<path d="M150 62 211 99 226 161 185 223 115 223 74 161 89 99Z" fill="'+gold+'" stroke="#ffe0a3" stroke-width="2"/><path d="M150 74 202 105 214 160 180 211 120 211 86 160 98 105Z" fill="'+stone+'" stroke="#584629" stroke-width="3"/>';
      for(let i=0;i<4;i++){
        const k=i*9;icon+='<path d="M'+(99+k)+' '+(109+k)+' Q130 '+(85+k)+' '+(166-k/2)+' '+(108+k)+' T'+(202-k)+' '+(147+k/2)+' Q179 '+(156+k)+' '+(185-k)+' '+(181+k/2)+' T'+(130+k)+' '+(201-k/2)+'" fill="none" stroke="'+(i%2?'#c0ba79':'#73a47e')+'" stroke-width="2.3" opacity=".8"/>';
      }
      icon+='<path d="M150 109 178 133 176 167 150 190 124 167 122 133Z" fill="'+gold+'" stroke="#f5db91" stroke-width="2"/><path d="M150 118 166 135 150 176 135 136Z" fill="#c2792e"/><path d="M150 118 150 176 135 136Z" fill="#f7cc7a"/>';
    }else if(n===3){
      icon='<path d="M131 93 V83 Q131 58 150 58 Q169 58 169 83 V93" fill="none" stroke="'+gold+'" stroke-width="6"/><path d="M108 111 134 87 166 87 192 111 188 118 112 118Z" fill="'+gold+'" stroke="#472e22" stroke-width="2"/><path d="M117 119 183 119 176 187 150 204 124 187Z" fill="'+stone+'" stroke="'+gold+'" stroke-width="6"/><path d="M124 127 139 132 143 188 129 182Z" fill="#97c3a0"/><path d="M143 132 161 132 157 191 147 195Z" fill="#c7e6b2"/><path d="M165 131 177 126 172 183 161 189Z" fill="#719d80"/><path d="M150 182 C132 168 150 154 151 140 C161 153 158 159 159 164 C166 166 160 179 150 182Z" fill="#ffe59a"/><path d="M123 188 150 200 177 188 174 203 160 208 161 218 139 218 140 208 126 203Z" fill="'+gold+'" stroke="#584f3a" stroke-width="2"/>';
    }else{
      icon='<circle cx="150" cy="121" r="28" fill="'+gold+'" stroke="#eccc86" stroke-width="3"/>';
      for(const f of [false,true]){
        icon+='<g'+(f?' transform="translate(300 0) scale(-1 1)"':'')+'><path d="M141 165 Q102 139 68 116 Q80 157 112 178 Q124 186 141 182Z" fill="'+gold+'" stroke="#e4bf79" stroke-width="2"/>';
        for(let j=0;j<5;j++)icon+='<path d="M'+(77+j*7)+' '+(130+j*5)+' Q'+(86+j*8)+' '+(153+j*5)+' '+(113+j*6)+' '+(169+j*2)+'" fill="none" stroke="#345165" stroke-width="3"/>';
        icon+='</g>';
      }
      icon+='<ellipse cx="150" cy="167" rx="17" ry="25" fill="'+stone+'" stroke="'+gold+'" stroke-width="3"/><path d="M150 148V190M135 162Q150 173 165 162" stroke="#e5bb70" stroke-width="2" fill="none"/><circle cx="150" cy="145" r="7" fill="'+gold+'"/><path d="M147 193Q127 205 142 214M153 193Q173 205 158 214" fill="none" stroke="#c4a470" stroke-width="3"/>';
    }
    const marks=[],clips=[],parts=[];
    for(let i=0;i<60;i++){
      marks.push('<path d="M'+point(i*6,95)+' L'+point(i*6,i%5?98:103)+'"/>');
    }
    for(let i=0;i<12;i++){
      const angle=i*30,start=angle-15,end=angle+15,label=point(angle,124).split(' ');
      clips.push('<clipPath id="'+p+'-piece'+i+'"><path d="'+wedge(start,end,106)+'"/></clipPath>');
      parts.push('<g class="ss-piece" data-piece="'+(i+1)+'"><path class="ss-segment" d="'+arc(start+.8,end-.8,138,110)+'"/><g class="ss-reveal" clip-path="url(#'+p+'-piece'+i+')"><use href="#'+p+'-emblem"/></g><text x="'+label[0]+'" y="'+label[1]+'">'+number(i+1)+'</text></g>');
    }
    return '<svg viewBox="0 0 300 300" role="img" aria-label="'+esc(s.name+', '+s.motif+' de doce piezas')+'" focusable="false"><defs><linearGradient id="'+p+'-gold" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#846437"/><stop offset=".28" stop-color="#ffedb0"/><stop offset=".53" stop-color="#cb9953"/><stop offset=".78" stop-color="#f0d297"/><stop offset="1" stop-color="#83623a"/></linearGradient><radialGradient id="'+p+'-stone" cx=".3" cy=".25"><stop stop-color="'+s.color+'"/><stop offset=".68" stop-color="'+s.ink+'"/><stop offset="1" stop-color="#101c23"/></radialGradient>'+clips.join('')+'<g id="'+p+'-emblem"><circle cx="150" cy="150" r="106" fill="'+stone+'"/><circle cx="150" cy="150" r="91" fill="none" stroke="'+gold+'" stroke-width="1.5"/><g stroke="#eed29a" stroke-width="1.5">'+marks.join('')+'</g>'+icon+'</g></defs><circle cx="150" cy="150" r="144" fill="#162327" stroke="'+gold+'" stroke-width="3"/><circle cx="150" cy="150" r="109" fill="#1b262c" stroke="#9d845b"/><use class="ss-ghost" href="#'+p+'-emblem"/>'+parts.join('')+'</svg>';
  }
  function view(n){
    const s=seals[n-1];if(!s)return '';
    return '<section class="ss-seal" data-seal="'+n+'" aria-labelledby="ss-heading"><figure class="ss-art">'+drawing(n)+'</figure><div class="ss-copy"><p class="ss-kicker">Sello de temporada · '+esc(s.season)+'</p><h2 tabindex="-1" id="ss-heading">'+esc(s.name)+'</h2><p>Guarda el desenlace de cada juego para recuperar su pieza. Cuando reúnas las doce, podrás leer el epílogo de la temporada.</p><div class="ss-progress" role="status"><strong data-ss-count>Doce piezas por descubrir</strong><progress value="0" max="12" aria-label="Piezas recuperadas"></progress></div><div class="ss-actions"></div><details class="ss-list"><summary>Ver las doce piezas</summary><ol></ol></details><div class="ss-outcome"></div></div></section>';
  }
  function mount(n,bridge,access){
    const box=document.querySelector('.ss-seal[data-seal="'+n+'"]');
    if(!box||box.dataset.ssMounted)return;
    box.dataset.ssMounted='true';
    const s=seals[n-1],actions=box.querySelector('.ss-actions'),outcome=box.querySelector('.ss-outcome'),list=box.querySelector('.ss-list ol');
    const entries=n===1?(window.ValdemarCatalog?.items||[]):(window.MundosCatalogo||[]).filter(v=>v.world===s.world);
    const signed=()=>box.isConnected && bridge?.isSignedIn?.();
    function drawList(done){
      list.replaceChildren();
      for(let i=1;i<=12;i++){
        const li=document.createElement('li'),a=document.createElement('a'),tag=document.createElement('span');
        a.href='#'+s.world+'?lugar='+i;a.textContent=number(i)+' · '+(entries[i-1]?.title||'Juego '+i);
        tag.textContent=done.has(i)?'Recuperada':'Pendiente';li.dataset.won=String(done.has(i));
        li.append(a,tag);list.append(li);
      }
    }
    function btn(label,fn){
      const b=document.createElement('button');b.type='button';b.textContent=label;
      if(fn)b.addEventListener('click',fn);return b;
    }
    function draw(earned,complete){
      const done=new Set(earned.filter(x=>Number.isInteger(x)&&x>=1&&x<=12));
      for(const p of box.querySelectorAll('[data-piece]'))p.dataset.won=String(done.has(+p.dataset.piece));
      const whole=complete && done.size===12;
      box.dataset.complete=String(whole);
      if(whole)box.querySelector('.ss-copy>p:not(.ss-kicker)').textContent='Has reunido las doce piezas. El sello está completo y ya puedes leer el epílogo de la temporada.';
      box.querySelector('[data-ss-count]').textContent=done.size+' de 12 piezas recuperadas';
      box.querySelector('progress').value=done.size;
      actions.replaceChildren();drawList(done);
      if(!complete||done.size!==12)return;
      const read=btn('Leer el epílogo',async()=>{
        if(!signed()||read.disabled)return;
        if(outcome.firstChild && read.getAttribute('aria-expanded')==='true'){
          outcome.replaceChildren();read.setAttribute('aria-expanded','false');read.textContent='Leer el epílogo';return;
        }
        read.disabled=true;
        try{
          const result=await bridge.request('/api/valdemar/seals/'+n);
          if(!signed())return;
          if(typeof result.epilogue!=='string'||result.number!==n)throw Error('No se ha podido recuperar el epílogo.');
          const heading=document.createElement('h3');heading.textContent=result.title||'Epílogo';heading.tabIndex=-1;
          const lines=result.epilogue.trim().split(/\n\s*\n|\r?\n/).filter(Boolean).map(t=>{const p=document.createElement('p');p.textContent=t;return p;});
          outcome.replaceChildren(heading,...lines);read.textContent='Cerrar el epílogo';read.setAttribute('aria-expanded','true');heading.focus({preventScroll:true});
        }catch(error){
          if(!signed())return;
          const note=document.createElement('p');note.setAttribute('role','status');note.textContent=error.message||'No se ha podido recuperar el epílogo.';outcome.replaceChildren(note);
        }finally{read.disabled=false;}
      });read.className='ss-open';read.setAttribute('aria-expanded','false');read.setAttribute('aria-controls','ss-private');outcome.id='ss-private';
      actions.append(read);
    }
    drawList(new Set());
    if(!signed()){
      const enter=btn('Entrar para ver mis piezas');enter.dataset.action='auth-login';actions.append(enter);return;
    }
    box.querySelector('[data-ss-count]').textContent='Consultando tus piezas…';
    async function load(first){
      try{
        const state=await (first||bridge.request('/api/valdemar/seasons'));if(!signed())return;
        const seal=state.seasons?.find(item=>item.number===n)?.seal;
        if(!seal || !Array.isArray(seal.earned))throw Error('No se ha podido consultar el sello.');
        draw(seal.earned,seal.complete===true);
      }catch{
        if(!signed())return;
        box.querySelector('[data-ss-count]').textContent='No se ha podido consultar el sello.';
        actions.replaceChildren(btn('Volver a consultar',()=>{actions.replaceChildren();load();}));
      }
    }
    load(access);
  }
  window.SellosTemporada=Object.freeze({view,mount});
})();
