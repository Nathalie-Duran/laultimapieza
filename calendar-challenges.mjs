import {createHash} from 'node:crypto';
import {normalizeChallengeSchedule} from './challenge-schedule.mjs';

const madridDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const dayMs=86_400_000;
const compass=['norte','este','sur','oeste'];
const halls=['del Reloj','del Río','de la Hiedra','del Sol'];
const delivery=['un reloj de bolsillo','una brújula de río','un farol verde','un disco de cobre'];

function seed(text){return createHash('sha256').update(text).digest().readUInt32BE();}
function editionId(key){
  const hex=createHash('sha256').update('lup-calendar/v1/'+key).digest('hex');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
function question(prompt,alternatives,correct,explanation,draw){
  const options=[...alternatives], offset=draw%options.length;
  options.push(...options.splice(0,offset));
  if((draw&8)!==0)options.reverse();
  return {prompt,options,answer:options.indexOf(correct),explanation};
}
function numberQuestion(prompt,value,unit,explanation,draw){
  const choices=[value-1,value+2,value,value+1].map(n=>String(n)+unit);
  return question(prompt,choices,String(value)+unit,explanation,draw);
}
function withEvidence(stage,materials){
  const objective=stage.prompt.slice(stage.prompt.lastIndexOf('¿'));
  return {...stage,objective,materials:materials.map(([label,photo,text])=>({label,photo:'/'+photo+'.webp',text}))};
}
function time(value){
  return String(Math.floor(value/60)%24).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
function daily(day,draw){
  const n=3+(draw%8), start=8*60+11+draw%28, trip=12+n, stop=3+draw%6;
  const bearing=draw%4,quarter=1+draw%3,side=compass[(bearing+quarter)%4];
  switch(day%4){
    case 0: {
      const arrival=start+trip+stop;
      return ['El sello de llegada',withEvidence(
        question('El tren salió de Valdemar a las '+time(start)+'. Circuló '+trip+' minutos e hizo una parada de '+stop+' minutos. ¿Qué hora debe marcar el sello de llegada?',[-3,2,0,4].map(delta=>time(arrival+delta)),time(arrival),'Suma al horario de salida tanto el viaje como la parada.',draw),
        [
          ['Billete de salida','sala-relojero','El reloj de la estación marcaba las '+time(start)+'.'],
          ['Parte del trayecto','prueba-registro',trip+' minutos en marcha y '+stop+' minutos de parada.']
        ]
      )];
    }
    case 1:{
      const height=21+((draw>>>5)%6),rise=2+((draw>>>10)%4);
      return ['La baliza del estuario',withEvidence(
        numberQuestion('Una baliza tiene '+height+' marcas. El agua cubría '+n+' y la marea ha subido '+rise+' marcas. ¿Cuántas marcas quedan al aire?',height-n-rise,' marcas','Resta de la altura total todas las marcas que quedan bajo el agua.',draw),
        [
          ['Escala de la baliza','prueba-registro','La escala tiene '+height+' marcas en total. Al comenzar, '+n+' estaban bajo el agua.'],
          ['Parte de mareas','c87-registro','El nivel ha subido '+rise+' marcas desde la última lectura.']
        ]
      )];
    }
    case 2:{
      const long=2+draw%4,short=2+n,beats=2*long+short;
      return ['El eco de las escaleras',withEvidence(
        numberQuestion('El farol del pueblo repite '+long+' destellos largos y '+short+' cortos. Cada largo ocupa dos pulsos y cada corto uno. ¿Cuántos pulsos ocupa el mensaje?',beats,' pulsos','Cuenta dos pulsos por cada destello largo y uno por cada corto.',draw),
        [
          ['Registro del vigía','umbravia-farol','El vigía anotó '+long+' destellos largos y '+short+' cortos.'],
          ['Clave del farol','prueba-documento','Un destello largo ocupa dos pulsos. Cada destello corto ocupa uno.']
        ]
      )];
    }
    default:
      return ['La sombra del disco',withEvidence(
        question('En el patio del templo, la muesca apunta al '+compass[bearing]+'. Gira el disco '+quarter+(quarter===1?' cuarto de vuelta':' cuartos de vuelta')+' en el sentido de las agujas del reloj. ¿Hacia dónde apunta ahora?',compass,side,'Recorre norte, este, sur y oeste en el sentido indicado.',draw),
        [
          ['Muesca de partida','prueba-registro','En la primera lectura la muesca apunta al '+compass[bearing]+'.'],
          ['Instrucciones del disco','prueba-documento','Avanza '+quarter+(quarter===1?' cuarto de vuelta':' cuartos de vuelta')+' en el sentido de las agujas del reloj. El orden es norte, este, sur y oeste.']
        ]
      )];
  }
}

function weekly(draw){
  const hall=draw%4, slips=3+draw%6, packs=2+draw%3, loose=1+draw%2, total=slips*packs+loose;
  const tickets=Math.min(total-2,4+draw%5), left=total-tickets, word='Sala '+halls[hall];
  return [
    withEvidence(
      question('Las salas forman un círculo. Desde la del Reloj se pasa a la del Río, después a la de la Hiedra y por último a la del Sol. La valija con '+delivery[hall]+' salió de la sala '+halls[(hall+2)%4]+'. La dejaron dos salas más adelante siguiendo el orden del plano. ¿Dónde empieza tu búsqueda?',halls.map(h=>'Sala '+h),word,'Recorre dos salas desde el punto de partida. Tras la sala del Sol vuelves a la del Reloj.',draw),
      [
        ['Plano circular','prueba-documento','Reloj → Río → Hiedra → Sol → Reloj.'],
        ['Etiqueta de la valija','sala-cartas','La valija con '+delivery[hall]+' salió de la sala '+halls[(hall+2)%4]+'. La dejaron dos salas más adelante siguiendo el plano.']
      ]
    ),
    withEvidence(
      numberQuestion('En esa sala hay '+packs+' legajos con '+slips+' resguardos cada uno y '+loose+' sueltos. ¿Cuántos resguardos copia el archivero?',total,' resguardos','Multiplica los legajos por sus resguardos y añade los sueltos.',draw>>>5),
      [
        ['Inventario de la sala','prueba-registro',packs+' legajos de '+slips+' resguardos.'],
        ['Bandeja del archivero','c87-registro','Hay '+loose+' resguardos sueltos para añadir a los legajos.']
      ]
    ),
    withEvidence(
      numberQuestion('Llevas '+total+' resguardos al depósito. Allí reconocen '+tickets+' como copias del mismo envío y te piden retirarlos. ¿Qué cantidad anotas en el recibo definitivo?',left,' resguardos','En el recibo definitivo solo entran los resguardos que quedan después de retirar las copias.',draw>>>9),
      [
        ['Albarán de entrada','c87-registro','Se entregaron '+total+' resguardos en el depósito.'],
        ['Nota del archivero','sala-cartas',tickets+' resguardos son copias que hay que retirar.']
      ]
    )
  ];
}
function holiday(kind,draw){
  const masks=3+draw%6,candles=2+draw%3,rounds=3+draw%4;
  if(kind==='halloween'){
    const total=masks*candles;
    return ['La ronda de las linternas',[
      withEvidence(
        numberQuestion('Para la ronda de Halloween, cuelgan '+masks+' máscaras del corredor. Cada máscara lleva '+candles+' luces. ¿Cuántas luces hay que encender?',total,' luces','Cada máscara lleva el mismo número de luces.',draw),
        [
          ['Lista del corredor','prueba-registro',masks+' máscaras colgadas para el desfile.'],
          ['Montaje de las máscaras','umbravia-farol','Cada máscara lleva '+candles+' luces.']
        ]
      ),
      withEvidence(
        numberQuestion('Durante el desfile se apagan '+rounds+' de las '+total+' luces. ¿Cuántas siguen encendidas al llegar al patio?',total-rounds,' luces','Las luces apagadas se descuentan del total inicial.',draw>>>5),
        [
          ['Salida del desfile','umbravia-farol','Había '+total+' luces encendidas al salir.'],
          ['Parte del patio','prueba-registro','Durante el recorrido se apagaron '+rounds+' luces.']
        ]
      )
    ]];
  }
  const gift=4+draw%7,baskets=2+draw%4,total=gift*baskets;
  return ['El reparto de Nochebuena',[
    withEvidence(
      numberQuestion('En el taller de Navidad preparan '+baskets+' cestas con '+gift+' sobres sellados cada una. ¿Cuántos sobres salen del taller?',total,' sobres','Multiplica las cestas por el número de sobres que lleva cada una.',draw),
      [
        ['Lista del taller','prueba-registro',baskets+' cestas preparadas para salir.'],
        ['Etiqueta de la cesta','sala-cartas','Cada cesta lleva '+gift+' sobres sellados.']
      ]
    ),
    withEvidence(
      numberQuestion('De los '+total+' sobres, '+rounds+' van al faro. Los demás se entregan en la plaza. ¿Cuántos recibe la plaza?',total-rounds,' sobres','Resta al reparto completo los sobres destinados al faro.',draw>>>5),
      [
        ['Orden de reparto','sala-cartas','El envío sale con '+total+' sobres.'],
        ['Recibo del faro','c87-registro','Se han entregado '+rounds+' sobres en el faro. El resto va a la plaza.']
      ]
    )
  ]];
}

export function calendarEditions(now=Date.now()){
  const parts=Object.fromEntries(madridDate.formatToParts(now).map(part=>[part.type,part.value]));
  const today=parts.year+'-'+parts.month+'-'+parts.day, stamp=Date.parse(today+'T12:00:00Z');
  const weekday=(new Date(stamp).getUTCDay()+6)%7, monday=new Date(stamp-weekday*dayMs).toISOString().slice(0,10);
  const dailySeed=seed(today),weeklySeed=seed(monday),[dailyTitle,one]=daily(Math.floor(stamp/dayMs),dailySeed);
  const holidayType=today.endsWith('-10-31')?'halloween':(today.endsWith('-12-24')||today.endsWith('-12-25'))?'navidad':null;
  function row(key,title,stages,schedule,prize){
    return {id:editionId(key),status:'published',caseId:1,revision:1,title,...stages[0],steps:stages.slice(1),schedule:normalizeChallengeSchedule(schedule),prize};
  }
  const rows=[
    row('dia/'+today,dailyTitle,[one],{kind:'daily',startsOn:today},1),
    row('semana/'+monday,'La valija de las cuatro salas',weekly(weeklySeed),{kind:'weekly',startsOn:monday},2)
  ];
  if(holidayType){
    const key=holidayType+'/'+parts.year,[title,stages]=holiday(holidayType,seed(key));
    const start=parts.year+(holidayType==='halloween'?'-10-31':'-12-24'),end=parts.year+(holidayType==='halloween'?'-10-31':'-12-25');
    rows.push(row(key,title,stages,{kind:'event',startsOn:start,endsOn:end},2));
  }
  return rows;
}
