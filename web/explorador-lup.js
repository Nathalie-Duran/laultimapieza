(() => {
  'use strict';
  const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const button=(label,handler)=>{const node=element('button',label);node.type='button';node.addEventListener('click',handler);return node;};
  class ExploradorLup extends HTMLElement {
    connectedCallback(){
      if(this.firstElementChild)return;
      const collection=this.hasAttribute('collection');
      const id=Number(this.getAttribute('case-id'));
      if(!collection&&(!Number.isInteger(id)||id<1||id>48))return;
      if(!document.querySelector('link[data-lup-explorador]')){
        const style=document.createElement('link');style.rel='stylesheet';style.href='/explorador-lup.css';
        style.setAttribute('data-lup-explorador','');document.head.append(style);
      }
      const url='/api/valdemar/explorer'+(collection?'':'/'+id);
      const fold=element('details'),summary=element('summary',collection?'Colección del Explorador LUP':'Explorador LUP');
      const body=element('div'),status=element('p');status.setAttribute('role','status');status.tabIndex=-1;
      fold.append(summary,body,status);this.append(fold);
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
          if(!model.total)body.append(element('p','Examina una muestra durante una partida e identifícala para empezar tu colección.'));
          else for(const entry of model.entries)body.append(card(entry));
          return;
        }
        if(model.discovery){body.append(card(model.discovery));return;}
        if(model.locked){body.append(element('p','La muestra se puede examinar al llegar a la etapa '+model.stage+'.'),
          button('Comprobar el avance',()=>request()));return;}
        body.append(element('h4',model.location),element('p',model.category+' · '+model.reward+' puntos de observación por identificar la muestra.'));
        if(!model.examined){body.append(button('Examinar la muestra',()=>request({op:'examine'})));return;}
        for(const clue of model.clues){const note=element('blockquote',clue.text);
          note.append(element('cite','Cuaderno '+clue.role));body.append(note);}
        const form=element('form');form.append(field('Identificación',model.names,'name'),field('Rasgo que la justifica',model.signs,'sign'));
        const submit=element('button','Registrar descubrimiento');submit.type='submit';form.append(submit);
        form.addEventListener('submit',event=>{event.preventDefault();request({op:'identify',name:form.elements.namedItem('name').value,sign:form.elements.namedItem('sign').value});});
        body.append(form);
      };
      const request=async input=>{
        if(busy)return;
        busy=true;fold.setAttribute('aria-busy','true');status.textContent=input?'Guardando observación…':'Consultando el cuaderno…';
        for(const item of body.querySelectorAll('button,select'))item.disabled=true;
        try{
          const next=await window.GameAccountBridge.request(url,input?{...input,partnerId:model?.partnerId||null}:null,input?'POST':'GET');
          if(!this.isConnected)return;
          model=next;
          draw();
          status.textContent=next.awarded?'Descubrimiento guardado. Has obtenido '+next.awarded+' puntos de observación.':next.message||'';
          if(input){if(status.textContent)status.focus({preventScroll:true});else body.querySelector('select')?.focus({preventScroll:true});}
          if(next.awarded)this.dispatchEvent(new CustomEvent('lup-discovery',{bubbles:true,detail:{caseId:id,points:next.points}}));
        }catch(error){
          if(!this.isConnected)return;
          status.textContent=error?.message||'No se ha podido recuperar el cuaderno.';
          body.replaceChildren(button('Volver a consultar',()=>request()));
        }finally{busy=false;fold.removeAttribute('aria-busy');}
      };
      fold.addEventListener('toggle',()=>{if(fold.open&&!busy)request();});
    }
  }
  if(!customElements.get('lup-explorador'))customElements.define('lup-explorador',ExploradorLup);
})();
