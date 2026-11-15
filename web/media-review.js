(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function steps(artifact){
  const text=artifact.transcript||'';
  if(artifact.generation?.storyboard?.length)return [{title:'Registro completo',text},...artifact.generation.storyboard.map(x=>({title:x.seconds.join('–')+' s',text:x.action}))];
  return text.split(/\n+|(?=Segundo \d+:)|(?=(?<!\S)\d+–\d+(?: segundos)?:)/).filter(x=>x.trim()).map((text,i)=>({title:'Registro '+String(i+1).padStart(2,'0'),text:text.trim()}));
}
function sequence(artifact){return `<section class="evidence-sequence" aria-label="Secuencia de pruebas"><p class="sequence-intro">Documento visual de ficción · Lee cada registro y compara sus horas y referencias. No necesitas reproducir un vídeo.</p><ol>${steps(artifact).map((step,i)=>`<li><div class="sequence-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><div><h4>${esc(step.title)}</h4><p>${esc(step.text)}</p></div></li>`).join('')}</ol></section>`;}
// Playback failure is visible and has a usable, readable alternative.
document.addEventListener('error',event=>{const el=event.target;if(!['AUDIO','VIDEO'].includes(el?.tagName))return;const card=el.closest('.media-card');if(!card||card.querySelector('.media-error'))return;const note=document.createElement('p');note.className='media-error';note.setAttribute('role','status');note.textContent='No se ha podido cargar este medio. La transcripción completa está disponible debajo y permite resolver la misma pista.';el.after(note);const transcript=card.querySelector('details');if(transcript)transcript.open=true;},true);
document.addEventListener('play',event=>{if(!['AUDIO','VIDEO'].includes(event.target?.tagName))return;document.querySelectorAll('audio,video').forEach(el=>{if(el!==event.target)el.pause();});},true);
root.MediaReview={steps,sequence};
})(globalThis);
