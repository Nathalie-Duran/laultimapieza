(() => {
  'use strict';
  const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const button=(label,handler)=>{const node=element('button',label);node.type='button';node.addEventListener('click',handler);return node;};
  const materialPhotos=new Map([['Pizarra','material-a'],['Granito','material-b'],['Ladrillo','material-c']]);
  function fieldPhoto(file,description=''){
    const photo=element('img');photo.src='/mansion-hallazgo-'+file+'.webp';photo.alt=description;photo.decoding='async';
    return photo;
  }
  function visualFinding({model,selection,body,request,leave}){
    const desk=element('section');desk.className='hallazgo-mesa';
    body.append(desk);
    const photoArea=element('figure');photoArea.className='hallazgo-placa';
    const frame=element('div');frame.className='hallazgo-encuadre';
    frame.append(fieldPhoto('alfeizar','Un fragmento oscuro sobre el alféizar mojado, junto a la ventana de la mansión.'));
    photoArea.append(frame);desk.append(photoArea);
    const copy=element('div');copy.className='hallazgo-cuaderno';
    const heading=element('h4',model.location||model.discovery?.location);
    copy.append(heading);desk.append(copy);
    const goBack=button('Volver al escenario',leave);goBack.className='hallazgo-volver';
    if(model.discovery){
      const item=model.discovery;
      copy.append(element('small','Guardado en tu colección'),element('h5',item.name),element('p',item.description));
      const points=element('p',item.points+' puntos de observación');points.className='hallazgo-puntos';copy.append(points);
      const album=element('a','Ver mis hallazgos');album.href='/#perfil?seccion=coleccion&ver=hallazgos';copy.append(album,goBack);
      return;
    }
    const reward=element('p',model.reward+' puntos de observación al identificar la muestra.');reward.className='hallazgo-puntos';copy.append(reward);
    if(!model.examined){
      copy.append(element('p','La lluvia ha dejado al descubierto un fragmento en el alféizar. Examínalo para abrir el cuaderno de campo.'),button('Examinar la muestra',()=>request({op:'examine'})),goBack);
      return;
    }
    const magnify=button('Ampliar el fragmento',()=>{
      const zoomed=magnify.getAttribute('aria-pressed')!=='true';
      frame.setAttribute('data-zoom',String(zoomed));magnify.setAttribute('aria-pressed',String(zoomed));
      magnify.textContent=zoomed?'Ver el alféizar completo':'Ampliar el fragmento';
    });
    magnify.setAttribute('aria-pressed','false');magnify.className='hallazgo-lupa';photoArea.append(magnify);
    for(const clue of model.clues){
      const note=element('blockquote');
      note.append(element('cite','Expediente '+clue.role),element('p',clue.text));copy.append(note);
    }
    const form=element('form');form.className='hallazgo-ficha';desk.append(form);
    const complete=element('button','Comprobar identificación');complete.type='submit';
    const nextStep=element('small');nextStep.setAttribute('aria-live','polite');
    const sync=()=>{
      complete.disabled=!(selection.name&&selection.sign);
      nextStep.textContent=!selection.name?'Selecciona una muestra de referencia.':!selection.sign?'Elige el detalle que respalda tu elección.':'Ya puedes comprobar tu identificación.';
    };
    for(const [key,title,options] of [['name','¿Qué material has encontrado?',model.names],['sign','¿Qué detalle lo identifica?',model.signs]]){
      const group=element('fieldset');group.className='hallazgo-grupo hallazgo-'+key;
      group.append(element('legend',title));
      const choices=element('div');choices.className='hallazgo-opciones';group.append(choices);
      if(!options.some(option=>option.value===selection[key]))selection[key]='';
      for(const option of options){
        const label=element('label'),input=element('input');input.type='radio';input.name=key;input.value=option.value;
        input.required=true;input.checked=selection[key]===option.value;
        input.addEventListener('change',()=>{if(input.checked){selection[key]=input.value;sync();}});
        label.append(input);
        const image=key==='name'&&materialPhotos.get(option.label);
        if(image)label.append(fieldPhoto(image));
        label.append(element('span',option.label));choices.append(label);
      }
      form.append(group);
    }
    sync();
    const actions=element('div');actions.className='hallazgo-acciones';actions.append(nextStep,complete,goBack);form.append(actions);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if(selection.name&&selection.sign)request({op:'identify',name:selection.name,sign:selection.sign});
    });
  }
  class ExploradorLup extends HTMLElement {
    connectedCallback(){
      if(this.firstElementChild)return;
      const collection=this.hasAttribute('collection');
      const id=Number(this.getAttribute('case-id'));
      if(!collection&&(!Number.isInteger(id)||id<1||id>48))return;
      const mansion=id===1&&!collection&&this.closest('.mansion-game');
      if(mansion)this.classList.add('hallazgo-mansion');
      const selection={name:'',sign:''};
      const url='/api/valdemar/explorer'+(collection?'':'/'+id);
      const fold=element('details'),summary=element('summary');
      summary.append(element('strong',collection?'Mis hallazgos':'Hallazgo de la aventura'),
        element('span',collection?'Las muestras que has identificado en tus aventuras.':'Actividad opcional. Identifica una muestra del escenario para añadirla a tu colección.'));
      const body=element('div'),status=element('p');status.setAttribute('role','status');status.tabIndex=-1;
      fold.append(summary,body,status);this.append(fold);
      if(mansion){
        const thumb=fieldPhoto('alfeizar');thumb.className='hallazgo-miniatura';summary.prepend(thumb);
      }
      let busy=false,model=null;
      const field=(label,options,name)=>{
        const wrap=element('label',label),select=element('select');select.name=name;select.required=true;
        const blank=element('option','Elige una opción');blank.value='';select.append(blank);
        for(const option of options){const n=element('option',option.label);n.value=option.value;select.append(n);}
        wrap.append(select);return wrap;
      };
      const card=item=>{
        const article=element('article');article.append(element('p',item.category+' · '+item.location),
          element('h4',item.name),element('p',item.description),element('small',item.caseTitle+' · '+item.points+' puntos de observación'));
        return article;
      };
      const draw=()=>{
        body.replaceChildren();
        if(collection){
          body.append(element('p',model.total+' '+(model.total===1?'descubrimiento':'descubrimientos')+' · '+model.points+' puntos de observación'));
          if(!model.total){
            body.append(element('p','Para conseguir la primera, abre «Hallazgo de la aventura» durante un juego de temporada.'));
            const games=element('a','Ver mis partidas');games.href='/#archivo';body.append(games);
          }
          else for(const entry of model.entries)body.append(card(entry));
          return;
        }
        if(mansion&&!model.locked){
          visualFinding({model,selection,body,request,leave:()=>{
            fold.open=false;
            const target=mansion.querySelector('.mansion-device-back')||mansion.querySelector('.mansion-room-title')||summary;
            target.focus();target.scrollIntoView({block:'center'});
          }});return;
        }
        if(model.discovery){
          body.append(card(model.discovery));
          const album=element('a','Ver mis hallazgos');album.href='/#perfil?seccion=coleccion&ver=hallazgos';body.append(album);return;
        }
        if(model.locked){body.append(element('p','Encontrarás la muestra en la etapa '+model.stage+'. Puedes seguir con el objetivo de la aventura y volver aquí cuando llegues.'),
          button('Comprobar si ya está disponible',()=>request()));return;}
        body.append(element('h4',model.location),element('p',model.category+' · '+model.reward+' puntos de observación por el primer acierto.'));
        if(!model.examined){body.append(button('Examinar la muestra',()=>request({op:'examine'})));return;}
        for(const clue of model.clues){const note=element('blockquote',clue.text);
          note.append(element('cite','Expediente '+clue.role));body.append(note);}
        const form=element('form');form.append(field('¿Qué has encontrado?',model.names,'name'),field('¿Qué detalle te permite reconocerlo?',model.signs,'sign'));
        const submit=element('button','Comprobar identificación');submit.type='submit';form.append(submit);
        form.addEventListener('submit',event=>{event.preventDefault();request({op:'identify',name:form.elements.namedItem('name').value,sign:form.elements.namedItem('sign').value});});
        body.append(form);
      };
      const request=async input=>{
        if(busy)return;
        busy=true;fold.setAttribute('aria-busy','true');status.textContent=input?'Comprobando la muestra…':collection?'Abriendo tus hallazgos…':'Consultando la muestra…';
        for(const item of body.querySelectorAll('button,select,input'))item.disabled=true;
        try{
          const next=await window.GameAccountBridge.request(url,input?{...input,partnerId:model?.partnerId||null}:null,input?'POST':'GET');
          if(!this.isConnected)return;
          model=next;
          draw();
          status.textContent=next.awarded?'Hallazgo guardado en tu colección. Has ganado '+next.awarded+' puntos de observación.':next.message||'';
          if(input){if(status.textContent)status.focus({preventScroll:true});else body.querySelector(mansion?'button.hallazgo-lupa':'select')?.focus({preventScroll:true});}
          if(next.awarded)this.dispatchEvent(new CustomEvent('lup-discovery',{bubbles:true,detail:{caseId:id,points:next.points}}));
        }catch(error){
          if(!this.isConnected)return;
          status.textContent=error?.message||(collection?'No se han podido cargar tus hallazgos.':'No se ha podido cargar la muestra.');
          body.replaceChildren(button('Volver a consultar',()=>request()));
        }finally{busy=false;fold.removeAttribute('aria-busy');}
      };
      fold.addEventListener('toggle',()=>{if(fold.open&&!busy)request();});
      if(collection&&new URLSearchParams(location.hash.split('?')[1]).get('ver')==='hallazgos'){
        fold.open=true;
        requestAnimationFrame(()=>{if(this.isConnected){summary.focus({preventScroll:true});summary.scrollIntoView({block:'center'});}});
      }
    }
  }
  if(!customElements.get('lup-explorador'))customElements.define('lup-explorador',ExploradorLup);
})();
