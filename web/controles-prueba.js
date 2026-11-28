(() => {
  'use strict';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(label, run) {
    const node = element('button', label);
    node.type = 'button';
    node.addEventListener('click', run);
    return node;
  }
  function field(group, type, label) {
    const wrap = element('label', label);
    const input = element('input');
    input.type = type;
    input.required = true;
    if (type === 'number') input.step = 'any';
    else input.maxLength = 500;
    wrap.append(input); group.append(wrap);
    return input;
  }
  function material(action, title) {
    return action.materiales?.find(item => item.titulo?.toLowerCase() === title)?.texto;
  }
  function mapBounds(action) {
    const rows = action.materiales?.find(m => m.grafico?.tipo === 'cuadricula')?.grafico.filas;
    if (Array.isArray(rows) && rows.length && rows.every(row => typeof row === 'string' && row.length === rows[0].length) && rows[0].length) {
      return {w:rows[0].length, h:rows.length, rows};
    }
    const side = material(action, 'lado');
    const w = Number(material(action, 'ancho') || side), h = Number(material(action, 'alto') || side);
    if ([w,h].every(n => Number.isInteger(n) && n > 0 && n <= 64)) return {w,h};
    return null;
  }
  function coordinate(group, action) {
    const bounds = mapBounds(action);
    const holder = element('div', undefined, 'cp-map');
    if (bounds) group.append(holder);
    const fields = element('div', undefined, 'cp-coordinates'); group.append(fields);
    const x = field(fields, 'number', 'Coordenada X'), y = field(fields, 'number', 'Coordenada Y');
    x.step = '1'; y.step = '1';
    const read = () => [x.valueAsNumber,y.valueAsNumber];
    if (!bounds) return read;
    const {w,h,rows} = bounds;
    const spanX = Math.min(w,5), spanY = Math.min(h,5);
    let left = 0, top = 0;
    const board = element('div', undefined, 'cp-grid');
    board.style.gridTemplateColumns = 'repeat('+spanX+',minmax(2.75rem,1fr))';
    board.setAttribute('role','group'); board.setAttribute('aria-label','Casillas del plano');
    const status = element('output'); status.setAttribute('aria-live','polite');
    holder.append(element('p','Selecciona una casilla. En el plano puedes moverte con las flechas.'),board);
    const paging = element('div', undefined, 'cp-pages');
    const pages = [];
    function page(label, dx, dy) {
      const control = button(label, () => {
        left = Math.max(0,Math.min(w-spanX,left+dx)); top = Math.max(0,Math.min(h-spanY,top+dy));
        draw(); board.firstElementChild.focus();
      });
      pages.push({control,dx,dy}); paging.append(control);
    }
    if (w>spanX) { page('Oeste',-spanX,0); page('Este',spanX,0); }
    if (h>spanY) { page('Norte',0,-spanY); page('Sur',0,spanY); }
    if (pages.length) holder.append(paging);
    holder.append(status);
    function move(col,row,focus) {
      if (col<0||col>=w||row<0||row>=h) return;
      x.value=String(col); y.value=String(row);
      if (col<left||col>=left+spanX) left=Math.max(0,Math.min(w-spanX,col));
      if (row<top||row>=top+spanY) top=Math.max(0,Math.min(h-spanY,row));
      draw();
      if (focus) board.children[(row-top)*spanX+col-left].focus();
    }
    function draw() {
      board.replaceChildren();
      const [selectedX,selectedY]=read();
      const inView=selectedX>=left&&selectedX<left+spanX&&selectedY>=top&&selectedY<top+spanY;
      for (let row=top;row<top+spanY;row++) for(let col=left;col<left+spanX;col++) {
        const mark=rows?.[row]?.[col],label='X '+col+', Y '+row;
        const cell=button(mark||col+','+row,()=>move(col,row,true)),selected=col===selectedX&&row===selectedY;
        cell.setAttribute('aria-label',label+(mark?', '+mark:''));
        cell.setAttribute('aria-pressed',String(selected)); cell.title=label;
        cell.tabIndex=(inView?selected:col===left&&row===top)?0:-1;
        cell.addEventListener('keydown',event=>{
          const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
          if(d){event.preventDefault();move(col+d[0],row+d[1],true);}
        });
        board.append(cell);
      }
      for (const {control,dx,dy} of pages) control.disabled=(dx<0&&left===0)||(dx>0&&left+spanX===w)||(dy<0&&top===0)||(dy>0&&top+spanY===h);
      status.textContent=Number.isInteger(selectedX)&&Number.isInteger(selectedY)?'Casilla elegida: X '+selectedX+', Y '+selectedY:'';
    }
    for(const input of [x,y]) input.addEventListener('input',()=>{
      const [col,row]=read();
      if(Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&col<w&&row>=0&&row<h) move(col,row,false);
      else draw();
    });
    draw();return read;
  }

  function sequence(group, action) {
    const choices=action.opciones||[],palette=element('div',undefined,'cp-tools'),steps=element('ol',undefined,'cp-sequence');
    const input=field(group,'text','Secuencia (separa las piezas con punto y coma)');
    const read=()=>input.value.split(';').map(s=>s.trim()).filter(Boolean);
    const describe=id=>choices.find(item=>item.id===id)?.label||id;
    function set(pieces,focusAt) {
      input.value=pieces.join('; ');draw();
      if(focusAt!==undefined) (steps.children[Math.min(focusAt,steps.children.length-1)]?.querySelector('button:not(:disabled)')||input).focus();
    }
    function draw() {
      steps.replaceChildren();
      const values=read();
      values.forEach((id,index)=>{
        const row=element('li'),name=element('span',describe(id)),actions=element('div',undefined,'cp-tools');
        const change=(label,delta)=>{
          const control=button(label,()=>{
            const next=read(),[part]=next.splice(index,1);
            if(delta!==null)next.splice(index+delta,0,part);
            set(next,delta===null?index:index+delta);
          });
          control.setAttribute('aria-label',label+' '+describe(id)+', posición '+(index+1));
          control.disabled=delta!==null&&(index+delta<0||index+delta>=values.length);
          actions.append(control);
        };
        change('Antes',-1);change('Después',1);change('Quitar',null);
        row.append(name,actions);steps.append(row);
      });
    }
    for(const item of choices)palette.append(button(item.label,()=>set([...read(),item.id])));
    if(choices.length)group.append(element('p','Pulsa las piezas en el orden que quieras probar.'),palette);
    group.append(steps);input.addEventListener('input',draw);return read;
  }
  function gear(group,action,input) {
    const source=material(action,'pares');
    const pairs=typeof source==='string'?source.split('/').map(v=>Number(v.trim())):[];
    if(!pairs.length||pairs.length%2||!pairs.every(n=>Number.isInteger(n)&&n>0&&n<=500))return;
    const ratios=[1];
    for(let i=0;i<pairs.length;i+=2)ratios.push(ratios.at(-1)*pairs[i]/pairs[i+1]);
    if(!ratios.every(Number.isFinite))return;
    const bench=element('div',undefined,'cp-gears'),tools=element('div',undefined,'cp-tools'),display=element('output');
    let crank=0;const wheels=[];
    for(const [i,ratio] of ratios.entries()){
      const wheel=element('span','⚙','cp-gear');wheel.setAttribute('aria-hidden','true');bench.append(wheel);wheels.push({wheel,ratio,i});
    }
    function turn(direction){
      crank+=direction;
      for(const {wheel,ratio,i} of wheels)wheel.style.transform='rotate('+(crank*ratio*(i%2?-1:1)*360)+'deg)';
      display.textContent='Manivela: '+crank+' · Eje de salida: '+Number((crank*ratios.at(-1)).toPrecision(8))+' vueltas';
      input.value=String(crank*ratios.at(-1));
    }
    tools.append(button('Retroceder una vuelta',()=>turn(-1)),button('Dar una vuelta',()=>turn(1)));
    display.setAttribute('aria-live','polite');
    group.append(bench,tools,display);
  }
  function switches(group,action,input) {
    const source=material(action,'interruptores'),layout=material(action,'puertas'),output=material(action,'salida')?.trim();
    const entries=source?.split(/,\s*/).map(pair=>/^([\w-]+)\s*=\s*[01]$/.exec(pair.trim())?.[1]);
    const gateRows=layout?.split(/\s*\/\s*/).map(row=>{
      const gate=new Map(row.split(/,\s*/).map(part=>part.split(/\s*=\s*/)));
      return {id:gate.get('id'),op:gate.get('tipo'),a:gate.get('a'),b:gate.get('b')};
    });
    const wires=new Set(entries);
    const valid=entries?.length&&entries.every(Boolean)&&gateRows?.length&&gateRows.every(g=>{
      if(!g.id||wires.has(g.id)||!['AND','OR','XOR','NOT'].includes(g.op)||!wires.has(g.a)||(g.op!=='NOT'&&!wires.has(g.b)))return false;
      wires.add(g.id);return true;
    });
    if(valid&&wires.has(output)){
      const plate=element('div',undefined,'cp-circuit'),sources=element('div',undefined,'cp-tools');
      const gates=element('div',undefined,'cp-gates'),status=element('output'),contacts=new Map();
      status.setAttribute('aria-live','polite');
      const lamps=gateRows.map(g=>{
        const lamp=element('span','·','cp-gate');
        lamp.title=g.id+' = '+g.op+' ('+[g.a,g.b].filter(Boolean).join(', ')+')';gates.append(lamp);return lamp;
      });
      function measure(){
        const volts=new Map();
        for(const [id,key] of contacts)volts.set(id,Number(key.getAttribute('aria-pressed')==='true'));
        for(const [index,g] of gateRows.entries()){
          const a=volts.get(g.a),b=volts.get(g.b);
          const value=g.op==='NOT'?1-a:g.op==='AND'?a&b:g.op==='OR'?a|b:a^b;
          volts.set(g.id,value);
          lamps[index].textContent=g.a+' '+g.op+(g.b?' '+g.b:'')+' → '+g.id+' · '+value;
          lamps[index].setAttribute('data-lit',String(value));
        }
        return volts.get(output);
      }
      for(const id of entries){
        const contact=button('',()=>{
          const on=contact.getAttribute('aria-pressed')!=='true';
          contact.setAttribute('aria-pressed',String(on));contact.textContent=id+' · '+Number(on);
          measure();status.textContent='';input.value='';
        });
        contact.setAttribute('aria-pressed','false');contact.textContent=id+' · 0';contacts.set(id,contact);sources.append(contact);
      }
      const probe=button('Medir salida '+output,()=>{
        input.value=String(measure());status.textContent='Lectura en '+output+': '+input.value;
      });
      plate.append(element('p','Ajusta los interruptores según las evidencias y mide la salida.'),sources,gates,probe,status);
      group.append(plate);measure();return;
    }
    const plate=element('div',undefined,'cp-tools');
    const choices=[['Circuito abierto',0],['Circuito cerrado',1]];
    const contacts=choices.map(([name,value])=>{
      const control=button(name,()=>{input.value=String(value);sync();});
      plate.append(control);return control;
    });
    function sync(){contacts.forEach((node,i)=>node.setAttribute('aria-pressed',String(input.value===String(i))));}
    input.addEventListener('input',sync);sync();group.append(plate);
  }
  function lamp(group,action) {
    const inks=action.materiales?.find(m=>m.grafico?.tipo==='tintas')?.grafico.marcas;
    if(!Array.isArray(inks)||!inks.length)return;
    const lamp=element('div',undefined,'cp-light'),marks=element('div',undefined,'cp-marks'),tools=element('div',undefined,'cp-tools');
    const status=element('output');status.setAttribute('aria-live','polite');
    const filters=[...new Set(inks.map(ink=>ink.luz))],controls=[];
    function illuminate(filter){
      controls.forEach(([id,node])=>node.setAttribute('aria-pressed',String(filter===id)));
      marks.replaceChildren();
      for(const ink of inks){
        const mark=element('span',ink.luz===filter?ink.letra:'·');mark.setAttribute('aria-hidden','true');marks.append(mark);
      }
      status.textContent=filter?'Marcas visibles: '+inks.filter(ink=>ink.luz===filter).map(ink=>ink.letra).join(' '):'Lámpara apagada';
    }
    for(const filter of filters){const lens=button(filter,()=>illuminate(filter));controls.push([filter,lens]);tools.append(lens);}
    lamp.append(element('p','Coloca un filtro sobre la inscripción.'),tools,marks,status);
    group.append(lamp);illuminate(null);
  }
  function montar(host, action) {
    const control=action?.controles?.[0];if(!control)return null;
    const group=element('fieldset',undefined,'cp-control');
    group.append(element('legend',control.label||'Tu respuesta'));host.append(group);
    if(control.tipo==='punto')return coordinate(group,action);
    if(control.tipo==='lista')return sequence(group,action);
    if(action.mecanica==='ultravioleta')lamp(group,action);
    if(control.tipo==='rumbo'||(control.tipo==='texto'&&action.opciones?.length)){
      const select=element('select'),wrap=element('label',control.tipo==='rumbo'?'Orientación':'Selecciona una opción');
      select.required=true;const blank=element('option','Elige una opción');blank.value='';select.append(blank);
      const directions=[['N','Norte'],['E','Este'],['S','Sur'],['O','Oeste']].map(([id,label])=>({id,label}));
      for(const {id,label} of control.tipo==='rumbo'?directions:action.opciones){const option=element('option',label);option.value=id;select.append(option);}
      wrap.append(select);group.append(wrap);return ()=>select.value;
    }
    const numeric=control.tipo==='numero';
    const input=field(group,numeric?'number':'text',numeric?'Lectura del instrumento':'Escribe tu respuesta');
    if(action.mecanica==='engranajes')gear(group,action,input);
    if(action.mecanica==='circuito')switches(group,action,input);
    return ()=>numeric?input.valueAsNumber:input.value.trim();
  }
  window.ControlesPrueba=Object.freeze({montar});
})();
