(() => {
  'use strict';

  const names={solo:'En solitario',duo:'En pareja'};
  const papers={A:'Papel 1',B:'Papel 2'};
  function element(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text)node.textContent=text;
    return node;
  }
  function group(label,attribute,options,choose) {
    const set=element('div','gm-options');
    set.setAttribute('role','group');set.setAttribute('aria-label',label);
    for(const [value,name] of Object.entries(options)) {
      const button=element('button','gm-option',name);button.type='button';
      button.dataset[attribute]=value;button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>choose(value));set.append(button);
    }
    return set;
  }
  function create(frame,story,initial,save,onPaper) {
    let mode=Object.hasOwn(names,initial)?initial:null, paper='A', pending=false,disposed=false;
    const views=[];
    function setPaper(next) {
      if(mode!=='duo'||!Object.hasOwn(papers,next))return;
      paper=next;
      display();
      applyPapers();
    }
    async function choose(next) {
      if(disposed||pending||next===mode||!Object.hasOwn(names,next))return;
      pending=true;display('Guardando modalidad…');
      let feedback='';
      try {
        const result=await save(next);
        if(disposed)return;
        if(result?.mode!==next)throw Error('Vuelve a elegir la modalidad para guardarla.');
        mode=next;
      } catch(error) {
        feedback=error.message||'No se ha podido guardar la modalidad. Vuelve a intentarlo.';
      } finally {
        if(!disposed){pending=false;display(feedback);applyPapers();}
      }
    }
    function panel(box) {
      const options=group('Modalidad de la partida','mode',names,choose);
      const description=element('p','gm-description');
      const role=group('Papel en esta pantalla','paper',papers,setPaper);
      const instruction=element('p','gm-instruction');
      const notes=element('details','gm-solo-notes'),tasks=element('ol');
      for(const text of story.roles||[])tasks.append(element('li',null,text));
      notes.append(element('summary',null,'Ver tus dos tareas'),tasks);
      const status=element('p','gm-status');status.setAttribute('role','status');
      box.append(options,description,role,instruction,notes,status);
      views.push({box,options,description,role,instruction,notes,status});
    }
    const entry=element('section','gm-entry'),heading=element('h2','gm-label','¿Cómo jugáis?');
    entry.setAttribute('aria-label','Elegir la modalidad de la partida');entry.append(heading);panel(entry);
    const change=element('details','gm-change'),summary=element('summary');
    change.append(summary);const inner=element('div','gm-change-body');change.append(inner);panel(inner);

    function display(message='') {
      frame.dataset.playMode=mode||'pending';frame.dataset.playPaper=mode==='duo'?paper:'all';
      summary.textContent=mode?'Cambiar modalidad · '+names[mode]:'Elegir modalidad';
      for(const view of views) {
        view.options.setAttribute('aria-busy',String(pending));
        for(const b of view.options.children) {
          b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
          b.setAttribute('aria-disabled',String(pending));
        }
        view.description.textContent=mode==='duo'?'Compartid la pantalla. Cada uno lee las pistas de su papel y le cuenta al otro qué ha descubierto.':
          mode==='solo'?'Tienes reunidas las pistas de los dos papeles en la misma mesa.':'Podéis cambiar de modalidad durante la investigación.';
        view.role.hidden=mode!=='duo';
        view.notes.hidden=mode!=='solo'||!story.roles?.length;
        for(const b of view.role.children)b.setAttribute('aria-pressed',String(b.dataset.paper===paper));
        const note=mode==='duo'&&story.roles?.[paper==='A'?0:1];
        view.instruction.hidden=!note;view.instruction.textContent=note||'';
        view.status.textContent=message;
      }
    }
    function applyPapers() {
      if(!mode)return;
      window.ValdemarHour.filterByRole(frame,mode==='duo'?paper:'');
      onPaper?.(mode==='duo'?paper:'');
    }
    function clicked(event) {
      const button=event.target.closest('button[data-vhour-role]');
      if(button && mode==='duo')setPaper(button.dataset.vhourRole);
    }
    frame.addEventListener('click',clicked);
    const observer=new MutationObserver(records=>{
      if(!mode)return;
      for(const record of records)for(const node of record.addedNodes) {
        if(node.nodeType===1 && (node.matches('.vhour-shelf')||node.querySelector('.vhour-shelf'))){
          applyPapers();return;
        }
      }
    });
    display();
    return {entry,change,setPaper,get mode(){return mode;},
      mount(){applyPapers();observer.observe(frame,{childList:true,subtree:true});},
      destroy(){disposed=true;observer.disconnect();frame.removeEventListener('click',clicked);}
    };
  }
  window.ModalidadJuego=Object.freeze({create});
})();
