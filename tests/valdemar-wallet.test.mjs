import test from 'node:test';
import assert from 'node:assert/strict';
import { creditSecretMission, creditPublishedChallenge, creditValdemarWelcome, valdemarWallet, withValdemarTransaction } from '../valdemar-wallet.mjs';

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
