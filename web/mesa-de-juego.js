(() => {
  'use strict';
  const mounted=new WeakMap();
  function element(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text)node.textContent=text;
    return node;
  }
  function write(node,text){
    const value=typeof text==='string'?text.trim():'';
    if(node.textContent!==value)node.textContent=value;
    node.hidden=!value;
  }
  function mount(host,initial={}){
    mounted.get(host)?.destroy();
    let state={},disposed=false;
    const root=element('section','mesa-juego'),body=element('div','mj-reading'),progress=element('p','mj-progress');
    const objective=element('div','mj-objective'),label=element('span','mj-label','Objetivo actual'),goal=element('p','mj-goal');
    const saved=element('small','mj-save'),tutorial=element('details','mj-tutorial'),lesson=element('p','mj-lesson');
    tutorial.append(element('summary',null,'Guía de la primera prueba'),lesson);
    let dock=null,lastLesson='';
    const result=element('p','mj-result'),actions=element('div','mj-actions'),tools=element('div','mj-tools');
    const next=element('button','mj-next'),guide=element('a','mj-help','Cómo se juega');
    next.type='button';guide.href='/#como-se-juega';guide.target='_blank';guide.rel='noopener';
    result.setAttribute('role','status');result.setAttribute('aria-live','polite');
    tools.setAttribute('role','group');tools.setAttribute('aria-label','Herramientas de juego');
    const controls=new Map();
    objective.append(label,goal);body.append(progress,objective,saved,result);actions.append(tools,next,guide);
    root.append(body,actions,tutorial);host.replaceChildren(root);
    next.addEventListener('click',()=>{state.next?.run?.();});
    guide.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||typeof window.ComoSeJuega?.open!=='function')return;
      event.preventDefault();
      const help=state.help&&typeof state.help==='object'?state.help:{};
      window.ComoSeJuega.open(guide,{...help,context:help.context||state.family||'temporada'});
    });
    function update(values={}){
      if(disposed)return;
      state={...state,...values};
      root.dataset.family=state.family||'temporada';
      root.setAttribute('aria-label',state.title?'Mesa de juego · '+state.title:'Mesa de juego');
      if(typeof state.accent==='string'&&/^#[\da-f]{6}$/i.test(state.accent))root.style.setProperty('--mj-accent',state.accent);
      else root.style.removeProperty('--mj-accent');
      write(progress,state.progress);write(goal,state.objective);objective.hidden=goal.hidden;
      write(saved,state.saved);write(lesson,state.tutorial);tutorial.hidden=lesson.hidden;
      if(state.tutorial!==lastLesson){tutorial.open=!!state.tutorial;lastLesson=state.tutorial;}
      write(result,state.result);body.hidden=(dock||progress.hidden&&objective.hidden&&saved.hidden)&&result.hidden;
      root.classList.toggle('mj-compact',body.hidden);
      const available=(Array.isArray(state.tools)?state.tools:[]).filter(tool=>tool?.id&&tool.label&&typeof tool.run==='function');
      const wanted=new Set(available.map(tool=>tool.id));
      for(const [id,node] of controls)if(!wanted.has(id)){node.remove();controls.delete(id);}
      for(const [index,tool] of available.entries()){
        let node=controls.get(tool.id);
        if(!node){
          node=element('button','mj-tool');node.type='button';node.dataset.tool=tool.id;
          node.addEventListener('click',()=>state.tools?.find(item=>item.id===tool.id)?.run?.());
          controls.set(tool.id,node);
        }
        if(node.textContent!==tool.label)node.textContent=tool.label;
        if(typeof tool.selected==='boolean')node.setAttribute('aria-pressed',String(tool.selected));
        else node.removeAttribute?.('aria-pressed');
        if(tools.children[index]!==node)tools.insertBefore(node,tools.children[index]||null);
      }
      tools.hidden=available.length===0;
      write(next,typeof state.next?.run==='function'?state.next.label:'');
      guide.hidden=state.help===false;
      actions.hidden=tools.hidden&&next.hidden&&guide.hidden;
      root.hidden=body.hidden&&actions.hidden&&tutorial.hidden;
    }
    function dockObjective(target){
      if(dock===target)return;
      if(dock)dock.hidden=true;
      dock=target;
      if(target){target.append(progress,objective,saved);target.hidden=false;}
      else{body.insertBefore(progress,result);body.insertBefore(objective,result);body.insertBefore(saved,result);}
      update();
    }
    const handle={update,dockObjective,destroy(){
      if(disposed)return;
      disposed=true;mounted.delete(host);if(dock)dock.remove();root.remove();controls.clear();state={};
    }};
    mounted.set(host,handle);update(initial);return handle;
  }
  window.MesaDeJuego=Object.freeze({mount});
})();
