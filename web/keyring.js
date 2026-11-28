(() => {
  'use strict';
  const titles={open:'Pista orientativa',second:'Pista detallada',solution:'Solución explicada',
    reward:'Reto de aventura',challenge:'Reto publicado',calendarChallenge:'Desafío del calendario',mansionArcade:'Minijuego de la sala de Ada',seasonArcade:'Minijuego de la sala de temporada',mansionEnding:'Primer desenlace de la mansión',adventureEnding:'Primer desenlace de la aventura',mission:'Misión secreta',renewal:'Renovación mensual',welcome:'Bienvenida'};
  const keys=n=>n+(n===1?' llave':' llaves');
  function node(tag,label) {
    const element=document.createElement(tag);
    if(label!=null)element.textContent=label;
    return element;
  }
  function history(wallet) {
    const details=node('details'),list=node('ol');
    details.append(node('summary','Historial de llaves'));
    const movements=[...(wallet.history||[])].reverse().sort((a,b)=>(b.at||0)-(a.at||0));
    for(const entry of movements) {
      const value=(entry.amount>0?'+':'')+entry.amount;
      const id=entry.caseId,seasonIndex=Math.floor((id-1)/12),season=window.Colecciones?.seasons?.[seasonIndex];
      const station=entry.station && window.SalasMundosCatalogo?.[seasonIndex+1]?.games.find(game=>game.id===entry.station);
      const challenge=entry.kind==='reward' && id>1 && window.RetosTemporada?.ficha(id);
      const activity=entry.activity || station?.title || challenge?.title;
      let context='';
      if(id && entry.kind!=='calendarChallenge'){
        const room=entry.kind==='mansionArcade'||entry.kind==='seasonArcade';
        context=room && season?' · '+season.name:' · '+(season?season.name+' · Aventura '+((id-1)%12+1):'Aventura '+id);
      }
      const when=entry.at?' · '+new Date(entry.at).toLocaleDateString('es-ES'):'';
      list.append(node('li',value+' · '+(activity||titles[entry.kind]||'Movimiento de llaves')+context+when));
    }
    details.append(list.childElementCount?list:node('p','Aún no tienes movimientos.'));
    return details;
  }
  function update(data,result) {
    for(const field of ['wallet','hints','hintOptions','keyChallenge','sharedHintCount']){
      if(Object.hasOwn(result,field))data[field]=result[field];
    }
  }
  function render(body,{id,data,buy,play,buttonClass}) {
    const button=(label,action)=>{
      const el=node('button',label);el.type='button';el.className=buttonClass;
      el.addEventListener('click',()=>action(el));return el;
    };
    const status=node('p');status.setAttribute('role','status');
    let busy=false;
    async function choose(control,hint) {
      if(busy)return;
      busy=true;control.disabled=true;
      try {await buy(hint.op,hint.cost);} catch(err) {status.textContent=err.message;control.disabled=false;} finally {busy=false;}
    }
    body.append(node('p','Tu saldo: '+keys(data.wallet.balance)+'.'));
    if(data.partner)body.append(node('p','Si abres una pista, se descuenta de tu saldo y ambos podéis leerla en esta partida.'));
    for(const hint of data.hintOptions||[]) {
      const line=node('section');
      if(hint.text){
        line.append(node('h3',titles[hint.op]),node('p',hint.text));
        if(data.partner&&!hint.shared)line.append(button('Compartir esta pista con mi pareja',el=>choose(el,hint)));
      } else {
        const price=hint.cost?keys(hint.cost):'incluida en tu sobre';
        const action=button(titles[hint.op]+' · '+price,el=>choose(el,hint));
        action.disabled=data.wallet.balance<hint.cost;
        line.append(action);
      }
      body.append(line);
    }
    if(!data.wallet.won.includes(id)){
      body.append(button('Jugar el reto de aventura · +'+keys(data.parallelPrize),play));
    } else if(data.keyChallenge) {
      const offer=data.keyChallenge;
      const title=(offer.room&&window.Colecciones?.sala?.(offer.room)?.title)||(offer.id&&window.RetosTemporada?.ficha(offer.id)?.title)||offer.title;
      const next=node('a','Ganar llaves en '+title);
      next.href=offer.href;next.className=buttonClass;
      if(offer.room)next.dataset.visitRoom=offer.room;
      if(offer.calendar)next.dataset.visitCalendar='true';
      body.append(next);
    }
    body.append(status,history(data.wallet));
  }
  window.Keyring=Object.freeze({history,update,render});
})();
