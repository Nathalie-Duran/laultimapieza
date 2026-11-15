import test from 'node:test';
import assert from 'node:assert/strict';
import {firebaseAuthProxy} from '../firebase-proxy.mjs';

test('Los auxiliares de Google conservan la ruta y solo usan el proyecto Firebase fijo',async()=>{
  let calls=0;
  const response=await firebaseAuthProxy(new Request('https://laultimapieza.es/__/auth/handler?providerId=google.com',{headers:{authorization:'Bearer private',cookie:'private=value'}}),async(url,options)=>{
    calls++;assert.equal(url,'https://la-ultima-pieza.firebaseapp.com/__/auth/handler?providerId=google.com');
    assert.equal(options.headers.has('authorization'),false);assert.equal(options.headers.has('cookie'),false);
    assert.equal(options.redirect,'manual');return new Response('<html>auth helper</html>',{headers:{'content-type':'text/html','content-encoding':'gzip','content-length':'90'}});
  });
  assert.equal(calls,1);assert.equal(await response.text(),'<html>auth helper</html>');assert.equal(response.headers.has('content-encoding'),false);assert.equal(response.headers.get('cache-control'),'no-store');
  for(const path of ['/api/bootstrap','/__/auth/../secrets','/__/auth/%2e%2e/secrets','/__/auth/https://evil.test','/__/firebase/init.json/extra']){
    assert.equal((await firebaseAuthProxy(new Request('https://laultimapieza.es'+path),()=>{throw new Error('Unexpected upstream');})).status,404);
  }
});
test('El retorno POST llega al auxiliar y un metodo no permitido no sale del servidor',async()=>{
  const response=await firebaseAuthProxy(new Request('https://laultimapieza.es/__/auth/handler',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'state=test'}),async(url,options)=>{
    assert.equal(options.method,'POST');assert.equal(Buffer.from(options.body).toString(),'state=test');return new Response('done');
  });assert.equal(await response.text(),'done');
  assert.equal((await firebaseAuthProxy(new Request('https://laultimapieza.es/__/auth/handler',{method:'DELETE'}),()=>{throw new Error('Unexpected upstream');})).status,405);
});
