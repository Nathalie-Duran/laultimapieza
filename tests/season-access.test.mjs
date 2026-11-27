import test from 'node:test';
import assert from 'node:assert/strict';
import {valdemarRequest} from '../valdemar-api.mjs';
import {releaseCalendar} from '../progression.mjs';
import {worldSeasonAccess,resetValdemarProgress} from '../valdemar-wallet.mjs';
import {createBilling} from '../billing.mjs';
import {createHmac,randomBytes} from 'node:crypto';
import {summarizeSeasonActivity} from '../season-activity.mjs';

const now = Date.now();
const day = 86400000;
function memberAt(month, revoked = []) {
  const cycles = Array.from({length:month}, (_,i) => {
    const start = now - (month-i-1)*30*day - day;
    return {id:'inv-'+i,start,end:start+30*day,subscription:'sub-fixture',...(i>=3?{worldBlock:i+1}:{}),revoked:revoked.includes(i+1)};
  });
  return {cycles,active:true,subscription:'sub-fixture'};
}
function complete(d,ids){
  d.valdemarCaseProgress ||= {};
  d.valdemarCaseProgress.paid ||= {};
  for(const id of ids)d.valdemarCaseProgress.paid[id]={hourStep:5,deduced:true,choice:'c'};
  return d;
}
const numbers = (start,end) => Array.from({length:end-start+1},(_,i)=>start+i);
const options = ['x','y','z'].map(id=>({id,label:'Pieza '+id}));
const materials = [{id:'doc',label:'Parte',kind:'text',body:'Hay una señal azul.',role:'A'}];
const world = id => ({
  id,title:'Caso de ensayo '+id,place:'Estudio',question:'¿Qué explica la señal del caso '+id+'?',intro:'Se oye un ruido.',roles:['Escucha','Mira'],
  choices:[{id:'c',label:'Guardar'}],hypotheses:[{id:'h',label:'La explicación'}],correctHypothesis:'h',
  deduction:'RESOLUCION PRIVADA',outcomes:{c:'FIN PRIVADO'},hints:['AYUDA PRIVADA','SEGUNDA AYUDA'],
  side:{title:'Reconstruir',brief:'Compara',materials,mode:id===13?'order':'multi',options,answer:['y','x'],success:'PREMIO PRIVADO',retry:'Aún no encajan.'},
  hour:{stages:numbers(1,5).map(i=>({title:'Etapa '+i,place:'Estudio',minutes:12,brief:'Investigad '+i,materials,task:'Ordenad',mode:'order',options,answer:['x','z'],success:'Acertado',retry:'Volved a comprobarlo.'}))}
});
const release = {stories:numbers(1,12).map(world),samples:[],nuevos:numbers(13,48).map(world),
  sellos:numbers(1,4).map(number=>({number,title:'Sello '+number,epilogue:'EPILOGO PRIVADO '+number}))};
function service(seed) {
  let committed=structuredClone(seed),tail=Promise.resolve(),loads=0,writes=0;
  const withStore = fn => {
    const tx = tail.then(async()=>{
      let copy=structuredClone(committed);
      const result=await fn({getMemberData:async()=>structuredClone(copy),saveMemberData:async(_,data)=>{writes++;copy=structuredClone(data);}});
      committed=copy;
      return result;
    });
    tail=tx.catch(()=>{});
    return tx;
  };
  return {
    get data(){return committed;}, get loads(){return loads;}, get writes(){return writes;},
    update(change){return withStore(async store=>{const data=await store.getMemberData();await change(data);await store.saveMemberData('fixture',data);});},
    async call(path,input,editorial=false) {
      return valdemarRequest({path:'/api/valdemar/'+path,method:input===undefined?'GET':'POST',input,uid:'fixture',editorial,withStore,
        loadRelease:async()=>{loads++;return release;},
        billing:{membership:async(store)=>{const d=await store.getMemberData();return {canPlay:d.active,calendar:releaseCalendar(d.cycles||[])};}}
      });
    }
  };
}
test('season activity dates genuine actions only, preserves unknown legacy starts and isolates editors',async()=>{
  const api=service(memberAt(1));
  await api.call('cases/1');
  assert(!api.data.valdemarCaseProgress?.paid?.[1]);
  await api.call('cases/1/mode',{mode:'solo'});
  const start=api.data.valdemarCaseProgress.paid[1].startedAt;
  assert(Number.isFinite(start));
  await api.call('cases/1/mode',{mode:'solo'});
  assert.equal(api.data.valdemarCaseProgress.paid[1].updatedAt,start);
  const first={index:0,choice:['x','z']};
  await api.call('cases/2/stage',{index:0,choice:['z','x']});
  assert.equal(api.data.valdemarCaseProgress.paid[2],undefined);
  await api.call('cases/2/stage',first);
  const stage=structuredClone(api.data.valdemarCaseProgress.paid[2]);
  assert.equal(stage.startedAt,stage.firstAdvancedAt);
  await api.call('cases/2/stage',first);
  assert.deepEqual(api.data.valdemarCaseProgress.paid[2],stage);
  await api.call('cases/3/mode',{mode:'solo'},true);
  assert.equal(api.data.valdemarCaseProgress.paid[3],undefined);
  assert.equal((await api.call('partidas')).games[1].updatedAt,stage.updatedAt);
  const old=memberAt(1);
  old.valdemarCaseProgress={paid:{1:{mode:'duo',hourStep:2}}};
  old.valdemarSeasonOne={paid:{welcomes:[],won:[2],opened:[],second:[]}};
  const legacy=service(old);
  assert.equal((await legacy.call('cases/1')).mode,'solo');
  await legacy.call('cases/1/mode',{mode:'solo'});
  await legacy.call('cases/2/mode',{mode:'solo'});
  for(const id of [1,2]){assert(Number.isFinite(legacy.data.valdemarCaseProgress.paid[id].updatedAt));assert.equal(legacy.data.valdemarCaseProgress.paid[id].startedAt,undefined);}
});
test('14-day activity measures a different case with a confirmed stage, and only mature known-start accounts',()=>{
  const since=now-100*day, startedAt=now-20*day;
  const row=(progress={},extra={})=>({progress,cycles:[],sideIds:new Set(),...extra});
  const users=[
    row({1:{startedAt},2:{startedAt:startedAt+day,firstAdvancedAt:startedAt+14*day}}),
    row({1:{startedAt,firstAdvancedAt:startedAt+day},2:{startedAt:startedAt+day}}),
    row({1:{startedAt},2:{startedAt:startedAt+day,firstAdvancedAt:startedAt+14*day+1}}),
    row({1:{startedAt:now-day},2:{startedAt:now,firstAdvancedAt:now}}),
    row({1:{startedAt},2:{mode:'solo',hourStep:2}}),
    row({1:{startedAt}},{sideIds:new Set([7])}),
    row({1:{startedAt},2:{startedAt:startedAt+1,firstAdvancedAt:startedAt+day}},{resetAt:since}),
    row({1:{startedAt},2:{startedAt,firstAdvancedAt:startedAt+1}})
  ];
  const result=summarizeSeasonActivity(users,{days:30,now,first:now-29*day,since});
  assert.equal(result.cohort.eligible,3);
  assert.equal(result.firstPlayers,5);
  assert.equal(result.cohort.second,1);
  assert.equal(result.olderStarts,2);
  assert.equal(result.seasons.length,4);
  assert.equal(result.seasons[0].cases[0].started,8);
});
test('season purchases count eligible holders once and exclude incomplete, future and refunded periods',()=>{
  const prior=memberAt(4);
  const cases=complete(prior,numbers(1,12));
  const fourth=prior.cycles[3];
  const row=(progress,cycles)=>({progress,cycles,sideIds:new Set()});
  const custom=(fields)=>[...prior.cycles.slice(0,3),{...fourth,...fields}];
  const rows=[
    row(cases.valdemarCaseProgress.paid,prior.cycles),
    row(cases.valdemarCaseProgress.paid,custom({revoked:true})),
    row(cases.valdemarCaseProgress.paid,custom({start:now+day,end:now+8*day})),
    row({1:{choice:'c'}},prior.cycles),
    row(cases.valdemarCaseProgress.paid,prior.cycles.map((v,i)=>i===0?{...v,revoked:true}:v))
  ];
  const {transitions}=summarizeSeasonActivity(rows,{days:30,first:now-29*day,now,since:now-day});
  assert.deepEqual(transitions[0],{from:1,eligible:3,bought:1});
});
test('a paid cycle unlocks the correct four cases, without changing the established calendar',async()=>{
  for(const month of numbers(1,12)){
    const state=memberAt(month);
    complete(state,numbers(1,Math.floor((month-1)/3)*12));
    const api=service(state);const visible=await api.call('seasons');
    assert.deepEqual(visible.availableCases,numbers(1,month*4));assert.equal(visible.wallet.gift,1);
    assert.deepEqual((await api.call('wallet')).availableCases,numbers(1,Math.min(month*4,12)));
    if(month<12)await assert.rejects(api.call('cases/'+(month*4+1)),{code:month%3===0?'PREVIOUS_SEASON_REQUIRED':'CASE_NOT_RELEASED'});
  }
  const d=complete(memberAt(8,[2,5]),numbers(1,24));d.cycles.push({...d.cycles[7]});
  assert.deepEqual(worldSeasonAccess(d).availableCases,[...numbers(1,4),...numbers(9,16),...numbers(21,32)]);
  d.cycles.push({id:'future',subscription:d.subscription,start:now+day,end:now+5*day,worldBlock:9});
  assert(!worldSeasonAccess(d).availableCases.includes(33));d.active=false;assert.deepEqual(worldSeasonAccess(d).availableCases,[]);
});
test('new stories do not expose solutions, premature endings or paid content in other months',async()=>{
  const api=service(memberAt(3));await assert.rejects(api.call('cases/13'),{code:'PREVIOUS_SEASON_REQUIRED'});
  assert.equal(api.loads,0);await assert.rejects(api.call('cases/49',undefined,true),{status:404});
  for(const id of numbers(13,48)){
    const result=await api.call('cases/'+id,undefined,true);
    assert.equal(result.story.id,id);assert.equal(result.hour.stage.title,'Etapa 1');assert.equal(result.side.mode,id===13?'order':'multi');
    assert.equal(result.side.requiredCount,id===13?2:undefined);
    for(const key of ['answer','retry','success'])assert(!Object.hasOwn(result.side,key));
    for(const secret of ['RESOLUCION PRIVADA','FIN PRIVADO','AYUDA PRIVADA','PREMIO PRIVADO'])assert(!JSON.stringify(result).includes(secret));
  }
  assert.deepEqual((await api.call('seasons',undefined,true)).availableCases,numbers(1,48));
  for(const [action,payload,code] of [['stage',{index:1,choice:['x','z']},'HOUR_STAGE_CHANGED'],['deduce',{hypothesis:'h'},'HOUR_STAGES_REQUIRED'],['ending',{choice:'c'},'DEDUCTION_REQUIRED']]){
    await assert.rejects(api.call('cases/36/'+action,payload,true),{code});
  }
});
test('parallel puzzles share the keyring; ordered and unordered choices validate privately and reward once',async()=>{
  const api=service(complete(memberAt(9),numbers(1,24)));const act=(id,op,input={},editorial=false)=>api.call('cases/'+id+'/'+op,input,editorial);
  for(const invalid of [['x','y'],['y','y'],['u','v'],[],null,['x'],['y','x','z']])await assert.rejects(act(13,'reward',{proof:{choice:invalid}}),{status:422});
  const proof={proof:{choice:['y','x']}};
  const wins=await Promise.all([act(13,'reward',proof),act(13,'reward',proof)]);
  assert.equal(wins[0].wallet.balance,2);assert.equal(wins[1].wallet.balance,2);assert.equal(wins[1].feedback,'PREMIO PRIVADO');
  assert.equal((await act(25,'reward',{proof:{choice:['x','y']}})).wallet.balance,3);
  await act(25,'open',{quotedCost:1});await assert.rejects(act(25,'second'),{code:'HINT_PRICE_CHANGED'});await act(25,'second',{quotedCost:2});assert.deepEqual((await api.call('cases/25')).hints,['AYUDA PRIVADA','SEGUNDA AYUDA']);
  assert.equal((await api.call('wallet')).wallet.balance,0);assert.equal((await api.call('seasons',undefined,true)).wallet.balance,1);
  for(const index of numbers(0,4)){const result=await act(36,'stage',{index,choice:['x','z']});assert.equal(result.hour.current,index+1);}
  assert.equal((await act(36,'deduce',{hypothesis:'h'})).progress.deduction,'RESOLUCION PRIVADA');
  assert.equal((await act(36,'ending',{choice:'c'})).progress.outcome,'FIN PRIVADO');
  assert.deepEqual((await api.call('seasons')).completed,[...numbers(1,24),36]);assert.deepEqual((await api.call('wallet')).completed,numbers(1,12));
});
test('all twelve prior paid endings are required for every new operation, across all three season boundaries',async()=>{
  for(const [missing,target] of [[2,13],[15,25],[5,36],[36,37],[27,48],[3,37]]){
    const d=complete(memberAt(12),numbers(1,36));delete d.valdemarCaseProgress.paid[missing];
    d.valdemarCaseProgress.editorial={[missing]:{choice:'c'}};
    const api=service(d);
    for(const [route,input] of [['',undefined],['/stage',{index:0,choice:['x','z']}],['/deduce',{hypothesis:'h'}],['/ending',{choice:'c'}],['/reward',{proof:{choice:['y','x']}}],['/open',{}],['/second',{}]]){
      await assert.rejects(api.call('cases/'+target+route,input),{code:'PREVIOUS_SEASON_REQUIRED'});
    }
    await assert.rejects(api.call('cases/'+target+'/mode',{mode:'duo'}),{code:'PREVIOUS_SEASON_REQUIRED'});
    assert.equal((await api.call('seasons')).availableCases.includes(target),false);
    assert((await api.call('seasons',undefined,true)).availableCases.includes(target));
  }
});
test('all 48 paid games require a real partner for duo and preserve personal checkpoints, endings and keys',async()=>{
  const user=complete(memberAt(12),numbers(1,36));
  const api=service(user);
  for(const id of numbers(1,48)){
    const base='cases/'+id,change=mode=>api.call(base+'/mode',{mode});
    const initial=await api.call(base);
    assert.equal(initial.mode,null);
    for(const invalid of [null,'',true,'admin',['duo']])await assert.rejects(change(invalid),{code:'INVALID_PLAY_MODE'});
    await assert.rejects(change('duo'),{code:'PAIR_REQUIRED'});
    const [first,retry]=await Promise.all([change('solo'),change('solo')]);
    assert.deepEqual(first,{mode:'solo'});assert.deepEqual(retry,first);
    const reloaded=await api.call(base);assert.equal(reloaded.mode,'solo');
    assert.deepEqual(reloaded.hour,initial.hour);assert.deepEqual(reloaded.progress,initial.progress);assert.deepEqual(reloaded.wallet,initial.wallet);
    assert.equal((await api.call(base,undefined,true)).mode,null);
  }
  const all=await api.call('seasons');assert.deepEqual(all.completed,numbers(1,36));assert.equal(all.wallet.gift,1);
  await api.call('cases/48/reward',{proof:{choice:['y','x']}});
  await api.call('cases/48/open',{quotedCost:1});
  const [step]=await Promise.all([api.call('cases/48/stage',{index:0,choice:['x','z']}),api.call('cases/48/mode',{mode:'solo'})]);
  const reloaded=await api.call('cases/48');assert.equal(reloaded.mode,'solo');assert.equal(reloaded.hour.current,step.hour.current);
  assert.equal(reloaded.hints.length,1);assert(reloaded.wallet.opened.includes(48));assert(reloaded.wallet.won.includes(48));
  const other=service(user);assert.equal((await other.call('cases/48')).mode,null);
  await assert.rejects(service(memberAt(1)).call('cases/5/mode',{mode:'duo'}),{code:'CASE_NOT_RELEASED'});
  await assert.rejects(service({}).call('cases/1/mode',{mode:'duo'}),{code:'SUBSCRIPTION_REQUIRED'});
  await assert.rejects(api.call('cases/36/mode'),{status:405});
  await assert.rejects(api.call('cases/49/mode',{mode:'duo'}),{status:404});
});
test('the personal index shows actual progress and side puzzles after expiry, with isolated scopes',async()=>{
  const d=memberAt(1);
  d.valdemarCaseProgress={paid:{1:{},2:{mode:'duo'},3:{hourStep:2},4:{deduced:true},5:{choice:'c'}},editorial:{7:{mode:'solo'}}};
  d.valdemarSeasonOne={paid:{welcomes:[],won:[6],opened:[6],second:[]}};
  let api=service(d);
  await api.call('cases/1');const first=(await api.call('partidas')).games;
  assert.deepEqual(first.map(g=>g.id),[2,3,4,5,6]);
  assert.deepEqual(first[0],{id:2,mode:'solo',current:0,total:5,finished:false,available:true});
  assert.equal(first[1].current,2);assert.equal(first[3].current,5);assert.equal(first[3].finished,true);
  assert.deepEqual((await api.call('partidas',undefined,true)).games.map(g=>g.id),[7]);
  const old=structuredClone(api.data);old.active=false;old.cycles.forEach(c=>{c.start-=60*day;c.end-=60*day;});
  api=service(old);assert((await api.call('partidas')).games.every(g=>g.available===false));
  assert.equal(api.loads,0);await assert.rejects(api.call('partidas',{}),{status:405});
});
test('each of the four board seals counts distinct local endings only and guards its private epilogue after expiry or reset',async()=>{
  for(const number of numbers(1,4)){
    const base=(number-1)*12;
    for(const count of [0,1,11,12]){
      const member=complete(memberAt(12),numbers(1,base+count));
      member.cycles.forEach(c=>{c.end-=50*day;c.start-=50*day;});member.active=false;
      member.valdemarCaseProgress.paid[base+12] ||= {deduced:true,hourStep:5,mode:'duo'};
      member.valdemarSeasonOne={paid:{won:numbers(base+1,base+12),welcomes:[],opened:[],second:[]}};
      const api=service(member),summary=await api.call('seasons');
      assert.deepEqual(summary.seasons[number-1].seal,{earned:numbers(1,count),complete:count===12});
      assert(!JSON.stringify(summary).includes('EPILOGO PRIVADO'));
      await assert.rejects(api.call('seals/'+number,undefined,true),{code:'SEAL_INCOMPLETE'});
      if(count<12){await assert.rejects(api.call('seals/'+number),{code:'SEAL_INCOMPLETE'});assert.equal(api.loads,0);}
      else {
        assert.deepEqual(await api.call('seals/'+number),release.sellos[number-1]);
        const editorial=structuredClone(member);
        editorial.valdemarCaseProgress.editorial=Object.fromEntries(numbers(base+1,base+12).map(id=>[id,{choice:'c'}]));
        assert.deepEqual(await service(editorial).call('seals/'+number,undefined,true),release.sellos[number-1]);
        if(number>1){
          const missing=structuredClone(member);delete missing.valdemarCaseProgress.paid[base];
          await assert.rejects(service(missing).call('seals/'+number),{code:'PREVIOUS_SEASON_REQUIRED'});
        }
        resetValdemarProgress(editorial,{editorial:true});
        const reset=service(editorial);
        for(const scope of [false,true]){
          assert((await reset.call('seasons',undefined,scope)).seasons.every(s=>s.seal.earned.length===0&&!s.seal.complete));
          await assert.rejects(reset.call('seals/'+number,undefined,scope),{code:!scope && number>1?'PREVIOUS_SEASON_REQUIRED':'SEAL_INCOMPLETE'});
        }
      }
    }
  }
  const empty=service({});await assert.rejects(empty.call('seals/5'),{status:404});
  await assert.rejects(empty.call('seals/1',{}),{status:405});
});
test('a personal reset clears the paid and authorized editorial progress, keys and album without repeating the original gift',async()=>{
  const d=complete(memberAt(12),numbers(1,48));
  d.cycles.forEach((c,i)=>c.subscription='paid-pass-'+Math.ceil((i+1)/3));d.subscription='paid-pass-4';
  d.customer='external-customer';d.preferences={contrast:true};d.claims=['cartas-medianoche'];
  d.valdemarCaseProgress.editorial={48:{hourStep:5,deduced:true,choice:'c',mode:'duo'}};
  d.valdemarSeasonOne={paid:{welcomes:['paid-pass-1','paid-pass-4'],won:[13,25,37],opened:[3],second:[3]},
    editorial:{welcomes:['editorial'],won:[48],opened:[48],second:[48]}};
  const intact=structuredClone(d);
  const separate=structuredClone(d);resetValdemarProgress(separate);
  assert.deepEqual(separate.valdemarSeasonOne.editorial,intact.valdemarSeasonOne.editorial);
  assert.deepEqual(separate.valdemarCaseProgress.editorial,intact.valdemarCaseProgress.editorial);
  resetValdemarProgress(d,{editorial:true});
  const once=structuredClone(d);resetValdemarProgress(d,{editorial:true});assert.deepEqual(once,d);
  for(const field of ['cycles','customer','active','subscription','preferences','claims'])assert.deepEqual(d[field],intact[field]);
  const api=service(d);
  for(const scope of [false,true]){
    const initial=await api.call('seasons',undefined,scope);assert.deepEqual(initial.completed,[]);
    assert.deepEqual(initial.wallet,{gift:0,balance:0,won:[],opened:[],second:[],solution:[],legacyEnvelopes:[],history:[]});
    assert.deepEqual((await api.call('partidas',undefined,scope)).games,[]);
    const read=await api.call('cases/1',undefined,scope);assert.equal(read.mode,null);assert.equal(read.hour.current,0);assert.deepEqual(read.hints,[]);assert.equal(read.progress.choice,null);
    assert.equal((await api.call('seasons',undefined,scope)).wallet.balance,0);
  }
  assert.deepEqual((await api.call('seasons')).availableCases,numbers(1,12));
  assert.deepEqual((await api.call('seasons')).seasons.map(s=>s.paidBlocks),[[1,2,3],[1,2,3],[1,2,3],[1,2,3]]);
  await assert.rejects(api.call('cases/13/mode',{mode:'duo'}),{code:'PREVIOUS_SEASON_REQUIRED'});
  await assert.rejects(api.call('cases/37/mode',{mode:'duo'}),{code:'PREVIOUS_SEASON_REQUIRED'});
  await assert.rejects(api.call('cases/1/open',{}),{code:'NOT_ENOUGH_KEYS'});
  const retried=await api.call('cases/36/reward',{proof:{choice:['y','x']}},true);assert.equal(retried.wallet.balance,2);
  assert.equal((await api.call('seasons')).wallet.balance,0);
  const recovered=complete(structuredClone(api.data),numbers(1,12));
  assert.equal((await service(recovered).call('cases/13/reward',{proof:{choice:['y','x']}})).wallet.balance,1);
  const next=structuredClone(api.data);next.subscription='new-pass';
  next.cycles.push({id:'another-invoice',subscription:'new-pass',start:now-day,end:now+20*day,worldBlock:4});
  const future=service(next);assert.equal((await future.call('seasons')).wallet.gift,1);assert.equal((await future.call('seasons')).wallet.gift,1);
  const last=complete(memberAt(12),numbers(1,48));last.active=false;last.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;});
  assert.equal(worldSeasonAccess(last).nextPurchase,null);
});
test('finishing after the last paid period grants only the fully paid world; no extra payments or keys',async()=>{
  const d=memberAt(6);d.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;});d.active=false;
  complete(d,numbers(1,12));d.valdemarSeasonOne={paid:{welcomes:['old-pass'],won:[],opened:[],second:[]}};
  const api=service(d);const initial=await api.call('seasons');
  assert.deepEqual(initial.availableCases,numbers(1,24));assert.equal(initial.wallet.gift,1);assert(initial.seasons[1].finishAccess);
  assert.equal(initial.nextPurchase,null);await api.call('cases/13');await api.call('cases/13/reward',{proof:{choice:['y','x']}});
  assert.equal((await api.call('seasons')).wallet.balance,2);
  const done=complete(structuredClone(d),numbers(13,24));
  assert.deepEqual(worldSeasonAccess(done).nextPurchase,{number:3,blocks:[1,2,3],remainingCycles:3});
  done.cycles[4].revoked=true;
  assert(!worldSeasonAccess(done).availableCases.includes(13));
  assert.deepEqual(worldSeasonAccess(done).nextPurchase,{number:2,blocks:[2],remainingCycles:1});
});
test('separate opt-in checkout uses only the chosen season, reuses an open checkout and remains disabled without configuration',async()=>{
  const d=complete(memberAt(3),numbers(1,12));
  d.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;}); d.active=false;d.customer='customer';
  let state=structuredClone(d),order,created=0,expired=0,providerActive=false;
  const user={userId:'owner',email:'fixture@example.invalid'};
  const store={getMemberData:async()=>structuredClone(state),saveMemberData:async(_,v)=>{state=structuredClone(v);}};
  const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:randomBytes(32).toString('hex'),STRIPE_WEBHOOK_SECRET:randomBytes(32).toString('hex'),STRIPE_PRICE_ID:'price',STRIPE_PORTAL_CONFIGURATION:'mock',BILLING_TERMS_URL:'mock',BILLING_PRIVACY_URL:'mock'};
  const billing=createBilling(env,async(url,opts)=>{
    const path=new URL(url).pathname;
    if(path==='/v1/subscriptions')return Response.json({data:providerActive?[{id:'pending',status:'incomplete',metadata:{lup_uid:user.userId},items:{data:[{price:{id:'price'}}]}}]:[]});
    if(path==='/v1/invoices')return Response.json({data:[]});
    if(path==='/v1/prices/price')return Response.json({unit_amount:2995,currency:'eur',recurring:{interval:'month',interval_count:1},tax_behavior:'inclusive'});
    if(path==='/v1/checkout/sessions'){
      created++;order=new URLSearchParams(opts.body);return Response.json({id:'local-fixture',url:'https://example.invalid/checkout',expires_at:Math.floor(now/1000)+3600});
    }
    if(path==='/v1/checkout/sessions/local-fixture')return Response.json({status:'open',url:'https://example.invalid/checkout'});
    if(path==='/v1/checkout/sessions/local-fixture/expire'){expired++;return Response.json({status:'expired'});}
    throw Error('Unexpected mock route '+path);
  });
  await assert.rejects(billing.checkout(store,user,{}),{code:'SEASON_SELECTION_REQUIRED'});
  await assert.rejects(billing.checkout(store,user,{season:3}),{code:'SEASON_SELECTION_REQUIRED'});
  assert.equal(created,0);
  await billing.checkout(store,user,{season:2});await billing.checkout(store,user,{season:2});assert.equal(created,1);
  assert.equal(order.get('subscription_data[metadata][lup_blocks]'),'4,5,6');assert.equal(order.get('subscription_data[metadata][lup_season]'),'2');
  assert.equal(order.get('subscription_data[metadata][lup_plan]'),null);
  assert.match(order.get('custom_text[submit][message]'),/La siguiente temporada se contrata por separado/);
  await billing.checkout(store,user,{season:2,plan:'four-boards-v1'});
  assert.equal(order.get('subscription_data[metadata][lup_blocks]'),'4,5,6,7,8,9,10,11,12');
  assert.equal(order.get('subscription_data[metadata][lup_plan]'),'four-boards-v1');
  assert.match(order.get('custom_text[submit][message]'),/Termina tras 9 cuotas/);
  assert.match(order.get('custom_text[submit][message]'),/cancelar antes de renovar/);
  assert.equal(expired,1);
  providerActive=true;await assert.rejects(billing.checkout(store,user,{season:2}),{code:'SUBSCRIPTION_IN_PROGRESS'});
  const noPayments=createBilling({},()=>{throw Error('Must never call Stripe');});
  await assert.rejects(noPayments.checkout(store,user,{season:2}),{code:'BILLING_UNAVAILABLE'});
  providerActive=false; state=complete(memberAt(9),numbers(1,35));
  state.customer='customer';state.active=false;state.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;});
  assert.equal((await billing.membership(store,user.userId)).seasonAccess.nextPurchase,null);
  await assert.rejects(billing.checkout(store,user,{season:4}),{code:'SEASON_NOT_AVAILABLE'});
  complete(state,[36]);
  const ready=(await billing.membership(store,user.userId)).seasonAccess;
  assert.deepEqual(ready.nextPurchase,{number:4,blocks:[1,2,3],remainingCycles:3});
  assert(!ready.availableCases.includes(37));
  await assert.rejects(billing.checkout(store,user,{}),{code:'SEASON_SELECTION_REQUIRED'});
  await billing.checkout(store,user,{season:4});
  assert.equal(order.get('subscription_data[metadata][lup_blocks]'),'10,11,12');
  assert.equal(order.get('subscription_data[metadata][lup_season]'),'4');
  assert.match(order.get('custom_text[submit][message]'),/Necrópolis del Sol Velado/);
});

test('el pase continuo conserva los meses abonados mientras el jugador termina el tablero anterior',async()=>{
  const id='sub-journey',uid='reader';
  const state={customer:'cus-journey'};
  let schedule;
  const nowSeconds=Math.floor(now/1000), month=30*86400;
  const subscription={id,status:'active',metadata:{lup_uid:uid,lup_plan:'four-boards-v1',lup_season:'1',lup_blocks:numbers(1,12).join(',')},items:{data:[{price:{id:'price'}}]}};
  const invoices=numbers(1,4).map((i)=>{
    const start=nowSeconds-(4-i)*month-60;
    return {id:'paid-'+i,billing_reason:i===1?'subscription_create':'subscription_cycle',amount_paid:2995,currency:'eur',lines:{data:[{price:{id:'price'},period:{start,end:start+month}}]}};
  });
  const store={async getMemberData(){return structuredClone(state);},async saveMemberData(_,data){Object.assign(state,data);}};
  const config={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'test',STRIPE_WEBHOOK_SECRET:'test',STRIPE_PRICE_ID:'price',STRIPE_PORTAL_CONFIGURATION:'mock',BILLING_TERMS_URL:'mock',BILLING_PRIVACY_URL:'mock'};
  const billing=createBilling(config,async(url,options)=>{
    const path=new URL(url).pathname;
    if(path==='/v1/subscriptions')return Response.json({data:[subscription]});
    if(path==='/v1/invoices')return Response.json({data:[...invoices].reverse()});
    if(path==='/v1/subscription_schedules')return Response.json({id:'sched',current_phase:{start_date:invoices[0].lines.data[0].period.start}});
    if(path==='/v1/subscription_schedules/sched'){schedule=new URLSearchParams(options.body);return Response.json({id:'sched'});}
    throw Error('Unexpected path '+path);
  });
  const first=await billing.membership(store,uid);
  assert.equal(schedule.get('phases[0][duration][interval_count]'),'12');
  assert.equal(schedule.get('end_behavior'),'cancel');
  assert.deepEqual(first.seasonAccess.availableCases,numbers(1,12));
  assert.deepEqual(first.seasonAccess.seasons[1].paidBlocks,[1]);
  assert.deepEqual(state.cycles.map(c=>[c.worldBlock,c.plan,c.renewal]),numbers(1,4).map(i=>[i,'four-boards-v1',i>1]));
  complete(state,numbers(1,12));
  assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,numbers(1,16));
  state.revokedInvoices=['paid-4'];
  assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,numbers(1,12));
  // A replacement invoice for the refunded month restores the same four slots.
  invoices.push({...invoices[3],id:'replacement-4'});
  assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,numbers(1,16));
  assert.equal(state.cycles.filter(c=>c.worldBlock===4).length,1);
  // A delayed earlier period is new value, but cannot remap an existing month.
  const earlier=structuredClone(invoices[1]);
  earlier.id='late-old';earlier.lines.data[0].period={start:nowSeconds-4*month,end:nowSeconds-3*month};
  invoices.push(earlier);
  await billing.membership(store,uid);
  assert.equal(state.cycles.find(c=>c.id==='late-old').worldBlock,5);
  assert.equal(state.cycles.find(c=>c.id==='paid-1').worldBlock,1);
  // Excess periods and duplicate receipts cannot grant more than the agreed blocks.
  for(let i=1;i<=10;i++){
    const extra=structuredClone(earlier);extra.id='extra-'+i;
    extra.lines.data[0].period={start:nowSeconds+i*month,end:nowSeconds+(i+1)*month};invoices.push(extra);
  }
  await billing.membership(store,uid);
  assert.equal(state.cycles.length,12);assert.equal(new Set(state.cycles.map(c=>c.worldBlock)).size,12);
  subscription.status='canceled';assert.equal((await billing.membership(store,uid)).canPlay,true);
  state.revokedInvoices.push('replacement-4');
  assert.equal((await billing.membership(store,uid)).canPlay,false);
});
test('payment reconciliation pins opted-in receipts to their season, schedules finite passes and applies refunds to the original four games',async()=>{
  for(const [replacement,season] of [[false,2],[true,1],[false,4]]){
    const priorGames=season===4?36:12;
    const old=complete(memberAt(priorGames/4),numbers(1,priorGames));old.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;});
    old.cycles[1].revoked=replacement;old.customer='local-customer';old.active=false;
    old.valdemarSeasonOne={paid:{welcomes:[old.subscription],won:[],opened:[],second:[]}};
    const firstBlock=replacement?2:1+(season-1)*3;
    const blocks=replacement?'2':numbers(firstBlock,firstBlock+2).join(',');const newId=replacement?'repair':'pass-'+season;
    const start=Math.floor((now-2*day)/1000);
    let state=structuredClone(old),invoices=[],scheduled=0,cyclesScheduled;
    const uid='owner';const store={getMemberData:async()=>structuredClone(state),saveMemberData:async(_,v)=>{state=structuredClone(v);},findCustomer:async()=>uid};
    const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:randomBytes(32).toString('hex'),STRIPE_WEBHOOK_SECRET:randomBytes(32).toString('hex'),STRIPE_PRICE_ID:'price',STRIPE_PORTAL_CONFIGURATION:'dummy',BILLING_TERMS_URL:'dummy',BILLING_PRIVACY_URL:'dummy'};
    const subscription={id:newId,status:'active',metadata:{lup_uid:uid,lup_season:String(season),lup_blocks:blocks},items:{data:[{price:{id:'price'}}]}};
    const billing=createBilling(env,async(url,opts)=>{
      const path=new URL(url).pathname;
      if(path==='/v1/subscriptions')return Response.json({data:[subscription]});
      if(path==='/v1/invoices')return Response.json({data:[...invoices].reverse()});
      if(path==='/v1/subscription_schedules')return Response.json({id:'schedule-new',current_phase:{start_date:start}});
      if(path==='/v1/subscription_schedules/schedule-new'){scheduled++;const form=new URLSearchParams(opts.body);cyclesScheduled=form.get('phases[0][duration][interval_count]');assert.equal(form.get('end_behavior'),'cancel');return Response.json({id:'schedule-new'});}
      if(path==='/v1/charges/local-charge')return Response.json({customer:'local-customer',invoice:'inv-new-1'});
      throw Error('Unexpected mock route '+path);
    });
    function addInvoice(index,seconds){
      invoices.push({id:'inv-new-'+index,amount_paid:2995,currency:'eur',billing_reason:index===1?'subscription_create':'subscription_cycle',status_transitions:{paid_at:seconds},
        lines:{data:[{price:{id:'price'},period:{start:seconds,end:seconds+30*day/1000}}]}});
    }
    addInvoice(1,start);
    const first=await billing.membership(store,uid);
    assert.equal(scheduled,1);assert.equal(cyclesScheduled,replacement?'1':'3');
    assert.deepEqual(first.seasonAccess.availableCases,numbers(1,replacement?12:priorGames+4));
    assert.equal(state.cycles.find(c=>c.id==='inv-new-1').worldBlock,firstBlock);
    assert.equal(state.cycles.find(c=>c.id==='inv-1').revoked,replacement);
    await billing.membership(store,uid);
    assert.deepEqual(state.valdemarSeasonOne.paid.welcomes,[old.subscription,newId]);assert.equal(scheduled,1);
    if(!replacement){
      addInvoice(2,start+day/1000); // Simulate another confirmed invoice and duplicate delivery.
      invoices.push({...invoices[1]});
      assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,numbers(1,priorGames+8));
      assert.equal(state.cycles.find(c=>c.id==='inv-new-2').worldBlock,firstBlock+1);
      const stamp=Math.floor(Date.now()/1000), body=JSON.stringify({type:'charge.dispute.created',data:{object:{charge:'local-charge'}}});
      const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(stamp+'.'+body).digest('hex');
      const request=()=>new Request('https://example.invalid/mock',{method:'POST',body,headers:{'stripe-signature':'t='+stamp+',v1='+signature}});
      await billing.webhook(request(),op=>op(store));await billing.webhook(request(),op=>op(store));
      assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,[...numbers(1,priorGames),...numbers(priorGames+5,priorGames+8)]);
      assert.deepEqual(state.revokedInvoices,['inv-new-1']);assert.equal(scheduled,1);
    }
  }
});

test('El índice entrega únicamente el próximo objetivo de la última partida disponible y separa el acceso editorial',async()=>{
  const seed=memberAt(1);
  seed.valdemarCaseProgress={paid:{
    1:{mode:'duo',hourStep:1,updatedAt:30},2:{hourStep:3,updatedAt:30},3:{hourStep:3,updatedAt:30},
    4:{hourStep:4,mode:'solo',updatedAt:20},5:{mode:'solo',updatedAt:50},6:{choice:'c',updatedAt:60}
  },editorial:{32:{choice:'c',updatedAt:7},41:{mode:'solo',hourStep:0,updatedAt:5}}};
  const api=service(seed),index=await api.call('partidas');
  assert.deepEqual(index.access,worldSeasonAccess(seed));
  const picked=index.games.filter(game=>game.checkpoint);
  assert.equal(picked.length,1);assert.equal(picked[0].id,2);
  assert.deepEqual(picked[0].checkpoint,{title:'Etapa 4',task:'Ordenad'});
  assert(!index.games.find(game=>game.id===5).available);
  const editor=await api.call('partidas',undefined,true);
  assert.deepEqual(editor.access.availableCases,numbers(1,48));
  assert.deepEqual(editor.games.map(game=>game.id),[32,41]);
  assert.deepEqual(editor.games[1].checkpoint,{title:'Etapa 1',task:'Ordenad'});
  assert(!editor.games[0].checkpoint);
  for(const data of [index,editor]){
    const text=JSON.stringify(data);
    for(const secret of ['RESOLUCION PRIVADA','FIN PRIVADO','AYUDA PRIVADA','PREMIO PRIVADO','EPILOGO PRIVADO','Acertado','x","z','materials','options','answer','deduction','stageScript','gameScript'])assert(!text.includes(secret));
  }
  assert.deepEqual(api.data,seed);assert.equal(api.writes,0);
});

test('Los pasos finales distinguen la deducción pendiente de la decisión por guardar',async()=>{
  const seed=memberAt(1);
  for(const deduced of [false,true]){
    seed.valdemarCaseProgress={paid:{1:{mode:'solo',hourStep:5,deduced}}};
    const api=service(seed),{games}=await api.call('partidas');
    assert.equal(games[0].checkpoint.title,deduced?'Elige tu desenlace':'Deducción final');
    assert.equal(games[0].checkpoint.task,deduced?'Decide qué hacer con lo que has descubierto.':'¿Qué explica la señal del caso 1?');
    assert.equal(games[0].current,5);assert(!games[0].finished);assert.equal(api.writes,0);
  }
  for(const state of [{},complete(memberAt(1),[1])]){
    const api=service(state),{games,access}=await api.call('partidas');
    assert(games.every(game=>!game.checkpoint));assert.deepEqual(access,worldSeasonAccess(state));
    assert.equal(api.loads,0);assert.equal(api.writes,0);
  }
});

test('Una revocación en curso se confirma antes de decidir si se puede leer el objetivo protegido',async()=>{
  const seed=memberAt(1);seed.valdemarCaseProgress={paid:{1:{mode:'solo'}}};
  const api=service(seed);
  let unlock,entered;const gate=new Promise(done=>{unlock=done;}),locked=new Promise(done=>{entered=done;});
  const revoked=api.update(async data=>{entered();await gate;data.cycles[0].revoked=true;data.active=false;});
  await locked;
  const pending=api.call('partidas');
  unlock();await revoked;
  const index=await pending;
  assert.deepEqual(index.access.availableCases,[]);
  assert.equal(index.games[0].available,false);assert(!index.games[0].checkpoint);
  assert.equal(api.loads,0);assert.equal(api.writes,1);
});

test('Consultar el índice con Stripe activo no provisiona calendarios, saldos, correos ni partidas',async()=>{
  const seed=memberAt(1);seed.customer='fixture-customer';seed.valdemarCaseProgress={paid:{1:{mode:'solo'}}};
  const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture',
    STRIPE_PRICE_ID:'price',STRIPE_PORTAL_CONFIGURATION:'fixture',BILLING_TERMS_URL:'fixture',BILLING_PRIVACY_URL:'fixture'};
  const calls=[];
  const billing=createBilling(env,async(url,options)=>{
    assert.equal(options.method,'GET');
    const path=new URL(url).pathname;calls.push(path);
    if(path==='/v1/subscriptions')return Response.json({data:[{id:seed.subscription,status:'active',
      metadata:{lup_uid:'fixture'},items:{data:[{price:{id:'price'}}]}}]});
    if(path==='/v1/invoices')return Response.json({data:[]});
    assert.fail('Petición externa inesperada: '+path);
  });
  let loads=0;
  const store={getMemberData:async(uid,options)=>{
    assert.equal(uid,'fixture');assert.equal(options?.readOnly,true);return structuredClone(seed);
  },saveMemberData(){assert.fail('Guardado inesperado');},enqueueMail(){assert.fail('Correo inesperado');}};
  const get=()=>valdemarRequest({path:'/api/valdemar/partidas',method:'GET',uid:'fixture',
    withStore:fn=>fn(store),billing,loadRelease:async()=>{loads++;return release;}});
  const unprovisioned=await get();assert.deepEqual(unprovisioned.access.availableCases,[]);
  assert(!unprovisioned.games[0].checkpoint);assert.equal(loads,0);
  seed.scheduleConfigured=true;
  const available=await get();assert.deepEqual(available.access.availableCases,numbers(1,4));
  assert.equal(available.games[0].checkpoint.title,'Etapa 1');assert.equal(loads,1);
  assert.deepEqual(calls,['/v1/subscriptions','/v1/invoices','/v1/subscriptions','/v1/invoices']);
});
