import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createValdemarReleaseReader,encryptValdemarRelease,VALDEMAR_RELEASE} from '../valdemar-release.mjs';

const content = {
  stories: Array.from({length:12}, (_, i)=>({id:i+1, title:'Historia de prueba '+i})),
  samples: Array.from({length:11}, (_, i)=>({id:i+2, note:'Pista de prueba '+i})),
  stationScript: '/* Solo prueba de autenticación del contenido. */'
};
function memoryStore(){
  let value;
  return {
    async installValdemarKey(_,key){value ||= Buffer.from(key);return Buffer.from(value);},
    async getValdemarKey(){return value ? Buffer.from(value) : null;}
  };
}
const payload = key => ({release:VALDEMAR_RELEASE,key:key.toString('base64url')});
test('private fixture needs the matching key; repeated activation contains no key or narrative',async()=>{
  const key=randomBytes(32), envelope=encryptValdemarRelease(content,key);
  assert.ok(!JSON.stringify(envelope).includes('Historia de prueba'));
  assert.ok(!JSON.stringify(envelope).includes(payload(key).key));
  const store=memoryStore();
  const reader=createValdemarReleaseReader(async()=>envelope);
  await assert.rejects(reader.read(store),{status:503,code:'VALDEMAR_RELEASE_PENDING'});
  await assert.rejects(reader.activate(store,payload(randomBytes(32))),{status:400});
  assert.equal(await store.getValdemarKey(),null);
  await assert.rejects(reader.activate(store,{release:'otro',key:payload(key).key}),{status:400});
  assert.deepEqual(await reader.activate(store,payload(key)),{active:true,release:VALDEMAR_RELEASE});
  assert.deepEqual(await reader.activate(store,payload(key)),{active:true,release:VALDEMAR_RELEASE});
  assert.deepEqual(await reader.read(store),content);
});
test('modified ciphertext and metadata fail closed, and a stored key is immutable',async()=>{
  const key=randomBytes(32), envelope=encryptValdemarRelease(content,key);
  const store=memoryStore();
  await store.installValdemarKey(VALDEMAR_RELEASE,randomBytes(32));
  const reader=createValdemarReleaseReader(async()=>envelope);
  await assert.rejects(reader.activate(store,payload(key)),{status:409});
  await assert.rejects(reader.read(store),{status:503});
  const legitimate=memoryStore();
  await legitimate.installValdemarKey(VALDEMAR_RELEASE,key);
  const damaged=Buffer.from(envelope.ciphertext,'base64url');damaged[0]^=1;
  for(const changes of [{ciphertext:damaged.toString('base64url')},{release:'other'},{algorithm:'other'},{tag:'not_a_valid_tag'}]){
    const invalid=createValdemarReleaseReader(async()=>({...envelope,...changes}));
    await assert.rejects(invalid.read(legitimate),{status:503});
  }
});
