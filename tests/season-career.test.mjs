import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {seasonCareer, rememberStage, mergeStageEvidence} from '../season-career.mjs';

test('Only verified progress from the current account scope earns season XP', () => {
  const data = {valdemarCaseProgress: {
    paid: {1: {mode:'duo', hourStep:2, choice:'close', deduced:true}},
    editorial: {2: {hourStep:4}}
  }, valdemarSeasonOne: {paid:{won:[1,1,0,49], opened:[1,2]}}, seasonEnding:'abrir'};
  const profile = seasonCareer(data,'paid');
  assert.equal(profile.xp, 20 + 300 + 50 + 20);
  assert.equal(profile.skills.length, 8);
  assert.equal(profile.skills.find(s => s.name === 'Cooperación').points, 0);
  assert.deepEqual(profile.pieces,[1,0,0,0]);
  assert.equal(seasonCareer(data,'editorial').xp,40);
  assert.deepEqual(seasonCareer(data,'paid'),profile);
});

test('One shared complex testimony stage earns 30 XP once across replays and merges', () => {
  const team = {hourStep:1}, solo = {hourStep:1};
  const stage = {mode:'multi',materials:[{kind:'testimony'}]};
  rememberStage(team,0,stage,true);
  rememberStage(team,0,stage,true);
  mergeStageEvidence(solo,team);
  mergeStageEvidence(solo,team);
  const career = seasonCareer({valdemarCaseProgress:{paid:{8:solo}}},'paid');
  assert.equal(career.xp,30);
  for(const skill of ['Inteligencia','Cooperación','Empatía','Observación']){
    assert.equal(career.skills.find(item => item.name === skill).points,1);
  }
});

test('A board grants its seal only with twelve distinct endings', () => {
  const records = Object.fromEntries(Array.from({length:12},(_,i) => [i+1,{choice:'saved'}]));
  const data = {valdemarCaseProgress:{paid:records}};
  let career = seasonCareer(data,'paid');
  assert.equal(career.xp,12*300+1000+500);
  assert.deepEqual(career.pieces,[12,0,0,0]);
  assert.equal(career.level,11);
  assert.equal(career.nextLevelXp,5500);
  delete records[4];
  career = seasonCareer(data,'paid');
  assert.equal(career.xp,11*300);
  assert.equal(career.achievements.find(item => item.name === 'Colección completa').progress,0);
});

test('Account navigation renders collectible progress and the key history for the signed-in owner', async () => {
  const elements = new Map(), paths = [];
  const wallet = {balance:2,history:[]};
  const historyNode = {};
  const career = seasonCareer({valdemarCaseProgress:{paid:{1:{choice:'completed',missionPrize:2}}}},'paid');
  assert.equal(career.xp,320);
  const window = {
    customElements:{get:key=>elements.get(key), define:(key,cls)=>elements.set(key,cls)},
    Colecciones:{seasons: Array.from({length:4},(_,i)=>({board:'board'+i,name:'Temporada '+i,seal:'Reliquia '+i}))},
    GameAccountBridge:{isSignedIn:()=>true,request:async path=>{ paths.push(path);return {wallet,career}; }},
    Keyring:{history:value=>{assert.equal(value,wallet); return historyNode;}}
  };
  class HTMLElement {}
  runInNewContext(await readFile(new URL('../web/profile-notebook.js',import.meta.url),'utf8'),{window,HTMLElement,Intl});
  const collection = new (elements.get('profile-collection'))();
  collection.isConnected = true;
  collection.hasAttribute = () => false;
  await collection.connectedCallback();
  assert.match(collection.innerHTML,/Mis logros/);
  assert.match(collection.innerHTML,/1 de 12 piezas/);
  const keyring = new (elements.get('profile-collection'))();
  keyring.isConnected = true;
  keyring.hasAttribute = name => name === 'data-keys';
  keyring.querySelector = () => ({append:node=>assert.equal(node,historyNode)});
  await keyring.connectedCallback();
  assert.match(keyring.innerHTML,/2 llaves disponibles/);
  assert.deepEqual(paths,['/api/valdemar/partidas','/api/valdemar/seasons']);
});

test('el resumen de cada aventura usa su propio expediente y respeta las llaves históricas sin desglose',()=>{
  for(let id=1;id<=48;id++){
    const data={valdemarCaseProgress:{paid:{[id]:{hourStep:2,choice:'saved',deduced:true,stageEvidence:{0:{complex:true,cooperative:true}}}},
      editorial:{[id]:{choice:'editorial-only'}}},
      valdemarSeasonOne:{paid:{won:[id],entries:[{caseId:id,amount:2},{caseId:id,amount:-1},{caseId:null,amount:1}]}}};
    const career=seasonCareer(data,'paid'), summary=career.caseResults[id];
    assert.equal(summary.xp,390);assert.equal(summary.completionXp,300);
    assert.equal(summary.earnedKeys,2);assert.equal(summary.skills.find(skill=>skill.name==='Cooperación').points,1);
    assert.equal(career.pieces[Math.floor((id-1)/12)],1);
    delete data.valdemarSeasonOne.paid.entries;
    assert.equal(seasonCareer(data,'paid').caseResults[id].earnedKeys,null);
    assert.equal(seasonCareer(data,'editorial').caseResults[id].xp,300);
  }
});

test('el cuaderno solo sugiere aventuras disponibles y muestra el papel de las parejas confirmadas',async()=>{
  const window={ValdemarCatalog:{get:id=>({title:'Caso '+id,question:'Prueba',image:'/imagen.webp'})},
    Colecciones:{seasons:[{name:'Valdemar',seal:'Reliquia',board:'mapa'}]}};
  runInNewContext(await readFile(new URL('../web/profile-notebook.js',import.meta.url),'utf8'),{window,Intl});
  const notes=window.PlayerNotebook, games=[{id:2,mode:'duo',finished:false,available:true,current:1,total:5,checkpoint:{task:'Encuentra el registro'}},
    {id:1,mode:'duo',finished:true,available:false},{id:3,mode:'duo',finished:false,available:false}];
  const entries=await notes.pairedGames(games,{request:async()=>({invitations:[
    {caseId:2,status:'accepted',direction:'received',partnerName:'<Diego>',partnerEmail:'privado@ejemplo.test'},
    {caseId:3,status:'pending',direction:'sent',partnerName:'Pendiente'}]})});
  assert.equal(entries[0].role,'B');assert.equal(entries[1].partnerName,undefined);assert.equal(entries[2].partnerName,undefined);
  assert.doesNotMatch(JSON.stringify(entries),/privado@/);
  const access={completed:[1],availableCases:[2]};
  assert.equal(notes.nextAdventure(entries,access,1).question,'Encuentra el registro');
  assert.equal(notes.nextAdventure(entries,{completed:[1],availableCases:[]},1),null);
  const career=seasonCareer({valdemarCaseProgress:{paid:{1:{choice:'saved'}}}},'paid');
  assert.equal(notes.caseRecap(2,{career,access},entries),'');
  const recap=notes.caseRecap(1,{career,access},entries);
  assert.match(recap,/300 XP/);assert.match(recap,/Continuar con Caso 2/);assert.doesNotMatch(recap,/Llaves ganadas en este caso/);
});
