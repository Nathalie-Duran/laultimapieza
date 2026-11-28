import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDatabase} from '../database.mjs';
import '../web/motor-aventuras.js';

// Se ejecuta exclusivamente con el servicio MySQL desechable del flujo de pruebas.
const [action] = process.argv.slice(2);
const target = process.env.DB_NAME;
if (!['sembrar','verificar'].includes(action) || process.env.DB_HOST !== '127.0.0.1' ||
    target !== (action === 'sembrar' ? 'lup_qa' : 'lup_qa_restore')) {
  throw Error('Esta prueba requiere una base local de ensayo o su restauración.');
}
const store = createDatabase(process.env);
const account = 'ensayo-interno';
const sample = {valdemarCaseProgress:{paid:{2:{hourStep:2,inventory:['ficha']}}},
  valdemarSeasonOne:{paid:{entries:[{kind:'challenge',id:'ensayo',amount:1,caseId:2}]}},
  censoDeEnsayo:'sin datos personales'};
const definition = globalThis.MotorAventuras.plantilla();
const participant = createHash('sha256').update(account).digest('hex');

if (action === 'sembrar') {
  await store(async db => {
    await db.getMemberData(account);
    await db.saveMemberData(account,sample);
    await db.saveAuthorDraft({id:definition.id,caseId:2,definition,version:0,publish:true});
    await db.noteTrial({game:'ensayo',trial:'primera-prueba',edition:1,participant,at:10,solved:false});
    await db.noteTrial({game:'ensayo',trial:'primera-prueba',edition:1,participant,at:20,solved:true});
  });
  await assert.rejects(store(async db => {
    await db.saveMemberData(account,{});
    throw Error('Ensayo de reversión');
  }),/Ensayo de reversión/);
}
await store(async db => {
  assert.deepEqual(await db.getMemberData(account,{readOnly:true}),sample);
  const release=await db.authorRelease(definition.id,1);
  assert.deepEqual(release.definition,definition);
  assert.equal(release.caseId,2);
  const report=await db.trialReport(0,30);
  const row=report.find(item=>item.game==='ensayo');
  assert.equal(Number(row?.started),1);
  assert.equal(Number(row?.solved),1);
});
console.log('Verificados partida, inventario, llave, edición publicada y prueba resuelta en '+target+'.');
