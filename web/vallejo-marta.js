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
