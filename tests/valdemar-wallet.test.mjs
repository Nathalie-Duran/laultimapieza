import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import { creditAdventureEnding,creditMansionArcade,creditSeasonArcade,markRoomCooperation,creditSecretMission, creditPublishedChallenge, creditValdemarWelcome, valdemarWallet, withValdemarTransaction } from '../valdemar-wallet.mjs';

const owner = 'owner';
const options = { editorial: false };
function purchased(id = 'sub_paid') {
  const now = Date.now();
  return {
    customer: 'cus_owner', active: true, subscription: id,
    cycles: [{ id:'in_first', subscription:id, start:now-86400000, end:now+86400000 }]
  };
}
// Match database.mjs' per-member SELECT FOR UPDATE and transaction rollback.
function memory(initial) {
  let committed = structuredClone(initial);
  let previous = Promise.resolve();
  return {
    run(operation) {
      const transaction = previous.then(async () => {
        let copy = structuredClone(committed);
        const result = await operation({
          async getMemberData(uid) { assert.equal(uid, owner); return structuredClone(copy); },
          async saveMemberData(uid, data) { assert.equal(uid, owner); copy = structuredClone(data); }
        });
        committed = copy;
        return result;
      });
      previous = transaction.catch(() => {});
      return transaction;
    }
  };
}

test('el historial identifica los minijuegos y conserva el título ganado al reeditar el calendario',async()=>{
  const data={};
  creditMansionArcade(data,'paid','cartas',2);
  creditSeasonArcade(data,'paid',13,'portulano',1);
  creditPublishedChallenge(data,'paid','edicion-de-ensayo',1,3,true,'La prueba del museo');
  creditPublishedChallenge(data,'paid','edicion-de-ensayo',1,1,true,'Nuevo título del editor');
  creditPublishedChallenge(data,'paid','archivo-antiguo',1,1,true);
  const {balance,history}=await memory(data).run(store=>valdemarWallet(store,owner,{seasonAccess:{availableCases:[1,13]}}));
  assert.equal(balance,7);
  assert.equal(history[0].activity,'Las cartas de Ada');
  assert.equal(history[1].station,'portulano');
  assert.equal(history[2].activity,'La prueba del museo');
  assert.equal(history[3].activity,undefined);
  assert.ok(history.every(row=>!Object.hasOwn(row,'id')));
  const window={Colecciones:{seasons:[{name:'Valdemar'},{name:'Expedición'}]},
    SalasMundosCatalogo:{2:{games:[{id:'portulano',title:'La carta del piloto'}]}}};
  const document={createElement:()=>({children:[],append(...nodes){this.children.push(...nodes);},get childElementCount(){return this.children.length;}})};
  runInNewContext(await readFile(new URL('../web/keyring.js',import.meta.url),'utf8'),{document,window});
  const movimientos=window.Keyring.history({history}).children[1].children.map(n=>n.textContent).join('\n');
  for(const nombre of ['Las cartas de Ada','La carta del piloto','La prueba del museo','Desafío del calendario']){
    assert.ok(movimientos.includes(nombre));
  }
});

test('confirmed subscription receives one welcome regardless of renewal and synchronization replays', () => {
  const d = purchased();
  assert.equal(creditValdemarWelcome(d), true);
  d.cycles.push({ ...d.cycles[0], id:'in_renewal' });
  assert.equal(creditValdemarWelcome(d), false);
  assert.equal(creditValdemarWelcome(d), false);
  assert.deepEqual(d.valdemarSeasonOne.paid.welcomes, ['sub_paid']);
  d.subscription = 'sub_new_purchase';
  assert.equal(creditValdemarWelcome(d), false);
  d.cycles.push({ ...d.cycles[0], id:'in_new', subscription:d.subscription });
  assert.equal(creditValdemarWelcome(d), true);
  assert.equal(creditValdemarWelcome(d), false);
});

test('los 48 finales históricos conservan su ámbito, fecha y el único premio previo de Ada',async()=>{
  const paid=Object.fromEntries(Array.from({length:48},(_,i)=>[i+1,{choice:'final',completedAt:1234+i}]));
  paid[1]={mansion:{completed:true},choice:'mansion-sealed'};
  const data={valdemarCaseProgress:{paid,editorial:{2:{choice:'final'},3:{mode:'duo'},4:{deduced:true}}}};
  assert.equal(creditAdventureEnding(data,'paid',1,{mansion:true}),true);
  assert.equal(creditAdventureEnding(data,'paid',1),false);
  const db=memory(data);
  const read=editorial=>db.run(store=>valdemarWallet(store,owner,{editorial,summaryOnly:true,seasonAccess:{availableCases:[]}}));
  const wallets=await Promise.all([read(false),read(false)]);
  for(const wallet of wallets){
    assert.equal(wallet.balance,48);
    assert.equal(wallet.history.filter(row=>row.kind==='mansionEnding').length,1);
    assert.equal(wallet.history.find(row=>row.caseId===48).at,1281);
  }
  const editor=await read(true);
  assert.deepEqual(editor.history.filter(row=>row.kind==='adventureEnding').map(row=>row.caseId),[2]);
  assert.equal(editor.history.find(row=>row.kind==='adventureEnding').at,null);
});

test('una victoria individual y su posterior resolución cooperativa conservan un premio por persona',()=>{
  const member={};
  for(const [caseId,id] of [[1,'archivo'],[13,'luces'],[25,'negativos'],[37,'sello']]){
    assert.equal(markRoomCooperation(member,'paid',caseId,id),false);
    const credit=()=>caseId===1?creditMansionArcade(member,'paid',id,1):creditSeasonArcade(member,'paid',caseId,id,1);
    assert.equal(credit(),true);assert.equal(credit(),false);
    assert.equal(markRoomCooperation(member,'paid',caseId,id),true);
    assert.equal(markRoomCooperation(member,'paid',caseId,id),false);
    assert.equal(markRoomCooperation(member,'editorial',caseId,id),false);
  }
  assert.equal(member.valdemarSeasonOne.paid.entries.length,4);
  assert.ok(member.valdemarSeasonOne.paid.entries.every(row=>row.cooperative));
});

test('paid wallet backfills old purchases, is idempotent under concurrent actions, and preserves help', async () => {
  const db = memory(purchased());
  const perform = (action, n) => db.run(store => valdemarWallet(store, owner, options, action, n));
  assert.equal((await perform('read')).balance, 1);
  const spent = await Promise.allSettled([perform('open',1), perform('open',2)]);
  assert.equal(spent.filter(r=>r.status==='fulfilled').length, 1);
  assert.equal(spent.find(r=>r.status==='rejected').reason.code, 'NOT_ENOUGH_KEYS');
  assert.equal((await perform('open',1)).balance, 0);
  await Promise.all([perform('reward',3), perform('reward',3)]);
  await perform('open',2);
  await assert.rejects(perform('second',1),{code:'NOT_ENOUGH_KEYS'});
  await perform('reward',1);await perform('reward',4);
  await perform('second',1);
  await perform('second',1);
  const saved=await perform('read');
  assert.equal(saved.balance,0);assert.deepEqual(saved.won,[3,1,4]);assert.deepEqual(saved.opened,[1,2]);assert.deepEqual(saved.second,[1]);
  assert.deepEqual(saved.history.map(entry=>entry.amount),[1,-1,1,-1,1,1,-2]);
  await assert.rejects(perform('second',4),{code:'NOT_ENOUGH_KEYS'});
  await assert.rejects(perform('reward',5),{code:'CASE_NOT_RELEASED'});
  await assert.rejects(perform('open','2'),{status:400});
});

test('editorial rewards are isolated from real accounts and never generate a paid welcome', async () => {
  const db = memory(purchased());
  assert.equal((await db.run(store=>valdemarWallet(store,owner,{editorial:true},'reward',12))).balance, 3);
  const paid = await db.run(store=>valdemarWallet(store,owner,options));
  assert.equal(paid.gift,1);assert.equal(paid.balance,1);assert.deepEqual(paid.won,[]);assert.deepEqual(paid.history.map(row=>row.kind),['welcome']);
  const d=purchased();
  d.cycles[0].revoked=true;
  assert.equal(creditValdemarWelcome(d),false);
  await assert.rejects(memory(d).run(store=>valdemarWallet(store,owner,options)),{code:'SUBSCRIPTION_REQUIRED'});
  await assert.rejects(memory({active:true}).run(store=>valdemarWallet(store,owner,options)),{code:'SUBSCRIPTION_REQUIRED'});
});

test('lock failures retry after rollback while ambiguous connection failures propagate', async () => {
  let count = 0;
  assert.equal(await withValdemarTransaction(async work=>{
    if (++count<3) throw Object.assign(new Error(),{code:'ER_LOCK_DEADLOCK'});
    return work();
  },()=>42),42);
  assert.equal(count,3);
  count=0;
  await assert.rejects(withValdemarTransaction(async()=>{
    count++;throw Object.assign(new Error(),{code:'PROTOCOL_CONNECTION_LOST'});
  },()=>{}),{code:'PROTOCOL_CONNECTION_LOST'});
  assert.equal(count,1);
});

test('migration preserves old envelopes and rewards, adds new renewals and mission prizes once',async()=>{
  const data=purchased();
  data.valdemarSeasonOne={paid:{welcomes:[data.subscription],won:[12],opened:[1],second:[]}};
  data.cycles.push({...data.cycles[0],id:'renew',plan:'four-boards-v1',renewal:true});
  assert.equal(creditValdemarWelcome(data),true);
  assert.equal(creditValdemarWelcome(data),false);
  assert.equal(creditSecretMission(data,'paid',2,3),true);
  assert.equal(creditSecretMission(data,'paid',2,3),false);
  assert.equal(creditPublishedChallenge(data,'paid','published-uuid',1),true);
  assert.equal(creditPublishedChallenge(data,'paid','published-uuid',1),false);
  const db=memory(data);
  const call=(action,id)=>db.run(store=>valdemarWallet(store,owner,options,action,id));
  assert.equal((await call('second',1)).balance,6);
  const solution=await call('solution',2);
  assert.equal(solution.balance,3);
  assert.deepEqual(solution.solution,[2]);
  assert.equal((await call('solution',2)).balance,3);
  assert.deepEqual(solution.history.map(row=>row.amount),[1,1,-1,1,3,1,0,-3]);
});
