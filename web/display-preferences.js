(() => {
  'use strict';
  const controls = [
    {key:'largeType', label:'Aumentar el tamaño del texto'},
    {key:'still', label:'Reducir animaciones y transiciones'}
  ];
  const key = 'lup-display-preferences-v1';
  const values = {};
  try {
    const saved=JSON.parse(localStorage.getItem(key));
    for(const item of controls)values[item.key]=saved?.[item.key]===true;
  } catch {}
  const root = typeof window === 'undefined' ? globalThis : window;
  const clamp = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : fallback;
  const mediaKey='lup-game-media-v1';
  let settings={volume:1,effects:1,transcripts:false};
  function readMedia(){
    try {
      const v=JSON.parse(localStorage.getItem(mediaKey));
      settings={volume:clamp(v?.volume,1),effects:clamp(v?.effects,1),transcripts:v?.transcripts===true};
    } catch {}
  }
  readMedia();
  const buses=new WeakMap(), mutedByPreference=new WeakSet();
  function applyMedia(node){
    node.volume=settings.volume;
    if(!settings.volume&&!node.muted){node.muted=true;mutedByPreference.add(node);}
    if(settings.volume&&mutedByPreference.has(node)){node.muted=false;mutedByPreference.delete(node);}
    for(const track of Array.from(node.textTracks||[])){
      if(track.kind==='captions'||track.kind==='subtitles')track.mode=settings.transcripts?'showing':'disabled';
    }
  }
  function audioOutput(context){
    if(buses.has(context))return buses.get(context);
    const gain=context.createGain();
    const update=()=>{gain.gain.value=settings.volume*settings.effects;};
    update();gain.connect(context.destination);buses.set(context,gain);
    document.addEventListener('game-preferences-change',update);
    context.addEventListener?.('statechange',()=>{
      if(context.state==='closed')document.removeEventListener('game-preferences-change',update);
    });
    return gain;
  }
  function audioVoice(voice){
    voice.volume=settings.volume;voice.lang='es-ES';
    const voices=root.speechSynthesis?.getVoices?.()||[];
    const preferred=voices.find(v=>v.lang.toLowerCase().replace('_','-')==='es-es')||
      voices.find(v=>/^es(?:[-_]|$)/i.test(v.lang));
    if(preferred)voice.voice=preferred;
    return voice;
  }
  function applyNode(node,changing){
    if(node.matches?.('audio,video'))applyMedia(node);
    if(node.matches?.('details[data-game-transcript]')&&(settings.transcripts||changing))node.open=settings.transcripts;
  }
  function applyTree(node,changing=false){
    applyNode(node,changing);
    for(const media of node.querySelectorAll?.('audio,video,details[data-game-transcript]')||[])applyNode(media,changing);
  }
  function applySettings(transcriptsChanged=false){
    applyTree(document,transcriptsChanged);
    document.dispatchEvent(new CustomEvent('game-preferences-change'));
  }
  root.GamePreferences=Object.freeze({get volume(){return settings.volume;},get effects(){return settings.effects;},
    get transcripts(){return settings.transcripts;},applyMedia,audioOutput,audioVoice});
  // The atmosphere is optional. Never start a browser audio context on page load.
  let atmosphere=null,atmosphereRoute='';
  function soundscape(){
    const query=new URLSearchParams(root.location?.hash.split('?')[1]||'');
    const id=Number(query.get('id'))||Number(query.get('caso'));
    const board=query.get('mundo')||(['mapa','expedicion','umbravia','necropolis'][Math.floor((id-1)/12)])||'mapa';
    return {
      mapa:[130.81,196,246.94,293.66],expedicion:[146.83,220,277.18,329.63],
      umbravia:[110,164.81,207.65,261.63],necropolis:[146.83,174.61,220,311.13]
    }[board]||[130.81,196,246.94,293.66];
  }
  function stopAtmosphere(){
    if(!atmosphere)return;
    const active=atmosphere;atmosphere=null;
    active.close().catch(()=>{});
    document.dispatchEvent(new CustomEvent('game-atmosphere-change'));
  }
  root.addEventListener?.('pagehide',stopAtmosphere);
  root.addEventListener?.('hashchange',()=>{if(atmosphereRoute!==root.location.href)stopAtmosphere();});
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stopAtmosphere();});
  document.addEventListener?.('close',e=>{if(e.target?.matches?.('#scene-preview'))stopAtmosphere();},true);
  async function startAtmosphere(){
    const Context=root.AudioContext||root.webkitAudioContext;
    if(!Context)return false;
    try{
      const ctx=new Context();atmosphere=ctx;atmosphereRoute=root.location.href;
      await ctx.resume();if(ctx!==atmosphere)return false;
      const bus=audioOutput(ctx);
      soundscape().forEach((frequency,i)=>{
        const osc=ctx.createOscillator(),level=ctx.createGain();
        const wave=ctx.createOscillator(),depth=ctx.createGain();
        osc.type=i===0?'triangle':'sine';osc.frequency.value=frequency;
        level.gain.value=i===0?.023:.012;
        wave.frequency.value=.055+i*.017;depth.gain.value=i===0?.009:.011;
        wave.connect(depth);depth.connect(level.gain);osc.connect(level);level.connect(bus);
        wave.start();osc.start();
      });
      document.dispatchEvent(new CustomEvent('game-atmosphere-change'));return true;
    }catch{stopAtmosphere();return false;}
  }
  applyTree(document);
  document.addEventListener?.('loadedmetadata',event=>applyNode(event.target,false),true);
  if(root.MutationObserver)new root.MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)applyTree(node);
  }).observe(document.documentElement,{childList:true,subtree:true});
  root.addEventListener?.('storage',event=>{if(event.key===mediaKey||event.key===null){const previous=settings.transcripts;readMedia();applySettings(previous!==settings.transcripts);}});
  const apply = () => {
    for (const item of controls) {
      document.documentElement.classList.toggle('lup-' + item.key, values[item.key] === true);
    }
  };
  apply();
  class GameAudioPreferences extends HTMLElement {
    connectedCallback(){
      if(this.childElementCount)return;
      const group=document.createElement('fieldset'),legend=document.createElement('legend');
      legend.textContent='Sonido y transcripciones';group.append(legend);
      const sync=[];
      for(const [key,labelText] of [['volume','Volumen general'],['effects','Intensidad de los efectos sonoros'],['transcripts','Mostrar las transcripciones y los subtítulos disponibles']]){
        const label=document.createElement('label'),input=document.createElement('input'),value=document.createElement('span');
        const check=key==='transcripts';
        if(check){input.type='checkbox';label.append(input,document.createTextNode(labelText));}
        else {
          input.type='range';input.min='0';input.max='100';input.step='5';
          label.append(document.createTextNode(labelText),value,input);
        }
        const refresh=()=>{
          if(check)input.checked=settings[key];
          else {const v=Math.round(100*settings[key]);input.value=String(v);input.setAttribute('aria-valuetext',v+' %');value.textContent=v+' %';}
        };
        refresh();sync.push(refresh);
        input.addEventListener(check?'change':'input',()=>{
          settings[key]=check?input.checked:clamp(Number(input.value)/100,1);
          try{localStorage.setItem(mediaKey,JSON.stringify(settings));}catch{}
          applySettings(key==='transcripts');
        });
        group.append(label);
      }
      if(root.AudioContext||root.webkitAudioContext){
        const toggle=document.createElement('button');toggle.type='button';toggle.className='button game-atmosphere';
        const refreshButton=()=>{toggle.textContent=atmosphere?'Detener música ambiental':'Escuchar música ambiental';toggle.setAttribute('aria-pressed',String(Boolean(atmosphere)));};
        refreshButton();document.addEventListener('game-atmosphere-change',refreshButton);this.refreshAtmosphere=refreshButton;
        toggle.addEventListener('click',async()=>{if(atmosphere)stopAtmosphere();else if(!await startAtmosphere())toggle.textContent='Volver a intentar la reproducción';});
        group.append(toggle);
      }
      this.refresh=()=>sync.forEach(fn=>fn());
      document.addEventListener('game-preferences-change',this.refresh);
      this.append(group);
    }
    disconnectedCallback(){if(this.refresh)document.removeEventListener('game-preferences-change',this.refresh);if(this.refreshAtmosphere)document.removeEventListener('game-atmosphere-change',this.refreshAtmosphere);this.replaceChildren(); }
  }
  customElements.define('game-audio-preferences',GameAudioPreferences);
  class DisplayPreferences extends HTMLElement {
    connectedCallback() {
      if (this.childElementCount) return;
      if(!document.querySelector('link[data-display-settings]')){
        const style=document.createElement('link');
        style.rel='stylesheet';
        style.href='/accesibilidad.css';
        style.dataset.displaySettings='';
        document.head.append(style);
      }
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Lectura y movimiento en este dispositivo';
      fieldset.append(legend);
      const status = document.createElement('p');
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      for (const item of controls) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = values[item.key] === true;
        input.addEventListener('change', () => {
          values[item.key] = input.checked;
          apply();
          try {
            localStorage.setItem(key, JSON.stringify(values));
            status.textContent = 'Preferencias guardadas en este dispositivo.';
          } catch { status.textContent = 'Preferencias aplicadas para esta visita.'; }
        });
        label.append(input,document.createTextNode(' ' + item.label));
        fieldset.append(label);
      }
      const nav=document.createElement('nav');
      nav.setAttribute('aria-label','Ayuda y navegación');
      const origin=new URLSearchParams(location.hash.split('?')[1]).get('volver');
      const back=origin==='ayuda'?['Volver a Ayuda y contacto','/ayuda.html']
        :origin==='privacidad'?['Volver a Privacidad y datos','/privacidad.html']:origin==='perfil'?['Volver a Configuración','/#perfil?seccion=cuenta']:['Volver al inicio','/#inicio'];
      const links=origin==='ayuda'?[back]:[back,['Ayuda y contacto','/ayuda.html']];
      for(const [label,url] of links){
        const link=document.createElement('a');
        link.textContent=label;link.href=url;
        nav.append(link);
      }
      this.append(fieldset,status,document.createElement('game-audio-preferences'),nav);
    }
  }
  customElements.define('display-preferences', DisplayPreferences);
})();
