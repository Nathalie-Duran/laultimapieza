import assert from 'node:assert/strict';
import test from 'node:test';
import {secretArchive} from '../secret-archive.mjs';

test('El archivo indexa hallazgos acreditados sin contenido privado ni adelantos de casos bloqueados', () => {
  const privateText = 'Texto exclusivo del papel B';
  const data = {
    valdemarCaseProgress: {
      paid: {
        1: {fieldToolSolved: true, inventory: {0: {items: [privateText]}}, choice: privateText},
        2: {missionPrize: 1, sharedHints: [privateText]},
        3: {hotelInventory: {witnesses: [privateText]}},
        4: {missionPrize: 3}
      },
      editorial: {1: {missionPrize: 2}}
    },
    valdemarSeasonOne: {paid: {second: [2], opened: [1, 4], solution:[3]}}
  };
  const entries = secretArchive(data, 'paid', {availableCases:[1, 2, 3]});
  assert.deepEqual(entries, [
    {caseId: 1, titles:['Documento recuperado con el instrumento', 'Sobre de ayuda abierto']},
    {caseId: 2, titles:['Ficha de la misión secreta','Segunda pista abierta']},
    {caseId: 3, titles:['Segunda declaración del hotel']}
  ]);
  assert.deepEqual(secretArchive({}, 'paid', {availableCases:[1]}), []);
  assert.deepEqual(secretArchive(data, 'paid', {availableCases:[]}), []);
  assert.deepEqual(secretArchive(data, 'editorial', {availableCases:[1]}), [
    {caseId: 1, titles:['Ficha de la misión secreta']}
  ]);
});

test('La sección muestra el caso ganado y descarta una respuesta que llegue tras cerrar sesión', async () => {
  const {readFile} = await import('node:fs/promises');
  const {runInNewContext} = await import('node:vm');
  const elements = new Map();
  let signedIn = true;
  let reply = async () => ({archive:[{caseId: 14, titles:['Ficha de la misión secreta']}]});
  const window = {
    customElements: {get:key=>elements.get(key), define:(key,cls)=>elements.set(key,cls)},
    Mundos: {story:()=>({title:'Caso <14>'})},
    GameAccountBridge: {isSignedIn:()=>signedIn, request:path=>{
      assert.equal(path, '/api/valdemar/partidas');
      return reply();
    }}
  };
  runInNewContext(await readFile(new URL('../web/profile-notebook.js',import.meta.url),'utf8'),{window,HTMLElement:class{},Intl});
  const create = () => Object.assign(new (elements.get('profile-collection'))(),{
    isConnected:true,hasAttribute:name=>name === 'data-archive'
  });
  const archive = create();
  await archive.connectedCallback();
  assert.match(archive.innerHTML, /Ficha de la misión secreta/);
  assert.match(archive.innerHTML, /Caso &lt;14&gt;/);
  assert.match(archive.innerHTML, /href="#mundos-jugar\?id=14"/);
  let finish;
  reply = () => new Promise(resolve=>{finish=resolve});
  const stale = create();
  const render = stale.connectedCallback();
  signedIn = false;
  finish({archive:[{caseId:1,titles:['Hallazgo de la cuenta anterior']}]});
  await render;
  assert.equal(stale.innerHTML, undefined);
});
