import {ApiError} from './auth-provider.mjs';
import './web/motor-aventuras.js';
import {createHash} from 'node:crypto';
import {normalizeChallengeSchedule,isChallengeAvailable} from './challenge-schedule.mjs';
import {calendarEditions} from './calendar-challenges.mjs';
import {worldSeasonAccess,creditPublishedChallenge,WORLD_CASE_COUNT} from './valdemar-wallet.mjs';

export const challengeSchema = `CREATE TABLE IF NOT EXISTS lup_published_challenges (
  id CHAR(36) CHARACTER SET ascii PRIMARY KEY, case_id TINYINT UNSIGNED NOT NULL,
  status VARCHAR(12) CHARACTER SET ascii NOT NULL, revision INT UNSIGNED NOT NULL,
  content_json TEXT NOT NULL, attempted INT UNSIGNED NOT NULL DEFAULT 0, solved INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX lup_list_challenges(status,case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
export const stageMetricsSchema=`CREATE TABLE IF NOT EXISTS lup_challenge_stage_counts (
  challenge_id CHAR(36) CHARACTER SET ascii NOT NULL, stage_number TINYINT UNSIGNED NOT NULL,
  content_key CHAR(64) CHARACTER SET ascii NOT NULL, attempted INT UNSIGNED NOT NULL, solved INT UNSIGNED NOT NULL,
  PRIMARY KEY(challenge_id,stage_number,content_key)
) ENGINE=InnoDB`;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = () => new ApiError(409,'Otra edición ha cambiado el desafío. Vuelve a cargarlo.');
function validateStage(item) {
  const text=(value,max)=>typeof value==='string' && value.trim().length>0 && value.length<=max;
  const {prompt,options,answer,explanation}=item || {};
  if (!text(prompt,1500)||
      !Array.isArray(options)||options.length<2||options.length>6||!options.every(opt=>text(opt,180))||
      new Set(options.map(opt=>opt.trim().toLocaleLowerCase('es'))).size!==options.length||
      !Number.isInteger(answer)||answer<0||answer>=options.length||!text(explanation,800)) {
    throw new ApiError(400,'Revisa el caso, el título, la pregunta, las opciones diferentes, la respuesta y su explicación.');
  }
  return {prompt:prompt.trim(),options:options.map(s=>s.trim()),answer,explanation:explanation.trim()};
}
function stageWithVariants(input){
  const stage=validateStage(input),variants=input.variants??[];
  if(!Array.isArray(variants)||variants.length>3)throw new ApiError(400,'Cada prueba admite hasta tres variantes.');
  if(!variants.length)return stage;
  const alternatives=variants.map(validateStage);
  if(new Set([stage,...alternatives].map(s=>JSON.stringify([s.prompt,s.options]))).size!==alternatives.length+1)throw new ApiError(400,'Cada variante necesita una prueba diferente.');
  return {...stage,variants:alternatives};
}
export function validateChallenge(input) {
  const {id,status,revision,caseId,title,steps=[],prize=1}=input;
  if(!uuid.test(id)||!Number.isInteger(revision)||revision<0||!['draft','published','withdrawn'].includes(status)||
     !Number.isInteger(caseId)||caseId<1||caseId>WORLD_CASE_COUNT||typeof title!=='string'||
     !title.trim()||title.length>90||!Array.isArray(steps)||steps.length>7)throw new ApiError(400,'Revisa el título, el caso y el máximo de ocho pruebas.');
  const rewardType=input.rewardType??(prize===2?'advanced':'simple');
  const allowed={simple:[1],advanced:[2],mission:[1,2,3]};
  if(!Object.hasOwn(allowed,rewardType)||!allowed[rewardType].includes(prize))throw new ApiError(400,'Los retos sencillos otorgan una llave, los avanzados dos y las misiones secretas entre una y tres.');
  const content={id,status,revision,caseId,title:title.trim(),...stageWithVariants(input),prize,rewardType,schedule:normalizeChallengeSchedule(input.schedule),...(steps.length?{steps:steps.map(stageWithVariants)}:{})};
  if(Buffer.byteLength(JSON.stringify(content),'utf8')>64000)throw new ApiError(400,'El desafío es demasiado extenso para guardarlo. Reduce el texto o el número de variantes.');
  return content;
}
function unpack(row) {
  return {id:row.id,caseId:row.case_id,status:row.status,revision:row.revision,attempted:row.attempted,solved:row.solved,...JSON.parse(row.content_json)};
}
export function challengeStore(query) {
  return {
    async listChallenges(onlyPublished=false) {
      const rows=await query('SELECT * FROM lup_published_challenges '+(onlyPublished?"WHERE status='published' ":'')+'ORDER BY case_id,id');
      const items=rows.map(unpack);
      if(!onlyPublished && items.length){
        const metrics=await query('SELECT challenge_id,stage_number,content_key,attempted,solved FROM lup_challenge_stage_counts');
        const byKey=new Map(metrics.map(m=>[m.challenge_id+'/'+m.stage_number+'/'+m.content_key,m]));
        for(const item of items)item.metrics=[item,...(item.steps||[])].map((stage,index)=>{
          const total={attempted:0,solved:0};
          for(const version of [stage,...(stage.variants||[])]){
            const m=byKey.get(item.id+'/'+index+'/'+signature(version));
            if(m){total.attempted+=Number(m.attempted);total.solved+=Number(m.solved);}
          }
          return total;
        });
      }
      return items;
    },
    async lockChallenge(id) {
      const [row]=await query('SELECT * FROM lup_published_challenges WHERE id=? FOR UPDATE',[id]);
      return row ? unpack(row) : null;
    },
    async saveChallenge({id,status,revision,caseId,...content}) {
      const encoded=JSON.stringify(content);
      if (revision===0) {
        try {
          await query('INSERT INTO lup_published_challenges(id,case_id,status,revision,content_json) VALUES(?,?,?,1,?)',[id,caseId,status,encoded]);
        } catch(error) { if(error.code==='ER_DUP_ENTRY')throw conflict();throw error; }
      } else {
        const result=await query('UPDATE lup_published_challenges SET case_id=?,status=?,content_json=?,revision=revision+1 WHERE id=? AND revision=?',[caseId,status,encoded,id,revision]);
        if(!result.affectedRows)throw conflict();
      }
      return {id,status,revision:revision+1};
    },
    async countChallenge(id, first, solved) {
      await query('UPDATE lup_published_challenges SET attempted=attempted+?,solved=solved+? WHERE id=?',[Number(first),Number(solved),id]);
    },
    async countStage(id,index,key,first,solved){
      await query(`INSERT INTO lup_challenge_stage_counts(challenge_id,stage_number,content_key,attempted,solved)
        VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE attempted=attempted+?, solved=solved+?`,
        [id,index,key,Number(first),Number(solved),Number(first),Number(solved)]);
    }
  };
}
export async function playPublished(store,{uid,billing,editorial,input,calendar=false,now=Date.now()}) {
  const member=editorial ? null : await billing?.membership?.(store,uid,{readOnly:true});
  const data=await store.getMemberData(uid,{readOnly:!input});
  const access=editorial ? worldSeasonAccess(data,{editorial:true}) : member?.seasonAccess || {availableCases:[]};
  const scope=editorial?'editorial':'paid';
  const results=data.editorialMiniProgress?.[scope] || {};
  const editions=calendar?calendarEditions(now):null;
  const progressKey=id=>calendar?'calendar/'+id:id;
  if (!input) {
    const rows=editions||await store.listChallenges(true);
    return {items:rows.filter(row=>isChallengeAvailable(row,now)&&access.availableCases.includes(row.caseId)).map(row=>playerItem(row,results[progressKey(row.id)],uid,calendar))};
  }
  if(!uuid.test(input.id))throw new ApiError(400,'Elige un desafío.');
  const row=editions?editions.find(item=>item.id===input.id):await store.lockChallenge(input.id);
  if(!row||!isChallengeAvailable(row,now)||!access.availableCases.includes(row.caseId))throw new ApiError(404,'El desafío no está disponible.');
  if(input.revision!==row.revision)throw conflict();
  const keyForRow=progressKey(row.id);
  const first=!Object.hasOwn(results,keyForRow);
  const prior=results[keyForRow];
  const stages=assignedStages(row,prior,uid);
  const completed=completedStages(stages,prior);
  const index=input.index ?? (stages.length===1?0:null);
  if(!Number.isInteger(index)||index<0||index>=stages.length||index>completed.length)throw new ApiError(409,'Avanza desde la prueba actual de la aventura.');
  const stage=stages[index];
  if(!Number.isInteger(input.option)||input.option<0||input.option>=stage.options.length)throw new ApiError(400,'Elige una de las opciones.');
  const correct=globalThis.MotorAventuras.evaluarPrueba({tipo:'seleccion',respuesta:stage.answer},input.option);
  const key=signature(stage), receipt=index+'/'+key;
  const visits=prior?.stageVisits||{};
  const firstAttempt=!Object.hasOwn(visits,receipt), firstSolution=correct && visits[receipt]!=='solved';
  if(first || firstAttempt || firstSolution || correct && index===completed.length){
    (data.editorialMiniProgress ||= {})[scope]=results;
    if(correct && index===completed.length)completed.push(key);
    const firstFinish=completed.length===stages.length && !prior?.solved;
    if(firstAttempt || firstSolution)visits[receipt]=correct?'solved':'attempted';
    const earned=prior?.earned??(prior?.solved?(calendar?row.prize:1):firstFinish?(row.prize??1):null);
    results[keyForRow]={solved:Boolean(prior?.solved||firstFinish),completed,stageVisits:visits,...(earned?{earned}:{})};
    if(firstFinish) creditPublishedChallenge(data,scope,row.id,row.caseId,row.prize??1,calendar,row.title,row.rewardType);
    if(!calendar&&!editorial&&(first||firstFinish))await store.countChallenge(row.id,first,firstFinish);
    if(!calendar&&!editorial&&(firstAttempt||firstSolution))await store.countStage(row.id,index,key,firstAttempt,firstSolution);
    await store.saveMemberData(uid,data);
  }
  return {correct,...(correct?{explanation:stage.explanation,next:playerItem(row,results[keyForRow],uid,calendar)}:{})};
}

function signature(stage){
  return createHash('sha256').update(JSON.stringify([stage.prompt,stage.options,stage.answer])).digest('hex');
}
function assignedStages(row,record,uid){
  return [row,...(row.steps||[])].map((stage,index)=>{
    if(!stage.variants?.length||record?.solved&&!record.completed)return stage;
    const options=[stage,...stage.variants];
    const started=options.find(option=>{
      const key=signature(option);
      return record?.completed?.[index]===key||Object.hasOwn(record?.stageVisits||{},index+'/'+key);
    });
    if(started)return started;
    const slot=createHash('sha256').update(JSON.stringify([row.id,index,uid])).digest().readUInt32BE()%options.length;
    return options[slot];
  });
}
function completedStages(stages,record){
  if(!record)return [];
  if(!record.completed) return record.solved && stages.length===1 ? [signature(stages[0])] : [];
  const completed=[];
  for(let i=0;i<stages.length && i<record.completed.length;i++){
    if(record.completed[i]!==signature(stages[i]))break;
    completed.push(record.completed[i]);
  }
  return completed;
}
function playerItem(row,record,uid,calendar) {
  const stages=assignedStages(row,record,uid), count=completedStages(stages,record).length;
  const index=Math.min(count,stages.length-1), stage=stages[index];
  return {id:row.id,caseId:row.caseId,title:row.title,revision:row.revision,index,total:stages.length,schedule:normalizeChallengeSchedule(row.schedule),...(row.prize?{prize:row.prize}:{}),
    ...(row.rewardType?{rewardType:row.rewardType}:{}),...(record?.solved?{earned:record.earned??(calendar?row.prize:1)}:{}),
    prompt:stage.prompt,options:stage.options,solved:count===stages.length,
    ...(stage.materials?{objective:stage.objective,materials:stage.materials}:{})};
}
