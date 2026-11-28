// Each flag describes an action that the server has already validated. Keeping
// flags by stage makes replays and merges from a shared game idempotent.
export function rememberStage(record, index, stage, cooperative) {
  const evidence = (record.stageEvidence ||= {})[index] ||= {};
  if (stage.mode === 'order' || stage.mode === 'multi' || stage.corroboration) evidence.complex = true;
  if (stage.materials?.some(material => material.kind === 'testimony')) evidence.testimony = true;
  if (cooperative) evidence.cooperative = true;
  else evidence.solo = true;
}

export function mergeStageEvidence(record, shared) {
  for (const [index, flags] of Object.entries(shared.stageEvidence || {})) {
    if (!/^[0-4]$/.test(index)) continue;
    const personal = (record.stageEvidence ||= {})[index] ||= {};
    for (const flag of ['complex', 'testimony', 'cooperative','solo']) {
      if (flags[flag] === true) personal[flag] = true;
    }
  }
}

const xpRates={stage:10,complex:30,mission:20,parallel:50,ending:300,board:1000,relic:500};
const specialties=['Exploración de riesgo','Descifrado','Rastreo de indicios','Mecanismos','Deducción','Investigación en equipo','Resolución de retos','Mediación'];
const ranks=[{name:'Aprendiz',level:1},{name:'Agente de campo',level:4},{name:'Especialista',level:10},{name:'Leyenda del archivo',level:20}];
const roomMedals=['Las seis mesas de Ada','Las seis mesas del camarote','Las seis mesas del club','Las seis mesas del escarabajo'];

function extraVictories(wallet) {
  const summary={byCase:new Map(),rooms:[0,0,0,0],editions:0,basic:0,advanced:0,cooperative:0};
  const seen=new Set();
  for(const row of wallet?.entries||[]){
    if(!row || !['seasonArcade','mansionArcade','challenge','calendarChallenge'].includes(row.kind))continue;
    if(![1,2].includes(row.amount)||!Number.isInteger(row.caseId)||row.caseId<1||row.caseId>48||typeof row.id!=='string'||!row.id)continue;
    const key=row.kind+'/'+row.id;
    if(seen.has(key))continue;
    seen.add(key);
    const caseId=row.caseId,room=row.kind==='mansionArcade'||row.kind==='seasonArcade';
    const difficulty=row.amount===2?'advanced':'basic';
    if(room)summary.rooms[Math.floor((caseId-1)/12)]++;
    else summary.editions++;
    summary[difficulty]++;
    if(row.cooperative===true)summary.cooperative++;
    // Calendar editions and independent season rooms use the case only to gate access.
    if(row.kind==='calendarChallenge'||row.kind==='seasonArcade')continue;
    const totals=summary.byCase.get(caseId)||{room:0,editions:0,basic:0,advanced:0,cooperative:0};
    totals[room?'room':'editions']++;
    totals[difficulty]++;
    if(row.cooperative===true)totals.cooperative++;
    summary.byCase.set(caseId,totals);
  }
  return summary;
}

function heldCount(items) {return new Set(Array.isArray(items)?items.filter(value=>typeof value==='string'&&value):[]).size;}

export function seasonCareer(data, scope) {
  const records = data.valdemarCaseProgress?.[scope] || {};
  const wins = new Set(data.valdemarSeasonOne?.[scope]?.won || []);
  const pieces = [0, 0, 0, 0];
  const caseResults = {};
  const wallet = data.valdemarSeasonOne?.[scope];
  const extras=extraVictories(wallet);
  const inventory=pieces.map(()=>0),inventoryCases=[];
  const modes={solo:0,cooperative:0,unknown:0};
  const {rooms,editions,basic:basicExtra,advanced:advancedExtra}=extras;
  const roomWins=rooms.reduce((sum,count)=>sum+count,0);
  let tools=0,missionFinds=0;
  let secrets = scope === 'paid' && data.seasonEnding ? 1 : 0;
  let stages = 0, complex = 0, deductions = 0, side = 0, testimony = 0, shared = 0, allStages = 0;
  for (let id = 1; id <= pieces.length * 12; id++) {
    const record = records[id] || {};
    const extra=extras.byCase.get(id),board=Math.floor((id-1)/12);
    const previousHeld=inventory[board];
    const ordinaryMission=Number([1,2,3].includes(record.missionPrize));
    const tool=Number(record.fieldToolSolved===true);
    missionFinds+=ordinaryMission;
    tools+=tool;
    for(const page of Object.values(record.inventory||{}))inventory[board]+=heldCount(page?.items);
    inventory[board]+=heldCount(record.hotelInventory?.objects);
    const count = Number.isInteger(record.hourStep) ? Math.max(0, Math.min(5, record.hourStep)) : 0;
    stages += count;
    const mansion=id===1?record.mansion:null;
    if(mansion){
      const steps=mansion.completed?15:Math.min(14,Math.max(0,(mansion.current||1)-1));
      stages+=steps;
      inventory[board]+=heldCount(mansion.items);
      secrets+=new Set(mansion.missions||[]).size;
      const pair=new Set(record.mansionPairStages||[]),solo=new Set(record.mansionSoloStages||[]);
      for(let step=1;step<=steps;step++){
        if(pair.has(step)){modes.cooperative++;shared++;}
        if(solo.has(step))modes.solo++;
        if(!solo.has(step)&&!pair.has(step))modes.unknown++;
      }
    }
    if (count === 5 || mansion?.completed) allStages++;
    if(inventory[board]>previousHeld)inventoryCases.push({id,count:inventory[board]-previousHeld});
    if (record.choice) pieces[Math.floor((id - 1) / 12)]++;
    if (record.deduced === true || mansion?.completed) deductions++;
    if ([1, 2, 3].includes(record.missionPrize)) secrets++;
    if (wins.has(id)) side++;
    const oldComplex=complex, oldTestimony=testimony, oldShared=shared;
    for (let index = 0; index < count; index++) {
      const flags = record.stageEvidence?.[index];
      if (flags?.complex === true) complex++;
      if (flags?.testimony === true) testimony++;
      if (flags?.cooperative === true){shared++;modes.cooperative++;}
      if(flags?.solo===true)modes.solo++;
      if(flags?.solo!==true && flags?.cooperative!==true)modes.unknown++;
    }
    if(record.choice){
      const missionCount=(mansion?.missions || []).length+Number([1,2,3].includes(record.missionPrize));
      const stageCount=count+(mansion ? mansion.completed?15:mansion.current-1 : 0);
      const complexCount=complex-oldComplex;
      const won=wins.has(id), awake=mansion?.completed===true;
      const quests=new Set(mansion?.missions||[]);
      const points={
        'Valentía':Number(record.choice!=='mansion-sealed')+(awake?25:0)+(quests.has('puerta')?25:0),
        'Inteligencia':complexCount+(awake?35:0)+(quests.has('diario')?20:0),
        'Observación':stageCount+(awake?30:0)+(quests.has('jardin')?15:0),
        'Habilidad':Number(won)+(extra?.room||0)+tool,'Intuición':Number(record.deduced===true)+(awake?20:0)+ordinaryMission,
        'Cooperación':shared-oldShared+new Set(record.mansionPairStages||[]).size+(extra?.cooperative||0),
        'Perseverancia':Number(count===5||awake)+(extra?.advanced||0),'Empatía':testimony-oldTestimony+(quests.has('nox')?20:0)
      };
      points.Inteligencia+=extra?.editions||0;
      points['Observación']+=tool;
      caseResults[id]={stageCount,missionCount,parallelWon:won,completionXp:xpRates.ending,
        xp:xpRates.ending+(stageCount-complexCount+(extra?.basic||0))*xpRates.stage+(complexCount+(extra?.advanced||0))*xpRates.complex+missionCount*xpRates.mission+Number(won)*xpRates.parallel,
        earnedKeys:Array.isArray(wallet?.entries)?wallet.entries.reduce((total,entry)=>
          total+(entry?.caseId===id && entry.kind!=='calendarChallenge' && entry.kind!=='seasonArcade' && Number.isSafeInteger(entry.amount) && entry.amount>0?entry.amount:0),0):null,
        skills:Object.entries(points).filter(([,points])=>points>0).map(([name,points])=>({name,points}))};
    }
  }
  const finished = pieces.reduce((sum, count) => sum + count, 0);
  const mansion=records[1]?.mansion;
  const missions=new Set(mansion?.missions || []);
  const awakened=mansion?.completed===true;
  const ordinaryEndings=finished-(awakened && records[1]?.choice==='mansion-sealed'?1:0);
  const ordinaryDeductions=deductions-(awakened && !records[1]?.deduced?1:0);
  const boards = pieces.filter(count => count === 12).length;
  const rewards = [
    {name: 'Otras pruebas resueltas', count: stages - complex, unit: xpRates.stage},
    {name: 'Pruebas complejas', count: complex, unit: xpRates.complex},
    {name: 'Misiones secretas y epílogo de Las doce noches', count: secrets, unit: xpRates.mission},
    {name: 'Retos de aventura resueltos', count: side, unit: xpRates.parallel},
    {name:'Minijuegos y ediciones sencillas',count:basicExtra,unit:xpRates.stage},
    {name:'Minijuegos y ediciones avanzadas',count:advancedExtra,unit:xpRates.complex},
    {name: 'Aventuras terminadas', count: finished, unit: xpRates.ending},
    {name: 'Temporadas completadas', count: boards, unit: xpRates.board},
    {name: 'Reliquias reunidas con doce piezas', count: boards, unit: xpRates.relic}
  ];
  const xp = rewards.reduce((total, reward) => total + reward.count * reward.unit, 0);
  const skills = [
    ['Valentía', ordinaryEndings+(awakened?25:0)+(missions.has('puerta')?25:0), 'Elegir un desenlace y descubrir la habitación secreta'],
    ['Inteligencia', complex+editions+(awakened?35:0)+(missions.has('diario')?20:0), 'Resolver pruebas de lógica, ediciones del calendario y retos publicados'],
    ['Observación', stages+tools+(awakened?30:0)+(missions.has('jardin')?15:0), 'Investigar las etapas y recuperar documentos con instrumentos'],
    ['Habilidad', side+roomWins+tools, 'Resolver un reto de aventura, un minijuego o un instrumento'],
    ['Intuición', ordinaryDeductions+missionFinds+(awakened?20:0), 'Relacionar las evidencias de una misión o acertar la deducción final'],
    ['Cooperación', shared+extras.cooperative, 'Resolver etapas o minijuegos en una partida compartida'],
    ['Perseverancia', allStages+advancedExtra, 'Completar todas las etapas de una aventura o superar una prueba extra avanzada'],
    ['Empatía', testimony+(missions.has('nox')?20:0), 'Escuchar testimonios y ayudar a Nox']
  ].map(([name, points, criterion]) => ({name, points, criterion}));
  const level=1+Math.floor(xp/500);
  const rank=ranks.filter(item=>level>=item.level).at(-1).name;
  const nextRank=ranks.find(item=>item.level>level)||null;
  const specializations=skills.flatMap((skill,i)=>skill.points>=5?[specialties[i]]:[]);
  return {xp, level, nextLevelXp:level*500,rank,nextRank,specializations,modes,roomStats:{completed:roomWins,cooperative:extras.cooperative},inventory,inventoryCases,
    skills, rewards, pieces, caseResults, achievements: [
      {name: 'Primera deducción', goal: 1, progress: deductions, unit: 'deducciones'},
      {name: 'El despertar de Valdemar', goal:1, progress:awakened?1:0, unit:'episodios'},
      {name: 'Investigación en equipo', goal: 1, progress: shared, unit: 'etapas compartidas'},
      {name: 'Especialista en retos', goal: 4, progress: side, unit: 'retos paralelos'},
      {name: 'Colección completa', goal: 4, progress: boards, unit: 'reliquias'},
      {name:'Primera edición resuelta',goal:1,progress:editions,unit:'ediciones'},
      ...roomMedals.map((name,i)=>({name,goal:6,progress:rooms[i],unit:'minijuegos'}))
    ]};
}
