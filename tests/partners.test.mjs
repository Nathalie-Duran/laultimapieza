import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {ApiError} from '../auth-provider.mjs';
import {createGameApi} from '../game-api.mjs';
import {valdemarRequest} from '../valdemar-api.mjs';
import {worldSeasonAccess} from '../valdemar-wallet.mjs';
import {mansionFixture} from './mansion-fixture.mjs';

const origin='https://example.test';
const config={apiKey:'fixture',projectId:'fixture',appId:'fixture',authDomain:'fixture.test'};
const email=uid=>uid+'@example.test';
const identity=uid=>({userId:uid,name:uid==='lookalike'?'editor':uid,email:email(uid),emailVerified:true});
const isGameEditor=user=>user.emailVerified===true&&['editor','curator'].includes(user.userId);
const nearNow=Date.now();
const story={
  id:1,title:'La carta',hints:['Primera pista','Segunda pista'],choices:[{id:'guardar',label:'Guardar'}],
  hypotheses:[{id:'archivo',label:'Archivo'}],correctHypothesis:'archivo',deduction:'Deducción de ensayo',
  outcomes:{guardar:'Final de ensayo'},hour:{stages:Array.from({length:5},(_,index)=>({
    title:'Prueba '+(index+1),minutes:12,mode:'single',materials:[],options:[{id:'a',label:'Primera'},{id:'b',label:'Segunda'}],
    answer:['b'],success:'Acertado',retry:'Inténtalo otra vez'
  }))}
};
function clues(section){
  return ['A','B','AB'].map(role=>({id:role,label:'Fuente '+role,kind:'text',role,body:'contenido-'+role+'-'+section}));
}

test('la ruta de la mansión distingue guardados nuevos, históricos y editoriales',async()=>{
  const h=harness(), path='/api/valdemar/cases/1/mansion';
  assert.equal((await h.call('eve',path)).status,402);
  await h.fund('alice');
  const shell=await h.ok('alice',path);
  assert.equal(shell.edition,'mansion');assert.equal(shell.mansion,null);
  await h.game('alice','/mode',{mode:'solo',mansionEntry:true});
  const initial=await h.ok('alice',path);
  assert.equal(initial.mansion.current,1);
  assert.deepEqual(initial.mansion.stage.hintOptions.map(hint=>[hint.cost,hint.text]),[[1,null],[2,null],[3,null]]);
  await assert.rejects(h.game('alice','/mansion',{op:'hint',stage:1,tier:'open',quotedCost:0}),{code:'HINT_PRICE_CHANGED'});
  await assert.rejects(h.game('alice','/mansion',{op:'hint',stage:1,tier:'solution',quotedCost:3}),{code:'NOT_ENOUGH_KEYS'});
  const [paid,retry]=await Promise.all([1,2].map(()=>h.ok('alice',path,{op:'hint',stage:1,tier:'open',quotedCost:1})));
  assert.equal(paid.mansion.balance,0);assert.equal(retry.mansion.balance,0);
  assert.ok(retry.mansion.stage.hintOptions[0].text);assert.equal(retry.mansion.stage.hintOptions[2].text,null);
  assert.equal(retry.wallet.history.filter(entry=>entry.kind==='open').length,1);
  const answers=mansionFixture.levels[0].solution;
  await h.ok('alice',path,{op:'solve',stage:1,answers});
  const personal=await h.ok('alice','/api/valdemar/partidas');
  assert.equal(personal.games[0].total,15);assert.equal(personal.games[0].current,1);
  assert.equal(personal.games[0].title,'El secreto de los dos mundos');
  assert.equal(personal.games[0].checkpoint.title,mansionFixture.levels[1].title);
  await h.fund('bob');
  await h.game('bob','/stage',{index:0,choice:['b']});
  assert.equal((await h.ok('bob',path)).edition,'choose');
  await h.ok('bob',path,{op:'start'});await h.game('bob','/mode',{mode:'solo',mansionEntry:true});
  await h.ok('bob',path,{op:'solve',stage:1,answers});
  await h.ok('bob',path,{op:'legacy'});
  assert.equal((await h.game('bob')).hour.current,1);
  assert.equal((await h.ok('bob',path,{op:'start'})).mansion.current,2);
  await h.game('editor','/mode',{mode:'duo',mansionEntry:true});
  const editorial=await h.ok('editor',path,{op:'inspect',paper:'B'});
  assert.equal(editorial.mansion.role,'B');assert.equal(editorial.mansion.current,1);
  assert.equal(h.album('editor','paid')[1],undefined);
});

test('una pareja confirma las dos realidades, comparte cargos y cierra el álbum de ambos una sola vez',async()=>{
  const h=harness(), path='/api/valdemar/cases/1/mansion';
  for(const who of ['alice','bob'])await h.fund(who);
  const {id:partnerId}=await h.startPair('alice',1,'bob');
  await h.choose('bob',1);
  const act=(who,input)=>h.ok(who,path,{partnerId,...input});
  const a=await h.ok('alice',path),b=await h.ok('bob',path);
  assert.equal(a.mansion.role,'A');assert.equal(b.mansion.role,'B');
  assert.equal(a.legacy,false);assert.equal(b.legacy,false);
  assert.deepEqual(a.names,{A:'alice',B:'bob'});
  const hint={op:'hint',stage:1,tier:'open',quotedCost:1};
  await act('alice',hint);const shared=await act('bob',hint);
  assert.equal(shared.mansion.balance,1);
  assert.ok(shared.mansion.stage.hintOptions[0].text);
  assert((await h.ok('bob','/api/valdemar/cases/1/pair-state')).mansionRevision>0);
  for(let stage=1;stage<=14;stage++){
    const level=mansionFixture.levels[stage-1];
    for(const action of level.actions || [])await act(action.role==='B'?'bob':'alice',{op:'act',stage,action:action.id});
    const answer=await act(stage%2?'alice':'bob',{op:'solve',stage,answers:level.solution});
    assert.equal(answer.mansion.current,stage+1);
  }
  const quest=mansionFixture.sideQuests.find(q=>q.id==='nox');
  const mission={op:'solve',stage:15,mission:quest.id,answers:quest.solution};
  assert.equal((await act('alice',mission)).missionReward,1);assert.equal((await act('bob',mission)).changed,false);
  const panelAnswers=panel=>({panel,secuencia:mansionFixture.panelAnswers[panel]});
  assert.equal((await act('alice',{op:'solve',stage:15,answers:panelAnswers('A')})).mansion.completed,false);
  assert.equal((await h.call('alice',path,{partnerId,op:'solve',stage:15,paper:'B',answers:panelAnswers('B')})).httpStatus,403);
  const closed=await act('bob',{op:'solve',stage:15,answers:panelAnswers('B')});
  assert.equal(closed.mansion.completed,true);
  assert.equal((await act('bob',{op:'solve',stage:15,answers:panelAnswers('B')})).changed,false);
  for(const who of ['alice','bob']){
    const data=await h.ok(who,'/api/valdemar/partidas');
    assert.deepEqual(data.access.completed,[1]);assert.equal(data.games[0].finished,true);
    assert.equal(data.career.pieces[0],1);
    assert.equal(data.career.achievements.find(a=>a.name==='El despertar de Valdemar').progress,1);
    assert.equal(data.career.rewards.find(a=>a.name==='Aventuras terminadas').count,1);
    const bag=(await h.ok(who,'/api/valdemar/wallet')).wallet;
    assert.equal(bag.history.filter(row=>row.kind==='mission').length,1);
    assert.equal(bag.history.filter(row=>row.kind==='mansionEnding').length,1);
    assert.equal(bag.balance,who==='alice'?2:3);
  }
  await h.game('alice','/mode',{partnerId,mode:'solo'});
  assert.equal((await h.ok('bob',path)).mansion.completed,true);
  assert.equal((await h.call('alice',path,{partnerId,op:'inspect'})).httpStatus,409);
});
const twoPapers={...story,id:13,evidenceCards:clues('expediente'),roles:['contenido-A-consigna','contenido-B-consigna'],
  side:{title:'Comparar las fuentes',mode:'multi',options:[],materials:clues('reto')},
  hour:{stages:story.hour.stages.map((stage,i)=>({...stage,materials:clues('etapa-'+i),
    corroboration:{prompt:'Contrasta dos fuentes',answer:['A','B']}}))}};
const releases={stories:[{...story,mansionEdition:mansionFixture}],samples:[],nuevos:[twoPapers]};

// Each request gets an isolated transaction. A failed acceptance must leave both seats available for retry.
function harness(){
  let data={members:new Map(),profiles:new Map(),partners:new Map(),seats:new Map(),mail:new Map()};
  let membershipLookups=0;
  let tail=Promise.resolve();
  const withStore=fn=>{
    const transaction=tail.then(async()=>{
      const working=structuredClone(data);
      const live=(row,now)=>row&&(row.status==='accepted'||(row.status==='pending'&&row.expiresAt>now));
      const store={
        async ensureProfile(user){
          if(!working.profiles.has(user.userId))working.profiles.set(user.userId,{...user,newProfile:true});
          const profile=structuredClone(working.profiles.get(user.userId));
          delete working.profiles.get(user.userId).newProfile;
          return profile;
        },
        async getProfile(uid){return structuredClone(working.profiles.get(uid));},
        async lockCasePair(){},
        async listSessions(){return [];},
        async getSeasonSolved(){return null;},
        async getMemberData(uid){return structuredClone(working.members.get(uid)||{});},
        async saveMemberData(uid,member){working.members.set(uid,structuredClone(member));},
        async enqueueMail(key,address,type,payload){if(!working.mail.has(key))working.mail.set(key,{address,type,payload});},
        async listPartners(uid,address,now=Date.now()){
          return [...working.partners.values()].filter(row=>live(row,now)&&
            (row.ownerId===uid||row.guestId===uid||(row.status==='pending'&&row.email===address))).map(row=>structuredClone(row));
        },
        async getPartner(id){return structuredClone(working.partners.get(id)||null);},
        async createPartner(row){assert(!working.partners.has(row.id));working.partners.set(row.id,structuredClone(row));},
        async savePartner(row){assert(working.partners.has(row.id));working.partners.set(row.id,structuredClone(row));},
        async reservePartner(uid,caseId,id){
          const slot=uid+'/'+caseId,previous=working.seats.get(slot);
          if(previous&&previous!==id)return false;
          working.seats.set(slot,id);
          return true;
        },
        async getCasePartner(uid,caseId,now=Date.now()){
          const row=working.partners.get(working.seats.get(uid+'/'+caseId));
          if(row && !live(row,now)){await this.closePartner(row);return null;}
          return row?structuredClone(row):null;
        },
        async closePartner(row){
          working.partners.delete(row.id);
          for(const [key,id] of working.seats)if(id===row.id)working.seats.delete(key);
        }
      };
      const result=await fn(store);
      data=working;
      return result;
    });
    tail=transaction.catch(()=>{});
    return transaction;
  };
  const billing={
    publicConfig:()=>({checkoutAvailable:false}),
    membership:async(store,uid)=>{
      membershipLookups++;
      const member=await store.getMemberData(uid);
      const seasonAccess=worldSeasonAccess(member);
      return {seasonAccess,canPlay:member.active===true&&seasonAccess.availableCases.length>0};
    }
  };
  const api=createGameApi({config,withStore,billing,loadValdemarRelease:async()=>releases,stories:[],origins:[origin],isAdministrator:isGameEditor,verify:async request=>{
    const uid=request.headers.get('authorization');
    if(!['alice','bob','eve','editor','curator','lookalike'].includes(uid))throw new ApiError(401,'Inicia sesión.');
    return identity(uid);
  }});
  async function call(uid,path,input){
    const response=await api(new Request(origin+path,{method:input?'POST':'GET',
      headers:{authorization:uid||'',origin,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}));
    return {status:response.status,...await response.json(),httpStatus:response.status};
  }
  async function ok(uid,path,input){
    const result=await call(uid,path,input);
    assert.equal(result.httpStatus,200,JSON.stringify(result));
    return result;
  }
  return {
    call,ok,
    get queuedMail(){return [...data.mail.values()].map(message=>structuredClone(message));},
    get membershipLookups(){return membershipLookups;},
    album(uid,scope){return structuredClone(data.members.get(uid)?.valdemarCaseProgress?.[scope]||{});},
    async fund(uid,blocks=1){
      await withStore(async store=>{
        const member=await store.getMemberData(uid);
        member.subscription='fixture-'+uid;
        member.active=true;
        member.cycles=Array.from({length:blocks},(_,i)=>({id:uid+'-'+i,subscription:member.subscription,
          start:nearNow-(blocks-i)*86400000,end:nearNow+86400000,worldBlock:i+1}));
        await store.saveMemberData(uid,member);
      });
    },
    async stop(uid){
      await withStore(async store=>{
        const member=await store.getMemberData(uid);
        member.active=false;
        member.cycles.forEach(cycle=>{cycle.revoked=true;});
        await store.saveMemberData(uid,member);
      });
    },
    async finishFirstSeason(uid){
      await withStore(async store=>{
        const member=await store.getMemberData(uid);
        member.valdemarCaseProgress={paid:Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,{choice:'guardar'}]))};
        await store.saveMemberData(uid,member);
      });
    },
    async list(uid){return (await ok(uid,'/api/partners')).invitations;},
    async prefer(uid,other){return ok(uid,'/api/partners/preferred',{email:other?email(other):null});},
    async choose(uid,caseId){return ok(uid,'/api/partners/play',{caseId});},
    async seedLegacyPair(owner,guest){
      await withStore(async store=>{
        const id=crypto.randomUUID();
        const row={id,caseId:1,ownerId:owner,ownerName:owner,guestId:guest,guestName:guest,email:email(guest),
          status:'accepted',expiresAt:Date.now()+86400000,progress:{ownerScope:'paid',guestScope:'paid',hourStep:1}};
        await store.createPartner(row);
        for(const uid of [owner,guest]){
          await store.reservePartner(uid,1,id);
          const member=await store.getMemberData(uid);
          member.valdemarCaseProgress={paid:{1:{mode:'duo',hourStep:1}}};
          await store.saveMemberData(uid,member);
        }
      });
    },
    async startPair(owner,caseId,guest){
      await this.prefer(owner,guest);await this.prefer(guest,owner);
      const started=await this.choose(owner,caseId);
      assert.equal(started.status,'pending');assert.equal(started.partner,null);
      return (await this.list(owner)).find(row=>row.caseId===caseId&&row.direction==='sent');
    },
    async game(uid,route='',input,caseId=1){
      return valdemarRequest({path:'/api/valdemar/cases/'+caseId+route,method:input?'POST':'GET',input,uid,
        user:identity(uid),editorial:isGameEditor(identity(uid)),billing,withStore,loadRelease:async()=>releases});
    }
  };
}

test('El alta con correo crea la cuenta y solicita la verificación durante la preapertura',async()=>{
  const auth={authStateReady:async()=>{}},calls=[],browser={},location={origin,hash:'#perfil'};
  const sdk={
    getAuth:()=>auth,
    setPersistence:async()=>{},
    async createUserWithEmailAndPassword(_auth,address){calls.push(['crear',address]);return {user:{email:address}};},
    async updateProfile(user,profile){calls.push(['nombre',user.email,profile.displayName]);},
    async sendEmailVerification(user,settings){calls.push(['verificar',user.email,settings?.url]);}
  };
  const context=createContext({
    window:browser,location,URL,URLSearchParams,AbortSignal,
    async fetch(path){assert.equal(path,'/api/auth/config');return Response.json({enabled:true,firebase:config});},
    async loadSdk(path){
      if(path.endsWith('/firebase-app.js'))return {initializeApp:()=>({})};
      assert(path.endsWith('/firebase-auth.js'));return sdk;
    }
  });
  const source=await readFile(new URL('../web/auth-client.js',import.meta.url),'utf8');
  runInContext(source.replaceAll('import(', 'loadSdk('),context);
  for(const [from,expected] of [['#planes?revisar=1','#planes?revisar=1'],
    ['#suscripcion?seccion=baja','#suscripcion?seccion=baja'],
    ['#perfil?seccion=pareja&juego=3','#perfil?seccion=pareja&juego=3'],
    ['#perfil?seccion=pareja&juego=99','#perfil'],['https://other.example.test/checkout','#perfil']]){
    calls.length=0;location.hash=from;
    await browser.AccountAccess.register(' Alicia ', ' alice@example.test ', 'fixture-password-for-local-test',true);
    assert.deepEqual(calls,[['crear',email('alice')],['nombre',email('alice'),'Alicia'],['verificar',email('alice'),origin+'/'+expected]]);
  }
});

test('La cuenta gratuita se abre en preapertura y solo el destinatario verificado puede aceptar para su propio bloque',async()=>{
  const h=harness();
  assert.equal((await h.ok('', '/api/auth/config')).enabled,true);
  assert.equal((await h.ok('', '/api/billing/config')).checkoutAvailable,false);
  assert.equal((await h.ok('alice','/api/bootstrap')).profile.userId,'alice');
  assert.deepEqual((await h.ok('alice','/api/partners')).availableCases,[]);
  assert.equal((await h.call('', '/api/partners')).status,401);
  await h.prefer('alice','bob');
  assert.equal((await h.call('alice','/api/partners/play',{caseId:1,paid:true})).httpStatus,402);
  await h.fund('alice',2);
  const first=await h.startPair('alice',1,'bob');
  assert.equal(first.status,'pending');
  await h.choose('alice',1);
  assert.deepEqual((await h.list('alice')).map(row=>row.id),[first.id]);
  assert.equal((await h.game('alice')).partner,null);
  assert.equal((await h.ok('bob','/api/bootstrap')).membership.canPlay,false);
  assert.deepEqual((await h.list('bob')).map(row=>[row.id,row.direction]),[[first.id,'received']]);
  assert.deepEqual(await h.list('eve'),[]);
  assert.equal((await h.call('bob','/api/partners/'+first.id+'/accept',{})).code,'CHOOSE_IN_GAME');
  assert.equal((await h.call('alice','/api/partners',{caseId:1,email:email('bob')})).code,'CHOOSE_IN_GAME');
  assert.equal((await h.call('bob','/api/partners/play',{caseId:1})).httpStatus,402);
  await h.fund('bob');await h.fund('eve');
  await h.prefer('eve','alice');
  const third=await h.call('eve','/api/partners/play',{caseId:1,invitationId:first.id,saveIfEmpty:true});
  assert(third.httpStatus>=400);
  assert.equal((await h.game('eve')).partner,null);
  assert.equal((await h.choose('bob',1)).partner.role,'B');
  assert.equal((await h.choose('bob',1)).partner.id,first.id);
  assert.equal((await h.list('alice'))[0].status,'accepted');
  await h.choose('alice',5);
  assert.ok([402,409].includes((await h.call('bob','/api/partners/play',{caseId:5})).httpStatus));
  assert.deepEqual((await h.ok('bob','/api/partners')).availableCases,[1,2,3,4]);
  await h.fund('alice',4);await h.finishFirstSeason('alice');
  await h.fund('bob',4);
  await h.choose('alice',13);
  assert.ok([402,409].includes((await h.call('bob','/api/partners/play',{caseId:13})).httpStatus));
  await h.finishFirstSeason('bob');
  assert.equal((await h.choose('bob',13)).status,'accepted');
});

test('Cada caso necesita dos elecciones; la salida conserva el avance y cancela solo la partida elegida',async()=>{
  const h=harness(),route='/api/partners/play';
  for(const uid of ['alice','bob','eve'])await h.fund(uid);
  assert.equal((await h.call('alice',route,{caseId:1})).code,'PARTNER_REQUIRED');
  await h.prefer('alice','bob');await h.prefer('bob','alice');
  assert.equal((await h.call('alice',route,{caseId:1,email:email('eve')})).httpStatus,400);
  const both=await Promise.all([h.choose('alice',1),h.choose('bob',1)]);
  assert.deepEqual(both.map(result=>result.status).sort(),['accepted','pending']);
  const [a,b]=await Promise.all([h.game('alice'),h.game('bob')]);
  assert.equal(a.partner.id,b.partner.id);
  assert.deepEqual([a.partner.role,b.partner.role].sort(),['A','B']);
  await h.game('alice','/stage',{index:0,choice:['b'],partnerId:a.partner.id});
  assert.equal((await h.choose('bob',2)).status,'pending');
  assert.equal((await h.list('alice')).find(row=>row.caseId===2).status,'pending');
  await h.game('bob','/mode',{mode:'solo',partnerId:null},2);
  assert.deepEqual((await h.list('alice')).map(row=>row.caseId),[1]);
  assert.equal((await h.game('alice')).partner.id,a.partner.id);
  await h.prefer('alice','eve');
  for(const uid of ['alice','bob']){
    const solo=await h.game(uid);
    assert.equal(solo.partner,null);assert.equal(solo.hour.current,1);
    assert.deepEqual(await h.list(uid),[]);
  }
  const request=await h.choose('alice',1);
  assert.equal(request.status,'pending');
  const remaining=(await h.list('alice'))[0];
  await h.ok('eve',route,{caseId:1,invitationId:remaining.id,saveIfEmpty:true});
  assert.equal((await h.ok('eve','/api/partners/preferred')).preferredEmail,email('alice'));
  assert.equal((await h.game('eve')).partner.id,remaining.id);
  assert.equal((await h.game('bob')).partner,null);
});

test('La persona habitual es una preferencia privada, disponible gratis y en edición, sin correos ni asignaciones automáticas',async()=>{
  const h=harness(),path='/api/partners/preferred';
  assert.equal((await h.call('',path,{email:email('bob')})).status,401);
  for(const uid of ['alice','editor']){
    assert.equal((await h.ok(uid,path)).preferredEmail,null);
    assert.equal((await h.ok(uid,path,{email:'  BOB@EXAMPLE.TEST  '})).preferredEmail,email('bob'));
    assert.equal((await h.ok(uid,path)).preferredEmail,email('bob'));
    for(const invalid of [email(uid),'sin-arroba']){
      assert.equal((await h.call(uid,path,{email:invalid})).status,400);
      assert.equal((await h.ok(uid,path)).preferredEmail,email('bob'));
    }
  }
  await h.ok('eve',path,{email:email('editor'),userId:'alice'});
  assert.equal((await h.ok('alice',path)).preferredEmail,email('bob'));
  assert.equal((await h.ok('bob',path)).preferredEmail,null);
  assert.equal(h.membershipLookups,0);
  assert.deepEqual(h.queuedMail,[]);
  assert.deepEqual(await h.list('bob'),[]);
  await h.fund('alice');
  await h.choose('alice',1);
  await h.ok('alice',path,{email:email('eve')});
  assert.equal((await h.ok('alice','/api/partners')).preferredEmail,email('eve'));
  await h.ok('alice',path,{email:null});
  assert.equal((await h.ok('alice',path)).preferredEmail,null);
  assert.equal((await h.ok('editor',path)).preferredEmail,email('bob'));
  assert.deepEqual(await h.list('bob'),[]);
  assert.deepEqual(await h.list('eve'),[]);
  assert(h.queuedMail.every(message=>message.type==='case_invitation'&&message.address===email('bob')));
});

test('Dos cuentas comparten los pasos y el desenlace, conservan sus llaves y rechazan cambios de una pareja anterior',async()=>{
  const h=harness();
  for(const uid of ['alice','bob','eve'])await h.fund(uid);
  await assert.rejects(h.game('alice','/mode',{mode:'duo'}),{status:409,code:'PAIR_REQUIRED'});
  const {id}=await h.startPair('alice',1,'bob');
  await assert.rejects(h.game('alice','/mode',{mode:'duo'}),{status:409,code:'PAIR_REQUIRED'});
  await h.choose('bob',1);
  const alice=await h.game('alice'),bob=await h.game('bob');
  assert.equal(alice.partner.id,id);assert.equal(bob.partner.id,id);
  assert.deepEqual([alice.partner.role,bob.partner.role],['A','B']);
  assert.deepEqual(alice.wallet.won,[]);assert.equal(bob.wallet.gift,1);
  const stage=index=>({index,choice:['b'],partnerId:id});
  const again=await Promise.all([h.game('alice','/stage',stage(0)),h.game('bob','/stage',stage(0))]);
  assert.deepEqual(again.map(result=>result.hour.current),[1,1]);
  assert.equal((await h.game('alice')).hour.current,1);
  assert.equal((await h.game('bob')).hour.current,1);
  assert.equal((await h.game('eve')).hour.current,0);
  await assert.rejects(h.game('eve','/stage',stage(0)),error=>error.status>=400);
  await assert.rejects(h.game('bob','/stage',{index:1,choice:['b']}),error=>error.status>=400);
  await h.game('alice','/open',{partnerId:id,quotedCost:1});
  assert.equal((await h.game('alice')).wallet.balance,0);
  assert.equal((await h.game('bob')).wallet.balance,1);
  assert.deepEqual((await h.game('bob')).hints,(await h.game('alice')).hints);
  assert.equal((await h.game('bob','/open',{partnerId:id})).wallet.balance,1);
  await h.stop('bob');
  await assert.rejects(h.game('bob','/stage',stage(1)),error=>error.status>=400);
  await h.fund('bob');
  for(let i=1;i<5;i++)await h.game(i%2?'bob':'alice','/stage',stage(i));
  await h.game('alice','/deduce',{partnerId:id,hypothesis:'archivo'});
  await h.game('bob','/ending',{partnerId:id,choice:'guardar'});
  await h.game('alice','/ending',{partnerId:id,choice:'guardar'});
  for(const uid of ['alice','bob']){
    const saved=await h.game(uid);
    assert.equal(saved.progress.choice,'guardar');
    assert.equal(saved.wallet.history.filter(row=>row.kind==='adventureEnding'&&row.amount===1).length,1);
  }
  assert.equal((await h.game('eve')).progress.choice,null);
  await h.game('alice','/mode',{partnerId:id,mode:'solo'});
  await assert.rejects(h.game('bob','/stage',stage(0)),error=>error.status>=400);
  for(const uid of ['alice','bob']){
    const solo=await h.game(uid);
    assert.equal(solo.mode,'solo');assert.equal(solo.partner,null);
    assert.equal(solo.hour.current,5);assert.equal(solo.progress.choice,'guardar');
  }
});

test('Los cuerpos privados de cada papel permanecen separados al abrir, avanzar, reintentar y releer el diario',async()=>{
  const h=harness();
  for(const uid of ['alice','bob']){await h.fund(uid,4);await h.finishFirstSeason(uid);}
  const game=(uid,route,input)=>h.game(uid,route,input,13);
  const {id}=await h.startPair('alice',13,'bob');
  await h.choose('bob',13);
  function check(message,role){
    const other=role==='A'?'B':'A';
    assert(!JSON.stringify(message).includes('contenido-'+other+'-'));
    const expected=[role,'AB'];
    assert.deepEqual(message.hour.stage.materials.map(item=>item.role),expected);
    for(const past of message.hour.journal)assert.deepEqual(past.materials.map(item=>item.role),expected);
    assert.deepEqual(message.hour.stage.corroboration.options,['A','B','AB'].map(id=>({id,label:'Fuente '+id})));
    if(message.story){
      assert.deepEqual(message.story.evidenceCards.map(item=>item.role),expected);
      assert.deepEqual(message.side.materials.map(item=>item.role),expected);
      const own=role==='A'?0:1;
      assert.equal(message.story.roles[own],'contenido-'+role+'-consigna');
      assert.match(message.story.roles[1-own],/documento/);
    }
  }
  for(const [uid,role] of [['alice','A'],['bob','B']])check(await game(uid),role);
  const step={index:0,choice:['b'],sources:['A','B'],partnerId:id,role:'B'};
  const next=await game('alice','/stage',step);
  assert.equal(next.hour.journal.length,1);check(next,'A');
  const retry=await game('bob','/stage',{...step,role:'A'});
  assert.equal(retry.hour.current,1);check(retry,'B');
  for(const [uid,role] of [['alice','A'],['bob','B']])check(await game(uid),role);
  await game('bob','/mode',{partnerId:id,mode:'solo'});
  const solo=await game('bob');
  assert.deepEqual(solo.story.roles,twoPapers.roles);
  for(const materials of [solo.hour.stage.materials,solo.hour.journal[0].materials,solo.story.evidenceCards,solo.side.materials]){
    assert.deepEqual(materials.map(item=>item.role),['A','B','AB']);
  }
});

test('Una pareja guardada con la edición anterior conserva su avance y debe volver a elegir el modo en ambas cuentas',async()=>{
  const h=harness();
  await h.fund('alice');await h.fund('bob');
  await h.prefer('alice','bob');await h.prefer('bob','alice');
  await h.seedLegacyPair('alice','bob');
  for(const uid of ['alice','bob']){
    const personal=await h.game(uid);
    assert.equal(personal.partner,null);assert.equal(personal.hour.current,1);
    assert.deepEqual(await h.list(uid),[]);
  }
  assert.equal((await h.choose('bob',1)).status,'pending');
  assert.equal((await h.game('alice')).partner,null);
  assert.equal((await h.choose('alice',1)).status,'accepted');
  assert.equal((await h.game('alice')).hour.current,1);
});

test('Dos cuentas editoriales o una editorial y otra de pago pueden emparejarse en ambos sentidos con álbumes separados',async()=>{
  for(const [owner,guest] of [['editor','curator'],['curator','editor'],['curator','bob'],['bob','curator']]){
    const h=harness();
    for(const uid of [owner,guest]){
      if(isGameEditor(identity(uid))){
        assert.equal((await h.ok(uid,'/api/partners')).availableCases.length,48);
      }else{
        await h.fund(uid);
        assert.deepEqual((await h.ok(uid,'/api/partners')).availableCases,[1,2,3,4]);
      }
    }
    const caseId=owner==='bob'||guest==='bob'?1:13;
    const game=(uid,route,input)=>h.game(uid,route,input,caseId);
    const {id}=await h.startPair(owner,caseId,guest);
    await h.choose(guest,caseId);
    const pair=await Promise.all([game(owner),game(guest)]);
    assert.deepEqual(pair.map(dossier=>dossier.partner?.role),['A','B'],owner+' + '+guest);
    if(caseId===13)for(const [index,dossier] of pair.entries()){
      assert(!JSON.stringify(dossier).includes('contenido-'+(index===0?'B':'A')+'-'));
    }
    await game(guest,'/stage',{index:0,choice:['b'],sources:['A','B'],partnerId:id,editorial:true});
    for(const uid of [owner,guest]){
      const editorial=isGameEditor(identity(uid));
      assert.equal(h.album(uid,editorial?'editorial':'paid')[caseId].hourStep,1);
      assert.deepEqual(h.album(uid,editorial?'paid':'editorial'),{});
    }
    if([owner,guest].includes('bob')){
      await h.stop('bob');
      await assert.rejects(game('bob','/stage',{index:1,choice:['b'],partnerId:id,role:'admin'}),
        error=>error.status===402||error.status===409);
      const editor=owner==='bob'?guest:owner;
      assert.equal((await game(editor)).partner,null);
      assert.equal((await game(editor)).hour.current,1);
    }
  }
});

test('La exención de juego procede de la identidad comprobada y no concede la gestión a la segunda cuenta editorial',async()=>{
  const h=harness();
  const flags={userId:'curator',name:'editor',role:'admin',isGameEditor:true,editorial:true,ownerScope:'editorial',guestScope:'editorial'};
  assert.equal((await h.call('curator','/api/admin/analytics')).status,403);
  await h.prefer('lookalike','bob');
  assert.equal((await h.call('lookalike','/api/partners/play',{caseId:1,...flags})).httpStatus,402);
  for(const uid of ['bob','lookalike']){
    const invitation=await h.startPair('editor',1,uid);
    assert.equal((await h.call(uid,'/api/partners/play',{caseId:1,...flags})).status,402);
    assert.deepEqual((await h.ok(uid,'/api/partners')).availableCases,[]);
    await h.ok('editor','/api/partners/'+invitation.id+'/revoke',{});
  }
  await h.fund('bob');
  await h.startPair('curator',5,'bob');
  assert.ok([402,409].includes((await h.call('bob','/api/partners/play',{caseId:5,...flags})).status));
});

test('El inventario cooperativo verifica el papel, comparte objetos y acredita la misión una vez a ambos',async()=>{
  const h=harness();
  for(const uid of ['alice','bob']){await h.fund(uid,4);await h.finishFirstSeason(uid);}
  const {id}=await h.startPair('alice',13,'bob');
  await h.choose('bob',13);
  const game=(uid,action,input)=>h.game(uid,action,input,13);
  const play=(uid,operation,args={})=>game(uid,'/inventory',{index:0,partnerId:id,operation,...args});
  await assert.rejects(play('alice','visit',{index:4}),{status:409});
  await play('alice','visit');
  await assert.rejects(play('alice','collect',{item:'B',role:'B'}),{status:400});
  await assert.rejects(play('bob','combine',{items:['A','B']}),{status:400});
  await Promise.all([play('alice','collect',{item:'A'}),play('bob','collect',{item:'B'})]);
  for(const [uid,other] of [['alice','B'],['bob','A']]){
    const dossier=await game(uid);
    assert(!JSON.stringify(dossier.hour.inventory).includes('contenido-'+other+'-'));
    assert.equal(dossier.hour.inventory.rooms[0].items.filter(item=>item.held).length,2);
  }
  const joined=await Promise.all([play('alice','combine',{items:['A','B']}),play('bob','combine',{items:['B','A']})]);
  assert.equal(joined[0].inventory.rooms[0].links.length,1);
  for(const uid of ['alice','bob']){
    const {wallet,hour}=await game(uid);
    assert.deepEqual(wallet.history.filter(row=>row.kind==='mission').map(row=>row.amount),[1]);
    assert.equal(hour.inventory.rooms[0].assignment.complete,true);
  }
  await game('bob','/mode',{partnerId:id,mode:'solo'});
  for(const uid of ['alice','bob']){
    assert.equal((await game(uid)).hour.inventory.rooms[0].links.length,1);
    await assert.rejects(play(uid,'combine',{items:['A','B']}),{code:'PAIR_CHANGED'});
  }
});
