(() => {
  'use strict';

  const guidePath='/#como-se-juega';
  const objects=[
    {name:'Magnetófono',role:'Restauración',photo:'/c87-magnetofono.webp',detail:'Escucha cómo empieza la grabación. Anota el patrón que oyes o lee su transcripción.'},
    {name:'Libro de salidas',role:'Archivo',photo:'/c87-registro.webp',detail:'Busca qué marca identificaba cada tipo de cinta. Anota el precinto que corresponde al original.'}
  ];
  const modes={
    reto:'Los retos son opcionales. Cada reto indica su objetivo y ofrece su premio al resolverlo por primera vez.',
    demo:'En La cinta 87 os turnáis con la misma pantalla. En solitario puedes consultar las dos carpetas.',
    solo:'En solitario puedes consultar la documentación de ambos papeles. Cambia de carpeta si una observación queda sin explicar.',
    duo:'Cada persona consulta su carpeta desde su propia cuenta. Describe lo que ves y escucha qué añade la otra carpeta.',
    archivo:'En los expedientes de Marta y Tomás podéis repartiros la lectura en una pantalla. El marcador se conserva en el mismo navegador.',
    clasico:'Sigue la escena y revisa el expediente antes de votar. En una partida compartida, cada participante registra su decisión.',
    sala:'Cada sala tiene seis estaciones. Puedes resolverlas a solas o abrir «Jugar en pareja» con dos cuentas vinculadas. Cada persona recibe las llaves de la estación la primera vez que la resuelve.',
    temporada:'Puedes investigar con las dos carpetas en solitario o emparejar dos cuentas con acceso al mismo juego.'
  };

  function view(){
    const member=window.ClubAccess?.canPlay===true;
    const action=member?{href:'/#casos',label:'Elegir un juego'}:window.ClubAccess?.offerAction||{href:'/#planes',label:'Ver la suscripción'};
    const price=window.ClubAccess?.price;
    const offer=member?'':`<p>Cada cuota abre cuatro juegos. En tres bloques completas los doce de una temporada.${price?' La cuota es de '+price+' por persona al mes.':''}</p>`;
    return `<article class="how-guide" aria-labelledby="how-title">
      <header class="how-heading"><h1 id="how-title">Cómo se juega</h1><p>En cada aventura hay algo que averiguar. Explora la escena, recoge pruebas y cruza lo que encuentres antes de tomar una decisión.</p></header>
      <section class="how-practice" aria-labelledby="how-practice-title"><div><h2 id="how-practice-title">Prueba con dos objetos</h2><p>Estas piezas aparecen en <em>La cinta 87</em>. Toca cada una para descubrir qué puede aportar a la investigación.</p></div>
        <guide-comparison><div class="how-objects" role="group" aria-label="Objetos que puedes inspeccionar">${objects.map((item,index)=>`<button type="button" data-inspect="${index}" aria-pressed="false"><img src="${item.photo}" alt="" width="512" height="320" decoding="async"><span><small>${item.role}</small><strong>${item.name}</strong></span></button>`).join('')}</div>
        <p class="how-finding" data-insight role="status" aria-live="polite" aria-atomic="true">Elige un objeto para inspeccionarlo.</p></guide-comparison>
      </section>
      <section class="how-roles" aria-labelledby="how-role-title"><h2 id="how-role-title">Elige cómo investigar</h2><dl><div><dt>En solitario</dt><dd>Una persona lleva los dos papeles. Mira qué sabe cada uno antes de responder.</dd></div><div><dt>En pareja</dt><dd>En la demo compartís una pantalla y os la pasáis por turnos. En una temporada, cada persona entra en su propia cuenta con acceso al juego. Vinculad la pareja en <a href="/#perfil?seccion=pareja">Mi cuenta</a> y elegid «En pareja» en el mismo juego.</dd></div></dl></section>
      <section class="how-actions" aria-labelledby="how-actions-title"><h2 id="how-actions-title">Durante la partida</h2><ol>
        <li><strong>Explora la escena.</strong> Lee tu objetivo y abre un lugar marcado. Examina los objetos y guarda en el inventario los que puedas recoger.</li>
        <li><strong>Compara las pruebas.</strong> Lee las dos fichas y busca un detalle común. Cuando el juego permita combinarlas, selecciona ambas y comprueba qué explica su relación.</li>
        <li><strong>Contrasta tu respuesta.</strong> Vuelve a la pregunta y busca una prueba que respalde tu decisión. Si necesitas una pista, mira cuántas llaves cuesta antes de abrirla. En la demo puedes pedir ayuda gratis.</li>
      </ol></section>
      <section class="how-reference" aria-labelledby="how-return-title"><h2 id="how-return-title">Seguir otro día</h2>
        <p>La demo guarda el avance en este navegador. Para retomar un juego de temporada, entra en la misma cuenta y abre <a href="/#archivo">Mis partidas</a>. Espera a que el juego confirme tu última acción antes de salir.</p>
        <details><summary>¿Para qué sirven los retos extra?</summary><p>En <a href="/#desafios">Retos extra</a> encontrarás las salas de seis minijuegos, el reto propio de cada aventura y el calendario común. Las llaves que consigas sirven para pedir pistas en tus juegos de temporada. La cinta 87 tiene pistas gratuitas y guarda un recuerdo en tu navegador.</p><p>Si abres una sala desde una aventura, pulsa «Volver a mi aventura» para recuperar la mesa que estabas usando. En pareja, abrid la misma estación y elegid «Jugar en pareja». Cada uno confirma su observación antes de comprobar juntos la solución.</p></details>
      </section>
      <section class="how-reference" aria-labelledby="how-start-title"><h2 id="how-start-title">${member?'Tu próxima investigación':'Tu primera noche en Valdemar'}</h2>${offer}<nav class="how-start" aria-label="Elegir una partida"><a href="${action.href}">${action.label}</a><a href="/cinta-87.html" data-action="preview-open">Probar La cinta 87 sin cuenta</a></nav></section>
    </article>`;
  }

  function comparisonState(control) {
    const chosen=[...control.querySelectorAll('[data-inspect][aria-pressed="true"]')].map(button=>Number(button.dataset.inspect));
    if(chosen.length===2)return 'La grabación te da un patrón de sonido y el registro te da un precinto. Para reconocer la cinta original, la misma caja debe encajar con ambos indicios.';
    return chosen.length?objects[chosen[0]].detail:'Elige un objeto para inspeccionarlo.';
  }

  function appendText(parent,tag,text){
    const node=parent.ownerDocument.createElement(tag);
    node.textContent=text;parent.append(node);
    return node;
  }

  function open(trigger,options={}){
    const doc=trigger?.ownerDocument||document;
    const existing=doc.querySelector('dialog.how-quick[open]');
    if(existing){existing.querySelector('.how-quick-actions button')?.focus();return;}
    const dlg=doc.createElement('dialog');dlg.className='how-quick';dlg.setAttribute('aria-labelledby','how-quick-title');
    const heading=appendText(dlg,'h2','Cómo se juega');heading.id='how-quick-title';
    const detail=typeof options.text==='string'?options.text.trim():'';
    if(detail)appendText(dlg,'p',detail);
    appendText(dlg,'p',modes[options.context]||modes.temporada);
    const defaults=options.context==='sala'?['Elige una estación y lee su objetivo.','Prueba sus controles y comprueba el resultado antes de cambiar de estación.']:['Lee el objetivo de la escena y examina un lugar u objeto marcado.',
      'Guarda las pruebas que puedas recoger. Compara las dos carpetas para justificar tu respuesta.',
      ['demo','archivo'].includes(options.context)?'Vuelve al juego cuando quieras continuar. El avance se conserva en este navegador.':options.context==='clasico'?'Consulta las opciones disponibles en tu expediente. Puedes volver a las partidas de tu cuenta desde Mis partidas.':'Si te atascas, consulta el coste de una pista. Puedes retomar después desde Mis partidas.'];
    const steps=Array.isArray(options.steps)?options.steps.filter(step=>typeof step==='string'&&step.trim()):[];
    const list=doc.createElement('ol');dlg.append(list);
    for(const step of steps.length?steps:defaults)appendText(list,'li',step);
    const preferences=doc.createElement('details');preferences.className='how-sound-settings';
    appendText(preferences,'summary','Ajustar sonido y transcripciones');
    preferences.append(doc.createElement('game-audio-preferences'));dlg.append(preferences);
    const actions=doc.createElement('div');actions.className='how-quick-actions';dlg.append(actions);
    const back=appendText(actions,'button','Volver al juego');back.type='button';back.autofocus=true;back.addEventListener('click',()=>dlg.close());
    const more=appendText(actions,'a','Guía completa (otra pestaña)');more.href=guidePath;more.target='_blank';more.rel='noopener';
    dlg.addEventListener('cancel',event=>event.stopPropagation());
    dlg.addEventListener('close',()=>{
      const active=doc.activeElement;
      const restore=!active||active===doc.body||active===doc.documentElement||dlg.contains(active);
      dlg.remove();
      if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});
    },{once:true});
    doc.body.append(dlg);dlg.showModal();back.focus({preventScroll:true});
  }

  if(window.customElements&&!window.customElements.get('guide-comparison')){
    window.customElements.define('guide-comparison',class extends HTMLElement{
      connectedCallback(){
        if(this.bound)return;this.bound=true;
        this.addEventListener('click',event=>{
          const button=event.target.closest('[data-inspect]');
          if(!button||!this.contains(button))return;
          button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
          this.querySelector('[data-insight]').textContent=comparisonState(this);
        });
      }
    });
  }
  if(window.customElements&&!window.customElements.get('gameplay-help')){
    window.customElements.define('gameplay-help',class extends HTMLElement{
      connectedCallback(){
        if(this.firstElementChild)return;
        const button=appendText(this,'button','Cómo se juega');button.type='button';button.setAttribute('aria-haspopup','dialog');
        button.addEventListener('click',()=>open(button,{context:this.getAttribute('context')}));
      }
    });
  }
  window.ComoSeJuega=Object.freeze({view,open});
})();
