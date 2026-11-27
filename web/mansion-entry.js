(() => {
  'use strict';
  let chosen='A', letterOpen=false;
  const letter=()=>document.querySelector('.mansion-letter');
  function perspective(paper,world){
    const image=paper.querySelector('[data-mansion-threshold-image]');
    if(!image)return;
    const abandoned=world==='B';
    const url=abandoned?'/mansion-ruin-1.webp':'/mansion-room-1.webp';
    if(image.getAttribute('src')!==url)image.src=url;
    image.alt=abandoned?'La verja oxidada y las ventanas oscuras de la mansión abandonada':'La verja y las ventanas iluminadas de la mansión habitada';
    paper.querySelector('[data-mansion-threshold-note]').textContent=abandoned?'La verja está oxidada. No hay nadie tras los cristales.':'Hay luz en las ventanas. El guardián espera junto a la verja.';
    for(const button of paper.querySelectorAll('[data-mansion-world]'))button.setAttribute('aria-pressed',String(button.dataset.mansionWorld===world));
    chosen=world;
  }
  function openLetter(paper,focus) {
    if(!paper)return;
    letterOpen=true;
    paper.open=true;
    if(focus)paper.querySelector('summary').focus();
    if(focus)paper.scrollIntoView({block:'start'});
  }
  document.addEventListener('click',event=>{
    const paper=letter();
    if(!paper)return;
    if(event.target.closest('[data-mansion-letter]'))openLetter(paper,true);
    const world=event.target.closest('[data-mansion-world]');
    if(world&&paper.contains(world))perspective(paper,world.dataset.mansionWorld);
  });
  document.addEventListener('toggle',event=>{
    if(event.target.matches?.('.mansion-letter'))letterOpen=event.target.open;
  },true);
  let previous;
  function restore(){
    const paper=letter();
    if(paper===previous)return;
    previous=paper;
    if(!paper)return;
    perspective(paper,chosen);
    if(letterOpen||new URLSearchParams(location.search).get('carta')==='1')openLetter(paper,false);
  }
  const main=document.querySelector('main');
  if(main)new MutationObserver(restore).observe(main,{childList:true,subtree:true});
  restore();
})();
