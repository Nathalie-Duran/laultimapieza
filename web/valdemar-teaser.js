(() => {
  'use strict';

  const office = () => document.querySelector('[data-vd-call]');
  const state = {open:false,transcript:false,choice:'',solved:false,message:'',sound:''};
  let playing;

  function showAnswer(panel) {
    for(const plug of panel.querySelectorAll('[data-vd-plug]')) {
      plug.setAttribute('aria-pressed',String(plug.dataset.vdPlug===state.choice));
    }
    panel.querySelector('[data-vd-call-result]').textContent=state.message;
    panel.querySelector('[data-vd-call-next]').hidden=!state.solved;
  }

  // This case's public detail is pre-rendered, then replaced as the account loads.
  // Reapply only the teaser state to the new detail, without storing visitor data.
  function restore() {
    const panel=office();
    if(!panel)return;
    panel.open=state.open;
    panel.querySelector('[data-vd-transcript]').open=state.transcript;
    panel.querySelector('[data-vd-sound-status]').textContent=state.sound;
    showAnswer(panel);
  }

  function soundStatus(message) {
    state.sound=message;
    const status=office()?.querySelector('[data-vd-sound-status]');
    if(status)status.textContent=message;
  }

  function stopSound() {
    if(!playing)return;
    const context=playing;
    playing=null;
    if(context.state!=='closed')context.close().catch(()=>{});
  }

  function pulse(context,frequency,start,length,level) {
    const osc=context.createOscillator();
    const gain=context.createGain();
    osc.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+length);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start+length+.015);
    return osc;
  }

  async function listen() {
    const panel=office();
    if(!panel)return;
    const Context=window.AudioContext || window.webkitAudioContext;
    stopSound();
    if(!Context) {
      panel.querySelector('[data-vd-transcript]').open=true;
      soundStatus('La transcripción de la señal está abierta.');
      return;
    }
    let context;
    try {
      context=new Context();
      playing=context;
      await context.resume();
      if(playing!==context)return;
      const start=context.currentTime+.035;
      for(const offset of [0,.79]) {
        pulse(context,740,start+offset,.46,.13);
        pulse(context,1134,start+offset,.42,.075);
        pulse(context,1531,start+offset,.23,.042);
      }
      const click=pulse(context,260,start+1.98,.039,.19);
      click.onended=()=>{
        if(playing!==context)return;
        stopSound();
        soundStatus('Señal finalizada.');
      };
      soundStatus('Reproduciendo la llamada.');
    } catch {
      if(playing===context)stopSound();
      panel.querySelector('[data-vd-transcript]').open=true;
      soundStatus('La transcripción de la señal está abierta.');
    }
  }

  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-vd-start],[data-vd-offhook],[data-vd-listen],[data-vd-plug]');
    if(!control)return;
    const panel=office();
    if(!panel)return;
    if(control.matches('[data-vd-start]')) {
      state.open=true;
      panel.open=true;
      panel.querySelector('[data-vd-offhook]').focus();
      panel.scrollIntoView({block:'center',behavior:'instant'});
      listen();
      return;
    }
    if(control.matches('[data-vd-offhook]')) {
      state.open=!panel.open;
      if(state.open)listen();
      else {stopSound();soundStatus('');}
      return;
    }
    if(control.matches('[data-vd-listen]')) {listen();return;}
    state.choice=control.dataset.vdPlug;
    const correct=state.choice==='estacion';
    if(correct)state.solved=true;
    state.message=correct
      ? 'Aviso localizado. Los dos timbres sitúan la llamada en el ala de la estación. El clic final indica que se ha pedido una copia de planta.'
      : 'El ala del patio usa un solo timbre. Vuelve a escuchar cuántos suenan antes de la pausa.';
    showAnswer(panel);
  });
  document.addEventListener('toggle',event=>{
    const panel=office();
    if(!panel||!panel.contains(event.target))return;
    if(event.target===panel)state.open=panel.open;
    if(event.target.hasAttribute('data-vd-transcript'))state.transcript=event.target.open;
  },true);
  const main=document.getElementById('main');
  if(main)new MutationObserver(restore).observe(main,{childList:true});
  window.addEventListener('pagehide',stopSound);
  restore();
})();
