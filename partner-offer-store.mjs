import {emailKey,paidUntil} from './partner-offer.mjs';

const uidColumn='VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';
const keyColumn='CHAR(64) CHARACTER SET ascii COLLATE ascii_bin';
export const partnerOfferSchema=[
  `CREATE TABLE IF NOT EXISTS lup_offer_changes_v2 (
    email_key ${keyColumn} PRIMARY KEY, queued_at BIGINT NOT NULL, INDEX lup_offer_changes_due(queued_at)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS lup_offer_preferences_v2 (
    user_id ${uidColumn} PRIMARY KEY, email_key ${keyColumn} NULL,
    INDEX lup_offer_chosen(email_key,user_id)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS lup_offer_buyers_v2 (
    user_id ${uidColumn} PRIMARY KEY, email_key ${keyColumn} NULL, active_until BIGINT NULL,
    INDEX lup_offer_eligible(email_key,active_until,user_id), INDEX lup_offer_expiring(active_until)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS lup_offer_jobs_v2 (
    user_id ${uidColumn} PRIMARY KEY, version BIGINT UNSIGNED NOT NULL, next_at BIGINT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0, INDEX lup_offer_due(next_at,user_id)) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS lup_offer_backfill_v2 (
    id TINYINT PRIMARY KEY, last_uid ${uidColumn} NOT NULL, complete TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB`,
  "INSERT IGNORE INTO lup_offer_backfill_v2(id,last_uid) VALUES (1,'')"
];

const validKey=key=>typeof key==='string' && /^[0-9a-f]{64}$/.test(key);
const bounded=(value,max)=>Number.isSafeInteger(value)?Math.max(1,Math.min(value,max)):1;
function storedKey(value){
  return typeof value==='string' && value.includes('@')?emailKey(value):null;
}

export function partnerOfferStore(query,clock=Date.now){
  async function schedule(uid){
    await query(`INSERT INTO lup_offer_jobs_v2(user_id,version,next_at,attempts) VALUES(?,1,?,0)
      ON DUPLICATE KEY UPDATE version=version+1,next_at=VALUES(next_at),attempts=0`,[uid,clock()]);
  }
  // Resolve the partner's UID after commit, once both preferences are visible even
  // when two people choose each other at the same time on different servers.
  async function schedulePartners(keys){
    for(const key of [...new Set(keys.filter(validKey))].sort()){
      await query('INSERT INTO lup_offer_changes_v2(email_key,queued_at) VALUES(?,?) ON DUPLICATE KEY UPDATE email_key=VALUES(email_key)',[key,clock()]);
    }
  }
  async function recordOfferPreference(uid,key){
    if(key!==null && !validKey(key))throw new TypeError('Clave de preferencia inválida');
    await query('INSERT INTO lup_offer_preferences_v2(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',[uid]);
    const [current]=await query('SELECT email_key FROM lup_offer_preferences_v2 WHERE user_id=? FOR UPDATE',[uid]);
    if(current.email_key===key)return;
    await query('UPDATE lup_offer_preferences_v2 SET email_key=? WHERE user_id=?',[key,uid]);
    await schedule(uid);
    await schedulePartners([current.email_key,key]);
  }
  async function recordOfferPurchase(uid,key,activeUntil){
    if(key!=null && !validKey(key))throw new TypeError('Clave de identidad inválida');
    if(activeUntil!=null && (!Number.isSafeInteger(activeUntil)||activeUntil<=0))throw new TypeError('Fecha de cuota inválida');
    await query('INSERT INTO lup_offer_buyers_v2(user_id) VALUES(?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',[uid]);
    const [current]=await query('SELECT email_key,active_until FROM lup_offer_buyers_v2 WHERE user_id=? FOR UPDATE',[uid]);
    const nextKey=key||current.email_key;
    const end=nextKey && activeUntil>clock()?activeUntil:null;
    if(nextKey===current.email_key && Number(current.active_until)===Number(end))return;
    await query('UPDATE lup_offer_buyers_v2 SET email_key=?,active_until=? WHERE user_id=?',[nextKey,end,uid]);
    if(!end && !current.active_until)return;
    const [pref]=await query('SELECT email_key FROM lup_offer_preferences_v2 WHERE user_id=?',[uid]);
    await schedule(uid);
    await schedulePartners([pref?.email_key]);
  }
  async function getOfferIdentityKey(uid){
    const [buyer]=await query('SELECT email_key FROM lup_offer_buyers_v2 WHERE user_id=?',[uid]);
    if(buyer?.email_key)return buyer.email_key;
    // The welcome outbox key is derived from the Firebase UID. Only a verified
    // Firebase account can create this message. Invoice and invite emails are not identity proof.
    const [welcome]=await query("SELECT email FROM lup_mail_outbox WHERE id=SHA2(CONCAT('welcome:',?),256) AND type='welcome'",[uid]);
    return storedKey(welcome?.email);
  }
  async function mutualPartner(uid,key,active){
    if(!validKey(key))return null;
    const now=clock();
    const rows=await query(`SELECT b.user_id FROM lup_offer_buyers_v2 a
      JOIN lup_offer_preferences_v2 pa ON pa.user_id=a.user_id
      JOIN lup_offer_buyers_v2 b ON b.email_key=pa.email_key AND b.user_id<>a.user_id
      JOIN lup_offer_preferences_v2 pb ON pb.user_id=b.user_id AND pb.email_key=a.email_key
      WHERE a.user_id=? AND b.email_key=? AND a.email_key<>b.email_key
      ${active?'AND a.active_until>? AND b.active_until>?':''} ORDER BY b.user_id LIMIT 1`,
      active?[uid,key,now,now]:[uid,key]);
    if(rows.length)return rows[0].user_id;
    const [migration]=await query('SELECT complete FROM lup_offer_backfill_v2 WHERE id=1');
    if(migration?.complete)return null;
    // During rollout merge verified legacy members with any newer per-user
    // index entries. Revoking a preference or a payment must beat old history.
    const history=await query(`SELECT m.user_id,m.data_json,w.email AS welcome_email,
      b.user_id AS indexed_buyer,b.email_key,b.active_until,p.user_id AS indexed_pref,p.email_key AS preferred_key
      FROM lup_member_data m LEFT JOIN lup_mail_outbox w ON w.id=SHA2(CONCAT('welcome:',m.user_id),256) AND w.type='welcome'
      LEFT JOIN lup_offer_buyers_v2 b ON b.user_id=m.user_id LEFT JOIN lup_offer_preferences_v2 p ON p.user_id=m.user_id
      WHERE m.user_id=? OR b.email_key=? OR (b.user_id IS NULL AND SHA2(LOWER(TRIM(w.email)),256)=?)`,[uid,key,key]);
    const people=history.map(row=>{
      const data=JSON.parse(row.data_json);
      return {uid:row.user_id,key:row.indexed_buyer?row.email_key:storedKey(row.welcome_email),
        preferred:row.indexed_pref?row.preferred_key:storedKey(data.preferredPartnerEmail),
        end:row.indexed_buyer?row.active_until:paidUntil(data,now)};
    });
    const own=people.find(p=>p.uid===uid);
    if(!own?.key || own.key===key || own.preferred!==key || (active && !(own.end>now)))return null;
    return people.find(p=>p.uid!==uid && (!active || p.end>now) && p.key===key && p.preferred===own.key)?.uid||null;
  }
  return {
    recordOfferPreference,recordOfferPurchase,getOfferIdentityKey,
    getMutualOfferPartner(uid,key){return mutualPartner(uid,key,false);},
    async hasOfferPurchase(uid,key){return Boolean(await mutualPartner(uid,key,true));},
    async queueOfferReview(uid){
      const [pref]=await query('SELECT email_key FROM lup_offer_preferences_v2 WHERE user_id=?',[uid]);
      await schedule(uid);
      await schedulePartners([pref?.email_key]);
    },
    async expireOfferPurchases(limit=32){
      const rows=await query(`SELECT user_id FROM lup_offer_buyers_v2 WHERE active_until<=?
        ORDER BY active_until,user_id LIMIT ${bounded(limit,100)} FOR UPDATE SKIP LOCKED`,[clock()]);
      for(const row of rows)await recordOfferPurchase(row.user_id,null,null);
      return rows.length;
    },
    async scheduleChangedPartners(limit=64){
      const changes=await query(`SELECT email_key FROM lup_offer_changes_v2 ORDER BY queued_at,email_key
        LIMIT ${bounded(limit,100)} FOR UPDATE SKIP LOCKED`);
      for(const change of changes){
        const owners=await query('SELECT user_id FROM lup_offer_buyers_v2 WHERE email_key=? ORDER BY user_id',[change.email_key]);
        for(const owner of owners)await schedule(owner.user_id);
        await query('DELETE FROM lup_offer_changes_v2 WHERE email_key=?',[change.email_key]);
      }
      return changes.length;
    },
    async listOfferJobs(limit=4){
      const now=clock();
      const rows=await query(`SELECT user_id,version FROM lup_offer_jobs_v2 WHERE next_at<=?
        ORDER BY next_at,user_id LIMIT ${bounded(limit,20)} FOR UPDATE SKIP LOCKED`,[now]);
      for(const row of rows)await query('UPDATE lup_offer_jobs_v2 SET next_at=?,attempts=attempts+1 WHERE user_id=? AND version=?',[now+10*60000,row.user_id,row.version]);
      return rows.map(row=>({uid:row.user_id,version:row.version}));
    },
    async lockOfferJob(uid,version){
      const rows=await query('SELECT user_id FROM lup_offer_jobs_v2 WHERE user_id=? AND version=? AND next_at IS NOT NULL FOR UPDATE',[uid,version]);
      return rows.length>0;
    },
    async finishOfferJob(uid,version){
      // Keep the version even when idle: a delayed worker cannot acknowledge a newer job.
      await query('UPDATE lup_offer_jobs_v2 SET next_at=NULL,attempts=0 WHERE user_id=? AND version=?',[uid,version]);
    },
    async retryOfferJob(uid,version){
      await query(`UPDATE lup_offer_jobs_v2 SET next_at=?+LEAST(3600000,30000*POW(2,LEAST(attempts,7)))
        WHERE user_id=? AND version=? AND next_at IS NOT NULL`,[clock(),uid,version]);
    },
    async backfillPartnerOffers(limit=24){
      const [state]=await query('SELECT last_uid,complete FROM lup_offer_backfill_v2 WHERE id=1 FOR UPDATE SKIP LOCKED');
      if(!state)return false;
      if(state.complete)return true;
      const size=bounded(limit,100);
      const members=await query(`SELECT user_id,data_json FROM lup_member_data WHERE user_id>?
        ORDER BY user_id LIMIT ${size} FOR UPDATE`,[state.last_uid]);
      for(const row of members){
        const data=JSON.parse(row.data_json),uid=row.user_id;
        const preference=storedKey(data.preferredPartnerEmail);
        if(preference)await recordOfferPreference(uid,preference);
        const end=paidUntil(data,clock());
        if(end && !(await query('SELECT user_id FROM lup_offer_buyers_v2 WHERE user_id=?',[uid])).length){
          const identity=await getOfferIdentityKey(uid);
          if(identity)await recordOfferPurchase(uid,identity,end);
        }
      }
      const complete=members.length<size;
      await query('UPDATE lup_offer_backfill_v2 SET last_uid=?,complete=? WHERE id=1',[members.at(-1)?.user_id??state.last_uid,complete?1:0]);
      return complete;
    }
  };
}
