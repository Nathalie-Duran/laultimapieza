(() => {
  'use strict';

  // Los títulos identifican los mismos retos que se abren en la partida.
  const retos = [
    ['La sala de juegos de Ada', 'Elige uno de los seis minijuegos de la mansión. Descifra sellos, recompón una carta o repara el reloj.'],
    ['El turno del conserje', 'Lee las peticiones de cinco huéspedes y asígnales una habitación para pasar la noche.'],
    ['Un paseo de nueve recuerdos', 'Encadena nueve tarjetas de recuerdos para trazar un paseo desde la lluvia hasta el amanecer.'],
    ['La mesa de mezclas', 'Ajusta tres canales de percusión para que las dos sintonías de la emisora vuelvan a sonar a tiempo.'],
    ['La pasarela de la marea', 'Decide quién lleva el único farol para que cuatro viajeros crucen la pasarela antes de que llegue el ferry.'],
    ['Tres vitrinas, diez fichas', 'Reparte tus diez fichas en la puja para conseguir una pieza para cada vitrina.'],
    ['El paseo de las seis placas', 'Empareja los paisajes que aparecen en los extremos de seis fotografías y reconstruye el paseo.'],
    ['Los canales del vivero', 'Gira los tramos de acequia para que el agua llegue a todos los bancales.'],
    ['El plano giratorio', 'Gira las nueve estancias de una maqueta hasta abrir un camino por el taller y la galería.'],
    ['El brindis imposible', 'Cambia de sitio a seis invitados hasta que se cumplan sus cuatro acuerdos para el brindis.'],
    ['El duelo de los faroles', 'Desafía al farolero en dos rondas. Elige de qué fila quitar fichas para llevarte la última.'],
    ['Turno de las dos tintas', 'Organiza cinco encargos y cambia la tinta de la prensa para que la valija llegue al tranvía.'],
    ['La regata de las botellas', 'Sigue cuatro botellas por dos canales y reconstruye el orden de llegada de la regata.'],
    ['La rueda de las constelaciones', 'Sigue los giros de una rueda de ocho marcas para descubrir dónde acaba el puntero.'],
    ['El correo de las abejas de madera', 'Sigue a las abejas de flor en flor y descubre cuál llega a su destino con la bolsa vacía.'],
    ['El billete de los cuatro colores', 'Sigue los giros del billete del revisor para averiguar qué color termina en la esquina marcada.'],
    ['Las siluetas del aprendiz', 'Combina dos recortes que cubran toda la ventana sin dejar huecos ni solaparse.'],
    ['Monedas de feria', 'Calcula el valor de las fichas con forma de animal y escoge la bolsa con el importe exacto.'],
    ['El carillón de sobremesa', 'Superpón las tiras perforadas y averigua en qué pulsos sonará el carillón.'],
    ['Las lunas giratorias', 'Compara el ritmo de dos discos y predice cuándo volverán sus lunas a la posición de partida.'],
    ['El mosaico de habas', 'Examina el dibujo de habas claras y oscuras para elegir la pieza que falta en el mosaico.'],
    ['Círculos de trueque', 'Traza una ruta entre tres puestos para terminar el trueque con el mismo sello con el que empezaste.'],
    ['El compás del apuntador', 'Compara el compás de tres relojes de papel para encontrar el pulso en el que solo coinciden dos.'],
    ['Las losetas del patio', 'Encadena cuatro losetas uniendo sus símbolos hasta completar el recorrido del pasador.'],
    ['El cajón de los marcos', 'Compara las dos referencias de una placa con las guías de la cajonera para encontrar su cajón.'],
    ['El cilindro del organillero', 'Compara el patrón de la melodía con los cilindros para reconocer el de la función infantil.'],
    ['Aforo en penumbra', 'Revisa la numeración de las filas para devolver un billete duplicado a su asiento.'],
    ['Un sello de más', 'Cruza las pesas de la balanza con un recibo para localizar el casillero del franqueo.'],
    ['El tendedero de los nudos', 'Sigue las tres hileras de cuerda para encontrar el tirador cuyo nudo aguantará.'],
    ['El disco de sintonía', 'Sigue las muescas del selector y averigua en qué número se detiene la aguja de la radio.'],
    ['Los cajones de nogal', 'Compara la tablilla con las guías de nogal y encuentra dónde encaja sin darle la vuelta.'],
    ['El equipaje al peso', 'Elige dos piezas de equipaje que equilibren la pesa de referencia.'],
    ['El turno de los cristales', 'Sigue los cambios de orientación del reflejo para identificar el panel que revela la llave.'],
    ['Las pesas de vísperas', 'Compara las marcas del brazo del balancín y elige la pesa que lo deja en equilibrio.'],
    ['La rueda del aguador', 'Compara tres alturas y alinea la ranura de la rueda entre el agua y la tabla.'],
    ['El archivador del último turno', 'Lee el índice giratorio de fuera hacia dentro para identificar la llave guardada en el centro.'],
    ['Pasajeros de barro', 'Distribuye tres figuras a ambos lados del mástil hasta equilibrar la barca de juguete.'],
    ['La balda que escucha', 'Reconstruye con tres cuencos las cuatro notas de la melodía que abre la balda.'],
    ['El juego de la banda tejida', 'Ordena las tres tiras translúcidas para que se vean los signos del tejido.'],
    ['La telaraña del telar', 'Elige en qué orden pasan los peines del telar para invertir la posición de los hilos.'],
    ['La sombra del chacal de barro', 'Combina dos placas que cubran solo las ventanillas que señala la guardiana.'],
    ['Cuatro peces y una luna', 'Ordena los peces de cerámica uniendo las marcas de las colas y las cabezas.'],
    ['La balanza del boticario', 'Escoge dos pesas distintas para equilibrar la vasija del boticario.'],
    ['El juego de sellos ciegos', 'Lee las condiciones de tres sellos y ordénalos para abrir el acceso auxiliar.'],
    ['El tambor de las tablillas', 'Compara dos registros del compás y separa los golpes del tambor de la señal de la otra intérprete.'],
    ['El estante de los timones', 'Compara tres vistas del estante para localizar el cajón donde los carpinteros guardan la llave.'],
    ['La procesión de sombras', 'Compara la procesión desde dos nichos y reconoce qué silueta se distingue en ambos.'],
    ['El guardián de los turnos', 'Sigue los tres movimientos de la hilera y descubre qué ficha llega hasta la llave.']
  ];

  function photoFor(id) {
    if (id === 1) return '/sala-de-ada.webp';
    if (id <= 12) return '/valdemar-art-' + String(id).padStart(2, '0') + '.webp';
    return '/mundo-' + id + '.webp';
  }

  const fichas = retos.map(([title, action], index) => {
    const id = index + 1;
    const ordinaryPrize = index % 12 < 8 ? 1 : 2;
    const prize = id === 1 ? 8 : ordinaryPrize;
    return Object.freeze({title, action, photo: photoFor(id), prize});
  });

  function ficha(id) {
    if (typeof id === 'string' && /^\d+$/.test(id)) id = Number(id);
    return Number.isInteger(id) ? fichas[id - 1] || null : null;
  }

  const boards = ['mapa','expedicion','umbravia','necropolis'];
  function enlace(id, disponible = false) {
    if (!ficha(id)) return null;
    const number = Number(id);
    if (number === 1) return {href:'/#desafios?seccion=sala', label:'Sala de juegos de Ada'};
    if (disponible) {
      const player = number <= 12 ? 'valdemar-jugar' : 'mundos-jugar';
      return {href:'/#' + player + '?id=' + number + '&seccion=reto', label:'Jugar el reto'};
    }
    const board = boards[Math.floor((number - 1) / 12)];
    return {href:'/#desafios?mundo=' + board + '&reto=' + number, label:'Ver el reto'};
  }

  function escapeHtml(text) {
    const replacements = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
    return text.replace(/[&<>"']/g, char => replacements[char]);
  }

  function acceso(id, disponible = false) {
    const link = enlace(id, disponible);
    if (!link) return '';
    const label = Number(id) === 1 ? 'Ver la sala' : link.label;
    return '<a class="extra-ficha-link" href="' + escapeHtml(link.href) + '"><small>Reto extra</small><strong>' +
      escapeHtml(ficha(id).title) + '</strong><span>' + label + '</span></a>';
  }

  window.RetosTemporada = Object.freeze({ficha, enlace, acceso});
})();
