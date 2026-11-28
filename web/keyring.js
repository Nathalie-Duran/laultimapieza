(() => {
  'use strict';
  const titles={open:'Pista orientativa',second:'Pista detallada',solution:'Solución explicada',
    reward:'Reto paralelo',challenge:'Desafío publicado',calendarChallenge:'Desafío del calendario',mansionArcade:'Minijuego de la mansión',mansionEnding:'Desenlace de la mansión',mission:'Misión secreta',renewal:'Renovación mensual',welcome:'Bienvenida'};
  const keys=n=>n+(n===1?' llave':' llaves');
  function node(tag,label) {
    const element=document.createElement(tag);
    if(label!=null)element.textContent=label;
    return element;
  }
  function history(wallet) {
    const details=node('details'),list=node('ol');
    details.append(node('summary','Historial de llaves'));
    for(const entry of [...(wallet.history||[])].reverse()) {
      const value=(entry.amount>0?'+':'')+entry.amount;
      const context=entry.caseId?' · Caso '+entry.caseId:'';
      const when=entry.at?' · '+new Date(entry.at).toLocaleDateString('es-ES'):'';
      list.append(node('li',value+' · '+titles[entry.kind]+context+when));
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
      body.append(button('Jugar el reto paralelo · +'+keys(data.parallelPrize),play));
    } else if(data.keyChallenge) {
      const next=node('a','Ganar llaves en '+data.keyChallenge.title);
      next.href=data.keyChallenge.href;next.className=buttonClass;body.append(next);
    }
    body.append(status,history(data.wallet));
  }
  window.Keyring=Object.freeze({history,update,render});
})();
