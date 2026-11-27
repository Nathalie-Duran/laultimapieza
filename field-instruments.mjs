const cases = new Map([
  [1, {
    answer: '0734',
    instrument: {
      kind: 'lock', title: 'La consigna de los dos relojes',
      brief: 'En La estación queda un armario de tránsito con cuatro ruedas. La etiqueta pide las dos cifras de una consigna de 1996 y, a continuación, las dos de otra de 2026.',
      note: 'El relevo de las siete usó la última salida anterior a las 19:00 en 1996 y la primera llegada posterior a las 19:00 en 2026. Conserva los ceros iniciales.',
      tables: [
        {caption:'Libro de salidas · 1996', rows:[['18:42','16'],['18:54','07'],['19:04','22']]},
        {caption:'Libro de llegadas · 2026', rows:[['18:56','21'],['19:12','34'],['19:27','58']]}
      ]
    }
  }],
  [13, {
    answer: '010',
    instrument: {
      kind: 'circuit', title: 'El cuadro de señales de Nácar',
      brief: 'En el Embarcadero de Nácar, la barquera dejó la maqueta de tres selectores en reposo. Reconstruye el aviso que permitió identificar el canal aquella noche.',
      note: 'El libro del relevo dice «Faro encendido, boya encendida, grúa apagada». La placa indica que el faro responde a exactamente uno de los selectores A y B. La boya responde a B cuando C está apagado. La grúa responde a A o a C.',
      switches:['A · Espigón', 'B · Calado', 'C · Almacén']
    }
  }],
  [25, {
    answer:'ARO',
    instrument: {
      kind:'lamp', title:'Las marcas del marco',
      brief:'En la Pensión del Espejo, el reflejo oculta parte de un mensaje. Orienta la linterna y recorre el marco sin desmontarlo.',
      note:'La patrona escribió «La pintura es reciente. Busca las letras talladas y léelas desde la que tiene menos muescas hasta la que tiene más».',
      zones:[
        {label:'Esquina superior izquierda', direct:'Una P de pintura azul.', raking:'Dos muescas profundas y una R tallada.'},
        {label:'Travesaño superior', direct:'Un 6 sobre esmalte blanco.', raking:'Una grieta recta sin letras.'},
        {label:'Lateral derecho', direct:'Una E pintada a pincel.', raking:'Tres muescas con la misma pátina y una O tallada.'},
        {label:'Travesaño inferior', direct:'Un sello ovalado de barniz.', raking:'Una sola muesca y una A tallada bajo el barniz.'}
      ]
    }
  }],
  [37, {
    answer:'junco-luna-pez',
    instrument: {
      kind:'strata', title:'Analizador del limo',
      brief:'En el Muelle de las Dos Orillas hay cuatro láminas del mismo sondeo. Separa las señales de paso de la barca y los sellos de mantenimiento.',
      note:'El casco dejó surcos que cortan los granos de limo. Los sellos del muelle dejaron impresiones en la superficie. Anota los signos de paso del más antiguo al más reciente. Las capas inferiores son anteriores.',
      samples:[
        {label:'22 cm', detail:'Un junco. El trazo rompe los granos y queda cubierto por el siguiente aporte de limo.'},
        {label:'6 cm', detail:'Un pez. El trazo corta la capa de limo y queda bajo la última reparación.'},
        {label:'15 cm', detail:'Una luna. El surco atraviesa los granos y aparece sellado por el estrato superior.'},
        {label:'3 cm', detail:'Una rueda. El signo se imprimió sobre el limo; los granos permanecen enteros.'}
      ],
      symbols:[['luna','Luna'],['rueda','Rueda'],['pez','Pez'],['junco','Junco']]
    }
  }]
]);

export function getFieldInstrument(caseId) {
  const entry = cases.get(caseId);
  return entry ? structuredClone(entry.instrument) : null;
}

export function checkFieldInstrument(caseId, answer) {
  const entry = cases.get(caseId);
  if (!entry || typeof answer !== 'string' || answer.length > 32) return false;
  return answer.trim().toLocaleUpperCase('es') === entry.answer.toLocaleUpperCase('es');
}
