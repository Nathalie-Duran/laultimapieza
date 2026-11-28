(function (root) {
  'use strict';

  const registry = new Map();
  let family;
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw Error(message); };
  const arr = value => Array.isArray(value) && value.length > 0 && value.length <= 64 ? value : fail('La lista debe tener entre 1 y 64 elementos.');
  const nums = value => arr(value).map(n => Number.isFinite(n) && Math.abs(n) <= 100000 ? n : fail('Número fuera de rango.'));
  const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max ? n : fail('Entero fuera de rango.');
  const str = value => typeof value === 'string' && value.length <= 1200 ? value : fail('Texto no válido.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letters = s => str(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
  const mod = (n, size) => ((n % size) + size) % size;
  const sum = values => values.reduce((a, b) => a + b, 0);
  const unique = values => [...new Set(values)];
  const gcd = (a, b) => { a = int(a, 1, 100000); b = int(b, 1, 100000); while (b) [a, b] = [b, a % b]; return a; };
  const words = s => str(s).trim().split(/\s+/);
  const shifts = (s, step) => [...letters(s)].map((c, i) => alphabet[mod(alphabet.indexOf(c) + step(i), 26)]).join('');
  const options = (p, key) => arr(p[key]).map(str);
  const grid = rows => {
    const values = arr(rows).map(str);
    if (!values[0].length || values[0].length > 32 || values.some(r => r.length !== values[0].length)) fail('La cuadrícula debe ser rectangular.');
    return values;
  };
  const point = (xy, max = 100) => { const a = nums(xy); if (a.length !== 2) fail('Se necesitan dos coordenadas.'); return a.map(n => int(n, -max, max)); };
  const directions = {N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0]};
  const orderDirections = 'NESO';
  const step = (at, dir) => { const d = directions[dir]; if (!d) fail('Rumbo no válido.'); return [at[0] + d[0], at[1] + d[1]]; };
  const at = (rows, [x, y]) => rows[y]?.[x];
  const coord = p => p.join(',');
  function reachable(rows, start, pass) {
    const pending = [start], distances = new Map([[coord(start), 0]]);
    if (!pass(at(rows, start))) return new Map();
    for (let i = 0; i < pending.length; i++) {
      const pos = pending[i], distance = distances.get(coord(pos));
      for (const dir of orderDirections) {
        const next = step(pos, dir), key = coord(next);
        if (!distances.has(key) && pass(at(rows, next))) { distances.set(key, distance + 1); pending.push(next); }
      }
    }
    return distances;
  }
  const media = nums => sum(nums) / nums.length;
  const norm = s => String(s).trim().toLocaleLowerCase('es').normalize('NFC');
  const controlNames = {texto:'Escribe la lectura', numero:'Ajusta el valor', lista:'Construye la secuencia', punto:'Señala la casilla (x,y)', rumbo:'Orienta la aguja'};
  function add(id, nombre, descripcion, control, parametros, derivar) {
    if (registry.has(id)) fail('Mecánica duplicada.');
    const descriptor = {id, familia: family, nombre, descripcion, entradas: [{id: 'intento', label: controlNames[control], tipo: control}], ejemplo: {parametros, intento: derivar(parametros)}};
    registry.set(id, {descriptor, derivar});
  }
  function activa(id,nombre,descripcion,parametros,demostracion,validarIntento) {
    add(id,nombre,descripcion,'lista',parametros,()=>demostracion);
    const rule=registry.get(id);rule.validarIntento=validarIntento;
    if(!validarIntento(parametros,demostracion))fail('La demostración no resuelve '+id);
  }

  family = 'Mapas y exploración';
  add('seguir-rumbos', 'Navegación por estima', 'Desplázate según el cuaderno de ruta y marca el punto de llegada.', 'punto',
    {inicio:[2,2], ruta:'NNEES'}, p => [...str(p.ruta)].reduce(step,point(p.inicio)));
  add('laberinto', 'Buscar el paso más corto', 'Cuenta el mínimo de pasos por pasillos abiertos; # representa una pared.', 'numero',
    {mapa:['...#','. #.','....'], inicio:[0,0], fin:[3,2]}, p => {
      const d = reachable(grid(p.mapa),point(p.inicio), c => c !== undefined && c !== '#');
      return d.get(coord(point(p.fin))) ?? fail('El destino está aislado.');
    });
  add('recinto', 'Medir una cámara inundada', 'Cuenta las baldosas contiguas a la muestra con el mismo tono, sin saltar en diagonal.', 'numero',
    {mapa:['aabb','abab','aabb'], muestra:[0,0]}, p => {
      const rows=grid(p.mapa), start=point(p.muestra), shade=at(rows,start);
      if (shade===undefined) fail('Muestra fuera del mapa.');
      return reachable(rows,start,c=>c===shade).size;
    });
  add('triangular', 'Triangular un punto', 'Localiza la única baliza que cumple todas las distancias por calles rectangulares.', 'punto',
    {ancho:5,alto:5,balizas:[[0,0,3],[4,0,3],[0,4,5]]}, p => {
      const w=int(p.ancho,1,32), h=int(p.alto,1,32), refs=arr(p.balizas).map(nums), found=[];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(refs.every(([a,b,d])=>Math.abs(x-a)+Math.abs(y-b)===d))found.push([x,y]);
      if(found.length!==1)fail('Las balizas no fijan una sola casilla.'); return found[0];
    });
  add('linea-vista','La primera silueta','Mira desde el puesto de guardia en el rumbo señalado hasta encontrar el primer objeto.','texto',
    {mapa:['..P..','.....','.....'],puesto:[0,0],rumbo:'E'},p=>{
      const rows=grid(p.mapa);let xy=point(p.puesto);
      for(let n=0;n<65;n++){xy=step(xy,p.rumbo);const tile=at(rows,xy);if(!tile)break;if(tile!=='.')return tile;}
      fail('No hay un objeto en esa línea.');
    });
  add('desplegar','Desplegar un mapa doblado','Refleja la marca respecto al pliegue vertical para localizar su pareja.','punto',
    {marca:[2,4],pliegueX:5},p=>{const [x,y]=point(p.marca);return [2*int(p.pliegueX,-32,32)-x,y];});
  add('girar-plano','Girar un plano cuadrado','Recoloca una marca al girar el plano un cuarto de vuelta en sentido horario.','punto',
    {lado:5,marca:[1,3]},p=>{const [x,y]=point(p.marca),n=int(p.lado,1,64);return [n-1-y,x];});
  add('pendiente','Seguir una cuenca','Sigue el agua hacia la casilla vecina más baja hasta su punto de reposo.','punto',
    {alturas:['987','643','521'],inicio:[0,0]},p=>{
      const rows=grid(p.alturas), start=point(p.inicio);if(!rows.every(r=>/^\d+$/.test(r))||!at(rows,start))fail('Comprueba las cotas.');
      let pos=start;for(let n=0;n<10;n++){const lower=[...orderDirections].map(d=>step(pos,d)).filter(q=>at(rows,q)!==undefined&&at(rows,q)<at(rows,pos)).sort((a,b)=>at(rows,a).localeCompare(at(rows,b)));
        if(!lower.length)return pos;if(at(rows,lower[0])===at(rows,lower[1]||[]))fail('Dos pendientes tienen la misma cota.');pos=lower[0];}return pos;
    });
  add('pasarela','Tender una pasarela','Identifica el único hueco que uniría las dos orillas al colocar una tabla.','punto',
    {mapa:['.##','.#.','##.'],a:[0,0],b:[2,2]},p=>{
      const rows=grid(p.mapa),from=point(p.a),to=coord(point(p.b)),possible=[];
      for(let y=0;y<rows.length;y++)for(let x=0;x<rows[0].length;x++)if(rows[y][x]==='#'){
        const copy=rows.slice();copy[y]=copy[y].slice(0,x)+'.'+copy[y].slice(x+1);
        if(reachable(copy,from,c=>c==='.').has(to))possible.push([x,y]);}
      if(possible.length!==1)fail('Se necesita un único punto de cruce.');return possible[0];
    });
  add('coordenadas','Cruzar dos cuadrículas','Combina el índice de fila de una leyenda y el índice de columna de la otra para recuperar una marca.','texto',
    {mapa:['SOL','MAR','LUZ'],filas:['cobre','plata','oro'],columnas:['día','noche','alba'],fila:'plata',columna:'alba'},p=>{
      const tile=at(grid(p.mapa),[options(p,'columnas').indexOf(p.columna),options(p,'filas').indexOf(p.fila)]);
      return tile??fail('Las dos leyendas deben señalar una casilla.');
    });

  family = 'Códigos y escrituras';
  add('cesar','Disco de César','Gira un alfabeto latino A–Z el número de pasos indicado para leer la inscripción.','texto',
    {inscripcion:'OXQD',giro:3},p=>shifts(p.inscripcion,()=>-int(p.giro,0,25)));
  add('atbash','Alfabeto de espejo','Empareja los extremos opuestos del alfabeto A–Z para restituir las letras.','texto',
    {inscripcion:'HLO'},p=>[...letters(p.inscripcion)].map(c=>alphabet[25-alphabet.indexOf(c)]).join(''));
  add('vigenere','Llave que se repite','Resta a cada letra el desplazamiento de la letra correspondiente de la llave.','texto',
    {inscripcion:'LPL',llave:'AB'},p=>{const key=letters(p.llave);if(!key)fail('Falta la llave.');return shifts(p.inscripcion,i=>-alphabet.indexOf(key[i%key.length]));});
  add('polibio','Tablero de coordenadas','Extrae los símbolos recorriendo pares de fila y columna numerados desde uno.','texto',
    {tabla:['ABCDE','FGHIK','LMNOP','QRSTU','VWXYZ'],pares:[[2,1],[1,1],[4,2]]},p=>{
      const rows=grid(p.tabla);return arr(p.pares).map(q=>{const [y,x]=point(q);return at(rows,[x-1,y-1])??fail('Par fuera de la tabla.');}).join('');
    });
  add('morse','Despacho telegráfico','Agrupa pulsos cortos y largos y tradúcelos con la tablilla del puesto.','texto',
    {pulsos:['...','---','.-..'],tabla:{'...':'S','---':'O','.-..':'L','..':'I'}},p=>options(p,'pulsos').map(k=>Object.hasOwn(p.tabla,k)?str(p.tabla[k]):fail('Pulso sin leyenda.')).join(''));
  add('acrostico','Leer un acróstico','Recupera una palabra leyendo la inicial de cada renglón.','texto',
    {renglones:['Sobre el puente','Otro paso','Llega el barco']},p=>options(p,'renglones').map(t=>letters(t)[0]||fail('Renglón vacío.')).join(''));
  add('rejilla','Plantilla perforada','Lee solo las letras que quedan visibles a través de los huecos de la rejilla.','texto',
    {texto:['MAR','SOL','LUZ'],rejilla:['.#.','..#','#..']},p=>{
      const text=grid(p.texto),mask=grid(p.rejilla);if(text.length!==mask.length||text[0].length!==mask[0].length)fail('Las láminas deben coincidir.');
      return text.flatMap((r,y)=>[...r].filter((_,x)=>mask[y][x]==='#')).join('');
    });
  add('libro-clave','Cifrado de libro','Busca cada coordenada de renglón y palabra y lee sus iniciales.','texto',
    {renglones:['seda nube','roca cristal'],coordenadas:[[2,1],[1,2]]},p=>arr(p.coordenadas).map(x=>{
      const [r,w]=point(x),line=options(p,'renglones')[r-1];return line&&letters(words(line)[w-1]||'')[0]||fail('Coordenada del libro no válida.');
    }).join(''));
  add('zigzag','Transposición en dos raíles','Reconstruye el mensaje intercalando las dos bandas del telar.','texto',
    {cifrado:'LCRC UEA'.replace(' ','')},p=>{const s=letters(p.cifrado),mid=Math.ceil(s.length/2);return [...s.slice(0,mid)].map((c,i)=>c+(s[mid+i]||'')).join('');});
  add('columnas','Transposición de columnas','Lee las columnas en el orden que indican los tiradores del marco.','texto',
    {marco:['ABC','DEF'],llave:[3,1,2]},p=>{const rows=grid(p.marco);return nums(p.llave).map(n=>rows.map(r=>r[int(n,1,r.length)-1]).join('')).join('');});
  add('sustitucion','Traducir glifos','Aplica una correspondencia explícita entre glifos y letras para traducir una secuencia.','texto',
    {glifos:['onda','ave','sol'],diccionario:{onda:'R',ave:'I',sol:'O'}},p=>options(p,'glifos').map(k=>Object.hasOwn(p.diccionario,k)?str(p.diccionario[k]):fail('Glifo desconocido.')).join(''));
  add('braille','Celda de seis puntos','Identifica una letra por las posiciones elevadas de una celda táctil.','texto',
    {puntos:[1,4,5],muestras:{A:[1],D:[1,4,5],F:[1,2,4]}},p=>{
      const marks=nums(p.puntos).sort().join('');const hits=Object.entries(p.muestras).filter(([,v])=>nums(v).sort().join('')===marks);
      return hits.length===1?hits[0][0]:fail('La celda debe tener una correspondencia.');
    });
  add('binario','Lectura de cinta perforada','Interpreta perforaciones como bits, con el bit más significativo a la izquierda.','numero',
    {cinta:'010011'},p=>{if(!/^[01]{1,20}$/.test(p.cinta))fail('Cinta binaria no válida.');return parseInt(p.cinta,2);});
  add('runas-longitud','Descomprimir una inscripción','Expande cada par de símbolo y repetición para reconstruir una cenefa.','texto',
    {tramos:[['x',2],['o',3],['x',1]]},p=>arr(p.tramos).map(([s,n])=>str(s).slice(0,1).repeat(int(n,1,20))).join(''));
  add('cesura','Recuperar los espacios','Separa una inscripción continua usando únicamente las palabras de su léxico.','lista',
    {inscripcion:'SOLDEMAR',lexico:['SOL','DE','MAR','ORO']},p=>{
      const s=letters(p.inscripcion),lex=unique(options(p,'lexico').map(letters));if(lex.includes(''))fail('Palabra vacía.');
      const choices=Array(s.length+1).fill(null);choices[s.length]=[];
      for(let i=s.length-1;i>=0;i--){const ways=lex.filter(w=>s.startsWith(w,i)&&choices[i+w.length]!==null);if(ways.length>1)fail('Separación ambigua.');if(ways.length)choices[i]=[ways[0],...choices[i+ways[0].length]];}
      return choices[0]??fail('Inscripción sin lectura.');
    });

  family = 'Mecanismos y conducciones';
  add('engranajes','Tren de engranajes','Calcula las vueltas del eje de salida a partir de los dientes de cada par solidario.','numero',
    {vueltas:6,pares:[[24,12],[12,24]]},p=>arr(p.pares).reduce((speed,pair)=>{const [driver,driven]=nums(pair);return speed*int(driver,1,500)/int(driven,1,500);},int(p.vueltas,1,500)));
  add('embrague','Engranar las marcas','Busca la primera vuelta que vuelve a reunir los dos ciclos de marcas.','numero',
    {ciclos:[4,6,3]},p=>nums(p.ciclos).reduce((a,b)=>a/gcd(a,b)*b));
  add('palanca','Equilibrar una palanca','Encuentra la distancia del contrapeso que iguala los momentos de ambos lados.','numero',
    {carga:6,brazo:3,contrapeso:2},p=>int(p.carga,1,500)*int(p.brazo,1,500)/int(p.contrapeso,1,500));
  add('poleas','Aparejar un polipasto','Determina la longitud de cuerda que habrá que cobrar para elevar la carga.','numero',
    {ramales:4,altura:3},p=>int(p.ramales,1,32)*int(p.altura,1,100));
  add('tornillo','Ajustar un tornillo micrométrico','Avanza o retrocede el carro según el paso y los giros dados al tornillo.','numero',
    {inicial:12,paso:0.5,giros:[3,-1,2]},p=>nums([p.inicial])[0]+nums([p.paso])[0]*sum(nums(p.giros)));
  add('leva','Leer el perfil de una leva','Gira la leva un número de posiciones y lee la altura del palpador.','numero',
    {perfil:[2,4,7,5,3],indice:1,giro:2},p=>{const a=nums(p.perfil);return a[mod(int(p.indice,0,a.length-1)+int(p.giro,-1000,1000),a.length)];});
  add('oclusion','Abrir una cerradura de pernos','Deduce las alturas que faltan para situar todos los pernos sobre la línea de corte.','lista',
    {linea:7,pernos:[2,5,3]},p=>nums(p.pernos).map(height=>int(p.linea,1,100)-height));
  add('escapamiento','Regular un escape','Avanza un diente en cada pulso permitido por el patrón del escape y lee la rueda.','numero',
    {dientes:12,pulsos:10,patron:'110',posicion:4},p=>{
      if(!/^[01]{1,24}$/.test(p.patron))fail('Patrón de escape no válido.');
      let pos=int(p.posicion,0,200);for(let i=0;i<int(p.pulsos,0,1000);i++)if(p.patron[i%p.patron.length]==='1')pos++;
      return mod(pos,int(p.dientes,2,200));
    });
  add('trasvase','Trasvasar entre dos vasos','Ejecuta la secuencia de trasvases hasta llenar el destino o vaciar el origen.','lista',
    {capacidad:[5,3,6],contenido:[5,0,1],trasvases:[[0,1],[1,2]]},p=>{
      const caps=nums(p.capacidad),current=nums(p.contenido);if(caps.length!==current.length||current.some((v,i)=>v<0||v>caps[i]))fail('Niveles incompatibles.');
      for(const pair of arr(p.trasvases)){const [a,b]=point(pair);int(a,0,caps.length-1);int(b,0,caps.length-1);const n=Math.min(current[a],caps[b]-current[b]);current[a]-=n;current[b]+=n;}return current;
    });
  add('sifon','Leer vasos comunicantes','Calcula el nivel común al abrir las válvulas entre recipientes de sección diferente.','numero',
    {secciones:[1,2,1],alturas:[6,2,2]},p=>{const a=nums(p.secciones),h=nums(p.alturas);if(a.length!==h.length||a.some(n=>n<=0))fail('Vasos incompatibles.');return sum(a.map((n,i)=>n*h[i]))/sum(a);});
  add('caudal','Llenar una cisterna con fuga','Resta el caudal de fuga a los conductos de entrada para calcular cuándo se llena la cisterna.','numero',
    {litros:18,entradas:[3,2],fuga:2},p=>{const v=sum(nums(p.entradas))-int(p.fuga,0,10000);if(v<=0)fail('La cisterna nunca se llena.');return int(p.litros,1,100000)/v;});
  function seguirTuberias(tubos, fuente, sinFugas) {
    const cola = [fuente], alcanzadas = new Set([coord(fuente)]);
    for (const celda of cola) {
      for (const lado of str(at(tubos, celda) || '')) {
        const vecina = step(celda, lado);
        const opuesto = orderDirections[mod(orderDirections.indexOf(lado) + 2, 4)];
        if (!at(tubos, vecina)?.includes(opuesto)) {
          if (sinFugas) return null;
          continue;
        }
        const id = coord(vecina);
        if (!alcanzadas.has(id)) { alcanzadas.add(id); cola.push(vecina); }
      }
    }
    return alcanzadas;
  }
  add('tuberias','Rastrear una tubería abierta','Sigue las conducciones por sus empalmes recíprocos y enumera las salidas que reciben agua.','lista',
    {tubos:[['E','EO','O'],['N','N','N']],fuente:[0,0],salidas:[{id:'muelle',xy:[2,0]},{id:'bodega',xy:[0,1]}]},p=>{
      const tubos=arr(p.tubos).map(row=>arr(row).map(str));
      const alcanzadas=seguirTuberias(tubos,point(p.fuente),false);
      return arr(p.salidas).filter(exit=>alcanzadas.has(coord(point(exit.xy)))).map(e=>str(e.id));
    });
  activa('circuito-rotatorio','Orientar los empalmes','Gira cada pieza entre cero y tres cuartos de vuelta en el sentido del reloj. El agua debe llegar a todas las salidas sin escapar por un extremo abierto.',
    {tubos:[['E','NS','O']],fuente:[0,0],moviles:[[1,0]],salidas:[[2,0]]},[1],(p,giros)=>{
      const tubos=arr(p.tubos).map(row=>arr(row).map(str));
      if(tubos.some(row=>row.length!==tubos[0].length || row.some(cell=>!/^[NESO]{0,4}$/.test(cell) || unique([...cell]).length!==cell.length)))return false;
      const moviles=arr(p.moviles).map(xy=>point(xy)),fuente=point(p.fuente);
      if(!at(tubos,fuente) || giros.length!==moviles.length || new Set(moviles.map(coord)).size!==moviles.length)return false;
      for(const [i,[x,y]] of moviles.entries()){
        const giro=giros[i];
        if(!at(tubos,[x,y]) || !/^[0-3]$/.test(String(giro)))return false;
        tubos[y][x]=[...tubos[y][x]].map(d=>orderDirections[mod(orderDirections.indexOf(d)+Number(giro),4)]).join('');
      }
      const alcanzadas=seguirTuberias(tubos,fuente,true);
      return alcanzadas!==null && arr(p.salidas).every(xy=>alcanzadas.has(coord(point(xy))));
    });
  add('pesas','Identificar un peso falso','Compara la masa de cada grupo con su masa nominal y devuelve la etiqueta del grupo alterado.','texto',
    {unidad:3,grupos:[{id:'junco',piezas:3,masa:9},{id:'loto',piezas:4,masa:13}]},p=>{
      const odd=arr(p.grupos).filter(g=>int(g.piezas,1,100)*int(p.unidad,1,100)!==g.masa);
      return odd.length===1?str(odd[0].id):fail('La pesada no distingue un solo grupo.');
    });

  family = 'Luz y superficies';
  add('ultravioleta','Revelar tinta ultravioleta','Lee únicamente las marcas que reaccionan bajo el filtro elegido.','texto',
    {filtro:'UV',marcas:[{letra:'S',luz:'UV'},{letra:'X',luz:'día'},{letra:'A',luz:'UV'}]},p=>arr(p.marcas).filter(m=>m.luz===p.filtro).map(m=>str(m.letra)).join(''));
  add('rasante','Iluminar una incisión','Compara el relieve con la pintura plana y lee las incisiones por profundidad.','texto',
    {trazos:[{letra:'P',profundidad:0},{letra:'O',profundidad:2},{letra:'R',profundidad:1}]},p=>arr(p.trazos).filter(t=>t.profundidad>0).sort((a,b)=>a.profundidad-b.profundidad).map(t=>str(t.letra)).join(''));
  add('espectro','Separar canales de luz','Aísla el canal de color que deja pasar el filtro y localiza la muestra más intensa.','texto',
    {canal:'verde',muestras:[{id:'seda',rgb:[90,12,10]},{id:'lino',rgb:[20,55,18]}]},p=>{
      const i=['rojo','verde','azul'].indexOf(p.canal);if(i<0)fail('Canal desconocido.');
      const values=arr(p.muestras).map(m=>[str(m.id),nums(m.rgb)[i]]).sort((a,b)=>b[1]-a[1]);if(values[0][1]===values[1]?.[1])fail('Filtro ambiguo.');return values[0][0];
    });
  add('negativo','Revelar un negativo','Calcula el tono positivo de una placa calibrada e invierte su escala tonal.','lista',
    {maximo:9,placa:[0,6,9,3]},p=>nums(p.placa).map(v=>int(p.maximo,1,255)-v));
  add('espejos','Desviar un haz con espejos','Sigue el rayo hasta el borde pasando por espejos de barra y contrabarra.','punto',
    {mapa:['....','../.','....'],fuente:[0,1],rumbo:'E'},p=>{
      const rows=grid(p.mapa);let pos=point(p.fuente),dir=p.rumbo;const seen=new Set();
      while(true){const k=coord(pos)+dir;if(seen.has(k))fail('El haz queda atrapado.');seen.add(k);const next=step(pos,dir),cell=at(rows,next);if(cell===undefined)return pos;pos=next;
        if(cell==='/')dir=({N:'E',E:'N',S:'O',O:'S'})[dir];if(cell==='\\')dir=({N:'O',O:'N',S:'E',E:'S'})[dir];}
    });
  add('sombra','Situar una lámpara','Deduce de qué lado está el foco a partir del rumbo de la sombra.','rumbo',
    {sombra:'E'},p=>{const i=orderDirections.indexOf(p.sombra);if(i<0)fail('Dirección desconocida.');return orderDirections[(i+2)%4];});
  add('camara','Proyectar en cámara oscura','Encuentra las coordenadas de la imagen invertida respecto del centro de la cámara.','punto',
    {objeto:[3,-2],distanciaObjeto:4,distanciaPantalla:8},p=>point(p.objeto).map(n=>-n*int(p.distanciaPantalla,1,100)/int(p.distanciaObjeto,1,100)));
  add('diferencias','Detectar cambios en dos láminas','Marca las casillas que cambian al cotejar las láminas, por orden de lectura.','lista',
    {antes:['abc','def'],despues:['aBc','deX']},p=>{const a=grid(p.antes),b=grid(p.despues);if(a.length!==b.length||a[0].length!==b[0].length)fail('Láminas incompatibles.');
      return a.flatMap((row,y)=>[...row].flatMap((v,x)=>v!==b[y][x]?[x+','+y]:[]));});
  add('silueta','Superponer recortes','Forma la silueta que resulta de unir las perforaciones de dos plantillas.','lista',
    {capa1:['#..','..#'],capa2:['.#.','..#']},p=>{const a=grid(p.capa1),b=grid(p.capa2);if(a.length!==b.length||a[0].length!==b[0].length)fail('Plantillas incompatibles.');
      return a.map((r,y)=>[...r].map((c,x)=>(c==='#'||b[y][x]==='#')?'#':'.').join(''));});
  add('anaglifo','Ajustar dos imágenes','Desplaza la segunda marca hasta hacerla coincidir con el punto de registro de la primera.','punto',
    {referencia:[5,3],marca:[2,4]},p=>{const a=point(p.referencia),b=point(p.marca);return [a[0]-b[0],a[1]-b[1]];});
  add('periscopio','Medir el campo de un visor','Ajusta el visor a la intersección de las ventanas de dos placas correderas.','lista',
    {ventanas:[[1,6],[3,9],[2,5]]},p=>{const windows=arr(p.ventanas).map(v=>point(v)),a=Math.max(...windows.map(v=>v[0])),b=Math.min(...windows.map(v=>v[1]));
      if(a>b)fail('Las ventanas no tienen campo común.');return [a,b];});

  family = 'Audio y señales';
  add('eco','Localizar un eco','Deduce la distancia al reflector a partir del tiempo que tarda el sonido en ir y volver.','numero',
    {milisegundos:50,velocidad:320},p=>int(p.milisegundos,1,10000)*int(p.velocidad,1,2000)/2000);
  add('ritmo','Reconstruir un patrón rítmico','Convierte los instantes de cada golpe en un patrón de duraciones entre golpes.','lista',
    {golpes:[0,200,300,600]},p=>{const a=nums(p.golpes);return a.slice(1).map((v,i)=>v-a[i]);});
  add('tempo','Ajustar el metrónomo','Calcula el tempo a partir de marcas espaciadas con regularidad.','numero',
    {golpes:[0,500,1000,1500]},p=>{const a=nums(p.golpes);if(a.length<2||a.at(-1)<=a[0])fail('Se necesitan dos golpes ordenados.');return Math.round(60000*(a.length-1)/(a.at(-1)-a[0]));});
  add('batidos','Afinar por batidos','Calcula cuántas pulsaciones por segundo produce el batido entre dos tonos.','numero',
    {tono:440,patron:444},p=>Math.abs(int(p.tono,20,4000)-int(p.patron,20,4000)));
  add('armonica','Reconocer una armónica','Relaciona el tono registrado con su fundamental y señala su número de armónica.','numero',
    {tono:660,fundamental:220},p=>{const n=int(p.tono,20,8000)/int(p.fundamental,20,4000);return Number.isInteger(n)?n:fail('No es una armónica entera.');});
  add('dial-radio','Sintonizar una emisora','Busca la frecuencia de la portadora a partir del centro entre sus dos bandas laterales.','numero',
    {bandas:[498,502]},p=>{const a=nums(p.bandas);return a.length===2?media(a):fail('Se necesitan dos bandas.');});
  add('silencios','Separar palabras por pausas','Agrupa las sílabas de la cinta cuando la pausa entre ellas supera el umbral.','lista',
    {silabas:['MA','RE','AL','TA'],pausas:[1,4,1],umbral:3},p=>{const a=options(p,'silabas'),g=nums(p.pausas),out=[a[0]];if(g.length!==a.length-1)fail('Falta una pausa.');
      for(let i=1;i<a.length;i++){if(g[i-1]>=p.umbral)out.push(a[i]);else out[out.length-1]+=a[i];}return out;});
  add('estereo','Localizar sonido estéreo','Determina qué micrófono recibió primero la señal y por cuántas muestras.','texto',
    {izquierda:[0,0,1,3],derecha:[0,1,3,2],umbral:1},p=>{
      const first=v=>nums(v).findIndex(n=>Math.abs(n)>=p.umbral),a=first(p.izquierda),b=first(p.derecha);if(a<0||b<0)fail('Señal ausente.');return a===b?'centro':(a<b?'izquierda':'derecha')+' '+Math.abs(a-b);
    });
  add('inversion-cinta','Reproducir una cinta al revés','Invierte la sucesión grabada para reconocer la cadena recuperada.','lista',
    {segmentos:['final','paso','llamada']},p=>options(p,'segmentos').reverse());
  add('pulso-perdido','Restituir un pulso omitido','Localiza el primer instante ausente en una pista de pulsos periódicos.','numero',
    {golpes:[0,2,4,8,10],periodo:2},p=>{const a=nums(p.golpes),d=int(p.periodo,1,100);for(let i=1;i<a.length;i++)if(a[i]!==a[i-1]+d)return a[i-1]+d;fail('No falta ningún pulso.');});

  family = 'Circuitos y máquinas lógicas';
  add('circuito','Leer una placa de puertas','Propaga el estado de los interruptores por una red de puertas lógicas.','numero',
    {interruptores:{a:1,b:0},puertas:[{id:'c',tipo:'XOR',a:'a',b:'b'},{id:'d',tipo:'AND',a:'a',b:'c'}],salida:'d'},p=>{
      const nodes=new Map(Object.entries(p.interruptores).map(([k,n])=>[k,int(n,0,1)]));
      for(const gate of arr(p.puertas)){const a=nodes.get(gate.a),b=nodes.get(gate.b);if(a===undefined||gate.tipo!=='NOT'&&b===undefined||nodes.has(gate.id))fail('Conexión de placa no válida.');
        const op={AND:a&b,OR:a|b,XOR:a^b,NOT:1-a};if(!Object.hasOwn(op,gate.tipo))fail('Puerta desconocida.');nodes.set(gate.id,op[gate.tipo]);}
      return nodes.get(p.salida)??fail('Salida no conectada.');
    });
  add('interruptores','Panel de luces acopladas','Acciona los mandos indicados: cada uno invierte todas las lámparas a las que está conectado.','lista',
    {luces:[0,1,0],mandos:{A:[0,1],B:[1,2]},secuencia:['A','B']},p=>{const lights=nums(p.luces).map(n=>int(n,0,1));
      for(const id of options(p,'secuencia'))for(const i of nums(p.mandos[id]))lights[int(i,0,lights.length-1)]^=1;return lights;});
  add('fusible','Encontrar una sobrecarga','Agrupa las cargas por línea y localiza el fusible cuya capacidad queda superada.','texto',
    {lineas:[{id:'A',max:7,cargas:[2,3]},{id:'B',max:5,cargas:[3,4]}]},p=>{
      const hits=arr(p.lineas).filter(l=>sum(nums(l.cargas))>l.max);return hits.length===1?str(hits[0].id):fail('Debe haber una línea sobrecargada.');
    });
  add('continuidad','Probar continuidad','Cuenta los bornes que reciben corriente desde la pila por los contactos que están cerrados.','numero',
    {pila:'P',cables:[['P','A',1],['A','B',0],['P','C',1]]},p=>{
      const edges=arr(p.cables),live=new Set([str(p.pila)]);
      for(let i=0;i<edges.length;i++)for(const [a,b,on] of edges)if(on===1&&(live.has(a)||live.has(b))){live.add(a);live.add(b);}
      return live.size-1;
    });
  add('diodos','Recorrer una matriz de diodos','Encuentra los indicadores accesibles desde el positivo respetando la dirección de cada enlace.','lista',
    {entrada:'P',diodos:[['P','X'],['X','verde'],['rojo','X']],indicadores:['verde','rojo']},p=>{
      const links=arr(p.diodos),live=new Set([str(p.entrada)]);
      for(let i=0;i<links.length;i++)for(const [a,b] of links)if(live.has(a))live.add(b);
      return options(p,'indicadores').filter(k=>live.has(k));});
  add('rele','Relé con memoria','Recorre las órdenes de activar y rearmar; registra los ciclos durante los que permanece activo el relé.','lista',
    {ciclos:['activar','esperar','rearmar','esperar','activar']},p=>{let on=false;return options(p,'ciclos').map(op=>{if(op==='activar')on=true;else if(op==='rearmar')on=false;else if(op!=='esperar')fail('Orden de relé desconocida.');return on?1:0;});});
  add('multiplexor','Seleccionar una línea de datos','Ajusta las líneas de dirección para leer el borne asociado a su código binario.','texto',
    {lineas:['arco','pilar','torre','puerto'],direccion:'10'},p=>{if(!/^[01]{1,6}$/.test(p.direccion))fail('Dirección no válida.');return options(p,'lineas')[parseInt(p.direccion,2)]??fail('El borne no existe.');});
  add('resistencia','Reconocer una resistencia por bandas','Combina las dos cifras y el multiplicador del código de colores.','numero',
    {bandas:['marrón','negro','rojo']},p=>{const colors=['negro','marrón','rojo','naranja','amarillo','verde','azul','violeta','gris','blanco'];
      const b=options(p,'bandas').map(x=>colors.indexOf(x));if(b.length!==3||b.includes(-1))fail('Se necesitan tres bandas válidas.');return (10*b[0]+b[1])*10**b[2];});

  family = 'Inventario y taller';
  add('receta','Reconstruir una mezcla','Calcula cuántas unidades completas permite preparar el inventario sin fraccionar la receta.','numero',
    {existencias:{cera:7,aceite:5},receta:{cera:2,aceite:1}},p=>{const items=Object.entries(p.receta);if(!items.length)fail('Receta vacía.');
      return Math.min(...items.map(([k,n])=>Math.floor(int(p.existencias[k]??0,0,10000)/int(n,1,1000))));});
  add('llavero','Probar el perfil de una llave','Descubre la llave que completa todas las alturas del peine sin rebasar la guarda.','texto',
    {guarda:6,pernos:[1,3,2],llaves:{luna:[5,3,4],ave:[4,3,5]}},p=>{
      const pins=nums(p.pernos),hits=Object.entries(p.llaves).filter(([,v])=>Array.isArray(v)&&v.length===pins.length&&v.every((n,i)=>n+pins[i]===p.guarda));
      return hits.length===1?hits[0][0]:fail('El peine no distingue una llave.');
    });
  add('equipaje','Preparar una mochila limitada','Elige la combinación de herramientas de mayor utilidad que no supere la carga; ordénalas como en el estante.','lista',
    {carga:5,objetos:[{id:'luz',peso:2,utilidad:4},{id:'soga',peso:3,utilidad:5},{id:'libro',peso:4,utilidad:6}]},p=>{
      const items=arr(p.objetos);int(items.length,1,12);const max=int(p.carga,1,100);
      let best=-1,candidates=[];for(let mask=0;mask<2**items.length;mask++){const set=items.filter((_,i)=>mask&(1<<i));
        if(sum(set.map(x=>int(x.peso,1,100)))>max)continue;const score=sum(set.map(x=>int(x.utilidad,1,100)));
        if(score>best){best=score;candidates=[set];}else if(score===best)candidates.push(set);}
      if(candidates.length!==1)fail('Hay más de un equipaje óptimo.');return candidates[0].map(x=>str(x.id));
    });
  add('encajar','Ajustar piezas a sus alojamientos','Relaciona cada hueco con la pieza que coincide en diámetro y tipo de unión.','lista',
    {huecos:[{mm:5,union:'rosca'},{mm:7,union:'lisa'}],piezas:[{id:'latón',mm:7,union:'lisa'},{id:'cobre',mm:5,union:'rosca'}]},p=>arr(p.huecos).map(h=>{
      const ok=arr(p.piezas).filter(t=>t.mm===h.mm&&t.union===h.union);return ok.length===1?str(ok[0].id):fail('Alojamiento ambiguo.');}));
  add('estratos','Excavar por estratos','Ordena los objetos desde el nivel superficial hasta el más antiguo según su profundidad.','lista',
    {objetos:[{id:'anillo',cota:9},{id:'sello',cota:2},{id:'vaso',cota:6}]},p=>{
      const items=arr(p.objetos).slice().sort((a,b)=>a.cota-b.cota);if(unique(items.map(x=>x.cota)).length!==items.length)fail('Dos piezas están al mismo nivel.');return items.map(x=>str(x.id));});
  add('tamiz','Tamizar una muestra','Cuenta qué fracción de la muestra atraviesa la primera malla y queda retenida por la segunda.','numero',
    {diametros:[1,3,5,8,3],primera:6,segunda:2},p=>nums(p.diametros).filter(d=>d<p.primera&&d>=p.segunda).length);
  add('huellas','Emparejar dos roturas','Identifica el fragmento cuyo borde rellena exactamente los entrantes del original.','texto',
    {rotura:[1,-2,3],fragmentos:{azul:[-3,2,-1],ocre:[3,-2,1]}},p=>{
      const edge=nums(p.rotura).reverse();const hits=Object.entries(p.fragmentos).filter(([,v])=>v.length===edge.length&&v.every((n,i)=>n===-edge[i]));
      return hits.length===1?hits[0][0]:fail('Contorno ambiguo.');
    });
  add('embalar','Abrir cajas anidadas','Desenvuelve primero el recipiente exterior y sigue los recipientes que contiene hasta llegar al objeto.','lista',
    {exterior:'cofre',contiene:{cofre:'caja',caja:'sobre',sobre:'llave'}},p=>{
      const queue=[str(p.exterior)],seen=new Set(queue);while(Object.hasOwn(p.contiene,queue.at(-1))){const next=str(p.contiene[queue.at(-1)]);if(seen.has(next)||queue.length>64)fail('Las cajas forman un ciclo.');queue.push(next);seen.add(next);}return queue;
    });
  add('clasificar','Separar lotes por procedencia','Separa en el orden del inventario los objetos cuya marca pertenece al lote reclamado.','lista',
    {origen:'norte',marcas:{onda:'norte',hoja:'sur'},piezas:[{id:'anillo',marca:'onda'},{id:'hebilla',marca:'hoja'},{id:'peso',marca:'onda'}]},p=>arr(p.piezas).filter(v=>p.marcas[v.marca]===p.origen).map(v=>str(v.id)));

  family = 'Naturaleza y materiales';
  add('tabla-periodica','Leer la tabla periódica','Busca en la tabla suministrada los símbolos de los números atómicos seleccionados.','lista',
    {elementos:[{z:6,simbolo:'C'},{z:8,simbolo:'O'},{z:26,simbolo:'Fe'}],numeros:[26,8]},p=>nums(p.numeros).map(n=>{
      const elem=arr(p.elementos).filter(e=>e.z===n);return elem.length===1?str(elem[0].simbolo):fail('Falta el elemento en la tabla.');
    }));
  add('isotopo','Comparar isótopos','Calcula los neutrones de un espécimen a partir de sus números másico y atómico.','numero',
    {masico:13,atomico:6},p=>int(p.masico,1,300)-int(p.atomico,1,118));
  add('densidad','Identificar una muestra por densidad','Combina masa y volumen, y busca el material en la tabla de referencia de la expedición.','texto',
    {masa:24,volumen:3,referencias:[{id:'A',densidad:5},{id:'B',densidad:8}]},p=>{
      const d=nums([p.masa])[0]/int(p.volumen,1,10000),hits=arr(p.referencias).filter(x=>Math.abs(x.densidad-d)<0.0001);return hits.length===1?str(hits[0].id):fail('No hay correspondencia única.');});
  add('anillos','Fechar dos maderas','Desplaza la serie de anillos del fragmento hasta encontrar una única coincidencia con la serie fechada.','numero',
    {serie:[1,3,2,7,4,3],fragmento:[2,7,4],primerAnio:1800},p=>{
      const a=nums(p.serie),b=nums(p.fragmento),found=a.flatMap((_,i)=>b.every((n,j)=>a[i+j]===n)?[i]:[]);return found.length===1?int(p.primerAnio,0,9999)+found[0]:fail('Datación ambigua.');});
  add('rastro','Leer el paso de un animal','Detecta la zancada que rompe el patrón comparando distancias entre huellas consecutivas.','numero',
    {huellas:[1,4,7,12,15],normal:3},p=>{const a=nums(p.huellas),ids=a.slice(1).flatMap((v,i)=>v-a[i]!==p.normal?[i+1]:[]);return ids.length===1?ids[0]:fail('El rastro debe contener un salto irregular.');});
  add('marea','Buscar una ventana de paso','Busca la primera pareja de lecturas consecutivas que deja el agua por debajo de la marca de paso.','numero',
    {alturas:[6,4,5,2,1],limite:3},p=>{const h=nums(p.alturas),i=h.findIndex((v,j)=>v<=p.limite&&h[j+1]<=p.limite);return i<0?fail('No hay ventana de paso.'):i+1;});
  add('ecosistema','Rastrear una cadena alimentaria','Sigue hacia atrás las fuentes de alimento hasta el productor del que depende la especie observada.','lista',
    {observada:'garza',dieta:{garza:'pez',pez:'larva',larva:'alga'}},p=>{
      let item=str(p.observada);const result=[];while(Object.hasOwn(p.dieta,item)){item=str(p.dieta[item]);if(result.includes(item)||result.length>64)fail('La cadena contiene un ciclo.');result.push(item);}return result;});
  add('semillas','Elegir un semillero viable','Cruza la humedad y las horas de luz para encontrar el único vivero apto para la ficha de la semilla.','texto',
    {humedad:[35,55],luz:[6,9],viveros:[{id:'patio',humedad:42,luz:8},{id:'gruta',humedad:60,luz:3}]},p=>{
      const [a,b]=point(p.humedad),[c,d]=point(p.luz),hits=arr(p.viveros).filter(v=>v.humedad>=a&&v.humedad<=b&&v.luz>=c&&v.luz<=d);return hits.length===1?str(hits[0].id):fail('Cultivo sin emplazamiento único.');});

  family = 'Testimonios y documentos';
  add('cotejar-ficha','Identificar una ficha por dos indicios','Busca en el registro la ficha que coincide con la secuencia observada y el precinto del original. Elige primero la ficha y después su precinto.','lista',
    {senal:[2,1,2],precinto:'espiga',fichas:[
      {id:'norte',senal:[2,1,2],precinto:'onda'},
      {id:'sur',senal:[2,2,1],precinto:'espiga'},
      {id:'oeste',senal:[2,1,2],precinto:'espiga'}
    ]},p=>{
      const senal=nums(p.senal),precinto=str(p.precinto),fichas=arr(p.fichas);
      const ids=fichas.map(f=>norm(str(f.id)));
      if(!precinto.trim()||ids.some(id=>!id)||unique(ids).length!==ids.length)fail('Identifica cada ficha y el precinto del original.');
      const matches=fichas.filter(f=>{
        const pulsos=nums(f.senal);
        return norm(str(f.precinto))===norm(precinto)&&pulsos.length===senal.length&&pulsos.every((n,i)=>n===senal[i]);
      });
      if(matches.length!==1)fail('Los dos indicios deben identificar una sola ficha.');
      return [matches[0].id,precinto];
    });
  add('coartada','Descartar una coartada','Contrasta el lugar de la incidencia con los intervalos de presencia acreditados.','texto',
    {instante:45,lugar:'muelle',personas:[{id:'A',registros:[['mercado',35,50]]},{id:'B',registros:[['muelle',40,55]]}]},p=>{
      const possible=arr(p.personas).filter(person=>!arr(person.registros).some(([place,a,b])=>place!==p.lugar&&a<=p.instante&&b>=p.instante));
      return possible.length===1?str(possible[0].id):fail('Los registros no descartan todas las alternativas.');
    });
  add('orden-testigos','Encadenar testimonios','Reconstruye la única secuencia compatible con las observaciones de antes y después.','lista',
    {hechos:['cierre','llamada','carta'],antes:[['carta','llamada'],['llamada','cierre']]},p=>{
      const pending=new Set(options(p,'hechos')),edges=arr(p.antes),out=[];
      while(pending.size){const heads=[...pending].filter(n=>!edges.some(([a,b])=>b===n&&pending.has(a)));
        if(heads.length!==1)fail('Las declaraciones se contradicen o no fijan el orden.');out.push(heads[0]);pending.delete(heads[0]);}return out;});
  add('votacion','Contrastar versiones independientes','Acepta una versión solo si obtiene la mayoría estricta de los testimonios.','texto',
    {declaraciones:['barca','carro','barca','barca','a pie']},p=>{const a=options(p,'declaraciones'),win=a.find(v=>a.filter(k=>k===v).length>a.length/2);return win??fail('No hay mayoría.');});
  add('contradiccion','Encontrar un acta imposible','Localiza al testigo cuyas afirmaciones contradicen las marcas verificadas.','texto',
    {marcas:{puerta:'cerrada',luz:'apagada'},actas:[{id:'N',afirma:{puerta:'cerrada'}},{id:'R',afirma:{luz:'encendida'}}]},p=>{
      const bad=arr(p.actas).filter(a=>Object.entries(a.afirma).some(([k,v])=>Object.hasOwn(p.marcas,k)&&p.marcas[k]!==v));return bad.length===1?str(bad[0].id):fail('El contraste no es concluyente.');});
  add('fuente','Separar fuente y copia','Sigue el origen de las citas y cuenta cuántas fuentes independientes sostienen una afirmación.','numero',
    {citas:['B','C','D'],copiaDe:{B:'A',C:'A'}},p=>{
      const sources=options(p,'citas').map(start=>{let id=start;const visited=new Set();
        while(Object.hasOwn(p.copiaDe,id)){if(visited.has(id)||visited.size>64)fail('Cita circular.');visited.add(id);id=str(p.copiaDe[id]);}return id;});return unique(sources).length;});
  add('registro-doble','Conciliar dos libros','Identifica la anotación que permanece en un libro tras cancelar sus contrapartidas una a una.','lista',
    {libro:['lino','cera','lino','miel'],recibos:['lino','miel']},p=>{const a=options(p,'libro');for(const receipt of options(p,'recibos')){const i=a.indexOf(receipt);if(i<0)fail('Recibo sin asiento.');a.splice(i,1);}return a;});
  add('autenticidad','Verificar una cifra de control','Determina qué documento falla al recalcular su dígito de control con las ponderaciones del archivo.','texto',
    {pesos:[2,1],modulo:7,documentos:[{id:'norte',cifras:[2,3],sello:0},{id:'sur',cifras:[3,1],sello:4}]},p=>{
      const weights=nums(p.pesos),m=int(p.modulo,2,100),bad=arr(p.documentos).filter(doc=>{const n=nums(doc.cifras);
        if(n.length!==weights.length)fail('Longitud del documento incorrecta.');return mod(sum(n.map((v,i)=>v*weights[i])),m)!==doc.sello;});return bad.length===1?str(bad[0].id):fail('Sello no concluyente.');});
  add('interrogatorio','Elegir la pregunta que distingue','Escoge la pregunta cuya respuesta separa a todas las personas que aún encajan en el relato.','texto',
    {preguntas:['turno','sello'],candidatos:[{turno:'noche',sello:'luna'},{turno:'noche',sello:'sol'}]},p=>{
      const suspects=arr(p.candidatos),questions=options(p,'preguntas').filter(k=>unique(suspects.map(s=>s[k])).length===suspects.length);
      return questions.length===1?questions[0]:fail('Se necesita una pregunta discriminante.');});
  add('doble-entrada','Reconstruir una tabla cruzada','Calcula la única casilla que falta en un total de fila y comprueba que concuerda con el total de columna.','numero',
    {fila:[3,1],totalFila:8,columna:[2,4],totalColumna:10},p=>{const x=int(p.totalFila,0,1000)-sum(nums(p.fila));
      if(x<0||int(p.totalColumna,0,1000)-sum(nums(p.columna))!==x)fail('Los totales se contradicen.');return x;});
  add('desempatar','Aplicar un criterio de desempate','Selecciona el expediente con mayor puntuación; si hay empate, prevalece el de menor demora.','texto',
    {expedientes:[{id:'A',puntos:8,demora:5},{id:'B',puntos:8,demora:2},{id:'C',puntos:6,demora:1}]},p=>{
      const a=arr(p.expedientes).slice().sort((x,y)=>y.puntos-x.puntos||x.demora-y.demora);
      if(a[0].puntos===a[1]?.puntos&&a[0].demora===a[1]?.demora)fail('Empate sin resolver.');return str(a[0].id);});

  family = 'Tiempo y mundos paralelos';
  add('reloj','Corregir un reloj adelantado','Corrige el desfase en minutos y lee la nueva hora de veinticuatro horas.','texto',
    {hora:0,minuto:8,adelanto:12},p=>{const n=mod(int(p.hora,0,23)*60+int(p.minuto,0,59)-int(p.adelanto,-1440,1440),1440);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');});
  add('calendario','Avanzar en un calendario','Sigue una instrucción fechada cruzando meses y años bisiestos en el calendario gregoriano.','texto',
    {fecha:'2024-02-28',dias:2},p=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha))fail('Fecha no válida.');const d=new Date(p.fecha+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+int(p.dias,-10000,10000));return d.toISOString().slice(0,10);});
  add('coincidencia','Sincronizar ciclos desfasados','Busca el primer instante en el que dos señales periódicas con distinto desfase coinciden.','numero',
    {periodos:[4,6],desfases:[1,3]},p=>{const a=nums(p.periodos).map(n=>int(n,1,200)),b=nums(p.desfases);if(a.length!==b.length)fail('Desfases incompletos.');
      for(let t=0;t<=10000;t++)if(a.every((n,i)=>mod(t-b[i],n)===0))return t;fail('No coinciden dentro de la ventana.');});
  add('reloj-arena','Interrumpir un reloj de arena','Invierte el reloj en los instantes indicados y calcula cuánto queda en la ampolla superior al final.','numero',
    {duracion:8,giros:[3,6],fin:7},p=>{const size=int(p.duracion,1,1000),events=nums(p.giros),end=int(p.fin,0,10000);let top=size,last=0;
      for(const t of events){if(t<last||t>end)fail('Los giros deben estar ordenados.');top=size-Math.max(0,top-(t-last));last=t;}return Math.max(0,top-(end-last));});
  add('trenes','Planear un transbordo','Encuentra la primera llegada posible combinando servicios y respetando el tiempo mínimo de transbordo.','numero',
    {salida:5,cambio:2,primero:[[4,10],[6,12]],segundo:[[13,20],[15,22]]},p=>{
      const ends=arr(p.primero).filter(([s])=>s>=p.salida).flatMap(([,end])=>arr(p.segundo).filter(([s])=>s>=end+p.cambio).map(([,e])=>e));return ends.length?Math.min(...ends):fail('No hay enlace.');});
  add('efecto-retardado','Propagar consecuencias diferidas','Calcula cuándo alcanza una señal la última sala al atravesar tramos que introducen retardos.','numero',
    {inicio:3,retardos:[2,3,7],pausas:[0,2,0]},p=>{const lag=nums(p.retardos),hold=nums(p.pausas);if(lag.length!==hold.length)fail('Tramos incompatibles.');return nums([p.inicio])[0]+sum(lag)+sum(hold);});
  add('bifurcacion','Recorrer una historia contrafactual','Aplica una serie de marcas de decisión sobre un árbol y descubre qué desenlace resulta.','texto',
    {inicio:'hall',marcas:['norte','eco'],salidas:{hall:{norte:'pozo',sur:'calle'},pozo:{eco:'gruta',silencio:'patio'}}},p=>{
      let place=str(p.inicio);for(const mark of options(p,'marcas')){const dest=Object.hasOwn(p.salidas,place)&&p.salidas[place];if(!dest||!Object.hasOwn(dest,mark))fail('Rama inexistente.');place=str(dest[mark]);}return place;});
  add('desfase','Confrontar dos épocas','Interpola la lectura de una época usando dos puntos de coincidencia de los relojes.','numero',
    {origen:[0,10],destino:[5,25],lectura:7},p=>{const [a,b]=point(p.origen),[c,d]=point(p.destino);if(a===b)fail('Calibración insuficiente.');return c+(nums([p.lectura])[0]-a)*(d-c)/(b-a);});

  family = 'Tableros manipulables';
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
  activa('corredera','Deslizar un mosaico','Mueve el hueco en las direcciones indicadas hasta recomponer el dibujo.',{inicio:['12','_3'],meta:['12','3_']},['E'],(p,moves)=>{
    const rows=grid(p.inicio).map(r=>[...r]),goal=grid(p.meta),y=rows.findIndex(r=>r.includes('_'));if(y<0)return false;let hole=[rows[y].indexOf('_'),y];
    for(const dir of moves){const q=step(hole,dir),tile=at(rows,q);if(!tile)return false;rows[hole[1]][hole[0]]=tile;rows[q[1]][q[0]]='_';hole=q;}return same(rows.map(r=>r.join('')),goal);
  });
  activa('hanoi','Trasladar discos entre soportes','Pasa un disco superior cada vez. Un disco grande nunca puede descansar sobre uno más pequeño.',{pilas:[[2,1],[],[]],meta:2},['0-1','0-2','1-2'],(p,moves)=>{
    const stacks=arr(p.pilas).map(a=>Array.isArray(a)?a.slice():fail('Pila no válida.')),total=sum(stacks.map(a=>a.length));
    for(const m of moves){if(!/^\d-\d$/.test(m))return false;const [s,t]=m.split('-').map(Number),a=stacks[s],b=stacks[t];if(!a?.length||!b||a===b||b.length&&a.at(-1)>=b.at(-1))return false;b.push(a.pop());}return stacks[p.meta]?.length===total;});
  activa('sokoban','Empujar una caja','Empuja la caja hasta la marca. Puedes rodearla, pero no tirar de ella ni atravesar una pared.',{mapa:['....','....'],persona:[0,0],caja:[1,0],meta:[3,0]},['E','E'],(p,moves)=>{
    const rows=grid(p.mapa),free=q=>at(rows,q)==='.';let player=point(p.persona),box=point(p.caja);
    for(const dir of moves){const next=step(player,dir);if(!free(next))return false;if(same(next,box)){const ahead=step(box,dir);if(!free(ahead))return false;box=ahead;}player=next;}return same(box,point(p.meta));});
  activa('trazo','Trazar sin levantar el lápiz','Recorre una vez cada puente dibujado, empezando por el punto indicado y sin repetir puentes.',{inicio:'A',puentes:[['A','B'],['B','C'],['C','A']]},['B','C','A'],(p,moves)=>{
    const edges=arr(p.puentes).map(e=>[...e]);let here=str(p.inicio);
    for(const dest of moves){const i=edges.findIndex(([a,b])=>a===here&&b===dest||b===here&&a===dest);if(i<0)return false;edges.splice(i,1);here=dest;}return !edges.length;});
  activa('salto','Solitario de clavijas','Salta por encima de una clavija hacia el hueco de la línea y retira la clavija saltada.',{fila:'xx.',restan:1},['0-2'],(p,moves)=>{
    const line=[...str(p.fila)];for(const m of moves){if(!/^\d{1,2}-\d{1,2}$/.test(m))return false;const [a,b]=m.split('-').map(Number),mid=(a+b)/2;if(Math.abs(a-b)!==2||line[a]!=='x'||line[mid]!=='x'||line[b]!=='.')return false;line[a]=line[mid]='.';line[b]='x';}return line.filter(c=>c==='x').length===p.restan;});
  activa('tejer','Tejer un recorrido de una sola pieza','Visita todas las casillas abiertas una sola vez, sin salir del tejido ni volver sobre tus pasos.',{mapa:['..','..'],inicio:[0,0]},['E','S','O'],(p,moves)=>{
    const rows=grid(p.mapa);let here=point(p.inicio);const seen=new Set([coord(here)]);for(const dir of moves){here=step(here,dir);if(at(rows,here)!=='.'||seen.has(coord(here)))return false;seen.add(coord(here));}return seen.size===rows.join('').split('.').length-1;});
  activa('esclusa','Operar una esclusa','Cierra ambas compuertas antes de cambiar el nivel. Abre la salida únicamente cuando la cámara esté a su altura.',{entrada:1,salida:3},['cerrar','llenar','llenar','salir'],(p,moves)=>{
    let level=int(p.entrada,0,12),gate='entrada';const target=int(p.salida,0,12);
    for(const op of moves){if(op==='cerrar'&&gate==='entrada')gate='cerrada';else if(op==='llenar'&&gate==='cerrada'&&level<12)level++;else if(op==='vaciar'&&gate==='cerrada'&&level>0)level--;else if(op==='salir'&&gate==='cerrada'&&level===target)gate='salida';else return false;}return gate==='salida';});
  activa('grua','Programar una grúa','Mueve la grúa horizontalmente, recoge una caja y suéltala sobre el andén correcto.',{ancho:4,grua:0,caja:1,meta:3},['E','recoger','E','E','soltar'],(p,moves)=>{
    let x=int(p.grua,0,32),box=int(p.caja,0,32),held=false;const w=int(p.ancho,1,32);
    for(const op of moves){if(op==='E'&&x<w-1)x++;else if(op==='O'&&x>0)x--;else if(op==='recoger'&&!held&&box===x)held=true;else if(op==='soltar'&&held){box=x;held=false;}else return false;}return !held&&box===p.meta;});
  activa('cubeta','Trasladar una muestra sin contaminar','Aclara la pinza entre sustancias incompatibles y toma las muestras en el orden de la ficha.',{muestras:['sal','tinta']},['sal','lavar','tinta'],(p,moves)=>{
    const goal=options(p,'muestras');let clean=true,i=0;for(const op of moves){if(op==='lavar'&&!clean)clean=true;else if(clean&&op===goal[i]){i++;clean=false;}else return false;}return i===goal.length;});
  activa('torno','Enrollar un cable sin solaparse','Alterna los tambores respetando la capacidad de cada uno hasta recoger toda la longitud.',{capacidad:{A:2,B:2},longitud:4},['A','B','A','B'],(p,moves)=>{
    const spent=new Map();let last='';for(const id of moves){if(!Object.hasOwn(p.capacidad,id)||id===last)return false;const n=(spent.get(id)||0)+1;if(n>p.capacidad[id])return false;spent.set(id,n);last=id;}return moves.length===p.longitud;});
  activa('rescate','Cruzar con una linterna compartida','Mueve una o dos personas por viaje; la lámpara debe viajar siempre y el tiempo lo marca la persona más lenta.',{tiempos:{A:1,B:2,C:5},limite:8},['A+B','A','A+C'],(p,moves)=>{
    const people=Object.keys(p.tiempos),far=new Set();let outbound=true,time=0;
    for(const m of moves){const team=str(m).split('+');if(!team.length||team.length>2||unique(team).length!==team.length||team.some(x=>!people.includes(x)||far.has(x)===outbound))return false;
      for(const x of team){if(outbound)far.add(x);else far.delete(x);}time+=Math.max(...team.map(x=>int(p.tiempos[x],1,100)));outbound=!outbound;}
    return far.size===people.length&&time<=p.limite;});

  function withinBudget(value, limit = 2800) {
    const stack = [[value, 0]];
    let count = 0;
    while (stack.length) {
      const [node, depth] = stack.pop();
      if (++count > limit || depth > 12) return false;
      if (node === null || typeof node === 'boolean') continue;
      if (typeof node === 'number') { if (!Number.isFinite(node)) return false; continue; }
      if (typeof node === 'string') { if (node.length > 3500) return false; continue; }
      if (typeof node !== 'object') return false;
      const entries = Object.entries(node);
      if (entries.length > 160 || entries.some(([key]) => ['__proto__','constructor','prototype'].includes(key))) return false;
      for (const [, child] of entries) stack.push([child, depth + 1]);
    }
    return true;
  }

  function lectura(control, input) {
    if (control === 'numero') {
      if (!['string','number'].includes(typeof input) || String(input).trim() === '') return null;
      const n = Number(String(input).replace(',','.'));return Number.isFinite(n) ? n : null;
    }
    if (control === 'punto' || control === 'lista') {
      let v = input;
      if (typeof v === 'string') {
        if (v.trim().startsWith('[')) { try { v = JSON.parse(v); } catch { return null; } }
        else v = v.split(control === 'punto' ? /[,;]/ : ';').map(s => s.trim());
      }
      if (!Array.isArray(v) || v.length > 160 || v.some(x => !['number','string'].includes(typeof x))) return null;
      if (control === 'punto') return v.length === 2 && v.every(x => String(x).trim() !== '' && Number.isFinite(Number(x))) ? v.map(Number) : null;
      return v.map(x => typeof x === 'number' ? x : x.trim());
    }
    return typeof input === 'string' && input.trim() ? input.trim() : null;
  }
  function equalReading(actual, expected) {
    if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => equalReading(actual[i], v));
    if (typeof expected === 'number') return !Array.isArray(actual) && actual !== '' && Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) < 1e-7;
    return typeof actual === 'string' && norm(actual) === norm(expected);
  }
  function comprobar(id, parametros, intento) {
    const rule = registry.get(id);
    if (!rule || !withinBudget(parametros) || !withinBudget(intento)) return false;
    try {
      const supplied = lectura(rule.descriptor.entradas[0].tipo, intento);
      if (supplied === null) return false;
      if (rule.validarIntento) return rule.validarIntento(parametros, supplied) === true;
      return equalReading(supplied,rule.derivar(parametros));
    } catch { return false; }
  }
  // Las ediciones privadas conservan la respuesta en el servidor. La demo
  // sin cuenta utiliza el mismo evaluador con su propia evidencia local.
  function intentoValido(forma, intento) {
    if (forma?.tipo !== 'campos' || !Array.isArray(forma.campos) || !intento ||
        typeof intento !== 'object' || Array.isArray(intento) || !withinBudget(intento)) return false;
    const keys = forma.campos;
    return keys.length === Object.keys(intento).length && new Set(keys).size === keys.length &&
      keys.every(key => typeof key === 'string' && Object.hasOwn(intento,key) &&
        typeof intento[key] === 'string' && intento[key].trim().length > 0);
  }
  function canonizarPiezas(tipo,piezas,cantidad) {
    if (!['secuencia','conjunto'].includes(tipo) || !Number.isSafeInteger(cantidad) || cantidad < 1 ||
        cantidad > 160 || !Array.isArray(piezas) || piezas.length !== cantidad) return null;
    const lista=Array.from(piezas);
    if (!lista.every(v => typeof v === 'string' || Number.isFinite(v))) return null;
    if (tipo === 'secuencia') return lista;
    if (new Set(lista).size !== cantidad) return null;
    return lista.sort((a,b) => {
      if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1;
      return a < b ? -1 : Number(a > b);
    });
  }
  function evaluarPrueba(regla, intento) {
    if (!regla || typeof regla !== 'object') return false;
    if (regla.tipo === 'mecanica') return comprobar(regla.mecanica, regla.parametros, intento);
    const modelo = regla.respuesta;
    if (!withinBudget(modelo) || !withinBudget(intento)) return false;
    const identificador = value => typeof value === 'string' || Number.isFinite(value);
    switch (regla.tipo) {
      case 'seleccion':
        return identificador(modelo) && intento === modelo;
      case 'secuencia':
      case 'conjunto': {
        const esperado=canonizarPiezas(regla.tipo,modelo,modelo?.length);
        const recibido=canonizarPiezas(regla.tipo,intento,modelo?.length);
        return esperado!==null && recibido!==null && esperado.every((valor,i)=>valor===recibido[i]);
      }
      case 'campos': {
        if (!modelo || !intento || typeof modelo !== 'object' || typeof intento !== 'object' ||
            Array.isArray(modelo) || Array.isArray(intento)) return false;
        const keys = Object.keys(modelo);
        if (!intentoValido({tipo:'campos',campos:keys},intento)) return false;
        const modo = regla.normalizacion ?? 'literal';
        if (!['texto','literal'].includes(modo)) return false;
        const comparar = modo === 'texto' ?
          value => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ') :
          value => value;
        return keys.every(key => Object.hasOwn(intento,key) && typeof modelo[key] === 'string' &&
          typeof intento[key] === 'string' && comparar(modelo[key]) === comparar(intento[key]));
      }
      default: return false;
    }
  }
  const roles = ['A','B'];
  const types = ['ir','observar','inspeccionar','recoger','combinar','transferir','hablar','decidir','prueba','sincronizar'];
  const safeId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id) && !['constructor','prototype'].includes(id);
  const textOk = (value, max = 1200) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const asset = path => typeof path === 'string' && /^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(path) && !path.includes('..');
  const idsOk = list => Array.isArray(list) && list.length <= 96 && list.every(safeId) && unique(list).length === list.length;
  const own = (o,k) => o && typeof o === 'object' && Object.hasOwn(o,k);
  const listOf = (value, cap, check) => Array.isArray(value) && value.length <= cap && value.every(check);
  const soundOk = m => !m.audio || asset(m.audio) && textOk(m.transcripcion,3500);
  function graphicOk(g) {
    return !g || g.tipo === 'cuadricula' && listOf(g.filas,24,r=>textOk(r,32)) && g.filas.length>0 && g.filas.every(r=>r.length===g.filas[0].length) ||
      g.tipo === 'golpes' && listOf(g.tiempos,32,n=>Number.isInteger(n)&&n>=0&&n<=12000) && g.tiempos.length>0 ||
      g.tipo === 'tonos' && listOf(g.frecuencias,8,n=>Number.isFinite(n)&&n>=50&&n<=4000) && g.frecuencias.length>0 ||
      g.tipo === 'tintas' && listOf(g.marcas,32,m=>m&&textOk(m.letra,8)&&textOk(m.luz,32)) && g.marcas.length>0;
  }
  function validar(def) {
    if (!def || typeof def !== 'object' || !withinBudget(def,18000)) return ['El documento debe contener una aventura JSON de tamaño compatible.'];
    const errors = [];
    if (!safeId(def.id) || !textOk(def.titulo,160)) errors.push('La aventura necesita un identificador y un título.');
    if (!Array.isArray(def.escenas) || !def.escenas.length || def.escenas.length > 96 ||
        def.escenas.some(s => !s || !safeId(s.id)) || !idsOk(def.escenas.map(s => s.id))) return [...errors,'Las escenas necesitan identificadores únicos.'];
    const scenes = new Set(def.escenas.map(s => s.id));
    if (!scenes.has(def.inicio)) errors.push('La escena de inicio no existe.');
    if (def.inicios && roles.some(r => !scenes.has(def.inicios[r]))) errors.push('Los puntos de entrada de ambos papeles deben existir.');
    const props = def.objetos ?? [];
    if (!listOf(props,96,o => o && safeId(o.id) && textOk(o.nombre,120) && textOk(o.descripcion) && (!o.imagen || asset(o.imagen))) ||
        !idsOk(props.map(o => o.id))) return [...errors,'Revisa los objetos, sus descripciones y sus identificadores únicos.'];
    const propIds = new Set(props.map(o => o.id));
    let finale = false;
    for (const scene of def.escenas) {
      const prefix = 'Escena '+scene.id;
      if (!textOk(scene.titulo,160) || !textOk(scene.texto,3500)) errors.push(prefix+' necesita un título y una descripción.');
      if (scene.imagen && !asset(scene.imagen) || !soundOk(scene)) errors.push(prefix+' necesita un recurso local y la transcripción del audio.');
      if (scene.variantes && !listOf(scene.variantes,16,v => v && idsOk(v.requiere) && soundOk(v) && ((!v.imagen || asset(v.imagen)) && (!v.texto || textOk(v.texto,3500))))) errors.push(prefix+' contiene una variante o una transcripción no válida.');
      if (!Array.isArray(scene.acciones) || !scene.acciones.length || scene.acciones.length > 64 ||
          scene.acciones.some(a => !a || !safeId(a.id)) || !idsOk(scene.acciones.map(a => a.id))) { errors.push(prefix+' necesita acciones con identificadores únicos.');continue; }
      for (const a of scene.acciones) {
        const where=prefix+', acción '+a.id;
        if (!types.includes(a.tipo) || !textOk(a.titulo,180)) errors.push(where+' necesita un tipo y un título válidos.');
        if (a.papel && !roles.includes(a.papel)) errors.push(where+' tiene un papel no válido.');
        if (a.fin === true) finale = true;
        if ((a.tipo === 'ir' || a.destino !== undefined) && !scenes.has(a.destino)) errors.push(where+' apunta a una escena inexistente.');
        if (['requiere','activa','desactiva','ocultaSi'].some(k=>a[k]!==undefined&&!idsOk(a[k]))) errors.push(where+' contiene condiciones o efectos no válidos.');
        if (a.tipo === 'sincronizar' && a.papel) errors.push(where+' debe estar disponible para ambos papeles.');
        if (['recoger','transferir','inspeccionar'].includes(a.tipo) && !propIds.has(a.objeto)) errors.push(where+' cita un objeto que no existe.');
        if (a.tipo === 'combinar' && (!idsOk(a.usa) || a.usa.length < 2 || a.usa.some(id=>!propIds.has(id)) || !propIds.has(a.entrega))) errors.push(where+' necesita al menos dos materiales y un resultado del inventario.');
        if (a.materiales && !listOf(a.materiales,32,m=>m&&textOk(m.titulo,160)&&textOk(m.texto,2400)&&(!m.imagen||asset(m.imagen))&&soundOk(m)&&graphicOk(m.grafico))) errors.push(where+' contiene evidencias o transcripciones incompletas.');
        if (a.opciones && !listOf(a.opciones,64,o=>o&&textOk(o.id,120)&&textOk(o.label,180))) errors.push(where+' contiene opciones incompletas.');
        if (a.zona && ![a.zona.x,a.zona.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)) errors.push(where+' tiene una zona fuera de imagen.');
        if (a.tipo === 'prueba') {
          const rule=registry.get(a.mecanica);
          if (!rule || !a.parametros || !withinBudget(a.parametros)) errors.push(where+' necesita una mecánica y sus parámetros.');
          else try {
            if (rule.validarIntento) {
              const expectedKeys=Object.keys(rule.descriptor.ejemplo.parametros);
              if (!expectedKeys.every(k=>own(a.parametros,k))) fail('Faltan parámetros de la simulación.');
            } else {
              const expected=rule.derivar(a.parametros);
              if(!withinBudget(expected))fail('El modelo no devuelve una lectura válida.');
            }
          } catch { errors.push(where+' tiene parámetros incompatibles con la mecánica.'); }
          if (!a.materiales?.length) errors.push(where+' necesita al menos una pista visible con la que jugar.');
        }
      }
    }
    if (!finale) errors.push('Añade una acción de desenlace con fin igual a true.');
    return errors;
  }

  function iniciar(def,modo='solo') {
    const errors=validar(def);if(errors.length)fail(errors[0]);
    if(!['solo','duo'].includes(modo))fail('La modalidad debe ser solo o duo.');
    return {version:1,aventura:def.id,modo,turnos:0,completada:false,
      posiciones:{A:def.inicios?.A||def.inicio,B:def.inicios?.B||def.inicio},inventarios:{A:[],B:[]},
      banderas:[],recogidos:[],hechas:[],sincronias:{},cuaderno:[]};
  }
  const hasAll=(required,list)=>(required||[]).every(id=>list.includes(id));
  function disponible(a,scene,state,role) {
    if (state.completada || a.papel && a.papel!==role || !hasAll(a.requiere,state.banderas) || (a.ocultaSi||[]).some(k=>state.banderas.includes(k))) return false;
    const bag=state.inventarios[role];
    if (a.unaVez && state.hechas.includes(scene.id+'/'+a.id))return false;
    if (a.tipo==='recoger')return !state.recogidos.includes(a.objeto);
    if (a.tipo==='transferir'||a.tipo==='inspeccionar')return bag.includes(a.objeto);
    if (a.tipo==='combinar')return hasAll(a.usa,bag)&&!state.recogidos.includes(a.entrega);
    if (a.tipo==='sincronizar')return !state.sincronias[scene.id+'/'+a.id]?.includes(role);
    return true;
  }
  function vista(def,state,papel='A') {
    if(!roles.includes(papel)||!state||state.aventura!==def.id)fail('El papel o la aventura no corresponden a esta partida.');
    const scene=def.escenas.find(s=>s.id===state.posiciones[papel]);if(!scene)fail('La escena guardada no existe.');
    const variant=(scene.variantes||[]).filter(v=>hasAll(v.requiere,state.banderas)).at(-1)||{};
    const out={id:scene.id,titulo:scene.titulo,texto:variant.texto||scene.texto};
    for(const key of ['imagen','audio','mundo'])if(variant[key]||scene[key])out[key]=variant[key]||scene[key];
    if(out.audio)out.transcripcion=variant.audio?variant.transcripcion:scene.transcripcion;
    const actions=scene.acciones.filter(a=>disponible(a,scene,state,papel)).map(a=>{
      const action={id:a.id,titulo:a.titulo,tipo:a.tipo,controles:[],
        materiales:(a.materiales||[]).map(materialPublico),opciones:(a.opciones||[]).map(o=>({id:o.id,label:o.label}))};
      if(a.tipo==='prueba'){const item=registry.get(a.mecanica).descriptor;action.mecanica=item.id;action.controles=clone(item.entradas);action.instrucciones=item.descripcion;}
      if(a.papel)action.papel=a.papel;if(a.zona)action.zona={x:a.zona.x,y:a.zona.y};
      return action;
    });
    const inventario=state.inventarios[papel].map(id=>{
      const item=(def.objetos||[]).find(o=>o.id===id);const out={id:item.id,nombre:item.nombre,descripcion:item.descripcion};
      if(item.imagen)out.imagen=item.imagen;return out;
    });
    return {escena:out,inventario,cuaderno:[...state.cuaderno],acciones:actions,papel,modo:state.modo,completada:state.completada};
  }
  function ejecutar(def,state,request) {
    const reject=mensaje=>({ok:false,estado:state,mensaje});
    if(!request||!roles.includes(request.papel)||!state||state.aventura!==def.id||state.completada)return reject('La partida no admite esta acción.');
    const role=request.papel,other=role==='A'?'B':'A';
    const scene=def.escenas.find(s=>s.id===state.posiciones[role]&&s.id===request.escena);
    const action=scene?.acciones.find(a=>a.id===request.accion);
    if(!action||!disponible(action,scene,state,role))return reject('Esta acción no está disponible en tu escena actual.');
    if(action.tipo==='prueba'&&!evaluarPrueba({tipo:'mecanica',mecanica:action.mecanica,parametros:action.parametros},request.intento))return reject(action.error||'Todavía no encaja. Revisa las evidencias y vuelve a probar.');
    const next=clone(state),key=scene.id+'/'+action.id,bag=next.inventarios[role];
    next.turnos++;
    if(action.tipo==='sincronizar'){
      const ready=next.sincronias[key]||[];ready.push(role);next.sincronias[key]=ready;
      if(ready.length<2)return {ok:true,estado:next,mensaje:'Tu puesto está preparado. Falta el otro puesto.'};
      delete next.sincronias[key];
    }
    if(action.tipo==='recoger'){bag.push(action.objeto);next.recogidos.push(action.objeto);}
    if(action.tipo==='transferir'){bag.splice(bag.indexOf(action.objeto),1);next.inventarios[other].push(action.objeto);}
    if(action.tipo==='combinar'){
      if(action.consume!==false)next.inventarios[role]=bag.filter(id=>!action.usa.includes(id));
      next.inventarios[role].push(action.entrega);next.recogidos.push(action.entrega);
    }
    next.banderas=unique(next.banderas.filter(k=>!(action.desactiva||[]).includes(k)).concat(action.activa||[]));
    if(action.nota&&!next.cuaderno.includes(action.nota))next.cuaderno.push(action.nota);
    if(action.destino&&action.destino!==scene.id){
      next.posiciones[role]=action.destino;
      for(const [station,ready] of Object.entries(next.sincronias)){
        if(station.startsWith(scene.id+'/')&&ready.includes(role))delete next.sincronias[station];
      }
    }
    if(action.unaVez&&!next.hechas.includes(key))next.hechas.push(key);
    if(action.fin)next.completada=true;
    return {ok:true,estado:next,mensaje:action.exito||(action.fin?'Aventura completada.':'Acción guardada.')};
  }

  // El adaptador solo lo construye el juego con sus reglas y su estado inicial.
  // La partida aporta los pasos; el motor exige que la victoria cierre el recorrido.
  function reproducirPrueba(pasos, {maxPasos, aplicar, resuelta}) {
    if (!Number.isInteger(maxPasos) || maxPasos < 1 || maxPasos > 1024 ||
        !Array.isArray(pasos) || !pasos.length || pasos.length > maxPasos ||
        typeof aplicar !== 'function' || typeof resuelta !== 'function') return false;
    for (const paso of pasos) {
      if (resuelta() || aplicar(paso) !== true) return false;
    }
    return resuelta() === true;
  }
  function plantilla() {
    return {
      id:'el-farol-de-las-dos-mareas',titulo:'El farol de las dos mareas',inicio:'archivo',inicios:{A:'archivo',B:'puerto'},
      objetos:[
        {id:'filtro',nombre:'Filtro violeta',descripcion:'Una lente del diámetro exacto del farol.',imagen:'/instrumento-luz.webp'},
        {id:'farol',nombre:'Farol de puerto',descripcion:'En el aro de latón se puede montar una lente.',imagen:'/umbravia-farol.webp'},
        {id:'visor',nombre:'Farol con filtro',descripcion:'La luz revela las marcas invisibles de la placa.',imagen:'/instrumento-luz.webp'}
      ],
      escenas:[
        {id:'archivo',titulo:'El gabinete del farero',mundo:'Antes de la crecida',imagen:'/sala-archivo.webp',
          texto:'La guarda custodia una lente violeta. A través del montacargas se oye el agua del otro puerto.',
          acciones:[
            {id:'oir',tipo:'hablar',titulo:'Preguntar a la guarda por el montacargas',nota:'El montacargas entrega los objetos al otro puesto.',exito:'«Lo que dejes en la cesta llegará a la otra orilla».',unaVez:true},
            {id:'tomar-filtro',tipo:'recoger',titulo:'Recoger el filtro violeta',objeto:'filtro',zona:{x:62,y:53},exito:'La lente sale del cajón.'},
            {id:'enviar',tipo:'transferir',titulo:'Enviar el filtro al otro puesto',objeto:'filtro',exito:'El otro puesto ha recibido el filtro.'},
            {id:'pasar',tipo:'ir',titulo:'Cruzar a la esclusa',requiere:['mensaje'],destino:'esclusa'}
          ]},
        {id:'puerto',titulo:'El puerto de las marcas borradas',mundo:'Después de la crecida',imagen:'/extras-expedicion.webp',
          texto:'El agua alcanzó la placa de señales. Aún queda un farol junto a la escala.',
          variantes:[{requiere:['iluminado'],texto:'Bajo la luz violeta se distinguen un texto cifrado y las marcas de un disco.'}],
          acciones:[
            {id:'tomar-farol',tipo:'recoger',titulo:'Recoger el farol',objeto:'farol',zona:{x:30,y:63}},
            {id:'montar',tipo:'combinar',titulo:'Encajar el filtro en el aro del farol',usa:['filtro','farol'],entrega:'visor',exito:'El aro sujeta el filtro y el farol vuelve a iluminar.'},
            {id:'alumbrar',tipo:'inspeccionar',titulo:'Alumbrar la placa con el visor',objeto:'visor',activa:['iluminado'],nota:'En la placa se lee VDO. Las tres muescas del disco apuntan hacia atrás.',unaVez:true},
            {id:'leer',tipo:'prueba',titulo:'Leer el nombre del atraque',mecanica:'cesar',parametros:{inscripcion:'VDO',giro:3},
              materiales:[{titulo:'Placa recuperada',texto:'La inscripción dice VDO. Para leerla, mueve cada letra tres pasos atrás en el alfabeto A–Z.',imagen:'/instrumento-luz.webp'}],
              requiere:['iluminado'],activa:['mensaje'],unaVez:true,exito:'En las dos épocas se ha abierto el paso a la esclusa.'},
            {id:'pasar',tipo:'ir',titulo:'Ir a la esclusa abierta',requiere:['mensaje'],destino:'esclusa'}
          ]},
        {id:'esclusa',titulo:'Las dos manivelas',mundo:'Las dos orillas',imagen:'/atlas-puerto.webp',
          texto:'Una manivela asoma en cada puesto. Ambas deben quedar sujetas para levantar la rejilla.',
          acciones:[{id:'levantar',tipo:'sincronizar',titulo:'Sujetar la manivela de mi puesto',fin:true,exito:'La rejilla sube a la vez en ambos puertos. La señal vuelve a pasar.'}]}
      ]
    };
  }
  const catalogo=[...registry.values()].map(({descriptor})=>descriptor);
  function materialPublico(m) {
    const result={titulo:m.titulo,texto:m.texto};
    if(m.imagen)result.imagen=m.imagen;
    if(m.audio){result.audio=m.audio;result.transcripcion=m.transcripcion;}
    if(m.grafico){
      const key=({cuadricula:'filas',golpes:'tiempos',tonos:'frecuencias'})[m.grafico.tipo];
      if(key)result.grafico={tipo:m.grafico.tipo,[key]:[...m.grafico[key]]};
      if(m.grafico.tipo==='tintas')result.grafico={tipo:'tintas',marcas:m.grafico.marcas.map(({letra,luz})=>({letra,luz}))};
    }
    return result;
  }
  function muestraTexto(v) {
    if(Array.isArray(v))return v.map(muestraTexto).join(' / ');
    if(v&&typeof v==='object')return Object.entries(v).map(([k,n])=>k+' = '+muestraTexto(n)).join(', ');
    return String(v);
  }
  // Esta fábrica parte siempre de ejemplos de taller, independientes de las ediciones comerciales.
  function plantillaPrueba(id) {
    const rule=registry.get(id);if(!rule)fail('Mecánica desconocida.');
    const d=rule.descriptor,p=clone(d.ejemplo.parametros),materiales=Object.entries(p).map(([k,v])=>{
      const titulo=k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
      const material={titulo,texto:muestraTexto(v)};
      if(['mapa','marco','tabla','rejilla','antes','despues','capa1','capa2','alturas'].includes(k)&&
          Array.isArray(v)&&v.length&&v.every(r=>typeof r==='string'&&r.length===v[0].length))material.grafico={tipo:'cuadricula',filas:v};
      if(id==='ultravioleta'&&k==='marcas')material.grafico={tipo:'tintas',marcas:v.map(({letra,luz})=>({letra,luz}))};
      if(k==='golpes'&&v.every(Number.isInteger)&&v.length>1){
        const scale=Math.max(...v)<=40?150:1;
        material.grafico={tipo:'golpes',tiempos:v.map(n=>(n-v[0])*scale)};
      }
      if(['tono','patron','fundamental'].includes(k)&&Number.isFinite(v)&&v>=50&&v<=4000)material.grafico={tipo:'tonos',frecuencias:[v]};
      return material;
    });
    const action={id,tipo:'prueba',titulo:d.nombre,mecanica:id,parametros:p,materiales};
    if(id==='cotejar-ficha'){
      action.materiales=[
        {titulo:'Señal observada',texto:'Los pulsos duran '+p.senal.join(' · ')+' tiempos.'},
        {titulo:'Parte de salida',texto:'El original lleva el precinto «'+p.precinto+'».'},
        {titulo:'Registro de fichas',texto:p.fichas.map(f=>'Ficha '+f.id+' · '+f.senal.join('–')+' · precinto '+f.precinto).join('\n')},
        {titulo:'Entrega del original',texto:'Indica primero la ficha y después el precinto que acredita tu elección.'}
      ];
      action.opciones=[
        ...p.fichas.map(f=>({id:f.id,label:'Ficha '+f.id})),
        ...unique(p.fichas.map(f=>f.precinto)).map(id=>({id,label:'Precinto '+id}))
      ];
    }
    if(rule.validarIntento){
      const commands=({corredera:[...orderDirections],sokoban:[...orderDirections],tejer:[...orderDirections],esclusa:['cerrar','llenar','vaciar','salir'],grua:['E','O','recoger','soltar'],
        cubeta:[...p.muestras||[],'lavar'],torno:Object.keys(p.capacidad||{}),trazo:unique((p.puentes||[]).flat())})[id];
      if(commands?.length)action.opciones=commands.map(id=>({id,label:id}));
    }
    return action;
  }
  function montarMaterial(host,m) {
    const doc=host.ownerDocument||root.document;
    const make=(tag,text)=>{const item=doc.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
    const paper=make('article');paper.className='material-aventura';
    paper.append(make('h4',m.titulo),make('p',m.texto));
    if(m.imagen&&asset(m.imagen)){
      const detail=make('details'),photo=make('img');photo.src=m.imagen;photo.alt=m.titulo;photo.loading='lazy';
      photo.style.maxWidth='100%';photo.style.height='auto';detail.append(make('summary','Examinar la imagen'),photo);paper.append(detail);
    }
    if(m.audio&&soundOk(m)){
      const audio=make('audio');audio.controls=true;audio.preload='none';audio.src=m.audio;audio.setAttribute('aria-label',m.titulo);
      const transcript=make('details');transcript.setAttribute('data-game-transcript','');transcript.append(make('summary','Leer transcripción'),make('p',m.transcripcion));paper.append(audio,transcript);
    }
    const g=m.grafico;
    if(g&&graphicOk(g)){
      if(g.tipo==='cuadricula'){
        const table=make('table');table.setAttribute('aria-label',m.titulo);
        for(const row of g.filas){const tr=make('tr');for(const mark of row)tr.append(make('td',mark));table.append(tr);}paper.append(table);
      }else if(g.tipo==='golpes'||g.tipo==='tonos'){
        const button=make('button','Escuchar la señal'),msg=make('span');button.type='button';msg.setAttribute('role','status');
        button.addEventListener('click',async()=>{
          const C=root.AudioContext||root.webkitAudioContext;if(!C){msg.textContent='Consulta la lectura de la señal que aparece arriba.';return;}
          button.disabled=true;let ctx;try{
            ctx=new C();await ctx.resume();
            const times=g.tipo==='golpes'?g.tiempos.map(ms=>ms/1000):g.frecuencias.map((_,i)=>i*.45);
            const duration=g.tipo==='golpes'?.065:.32;
            times.forEach((offset,i)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+.03+offset;
              oscillator.frequency.value=g.tipo==='golpes'?500:g.frecuencias[i];gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.13,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
              oscillator.connect(gain);gain.connect(root.GamePreferences?.audioOutput?.(ctx)||ctx.destination);oscillator.start(t);oscillator.stop(t+duration);});
            await new Promise(resolve=>root.setTimeout(resolve,1000*(Math.max(...times)+duration+.08)));msg.textContent='Señal reproducida.';
          }catch{msg.textContent='Consulta la lectura de la señal que aparece arriba.';}finally{if(ctx)await ctx.close().catch(()=>{});button.disabled=false;}
        });paper.append(button,msg);
      }
    }
    host.append(paper);return paper;
  }
  function freeze(value) {
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
    return value;
  }
  root.MotorAventuras=Object.freeze({catalogo:freeze(catalogo),validar,iniciar,ejecutar,vista,plantilla,plantillaPrueba,montarMaterial,comprobar,evaluarPrueba,reproducirPrueba,canonizarPiezas,intentoValido});
})(globalThis);
