import { readFile, readdir, stat } from 'node:fs/promises';
import { Script, createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
const publicDir = new URL('./public/', import.meta.url);
for (const name of await readdir(publicDir)) {
  if (name.endsWith('.js')) new Script(await readFile(new URL(name, publicDir), 'utf8'), {filename:name});
}
const context = createContext({structuredClone, crypto:globalThis.crypto});
for (const name of ['stories.js','season.js','engine.js','media-plan.js']) runInContext(await readFile(new URL(name, publicDir),'utf8'),context,{timeout:2000});
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
console.log(`Verificados: ${context.STORIES.length} historias, ${endings} finales y ${media} referencias multimedia.`);
