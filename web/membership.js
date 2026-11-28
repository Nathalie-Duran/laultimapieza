(function(root){
  'use strict';
  const price='29,95 €';
  const demo='<a class="button" href="/cinta-87.html">Jugar la demo de La cinta 87</a>';
  const plansLink='<a class="button primary" href="/#planes">Ver la suscripción mensual</a>';
  let access=false;

  function home(){
    return '<section class="club-hero"><div class="club-hero-copy"><h1>La Última Pieza</h1><p>Historias para investigar a solas o en pareja.</p>'+demo+' <a class="button" href="/#casos">Explorar Juegos</a></div></section>';
  }
  function plans(){
    return '<section class="club-plans"><h1>Cuatro juegos cada mes</h1><p><strong>'+price+'</strong> por persona al mes, IVA incluido. Cada temporada reúne doce juegos en tres bloques de cuatro.</p><p>Consulta la disponibilidad de la suscripción recargando esta página.</p>'+demo+'</section>';
  }
  function gate(){
    return '<section class="club-gate"><h1>Este juego forma parte de la suscripción</h1>'+plansLink+' '+demo+'</section>';
  }
  function account(){
    return '<section class="account-card"><h2>Mi suscripción</h2><p>'+ (access?'Tus juegos están disponibles en tu cuenta.':'Puedes consultar los juegos de cada cuota y la disponibilidad antes de suscribirte.')+'</p>'+plansLink+'</section>';
  }
  root.ClubAccess={price,salesState:'unknown',offerAction:{href:'/#planes',label:'Ver la suscripción'},home,plans,gate,banner(){return '';},account,get canPlay(){return access;},set(value){access=value?.canPlay===true;}};
})(window);
