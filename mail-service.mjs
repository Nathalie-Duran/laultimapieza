import {createHash} from 'node:crypto';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const mailKey=(type,id)=>createHash('sha256').update(type+':'+id).digest('hex');
function invitationMessage({caseId, inviterName, caseTitle}) {
  const seasonNames = ['Valdemar', 'El Tablero de Ámbar', 'Umbravía', 'La Necrópolis del Sol Velado'];
  const id = Number(caseId);
  const season = Number.isInteger(id) && id >= 1 && id <= 48 ? seasonNames[Math.floor((id-1)/12)] : '';
  const game = caseTitle || (season ? `el caso ${String((id-1)%12+1).padStart(2,'0')} de ${season}` : 'un caso de La Última Pieza');
  const subject = 'Tienes una invitación para jugar a La Última Pieza';
  const paragraphs = [
    `${inviterName || 'Otra persona'} te invita a investigar ${game} en pareja.`,
    'Abre Mi cuenta con esta dirección de correo y entra en Jugar en pareja para ver la invitación. Si es tu primera visita, puedes crear tu cuenta gratis.',
    'Para jugar juntos, cada persona necesita su propia suscripción activa y tener ese juego desbloqueado. Tú decides si aceptas la invitación.'
  ];
  const url = 'https://www.laultimapieza.es/#perfil?seccion=pareja';
  const action = 'Ver mi invitación';
  return {
    subject,
    text: [subject, ...paragraphs, action + '\n' + url].join('\n\n'),
    html: `<!doctype html><html lang="es"><body style="font:16px/1.6 Arial,sans-serif;color:#172c29"><main style="max-width:36rem;margin:auto;padding:24px"><h1 style="font-size:24px">${subject}</h1>${paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')}<p><a style="color:#134e49;font-weight:bold" href="${url}">${action}</a></p></main></body></html>`
  };
}
export function messageTemplate(type,data){
  if (type === 'case_invitation') return invitationMessage(data);
  const welcome=type==='welcome',date=data.periodEnd?new Date(data.periodEnd).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):'';
  const subject=welcome?'Tu cuenta de La última pieza está lista':data.renewal?'Tu nuevo ciclo de La última pieza está confirmado':'Tu suscripción a La última pieza está activa';
  const lines=welcome?[
    `Hola ${data.name||'investigador'}, tu cuenta ya está verificada.`,
    'Tu perfil guardará tus partidas, tus habilidades y las piezas del plano.',
    'Crear una cuenta es gratis y no activa una suscripción. Puedes resolver la demo; para jugar los casos completos necesitas contratar el plan.',
    'Cada elección muestra los puntos que suma. Las pistas y los intentos del enigma no penalizan.'
  ]:[
    'Hemos confirmado el pago de 29,95 € de tu ciclo mensual.',
    'Tu pago ha desbloqueado de inmediato cuatro casos nuevos. Los pendientes se acumulan y puedes acceder a tus retos desbloqueados mientras tengas una suscripción activa.',
    `Tu periodo pagado termina el ${date}. Puedes continuar y repetir los casos elegidos durante ese periodo.`,
    'La temporada tiene un máximo de tres ciclos. Puedes gestionar la cancelación antes de la próxima renovación desde Mi cuenta.'
  ];
  const url='https://laultimapieza.es/'+(welcome?'#inicio':'#perfil');
  return {subject,text:subject+'\n\n'+lines.join('\n\n')+'\n\nEntrar: '+url+'\n\nLa última pieza · Mensaje sobre tu cuenta, sin publicidad.',html:`<!doctype html><html lang="es"><body style="margin:0;background:#0b1320;color:#e9eff5;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:32px"><p style="color:#efc17b;letter-spacing:3px">LA ÚLTIMA PIEZA</p><h1 style="font-size:28px;line-height:1.3">${esc(subject)}</h1>${lines.map(l=>`<p style="font-size:16px;line-height:1.7">${esc(l)}</p>`).join('')}<p style="margin:30px 0"><a href="${url}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#efc17b;color:#101820;text-decoration:none;font-weight:bold">Entrar en mi cuenta</a></p><p style="font-size:12px;color:#aebccc">Mensaje sobre tu cuenta, sin publicidad. No respondas con contraseñas ni datos de pago.</p></div></body></html>`};
}
export function createMailer(env=process.env,fetcher=fetch){
  const enabled=!!(env.RESEND_API_KEY&&env.MAIL_FROM&&env.MAIL_ENABLED==='true');let busy=false;
  return {enabled,async process(withStore){
    if(!enabled||busy)return;busy=true;
    try{for(let i=0;i<10;i++){
      const job=await withStore(store=>store.claimMail());if(!job)break;
      try{
        const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:env.MAIL_FROM,to:[job.email],...messageTemplate(job.type,job.data)}),signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error('PROVIDER_'+response.status);
        const result=await response.json();if(!result.id)throw new Error('PROVIDER_RESPONSE');
        await withStore(store=>store.finishMail(job.id,result.id));
      }catch(error){await withStore(store=>store.retryMail(job.id,/^PROVIDER_\d+$/.test(error.message)?error.message:'DELIVERY_UNCONFIRMED'));}
    }}finally{busy=false;}
  }};
}
