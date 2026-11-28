// Each flag describes an action that the server has already validated. Keeping
// flags by stage makes replays and merges from a shared game idempotent.
export function rememberStage(record, index, stage, cooperative) {
  const evidence = (record.stageEvidence ||= {})[index] ||= {};
  if (stage.mode === 'order' || stage.mode === 'multi' || stage.corroboration) evidence.complex = true;
  if (stage.materials?.some(material => material.kind === 'testimony')) evidence.testimony = true;
  if (cooperative) evidence.cooperative = true;
}

export function mergeStageEvidence(record, shared) {
  for (const [index, flags] of Object.entries(shared.stageEvidence || {})) {
    if (!/^[0-4]$/.test(index)) continue;
    const personal = (record.stageEvidence ||= {})[index] ||= {};
    for (const flag of ['complex', 'testimony', 'cooperative']) {
      if (flags[flag] === true) personal[flag] = true;
    }
  }
}

const xpRates={stage:10,complex:30,mission:20,parallel:50,ending:300,board:1000,relic:500};

export function seasonCareer(data, scope) {
  const records = data.valdemarCaseProgress?.[scope] || {};
  const wins = new Set(data.valdemarSeasonOne?.[scope]?.won || []);
  const pieces = [0, 0, 0, 0];
  const caseResults = {};
  const wallet = data.valdemarSeasonOne?.[scope];
  let secrets = scope === 'paid' && data.seasonEnding ? 1 : 0;
  let stages = 0, complex = 0, deductions = 0, side = 0, testimony = 0, shared = 0, allStages = 0;
  for (let id = 1; id <= pieces.length * 12; id++) {
    const record = records[id] || {};
    const count = Number.isInteger(record.hourStep) ? Math.max(0, Math.min(5, record.hourStep)) : 0;
    stages += count;
    const mansion=id===1?record.mansion:null;
    if(mansion){
      stages+=mansion.completed?15:mansion.current-1;
      secrets+=(mansion.missions||[]).length;
      shared+=(record.mansionPairStages||[]).length;
    }
    if (count === 5 || mansion?.completed) allStages++;
    if (record.choice) pieces[Math.floor((id - 1) / 12)]++;
    if (record.deduced === true || mansion?.completed) deductions++;
    if ([1, 2, 3].includes(record.missionPrize)) secrets++;
    if (wins.has(id)) side++;
    const oldComplex=complex, oldTestimony=testimony, oldShared=shared;
    for (let index = 0; index < count; index++) {
      const flags = record.stageEvidence?.[index];
      if (flags?.complex === true) complex++;
      if (flags?.testimony === true) testimony++;
      if (flags?.cooperative === true) shared++;
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
        'Habilidad':Number(won),'Intuición':Number(record.deduced===true)+(awake?20:0),
        'Cooperación':shared-oldShared+(record.mansionPairStages||[]).length,
        'Perseverancia':Number(count===5||awake),'Empatía':testimony-oldTestimony+(quests.has('nox')?20:0)
      };
      caseResults[id]={stageCount,missionCount,parallelWon:won,completionXp:xpRates.ending,
        xp:xpRates.ending+(stageCount-complexCount)*xpRates.stage+complexCount*xpRates.complex+missionCount*xpRates.mission+Number(won)*xpRates.parallel,
        earnedKeys:Array.isArray(wallet?.entries)?wallet.entries.reduce((total,entry)=>
          total+(entry?.caseId===id && Number.isSafeInteger(entry.amount) && entry.amount>0?entry.amount:0),0):null,
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
    {name: 'Retos paralelos ganados', count: side, unit: xpRates.parallel},
    {name: 'Aventuras terminadas', count: finished, unit: xpRates.ending},
    {name: 'Tableros completados', count: boards, unit: xpRates.board},
    {name: 'Reliquias reunidas con doce piezas', count: boards, unit: xpRates.relic}
  ];
  const xp = rewards.reduce((total, reward) => total + reward.count * reward.unit, 0);
  const skills = [
    ['Valentía', ordinaryEndings+(awakened?25:0)+(missions.has('puerta')?25:0), 'Elegir un desenlace y descubrir la habitación secreta'],
    ['Inteligencia', complex+(awakened?35:0)+(missions.has('diario')?20:0), 'Contrastar fuentes, recuperar el diario y resolver la mansión'],
    ['Observación', stages+(awakened?30:0)+(missions.has('jardin')?15:0), 'Investigar las etapas y los secretos del jardín'],
    ['Habilidad', side, 'Ganar un reto paralelo'],
    ['Intuición', ordinaryDeductions+(awakened?20:0), 'Acertar la deducción final'],
    ['Cooperación', shared, 'Resolver una etapa en una partida compartida'],
    ['Perseverancia', allStages, 'Resolver todas las etapas de un caso'],
    ['Empatía', testimony+(missions.has('nox')?20:0), 'Escuchar testimonios y ayudar a Nox']
  ].map(([name, points, criterion]) => ({name, points, criterion}));
  return {xp, level: 1 + Math.floor(xp / 500), nextLevelXp: (Math.floor(xp / 500) + 1) * 500,
    skills, rewards, pieces, caseResults, achievements: [
      {name: 'Primera deducción', goal: 1, progress: deductions, unit: 'deducciones'},
      {name: 'El despertar de Valdemar', goal:1, progress:awakened?1:0, unit:'episodios'},
      {name: 'Investigación en equipo', goal: 1, progress: shared, unit: 'etapas compartidas'},
      {name: 'Especialista en retos', goal: 4, progress: side, unit: 'retos paralelos'},
      {name: 'Colección completa', goal: 4, progress: boards, unit: 'reliquias'}
    ]};
}
