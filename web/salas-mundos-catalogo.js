(function (root) {
  'use strict';

  // Los materiales que recibe el jugador se pueden leer también sin interpretar los símbolos.
  const evidence = (label, text) => ({label, text});
  const piece = (id, label, mark, note) => ({id, label, mark, note});
  const slot = (id, label) => ({id, label});
  const positions = (...labels) => labels.map((label, i) => slot('p' + (i + 1), label));
  function room(id, caseId, title, photo, intro, stations) {
    const prizes = [1, 1, 1, 2, 1, 2];
    return {id, caseId, title, photo, intro, games: stations.map((station, i) => ({...station, prize: prizes[i]}))};
  }

  const chartroom = room(2, 13, 'El camarote del cartógrafo', '/extras-expedicion.webp',
    'Extiende la carta náutica sobre la mesa y reconstruye la costa que llevaba al faro.', [
    {
      id: 'luces', title: 'Las luces de la escollera', kind: 'select', mechanic: 'Reconocer señales',
      photo: '/umbravia-farol.webp', description: 'Separa las dos señales de entrada de las luces de los barcos fondeados.',
      prompt: 'El vigía vio dos faroles fijos. Selecciona las dos placas cuyo ritmo coincide con su registro.',
      evidence: [
        evidence('Tira del vigía', 'Entrada exterior: dos destellos cortos y uno largo. Entrada interior: uno largo, silencio, otro largo.'),
        evidence('Leyenda del faro', 'El punto representa un destello corto, la raya uno largo y la barra un silencio. Lee de izquierda a derecha.')
      ],
      pieces: [
        piece('muelle', 'Muelle', '— · ·', 'Largo, corto, corto.'), piece('punta', 'Punta', '· · —', 'Corto, corto, largo.'),
        piece('roca', 'Roca', '— / ·', 'Largo, silencio, corto.'), piece('boya', 'Boya', '· / —', 'Corto, silencio, largo.'),
        piece('dique', 'Dique', '— / —', 'Largo, silencio, largo.')
      ],
      slots: positions('Señal recuperada', 'Segunda señal'),
      hint: 'Una de las señales tiene una pausa en mitad de la tira. La otra termina con el destello más largo.',
      feedback: 'Compara de nuevo la duración del último destello y la posición del silencio.',
      success: 'Los dos faroles dibujan la boca navegable del estuario.'
    },
    {
      id: 'portulano', title: 'Un portulano en cuatro tiras', kind: 'order', mechanic: 'Reconstruir un mapa',
      photo: '/valdemar-cartografia.webp', description: 'Continúa el dibujo de la costa a través de cuatro trozos de carta.',
      prompt: 'Tiende las tiras desde el embarcadero hasta el faro. En cada unión deben coincidir los dibujos de ambos bordes.',
      evidence: [evidence('Margen de la carta', 'El embarcadero queda al oeste; el faro, al este. El nombre del puerto se lee derecho: ninguna tira se gira.')],
      pieces: [
        piece('cabo', 'Cabo', '○ → ≋', 'Izquierda: ojo de roca. Derecha: tres olas.'), piece('istmo', 'Istmo', '△ → ○', 'Izquierda: pico. Derecha: ojo de roca.'),
        piece('rada', 'Rada', '⚓ → △', 'Izquierda: embarcadero. Derecha: pico.'), piece('barra', 'Barra', '≋ → ✦', 'Izquierda: tres olas. Derecha: faro.')
      ],
      slots: positions('Oeste', 'Tramo central oeste', 'Tramo central este', 'Este'),
      hint: 'Localiza la tira del embarcadero. ¿Qué dibujo queda libre a su derecha?',
      feedback: 'Hay una costa interrumpida. Revisa las dos marcas que se tocan en cada unión.',
      success: 'La carta vuelve a mostrar una costa continua hasta el faro.'
    },
    {
      id: 'compases', title: 'La rosa que perdió el norte', kind: 'align', mechanic: 'Calibrar tres agujas',
      photo: '/expedicion-tablero.webp', description: 'Corrige tres compases que dan lecturas distintas en la misma mesa.',
      prompt: 'Orienta cada aguja hacia su rumbo corregido. Usa las anotaciones de desvío que dejó el piloto.',
      evidence: [
        evidence('Rosa grabada', 'En sentido horario se pasa de norte a este, sur, oeste y otra vez norte. Un cuarto de vuelta equivale a un paso.'),
        evidence('Nota de taller', 'Al de cobre dale un paso horario. Al de boj, un paso antihorario. El de hueso necesita media vuelta.')
      ],
      pieces: [
        piece('cobre', 'Compás de cobre', '↑', 'La aguja parte del norte.'), piece('boj', 'Compás de boj', '←', 'La aguja parte del oeste.'),
        piece('hueso', 'Compás de hueso', '↓', 'La aguja parte del sur.')
      ],
      slots: [slot('cobre','Compás de cobre'),slot('boj','Compás de boj'),slot('hueso','Compás de hueso')],
      hint: 'Parte de la dirección marcada en cada instrumento. El cuarto de vuelta del compás de boj va en el sentido contrario al del cobre.',
      feedback: 'Uno de los rumbos aún conserva el desvío. Comprueba sentido y número de giros.',
      success: 'Las tres agujas han quedado calibradas para la próxima guardia.'
    },
    {
      id: 'atraques', title: 'Tres quillas en la niebla', kind: 'place', mechanic: 'Distribuir embarcaciones',
      photo: '/atlas-puerto.webp', description: 'Encuentra un atraque para cada casco antes de que baje la marea.',
      prompt: 'Asigna una embarcación a cada amarre. Cada una necesita agua suficiente bajo la quilla y espacio para su mástil.',
      evidence: [
        evidence('Sonda del puerto', 'El bajo admite hasta 2 marcas de calado. El puente y la dársena admiten hasta 4.'),
        evidence('Croquis del puente', 'Solo el puente limita el mástil a 2 marcas de altura. El bajo y la dársena están al aire libre.')
      ],
      pieces: [
        piece('vela', 'Vela gris', '3 ≋ · 4 ↑', 'Calado 3. Mástil 4.'), piece('junco', 'Junco', '2 ≋ · 3 ↑', 'Calado 2. Mástil 3.'),
        piece('gabarra', 'Gabarra', '4 ≋ · 2 ↑', 'Calado 4. Mástil 2.')
      ],
      slots: positions('Amarre del bajo', 'Amarre bajo el puente', 'Amarre de la dársena'),
      hint: 'Empieza por el agua menos profunda. Luego mira qué mástil cabe bajo el puente.',
      feedback: 'Un casco tocaría fondo o su mástil rozaría el puente. Revisa las dos medidas.',
      success: 'Los tres cascos quedan a flote cuando entra la niebla.'
    },
    {
      id: 'calcos', title: 'La isla bajo el papel', kind: 'select', mechanic: 'Superponer calcos',
      photo: '/prueba-lamina.webp', description: 'Recupera la silueta de una isla juntando dos calcos transparentes.',
      prompt: 'Elige dos calcos cuya tinta cubra las cuatro casillas del original. Ningún punto de tinta debe quedar superpuesto.',
      evidence: [
        evidence('Original perforado', 'En una cuadrícula de dos filas y tres columnas hay tinta en A1, A3, B2 y B3. Las demás casillas están limpias.'),
        evidence('Marco del calco', 'A es la fila superior y B la inferior. Las columnas van de 1 a 3 desde la izquierda. Encaja las esquinas sin girar el papel.')
      ],
      pieces: [
        piece('tiza', 'Calco de tiza', 'A3 · B1', 'Marcas en A3 y B1.'), piece('lacre', 'Calco de lacre', 'A1 · B2', 'Marcas en A1 y B2.'),
        piece('sal', 'Calco de sal', 'A1 · A3', 'Marcas en A1 y A3.'), piece('cera', 'Calco de cera', 'A3 · B3', 'Marcas en A3 y B3.'),
        piece('humo', 'Calco de humo', 'A2 · B3', 'Marcas en A2 y B3.')
      ],
      slots: positions('Primer calco', 'Segundo calco'),
      hint: 'Descarta cualquier calco que manche una casilla limpia. Busca después las hojas que aportan las dos marcas de la fila B.',
      feedback: 'Al juntar esas hojas queda una casilla sin cubrir o aparece una marca de más.',
      success: 'La silueta reaparece justo donde la carta solo mostraba agua.'
    },
    {
      id: 'mareas', title: 'La guardia sin reloj', kind: 'order', mechanic: 'Leer una secuencia de mareas',
      photo: '/mundo-20.webp', description: 'Fecha cuatro dibujos del mismo poste leyendo el agua y la cuerda de una boya.',
      prompt: 'Ordena los apuntes, desde que empieza a subir la marea hasta el regreso de la bajamar. La cuerda señala el sentido del agua.',
      evidence: [
        evidence('Diario de guardia', 'La guardia comenzó con nivel bajo y agua entrando. Terminó al recuperar el nivel bajo, esta vez con agua saliendo.'),
        evidence('Boya de la cámara', 'Con agua entrando, la cuerda apunta al muelle; con agua saliendo, al mar. En la pleamar permanece vertical.')
      ],
      pieces: [
        piece('cangrejo', 'Dibujo del cangrejo', 'II · mar', 'Nivel medio. Cuerda hacia el mar.'), piece('gaviota', 'Dibujo de la gaviota', 'I · muelle', 'Nivel bajo. Cuerda hacia el muelle.'),
        piece('soga', 'Dibujo de la soga', 'I · mar', 'Nivel bajo. Cuerda hacia el mar.'), piece('ancla', 'Dibujo del ancla', 'III · vertical', 'Nivel alto. Cuerda vertical.')
      ],
      slots: positions('Apertura de guardia', 'Segundo apunte', 'Tercer apunte', 'Cierre de guardia'),
      hint: 'Los dos dibujos de nivel bajo pertenecen a momentos distintos. Separa primero la entrada de agua de la salida.',
      feedback: 'El nivel del poste y el sentido de la corriente no encajan con ese tramo de la guardia.',
      success: 'El cuaderno vuelve a contar una guardia completa, de bajamar a bajamar.'
    }
  ]);

  const club = room(3, 25, 'La trastienda del club', '/extras-umbravia.webp',
    'En la mesa siguen las huellas de tres jugadores: coteja el fieltro con sus fichas y averigua dónde se sentó cada uno.', [
    {
      id: 'negativos', title: 'Los negativos de Niebla', kind: 'select', mechanic: 'Leer imágenes invertidas',
      photo: '/prueba-lamina.webp', description: 'Reconoce dos negativos por el emblema del club que aparece al revelarlos.',
      prompt: 'Elige los dos negativos que pertenecen al club. En el revelado de contacto se invierte el tono de cada casilla.',
      evidence: [
        evidence('Emblemas en la puerta', 'El emblema de día muestra negro, blanco, blanco. El de noche muestra blanco, negro, blanco.'),
        evidence('Cubeta de revelado', 'El negro del negativo se vuelve blanco en el papel, y el blanco se vuelve negro. El orden de las tres casillas se conserva.')
      ],
      pieces: [
        piece('perla', 'Sobre Perla', '■ □ ■', 'Negro, blanco, negro.'), piece('niebla', 'Sobre Niebla', '□ ■ □', 'Blanco, negro, blanco.'),
        piece('jade', 'Sobre Jade', '□ ■ ■', 'Blanco, negro, negro.'), piece('onice', 'Sobre Ónice', '■ ■ □', 'Negro, negro, blanco.'),
        piece('nacar', 'Sobre Nácar', '■ □ □', 'Negro, blanco, blanco.')
      ],
      slots: positions('Primer negativo', 'Segundo negativo'),
      hint: 'Reconstruye el negativo de cada emblema casilla a casilla. El marco nunca se voltea.',
      feedback: 'Al revelar uno de esos sobres no aparece ninguno de los dos emblemas de la puerta.',
      success: 'Los dos escudos del club aparecen en el papel fotográfico.'
    },
    {
      id: 'bobina', title: 'El corte del proyeccionista', kind: 'order', mechanic: 'Montar una película',
      photo: '/c87-caja-bobina.webp', description: 'Empalma cuatro planos de una mesa sin que desaparezcan objetos entre cortes.',
      prompt: 'Monta la toma continua desde la mesa vacía hasta que se apaga la lámpara. El último fotograma de cada trozo debe coincidir con el primero del siguiente.',
      evidence: [evidence('Nota de montaje', 'No hay saltos de cámara ni retrocesos. Las marcas indican qué se ve al empezar y al terminar cada trozo.')],
      pieces: [
        piece('humo', 'Trozo Humo', 'llave → vaso', 'Empieza con la llave sola. Acaba con la llave y un vaso.'),
        piece('tela', 'Trozo Tela', 'sombrero → negro', 'Empieza con llave, vaso y sombrero. Acaba a oscuras.'),
        piece('hilo', 'Trozo Hilo', 'vacío → llave', 'Empieza con la mesa vacía. Acaba con una llave sola.'),
        piece('polvo', 'Trozo Polvo', 'vaso → sombrero', 'Empieza con llave y vaso. Acaba con llave, vaso y sombrero.')
      ],
      slots: positions('Entrada', 'Segundo trozo', 'Tercer trozo', 'Salida'),
      hint: 'Busca el plano en el que aparece un solo objeto por primera vez. Sigue el objeto que se añade en cada corte.',
      feedback: 'En uno de los empalmes cambia la mesa de golpe. Compara ambos extremos del corte.',
      success: 'En la pantalla, la mesa se llena sin un solo salto de imagen.'
    },
    {
      id: 'focos', title: 'La luz de la última función', kind: 'align', mechanic: 'Orientar focos',
      photo: '/instrumento-luz.webp', description: 'Ilumina tres mesas de ensayo siguiendo las marcas que dejó la tramoyista.',
      prompt: 'Orienta las tres lámparas desde su marca hasta el objeto indicado. Cada haz viaja en línea recta.',
      evidence: [
        evidence('Plano del salón', 'Fila norte: biombo, atril, telón. Fila central: piano, alfombra, silla. Fila sur: baúl, mesa, puerta. En cada fila, los objetos están de oeste a este.'),
        evidence('Hoja de ensayo', 'El foco Alto debe iluminar el atril; el Rojo, la puerta; el Bajo, el piano.')
      ],
      pieces: [
        piece('alto', 'Foco Alto', '□ · atril', 'Está sobre la alfombra, en la casilla central.'),
        piece('rojo', 'Foco Rojo', '□ · puerta', 'Está sobre el baúl, en la esquina suroeste.'),
        piece('bajo', 'Foco Bajo', '□ · piano', 'Está sobre la silla, en el extremo este de la fila central.')
      ],
      slots: [slot('alto','Foco Alto'),slot('rojo','Foco Rojo'),slot('bajo','Foco Bajo')],
      hint: 'Localiza primero la fila de cada foco. Si el objeto está en esa misma fila, el haz solo puede ir a este u oeste.',
      feedback: 'Uno de los haces pasa de largo. Vuelve a situar su lámpara en el plano antes de girarla.',
      success: 'El atril, la puerta y el piano quedan iluminados para la función.'
    },
    {
      id: 'guardarropa', title: 'El guardarropa de medianoche', kind: 'place', mechanic: 'Reconstruir tres resguardos',
      photo: '/prueba-registro.webp', description: 'Devuelve tres etiquetas desprendidas a las prendas que constan en el resguardo.',
      prompt: 'Coloca una etiqueta en cada prenda combinando las perforaciones del papel y la huella que dejó el cierre.',
      evidence: [
        evidence('Talón del guardarropa', 'La gabardina dejó dos agujeros de alfiler. El chal dejó uno. El sombrero dejó dos.'),
        evidence('Papel secante', 'La gabardina y el chal se cerraron con lacre en forma de luna. El sello del sombrero era cuadrado.')
      ],
      pieces: [
        piece('plata', 'Etiqueta Plata', '•• □', 'Dos perforaciones. Sello cuadrado.'), piece('ambar', 'Etiqueta Ámbar', '• ☾', 'Una perforación. Sello de luna.'),
        piece('cobre', 'Etiqueta Cobre', '• □', 'Una perforación. Sello cuadrado.'), piece('hueso', 'Etiqueta Hueso', '•• ☾', 'Dos perforaciones. Sello de luna.')
      ],
      slots: positions('Gabardina', 'Chal', 'Sombrero'),
      hint: 'Los dos agujeros no bastan para distinguir el sombrero de la gabardina. Mira el contorno del lacre.',
      feedback: 'Una de las etiquetas coincide en la perforación o en el sello, pero no en los dos.',
      success: 'Las tres prendas recuperan su resguardo; la etiqueta sobrante vuelve al cajón.'
    },
    {
      id: 'domino', title: 'La mano de dominó', kind: 'order', mechanic: 'Encadenar fichas',
      photo: '/mesa-13.jpg', description: 'Recompón la fila de dominós que el conserje fijó a la mesa con cera.',
      prompt: 'Llena el carril de izquierda a derecha. Las mitades que se tocan deben tener los mismos puntos.',
      evidence: [
        evidence('Carril de cera', 'El tope izquierdo lleva un punto. El tope derecho lleva cinco.'),
        evidence('Muesca bajo cada ficha', 'Las fichas solo entran en la orientación indicada. El primer número de cada ficha queda a la izquierda.')
      ],
      pieces: [
        piece('ebano', 'Ébano', '3 | 2', 'Tres puntos a la izquierda; dos a la derecha.'), piece('lino', 'Lino', '4 | 5', 'Cuatro puntos a la izquierda; cinco a la derecha.'),
        piece('coral', 'Coral', '1 | 3', 'Un punto a la izquierda; tres a la derecha.'), piece('olmo', 'Olmo', '2 | 4', 'Dos puntos a la izquierda; cuatro a la derecha.')
      ],
      slots: positions('Junto al tope de un punto', 'Segunda ficha', 'Tercera ficha', 'Junto al tope de cinco'),
      hint: 'El tope actúa como media ficha. Sigue la cadena desde su único punto.',
      feedback: 'Hay dos mitades enfrentadas con distinto número de puntos.',
      success: 'La fila queda trabada entre los dos topes de cera.'
    },
    {
      id: 'tercera-silla', title: 'El silencio de la tercera silla', kind: 'place', mechanic: 'Cruzar rastros de una partida',
      photo: '/extras-umbravia.webp', description: 'Reconstruye los tres puestos de una mesa por los rastros de sus fichas.',
      prompt: 'Devuelve una ficha a cada asiento. Confronta los rastros del fieltro con las marcas que dejó el bolsillo de cada jugador.',
      evidence: [
        evidence('Fieltro levantado', 'En la ventana se ve un contorno circular. La silla de la puerta conserva un contorno triangular. En la esquina hay otro círculo.'),
        evidence('Tres pañuelos', 'El jugador de la ventana guardó la ficha con una muesca. El de la puerta tenía dos. El de la esquina tenía tantas como el de la puerta.')
      ],
      pieces: [
        piece('hueso', 'Ficha de hueso', '○ ··', 'Circular, dos muescas.'), piece('zinc', 'Ficha de zinc', '△ ·', 'Triangular, una muesca.'),
        piece('miel', 'Ficha de miel', '○ ·', 'Circular, una muesca.'), piece('azul', 'Ficha azul', '△ ··', 'Triangular, dos muescas.'),
        piece('lata', 'Ficha de lata', '□ ··', 'Cuadrada, dos muescas.')
      ],
      slots: positions('Silla de la ventana', 'Silla de la puerta', 'Silla de la esquina'),
      hint: 'Las dos sillas con marca circular pertenecían a jugadores distintos. Sus pañuelos distinguen una ficha de la otra.',
      feedback: 'El borde o las muescas de una ficha no encajan con los rastros de su silla.',
      success: 'Cada huella encuentra su ficha y los tres puestos vuelven a distinguirse.'
    }
  ]);

  const workshop = room(4, 37, 'El taller del escarabajo', '/extras-necropolis.webp',
    'Encaja las tablillas de una barca votiva hasta reunir las dos mitades de su disco solar.', [
    {
      id: 'improntas', title: 'El sello de las dos orillas', kind: 'select', mechanic: 'Cotejar improntas',
      photo: '/mundo-44.webp', description: 'Reconoce las dos matrices de una barca por la huella que dejan en la arcilla.',
      prompt: 'Escoge los dos sellos que produjeron las improntas del muelle. Al estampar, los motivos aparecen en orden inverso.',
      evidence: [
        evidence('Tablilla de salida', 'De izquierda a derecha se ven una flor, un disco y dos ondas.'),
        evidence('Tablilla de vuelta', 'De izquierda a derecha se ven un disco, dos ondas y una flor. Cada flor, disco o par de ondas cuenta como un solo motivo.')
      ],
      pieces: [
        piece('loto', 'Matriz de loto', '≋ ● ✿', 'Dos ondas, disco, flor.'), piece('limo', 'Matriz de limo', '● ✿ ≋', 'Disco, flor, dos ondas.'),
        piece('junco', 'Matriz de junco', '✿ ● ≋', 'Flor, disco, dos ondas.'), piece('nilo', 'Matriz del Nilo', '✿ ≋ ●', 'Flor, dos ondas, disco.'),
        piece('cal', 'Matriz de cal', '≋ ✿ ●', 'Dos ondas, flor, disco.')
      ],
      slots: positions('Primera matriz', 'Segunda matriz'),
      hint: 'Empieza por el último motivo de cada tablilla. En la matriz ocupa el primer lugar.',
      feedback: 'Al invertir esas matrices queda al menos un motivo fuera de sitio.',
      success: 'Las improntas vuelven a identificar la salida y la vuelta de la barca.'
    },
    {
      id: 'vasijas', title: 'Los bordes del alfarero', kind: 'place', mechanic: 'Ajustar fragmentos de cerámica',
      photo: '/mundo-43.webp', description: 'Empareja tres cuellos de barro con los bordes arrancados que aún conservan su dibujo.',
      prompt: 'Coloca un borde en cada vasija. El fragmento debe abrazar su cuello y prolongar las bandas de pintura.',
      evidence: [
        evidence('Plantillas del torno', 'El cuello de la garza mide cuatro dedos; el del pez, seis; el del junco, cuatro.'),
        evidence('Pintura al pie de la grieta', 'En la garza llegan dos bandas; en el pez también dos. En el junco llega una sola.')
      ],
      pieces: [
        piece('rojo', 'Borde rojo', '6 · ║', 'Ancho de seis dedos, dos bandas.'), piece('arena', 'Borde de arena', '4 · │', 'Cuatro dedos, una banda.'),
        piece('ocre', 'Borde ocre', '6 · │', 'Seis dedos, una banda.'), piece('sal', 'Borde de sal', '4 · ║', 'Cuatro dedos, dos bandas.')
      ],
      slots: positions('Vasija de la garza', 'Vasija del pez', 'Vasija del junco'),
      hint: 'El diámetro distingue al pez. Las bandas separan las dos vasijas con un cuello de cuatro dedos.',
      feedback: 'En una unión se interrumpe la pintura o el borde tiene otra anchura.',
      success: 'Las bandas se cierran sin saltos en las tres vasijas del taller.'
    },
    {
      id: 'sombras', title: 'Los brazos del sol', kind: 'align', mechanic: 'Orientar lámparas por sus sombras',
      photo: '/instrumento-luz.webp', description: 'Reproduce tres sombras del relieve colocando cada lámpara en su punto cardinal.',
      prompt: 'Gira cada brazo hasta situar la lámpara en el lado correcto del relieve. Haz aparecer las sombras de la copia en cera.',
      evidence: [
        evidence('Marca de referencia', 'El borde de arriba es el norte y el de la derecha, el este. La lámpara siempre proyecta la sombra al lado opuesto.'),
        evidence('Molde de cera', 'La sombra del ibis llega al borde inferior; la del ojo, al derecho; la del remo, al superior.')
      ],
      pieces: [
        piece('ibis', 'Brazo del ibis', '▾', 'En la copia, su sombra apunta hacia abajo.'), piece('ojo', 'Brazo del ojo', '▸', 'En la copia, su sombra apunta a la derecha.'),
        piece('remo', 'Brazo del remo', '▴', 'En la copia, su sombra apunta hacia arriba.')
      ],
      slots: [slot('ibis','Lámpara del ibis'),slot('ojo','Lámpara del ojo'),slot('remo','Lámpara del remo')],
      hint: 'Estás moviendo la fuente de luz. Si la sombra llega al este, la luz debe llegar desde el otro lado.',
      feedback: 'Una sombra cae hacia el borde equivocado. Comprueba desde qué lado la iluminas.',
      success: 'Las tres sombras encajan en las hendiduras de la copia.'
    },
    {
      id: 'balanza', title: 'La pesada del escarabajo', kind: 'place', mechanic: 'Equilibrar tres balanzas',
      photo: '/mundo-18.webp', description: 'Identifica tres contrapesos por la inclinación del fiel en dos pesadas antiguas.',
      prompt: 'Devuelve una pesa a cada soporte del taller. El escriba dibujó dos pesadas cuando las tres piedras aún estaban en su sitio.',
      evidence: [
        evidence('Primera pesada', 'La pesa de la pluma y la del disco, juntas en el plato izquierdo, equilibraron la del escarabajo, sola en el derecho.'),
        evidence('Segunda pesada', 'Se retiró el escarabajo. Con la pluma a la izquierda y el disco a la derecha, descendió el platillo de la pluma. Cada punto grabado representa una unidad de masa.')
      ],
      pieces: [
        piece('jaspe', 'Pesa de jaspe', '••', 'Masa de dos cuentas.'), piece('yeso', 'Pesa de yeso', '••••', 'Masa de cuatro cuentas.'),
        piece('jade', 'Pesa de jade', '•••••', 'Masa de cinco cuentas.'), piece('pizarra', 'Pesa de pizarra', '•••', 'Masa de tres cuentas.')
      ],
      slots: positions('Soporte de la pluma', 'Soporte del escarabajo', 'Soporte del disco'),
      hint: 'Busca dos piedras diferentes cuya masa conjunta coincida con una tercera. El platillo que bajó te dice cuál de las dos era la pluma.',
      feedback: 'Esas piedras no reproducen ambas pesadas. Comprueba tanto el empate como el lado que descendió.',
      success: 'Las piedras vuelven a reproducir las dos pesadas del escriba.'
    },
    {
      id: 'lino', title: 'El nudo que quedó fuera', kind: 'order', mechanic: 'Deshacer un envoltorio',
      photo: '/mundo-40.webp', description: 'Desmonta las cuatro capas de un paquete de lino sin romper los hilos que las sujetan.',
      prompt: 'Retira las capas desde fuera hasta el amuleto. Los apuntes del aprendiz describen en qué orden se colocaron.',
      evidence: [
        evidence('Apunte del aprendiz', 'La gasa tocaba directamente el amuleto. A la cinta la anudé sobre la estera. Un cordón por fuera mantenía cerrado el conjunto.'),
        evidence('Manchas de resina', 'La estera conserva la trama de la gasa en su cara interna. El cordón dejó una marca en la cinta.')
      ],
      pieces: [
        piece('gasa', 'Gasa fina', '⋮', 'Trama blanda con la huella del amuleto.'), piece('cordon', 'Cordón', '∞', 'Dos cabos unidos por un nudo exterior.'),
        piece('estera', 'Estera', '▦', 'Su cara interna tiene trazas de gasa.'), piece('cinta', 'Cinta plana', '═', 'Conserva una pequeña marca del cordón.')
      ],
      slots: positions('Primero en salir', 'Segunda capa', 'Tercera capa', 'Última, junto al amuleto'),
      hint: 'Las notas explican cómo se envolvió el paquete. Tus manos hacen el recorrido inverso.',
      feedback: 'Una de esas capas aún está sujeta por otra. Comprueba qué material dejó su marca por fuera.',
      success: 'El paquete queda abierto y sus cuatro capas se podrán volver a montar.'
    },
    {
      id: 'barca', title: 'La barca del disco partido', kind: 'place', mechanic: 'Ensamblar una maqueta',
      photo: '/mundo-46.webp', description: 'Monta una barca votiva para devolver al disco solar las dos mitades de su reflejo.',
      prompt: 'Encaja las cuatro tablillas de proa a popa. Solo forman la barca si se cierran los pasadores y coinciden las dos mitades del disco.',
      evidence: [
        evidence('Bastidor del astillero', 'La proa es puntiaguda en el extremo izquierdo; la popa termina recta a la derecha. Une círculo con círculo y triángulo con triángulo.'),
        evidence('Banda de oro', 'Los dos bordes centrales llevan medio disco. Al tocarlos deben dibujar un sol completo. Cada tablilla tiene la cara pintada hacia arriba.')
      ],
      pieces: [
        piece('cobre', 'Tablilla de cobre', '◑ → △', 'Izquierda: medio disco derecho. Derecha: triángulo.'),
        piece('nacar', 'Tablilla de nácar', '○ → △', 'Izquierda: círculo sin oro. Derecha: triángulo sin oro.'),
        piece('cedro', 'Tablilla de cedro', '◁ → ○', 'Izquierda: punta de proa. Derecha: círculo.'),
        piece('ebano', 'Tablilla de ébano', '△ → ▏', 'Izquierda: triángulo. Derecha: extremo recto de popa.'),
        piece('loto', 'Tablilla de loto', '○ → ◐', 'Izquierda: círculo. Derecha: medio disco izquierdo.')
      ],
      slots: positions('Proa', 'Centro, lado de proa', 'Centro, lado de popa', 'Popa'),
      hint: 'Sitúa antes los dos extremos del casco. Entre ellos, las piezas de oro tienen que mirar al centro.',
      feedback: 'El casco tiene un pasador abierto o el sol central ha perdido una de sus mitades.',
      success: 'La barca vuelve a sostener un disco completo, con la banda de oro de proa a popa.'
    }
  ]);

  root.SalasMundosCatalogo = Object.freeze({2: chartroom, 3: club, 4: workshop});
})(window);
