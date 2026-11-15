(function(root){
'use strict';
const voice='Soy Clara. La saca de mis cartas llevaba una cinta azul, no gris. La vi junto a las devoluciones. Buscad qué significaban esos colores en aquella oficina.';
const evidence={
 image:{title:'Los cuatro originales · mesa de lectura',kind:'letters',cards:[
 ['SOBRE A · ORIGINAL','ED 16/06/06 · TR 19/06/06','Para cuando lo recibas:','Deberme una explicación no puede ser la condición para cruzar una puerta.'],
 ['SOBRE B · ORIGINAL','ED 14/06/06 · TR 21/06/06','Para cuando lo recibas:','Sin repetir lo que fuimos, podemos compartir una tarde.'],
 ['SOBRE C · ORIGINAL','ED 18/06/06 · TR 20/06/06','Para cuando lo recibas:','Nada te obliga a retomar nuestra relación ni a responder de inmediato.'],
 ['SOBRE D · ORIGINAL','ED 12/06/06 · TR 22/06/06','Para cuando lo recibas:','Ven al taller una tarde si te apetece y si tu vida de ahora deja sitio.']
 ],task:'Hay dos fechas por sobre. Averigua cuál cuenta antes de ordenar las palabras.'},
 web:{title:'Valdemar · consulta del archivo postal',sections:[
 ['Guía de marcas de 2006',['ED: expedición desde origen. TR: tránsito entre oficinas. IN: inventario posterior. Fechas: día/mes/año. Las letras A–D se añadieron en 2026 para identificar los originales; no indican su orden.']],
 ['Una nota dentro de la carpeta',['«Para leer lo que no me atreví a escribir seguido: primero lo que envié antes; después, la primera palabra tras Para cuando lo recibas». Nota firmada por Clara en 2006.']],
 ['Plano operativo · vigente en junio de 2006',['R2 — sacas con cinta AZUL: correspondencia pendiente de reparto. D1 — cinta ROJA: devolución al remitente. E4 — cinta GRIS: material retirado, sin distribución. Los códigos identifican destinos, no personas.']],
 ['Libro de movimientos · 22/06/2006',['18:40 — Cuatro envíos para G. Vidal se agrupan en MR-17 durante la reorganización de las mesas de la oficina. Consulta presencial de la remitente: se le muestra la saca. 18:45 — MR-17 pasa por la mesa de devoluciones durante el traslado de mobiliario. 18:50 — MR-17 queda inventariada en E4 como material retirado. La columna de comprobación está vacía. La firma de recepción no se conserva. Pasar por una mesa no acredita que ese fuera el destino correcto.']],
 ['Acta de apertura · 14/11/2026',['23:10 — Apertura autorizada de MR-17, hallada esa tarde detrás del armario. Precinto 442 intacto. Cuatro sobres cerrados. La cinta exterior de tela se deshizo por humedad; su color ya no es identificable. El precinto numerado es una pieza distinta. Clara reconoce la saca en la descripción del inventario y aporta su recuerdo en una grabación actual. No existe prueba para identificar a una persona que la retuviera deliberadamente.']],
 ['Antes de que abra el museo',['Gabriel quiere recibir los originales y escuchar vuestra reconstrucción. Clara acepta que se le confirme la entrega. Ambos autorizan una sala privada o un buzón de respuesta de treinta días; ninguno promete responder ni reunirse. También aceptan explicar el fallo sin nombres ni cartas, o pedir una revisión técnica. Los originales salen del archivo en cualquiera de los cuatro cierres.']]
 ],task:'Compara el destino registrado con el que correspondía al detalle que recuerda Clara.'},
 audioTask:'Escucha qué detalle conserva Clara. No confundas el lugar donde vio la saca con su destino correcto.',
 connection:'Las cartas esconden el mensaje; el recuerdo de Clara y el plano postal permiten reconstruir el desvío.',
 voice
};
root.CartasCase={evidence,voice};
const s=root.STORIES?.find(x=>x.id==='cartas-medianoche');if(!s)return;
s.revision='cartas-2';s.subtitle='Cuatro cartas. Veinte años de silencio.';
s.description='La víspera de abrir como museo, una oficina postal devuelve cuatro cartas que nunca llegaron. Un mensaje escondido, un recuerdo de Clara y una ruta de reparto que no encaja. Reconstruid el desvío y decidid cómo termina esta noche.';
s.duration='20–30 min · estimación de lectura y juego';s.illustration='/cartas-portada.png';
s.tags=['Mensaje oculto','Un testimonio decisivo','Cuatro desenlaces'];
s.roles.A.description='Alex examina los originales y escucha a Clara. Comparte los detalles que Noa necesita para consultar el archivo.';
s.roles.B.description='Noa consulta la web del archivo: marcas, rutas y movimientos. Necesita las palabras y el recuerdo que tiene Alex.';
s.introduction=[
'Sois Alex y Noa, el equipo encargado de preparar la apertura del archivo vecinal de Valdemar. Si juegas en solitario, manejas los dos expedientes. En pareja, cada persona recibe fuentes diferentes y tendréis que explicaros lo que descubrís.',
'Clara y Gabriel encuadernaban libros juntos y solían esconder frases entre sus páginas. Al separarse acordaron un último intercambio por carta, sin llamadas ni visitas. Clara envió cuatro cartas en junio de 2006. Gabriel nunca las recibió; ella interpretó su silencio como una decisión y no insistió. La frase escondida era una costumbre compartida, no un código postal.',
'El 22 de junio Clara consultó en la oficina: le mostraron la saca donde habían reunido sus cuatro envíos. Recuerda un detalle de aquella visita. Aquellos días la oficina reorganizaba sus mesas y agrupaba el correo por destinatario. Veinte años después, la reapertura del edificio ha permitido localizar a ambos y pedirles permiso para examinar los originales. Vuestro encargo tiene dos preguntas: ¿qué mensaje forman las cartas y a qué destino debía ir su saca? Después elegiréis qué hacer con lo descubierto. La medianoche pertenece a la historia: no hay cuenta atrás ni penalización por tardar.'
];
s.rules=['Examina las imágenes, escucha a Clara y abre la web del archivo. Cada fuente aporta información distinta.','Completa las dos partes de la deducción para recuperar la pieza. Terminar la historia también es necesario.','Cada decisión narrativa suma tres puntos visibles. Las ayudas y los intentos fallidos no restan. Los seis estilos pueden puntuar, pero sus máximos no se alcanzan todos en una misma ruta.'];
const scenes={
 umbral:['23:10 · El hallazgo','Lo que llevaba veinte años esperando',[
 'La lluvia golpea el cristal de la oficina. La saca apareció esta tarde, al mover el último armario. Inés localizó a Clara y Gabriel y los citó antes de la inauguración. Ahora son las 23:10: con ambos presentes y su permiso, cortáis el precinto intacto. Dentro, cuatro sobres. La dirección se repite. También el nombre: Gabriel Vidal.',
 '«La exposición abre mañana —dice—. El catálogo pone material retirado. Esto no parece material retirado». Clara reconoce su letra antes de tocar el papel. Gabriel tarda unos segundos en responder: «Pensé que habías cambiado de idea».',
 'Nadie abre una discusión. Os dejan las cartas, una grabación breve de Clara y acceso al archivo. Vuestra primera tarea es reconstruir qué se perdió. Elegid por dónde entrar en el caso.'
 ]],
 pista_a:['23:20 · Los originales','Dos fechas para una misma carta',[
 'Extendéis los sobres bajo la lámpara. Cada uno lleva dos fechas distintas. Si seguís las letras A, B, C y D, las primeras palabras parecen trozos de una conversación interrumpida.',
 'Entre las hojas hay una nota de Clara, conservada en el archivo web. Quizá no os falten palabras: quizá las estéis leyendo en el orden equivocado. Antes de elegir el siguiente paso, cruzad las marcas de los sobres con su leyenda.',
 'Inés acerca el cartel preparado para mañana: «Objetos sin destinatario». Podéis retirarlo mientras investigáis o dejar visible una nota que admita que esta historia está por comprobar.'
 ]],
 pista_b:['23:20 · El recuerdo','Una voz al otro lado de los años',[
 'Clara no ha grabado una explicación larga. Son unos segundos y un detalle que insiste en distinguir de otro. Reproducid su testimonio en la mesa de pruebas.',
 'Un recuerdo no os dará por sí solo toda la historia. Noa tiene un plano de reparto de 2006; Alex, las cartas. Tendréis que juntar lo oído con lo escrito. La mesa donde se vio una saca no tiene por qué ser el lugar al que debía ir.',
 'Inés os muestra el cartel «Objetos sin destinatario». Debéis decidir si lo retiráis durante la investigación o dejáis a la vista una nota provisional sin nombres.'
 ]],
 contraste_a:['23:35 · La contradicción','El hueco que deja un silencio',[
 'El cartel queda boca abajo. Gabriel se sienta frente a las cartas, sin abrirlas todavía. «No quiero que me digáis qué tendría que haber pasado entre nosotros. Quiero saber si llegaron hasta aquí».',
 'Hay dos investigaciones sobre la mesa: reconstruir la frase y comprobar el destino postal. Una respuesta sentimental no demuestra una ruta; una ruta no explica lo que alguien siente. Contrastad las dos partes del enigma antes de darlo por resuelto.',
 'Cuando tengáis vuestra hipótesis, podéis acercaros primero a Gabriel o reconstruir con Inés el recorrido de la saca.'
 ]],
 contraste_b:['23:35 · La contradicción','Una etiqueta que llegó demasiado lejos',[
 'La nota provisional ya está junto a la vitrina: «Correspondencia recuperada. Investigación en curso». No contiene nombres. Inés señala la línea de las 18:50 en el registro y deja el dedo quieto.',
 'La cinta ya no está. La conserva un recuerdo. El archivo conserva el código de un destino. Ninguna de las dos fuentes basta por separado: escuchad de nuevo a Clara y comparad su detalle con el plano postal.',
 'No habéis encontrado un culpable. Estáis comprobando una clasificación. Podéis explicar primero lo que sabéis a Gabriel o preparar con Inés una reconstrucción que cualquiera pueda revisar.'
 ]],
 criterio_a:['23:45 · Lo que cambia','No era una respuesta',[
 'Gabriel pasa el pulgar por el borde del primer sobre. «Veinte años pensando que el silencio era una respuesta». Clara, desde la otra sala, pide que le confirméis únicamente si las cartas han llegado.',
 'La devolución está preparada. Lo que podéis cambiar ahora es su forma: dejar a Gabriel espacio para leer, abrir un canal voluntario de respuesta o dar al error una consecuencia pública. Ninguna opción obliga a Clara y Gabriel a reencontrarse.',
 '¿Dedicáis el último tramo de la noche a la entrega o a lo que contará mañana el archivo?'
 ]],
 criterio_b:['23:45 · Lo que cambia','La vitrina tiene que contar otra historia',[
 'Inés retira del catálogo la expresión «sin destinatario». Debajo había una dirección. La tuvo siempre. Ahora hay sitio para explicar lo que ocurrió, aunque el nombre de quien recibió la saca se haya perdido.',
 'Las cartas no se quedarán en el museo. La cuestión es qué saldrá de aquí además de ellas: un espacio para una respuesta, una explicación pública o una revisión de cómo se gestionó el correo.',
 'Podéis guardar por esta noche la reconstrucción y acompañar la entrega, o elegir una actuación para que el archivo responda por lo sucedido.'
 ]],
 cierre_a:['23:58 · Vuestra última decisión','Una puerta que nadie tiene que cruzar',[
 'La carpeta está lista. Gabriel puede llevársela ahora y leer a solas. También puede usar la pequeña sala del archivo, con una mediadora, y un buzón reservado durante treinta días si decide responder. Clara ha aceptado ambas posibilidades.',
 'No sabréis esta noche si habrá una nueva carta. Esa parte les pertenece. Vuestra decisión sí tiene una consecuencia concreta: una entrega que termina aquí o un canal que quedará abierto un mes.'
 ]],
 cierre_b:['23:58 · Vuestra última decisión','Mañana abrirán las puertas',[
 'Los originales esperan a Gabriel. En la mesa de Inés quedan dos propuestas: una vitrina que explique el error sin mostrar las cartas, o una solicitud de revisión con fecha para la semana siguiente.',
 'La primera cambia lo que verá el público mañana. La segunda abre una investigación del procedimiento, aunque no promete encontrar a quien intervino en 2006. Elegid qué compromiso dejaréis firmado.'
 ]]
};
for(const [id,[chapter,title,text]] of Object.entries(scenes)){
 const n=s.nodes[id];Object.assign(n,{chapter,title,text,evidence:{A:{title:'Tu parte de la investigación',text:'Conserva las marcas de cada sobre y el detalle que cuenta Clara. Compártelos con Noa.'},B:{title:'Tu parte de la investigación',text:'Localiza la leyenda de las marcas y el plano de reparto. Pide a Alex los datos que necesitas para interpretarlos.'}},hint:'Las fuentes se complementan. Las ayudas graduadas están junto al enigma.',hints:['Consulta las fuentes antes de decidir.','Separad lo que sabéis de lo que suponéis.','La explicación completa se abre al resolver el enigma.']});
}
// Keep identifiers and routes stable so existing saved sessions can still resume.
const choices={
 'inventariar-originales':['Examinar los sobres bajo la lámpara','Empieza por las marcas y las palabras; después podrás escuchar a Clara.',{inteligencia:2,perspicacia:1}],
 'escuchar-limites':['Escuchar el recuerdo de Clara','Empieza por su testimonio y busca después cómo comprobarlo.',{empatia:2,perspicacia:1}],
 'mesa-reservada':['Retirar el cartel mientras investigáis','Evita presentar una conclusión que aún no habéis comprobado.',{empatia:2,inteligencia:1}],
 'proteger-lectura':['Retirar el cartel mientras investigáis','Reserva el espacio y contrasta las fuentes antes de explicarlo al público.',{empatia:2,perspicacia:1}],
 'aviso-inventario':['Dejar visible que hay una investigación','Coloca una nota provisional sin nombres junto a la vitrina.',{valentia:2,inteligencia:1}],
 'anotar-retraso':['Dejar visible que hay una investigación','Reconoce la incertidumbre sin exponer a Clara ni a Gabriel.',{valentia:2,inteligencia:1}],
 'preparar-entrega':['Acercaros primero a Gabriel','Explícale lo que podéis sostener y deja espacio para que pregunte.',{empatia:2,perspicacia:1}],
 'proteger-originales':['Acercaros primero a Gabriel','Separa la explicación del correo de cualquier suposición sobre Clara.',{empatia:2,perspicacia:1}],
 'preparar-anexo':['Reconstruir el recorrido con Inés','Une fechas, lugares y testimonio para preparar una explicación comprobable.',{inteligencia:2,creatividad:1}],
 'completar-cronologia':['Reconstruir el recorrido con Inés','Contrasta el destino registrado con el que correspondía a la saca.',{inteligencia:2,perspicacia:1}],
 'cerrar-correspondencia':['Cuidar cómo llegan las cartas','Elige con Gabriel entre una lectura a solas y un canal de respuesta.',{empatia:2,romanticismo:1}],
 'reservar-anexo':['Cuidar cómo llegan las cartas','Deja la reconstrucción a salvo y acompaña la devolución.',{empatia:2,romanticismo:1}],
 'cerrar-registro':['Hacer que el archivo responda','Decide si el error se explica mañana o se lleva a revisión.',{valentia:2,inteligencia:1}],
 'activar-anexo':['Hacer que el archivo responda','Convierte la reconstrucción en una acción pública o una revisión.',{inteligencia:2,creatividad:1}],
 'entrega-directa':['Entregar las cartas y dejar tiempo','Gabriel se lleva los originales. Esta noche no organizáis otro contacto.',{empatia:2,perspicacia:1}],
 'buzon-voluntario':['Dejar una puerta abierta','Entrega acompañada y buzón voluntario durante treinta días, sin respuesta prometida.',{romanticismo:2,empatia:1}],
 'cronologia-publica':['Cambiar la historia de la vitrina','El museo explica el fallo postal con una reconstrucción sin nombres ni cartas.',{creatividad:2,inteligencia:1}],
 'revision-formal':['Pedir que alguien responda por el procedimiento','La comisión revisará el caso el 21 de noviembre; no anticipáis sus conclusiones.',{valentia:2,inteligencia:1}]
};
for(const n of Object.values(s.nodes))for(const c of n.choices){const [label,description,effects]=choices[c.id];Object.assign(c,{label,description,effects:Object.fromEntries(['inteligencia','perspicacia','romanticismo','empatia','creatividad','valentia'].map(k=>[k,effects[k]||0]))});}
const solution='ED indica expedición. Sus fechas ordenan D, B, A y C: VEN SIN DEBERME NADA. Clara recuerda una cinta azul; el plano de 2006 asigna las sacas azules a R2, pendiente de reparto. El libro las sitúa en E4, material retirado, tras pasar por la mesa de devoluciones. El desvío de clasificación explica por qué no llegaron. No prueba sabotaje ni permite nombrar a un culpable. La invitación de 2006 tampoco demuestra qué desean hoy Clara y Gabriel.';
s.puzzle={title:'Dos piezas para reconstruir aquella noche',prompt:'Reconstruye el mensaje de las cuatro cartas y el destino al que debía ir la saca. Usa las imágenes, el testimonio y el archivo web. Puedes completar los controles o escribir MENSAJE | DESTINO.',answer:'VEN SIN DEBERME NADA | R2',aliases:[],hints:['Las letras A–D son del inventario actual. Busca qué marca corresponde a lo que Clara enviaba. Para la ruta, escucha un color y localízalo en el plano de 2006.','Ordena las fechas ED, no las TR. El lugar donde Clara vio la saca es una escala, no necesariamente su destino. El registro E4 describe lo ocurrido, no lo que debía ocurrir.','D, B, A, C forman VEN SIN DEBERME NADA. Clara dice azul; el plano asigna azul a R2. Respuesta: VEN SIN DEBERME NADA | R2.'],explanation:solution,unlockNodes:['contraste_a','contraste_b','criterio_a','criterio_b','cierre_a','cierre_b']};
const endings={
 final_1:['El tiempo que le pertenece','Devolución privada',[
 'Gabriel guarda las cuatro cartas en el bolsillo interior del abrigo. Se detiene junto a la puerta. «Gracias por no leerme la cara», dice. Nadie le pide que abra el primer sobre delante de los demás.',
 'Clara recibe una confirmación breve: entregadas. Inés corrige el catálogo y apaga la lámpara. Mañana el museo abrirá con un hueco en la vitrina. Esta noche, por fin, los sobres duermen fuera del archivo.'
 ],'Habéis completado la entrega y preservado un tiempo de lectura privado. No abrís un canal de respuesta ni una revisión formal.'],
 final_2:['Un buzón con luz','Treinta días para una respuesta',[
 'Gabriel recibe los originales en la sala pequeña. La mediadora le entrega una tarjeta con una fecha de cierre. Durante treinta días puede dejar una respuesta en un buzón reservado. Clara dispone del mismo canal. Nadie escribirá en su nombre.',
 'Cuando salís, el buzón está vacío. No es un fracaso ni una promesa. Es algo que no existía una hora antes: una posibilidad que no depende de que una oficina sepa interpretar un silencio.'
 ],'Habéis creado un canal de contacto voluntario durante un mes. No se publica la correspondencia ni se promete una reconciliación.'],
 final_3:['El hueco en la vitrina','Una historia que cambia en público',[
 'A la mañana siguiente, la vitrina no exhibe cartas. Muestra un recorrido postal y un punto donde dos destinos dejaron de coincidir. Un visitante vuelve a leer el cartel. «Entonces sí tenían destinatario», dice.',
 'Los originales están con Gabriel. Clara no aparece en ninguna fotografía. Inés conserva la clasificación antigua junto a su corrección: el museo cuenta su error sin convertir una vida privada en una atracción.'
 ],'Habéis cambiado la exposición y explicado el fallo de forma pública. No abrís una comisión de revisión.'],
 final_4:['La pregunta que queda abierta','Revisión del procedimiento',[
 'Inés firma la solicitud para el 21 de noviembre. Sobre la mesa quedan las referencias de la saca, las rutas y las horas. Las cartas ya se han entregado a Gabriel; la comisión no recibirá su contenido.',
 'El museo abre con una nota breve: «Clasificación corregida. Revisión solicitada». No hay un nombre al que culpar. Hay una pregunta concreta que ya no puede archivarse bajo material retirado: cómo impedir que vuelva a ocurrir.'
 ],'Habéis iniciado una revisión con fecha y alcance. Su resultado sigue abierto; no equivale a un veredicto contra alguien.']
};
for(const [id,[title,subtitle,text,consequence]] of Object.entries(endings))Object.assign(s.endings[id],{title,subtitle,text,explanation:solution+' '+consequence,reflection:'¿Qué habríais hecho de otra manera si estas cartas fueran para vosotros?',professionalCoda:'Alex y Noa cierran juntos la oficina. En el reverso de la ficha aparece el ojo de las doce señales: el caso guarda una pieza del plano.',romanticCoda:'Alex señala el café que sigue abierto al otro lado de la plaza. «¿Nos quedamos un rato?». Noa sonríe: esta invitación sí puede llegar a tiempo. Es un epílogo opcional entre dos personajes adultos.'});
})(globalThis);
