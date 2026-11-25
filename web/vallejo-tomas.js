(function (root) {
  'use strict';

  root.VallejoTomas = {
    id: 'tomas',
    title: 'Tomás Ferrer',
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
