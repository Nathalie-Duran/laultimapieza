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
    doorSelector: '#puerta'
  };
})(window);
