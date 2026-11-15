(function(root){
'use strict';
const skills=[['inteligencia','Inteligencia','Cruza pruebas y comprueba datos.'],['perspicacia','Perspicacia','Detecta detalles y contradicciones.'],['romanticismo','Romanticismo','Cuida los vínculos de los personajes.'],['empatia','Empatía','Escucha necesidades y respeta sus límites.'],['creatividad','Creatividad','Propón otra forma de resolver la situación.'],['valentia','Valentía','Asume una decisión y sus consecuencias.']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function best(story,key,node=story.startNode,duo=false,trail=new Set()){
  if(story.endings[node]||!story.nodes[node]?.choices?.length)return {points:0,route:[]};
  if(trail.has(node))throw new Error('El recorrido contiene un ciclo');
  const nextTrail=new Set(trail).add(node),choices=story.nodes[node].choices;
  const preference=choices.reduce((a,b)=>(b.effects?.[key]||0)>(a.effects?.[key]||0)?b:a);
  return choices.map(choice=>{const own=duo?preference:choice,next=best(story,key,choice.next,duo,nextTrail);return {points:(own.effects?.[key]||0)+next.points,route:[{label:own.label,points:own.effects?.[key]||0,agreed:choice.label},...next.route]};}).reduce((a,b)=>b.points>a.points?b:a);
}
function chips(choice){return `<span class="choice-points" aria-label="Puntos de tu primera elección">${skills.filter(([k])=>choice.effects?.[k]).map(([k,label])=>`<span>${choice.effects[k]>0?'+':''}${choice.effects[k]} ${label}</span>`).join('')}</span>`;}
function panel(story,session,userId){
  const duo=session?.mode==='duo',member=session?.members?.find(m=>m.userId===userId),scores=member?.scores||{},pending=session?.firstVoteEffects?.[userId],node=session?.nodeId||story.startNode;
  const rows=skills.map(([key,label,tip])=>{
    const max=best(story,key,story.startNode,duo),remaining=best(story,key,node,duo);
    let reachable=(scores[key]||0)+remaining.points;
    if(pending&&story.nodes[node]?.choices){const choices=story.nodes[node].choices;reachable=(scores[key]||0)+(pending[key]||0)+Math.max(...choices.map(c=>best(story,key,c.next,duo).points));}
    return {key,label,tip,max,reachable,points:scores[key]||0};
  });
  return `<section class="score-guide" aria-label="Cómo conseguir puntos"><span class="ui-kicker">TUS HABILIDADES EN ESTE RETO</span><h2>Cada elección tiene puntos visibles.</h2><p>Antes de pulsar verás qué habilidades suma cada opción. Cada decisión completada reparte <strong>3 puntos</strong>; para potenciar una habilidad, compara su cifra en las dos opciones. Las rutas siguientes muestran el máximo individual de cada habilidad.</p><div class="score-rules"><p><strong>Qué cuenta:</strong> tu primera elección en cada escena. En pareja, los puntos se guardan cuando acordáis el camino; cambiar el voto no cambia tu primera preferencia.</p><p><strong>Penalizaciones: ninguna.</strong> Pedir pistas, equivocarte en el enigma, consultar documentos, parar o tardar más no resta puntos. Leer o repetir un audio tampoco suma puntos. Resolver el enigma recupera la pieza, sin puntos extra de habilidades.</p></div><div class="score-table-wrap"><table><caption>${esc(story.title)} · puntos de esta partida${duo?' en pareja':''}</caption><thead><tr><th>Habilidad</th><th>Conseguidos</th><th>Máximo del reto</th><th>Aún puedes terminar con</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r.label}</th><td>${r.points}</td><td>${r.max.points||'No puntúa'}</td><td>${r.reachable}</td></tr>`).join('')}</tbody></table></div><p class="micro">Los máximos son por habilidad y no se pueden sumar como objetivo conjunto: elegir una opción deja otras fuera. El perfil acumula los puntos de tus partidas; esta tabla mide solo este reto. ${duo?'En pareja, la ruta acordada puede diferir de tu primera elección.':''}</p><details><summary>Cómo alcanzar cada máximo · revela nombres de decisiones</summary>${rows.filter(r=>r.max.points).map(r=>`<details><summary>${r.label}: hasta ${r.max.points} puntos</summary><p>${r.tip} Ruta desde el principio; una partida ya avanzada puede tener un máximo menor.</p><ol>${r.max.route.map(x=>`<li>${esc(x.label)} <strong>+${x.points}</strong>${duo&&x.agreed!==x.label?`<small>Después, acordad «${esc(x.agreed)}» para seguir esta ruta.</small>`:''}</li>`).join('')}</ol></details>`).join('')}</details>${pending?'<p class="score-first-choice" role="status">Tu primera preferencia de esta escena ya está registrada. Cambiar el voto sirve para acordar el camino, sin sustituir sus puntos.</p>':''}</section>`;
}
root.ScoringGuide={best,chips,panel,skills};
})(globalThis);
