import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';
import { request } from './tests/http-harness.mjs';

test('Entrega páginas y medios; admite búsqueda en vídeo y protege archivos internos', async () => {
  const server = createApp();
  const base = '';
  const fetch = (url,options) => request(server,url||'/',options);
  try {
    const home = await fetch(base);
    assert.equal(home.status,200);
    assert.match(await home.text(), /<title>La Última Pieza\b/i);
    const audio = await fetch(base+'/media/vera-message.wav',{method:'HEAD'});
    assert.equal(audio.status,200); assert.match(audio.headers.get('content-type'),/audio\/wav/);
    const video = await fetch(base+'/media/camera-309.webm',{headers:{Range:'bytes=0-15'}});
    assert.equal(video.status,206); assert.equal((await video.arrayBuffer()).byteLength,16);
    assert.match(video.headers.get('content-range'),/^bytes 0-15\//);
    assert.equal((await fetch(base+'/media/camera-309.webm',{headers:{Range:'bytes=999999999999-'}})).status,416);
    assert.equal((await fetch(base+'/package.json')).status,404);
    assert.equal((await fetch(base+'/%2e%2e%5cpackage.json')).status,404);
    assert.equal((await fetch(base+'/.env')).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
  } finally { server.close(); }
});

test('El servidor entrega la API con el token recibido y limita el cuerpo de la petición',async()=>{
  let seen;
  const server=createApp({api:async req=>{seen=req;return Response.json({saved:true});}});
  const result=await request(server,'/api/profile',{method:'PUT',headers:{Authorization:'Bearer example','Content-Type':'application/json'},body:'{"name":"Alice"}'});
  assert.equal(result.status,200);assert.equal(seen.headers.get('authorization'),'Bearer example');assert.equal((await seen.json()).name,'Alice');
  assert.equal(result.headers.get('cache-control'),'no-store');
  const oversized=await request(server,'/api/profile',{method:'PUT',body:'a'.repeat(20000)});assert.equal(oversized.status,413);
  server.close();
});
