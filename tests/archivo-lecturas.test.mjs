import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const web=name=>new URL('../web/'+name,import.meta.url);
const run={window:{}};
for(const f of ['vallejo-marta.js','vallejo-tomas.js'])runInNewContext(await readFile(web(f),'utf8'),run);
const first=run.window.VallejoMarta.readings,second=run.window.VallejoTomas.readings;

test('cada facsímil consultable tiene lectura y conserva las observaciones que exigen iluminar o reflejar el original',()=>{
  assert.equal(Object.keys(first).filter(name=>name.endsWith('.png')).length,5);
  for(const doc of run.window.VallejoTomas.documents.filter(d=>d.type==='image'))assert.ok(second[doc.file].lines.length,doc.label);
  const admission=first['01_ficha_admision.png'],mirror=second['04_hoja_suelta.png'];
  assert.equal(admission.tool,'vp-bright');assert.ok(admission.adjusted.length);
  assert.equal(mirror.tool,'vp-mirrored');assert.ok(mirror.adjusted.length);
  assert.ok(first['05_tabla_vigenere.png'].alphabet);
});

test('los grupos y las pausas de la transcripción coinciden con los golpes en la grabación distribuida',async()=>{
  const wav=await readFile(web('02_grabacion_sesion1.wav'));
  let rate,samples;
  for(let offset=12;offset+8<=wav.length;){
    const header=wav.toString('ascii',offset,offset+4),length=wav.readUInt32LE(offset+4);
    if(header==='fmt '){
      assert.equal(wav.readUInt16LE(offset+8),1);
      assert.equal(wav.readUInt16LE(offset+10),1);
      assert.equal(wav.readUInt16LE(offset+22),16);
      rate=wav.readUInt32LE(offset+12);
    }
    if(header==='data')samples=wav.subarray(offset+8,offset+8+length);
    offset+=8+length+length%2;
  }
  const windowSize=Math.floor(rate*.02),energy=[];
  for(let start=0;start+windowSize<=samples.length/2;start+=windowSize){
    let squared=0;
    for(let i=0;i<windowSize;i++)squared+=samples.readInt16LE(2*(start+i))**2;
    energy.push(Math.sqrt(squared/windowSize));
  }
  const threshold=.24*Math.max(...energy),pairs=[];
  let lastLoud=-Infinity,lastTap=-Infinity;
  for(let i=0;i<energy.length;i++){
    if(energy[i]<threshold)continue;
    if(i-lastLoud>5){
      const time=i*windowSize/rate,interval=time-lastTap;
      if(interval>2)pairs.push([]);
      const groups=pairs.at(-1);
      if(interval>.7)groups.push(0);
      groups[groups.length-1]++;
      lastTap=time;
    }
    lastLoud=i;
  }
  assert.deepEqual(pairs,JSON.parse(JSON.stringify(second['02_grabacion_sesion1.wav'].knocks)));
});
