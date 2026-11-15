import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const c=vm.createContext({});
for(const name of ['stories.js','season.js','media-plan.js','evidence-design.js'])vm.runInContext(await readFile(new URL('../public/'+name,import.meta.url),'utf8'),c);
test('Thirteen cases have distinct image, audio and website sources, all reachable from both branches',async()=>{
 for(const story of c.STORIES){
  const p=story.id==='habitacion-309'?c.MEDIA_PLAN:c.SEASON_MEDIA[story.id];assert.deepEqual(Array.from(p.artifacts,a=>a.type),story.id==='cartas-medianoche'?['image','image','video','website']:['image','audio','website']);
  assert.equal(new Set(p.artifacts.map(a=>a.transcript)).size,p.artifacts.length);
  for(const a of p.artifacts){const bytes=await readFile(new URL('../public'+a.src,import.meta.url));assert.ok(bytes.length>40);if(story.season===1){assert.ok(a.nodes.includes('pista_a'));assert.ok(a.nodes.includes('pista_b'));}}
  const page=await readFile(new URL('../public/evidence/'+story.id+'.html',import.meta.url),'utf8');assert.doesNotMatch(page,/<audio|<video|\.wav|\.webm/);
  const svg=await readFile(new URL('../public/evidence/'+story.id+'.svg',import.meta.url),'utf8');assert.match(svg,/<svg/);assert.match(svg,/<desc/);
 }
});
test('Representative deductions require complementary sources rather than repeated answers',()=>{
 const get=id=>c.SEASON_MEDIA[id].artifacts;
 const m=get('marea-quieta');assert.match(m[0].transcript,/18:40–19:00/);assert.doesNotMatch(m[0].transcript,/18:50/);assert.match(m[1].transcript,/18:50/);assert.match(m[2].transcript,/18:20–18:40/);
 const r=get('retrato-prestado');assert.match(r[0].transcript,/CR-6/);assert.doesNotMatch(r[0].transcript,/P17/);assert.match(r[2].transcript,/P17: madera/);
 const f=get('frecuencia-17');assert.match(f[0].transcript,/Siguiente: NUBE/);assert.match(f[1].transcript,/primera tarjeta es LIMA/);assert.match(f[2].transcript,/FARO: canal 17/);assert.doesNotMatch(f[2].transcript,/sello NUBE|Número: 6/);
 const city=get('ciudad-invisible');assert.match(city[0].transcript,/D5 Archivo/);assert.match(city[1].transcript,/Partid de D2/);assert.doesNotMatch(city[2].transcript,/D5|Partid de D2/);
 for(const s of c.STORIES.filter(s=>s.season===1))for(const n of ['pista_a','pista_b','contraste_a','contraste_b'])assert.ok(!s.nodes[n].evidence.A.text.includes(s.puzzle.answer));
});
