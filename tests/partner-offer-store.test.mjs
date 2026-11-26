import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partnerOfferStore} from '../partner-offer-store.mjs';

const {DatabaseSync}=await import('node:sqlite').catch(()=>({}));
const hash=v=>createHash('sha256').update(v).digest('hex');
// Exercise the store's real inserts, lookups and job compare-and-set locally.
// SQLite is only the test engine; InnoDB row and gap locks require MySQL.
function fixture(t){
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  db.function('SHA2',(v,bits)=>bits===256 && v!=null?hash(v):null);
  db.function('LEAST', {varargs:true}, (...v)=>Math.min(...v));
  db.function('POW',Math.pow);
  db.exec(`CREATE TABLE lup_offer_preferences_v2(user_id TEXT PRIMARY KEY,email_key TEXT);
    CREATE TABLE lup_offer_buyers_v2(user_id TEXT PRIMARY KEY,email_key TEXT,active_until INTEGER);
    CREATE TABLE lup_offer_jobs_v2(user_id TEXT PRIMARY KEY,version INTEGER,next_at INTEGER,attempts INTEGER DEFAULT 0);
    CREATE TABLE lup_offer_changes_v2(email_key TEXT PRIMARY KEY,queued_at INTEGER);
    CREATE TABLE lup_offer_backfill_v2(id INTEGER PRIMARY KEY,last_uid TEXT,complete INTEGER DEFAULT 0);
    CREATE TABLE lup_member_data(user_id TEXT PRIMARY KEY,customer_id TEXT,data_json TEXT);
    CREATE TABLE lup_mail_outbox(id TEXT PRIMARY KEY,email TEXT,type TEXT);
    INSERT INTO lup_offer_backfill_v2 VALUES(1,'',0)`);
  let now=1700000000000;
  const query=async(sql,values=[])=>{
    const text=sql.replace(/ FOR UPDATE(?: SKIP LOCKED)?/g,'').replace(/ FORCE INDEX\([^)]+\)/g,'')
      .replace(' ON DUPLICATE KEY UPDATE ',' ON CONFLICT DO UPDATE SET ')
      .replace(/=VALUES\((\w+)\)/g,'=excluded.$1');
    const statement=db.prepare(text);
    return /^SELECT\b/i.test(text.trim())?statement.all(...values):statement.run(...values);
  };
  const member=(uid,data)=>db.prepare('INSERT INTO lup_member_data VALUES(?,?,?)').run(uid,data.customer||null,JSON.stringify(data));
  const welcome=(uid,email,type='welcome')=>db.prepare('INSERT INTO lup_mail_outbox VALUES(?,?,?)').run(hash('welcome:'+uid),email,type);
  return {store:partnerOfferStore(query,()=>now),time:()=>now,advance:minutes=>{now+=minutes*60000;},member,welcome};
}

test('Cada cuota exige dos pases activos y la elección recíproca de dos cuentas distintas',{skip:!DatabaseSync},async t=>{
  const {store,time,advance}=fixture(t);
  const a=hash('a@example.test'),b=hash('b@example.test'),c=hash('c@example.test');
  const hour=time()+3600000,later=time()+86400000;
  await store.recordOfferPurchase('alice',a,later);
  await store.recordOfferPurchase('bob',b,hour);
  await store.recordOfferPurchase('carol',c,later);
  await store.recordOfferPreference('alice',b);
  await store.recordOfferPreference('carol',b);
  assert.equal(await store.hasOfferPurchase('alice',b),false);
  await store.recordOfferPreference('bob',a);
  assert.equal(await store.hasOfferPurchase('alice',b),true);
  assert.equal(await store.hasOfferPurchase('bob',a),true);
  assert.equal(await store.hasOfferPurchase('carol',b),false);
  assert.equal(await store.hasOfferPurchase('alice',c),false);
  await store.scheduleChangedPartners();
  for(const job of await store.listOfferJobs(20))await store.finishOfferJob(job.uid,job.version);
  advance(60);
  assert.equal(await store.hasOfferPurchase('alice',b),false);
  assert.equal(await store.hasOfferPurchase('bob',a),false);
  assert.equal(await store.getMutualOfferPartner('alice',b),'bob');
  assert.equal(await store.getMutualOfferPartner('carol',b),null);
  assert.equal(await store.expireOfferPurchases(),1);
  await store.scheduleChangedPartners();
  const jobs=await store.listOfferJobs(20);
  assert.deepEqual(jobs.map(j=>j.uid).sort(),['alice','bob']);
  for(const job of jobs)await store.finishOfferJob(job.uid,job.version);
  await store.recordOfferPurchase('bob',b,later);
  assert.equal(await store.hasOfferPurchase('alice',b),true);
  await store.recordOfferPreference('bob',null);
  assert.equal(await store.hasOfferPurchase('alice',b),false);
  assert.equal(await store.getMutualOfferPartner('alice',b),null);
  await store.scheduleChangedPartners();
  assert.deepEqual((await store.listOfferJobs(20)).map(j=>j.uid).sort(),['alice','bob']);
});

test('Una versión antigua no puede confirmar ni aplazar un precio posterior',{skip:!DatabaseSync},async t=>{
  const {store,advance}=fixture(t);const b=hash('b@example.test'),c=hash('c@example.test');
  await store.recordOfferPreference('alice',b);
  const [old]=await store.listOfferJobs(1);
  assert.deepEqual(await store.listOfferJobs(1),[]);
  await store.recordOfferPreference('alice',c);
  assert.equal(await store.lockOfferJob('alice',old.version),false);
  await store.finishOfferJob('alice',old.version);
  await store.retryOfferJob('alice',old.version);
  const [changed]=await store.listOfferJobs(1);
  assert(changed.version>old.version);
  await store.retryOfferJob('alice',changed.version);
  assert.deepEqual(await store.listOfferJobs(1),[]);
  advance(2);
  assert.deepEqual(await store.listOfferJobs(1),[changed]);
  await store.finishOfferJob('alice',changed.version);
  assert.deepEqual(await store.listOfferJobs(1),[]);
});

test('La migración verifica el UID, la pareja mutua y el período de cada cuota incluso durante el despliegue',{skip:!DatabaseSync},async t=>{
  const {member,welcome,store,time}=fixture(t),now=time(),mail=id=>id+'@example.test',key=id=>hash(mail(id));
  const paid=(id,preferred)=>({customer:'cus_'+id,subscription:'sub_'+id,active:true,periodEnd:now+20000,
    preferredPartnerEmail:mail(preferred),cycles:[{id:'invoice_'+id,subscription:'sub_'+id,amountPaid:2995,start:now-10000,end:now+20000}]});
  for(const [id,partner] of [['alice','bob'],['bob','alice'],['third','bob'],['expired','refunded'],['refunded','expired'],['stranger','unverified'],['unverified','stranger']]){
    const data=paid(id,partner);
    if(id==='expired')data.periodEnd=now;
    if(id==='refunded')data.revokedInvoices=['invoice_refunded'];
    member(id,data);
    welcome(id,mail(id),id==='unverified'?'subscription':'welcome');
  }
  const check=async()=>{
    assert.equal(await store.hasOfferPurchase('alice',key('bob')),true);
    assert.equal(await store.hasOfferPurchase('bob',key('alice')),true);
    assert.equal(await store.hasOfferPurchase('third',key('bob')),false);
    assert.equal(await store.hasOfferPurchase('expired',key('refunded')),false);
    assert.equal(await store.hasOfferPurchase('stranger',key('unverified')),false);
  };
  await check();
  while(!await store.backfillPartnerOffers(2))await check();
  await check();
  await store.recordOfferPurchase('bob',null,null);
  assert.equal(await store.hasOfferPurchase('alice',key('bob')),false);
});

