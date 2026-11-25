(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=t=>new Date(t).toLocaleDateString('es-ES',{day:'numeric',month:'long',timeZone:'Europe/Madrid'});
function allowed(story,m){
 const membership=m.membership||{};
 if(membership.role==='admin')return true;
 if(membership.ownAccess&&(story.season!==1||membership.calendar?.unlockedCaseIds?.includes(story.id)))return true;
 return (m.sessions||[]).some(s=>s.caseId===story.id&&s.members.some(x=>x.userId===m.userId)&&membership.guestOwners?.includes(s.ownerId));
}
function label(story,m){if(allowed(story,m))return '';const block=Math.ceil(story.episode/4);return `<span class="case-lock" aria-label="Caso bloqueado"><span aria-hidden="true">🔒</span> ${m.membership?.calendar?.unlockedCaseIds?.includes(story.id)?'Requiere suscripción activa':story.season===1?'Incluido en el '+(['primer','segundo','tercer'][block-1]||block)+' mes':'Requiere suscripción activa'}</span>`;}
function summary(m){
 const membership=m.membership||{},calendar=membership.calendar;
 if(membership.role==='admin')return '<section class="release-calendar"><span class="ui-kicker">ADMINISTRADORA</span><h2>Los trece retos disponibles.</h2><p>Tu acceso de revisión es completo y no depende de una suscripción. Los jugadores reciben cuatro casos de temporada con cada pago mensual.</p></section>';
 if(!m.stories||!calendar?.currentCaseIds?.length||!membership.ownAccess)return '<section class="release-calendar"><span class="ui-kicker">CUATRO CASOS CON CADA PAGO</span><h2>Cuatro misterios, disponibles desde el primer día.</h2><p>El primer pago abre los casos 01–04; el segundo, 05–08; el tercero, 09–12. Los pendientes se acumulan. Puedes acceder a tus retos desbloqueados mientras tengas una suscripción activa.</p><p>Los casos con candado pertenecen a bloques aún no pagados o requieren reactivar el acceso. Tu progreso se conserva.</p></section>';
 const done=new Set((m.journey?.stops||[]).filter(s=>s.completed).map(s=>s.caseId));
 const current=calendar.currentCaseIds,solved=current.filter(id=>done.has(id)).length;
 const pending=(calendar.unlockedCaseIds||[]).filter(id=>!current.includes(id)&&!done.has(id)).length;
 return `<section class="monthly-progress" aria-label="Progreso de los cuatro casos del mes"><div><span class="ui-kicker">TU BLOQUE MENSUAL ${calendar.currentCycle} · ${date(calendar.currentStart)} — ${date(calendar.currentEnd)}</span><h2>Resueltos este mes: <strong>${solved} de 4</strong></h2><progress value="${solved}" max="4" aria-label="Casos resueltos de tu bloque mensual">${solved} de 4</progress><p>Los cuatro casos están disponibles desde el pago. Cuenta como resuelto cuando terminas la historia y resuelves su enigma.</p></div><ul>${current.map(id=>{const story=(m.stories||[]).find(s=>s.id===id);const stop=m.journey?.stops?.find(s=>s.caseId===id);return `<li><span aria-hidden="true">${done.has(id)?'✓':'○'}</span> <b>${esc(story?.title||id)}</b><small>${done.has(id)?'Resuelto':stop?.status==='in_progress'?'En curso':stop?.status==='needs_solution'?'Falta resolver el enigma':'Por empezar'}</small></li>`;}).join('')}</ul><p>${pending?`Además, tienes ${pending} ${pending===1?'caso pendiente':'casos pendientes'} de bloques anteriores. `:''}Puedes acceder a tus retos desbloqueados mientras mantengas una suscripción activa.</p></section>`;
}
root.MonthlyAccess={allowed,label,summary};
})(globalThis);
