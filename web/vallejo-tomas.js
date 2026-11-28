(function (root) {
  'use strict';

  root.VallejoTomas = {
    id: 'tomas',
    title: 'Tomás Ferrer',
    readings: {
      '01_diario_marta.png': {lines:['Diario de sueño. Marta Ibáñez Roca.',
        '8 nov. Primera noche. No he dormido. Vallejo dice que escriba lo que cuente cada noche, hasta lo más tonto. Dice que las letras también cuentan: la A es la uno, la B la dos… Así me entretengo.',
        '9 nov. Me desperté a las 03:07. Otra vez la puerta. Conté 5 peldaños antes de llegar.',
        '10 nov. 03:07. Hoy el pasillo era más largo. Conté 12 baldosas negras.',
        '12 nov. Segunda sesión. Vallejo habló del espejo de la Sala 7. No me gustó. 03:07 otra vez, y la habitación 105 helada.',
        '14 nov. Conté 12 pasos desde la puerta hasta la cama. En la cama no había nadie, pero estaba caliente.',
        '15 nov. Tomás dice que oye golpes en la pared de mi lado. Yo no he golpeado nada.',
        '17 nov. Solo hay 1 puerta. Siempre fue 1. Cuento y cuento, y siempre es la misma.',
        '19 nov. No he escrito nada hoy. No he dormido.']},
      '02_grabacion_sesion1.wav': {knocks:[[1,4],[4,5],[1,5],[4,2],[3,2],[1,5]]},
      '03_armario_medicacion.png': {lines:['Armario de medicación. Cinco estantes de arriba abajo. En cada estante hay cinco casilleros numerados de izquierda a derecha.',
        'Estante 1: A, B, C, D, E.','Estante 2: F, G, H, I/J, K.','Estante 3: L, M, N, O, P.','Estante 4: Q, R, S, T, U.','Estante 5: V, W, X, Y, Z.']},
      '04_hoja_suelta.png': {lines:['La frase de la cabecera aparece en escritura especular. De arriba abajo se alternan la palabra PUERTA, una palabra invertida, CAMA, dos palabras invertidas, PASILLO y tres palabras invertidas. El botón Espejo cambia la orientación de la hoja.'],
        tool:'vp-mirrored',adjusted:['Al reflejar la hoja, la cabecera se lee así: «Lo que importa es lo que queda en el centro de cada cosa que veo en el espejo».',
          'Orden de las nueve líneas en el espejo: palabra invertida, BANDEJA, palabra invertida, HIELO, MANOS, palabra invertida, LATIR, TURNO, LLORA.']}
    },
    documents: [
      {file: '00_email_tomas.html', label: 'Correo de apertura', type: 'email'},
      {file: '01_diario_marta.png', label: 'Diario de sueño de Marta', type: 'image'},
      {file: '02_grabacion_sesion1.wav', label: 'Grabación de la primera sesión de terapia', type: 'audio'},
      {file: '03_armario_medicacion.png', label: 'Armario de medicación', type: 'image'},
      {file: '04_hoja_suelta.png', label: 'Hoja suelta de autor desconocido', type: 'image'},
      {file: '05_expediente_tomas.html', label: 'Expediente de Tomás', type: 'gate'}
    ],
    gateSelector: '#expediente',
    doorSelector: '#puerta',
    hintWaitMinutes: 10,
    hintGroup: {'03_armario_medicacion.png': '02_grabacion_sesion1.wav'},
    hints: {
      '01_diario_marta.png': [
        'en la primera entrada, Vallejo le explica un juego con las letras.',
        'fíjate solo en lo que Marta dice haber contado.',
        'son cuatro números; cada uno es la posición de una letra en el abecedario.',
        '5 es la E y 1 es la A. Falta convertir los dos 12.'
      ],
      '02_grabacion_sesion1.wav': [
        'no hay voces, pero los golpes siguen un patrón.',
        'cuenta los golpes de cada grupo; las pausas cortas separan grupos y las largas, letras.',
        'cada letra son dos números: estante y casillero del armario.',
        'el primer par es 1-4 (estante 1, casillero 4): la letra D. Resuelve los otros cinco pares.'
      ],
      '04_hoja_suelta.png': [
        'parte de la hoja está escrita al revés a propósito.',
        'mira la hoja en un espejo y lee primero la nota de arriba.',
        'solo cuentan las palabras que se leen en el espejo y, de cada una, la letra del centro.',
        'las seis palabras del espejo, de arriba abajo, dan sus letras centrales en orden. La primera es BANDEJA → D.'
      ]
    }
  };
})(window);
