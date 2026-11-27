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

export function seasonCareer(data, scope) {
  const records = data.valdemarCaseProgress?.[scope] || {};
  const wins = new Set(data.valdemarSeasonOne?.[scope]?.won || []);
  const pieces = [0, 0, 0, 0];
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
    for (let index = 0; index < count; index++) {
      const flags = record.stageEvidence?.[index];
      if (flags?.complex === true) complex++;
      if (flags?.testimony === true) testimony++;
      if (flags?.cooperative === true) shared++;
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
    {name: 'Pruebas sencillas o de ediciones anteriores', count: stages - complex, unit: 10},
    {name: 'Pruebas complejas', count: complex, unit: 30},
    {name: 'Misiones secretas y epílogo secreto del archivo clásico', count: secrets, unit: 20},
    {name: 'Retos paralelos ganados', count: side, unit: 50},
    {name: 'Aventuras terminadas', count: finished, unit: 300},
    {name: 'Tableros completados', count: boards, unit: 1000},
    {name: 'Reliquias reunidas con doce piezas', count: boards, unit: 500}
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
    skills, rewards, pieces, achievements: [
      {name: 'Primera deducción', goal: 1, progress: deductions, unit: 'deducciones'},
      {name: 'El despertar de Valdemar', goal:1, progress:awakened?1:0, unit:'episodios'},
      {name: 'Investigación en equipo', goal: 1, progress: shared, unit: 'etapas compartidas'},
      {name: 'Especialista en retos', goal: 4, progress: side, unit: 'retos paralelos'},
      {name: 'Colección completa', goal: 4, progress: boards, unit: 'reliquias'}
    ]};
}
