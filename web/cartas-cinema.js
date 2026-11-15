(function(root){
'use strict';
const catalog={
  "intro": {
    "id": "inicio",
    "title": "Inés os abre el caso",
    "text": "Soy Inés. Mañana inauguramos el museo de Valdemar. Pero hoy hemos encontrado cuatro cartas ocultas durante veinte años. Clara las escribió para Gabriel. Él nunca las recibió. Necesito vuestra ayuda para descubrir qué ocurrió. Clara interpretó aquel silencio como una despedida. Vuestra misión es reconstruir el mensaje de las cartas y descubrir por qué no llegaron. Un recuerdo de Barcelona también os llevará hasta un cuaderno del taller. Investigaréis como Alex y Noa. En pareja, repartíos los dos expedientes. Si juegas a solas, consulta ambos. Comparad las pistas y comprobad vuestras deducciones. Empezad por las marcas de los sobres. Os escucho.",
    "src": "/cinema-cartas/inicio.mp4"
  },
  "choices": [
    {
      "id": "sobres",
      "choiceIds": [
        "inventariar-originales"
      ],
      "title": "Los originales bajo la lámpara",
      "seconds": 10,
      "text": "Habéis elegido empezar por los sobres. Sus marcas pueden ordenar esta historia. Comparadlas con la leyenda del archivo antes de sacar conclusiones.",
      "visual": "Inés despliega cuatro sobres bajo la lámpara y vuelve la mirada al jugador.",
      "src": "/cinema-cartas/sobres.mp4"
    },
    {
      "id": "recuerdo",
      "choiceIds": [
        "escuchar-limites"
      ],
      "title": "La voz que recuerda",
      "seconds": 10,
      "text": "Habéis elegido escuchar a Clara. Su recuerdo nos da una pista que los documentos no conservan. Ahora necesitamos comprobarla en el plano postal.",
      "visual": "Inés acerca una grabadora al jugador. No se revela el color de la cinta.",
      "src": "/cinema-cartas/recuerdo.mp4"
    },
    {
      "id": "reserva",
      "choiceIds": [
        "mesa-reservada",
        "proteger-lectura"
      ],
      "title": "Un cartel boca abajo",
      "seconds": 10,
      "text": "El cartel queda retirado. Habéis protegido esta historia mientras investigamos. Aún falta comprobar las pruebas antes de contarle a nadie qué ocurrió.",
      "visual": "Inés gira el cartel de la vitrina y orienta la lámpara hacia la mesa.",
      "src": "/cinema-cartas/reserva.mp4"
    },
    {
      "id": "aviso",
      "choiceIds": [
        "aviso-inventario",
        "anotar-retraso"
      ],
      "title": "Una investigación a la vista",
      "seconds": 10,
      "text": "La vitrina reconoce que hay una investigación en curso. Sin nombres ni conclusiones precipitadas. Habéis hecho visible la duda; ahora toca resolverla.",
      "visual": "Inés coloca una nota provisional en una vitrina vacía. El texto exacto se muestra mediante HTML, nunca generado dentro del vídeo.",
      "src": "/cinema-cartas/aviso.mp4"
    },
    {
      "id": "gabriel",
      "choiceIds": [
        "preparar-entrega",
        "proteger-originales"
      ],
      "title": "Sentarse a escuchar",
      "seconds": 10,
      "text": "Habéis elegido acompañar primero a Gabriel. Le explicaremos solo lo que las pruebas permitan afirmar. Su reacción le pertenece; no necesitamos interpretarla.",
      "visual": "Una silla se acerca a la mesa; las manos de Gabriel descansan junto a los sobres. Inés se dirige al jugador.",
      "src": "/cinema-cartas/gabriel.mp4"
    },
    {
      "id": "recorrido",
      "choiceIds": [
        "preparar-anexo",
        "completar-cronologia"
      ],
      "title": "La ruta sobre la mesa",
      "seconds": 10,
      "text": "Habéis elegido reconstruir el recorrido conmigo. Pondremos fechas, registros y recuerdos sobre la misma mesa. Cada afirmación tendrá que apoyarse en una prueba.",
      "visual": "Inés extiende plano y registros. Ningún código o solución debe quedar legible antes de resolverlo.",
      "src": "/cinema-cartas/recorrido.mp4"
    },
    {
      "id": "entrega",
      "choiceIds": [
        "cerrar-correspondencia",
        "reservar-anexo"
      ],
      "title": "Las cartas vuelven a tener destino",
      "seconds": 10,
      "text": "Habéis decidido cuidar la entrega. Las cartas volverán a Gabriel. Ahora elegid: darle tiempo a solas o abrir un canal de respuesta voluntario.",
      "visual": "Inés reúne los cuatro originales en una carpeta y la acerca al jugador.",
      "src": "/cinema-cartas/entrega.mp4"
    },
    {
      "id": "archivo",
      "choiceIds": [
        "cerrar-registro",
        "activar-anexo"
      ],
      "title": "El archivo debe actuar",
      "seconds": 10,
      "text": "Habéis decidido que el archivo actúe. Podemos cambiar lo que contará la exposición o solicitar una revisión del procedimiento. Elegid qué compromiso dejamos firmado.",
      "visual": "Inés presenta dos carpetas y mira al jugador; sin elección automática.",
      "src": "/cinema-cartas/archivo.mp4"
    },
    {
      "id": "privado",
      "choiceIds": [
        "entrega-directa"
      ],
      "endingId": "final_1",
      "title": "El tiempo que le pertenece",
      "seconds": 10,
      "text": "Gabriel se lleva las cartas. Clara recibirá la confirmación de entrega. Habéis respetado su tiempo: esta noche, nadie le pedirá una respuesta.",
      "visual": "Manos de Gabriel guardan la carpeta en su abrigo. La puerta se abre a una plaza lluviosa; Inés observa al jugador.",
      "src": "/cinema-cartas/privado.mp4"
    },
    {
      "id": "buzon",
      "choiceIds": [
        "buzon-voluntario"
      ],
      "endingId": "final_2",
      "title": "Un buzón con luz",
      "seconds": 10,
      "text": "Las cartas ya están entregadas. Este buzón quedará abierto treinta días. Habéis creado una posibilidad para Clara y Gabriel, sin prometer que habrá respuesta.",
      "visual": "Inés abre un pequeño buzón vacío con llave y deja una tarjeta a su lado. Sin mostrar reconciliación.",
      "src": "/cinema-cartas/buzon.mp4"
    },
    {
      "id": "vitrina",
      "choiceIds": [
        "cronologia-publica"
      ],
      "endingId": "final_3",
      "title": "El hueco en la vitrina",
      "seconds": 10,
      "text": "Los originales están con Gabriel. La exposición contará el fallo sin mostrar sus cartas ni sus nombres. Habéis cambiado la historia que conocerán los visitantes.",
      "visual": "La vitrina muestra una reconstrucción abstracta del recorrido, sin documentos privados. Amanecer en el museo.",
      "src": "/cinema-cartas/vitrina.mp4"
    },
    {
      "id": "revision",
      "choiceIds": [
        "revision-formal"
      ],
      "endingId": "final_4",
      "title": "La pregunta que queda abierta",
      "seconds": 10,
      "text": "La revisión queda solicitada para el veintiuno de noviembre. Las cartas ya están entregadas. Habéis abierto una investigación del procedimiento, no señalado a un culpable.",
      "visual": "Inés firma una solicitud y cierra una carpeta de registros; el contenido privado queda aparte.",
      "src": "/cinema-cartas/revision.mp4"
    }
  ],
  "final": {
    "id": "final",
    "seconds": 15,
    "gate": "status === finished AND investigation.solvedAt",
    "text": "Enhorabuena. Habéis aclarado el mensaje, localizado el cuaderno y reconstruido el error postal. El borrador de Gabriel nunca se envió. Ahora ellos decidirán su futuro. Vuestra investigación está completa. La pieza es vuestra.",
    "visual": "Inés mira directamente al jugador y entrega una pieza simbólica. Sin anticipar decisiones sentimentales.",
    "title": "La última pieza es vuestra",
    "src": "/cinema-cartas/final.mp4"
  }
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sequence(s,index=s.history.length){
 const i=Math.min(Math.max(Number.isInteger(index)?index:s.history.length,0),s.history.length);
 const result=i===0?[catalog.intro]:catalog.choices.filter(v=>v.choiceIds.includes(s.history[i-1]?.choiceId));
 if(i===s.history.length&&s.status==='finished'&&s.investigation?.solvedAt)result.push(catalog.final);
 return result;
}
function mount(s,c,host,index){
 if(c?.id!=='cartas-medianoche'||!root.CartasCinema.enabled)return;
 const scenes=sequence(s,index),section=document.createElement('section');
 section.className='case-cinema';section.setAttribute('aria-label','Escenas de vuestra aventura');
 section.innerHTML=scenes.map(v=>`<article class="cinema-scene"><header><span class="ui-kicker">${v.id==='inicio'?'EL CASO EMPIEZA AQUÍ':v.id==='final'?'INVESTIGACIÓN COMPLETADA':'VUESTRA DECISIÓN CAMBIA LA HISTORIA'}</span><h3>${esc(v.title)}</h3></header><video controls playsinline preload="metadata" poster="/cinema-cartas/${v.id}.jpg" aria-label="${esc(v.title)}"><source src="${v.src}" type="video/mp4"><track kind="captions" srclang="es" label="Español" src="/cinema-cartas/${v.id}.vtt">Tu navegador no puede reproducir este vídeo.</video><div class="cinema-controls"><p class="cinema-error" role="status" hidden>El vídeo no está disponible. Puedes leer la escena y continuar.</p><details><summary>Leer el diálogo de la escena</summary><p>${esc(v.text)}</p></details><button class="button small" data-cinema-continue>Continuar la historia ↓</button><small>Escena de ficción creada con IA.</small></div></article>`).join('');
 section.querySelectorAll('video').forEach(v=>{v.addEventListener('play',()=>{document.querySelectorAll('video,audio').forEach(other=>{if(other!==v)other.pause();});});const fail=()=>{v.closest('article').querySelector('.cinema-error').hidden=false;v.closest('article').querySelector('details').open=true;};v.addEventListener('error',fail);v.querySelector('source').addEventListener('error',fail);});
 section.querySelectorAll('[data-cinema-continue]').forEach(b=>b.addEventListener('click',()=>{section.querySelectorAll('video').forEach(v=>v.pause());const chapter=host.querySelector('#game-reading');chapter?.scrollIntoView({block:'start',behavior:'smooth'});chapter?.focus({preventScroll:true});}));
 const chapter=host.querySelector('#game-reading');if(chapter)chapter.before(section);else host.append(section);
}
// Enable only after all referenced media have been downloaded and verified.
root.CartasCinema={enabled:true,catalog,sequence,mount};
})(globalThis);
