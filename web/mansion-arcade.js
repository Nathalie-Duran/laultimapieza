(() => {
  'use strict';
  const endpoint='/api/valdemar/mansion/arcade';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const keyCount=n=>n===1?'1 llave':n+' llaves';
  const clues=[
    ['♟','Peón de ébano con un arañazo en la cabeza.'], ['⚿','Llave de bronce con el ojo cuadrado.'],
    ['☽','Luna de plata con dos perforaciones en el borde.'], ['☾','Luna lisa con un engaste de cobre.'],
    ['⚙','Rueda de caja de música con un diente roto.'], ['♞','Caballo negro sobre una peana de nogal.'],
    ['✂','Tijeras de bordar con una pluma grabada.'], ['⚓','Ancla de latón con una cuerda enrollada.'],
    ['♜','Torre de ajedrez con una ventana roja.'], ['⚓','Ancla pequeña cuyo cabo fue cortado al ras.'],
    ['✥','Aguja de solapa en forma de flor.'], ['♘','Caballo de marfil con la peana rajada.']
  ];
  const fragments=[
    ['h','Retiré el papel azul y encajé la hebilla en el broche del cuaderno.'],
    ['z','Fue en el zaguán donde encontré un sobre intacto. Todavía tenía el lacre.'],
    ['b','Oí el chasquido del broche. Guardé el cuaderno en el escritorio.'],
    ['l','Al levantar el lacre descubrí una hebilla envuelta en papel azul.']
  ];
  const rooms=[
    ['✶','estrella de seis puntas'],['☾','luna creciente','●','luna llena'],['♜','torre de ajedrez'],
    ['♧','trébol','♤','pica'],['◷','reloj de pared'],['✉','sobre cerrado'],
    ['♕','corona'],['♫','dos notas musicales'],['⚓','ancla','⚿','llave']
  ];
  const pipes=[[1],[1,2],[2],[],[0,1,3],[0,1],[1],[1,2],[]];
  const joints=[1,4,5,7],directions=['norte','este','sur','oeste'];
  const pipeSigns={'01':'└','02':'│','03':'┘','12':'┌','13':'─','23':'┐','012':'├','013':'┴','023':'┤','123':'┬'};
  const initial={
    archivo:()=>({words:['',''],offset:0}),
    relojero:()=>({teeth:[0,0,0]}),
    museo:()=>({items:[],examined:null}),
    cartas:()=>({order:[],message:''}),
    jardin:()=>({turns:[0,0,0,0]}),
    espejo:()=>({items:[]})
  };
  const attempt={
    archivo:s=>s.words, relojero:s=>s.teeth, museo:s=>s.items,
    cartas:s=>({order:s.order,message:s.message}), jardin:s=>s.turns, espejo:s=>s.items
  };
  function archive(s) {
    const guide=[...alphabet].map((letter,i)=>'<span><small>'+letter+'</small><b>'+alphabet[(i+s.offset)%26]+'</b></span>').join('');
    return `<p>La archivera avanzaba una letra por cada muesca del sello. La primera tira lleva tres muescas. La segunda lleva cinco. Recupera las palabras originales con su alfabeto de 26 letras.</p>
      <label>Desplazamiento del alfabeto <select data-field="offset">${Array.from({length:26},(_,i)=>'<option value="'+i+'"'+(s.offset===i?' selected':'')+'>'+i+'</option>').join('')}</select></label>
      <p class="ma-small">Arriba, letra original. Abajo, letra cifrada.</p><div class="ma-alphabet">${guide}</div>
      <div class="ma-columns">${['OXQD','SFHFW'].map((text,i)=>`<label class="ma-slip"><small>Sello ${i+1} · ${i?5:3} muescas</small><strong>${text}</strong>Palabra original <input maxlength="24" autocomplete="off" data-field="word${i}" value="${esc(s.words[i])}"></label>`).join('')}</div>`;
  }
  function clock(s) {
    return `<p>La rueda de entrada tiene 12 dientes. La rueda central gira una vez por cada dos vueltas de la entrada. Su piñón gira con ella y da tres vueltas por cada vuelta de la salida. El grabado de la platina indica que los dientes del piñón y de la rueda de salida suman 48.</p>
      <div class="ma-gears">${['Rueda central','Piñón central','Rueda de salida'].map((label,i)=>`<label><span class="ma-gear" aria-hidden="true">⚙<b>${s.teeth[i]||'·'}</b></span>${label}<select data-field="gear${i}"><option value="0">Dientes…</option>${[12,18,24,30,36].map(v=>'<option value="'+v+'"'+(v===s.teeth[i]?' selected':'')+'>'+v+' dientes</option>').join('')}</select></label>`).join('')}</div><p class="ma-small">En dos ruedas engranadas, la rueda con más dientes gira más despacio.</p>`;
  }
  function museum(s) {
    const item=(glyph,detail,i)=>`<button type="button" data-act="look" data-value="${i}" aria-label="Examinar vitrina ${i+1}" class="ma-object ${s.items.includes(i)?'ma-selected':''}"><b aria-hidden="true">${glyph}</b><small>Vitrina ${i+1}${s.items.includes(i)?' · marcada':''}</small></button>`;
    const i=s.examined;
    return `<p>El inventario pide una luna de plata con dos perforaciones, un ancla sin cabo y un caballo blanco con la peana rajada. Examina las vitrinas y marca las tres piezas de la lista.</p>
      <div class="ma-vitrines">${clues.map(([g,d],n)=>item(g,d,n)).join('')}</div>
      <div class="ma-inspect" aria-live="polite">${i===null?'Elige una vitrina para acercar la lupa.':`<strong>Vitrina ${i+1}</strong> ${clues[i][1]} <button data-act="mark" type="button">${s.items.includes(i)?'Quitar marca':'Marcar pieza'}</button>`}</div><p class="ma-small">Piezas marcadas · ${s.items.length} de 3</p>`;
  }
  function letters(s) {
    return `<p>Los cuatro fragmentos son de la misma carta. Sigue el recorrido de los objetos para ordenar lo que hizo Ada. En el margen dejó una indicación manuscrita.</p>
      <blockquote>«Cuando vuelva a leerse mi relato, quédate con la primera letra de cada fragmento».</blockquote>
      <div class="ma-fragments">${fragments.map(([key,text])=>`<button type="button" data-act="letter" data-value="${key}" ${s.order.includes(key)?'disabled':''}>${text}</button>`).join('')}</div>
      <ol class="ma-letter-order">${s.order.map(key=>'<li>'+fragments.find(f=>f[0]===key)[1]+'</li>').join('')}</ol>
      <button type="button" data-act="undo" ${s.order.length?'':'disabled'}>Retirar el último fragmento</button>
      <label>Mensaje secreto <input data-field="message" maxlength="24" autocomplete="off" value="${esc(s.message)}"></label>`;
  }
  function garden(s) {
    const fixed={0:['≈','Aljibe, salida este'],2:['❀','Rosal, toma sur'],3:['▧','Sendero de grava'],6:['✿','Lirios, toma este'],8:['▧','Sendero de grava']};
    return `<p>Gira las acequias para llevar el agua del aljibe al rosal y a los lirios. Cada boca de una acequia debe encajar con la boca de su vecina. El norte queda arriba.</p><div class="ma-garden">${pipes.map((ends,i)=>{
      const j=joints.indexOf(i);
      if(j===-1) return `<div class="ma-fixed"><b aria-hidden="true">${fixed[i][0]}</b><small>${fixed[i][1]}</small></div>`;
      const turned=ends.map(end=>(end+s.turns[j])%4).sort(), labels=turned.map(d=>directions[d]).join(', ');
      return `<button data-act="turn" data-value="${j}" type="button" aria-label="Girar acequia ${j+1}. Bocas al ${labels}"><b aria-hidden="true">${pipeSigns[turned.join('')]}</b><small>${labels}</small></button>`;
    }).join('')}</div>`;
  }
  function mirror(s) {
    const pane=(reflected)=>`<div><h4>${reflected?'Reflejo':'Salón'}</h4><div class="ma-pane ${reflected?'ma-reflected':''}">${rooms.map(([glyph,desc,other,otherDesc],i)=>{
      const selected=s.items.includes(i), name=(reflected&&otherDesc)||desc, symbol=(reflected&&other)||glyph;
      return `<button type="button" data-act="difference" data-value="${i}" aria-pressed="${selected}" aria-label="${reflected?'Reflejo':'Salón'}, ${name}" class="${selected?'ma-selected':''}"><b aria-hidden="true">${symbol}</b><small>${name}</small></button>`;
    }).join('')}</div></div>`;
    return `<p>El espejo invierte las posiciones como corresponde, pero tres objetos cambian de identidad. Marca esas tres parejas en cualquiera de los dos lados.</p><div class="ma-mirror">${pane(false)}${pane(true)}</div><p class="ma-small">Diferencias marcadas · ${s.items.length} de 3</p>`;
  }
  const screens={archivo:archive,relojero:clock,museo:museum,cartas:letters,jardin:garden,espejo:mirror};
  const checks={archivo:'Descifrar los sellos',relojero:'Poner el reloj en marcha',museo:'Cotejar el inventario',cartas:'Leer la carta',jardin:'Abrir la compuerta',espejo:'Comprobar el reflejo'};
  const feedback={
    archivo:'Uno de los sellos sigue cerrado. Busca la letra cifrada en la fila inferior con el desplazamiento de su tira.',
    relojero:'El reloj pierde el compás. Comprueba las dos relaciones de giro y la suma de dientes de la última pareja.',
    museo:'El inventario sigue incompleto. Revisa los detalles de las tres piezas marcadas.',
    cartas:'Ada aún no reconoce la carta. Revisa la sucesión de objetos y las iniciales de sus frases.',
    jardin:'Queda una boca sin conectar o un bancal seco. Recorre las acequias desde el aljibe.',
    espejo:'El reflejo sigue siendo extraño. Compara cada objeto con el de la columna opuesta.'
  };

  class MansionArcade extends HTMLElement {
    connectedCallback() {
      if(this.bound)return;
      this.bound=true;
      this.states={};
      this.addEventListener('click',event=>this.clickControl(event));
      this.addEventListener('input',event=>this.inputControl(event));
      this.load();
    }
    async load() {
      this.innerHTML='<section class="ma-panel"><h2>Minijuegos de la mansión</h2><p role="status">Abriendo la sala de juegos…</p></section>';
      try {
        const signed=window.GameAccountBridge?.isSignedIn()===true;
        this.preview=!signed;
        if(signed){
          try { this.games=(await window.GameAccountBridge.request(endpoint)).games; }
          catch(error){if(error.status!==403 && error.status!==402)throw error;this.preview=true;}
        }
        if(this.preview)this.games=(await import('./mansion-arcade-catalog.js')).mansionArcadeCatalog;
        this.show();
      } catch(error) {
        this.innerHTML='<section class="ma-panel"><h2>Minijuegos de la mansión</h2><p role="status">'+esc(error.message)+'</p><button type="button" data-act="retry">Volver a consultar</button></section>';
      }
    }
    focusControl(act,value) {
      const target=[...this.querySelectorAll('[data-act]')].find(el=>el.dataset.act===act && (value===undefined||el.dataset.value===String(value)));
      target?.focus();
    }
    show(focusTitle=false) {
      const game=this.games.find(g=>g.id===this.current);
      const back=this.hasAttribute('embedded')?'<button type="button" class="ma-back" data-act="return">Volver a la aventura</button>':'';
      if(!game) {
        this.innerHTML=`<section class="ma-panel"><h2 tabindex="-1">Minijuegos de la mansión</h2>
          <p class="ma-intro">Seis pruebas independientes en la casa de Ada. Puedes ganar hasta ocho llaves en total.${this.hasAttribute('embedded')?' Tu aventura continúa en la misma estancia cuando vuelvas.':''}</p>
          ${this.preview?'<p class="ma-access">La sala se abre al tener acceso al primer caso de Valdemar. <a href="/#planes">Ver el pase</a></p>':''}
          <div class="ma-cards">${this.games.map(g=>`<article><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><small>${g.solved?'Resuelto · recompensa recibida':keyCount(g.prize)+' al resolverlo'}</small>${this.preview?'':`<button type="button" data-act="open" data-value="${esc(g.id)}">${g.solved?'Volver a jugar':'Jugar'}<span class="ma-sr"> a ${esc(g.title)}</span></button>`}</article>`).join('')}</div>${back}</section>`;
      } else {
        this.innerHTML=`<section class="ma-panel"><h2 tabindex="-1">${esc(game.title)}</h2>
          ${screens[game.id](this.states[game.id])}<div class="ma-actions"><button type="button" class="ma-check" data-act="check" ${this.busy?'disabled':''}>${checks[game.id]}</button>
          <button type="button" data-act="back">Sala de minijuegos</button>${back}</div><p role="status" aria-live="polite">${esc(this.notice)}</p></section>`;
      }
      if(focusTitle)this.querySelector('h2')?.focus();
    }
    inputControl(event) {
      const field=event.target.dataset.field, state=this.states[this.current];
      if(!state || !field)return;
      const value=event.target.value;
      if(field.startsWith('word'))state.words[Number(field.slice(-1))]=value;
      else if(field==='message')state.message=value;
      else {
        if(field==='offset')state.offset=Number(value);
        else if(field.startsWith('gear'))state.teeth[Number(field.slice(-1))]=Number(value);
        this.notice='';
        this.show();
        this.querySelector('[data-field="'+field+'"]')?.focus();
      }
    }
    async check() {
      if(this.busy)return;
      const id=this.current;
      this.busy=true;
      const control=this.querySelector('[data-act="check"]');
      control.disabled=true;
      const status=this.querySelector('[role="status"]');
      status.textContent='Comprobando…';
      try {
        const result=await window.GameAccountBridge.request(endpoint,{id,attempt:attempt[id](this.states[id])},'POST');
        if(result.correct){
          this.games.find(g=>g.id===id).solved=true;
          this.states[id].complete=true;
          if(result.awarded)this.dispatchEvent(new CustomEvent('mansion-arcade-reward',{bubbles:true,detail:{awarded:result.awarded}}));
        }
        if(this.current===id)this.notice=result.correct?(result.awarded?'¡Resuelto! Has ganado '+keyCount(result.awarded)+'.':'¡Resuelto! Ya habías recibido las llaves de este minijuego.'):feedback[id];
      } catch(error) { if(this.current===id)this.notice=error.message; }
      finally {
        this.busy=false;
        if(this.current===id){this.show();this.focusControl('check');}
        else if(this.current){const other=this.querySelector('[data-act="check"]');if(other)other.disabled=false;}
      }
    }
    clickControl(event) {
      const btn=event.target.closest('button[data-act]');
      if(!btn || !this.contains(btn) || btn.disabled)return;
      const {act,value}=btn.dataset, state=this.states[this.current];
      if(act==='retry'){this.load();return;}
      if(act==='return'){
        const panel=this.closest('details');
        if(panel){panel.open=false;panel.querySelector('summary')?.focus();}
        this.dispatchEvent(new CustomEvent('mansion-arcade-close',{bubbles:true}));
        return;
      }
      if(act==='open'){
        this.current=value;
        if(!this.states[value] || this.states[value].complete)this.states[value]=initial[value]();
        this.notice='';this.show(true);return;
      }
      if(act==='back'){
        const old=this.current;this.current=null;this.show();this.focusControl('open',old);return;
      }
      if(act==='check'){this.check();return;}
      this.notice='';
      if(act==='look')state.examined=Number(value);
      if(act==='mark'||act==='difference'){
        const i=act==='mark'?state.examined:Number(value);
        if(state.items.includes(i))state.items=state.items.filter(n=>n!==i);
        else if(state.items.length<3)state.items.push(i);
        else this.notice='Ya hay tres marcas. Quita una para cambiar tu selección.';
      }
      if(act==='letter' && !state.order.includes(value))state.order.push(value);
      if(act==='undo')state.order.pop();
      if(act==='turn')state.turns[Number(value)]=(state.turns[Number(value)]+1)%4;
      this.show();
      if(act==='letter')this.querySelector('[data-act="letter"]:not(:disabled),[data-act="undo"]')?.focus();
      else if(act==='difference' && btn.closest('.ma-reflected'))this.querySelector('.ma-reflected [data-value="'+value+'"]')?.focus();
      else this.focusControl(act,value);
    }
  }
  if(!customElements.get('mansion-arcade'))customElements.define('mansion-arcade',MansionArcade);
})();
