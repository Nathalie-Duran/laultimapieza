import assert from 'node:assert/strict';
import test from 'node:test';
import {validateNoticePrefs,noticePreferences,noticeStore,notifyEnding} from '../play-notices.mjs';
import {createMailer,messageTemplate} from '../mail-service.mjs';

test('only explicit boolean preferences are accepted; all notices default to off',()=>{
  const disabled={milestones:false,pairs:false,challenges:false,reminders:false};
  assert.deepEqual(noticePreferences(null),disabled);
  assert.deepEqual(validateNoticePrefs({...disabled,challenges:true}),{...disabled,challenges:true});
  assert.throws(()=>validateNoticePrefs({...disabled,reminders:1}));
  assert.throws(()=>validateNoticePrefs({reminders:true}));
});

test('the seasonal ending and its board completion share a single deduplicated message',async()=>{
  const data={valdemarCaseProgress:{paid:{1:{choice:'saved'}}}},jobs=[];
  const store={queuePlayNotice:async(...args)=>jobs.push(args)};
  await notifyEnding(store,'player',data,'editorial',1);
  assert.equal(jobs.length,0);
  await notifyEnding(store,'player',data,'paid',1);
  assert.equal(jobs[0][1],'case_finished');
  for(let i=2;i<=12;i++)data.valdemarCaseProgress.paid[i]={choice:'saved'};
  await notifyEnding(store,'player',data,'paid',12);
  assert.deepEqual(jobs[1],['player','board_finished',1,{caseId:12}]);
});

test('user, category, verified email and consent revision gate queued notices',async()=>{
  const adapter=noticeStore(()=>{throw Error('missing fixture')});
  const prefs={milestones:true,challenges:true,pairs:true,reminders:true,email:'a@example.test',consent_at:10,last_seen:5};
  adapter.getNoticePrefs=async uid=>uid==='a'?prefs:null;
  adapter.getPartner=async id=>({status:id==='valid'?'accepted':'revoked',ownerId:'a'});
  adapter.lockChallenge=async id=>({caseId:1,status:id==='valid'?'published':'withdrawn'});
  const job={type:'case_finished',email:prefs.email,data:{uid:'a',consentAt:10,caseId:1}};
  assert.equal(await adapter.noticeStillWanted(job),true);
  for(const altered of [{...job,email:'old@example.test'},{...job,data:{uid:'other',consentAt:10}},
    {...job,data:{uid:'a',consentAt:9}},{...job,type:'inactivity',data:{...job.data,lastSeen:4}},
    {...job,type:'pair_confirmed',data:{...job.data,pairId:'gone'}},{...job,type:'new_challenge',data:{...job.data,challengeId:'gone'}}])
    assert.equal(await adapter.noticeStillWanted(altered),false);
  for(const [type,extra] of [['pair_confirmed',{pairId:'valid'}],['new_challenge',{challengeId:'valid'}],['inactivity',{lastSeen:5}]])
    assert.equal(await adapter.noticeStillWanted({...job,type,data:{...job.data,...extra}}),true);
});

test('a withdrawal between queueing and delivery prevents any provider request',async()=>{
  let fetched=false,cancelled=false,claimed=false;
  const store={claimMail:async()=>claimed?null:(claimed=true,{id:'id',type:'new_challenge',data:{}}),
    noticeStillWanted:async()=>false,cancelMail:async()=>{cancelled=true;}};
  const mailer=createMailer({MAIL_ENABLED:'true',MAIL_FROM:'a@example.test',RESEND_API_KEY:'fake'},async()=>{fetched=true;});
  await mailer.process(fn=>fn(store));
  assert.equal(cancelled,true);assert.equal(fetched,false);
  for(const type of ['case_finished','board_finished','pair_confirmed','new_challenge','inactivity']){
    const template=messageTemplate(type,{caseId:13});
    assert.match(template.text,/#perfil\?seccion=cuenta/);
    assert.match(template.html,/Cambiar mis avisos/);
    assert.doesNotMatch(template.text,/undefined|NaN/);
  }
});
