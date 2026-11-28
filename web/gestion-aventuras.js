const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=x=>JSON.stringify(x,null,2);
const motor=()=>globalThis.MotorAventuras;
const owned=()=>globalThis.ClubAccess?.state?.canManage===true;
const request=(path,data,method)=>globalThis.GameAccountBridge.request(path,data,method);
class AuthorWorkshop extends HTMLElement{
  connectedCallback(){
    if(!owned()||this.bound)return;
    this.bound=true;
    this.innerHTML='<section class="mg-panel mg-block mg-workshop"><h2>Taller de aventuras</h2><p>Crea un episodio, pruébalo y elige qué juego dará acceso a su publicación.</p><label>Aventura<select data-aw="edition"><option value="">Nueva aventura</option></select></label><p data-aw="status" role="status" aria-live="polite"></p><form><label>Título<input name="title" maxlength="150" required></label><label>Identificador del enlace<input name="slug" pattern="[a-z][a-z0-9-]{1,62}" required></label><label>Juego que da acceso<select name="caseId">'+Array.from({length:48},(_,i)=>{
      const n=i+1,game=n<=12?globalThis.ValdemarCatalog?.get(n):globalThis.Mundos?.story(n);
      return '<option value="'+n+'">'+n+' · '+safe(game?.title||'Juego '+n)+'</option>';
    }).join('')+'</select></label><details><summary>Escenas, pruebas y materiales</summary><label>Definición de la aventura (JSON)<textarea name="definition" rows="16" spellcheck="false" required></textarea></label></details><details><summary>Catálogo de mecánicas</summary><label>Buscar por nombre o familia<input type="search" data-aw="filter"></label><div data-aw="mechanics"></div></details><div class="mg-workshop-actions"><button class="mg-refresh" type="submit" value="save">Guardar borrador</button><button class="mg-refresh" type="button" data-aw="preview">Probar el borrador</button><button class="mg-refresh" type="button" data-aw="prepare">Revisar publicación</button></div><div data-aw="approval" hidden><p>La publicación abrirá este episodio a quienes tengan acceso al juego seleccionado. Las partidas empezadas conservarán su edición guardada.</p><button class="mg-refresh" type="submit" value="publish">Confirmar publicación</button></div></form><div data-aw="simulation"></div></section>';
    this.form=this.querySelector('form');
    this.select=this.querySelector('[data-aw=edition]');
    this.feedback=this.querySelector('[data-aw=status]');
    this.form.addEventListener('submit',e=>{e.preventDefault();this.save(e.submitter?.value==='publish');});
    this.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.mechanic)this.addTest(b.dataset.mechanic);
      else this.action(b.dataset.aw);
    });
    this.addEventListener('input',e=>{
      if(e.target.dataset.aw==='filter'){this.mechanics(e.target.value);return;}
      if(e.target.closest('form')){this.dirty=true;this.querySelector('[data-aw=approval]').hidden=true;this.clearPreview();}
    });
    this.select.addEventListener('change',()=>{
      if(this.dirty&&!confirm('¿Descartar los cambios sin guardar y abrir otra aventura?')){this.select.value=this.activeId;return;}
      this.open(this.select.value);
    });
    this.reset();this.list();
  }
  disconnectedCallback(){this.serial=(this.serial||0)+1;}
  reset(){
    this.version=0;this.revision=0;this.form.inert=false;
    this.put(motor().plantilla(),1);
    this.feedback.textContent='';
  }
  put(def,caseId){
    this.dirty=false;this.activeId=this.version?def.id:'';
    this.form.elements.slug.value=def.id;this.form.elements.slug.readOnly=this.version>0;
    this.form.elements.title.value=def.titulo;this.form.elements.caseId.value=caseId;
    this.form.elements.caseId.disabled=!!this.revision;
    this.form.elements.definition.value=pretty(def);this.querySelector('[data-aw=approval]').hidden=true;this.clearPreview();
    this.mechanics(this.querySelector('[data-aw=filter]').value||'');
  }
  definition(){
    const def=JSON.parse(this.form.elements.definition.value);
    def.titulo=this.form.elements.title.value.trim();def.id=this.form.elements.slug.value.trim();
    const errors=motor().validar(def);
    if(errors.length)throw Error(errors.join(' · '));
    return def;
  }
  async list(select){
    const token=this.serial;
    try{
      const {aventuras}=await request('/api/admin/aventuras');
      if(!this.isConnected||!owned()||token!==this.serial)return;
      this.select.innerHTML='<option value="">Nueva aventura</option>'+aventuras.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.titulo)+(x.revision?' · publicada':' · borrador')+'</option>').join('');
      if(select)this.select.value=select;
    }catch(e){if(this.isConnected)this.feedback.textContent=e.message;}
  }
  async open(id){
    const token=this.serial=(this.serial||0)+1;
    if(!id){this.reset();return;}
    this.form.inert=true;
    try{
      const item=await request('/api/admin/aventuras/'+encodeURIComponent(id));
      if(!this.isConnected||!owned()||token!==this.serial)return;
      this.version=item.version;this.revision=item.revision;this.put(item.definition,item.caseId);
      this.feedback.textContent=item.revision?'Edición publicada '+item.revision+'.':'Borrador privado.';
    }catch(e){if(token===this.serial)this.feedback.textContent=e.message;}
    finally{if(token===this.serial)this.form.inert=false;}
  }
  async save(publish){
    if(!owned()||this.saving)return;
    try{
      const definition=this.definition(),id=definition.id;
      this.saving=true;this.form.inert=true;this.select.disabled=true;
      const saved=await request('/api/admin/aventuras/'+encodeURIComponent(id),{definition,caseId:Number(this.form.elements.caseId.value),version:this.version,publish},'PUT');
      if(!this.isConnected||!owned())return;
      this.version=saved.version;this.revision=saved.revision;this.put(saved.definition,saved.caseId);
      this.feedback.textContent=publish?'Aventura publicada.':'Borrador guardado.';
      if(publish){const a=document.createElement('a');a.href='/#aventura?juego='+encodeURIComponent(id);a.textContent='Abrir aventura';this.feedback.append(' ',a);}
      await this.list(id);
    }catch(e){this.feedback.textContent=e.message;}
    finally{this.saving=false;this.form.inert=false;this.select.disabled=false;}
  }
  mechanics(filter){
    const q=filter.trim().toLocaleLowerCase('es');
    const items=motor().catalogo.filter(x=>(x.nombre+' '+x.familia+' '+x.id).toLocaleLowerCase('es').includes(q));
    let defs={};try{defs=JSON.parse(this.form.elements.definition.value);}catch{}
    const scenes=(defs.escenas||[]).map(s=>'<option value="'+safe(s.id)+'">'+safe(s.titulo||s.id)+'</option>').join('');
    this.querySelector('[data-aw=mechanics]').innerHTML='<label>Escena de destino<select data-aw="scene">'+scenes+'</select></label>'+(
      items.map(x=>'<details><summary>'+safe(x.nombre)+' · '+safe(x.familia)+'</summary><p>'+safe(x.descripcion)+'</p><code>'+safe(x.id)+'</code><pre>'+safe(pretty(x.ejemplo?.parametros||{}))+'</pre><button type="button" class="mg-refresh" data-mechanic="'+safe(x.id)+'">Añadir esta prueba</button></details>').join('')||'<p>No hay coincidencias.</p>');
  }
  addTest(id){
    try{
      const def=this.definition(),scene=def.escenas.find(s=>s.id===this.querySelector('[data-aw=scene]').value);
      if(!scene)throw Error('Elige una escena de destino.');
      const test=motor().plantillaPrueba(id),base=test.id;
      let n=2;while(scene.acciones.some(a=>a.id===test.id))test.id=base+'-'+n++;
      scene.acciones.push(test);
      const errors=motor().validar(def);if(errors.length)throw Error(errors.join(' · '));
      this.form.elements.definition.value=pretty(def);this.dirty=true;this.clearPreview();this.querySelector('[data-aw=approval]').hidden=true;
      this.feedback.textContent='Prueba añadida a '+scene.titulo+'. Guarda el borrador para conservarla.';
    }catch(e){this.feedback.textContent=e.message;}
  }
  clearPreview(){this.preview=null;this.querySelector('[data-aw=simulation]').replaceChildren();}
  simulate(){
    const {def,estado,papel}=this.preview,v=motor().vista(def,estado,papel);
    const div=this.querySelector('[data-aw=simulation]');
    div.innerHTML='<h3>Prueba del borrador</h3><p>'+safe(v.escena.titulo)+' · Papel '+papel+'</p><p>'+safe(v.escena.texto)+'</p>'+(estado.completada?'<p>Aventura completada.</p>':'<label>Acción<select data-aw="move">'+v.acciones.map(a=>'<option value="'+safe(a.id)+'">'+safe(a.titulo)+'</option>').join('')+'</select></label><label>Respuesta de prueba (JSON)<textarea data-aw="attempt" rows="2">null</textarea></label><button class="mg-refresh" data-aw="step" type="button">Ejecutar acción</button> <button class="mg-refresh" data-aw="switch" type="button">Cambiar de papel</button>');
  }
  action(type){
    if(!type||!owned())return;
    try{
      if(type==='prepare'){this.definition();this.querySelector('[data-aw=approval]').hidden=false;}
      if(type==='preview'){const def=this.definition();this.preview={def,estado:motor().iniciar(def,'solo'),papel:'A'};this.simulate();}
      if(type==='switch'&&this.preview){this.preview.papel=this.preview.papel==='A'?'B':'A';this.simulate();}
      if(type==='step'&&this.preview){
        const p=this.preview,v=motor().vista(p.def,p.estado,p.papel);
        const result=motor().ejecutar(p.def,p.estado,{escena:v.escena.id,accion:this.querySelector('[data-aw=move]').value,papel:p.papel,intento:JSON.parse(this.querySelector('[data-aw=attempt]').value)});
        p.estado=result.estado;this.simulate();this.feedback.textContent=result.mensaje;
      }
    }catch(e){this.feedback.textContent=e.message;}
  }
}
if(!customElements.get('author-workshop'))customElements.define('author-workshop',AuthorWorkshop);
