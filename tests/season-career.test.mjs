import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {seasonCareer, rememberStage, mergeStageEvidence} from '../season-career.mjs';
import {creditMansionArcade,creditSeasonArcade,creditPublishedChallenge,markRoomCooperation} from '../valdemar-wallet.mjs';

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

test('las 24 estaciones, los retos de edición y la cooperación cuentan una vez sin sumar compras o visitas',()=>{
  const data={valdemarCaseProgress:{paid:{13:{hourStep:1,mode:'duo',inventory:{0:{items:['a','a','b']}},stageEvidence:{0:{solo:true}}},25:{mode:'solo'}}}};
  const empty=seasonCareer(data,'paid');assert.deepEqual(empty.modes,{solo:1,cooperative:0,unknown:0});
  assert.deepEqual(empty.inventory,[0,2,0,0]);
  for(const id of [1,13,25,37]){
    for(let n=0;n<6;n++){
      const name='estacion-'+n,amount=n===3||n===5?2:1;
      for(let repeat=0;repeat<2;repeat++){
        if(id===1)creditMansionArcade(data,'paid',name,amount);
        else creditSeasonArcade(data,'paid',id,name,amount);
        if(n===0)markRoomCooperation(data,'paid',id,name);
      }
    }
  }
  const wallet=data.valdemarSeasonOne.paid;
  wallet.entries.push({id:'compra',kind:'renewal',amount:1},{id:'visita',kind:'open',amount:-1,caseId:13});
  const solveEditions=()=>{
    creditPublishedChallenge(data,'paid','diario',1,false,true);
    creditPublishedChallenge(data,'paid','semanal',1,true,true);
    creditPublishedChallenge(data,'paid','publicado',46,false,false);
  };
  solveEditions();solveEditions();
  const profile=seasonCareer(data,'paid');
  assert.equal(profile.xp,10+16*10+8*30+10+30+10);
  assert.equal(profile.skills.find(s=>s.name==='Habilidad').points,24);
  assert.equal(profile.skills.find(s=>s.name==='Cooperación').points,4);
  assert.equal(profile.skills.find(s=>s.name==='Inteligencia').points,3);
  assert.equal(profile.achievements.filter(a=>a.goal===6&&a.progress===6).length,4);
  assert.ok(profile.specializations.includes('Mecanismos'));
  assert.equal(seasonCareer(data,'editorial').xp,0);
  assert.equal(seasonCareer({valdemarCaseProgress:{paid:{1:{mode:'duo',inventory:{0:{items:[]}}}}}},'paid').xp,0);
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
  assert.doesNotMatch(collection.innerHTML,/Mis reliquias/);
  collection.hasAttribute=name=>name==='data-collection';
  await collection.connectedCallback();
  assert.doesNotMatch(collection.innerHTML,/Mis logros/);
  assert.match(collection.innerHTML,/1 de 12 piezas/);
  assert.match(collection.innerHTML,/Inventario de las aventuras/);
  collection.hasAttribute=name=>name==='data-career';
  await collection.connectedCallback();
  for(const text of ['Mi trayectoria','Aprendiz','Especializaciones','En solitario','En cooperación','Mis ocho habilidades']){
    assert.ok(collection.innerHTML.includes(text));
  }
  const keyring = new (elements.get('profile-collection'))();
  keyring.isConnected = true;
  keyring.hasAttribute = name => name === 'data-keys';
  keyring.querySelector = () => ({append:node=>assert.equal(node,historyNode)});
  await keyring.connectedCallback();
  assert.match(keyring.innerHTML,/2 llaves disponibles/);
  assert.deepEqual(paths,['/api/valdemar/partidas','/api/valdemar/partidas','/api/valdemar/partidas','/api/valdemar/seasons']);
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
    Colecciones:{seasons:[{name:'Código Valdemar',seal:'Reliquia',board:'mapa'}]}};
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
  const inline=notes.caseRecap(1,{career,access},entries,{inArchive:true});
  assert.match(inline,/300 XP/);assert.doesNotMatch(inline,/<h2>Aventura completada/);
  const inPlayer=notes.caseRecap(1,{career,access},entries,{sealNavigation:true});
  assert.match(inPlayer,/Ver mi trayectoria/);assert.doesNotMatch(inPlayer,/Continuar con Caso 2|Ver mi sello/);
});

test('la portada del cuaderno da prioridad a la partida pendiente más reciente y conserva los detalles en su página',async()=>{
  const elements=new Map(),overview={};
  const access={availableCases:[2,3],completed:[]},games=[{id:2,mode:'solo',current:2,total:5,available:true,checkpoint:{task:'Localiza el registro'}}];
  let recent={time:50,href:'#valdemar-jugar?id=2&retomar=1',image:'/portada.webp',title:'Caso dos'};
  const window={customElements:{define:(key,value)=>elements.set(key,value),get:key=>elements.get(key)},ExperienceUI:{seasonReturn:()=>recent},
    ValdemarCatalog:{get:id=>({title:'Caso '+id,question:'Pregunta del caso',image:'/portada.webp'})},Colecciones:{seasons:[{name:'Código Valdemar'}]},
    GameAccountBridge:{isSignedIn:()=>true,request:async()=>({games,access,career:{level:1,xp:0,nextLevelXp:500,pieces:[0,0,0,0]}})}};
  class HTMLElement{}
  runInNewContext(await readFile(new URL('../web/profile-notebook.js',import.meta.url),'utf8'),{window,HTMLElement,document:{activeElement:null},Intl});
  const node=new (elements.get('notebook-return'))();
  Object.assign(node,{isConnected:true,dataset:{classicTime:'60'},hasAttribute:key=>key==='data-classic-resume',
    closest:()=>({querySelector:()=>overview}),contains:()=>false,innerHTML:'Continuar la partida clásica'});
  await node.connectedCallback();
  assert.equal(node.innerHTML,'Continuar la partida clásica');
  assert.doesNotMatch(overview.innerHTML,/pn-relics|Mis reliquias/);
  node.dataset.classicTime='40';
  await node.connectedCallback();
  assert.match(node.innerHTML,/Localiza el registro/);
  assert.equal(node.innerHTML.match(/En solitario/g)?.length,1);
  recent=null;games.length=0;node.hasAttribute=()=>false;
  await node.connectedCallback();
  assert.match(node.innerHTML,/Siguiente aventura disponible/);
});
