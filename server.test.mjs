import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';

test('Entrega páginas y medios; admite búsqueda en vídeo y protege archivos internos', async () => {
  const server = createApp();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status,200);
    assert.match(await home.text(), /La última pieza/);
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
  } finally { await new Promise(resolve => server.close(resolve)); }
});
