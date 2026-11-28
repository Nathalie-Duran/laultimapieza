(() => {
  'use strict';
  const places = ['recepcion','centralita','archivo','pasillo'];
  const props = {plano:'planta',recorte:'recorte',recibo:'registro'};
  const portraits = {simon:0,lucia:1,dario:2};
  const levels = {open:'Orientación del caso',second:'Pista detallada del caso',solution:'Solución del caso completo'};
  const hintsByStage = [
    ['Atiende a las primeras palabras de Candela. Anota qué pide y qué quiere evitar antes de proponer una orden.',
     'Compara la leyenda de guardia con la ruta de las entregas. Distingue el aviso de la línea que lo debe atender.'],
    ['En el libro de cerrajería, separa lo que ocurrió con las copias de lo que ocurrió con el cilindro.',
     'Compara las dos plantas por sus puertas y su rellano. Usa la nota del inspector para fechar el cambio.'],
    ['Examina el sobre del revelador y las reglas de la entrevista. Una fotografía y un testimonio acreditan cosas distintas.',
     'Sitúa primero el día de la foto. Cruza el calendario con las entradas y visitas de ese día.'],
    ['Localiza los tres objetos de la lista en las estancias. Anota qué aporta cada persona después de ver una prueba.',
     'Compara la primera declaración con la ampliación. Comprueba con las preguntas de contraste qué dato apareció durante la entrevista.'],
    ['Lee el recado de Candela. Separa el vínculo que acepta de lo que autoriza hacer con su llamada.',
     'Contrasta la petición de Simón con el libro de guardia. Revisa por separado el origen de las llaves y el permiso de contacto.']
  ];
  function el(tag,text,cls){
    const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;
  }
  function photo(id,found=true){
    const name=props[id];if(!name)return null;
    const img=el('img');
    img.src=found?(id==='recibo'?'/hotel-carpeta-recibo.webp':'/hotel-medianoche-'+name+'.webp'):'/hotel-carpeta-reverso-'+id+'.webp';
    img.alt='';return img;
  }
  function art(id){
    return places.includes(id)?'/hotel-estancia-'+id+'.webp':'/valdemar-hotel-lobby.webp';
  }
  function portrait(id){
    if(!Object.hasOwn(portraits,id))return null;
    const frame=el('span',null,'hc-portrait'),img=el('img');
    img.src='/hotel-testigo-'+id+'.webp';img.alt='';frame.setAttribute('aria-hidden','true');frame.append(img);return frame;
  }
  function proofCard(object){
    const card=el('article',null,'hc-proof'),image=photo(object.id);
    if(image)card.append(image);
    const content=el('div');
    content.append(el('h5',object.label),el('p',object.detail));
    const viewer=window.FotosHotel?.(object);
    if(viewer)content.append(viewer);
    card.append(content);return card;
  }
  function testimonyList(hotel,snapshot){
    const ids=new Set(snapshot?.witnesses||[]);
    const witnesses=(hotel.witnesses||[]).filter(w=>ids.has(w.id));
    if(!witnesses.length)return null;
    const details=el('details',null,'hc-testimonies');
    details.append(el('summary','Declaraciones ampliadas · '+witnesses.length));
    for(const w of witnesses){
      const row=el('article'),face=portrait(w.id);
      if(face)row.append(face);
      const text=el('div');text.append(el('h5',w.name),el('p',w.again));row.append(text);details.append(row);
    }
    return details;
  }
  function bag({node,hotel,read,visit}){
    if(!node||!hotel||typeof read!=='function'||node.querySelector(':scope > .hc-bag'))return;
    const panel=el('section',null,'hc-bag'),summary=node.querySelector(':scope > summary');
    if(!summary)return;
    summary.after(panel);
    let revision='',caption='';
    function updateCaption(){
      if(caption&&summary.textContent!==caption)summary.textContent=caption;
    }
    function draw(){
      const snapshot=read()||{},held=new Set(snapshot.objects||[]);
      const cards=(hotel.objects||[]).filter(o=>held.has(o.id));
      caption='Carpeta del hotel · '+cards.length+' de '+(hotel.objects||[]).length+' objetos';
      updateCaption();
      const stamp=JSON.stringify([Array.from(held),snapshot.witnesses||[]]);if(stamp===revision)return;revision=stamp;
      panel.replaceChildren();
      if(cards.length){
        const gallery=el('div',null,'hc-gallery');for(const o of cards)gallery.append(proofCard(o));panel.append(gallery);
      }else{
        const blank=el('div',null,'hc-empty'),pic=el('img');pic.src='/valdemar-hotel-lobby.webp';pic.alt='';
        blank.append(pic,el('p','Tu carpeta está vacía. Abre el plano, entra en una estancia y examina un objeto para guardarlo aquí.'));
        panel.append(blank);
      }
      const notes=testimonyList(hotel,snapshot);if(notes)panel.append(notes);
      if(typeof visit==='function'){
        const open=el('button','Explorar las estancias','hc-act');open.type='button';open.addEventListener('click',visit);panel.append(open);
      }
    }
    node.addEventListener('toggle',()=>{if(node.open)draw();});
    summary.addEventListener('focus',draw);
    // The stage inventory also redraws this native disclosure after a visit or a sync.
    new MutationObserver(updateCaption).observe(summary,{childList:true});
    draw();
    return draw;
  }
  function mapDirectory(wrap,scene,spots,locations,current){
    let dir=wrap.querySelector(':scope > .hc-directory');
    if(!dir){
      dir=el('details',null,'hc-directory');dir.append(el('summary'));
      scene.before(dir);dir.append(scene);
      for(const pin of spots.querySelectorAll('[data-place]')){
        const location=locations.find(place=>place.id===pin.dataset.place);if(!location)continue;
        const mini=el('img');mini.src=art(location.id);mini.alt='';pin.prepend(mini);
      }
    }
    if(dir.dataset.place&&dir.dataset.place!==current.id)dir.open=false;
    dir.dataset.place=current.id;
    dir.querySelector('summary').textContent='Cambiar de estancia · Plano del hotel';
  }
  function room({wrap,scene,spots,pane,current,locations,objects,witnesses,held,learnt}){
    if(!current||!scene||!pane)return;
    wrap.classList.add('hc-rooms');mapDirectory(wrap,scene,spots,locations,current);
    const title=pane.querySelector('h4'),description=title?.nextElementSibling;
    if(!title)return;
    const arrival=el('div',null,'hc-arrival'),view=el('img'),text=el('div');
    view.src=art(current.id);view.alt='';arrival.append(view,text);
    title.before(arrival);
    text.append(title);if(description?.tagName==='P')text.append(description);
    for(const button of pane.querySelectorAll('[data-hotel-object]')){
      const object=objects.find(o=>o.id===button.dataset.hotelObject);
      if(!object)continue;
      button.classList.add('hc-collect');const image=photo(object.id,held.has(object.id));
      if(image)button.prepend(image);
    }
    for(const talk of pane.querySelectorAll('.vhour-witness')){
      const heading=talk.querySelector('h5'),w=witnesses.find(person=>person.name===heading?.textContent);
      if(!w)continue;
      const face=portrait(w.id),headingRow=el('div',null,'hc-interview');
      heading.before(headingRow);if(face)headingRow.append(face);
      const name=el('div');name.append(heading,el('span',learnt.has(w.id)?'Declaración ampliada':'Primera declaración'));headingRow.append(name);
      const select=talk.querySelector('select');if(!select)continue;
      const show=select.nextElementSibling,evidence=el('div',null,'hc-showproof');
      select.before(evidence);
      const picture=el('div',null,'hc-selected-photo'),label=el('label','Objeto para la entrevista');
      label.append(select);evidence.append(picture,label);
      if(show?.tagName==='BUTTON'&&show.parentNode===talk)evidence.append(show);
      function preview(){
        const currentObject=objects.find(o=>o.id===select.value&&held.has(o.id)),image=currentObject&&photo(currentObject.id);
        picture.replaceChildren();if(image)picture.append(image);
      }
      select.addEventListener('change',preview);preview();
    }
    // Replace the text-only duplicate list with the same objects approved by the current save.
    const collected=[...pane.children].find(child=>child.tagName==='DETAILS'&&child.querySelector('summary')?.textContent.startsWith('Objetos recogidos'));
    if(collected){
      collected.classList.add('hc-testimonies');const listing=collected.querySelector(':scope > div');
      if(listing){listing.className='hc-gallery';listing.replaceChildren(...objects.filter(o=>held.has(o.id)).map(proofCard));}
    }
  }
  function guidance(data){
    const stage=data.hour?.stage,index=data.hour?.current;
    if(!stage||!Number.isInteger(index)||!hintsByStage[index])return null;
    const section=el('section',null,'hc-guidance'),head=el('div');
    head.append(el('span','Orientación gratuita de esta etapa'),el('h3',stage.title));
    section.append(head);
    const role=data.partner?.role,which=role==='A'?[0]:role==='B'?[1]:[0,1];
    const list=el('ul');for(const n of which)list.append(el('li',hintsByStage[index][n]));section.append(list);
    return section;
  }
  function hints(body,data){
    if(!body||body.querySelector('.hc-case-hints'))return;
    const tray=body.querySelector('.archivo-pistas');if(!tray)return;
    body.classList.add('hc-hints');
    const guide=guidance(data);if(guide)body.prepend(guide);
    const general=el('header',null,'hc-case-hints');
    general.append(el('h3','Pistas del caso completo'),el('p','Estos sobres ayudan a resolver el misterio del hotel. El precio de cada pista se descuenta de tu saldo al abrirla.'));
    tray.before(general);
    const photos={open:'centralita',second:'registro',solution:'recado'};
    const tiers={open:1,second:2,solution:3};
    for(const [i,line] of [...tray.children].entries()){
      const hint=data.hintOptions?.[i];if(!hint||!Object.hasOwn(levels,hint.op))continue;
      line.classList.add('hc-hint-card');line.dataset.level=hint.op;
      const img=line.querySelector(':scope > img');if(img)img.src='/hotel-medianoche-'+photos[hint.op]+'.webp';
      const mark=el('span','Nivel '+tiers[hint.op]+' · '+(hint.text?'Abierta':'Por abrir'),'hc-hint-state');img?img.after(mark):line.prepend(mark);
      if(hint.op!=='solution')continue;
      const warning=el('p','Revela la resolución final del misterio.','hc-spoiler');mark.after(warning);
      if(hint.text){
        const answer=[...line.querySelectorAll(':scope > p')].find(p=>p!==warning);
        if(answer){const fold=el('details',null,'hc-solution');fold.append(el('summary','Leer la solución final'));answer.before(fold);fold.append(answer);}
      }
    }
  }
  window.HotelCuaderno=Object.freeze({room,bag,hints});
})();
