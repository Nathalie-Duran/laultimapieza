/* Field desks use only the stage delivered by the game and send its option ids. */
(() => {
  'use strict';
  const desks = {
    13: ['Mesa del práctico', 'Trazador de canales', 'Carta de navegación', 2,
      ['Sella el billete de embarque','Ajusta la ventana de paso','Traza el recorrido de la lancha','Amarra el bulto al albarán','Une los justificantes del porte','Marca la llegada de las botellas']],
    14: ['Cúpula de Cobre', 'Portaplacas del observatorio', 'Negativo de trabajo', 3,
      ['Encuadra la constelación','Ajusta el tiempo de exposición','Encadena las copias del negativo','Proyecta el negativo','Firma las atribuciones','Mueve el puntero de la rueda']],
    15: ['Terrazas de Musgo', 'Distribuidor de acequias', 'Cuaderno de riego', 1,
      ['Localiza la entrada de agua','Ensaya el reparto de jarras','Conduce la gota de agua','Empareja los ensayos de las terrazas','Acopla la rueda a su cometido','Escoge la abeja mensajera']],
    16: ['Estación de Pizarra', 'Palanca de maniobra', 'Hoja de circulación', 2,
      ['Desvía la aguja al ramal','Pon en hora el reloj del puesto B','Acopla los vagones','Etiqueta la carga depositada','Estampa el recibo del turno','Gira el billete del álbum']],
    17: ['Puerta de las cien sombras', 'Gnomon de la cantera', 'Calco del arco', 1,
      ['Asienta la base de piedra','Lee el borde de la sombra','Da las órdenes de relevo','Traslada la plantilla de sombra','Monta el expediente del relevo','Superpón los recortes de la ventana']],
    18: ['Mercado de los pesos huecos', 'Balanza del contraste', 'Acta del fiel', 2,
      ['Descuenta la tara','Contrasta el peso acuñado','Equilibra el lote','Pasa la pieza de mano en mano','Precinta los dos comprobantes','Canjea la bolsa de fichas']],
    19: ['Puente colgante', 'Cilindro de registro', 'Banda del fonógrafo', 0,
      ['Compara la llamada y su eco','Sitúa el relevo de la voz','Enlaza los puestos de escucha','Marca la distancia entre avisos','Monta el texto de la placa','Perfora la tira del carillón']],
    20: ['Cámara de la marea quieta', 'Reglas del mareógrafo', 'Registro de las lunas', 0,
      ['Alinea las escalas de agua','Busca la subida en el registro','Abre el recorrido del aliviadero','Recoge las jarras por turno','Fija las marcas de escurrimiento','Haz avanzar los discos lunares']],
    21: ['Biblioteca de las semillas', 'Prensa de la botánica', 'Ficha del herbario', 3,
      ['Guarda la muestra en su sobre','Cose la genealogía de la semilla','Empareja las bandejas de ensayo','Sitúa las dos floraciones','Sella el sobre de reparto','Injerta la pieza del mosaico']],
    22: ['Orilla de las caravanas', 'Visor de acetatos', 'Cuaderno del guía', 0,
      ['Voltea el perfil de los carros','Sincroniza las dos guardias','Carga provisiones para el trayecto','Sigue el único sobre','Fija los indicios del espejismo','Encadena los sellos de trueque']],
    23: ['Teatro de los vientos', 'Órgano de la cornisa', 'Partitura de escucha', 1,
      ['Coloca el final en el atril','Afina los dos tubos','Orienta las bocas de la cornisa','Monta la secuencia del telón','Empareja los ensayos de compuertas','Marca el pulso del apuntador']],
    24: ['Taller del ámbar', 'Marco de cuatro guías', 'Plantilla del taller', 3,
      ['Prueba un útil sobre el desgaste','Encaja las firmas en el marco','Monta la ventana del ámbar','Acciona los mandos por turnos','Adjunta las dos pruebas del taller','Encadena las losetas del patio']]
  };
  // Number of physical places on each original device, in story order; never carries a solution.
  const capacities = [
    [1,1,3,1,2,3],[1,1,4,1,2,1],[1,1,4,2,1,1],[1,1,3,2,1,1],
    [1,1,3,1,2,2],[1,1,2,3,2,1],[1,1,3,1,2,2],[1,1,4,1,2,1],
    [1,3,2,1,1,1],[2,1,1,4,2,3],[1,2,1,4,2,1],[1,1,4,3,2,4]
  ];
  const node = (tag,cls,text) => {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text!=null)n.textContent=text;
    return n;
  };
  function button(label,fn,cls) {
    const b=node('button',cls,label); b.type='button'; b.addEventListener('click',fn); return b;
  }
  function visible(material,role) {
    return role!=='A' && role!=='B' || material.role==null || material.role==='AB' ||
      material.role===role || material.role===(role==='A'?1:2);
  }
  const cleaned = value => String(value||'').trim();
  function recordLine(materials, label) {
    return materials.find(m=>m.label===label)?.body || '';
  }
  const worksheets={
    13:[['Billete del correo','A'],['Relojes del muelle','AB'],null,['Pesaje de la carga','AB'],['Recibo del porte','A']],
    14:[['Negativos del observatorio','A'],['Reloj de exposición','AB'],['Copias de la placa','AB'],null,['Firmas del observatorio','A']],
    15:[['Tiras indicadoras de humedad','A'],null,['Canaleta de las terrazas','AB'],['Muestras del ensayo','B'],['Eje de la rueda','A']],
    16:[['Eje del convoy','A'],['Relojes de los puestos','AB'],null,['Muestra de la carga','A'],['Resguardos ferroviarios','B']],
    17:[['Calco de la base','A'],null,['Relevo de los canteros','AB'],['Plantilla de sombra','A'],['Fotografía de la cantera','A']],
    18:[['Caja del lote','AB'],['Improntas de las piezas','A'],null,['Sellos de custodia','A'],['Lacre del cierre','A']],
    19:[null,['Mapa de enlaces','A'],['Tiras del puesto de escucha','AB'],['Relojes de las guardias','AB'],['Placa conmemorativa','AB']],
    20:[null,['Cuaderno de mareas','A'],['Canales de la cámara','A'],['Jarras de medición','AB'],['Borde húmedo de la poza','A']],
    21:[['Cápsula del herbario','AB'],['Sobres de la biblioteca','AB'],['Bandejas de siembra','B'],null,['Último sobre de semillas','AB']],
    22:[null,['Relojes de la guardia','AB'],['Carta de ruta y provisiones','AB'],['Sellos de correo','A'],['Acetatos de la orilla','A']],
    23:[['Copias de la partitura','A'],null,['Compuertas de la cornisa','A'],['Polea del telón','AB'],['Bandas de los ensayos','B']],
    24:[['Útiles del taller','B'],['Marco de las firmas','A'],['Guías de montaje','A'],null,['Acta y materiales del taller','AB']]
  };
  function figureFrom(id,step,role,stage) {
    const plate=worksheets[id][step],side=step===5;
    const permitted=plate && (!role || plate[1]==='AB'||plate[1]===role);
    const title=side?stage.title:permitted?plate[0]:desks[id][1];
    const figure=node('figure','rx-portrait'), img=node('img');
    img.src=side?'/reto-objeto-'+id+'.webp':permitted?'/ruta-lamina-'+id+'-'+(step+1)+'.webp':'/ruta-instrumento-'+id+'.webp';
    img.alt=title; img.decoding='async';
    const zoom=button('Ampliar',()=>{
      const dialog=node('dialog','rx-zoom'),head=node('div','rx-zoom-head'),copy=img.cloneNode();
      const close=button('Cerrar',()=>dialog.close(),'rx-switch');
      head.append(node('h3',null,title),close);dialog.append(head,copy);dialog.setAttribute('aria-label',title);
      figure.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(zoom.isConnected)zoom.focus();},{once:true});dialog.showModal();close.focus();
    },'rx-zoom-key');
    zoom.setAttribute('aria-label','Ampliar ilustración · '+title);figure.append(img);
    if(typeof HTMLDialogElement!=='undefined' && HTMLDialogElement.prototype.showModal)figure.append(zoom);
    return figure;
  }
  function readout(text='') {
    const out=node('output','rx-readout',text); out.setAttribute('aria-live','polite'); return out;
  }
  function dial(box,label,min,max,start,unit,change) {
    const group=node('label','rx-dial'), title=node('span',null,label), value=node('b');
    const input=node('input'); input.type='range';input.min=min;input.max=max;input.value=start;
    function sync(){value.textContent=input.value+unit;input.setAttribute('aria-valuetext',value.textContent);change(Number(input.value));}
    input.addEventListener('input',sync); title.append(value);group.append(title,input);box.append(group);
    value.textContent=start+unit;input.setAttribute('aria-valuetext',value.textContent);
    return input;
  }
  function switches(box,labels,action,initial) {
    const strip=node('div','rx-switches');
    const items=labels.map((label,i)=>button(label,()=>{mark(i);action(i);},'rx-switch'));
    function mark(i){items.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));}
    mark(initial);strip.append(...items);box.append(strip);
  }
  function mapGrid(box,cols,rows) {
    const grid=node('div','rx-plot');grid.setAttribute('aria-hidden','true');
    grid.style.setProperty('--columns',cols);grid.style.setProperty('--rows',rows);box.append(grid);
    return points=>{
      const marks=points.map(([x,y,label])=>{
        const mark=node('span','rx-mark',label);
        mark.style.gridColumn=String(x+1);mark.style.gridRow=String(rows-y);
        return mark;
      });grid.replaceChildren(...marks);
    };
  }
  // Each apparatus is a reversible scratch model. The archive provides the measurements.
  const experiments = {
    13(box,mat) {
      const chart=recordLine(mat,'Carta plegada del práctico');
      if(!chart)return 'Pide a quien lleva la carta que siga tu lectura de las compuertas en el trazador.';
      const routes=[...chart.matchAll(/(?:Boca (oeste|este)|ramal (un punto|dos puntos))\s*(?:→\s*)?([^.;\n]+)/gi)]
        .map(m=>({caption:m[1]?'Boca '+m[1]:'Poste · '+m[2],stops:m[3].split(/\s*→\s*/).map(cleaned)}));
      if(!routes.length)return '';
      const out=readout();let chosen=0;
      const draw=i=>{chosen=i;out.replaceChildren(...routes[i].stops.map(stop=>node('span','rx-stop',stop)));};
      switches(box,routes.map(r=>r.caption),draw,chosen);box.append(out);draw(chosen);
      return 'Abre un ramal en el trazador y sigue sus boyas. Contrasta la ruta con el turno de paso.';
    },
    14(box,mat) {
      const source=recordLine(mat,'Malla del negativo de la cámara');
      const stars=[...source.matchAll(/([ABC])=\((\d),(\d)\)/g)].map(m=>[+m[2],+m[3],m[1]]);
      if(!stars.length)return 'Describe la posición y la marca de cada estrella de tus placas a quien maneja el negativo.';
      const plot=mapGrid(box,6,5),out=readout();
      function reflect(i){
        const data=stars.map(([x,y,l])=>[(i===1||i===3)?5-x:x,(i===2||i===3)?4-y:y,l]);
        plot(data);out.textContent=data.map(([x,y,l])=>l+' ('+x+', '+y+')').join(' · ');
      }
      switches(box,['Original','Espejo vertical','Espejo horizontal','Media vuelta'],reflect,0);
      box.append(out);reflect(0);return 'Gira el portaplacas o invierte un eje. Coteja las tres posiciones y el detalle del negativo.';
    },
    15(box) {
      const out=readout();let available=0,west=0;
      function draw(){out.textContent=west>available?'Reparto imposible. Hay más jarras en el oeste que agua disponible.':'Oeste '+west+' jarras · Este '+(available-west)+' jarras';}
      dial(box,'Agua tras las pérdidas',0,12,0,' jarras',n=>{available=n;draw();});
      dial(box,'Desviar al oeste',0,12,0,' jarras',n=>{west=n;draw();});
      box.append(out);draw();return 'Descuenta las pérdidas de un turno, reparte el resto y repite el ensayo con el otro.';
    },
    16(box,mat) {
      const plate=recordLine(mat,'Placa de la salida');
      if(!plate)return 'Comparte la maniobra que registra tu libro. La otra persona puede probarla con los vagones de la placa.';
      const m=plate.match(/izquierda a derecha:\s*([^.]*)/i);
      if(!m)return '';
      const cars=m[1].split(/,\s*| y /).map(cleaned);
      const strip=node('div','rx-train'),out=readout();let inverted=false;
      strip.setAttribute('aria-hidden','true');
      function draw(){const order=inverted?cars.slice().reverse():cars;strip.replaceChildren(...order.map(n=>node('span','rx-wagon',n)));out.textContent='Desde este extremo · '+order.join(' → ');}
      box.append(strip);switches(box,['Leer desde la izquierda','Leer desde la derecha'],i=>{inverted=i===1;draw();},0);box.append(out);draw();
      return 'Lee la placa desde los dos extremos. Usa el libro de maniobras para decidir cuál vio el mozo.';
    },
    17(box,mat) {
      const raw=recordLine(mat,'Dos series de calibración');
      const series=raw.split('\n').slice(0,2).map(row=>[...row.matchAll(/(\d+) h:\s*(\d+)/g)].map(m=>[+m[2],m[1]]));
      if(!series[0]?.length)return 'Localiza el perno y el borde más próximo a los zapatos. Dicta sus marcas a quien tiene las series de calibración.';
      let mark=2,serie=0;const out=readout();
      function draw(){const hour=series[serie].find(s=>s[0]===mark)?.[1];out.textContent='Muesca '+mark+' · '+(hour?hour+' h en esta serie':'fuera de la escala de esta serie');}
      switches(box,['Serie I','Serie II'],i=>{serie=i;draw();},0);dial(box,'Borde de sombra',2,6,2,'',n=>{mark=n;draw();});
      box.append(out);draw();return 'Desliza el borde sobre las muescas y cambia la serie que estás leyendo.';
    },
    18(box) {
      let pieces=0,units=0; const out=readout(),balance=node('div','rx-balance');
      const beam=node('div','rx-beam'); balance.setAttribute('aria-hidden','true');balance.append(beam);box.append(balance);
      function weigh(){const weight=pieces+units;beam.style.transform='rotate('+Math.max(-16,Math.min(16,(weight-48)*1.3))+'deg)';out.textContent=weight+' unidades frente a 48 · '+(weight===48?'en equilibrio':weight<48?'falta peso':'sobra peso');}
      dial(box,'Masa real de las piezas acuñadas',0,60,0,' u',v=>{pieces=v;weigh();});
      dial(box,'Piezas pequeñas',0,30,0,' u',v=>{units=v;weigh();});box.append(out);weigh();
      return 'Ensaya un montaje sobre el plato. Usa la masa del control para cada pieza acuñada.';
    },
    19(box,mat) {
      const source=recordLine(mat,'Cilindro oeste');
      if(!source)return 'Describe qué puede cambiar el eco local. La otra persona tiene la toma del cilindro.';
      const sound=node('div','rx-waves'),out=readout();let cursor=0;
      const segments=source.replace(/[«»]/g,'').split(/[;.]/).map(cleaned).filter(Boolean);
      const bars=segments.map((s,i)=>node('span','rx-wave rx-wave-'+i));sound.setAttribute('aria-hidden','true');sound.append(...bars);box.append(sound);
      function draw(){bars.forEach((bar,i)=>bar.classList.toggle('rx-current',i===cursor));out.textContent=segments[cursor]||'';}
      dial(box,'Cabezal de lectura',1,Math.max(1,segments.length),1,'',n=>{cursor=n-1;draw();});box.append(out);draw();
      return 'Recorre el cilindro con el cabezal. Compara duración, intensidad y altura con la prueba de eco.';
    },
    20(box) {
      let int=0,port=0,reading=0;const out=readout();
      function draw(){out.textContent='A la altura '+reading+' de la pared, la escala del puerto marca '+(port+reading-int)+'.';}
      dial(box,'Clavo en la regla interior',0,14,0,'',v=>{int=v;draw();});
      dial(box,'Clavo en la regla del puerto',0,14,0,'',v=>{port=v;draw();});
      dial(box,'Marca que quieres trasladar',0,14,0,'',v=>{reading=v;draw();});
      box.append(out);draw();return 'Alinea el mismo punto fijo en las dos reglas y desplaza la lectura hasta la luna.';
    },
    21(box) {
      const out=readout();let a=1,b=1;
      function draw(){out.textContent='Loma · '+a+' de mayo / Vega · '+b+' de mayo. Distancia: '+Math.abs(b-a)+' días.';}
      dial(box,'Fecha de floración en Loma',1,31,1,' de mayo',v=>{a=v;draw();});
      dial(box,'Fecha de floración en Vega',1,31,1,' de mayo',v=>{b=v;draw();});
      box.append(out);draw();return 'Coloca una hoja prensada sobre cada fecha de floración. Las fiestas y la regla de recuento están en los expedientes.';
    },
    22(box,mat) {
      if(!recordLine(mat,'Cuaderno alto'))return 'Explica qué direcciones conserva el reflejo. Quien tiene el cuaderno puede probar los giros en su visor.';
      const out=readout(),pane=node('div','rx-caravan'),profile=node('div','rx-cars');
      ['Caja','Muesca','Estandarte'].forEach((n,i)=>{const shape=node('span','rx-cart rx-cart-'+i);shape.title=n;profile.append(shape);});
      pane.setAttribute('aria-hidden','true');pane.append(profile);box.append(pane);
      function draw(i){profile.style.transform=['none','scaleY(-1)','scaleX(-1)','rotate(180deg)'][i];out.textContent=['Caja a la izquierda · muesca y punta arriba','Caja a la izquierda · muesca y punta abajo','Caja a la derecha · muesca y punta arriba','Caja a la derecha · muesca y punta abajo'][i];}
      switches(box,['Sin giro','Voltear arriba y abajo','Voltear izquierda y derecha','Media vuelta'],draw,0);box.append(out);draw(0);
      return 'Voltea el acetato. Observa por separado el orden de los carros, la muesca y la punta.';
    },
    23(box,mat) {
      const rows=recordLine(mat,'Prueba de tubos').split('\n').map(r=>r.split('|').map(cleaned)).filter(r=>r.length===2);
      if(!rows.length)return 'Explica el criterio del técnico. La otra persona puede abrir los tubos en su registro.';
      const bank=node('div','rx-pipes'),out=readout(),held=new Set();
      rows.forEach(([name,freq])=>{const b=button(name,()=>{
        if(held.has(name))held.delete(name);else held.add(name);
        b.setAttribute('aria-pressed',String(held.has(name)));
        out.textContent=rows.filter(([key])=>held.has(key)).map(([key,hz])=>key+' · '+hz+' Hz').join(' / ')||'Todos los tubos cerrados';
      },'rx-pipe');b.style.setProperty('--height',Math.round(48+6000/(Number(freq)||300))+'px');b.setAttribute('aria-pressed','false');bank.append(b);});
      box.append(bank,out);out.textContent='Todos los tubos cerrados';return 'Abre y cierra las compuertas. Compara las frecuencias de los tubos abiertos con las componentes de la grabación.';
    },
    24(box,mat) {
      const movements=recordLine(mat,'Movimientos grabados');
      if(!movements)return 'Indica la lectura exigida por el acta y en qué momento debe abrirse la ventana a quien opera las guías.';
      const out=readout(),history=[];let n=2,e=2,s=2,w=2,opened=false;
      function draw(){out.textContent='N '+n+' · E '+e+' · S '+s+' · O '+w+(opened?' · ventana abierta':' · ventana cerrada');}
      function move(name){
        if(opened){out.textContent='La ventana está abierta. Reinicia la maqueta para cambiar los mandos.';return;}
        if(history.includes(name)){out.textContent='Ese mando ya está encajado.';return;}
        if(name==='Hoja'&&!history.includes('Aro')){out.textContent='Hoja necesita el apoyo de Aro.';return;}
        history.push(name);
        if(name==='Aro'||name==='Hoja'){n++;s++;}
        if(name==='Nido'){w++;e++;} if(name==='Vela')e+=2;
        if(name==='Puente')opened=true;draw();
      }
      const row=node('div','rx-switches');for(const name of ['Aro','Hoja','Puente','Vela','Nido'])row.append(button(name,()=>move(name),'rx-switch'));
      row.append(button('Reiniciar maqueta',()=>{n=e=s=w=2;opened=false;history.length=0;draw();},'rx-switch'));
      box.append(row,out);draw();return 'Ensaya los movimientos y observa cuánto desplazan las guías. Al abrir la ventana se fija la lectura.';
    }
  };
  // Experiments in the optional rooms use a precise transcription of the visible object.
  const extraExperiments={
    13(box,mat){
      const out=readout();let departure=0,duration=0;
      dial(box,'Vuelta de salida',0,12,0,'',n=>{departure=n;draw();});
      dial(box,'Duración del canal',0,12,0,' vueltas',n=>{duration=n;draw();});
      function draw(){out.textContent='Línea de llegada · vuelta '+(departure+duration);}
      box.append(out);draw();return 'Haz correr cada botella desde su propia salida y apunta su vuelta de llegada.';
    },
    14(box,mat){
      const ring=recordLine(mat,'Anillo en sentido horario').split('→').map(cleaned).filter(Boolean);ring.pop();
      if(ring.length!==8)return 'Dicta los giros de la canción a quien lleva el anillo.';
      let i=ring.indexOf('Flor');if(i<0)i=0;const out=readout(),row=node('div','rx-switches');
      function turn(delta){i=(i+ring.length+delta)%ring.length;out.textContent='Puntero sobre '+ring[i];}
      row.append(button('Una muesca atrás',()=>turn(-1),'rx-switch'),button('Una muesca adelante',()=>turn(1),'rx-switch'),button('Media vuelta',()=>turn(4),'rx-switch'),button('Volver a Flor',()=>{i=ring.indexOf('Flor');turn(0);},'rx-switch'));
      box.append(row,out);turn(0);return 'Acciona el puntero un movimiento cada vez según la canción de montaje.';
    },
    15(box){
      const out=readout();let bag=0,spent=0;
      dial(box,'Pétalos en la bolsa',0,9,0,'',n=>{bag=n;draw();});
      function draw(){out.textContent=spent>bag?'Bolsa vacía antes de llegar.':'Quedan '+(bag-spent)+' pétalos.';}
      const strip=node('div','rx-switches');
      [1,2,3].forEach(n=>strip.append(button('Pagar '+n,()=>{spent+=n;draw();},'rx-switch')));
      strip.append(button('Reiniciar viaje',()=>{spent=0;draw();},'rx-switch'));box.append(strip,out);draw();
      return 'Carga la bolsa de una abeja y paga cada salida hasta Campana.';
    },
    16(box,mat){
      const description=recordLine(mat,'Cuadrícula inicial');if(!description)return 'Indica los giros que debe dar quien tiene el billete.';
      let colors=[...description.matchAll(/(blanco|ámbar|verde|azul) (?:izq|dcha)/gi)].map(m=>m[1]);
      if(colors.length!==4)return '';
      const original=colors.slice(),tile=node('div','rx-ticket'),out=readout(),strip=node('div','rx-switches');box.append(tile);
      function draw(){tile.replaceChildren(...colors.map(c=>node('span','rx-color',c)));out.textContent='Esquina superior izquierda · '+colors[0];}
      function turn(){colors=[colors[2],colors[0],colors[3],colors[1]];draw();}
      strip.append(button('Cuarto de vuelta',turn,'rx-switch'),button('Media vuelta',()=>{turn();turn();},'rx-switch'),button('Restablecer',()=>{colors=original.slice();draw();},'rx-switch'));
      box.append(strip,out);draw();return 'Gira el billete rígido en el sentido del reloj y sigue una esquina.';
    },
    17(box,mat){
      const rows=recordLine(mat,'Recortes disponibles').split('\n').map(t=>t.split('|').map(cleaned)).filter(r=>r.length===2);
      if(!rows.length)return 'Dicta las dimensiones de la ventana a quien superpone los recortes.';
      const selected=new Set(),grid=node('div','rx-window'),out=readout(),strip=node('div','rx-switches');
      function draw(){const counts=Array(6).fill(0);rows.forEach(([label,values])=>{if(selected.has(label))values.split(',').forEach(v=>{if(+v>=1&&+v<=6)counts[+v-1]++;});});
        grid.replaceChildren(...counts.map((c,i)=>node('span','rx-pane rx-level-'+c,(i+1)+' · '+c)));out.textContent=counts.filter(n=>n===0).length+' huecos · '+counts.filter(n=>n>1).length+' solapamientos';}
      rows.forEach(([label])=>{const b=button(label,()=>{selected.has(label)?selected.delete(label):selected.add(label);b.setAttribute('aria-pressed',String(selected.has(label)));draw();},'rx-switch');b.setAttribute('aria-pressed','false');strip.append(b);});
      box.append(grid,strip,out);draw();return 'Pon los recortes sobre la ventana. Cada casilla muestra cuántas capas la cubren.';
    },
    18(box){
      const out=readout();let total=0;const strip=node('div','rx-switches');
      function draw(){out.textContent='Bandeja de cambio · '+total+' semillas';}
      for(const n of [1,2,3,4,5])strip.append(button('Añadir '+n,()=>{total+=n;draw();},'rx-switch'));
      strip.append(button('Vaciar bandeja',()=>{total=0;draw();},'rx-switch'));box.append(strip,out);draw();
      return 'Canjea mentalmente cada animal y coloca en la bandeja sus semillas. Compara las bolsas.';
    },
    19(box,mat){
      const strips=mat.map(m=>({name:m.label,holes:[...m.body.matchAll(/\b(\d)\b/g)].map(v=>+v[1]).filter(n=>n>0&&n<=8)})).filter(t=>t.holes.length);
      if(!strips.length)return '';
      const circles=node('div','rx-strips');box.append(circles);const out=readout();let pos=1;
      function draw(){circles.replaceChildren(...strips.map(t=>{const row=node('div','rx-holes');row.append(node('b',null,t.name));for(let i=1;i<=8;i++)row.append(node('i',(t.holes.includes(i)?'rx-punched ':'')+(i===pos?'rx-probe':''),String(i)));return row;}));out.textContent='Pulso '+pos+' · '+strips.map(t=>t.name+' '+(t.holes.includes(pos)?'abierta':'cerrada')).join(' / ');}
      dial(box,'Mover la sonda',1,8,1,'',v=>{pos=v;draw();});box.append(out);draw();return 'Lleva la sonda a un mismo pulso y contrasta los agujeros de las dos tiras.';
    },
    20(box){
      let a=2,b=2,t=0;const out=readout();
      function draw(){out.textContent='Turno '+t+' · posición del primer disco '+(t%a)+' · posición del segundo '+(t%b)+'. El cero es la marca inicial.';}
      dial(box,'Posiciones del disco pequeño',2,10,2,'',n=>{a=n;draw();});
      dial(box,'Posiciones del disco grande',2,10,2,'',n=>{b=n;draw();});dial(box,'Avanzar turnos',0,30,0,'',n=>{t=n;draw();});
      box.append(out);draw();return 'Ajusta el tamaño de cada disco según las fichas y busca la primera coincidencia después de la salida.';
    },
    21(box,mat){
      const rows=recordLine(mat,'Piezas, por filas').split('\n').map(s=>s.split('|').map(cleaned)).filter(r=>r.length===2);if(!rows.length)return 'Describe el borde del hueco a quien tiene las piezas del mosaico.';
      const tile=node('div','rx-ticket'),out=readout();box.append(tile);
      function draw(i){const vals=rows[i][1].match(/clara|oscura/g)||[];tile.replaceChildren(...vals.map(v=>node('span','rx-cell '+(v==='oscura'?'rx-dark':''),v)));out.textContent=rows[i].join(' · ');}
      switches(box,rows.map(r=>r[0]),draw,0);box.append(out);draw(0);return 'Presenta una pieza en el hueco sin girarla. Comprueba el dibujo por filas y columnas.';
    },
    22(box,mat){
      const text=recordLine(mat,'Mostradores'),rows=[...text.matchAll(/(\w+):\s*(\w+)\s*→\s*(\w+)/g)].map(m=>m.slice(1));if(!rows.length)return 'Dicta la condición del último sello a quien tiene los mostradores.';
      let seal='sal';const seen=new Set(),out=readout(),strip=node('div','rx-switches');
      rows.forEach(([name,takes,gives])=>strip.append(button(name,()=>{
        if(seen.has(name)){out.textContent='Ya pasaste por '+name+'. Conservas '+seal+'.';return;}
        if(seal!==takes){out.textContent=name+' pide '+takes+'. Llevas '+seal+'.';return;}
        seen.add(name);seal=gives;out.textContent=[...seen].join(' → ')+' · sello actual: '+seal;
      },'rx-switch')));
      strip.append(button('Volver a la salida',()=>{seal='sal';seen.clear();out.textContent='Sello inicial: sal';},'rx-switch'));
      box.append(strip,out);out.textContent='Sello inicial: sal';return 'Lleva tu sello de un puesto al siguiente. Cada mostrador solo admite su propio cambio.';
    },
    23(box,mat){
      const rows=recordLine(mat,'Relojes').split('\n').map(s=>s.match(/^([ABC]).*cada (\d+)/)).filter(Boolean);
      if(!rows.length)return 'Indica quién tiene que sonar y quién debe guardar silencio a quien tiene los relojes.';
      const out=readout();function draw(n){out.textContent='Pulso '+n+' · '+rows.map(([,name,freq])=>name+(n%(+freq)===0?' da una palmada':' guarda silencio')).join(' / ');}
      dial(box,'Desplazar el apuntador',0,60,0,'',draw);box.append(out);draw(0);return 'Mueve el apuntador y observa qué relojes coinciden en ese pulso.';
    },
    24(box,mat){
      const rows=recordLine(mat,'Losetas').split('\n').map(r=>r.match(/^(\w+)\s*\|\s*(\w+)\s*→\s*(\w+)/)).filter(Boolean);
      if(!rows.length)return 'Dicta los extremos y las restricciones a quien tiene el estuche de losetas.';
      const strip=node('div','rx-switches'),out=readout(),seen=new Set();let symbol='mano';
      rows.forEach(([,letter,a,b])=>strip.append(button(letter+' · '+a+' → '+b,()=>{
        if(a!==symbol||seen.has(letter)){out.textContent='No encaja en el extremo '+symbol+'.';return;}
        seen.add(letter);symbol=b;out.textContent=[...seen].join(' → ')+' · extremo '+symbol;
      },'rx-switch')));
      strip.append(button('Desmontar',()=>{symbol='mano';seen.clear();out.textContent='Extremo: mano';},'rx-switch'));
      box.append(strip,out);out.textContent='Extremo: mano';return 'Prueba el encaje entre la salida de una loseta y la entrada de la siguiente.';
    }
  };
  function evidenceTray(box,materials) {
    const fold=node('details','rx-archive'),summary=node('summary',null,'Cotejar documentos sobre la mesa');
    if(!materials.length)return;
    const records=materials.flatMap(m=>(m.body||'').split('\n').map(cleaned).filter(Boolean).map(line=>({label:m.label,line})));
    if(!records.length)return;
    fold.append(summary,node('p','rx-small','Elige una anotación y fíjala a la izquierda o a la derecha para comparar dos lecturas.'));
    const choose=node('label','rx-record','Anotación del expediente'),select=node('select');choose.append(select);
    records.forEach((r,i)=>{const opt=node('option',null,r.label+' · '+(r.line.length>65?r.line.slice(0,64)+'…':r.line));opt.value=i;select.append(opt);});
    const excerpt=node('p','rx-excerpt'),bar=node('div','rx-switches'),pair=node('div','rx-pair');
    ['izquierda','derecha'].forEach(side=>{
      const sheet=node('section','rx-note');sheet.setAttribute('aria-label','Hoja '+side);
      const title=node('b',null,'Hoja '+side),body=node('p',null,'Sin anotación');sheet.append(title,body);pair.append(sheet);
      bar.append(button('Fijar a la '+side,()=>{const rec=records[+select.value];title.textContent=rec.label;body.textContent=rec.line;},'rx-switch'));
    });
    pair.setAttribute('aria-live','polite');
    function read(){excerpt.textContent=records[+select.value].line;}select.addEventListener('change',read);read();
    fold.append(choose,excerpt,bar,pair);box.append(fold);
  }
  function mount({field,stage,index,caseId,role,selected,change,controller}) {
    const desk=desks[caseId],side=controller?.side===true,step=side?5:index;
    if(!desk||!stage?.options?.length||step<0||step>5||!desk[4][step])return false;
    const materials=(stage.materials||[]).filter(m=>visible(m,role));
    const root=node('div','rx-desk');root.dataset.expedition=caseId;root.dataset.station=step;
    const header=node('div','rx-station'),intro=node('div','rx-intro'),eyebrow=node('p','rx-site',stage.place||desk[0]);
    intro.append(eyebrow,node('h4',null,desk[4][step]));
    const simulator=side?extraExperiments[caseId]:step===desk[3]?experiments[caseId]:null;
    if(simulator){
      const instrument=node('div','rx-model');
      const description=simulator(instrument,materials);
      if(description)intro.append(node('p','rx-guidance',description));
      if(instrument.childElementCount)intro.append(instrument);
    }else{
      intro.append(node('p','rx-guidance',stage.mode==='order'?'Reconstruye la secuencia en el orden que indican las fuentes. Puedes mover una pieza después de colocarla.':stage.mode==='multi'?'Reúne las dos piezas que sostienen tu deducción. Puedes retirar una para ensayar otra combinación.':'Coteja tus fuentes y coloca en el registro la pieza que explica lo observado.'));
    }
    header.append(figureFrom(caseId,step,role,stage),intro);root.append(header);
    evidenceTray(root,materials);
    const capacity=stage.requiredCount||capacities[caseId-13][step],opts=stage.options;
    field.dataset.requiredChoices=String(capacity);
    field.dataset.vhPrueba='expedicion-'+caseId;
    const mode=stage.mode,ordered=mode==='order',one=mode==='single';
    const rack=node('div','rx-rack'),inventory=node('div','rx-pieces'),tray=node('div','rx-seats'),meter=readout();
    const help=ordered?'Para cambiar un paso, usa los botones de la pieza colocada.':one?'Al colocar otra pieza se sustituye la anterior.':'Toca de nuevo una pieza colocada para retirarla.';
    rack.append(node('h5',null,side?'Tu resolución del reto':desk[2]),node('p','rx-small',help));rack.append(tray,meter,inventory);root.append(rack);
    const pickers=new Map();
    function commit(){sync();change();}
    function reposition(n,d){if(n+d<0||n+d>=selected.length)return;[selected[n],selected[n+d]]=[selected[n+d],selected[n]];commit();tray.querySelector('[data-slot="'+(n+d)+'"] button')?.focus();}
    function remove(id){const i=selected.indexOf(id);if(i>=0)selected.splice(i,1);commit();pickers.get(id)?.focus();}
    function sync(){
      for(const [id,b] of pickers){
        b.setAttribute('aria-pressed',String(selected.includes(id)));
        b.setAttribute('aria-disabled',String(!one&&!selected.includes(id)&&selected.length>=capacity));
      }
      const slots=Array.from({length:capacity},(_,i)=>{
        const id=selected[i],opt=opts.find(o=>o.id===id),slot=node('div','rx-seat');slot.dataset.slot=i;
        const nr=node('small',null,ordered?'Paso '+(i+1):capacity===1?'Selección':'Pieza '+(i+1));
        const label=node('strong',null,opt?.label||'Libre');slot.append(nr,label);
        if(opt){
          slot.classList.add('rx-filled');const controls=node('div','rx-seat-tools');
          if(ordered&&selected.length>1){const back=button('Antes',()=>reposition(i,-1)),next=button('Después',()=>reposition(i,1));back.disabled=i===0;next.disabled=i===selected.length-1;controls.append(back,next);}
          const undo=button('Retirar',()=>remove(id));undo.setAttribute('aria-label','Retirar '+opt.label);controls.append(undo);slot.append(controls);
        }
        return slot;
      });tray.replaceChildren(...slots);
      meter.textContent=(selected.length===capacity?'Montaje preparado para contrastar':'Piezas colocadas')+' · '+selected.length+' de '+capacity;
    }
    opts.forEach((opt,i)=>{
      const b=button('',()=>{
        const at=selected.indexOf(opt.id);
        if(at>=0){remove(opt.id);return;}
        if(one)selected.length=0;
        if(selected.length>=capacity)return;
        selected.push(opt.id);commit();
      },'rx-piece');
      b.append(node('span','rx-piece-serial',String.fromCharCode(65+i)),node('span',null,opt.label));b.setAttribute('aria-label',opt.label);pickers.set(opt.id,b);inventory.append(b);
    });
    field.append(root);sync();change();return true;
  }
  window.MesasDeCaso ||= {};
  for(const id of Object.keys(desks))window.MesasDeCaso[id]=mount;
})();
