import test from 'node:test';
import assert from 'node:assert/strict';
import {valdemarRequest} from '../valdemar-api.mjs';
import {releaseCalendar} from '../progression.mjs';
import {worldSeasonAccess} from '../valdemar-wallet.mjs';
import {createBilling} from '../billing.mjs';
import {createHmac, randomBytes} from 'node:crypto';

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
  id,title:'Caso de ensayo '+id,place:'Estudio',intro:'Se oye un ruido.',roles:['Escucha','Mira'],
  choices:[{id:'c',label:'Guardar'}],hypotheses:[{id:'h',label:'La explicación'}],correctHypothesis:'h',
  deduction:'RESOLUCION PRIVADA',outcomes:{c:'FIN PRIVADO'},hints:['AYUDA PRIVADA','SEGUNDA AYUDA'],
  side:{title:'Reconstruir',brief:'Compara',materials,mode:id===13?'order':'multi',options,answer:['y','x'],success:'PREMIO PRIVADO',retry:'Aún no encajan.'},
  hour:{stages:numbers(1,5).map(i=>({title:'Etapa '+i,place:'Estudio',minutes:12,brief:'Investigad '+i,materials,task:'Ordenad',mode:'order',options,answer:['x','z'],success:'Acertado',retry:'Volved a comprobarlo.'}))}
});
const release = {stories:[],samples:[],nuevos:numbers(13,36).map(world)};
function service(seed) {
  let committed=structuredClone(seed),tail=Promise.resolve(),loads=0;
  const withStore = fn => {
    const tx = tail.then(async()=>{
      let copy=structuredClone(committed);
      const result=await fn({getMemberData:async()=>structuredClone(copy),saveMemberData:async(_,data)=>{copy=structuredClone(data);}});
      committed=copy;
      return result;
    });
    tail=tx.catch(()=>{});
    return tx;
  };
  return {
    get data(){return committed;}, get loads(){return loads;},
    async call(path,input,editorial=false) {
      return valdemarRequest({path:'/api/valdemar/'+path,method:input===undefined?'GET':'POST',input,uid:'fixture',editorial,withStore,
        loadRelease:async()=>{loads++;return release;},
        billing:{membership:async(store)=>{const d=await store.getMemberData();return {canPlay:d.active,calendar:releaseCalendar(d.cycles||[])};}}
      });
    }
  };
}
test('a paid cycle unlocks the correct four cases, without changing the established calendar',async()=>{
  for(const month of numbers(1,9)){
    const state=memberAt(month);
    complete(state,numbers(1,Math.floor((month-1)/3)*12));
    const api=service(state);const visible=await api.call('seasons');
    assert.deepEqual(visible.availableCases,numbers(1,month*4));assert.equal(visible.wallet.gift,1);
    assert.deepEqual((await api.call('wallet')).availableCases,numbers(1,Math.min(month*4,12)));
    if(month<9)await assert.rejects(api.call('cases/'+(month*4+1)),{code:month%3===0?'PREVIOUS_SEASON_REQUIRED':'CASE_NOT_RELEASED'});
  }
  const d=complete(memberAt(8,[2,5]),numbers(1,24));d.cycles.push({...d.cycles[7]});
  assert.deepEqual(worldSeasonAccess(d).availableCases,[...numbers(1,4),...numbers(9,16),...numbers(21,32)]);
  d.cycles.push({id:'future',subscription:d.subscription,start:now+day,end:now+5*day,worldBlock:9});
  assert(!worldSeasonAccess(d).availableCases.includes(33));d.active=false;assert.deepEqual(worldSeasonAccess(d).availableCases,[]);
});
test('new stories do not expose solutions, premature endings or paid content in other months',async()=>{
  const api=service(memberAt(3));await assert.rejects(api.call('cases/13'),{code:'PREVIOUS_SEASON_REQUIRED'});
  assert.equal(api.loads,0);await assert.rejects(api.call('cases/37',undefined,true),{status:404});
  for(const id of numbers(13,36)){
    const result=await api.call('cases/'+id,undefined,true);
    assert.equal(result.story.id,id);assert.equal(result.hour.stage.title,'Etapa 1');assert.equal(result.side.mode,id===13?'order':'multi');
    assert.equal(result.side.requiredCount,id===13?2:undefined);
    for(const key of ['answer','retry','success'])assert(!Object.hasOwn(result.side,key));
    for(const secret of ['RESOLUCION PRIVADA','FIN PRIVADO','AYUDA PRIVADA','PREMIO PRIVADO'])assert(!JSON.stringify(result).includes(secret));
  }
  assert.deepEqual((await api.call('seasons',undefined,true)).availableCases,numbers(1,36));
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
  await act(25,'open');await act(25,'second');assert.deepEqual((await api.call('cases/25')).hints,['AYUDA PRIVADA','SEGUNDA AYUDA']);
  assert.equal((await api.call('wallet')).wallet.balance,2);assert.equal((await api.call('seasons',undefined,true)).wallet.balance,1);
  for(const index of numbers(0,4)){const result=await act(36,'stage',{index,choice:['x','z']});assert.equal(result.hour.current,index+1);}
  assert.equal((await act(36,'deduce',{hypothesis:'h'})).progress.deduction,'RESOLUCION PRIVADA');
  assert.equal((await act(36,'ending',{choice:'c'})).progress.outcome,'FIN PRIVADO');
  assert.deepEqual((await api.call('seasons')).completed,[...numbers(1,24),36]);assert.deepEqual((await api.call('wallet')).completed,numbers(1,12));
});
test('all twelve prior paid endings are required for every new operation, across both season boundaries',async()=>{
  for(const [missing,target] of [[2,13],[15,25],[5,36]]){
    const d=complete(memberAt(9),numbers(1,24));delete d.valdemarCaseProgress.paid[missing];
    d.valdemarCaseProgress.editorial={[missing]:{choice:'c'}};
    const api=service(d);
    for(const [route,input] of [['',undefined],['/stage',{index:0,choice:['x','z']}],['/deduce',{hypothesis:'h'}],['/ending',{choice:'c'}],['/reward',{proof:{choice:['y','x']}}],['/open',{}],['/second',{}]]){
      await assert.rejects(api.call('cases/'+target+route,input),{code:'PREVIOUS_SEASON_REQUIRED'});
    }
    assert.equal((await api.call('seasons')).availableCases.includes(target),false);
    assert((await api.call('seasons',undefined,true)).availableCases.includes(target));
  }
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
  let state=structuredClone(d),order,created=0,providerActive=false;
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
    throw Error('Unexpected mock route '+path);
  });
  await assert.rejects(billing.checkout(store,user,{}),{code:'SEASON_SELECTION_REQUIRED'});
  await assert.rejects(billing.checkout(store,user,{season:3}),{code:'SEASON_SELECTION_REQUIRED'});
  assert.equal(created,0);
  await billing.checkout(store,user,{season:2});await billing.checkout(store,user,{season:2});assert.equal(created,1);
  assert.equal(order.get('subscription_data[metadata][lup_blocks]'),'4,5,6');assert.equal(order.get('subscription_data[metadata][lup_season]'),'2');
  providerActive=true;await assert.rejects(billing.checkout(store,user,{season:2}),{code:'SUBSCRIPTION_IN_PROGRESS'});
  const noPayments=createBilling({},()=>{throw Error('Must never call Stripe');});
  await assert.rejects(noPayments.checkout(store,user,{season:2}),{code:'BILLING_UNAVAILABLE'});
});
test('payment reconciliation pins opted-in receipts to their season, schedules finite passes and applies refunds to the original four games',async()=>{
  for(const replacement of [false,true]){
    const old=complete(memberAt(3),numbers(1,12));old.cycles.forEach(c=>{c.start-=40*day;c.end-=40*day;});
    old.cycles[1].revoked=replacement;old.customer='local-customer';old.active=false;
    old.valdemarSeasonOne={paid:{welcomes:[old.subscription],won:[],opened:[],second:[]}};
    const blocks=replacement?'2':'4,5,6';const newId=replacement?'repair':'pass-two';
    const start=Math.floor((now-2*day)/1000);
    let state=structuredClone(old),invoices=[],scheduled=0,cyclesScheduled;
    const uid='owner';const store={getMemberData:async()=>structuredClone(state),saveMemberData:async(_,v)=>{state=structuredClone(v);},findCustomer:async()=>uid};
    const env={BILLING_ENABLED:'true',STRIPE_SECRET_KEY:randomBytes(32).toString('hex'),STRIPE_WEBHOOK_SECRET:randomBytes(32).toString('hex'),STRIPE_PRICE_ID:'price',STRIPE_PORTAL_CONFIGURATION:'dummy',BILLING_TERMS_URL:'dummy',BILLING_PRIVACY_URL:'dummy'};
    const subscription={id:newId,status:'active',metadata:{lup_uid:uid,lup_season:replacement?'1':'2',lup_blocks:blocks},items:{data:[{price:{id:'price'}}]}};
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
    assert.deepEqual(first.seasonAccess.availableCases,numbers(1,replacement?12:16));
    assert.equal(state.cycles.find(c=>c.id==='inv-new-1').worldBlock,replacement?2:4);
    assert.equal(state.cycles.find(c=>c.id==='inv-1').revoked,replacement);
    await billing.membership(store,uid);
    assert.deepEqual(state.valdemarSeasonOne.paid.welcomes,[old.subscription,newId]);assert.equal(scheduled,1);
    if(!replacement){
      addInvoice(2,start+day/1000); // Simulate another confirmed invoice and duplicate delivery.
      invoices.push({...invoices[1]});
      assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,numbers(1,20));
      assert.equal(state.cycles.find(c=>c.id==='inv-new-2').worldBlock,5);
      const stamp=Math.floor(Date.now()/1000), body=JSON.stringify({type:'charge.dispute.created',data:{object:{charge:'local-charge'}}});
      const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(stamp+'.'+body).digest('hex');
      const request=()=>new Request('https://example.invalid/mock',{method:'POST',body,headers:{'stripe-signature':'t='+stamp+',v1='+signature}});
      await billing.webhook(request(),op=>op(store));await billing.webhook(request(),op=>op(store));
      assert.deepEqual((await billing.membership(store,uid)).seasonAccess.availableCases,[...numbers(1,12),...numbers(17,20)]);
      assert.deepEqual(state.revokedInvoices,['inv-new-1']);assert.equal(scheduled,1);
    }
  }
});
