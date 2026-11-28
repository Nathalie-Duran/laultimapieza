import { readFile, readdir, stat } from 'node:fs/promises';
import { Script, createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
const publicDir = new URL('./public/', import.meta.url);
for (const name of await readdir(publicDir)) {
  if (name === 'mansion-arcade-catalog.js') {
    const {mansionArcadeCatalog} = await import(new URL(name, publicDir));
    assert.equal(mansionArcadeCatalog.length, 6, 'La sala de juegos de Valdemar debe tener seis juegos.');
    continue;
  }
  if (name.endsWith('.js')) new Script(await readFile(new URL(name, publicDir), 'utf8'), {filename:name});
}
const context = createContext({structuredClone, crypto:globalThis.crypto});
for (const name of ['stories.js','season.js','engine.js','media-plan.js','evidence-design.js']) runInContext(await readFile(new URL(name, publicDir),'utf8'),context,{timeout:2000});
assert.equal(context.STORIES.length, 13);
let endings = 0;
for (const story of context.STORIES) {
  const visited = new Set();
  const walk = (session, trail = []) => {
    assert.ok(trail.length < 30, 'Ruta circular en '+story.id);
    visited.add(session.nodeId);
    if (session.status === 'finished') return;
    const node = story.nodes[session.nodeId];
    assert.ok(node, 'Nodo inexistente en '+story.id);
    assert.equal(node.choices.length, 2);
    for (const choice of node.choices) {
      const next = context.GameEngine.vote(session,'check',session.nodeId,choice.id,session.version).session;
      walk(next,[...trail,session.nodeId]);
    }
  };
  walk(context.GameEngine.makeSession(story.id,[{userId:'check',name:'Verificación'}],'solo'));
  for (const ending of Object.keys(story.endings)) { assert.ok(visited.has(ending),'Final inaccesible '+story.id+'/'+ending); endings++; }
}
let media = 0;
async function checkRefs(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key,entry] of Object.entries(value)) {
    if (['src','subtitles'].includes(key) && typeof entry === 'string' && entry.startsWith('/')) {
      let target = new URL('.'+entry,publicDir);
      let info = await stat(target);
      if (info.isDirectory()) { target = new URL('./'+entry.replace(/^\//,'').replace(/\/$/,'')+'/index.html',publicDir); info = await stat(target); }
      assert.ok(info.size > 0); media++;
    } else if (entry && typeof entry === 'object') await checkRefs(entry);
  }
}
await checkRefs(context.MEDIA_PLAN);
await checkRefs(context.SEASON_MEDIA);
// Direct links must open the same public case file before and after JavaScript starts.
context.window=context;
for(const file of ['salas-mundos-catalogo.js','retos-temporada.js','valdemar-catalog.js','colecciones.js']) {
  runInContext(await readFile(new URL(file,publicDir),'utf8'),context,{timeout:2000});
}
for(const item of context.ValdemarCatalog.items.slice(0,4)){
  const url=context.ValdemarCatalog.path(item.id);
  const html=await readFile(new URL('.'+url+'index.html',publicDir),'utf8');
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
  assert.ok(main?.includes(context.ValdemarCatalog.detail(item.id,{})),'Ficha pública incompleta: '+url);
  assert.equal((main.match(/<h1\b/g)||[]).length,1,'La ficha necesita un título único: '+url);
  assert.ok(html.includes('<title>'+item.title+' · Ficha · Código Valdemar · La Última Pieza</title>'),url);
  assert.ok((await stat(new URL('.'+item.image,publicDir))).size>0,'Falta la foto de '+url);
}
console.log(`Verificados: ${context.STORIES.length} historias, ${endings} finales y ${media} referencias multimedia.`);
