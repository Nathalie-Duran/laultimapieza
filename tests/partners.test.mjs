import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {ApiError} from '../auth-provider.mjs';
import {createGameApi} from '../game-api.mjs';
import {valdemarRequest} from '../valdemar-api.mjs';
import {worldSeasonAccess} from '../valdemar-wallet.mjs';

const origin='https://example.test';
const config={apiKey:'fixture',projectId:'fixture',appId:'fixture',authDomain:'fixture.test'};
const email=uid=>uid+'@example.test';
const identity=uid=>({userId:uid,name:uid,email:email(uid),emailVerified:true});
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
const twoPapers={...story,id:13,evidenceCards:clues('expediente'),
  side:{title:'Comparar las fuentes',mode:'multi',options:[],materials:clues('reto')},
  hour:{stages:story.hour.stages.map((stage,i)=>({...stage,materials:clues('etapa-'+i),
    corroboration:{prompt:'Contrasta dos fuentes',answer:['A','B']}}))}};
const releases={stories:[story],samples:[],nuevos:[twoPapers]};

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
  const api=createGameApi({config,withStore,billing,stories:[],origins:[origin],isAdministrator:user=>user.userId==='editor',verify:async request=>{
    const uid=request.headers.get('authorization');
    if(!['alice','bob','eve','editor'].includes(uid))throw new ApiError(401,'Inicia sesión.');
    return identity(uid);
  }});
  async function call(uid,path,input){
    const response=await api(new Request(origin+path,{method:input?'POST':'GET',
      headers:{authorization:uid||'',origin,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}));
    return {status:response.status,...await response.json()};
  }
  async function ok(uid,path,input){
    const result=await call(uid,path,input);
    assert.equal(result.status,200,JSON.stringify(result));
    return result;
  }
  return {
    call,ok,
    get queuedMail(){return [...data.mail.values()].map(message=>structuredClone(message));},
    get membershipLookups(){return membershipLookups;},
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
    async invite(uid,caseId,to){
      await ok(uid,'/api/partners',{caseId,email:to});
      return (await this.list(uid)).find(row=>row.caseId===caseId&&row.direction==='sent');
    },
    async game(uid,route='',input,caseId=1){
      return valdemarRequest({path:'/api/valdemar/cases/'+caseId+route,method:input?'POST':'GET',input,uid,
        user:identity(uid),editorial:false,billing,withStore,loadRelease:async()=>releases});
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
  assert.equal((await h.call('alice','/api/partners',{caseId:1,email:email('bob'),paid:true})).status,402);
  await h.fund('alice',2);
  const first=await h.invite('alice',1,' BOB@EXAMPLE.TEST ');
  assert.equal(first.status,'pending');
  await h.ok('alice','/api/partners',{caseId:1,email:email('bob')});
  assert.deepEqual((await h.list('alice')).map(row=>row.id),[first.id]);
  assert.equal((await h.ok('bob','/api/bootstrap')).membership.canPlay,false);
  assert.deepEqual((await h.list('bob')).map(row=>[row.id,row.direction]),[[first.id,'received']]);
  assert.deepEqual(await h.list('eve'),[]);
  const accept='/api/partners/'+first.id+'/accept';
  assert.ok([403,404].includes((await h.call('eve',accept,{email:email('bob'),guestId:'bob'})).status));
  assert.equal((await h.call('bob',accept,{})).status,402);
  await h.fund('bob');
  await h.ok('bob',accept,{});
  await h.ok('bob',accept,{});
  assert.equal((await h.list('alice'))[0].status,'accepted');
  const fifth=await h.invite('alice',5,email('bob'));
  assert.ok([402,409].includes((await h.call('bob','/api/partners/'+fifth.id+'/accept',{})).status));
  assert.deepEqual((await h.ok('bob','/api/partners')).availableCases,[1,2,3,4]);
  await h.fund('alice',4);await h.finishFirstSeason('alice');
  await h.fund('bob',4);
  const amber=await h.invite('alice',13,email('bob'));
  assert.ok([402,409].includes((await h.call('bob','/api/partners/'+amber.id+'/accept',{})).status));
  await h.finishFirstSeason('bob');
  await h.ok('bob','/api/partners/'+amber.id+'/accept',{});
});

test('Las parejas se eligen por juego y una retirada o un rechazo libera el sitio sin afectar al otro juego',async()=>{
  const h=harness();
  for(const uid of ['alice','bob','eve'])await h.fund(uid);
  const first=await h.invite('alice',1,email('bob'));
  const second=await h.invite('alice',2,email('eve'));
  await h.ok('eve','/api/partners/'+second.id+'/accept',{});
  assert.deepEqual((await h.list('bob')).map(row=>row.caseId),[1]);
  assert.deepEqual((await h.list('eve')).map(row=>row.caseId),[2]);
  await h.ok('alice','/api/partners/'+first.id+'/revoke',{});
  assert.deepEqual(await h.list('bob'),[]);
  assert.ok((await h.call('bob','/api/partners/'+first.id+'/accept',{})).status>=400);
  const replacement=await h.invite('alice',1,email('eve'));
  await h.ok('eve','/api/partners/'+replacement.id+'/decline',{});
  assert.deepEqual((await h.list('alice')).map(row=>[row.caseId,row.status]),[[2,'accepted']]);
  assert.equal((await h.invite('alice',1,email('bob'))).status,'pending');
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
  const invite=await h.invite('alice',1,email('bob'));
  await h.ok('alice',path,{email:email('eve')});
  assert.equal((await h.ok('alice','/api/partners')).preferredEmail,email('eve'));
  await h.ok('alice',path,{email:null});
  assert.equal((await h.ok('alice',path)).preferredEmail,null);
  assert.equal((await h.ok('editor',path)).preferredEmail,email('bob'));
  assert.deepEqual((await h.list('bob')).map(row=>[row.id,row.status]),[[invite.id,'pending']]);
  assert.deepEqual(await h.list('eve'),[]);
  assert.deepEqual(h.queuedMail.map(message=>[message.type,message.address]),[['case_invitation',email('bob')]]);
});

test('Dos cuentas comparten los pasos y el desenlace, conservan sus llaves y rechazan cambios de una pareja anterior',async()=>{
  const h=harness();
  for(const uid of ['alice','bob','eve'])await h.fund(uid);
  await assert.rejects(h.game('alice','/mode',{mode:'duo'}),{status:409,code:'PAIR_REQUIRED'});
  const {id}=await h.invite('alice',1,email('bob'));
  await assert.rejects(h.game('alice','/mode',{mode:'duo'}),{status:409,code:'PAIR_REQUIRED'});
  await h.ok('bob','/api/partners/'+id+'/accept',{});
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
  await h.game('alice','/open',{partnerId:id});
  assert.equal((await h.game('alice')).wallet.balance,0);
  assert.equal((await h.game('bob')).wallet.balance,1);
  await h.stop('bob');
  await assert.rejects(h.game('bob','/stage',stage(1)),error=>error.status>=400);
  await h.fund('bob');
  for(let i=1;i<5;i++)await h.game(i%2?'bob':'alice','/stage',stage(i));
  await h.game('alice','/deduce',{partnerId:id,hypothesis:'archivo'});
  await h.game('bob','/ending',{partnerId:id,choice:'guardar'});
  for(const uid of ['alice','bob'])assert.equal((await h.game(uid)).progress.choice,'guardar');
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
  const {id}=await h.invite('alice',13,email('bob'));
  await h.ok('bob','/api/partners/'+id+'/accept',{});
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
  for(const materials of [solo.hour.stage.materials,solo.hour.journal[0].materials,solo.story.evidenceCards,solo.side.materials]){
    assert.deepEqual(materials.map(item=>item.role),['A','B','AB']);
  }
});
