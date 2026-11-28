import {createHash} from 'node:crypto';
import {SEASON_NAMES} from './progression.mjs';
import {noticeTypes} from './play-notices.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const mailKey=(type,id)=>createHash('sha256').update(type+':'+id).digest('hex');
function invitationMessage({caseId, inviterName, caseTitle}) {
  const id = Number(caseId);
  const season = Number.isInteger(id) && id >= 1 && id <= 48 ? SEASON_NAMES[Math.floor((id-1)/12)] : '';
  const game = caseTitle || (season ? `el caso ${String((id-1)%12+1).padStart(2,'0')} de ${season}` : 'un caso de La Última Pieza');
  const subject = 'Tienes una invitación para jugar a La Última Pieza';
  const paragraphs = [
    `${inviterName || 'Tu compañero'} ha elegido «En pareja» para investigar ${game} contigo.`,
    'Abre ese juego con la cuenta asociada a este correo. Si quieres participar, selecciona también «En pareja». Cuando las dos personas hayáis elegido, cada una verá un papel distinto y sus propias pistas.',
    'Necesitáis tener acceso a ese caso desde vuestras cuentas. Si es tu primera visita, puedes registrarte gratis y consultar el pase.'
  ];
  const url = 'https://www.laultimapieza.es/' + (season ? '#' + (id<=12?'valdemar-jugar':'mundos-jugar') + '?id=' + id : '#perfil?seccion=pareja');
  const action = season ? 'Abrir el juego' : 'Ver mis juegos';
  return {
    subject,
    text: [subject, ...paragraphs, action + '\n' + url].join('\n\n'),
    html: `<!doctype html><html lang="es"><body style="font:16px/1.6 Arial,sans-serif;color:#172c29"><main style="max-width:36rem;margin:auto;padding:24px"><h1 style="font-size:24px">${subject}</h1>${paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')}<p><a style="color:#134e49;font-weight:bold" href="${url}">${action}</a></p></main></body></html>`
  };
}
export function messageTemplate(type,data){
  if (type === 'case_invitation') return invitationMessage(data);
  if(type==='payment_failed'||type==='subscription_cancelled'){
    const failed=type==='payment_failed';
    const subject=failed?'Hay un pago pendiente en tu suscripción':'Has cancelado la renovación de tu suscripción';
    const lines=failed?['El cobro de una cuota de La Última Pieza ha fallado. El nuevo bloque de cuatro juegos se activa cuando se confirma el pago.',
      'Abre Suscripción para revisar el pago y el método de cobro. Tus avances y los bloques que ya has abonado siguen registrados.']:
      ['La renovación de tu suscripción a La Última Pieza está cancelada.',
        ...(Number.isSafeInteger(data.effectiveAt)?['La fecha efectiva de la baja es el '+new Date(data.effectiveAt).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'})+'.']:[]),
        'Si vuelves a suscribirte, recuperarás tus avances y se tendrán en cuenta los bloques que ya has pagado.'];
    const url='https://www.laultimapieza.es/#suscripcion';
    return {subject,text:[subject,...lines,'Ver mi suscripción',url].join('\n\n'),
      html:'<!doctype html><html lang="es"><body><h1>'+esc(subject)+'</h1>'+lines.map(line=>'<p>'+esc(line)+'</p>').join('')+'<p><a href="'+url+'">Ver mi suscripción</a></p></body></html>'};
  }
  const optionalSubjects={case_finished:'Has terminado una aventura',board_finished:'Has completado una temporada',
    pair_confirmed:'La partida en pareja está confirmada',new_challenge:'Hay un nuevo desafío en el tablero',
    inactivity:'Tu investigación te espera'};
  if(Object.hasOwn(optionalSubjects,type)){
    const id=Number(data.caseId);
    const season=SEASON_NAMES[Math.floor((id-1)/12)];
    const title=season?'el caso '+((id-1)%12+1)+' de '+season:'tu caso';
    const subject=optionalSubjects[type], body={
      case_finished:'Has guardado el desenlace de '+title+'. Su pieza ya forma parte de tu colección.',
      board_finished:'Al terminar '+title+' has reunido las doce piezas de '+season+'. Ya puedes abrir su sello y leer el epílogo.',
      pair_confirmed:'Las dos cuentas han elegido jugar juntas en '+title+'. Al abrirlo, cada persona encontrará su papel.',
      new_challenge:'Se ha publicado un desafío para '+title+'. Puedes jugarlo cuando ese caso esté abierto en tu pase.',
      inactivity:'Han pasado catorce días desde la última visita registrada. Puedes retomar tu investigación desde Mis partidas.'
    }[type];
    const route=type==='inactivity'?'archivo':type==='board_finished'||type==='case_finished'?'perfil?seccion=logros':
      type==='new_challenge'?'desafios':(id<=12?'valdemar-jugar':'mundos-jugar')+'?id='+id;
    const base='https://www.laultimapieza.es/#',prefs=base+'perfil?seccion=cuenta';
    return {subject,text:[subject,body,base+route,'Cambiar mis avisos: '+prefs].join('\n\n'),
      html:'<!doctype html><html lang="es"><body><h1>'+esc(subject)+'</h1><p>'+esc(body)+'</p><p><a href="'+base+route+'">Abrir La Última Pieza</a></p><p><a href="'+prefs+'">Cambiar mis avisos de correo</a></p></body></html>'};
  }
  const welcome=type==='welcome',date=data.periodEnd?new Date(data.periodEnd).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):'';
  const journey=data.billingPlan==='four-boards-v1';
  const subject=welcome?'Tu cuenta de La última pieza está lista':data.renewal?'Tu nuevo ciclo de La última pieza está confirmado':'Tu suscripción a La última pieza está activa';
  const lines=welcome?[
    `Hola ${data.name||'investigador'}, tu cuenta ya está verificada.`,
    'Tu perfil guardará tus partidas, tus habilidades y las piezas del plano.',
    'Crear una cuenta es gratis y no activa una suscripción. Puedes resolver la demo; para jugar los casos completos necesitas contratar el plan.',
    'Cada elección muestra los puntos que suma. Las pistas y los intentos del enigma no penalizan.'
  ]:[
    Number.isSafeInteger(data.amountPaid) && data.amountPaid > 0
      ? `Hemos confirmado el pago de ${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(data.amountPaid/100)} de tu cuota mensual.`
      : 'Hemos confirmado el pago de tu cuota mensual.',
    journey
      ? 'Esta cuota da acceso a cuatro juegos nuevos. Si aún estás jugando la temporada anterior, el bloque abonado queda reservado hasta que la completes. Las cuotas terminan al abonar el último bloque de los 48 juegos.'
      : 'Tu pase de temporada cubre cuatro juegos de tu tablero con esta cuota. Los cobros terminan al completar los bloques de tu pase contratado.',
    ...(data.renewal ? (journey?['Esta renovación incluye una llave para pedir ayuda durante la investigación.']:[])
      : ['Tu alta incluye una llave de bienvenida para pedir ayuda durante la investigación.']),
    `Tu periodo pagado termina el ${date}. Puedes continuar y repetir los casos elegidos durante ese periodo.`,
    'Puedes consultar los bloques abonados y gestionar la cancelación antes de la próxima renovación desde Mi cuenta.'
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
        if(job.type==='payment_failed'){
          const recovered=await withStore(async store=>{
            const account=await store.getMemberData(job.data.uid,{readOnly:true});
            if(!account.cycles?.some(cycle=>cycle.id===job.data.invoice))return false;
            await store.cancelMail(job.id);return true;
          });
          if(recovered)continue;
        }
        const consent=!Object.hasOwn(noticeTypes,job.type) || await withStore(async store=>{
          if(await store.noticeStillWanted(job))return true;
          await store.cancelMail(job.id);
          return false;
        });
        if(!consent)continue;
        const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:env.MAIL_FROM,to:[job.email],...messageTemplate(job.type,job.data)}),signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw new Error('PROVIDER_'+response.status);
        const result=await response.json();if(!result.id)throw new Error('PROVIDER_RESPONSE');
        await withStore(store=>store.finishMail(job.id,result.id));
      }catch(error){await withStore(store=>store.retryMail(job.id,/^PROVIDER_\d+$/.test(error.message)?error.message:'DELIVERY_UNCONFIRMED'));}
    }}finally{busy=false;}
  }};
}
