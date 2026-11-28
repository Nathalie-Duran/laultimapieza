(function (root) {
  'use strict';

  // Session one is La llegada. Marta is the patient whose dossier it opens.
  const plan = '02_plano_pabellon.png';
  const rounds = '03_registro_rondas.png';
  const letter = '04_carta_vallejo.png';
  const table = '05_tabla_vigenere.png';

  root.VallejoMarta = {
    id: 'marta',
    title: 'La llegada',
    dossierLabel: 'Expediente 0147 · Marta Ibáñez',
    readings: {
      '01_ficha_admision.png': {
        lines:['Clínica Vallejo. Ficha de admisión 0147. Ibáñez Roca, Marta. 29 años. Traductora. Soltera.',
          'Motivo de ingreso: insomnio crónico. Sueños recurrentes con una puerta. La paciente refiere ver «algo» detrás de la puerta cuando cierra los ojos.',
          'Médico responsable: Dr. E. Vallejo. La fecha de ingreso está bajo una franja muy oscura. Sello de archivado: 14/03/1990.'],
        tool:'vp-bright', adjusted:['Con más luz se lee la inscripción bajo la franja: 07/11/1986.']
      },
      '02_plano_pabellon.png': {lines:['Clínica Vallejo. Pabellón de pacientes de una sola planta. El norte queda arriba. Un pasillo horizontal conecta la entrada, a la izquierda, con la escalera, a la derecha.',
        'Desde la entrada hacia la escalera, las tres habitaciones al norte son 101, 102 y 103. En el mismo sentido, al sur están 104, 105 y 106. Las puertas de cada fila quedan justo enfrente de las de la otra fila.']},
      '03_registro_rondas.png': {lines:['Registro de rondas nocturnas. Celador S. Ortiz.',
        '00:10. Irene deja el piano y la acompaño a su cuarto: el primero junto a la entrada, en la fila norte.',
        '00:40. La luz de Elena sigue encendida. Se ve desde la escalera: es la última puerta de la fila norte.',
        '01:15. Rosa me pide que no cierre su puerta. Dice que Irene la oye respirar. Está justo enfrente de la de Irene.',
        '02:00. Mateo ronca como siempre. Duerme en la última habitación de la fila sur.',
        '03:30. Marta, otra vez despierta, mirando la puerta de enfrente. Ella duerme en la fila sur; enfrente tiene a Tomás.']},
      '04_carta_vallejo.png': {lines:['Dr. Elías Vallejo. Clínica Vallejo. Despacho.',
        'Sé que quien lea esto ya habrá pasado por mi clínica, aunque no lo recuerde.',
        'Olvidar no es perder: es guardar algo en una habitación sin luz. Yo solo giré la llave.',
        'Mis pacientes me llaman monstruo. No recuerdan que vinieron a suplicarme que lo hiciera.',
        'Busca el expediente de Marta. Ella dormía menos que nadie y vio más de lo que debía.',
        'Recuerda que cada puerta de esta casa pide tres cosas: dónde, qué y cuándo.',
        'Antes de abrirla, piensa si de verdad quieres recordar.',
        'Firma: E. V. Posdata: «Lo que guarda la puerta, para quien sepa leer en la sombra». Debajo, seis letras: W G B F A O.']},
      '05_tabla_vigenere.png': {lines:['Tabla de Vigenère. Busca la letra de la clave en la primera columna. En esa fila localiza la letra cifrada. La cabecera de su columna da la letra original. El alfabeto de la tabla tiene 26 letras, de A a Z.'],alphabet:true}
    },
    hintWaitMinutes: 10,
    hintLevels: ['Orientación', 'Dirección', 'Método', 'Casi solución'],
    // A puzzle has a single hint ladder, including when it uses two documents.
    hintAliases: { [rounds]: plan, [table]: letter },
    hints: {
      // The source image cuts off the first admission-card hint. No complete hint survives there.
      [plan]: [
        'en el plano, las dos filas de habitaciones se miran de frente.',
        'empieza por las entradas del registro que dan una posición exacta (Irene, Elena, Mateo).',
        'con Irene colocada, Rosa queda fijada por estar enfrente de ella.',
        'solo quedan libres dos habitaciones, una en cada fila y una frente a la otra. Tomás está en la fila norte; Marta, enfrente de él.'
      ],
      [letter]: [
        'la carta esconde algo en su forma, no solo en lo que dice.',
        'mira cómo empieza cada párrafo.',
        'la palabra que aparece no es la respuesta, es una llave. Y al final hay un grupo de letras sin sentido que pide esa llave.',
        'descifra WGBFAO con un Vigenère usando SOMBRA como clave, restando letra a letra (se muestra la tabla Vigenère de 26 letras).'
      ]
    }
  };
})(window);
