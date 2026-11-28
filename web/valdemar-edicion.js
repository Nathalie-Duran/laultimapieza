(() => {
  'use strict';
  const release='valdemar-s1-v1';
  function view() {
    return `<section class="account-card release-editor" aria-labelledby="edicion-titulo">
      <a class="text-link" href="#gestion?seccion=edicion">Volver a Edición</a>
      <h1 id="edicion-titulo">Publicar Valdemar</h1>
      <form id="valdemar-release-form"><label class="field">Archivo de publicación de la temporada (JSON)
        <input type="file" name="edicion" accept=".json,application/json" required></label>
        <div class="release-actions"><button class="button primary" type="submit" disabled>Activar la edición</button>
        <a class="text-link" href="#casos">Ver las doce historias</a></div>
        <p role="status" aria-live="polite"></p>
      </form></section>`;
  }
  function mount(bridge){
    const form=document.getElementById('valdemar-release-form');
    if(!form||form.dataset.bound)return;
    form.dataset.bound='true';
    const input=form.elements.edicion,button=form.querySelector('button'),status=form.querySelector('[role=status]');
    input.addEventListener('change',()=>{
      const file=input.files[0];
      button.disabled=!file||file.size>4096;
      status.textContent=file&&file.size>4096?'El archivo debe ser el JSON de publicación de esta temporada (4 KB como máximo).':'';
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(button.disabled)return;
      const file=input.files[0];
      if(!file||file.size>4096){status.textContent='Selecciona el archivo de publicación JSON de esta temporada.';return;}
      button.disabled=true;
      input.disabled=true;
      try{
        let descriptor;
        try{descriptor=JSON.parse(await file.text());}catch{throw Error('El archivo debe ser un JSON de publicación válido.');}
        if(descriptor?.release!==release || typeof descriptor.key!=='string' || !/^[a-zA-Z0-9_-]{43}$/.test(descriptor.key))throw Error('Este archivo no corresponde a la edición de Valdemar.');
        status.textContent='Activando los expedientes…';
        const result=await bridge.request('/api/admin/valdemar-release',{release,key:descriptor.key},'POST');
        if(result.active!==true||result.release!==release)throw Error('No se ha confirmado la activación.');
        status.textContent='Temporada activa. Los doce expedientes ya están disponibles según el acceso de cada cuenta.';
      }catch(error){status.textContent=error.message||'No se pudo activar la edición.';}
      finally{input.value='';input.disabled=false;button.disabled=true;}
    });
  }
  window.ValdemarEdicion={view,mount};
})();
