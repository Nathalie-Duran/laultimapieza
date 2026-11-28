import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const src=await readFile(new URL('../web/display-preferences.js',import.meta.url),'utf8');
test('el volumen, la voz, los efectos y las transcripciones respetan las preferencias entre visitas',()=>{
  const media={muted:false,textTracks:[{kind:'captions'}],matches:s=>s==='audio,video'};
  const transcript={open:false,matches:s=>s==='details[data-game-transcript]'};
  const document=new EventTarget(),window=new EventTarget(),localStorage=new Map();
  document.documentElement={classList:{toggle(){}}};document.querySelectorAll=()=>[media,transcript];
  window.speechSynthesis={getVoices:()=>[{lang:'en-US'},{lang:'es-ES'}]};
  const key='lup-game-media-v1';localStorage.set(key,JSON.stringify({volume:0,effects:.4,transcripts:true}));
  runInNewContext(src,{window,document,HTMLElement:class{},customElements:{define(){}},CustomEvent,
    localStorage:{getItem:k=>localStorage.get(k)}});
  const api=window.GamePreferences,ctx=new EventTarget();ctx.destination={};ctx.createGain=()=>({gain:{value:1},connect(){}});
  const bus=api.audioOutput(ctx);assert.equal(api.audioOutput(ctx),bus);
  assert.equal(media.muted,true);assert.equal(transcript.open,true);assert.equal(media.textTracks[0].mode,'showing');assert.equal(bus.gain.value,0);
  localStorage.set(key,JSON.stringify({volume:.5,effects:.4,transcripts:false}));
  window.dispatchEvent(Object.assign(new Event('storage'),{key}));
  assert.equal(media.volume,.5);assert.equal(media.muted,false);assert.equal(bus.gain.value,.2);assert.equal(transcript.open,false);
  assert.equal(api.audioVoice({}).voice.lang,'es-ES');assert.equal(api.audioVoice({}).volume,.5);
  transcript.open=true;localStorage.set(key,JSON.stringify({volume:.7,effects:1,transcripts:false}));
  window.dispatchEvent(Object.assign(new Event('storage'),{key}));assert.equal(transcript.open,true);
});
