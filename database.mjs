import { ApiError } from './auth-provider.mjs';
import { readAnalytics } from './analytics.mjs';
import {mailKey} from './mail-service.mjs';

const schema = [
  `CREATE TABLE IF NOT EXISTS lup_case_partners (
    id CHAR(36) CHARACTER SET ascii PRIMARY KEY, case_id TINYINT UNSIGNED NOT NULL,
    owner_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, owner_name VARCHAR(64) NOT NULL,
    email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL, guest_id VARCHAR(128) COLLATE utf8mb4_bin NULL,
    guest_name VARCHAR(64) NULL, status VARCHAR(10) NOT NULL, expires_at BIGINT NOT NULL,
    progress_json TEXT NOT NULL, INDEX lup_partner_sender(owner_id), INDEX lup_partner_guest(guest_id),
    INDEX lup_partner_email(email,status), INDEX lup_partner_expiry(status,expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_case_partner_slots (
    user_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, case_id TINYINT UNSIGNED NOT NULL,
    invitation_id CHAR(36) CHARACTER SET ascii NOT NULL,
    PRIMARY KEY(user_id,case_id), FOREIGN KEY(invitation_id) REFERENCES lup_case_partners(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_valdemar_release_keys (
    release_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    activation_key BINARY(32) NOT NULL, installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_user_avatars (user_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, avatar VARCHAR(12) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_editorial_users (user_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_reporting_since (id INT PRIMARY KEY, started_at VARCHAR(30) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS lup_opening_notices (email VARCHAR(254) PRIMARY KEY, receipt_hash CHAR(64) CHARACTER SET ascii NOT NULL UNIQUE, requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_mail_outbox (id CHAR(64) PRIMARY KEY, email VARCHAR(320) NOT NULL, type VARCHAR(30) NOT NULL, data_json LONGTEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0, next_at BIGINT NOT NULL, first_attempt BIGINT NULL, provider_id VARCHAR(100) NULL, last_error VARCHAR(60) NULL, INDEX lup_mail_pending(status,next_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_member_data (user_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, customer_id VARCHAR(80) NULL, data_json LONGTEXT NOT NULL, INDEX lup_customer(customer_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_metrics (day_key VARCHAR(10) NOT NULL, event_key VARCHAR(40) NOT NULL, total INT NOT NULL DEFAULT 0, PRIMARY KEY(day_key,event_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_season_rewards (
    user_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, season INT NOT NULL,
    solved_at VARCHAR(30) NOT NULL, PRIMARY KEY(user_id,season)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_profiles (
    user_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, name VARCHAR(32) NOT NULL,
    color VARCHAR(7) NOT NULL, active_session_id VARCHAR(36) NULL,
    created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_sessions (
    id VARCHAR(36) COLLATE utf8mb4_bin PRIMARY KEY, owner_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    state_json LONGTEXT NOT NULL, invite_hash VARCHAR(64) NULL, invite_until BIGINT NULL,
    updated_at VARCHAR(30) NOT NULL, INDEX lup_invite (invite_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_members (
    session_id VARCHAR(36) COLLATE utf8mb4_bin NOT NULL, user_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    PRIMARY KEY(session_id,user_id), INDEX lup_user (user_id),
    FOREIGN KEY(session_id) REFERENCES lup_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
function profile(row) {
  return row ? { userId: row.user_id, name: row.name, color: row.color, avatar:row.avatar||'detective',
    activeSessionId:row.active_session_id, createdAt:row.created_at, updatedAt:row.updated_at } : null;
}
function state(row) {
  return row ? { session: JSON.parse(row.state_json), inviteHash:row.invite_hash, inviteUntil:Number(row.invite_until || 0) } : null;
}
function partner(row){
  return row?{id:row.id,caseId:row.case_id,ownerId:row.owner_id,ownerName:row.owner_name,
    email:row.email,guestId:row.guest_id,guestName:row.guest_name,status:row.status,
    expiresAt:Number(row.expires_at),progress:JSON.parse(row.progress_json)}:null;
}
export function databaseConfigured(env=process.env) { return !!(env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASSWORD); }
export function createDatabase(env=process.env) {
  let initialized;
  return async function withStore(callback) {
    if (!databaseConfigured(env)) throw new ApiError(503,'No se puede guardar en este momento. Inténtalo de nuevo.','STORAGE_UNAVAILABLE');
    const {createConnection} = await import('mysql2/promise');
    const connection = await createConnection({host:env.DB_HOST, port:Number(env.DB_PORT || 3306), database:env.DB_NAME,
      user:env.DB_USER, password:env.DB_PASSWORD, charset:'utf8mb4', connectTimeout:10000,
      ...(env.DB_SSL_CA ? {ssl:{ca:env.DB_SSL_CA,rejectUnauthorized:true}} : {})});
    const query = async (sql, values=[]) => (await connection.execute(sql,values))[0];
    try {
      if (!initialized) initialized = (async()=>{
        for(const sql of schema) await connection.query(sql);
        const began=new Date().toISOString();
        await query('INSERT IGNORE INTO lup_reporting_since(id,started_at) VALUES(1,?),(2,?)',[began,began]);
      })().catch(error=>{initialized=null;throw error;});
      await initialized;
      await connection.beginTransaction();
      const store = {
        async getPartner(id){
          return partner((await query('SELECT * FROM lup_case_partners WHERE id=? FOR UPDATE',[id]))[0]);
        },
        async getCasePartner(uid,caseId,now){
          const rows=await query(`SELECT p.* FROM lup_case_partner_slots s JOIN lup_case_partners p ON p.id=s.invitation_id
            WHERE s.user_id=? AND s.case_id=? FOR UPDATE`,[uid,caseId]);
          const row=partner(rows[0]);
          if(row?.status==='pending' && row.expiresAt<=now){await this.closePartner(row);return null;}
          return row;
        },
        async listPartners(uid,email,now){
          const expired=await query("SELECT id FROM lup_case_partners WHERE status='pending' AND expires_at<=? LIMIT 32 FOR UPDATE SKIP LOCKED",[now]);
          for(const row of expired)await this.closePartner(row);
          const rows=await query(`SELECT * FROM lup_case_partners WHERE
            (status='accepted' AND (owner_id=? OR guest_id=?)) OR
            (status='pending' AND expires_at>? AND (owner_id=? OR email=?))
            ORDER BY case_id,expires_at DESC`,[uid,uid,now,uid,email]);
          return rows.map(partner);
        },
        async createPartner(row){
          await query(`INSERT INTO lup_case_partners(id,case_id,owner_id,owner_name,email,status,expires_at,progress_json)
            VALUES(?,?,?,?,?,?,?,?)`,[row.id,row.caseId,row.ownerId,row.ownerName,row.email,row.status,row.expiresAt,JSON.stringify(row.progress)]);
        },
        async reservePartner(uid,caseId,id){
          const result=await query('INSERT IGNORE INTO lup_case_partner_slots(user_id,case_id,invitation_id) VALUES(?,?,?)',[uid,caseId,id]);
          return result.affectedRows===1;
        },
        async savePartner(row){
          await query('UPDATE lup_case_partners SET guest_id=?,guest_name=?,status=?,progress_json=? WHERE id=?',
            [row.guestId,row.guestName,row.status,JSON.stringify(row.progress),row.id]);
        },
        async closePartner(row){
          await query('DELETE FROM lup_case_partners WHERE id=?',[row.id]);
          await query("DELETE FROM lup_mail_outbox WHERE id=? AND status='pending'",[mailKey('case_invitation',row.id)]);
        },
        async getValdemarKey(releaseId) {
          const rows = await query('SELECT activation_key FROM lup_valdemar_release_keys WHERE release_id=?', [releaseId]);
          return rows[0]?.activation_key || null;
        },
        async installValdemarKey(releaseId, key) {
          await query('INSERT INTO lup_valdemar_release_keys(release_id,activation_key) VALUES (?,?) ON DUPLICATE KEY UPDATE release_id=VALUES(release_id)', [releaseId,key]);
          const rows = await query('SELECT activation_key FROM lup_valdemar_release_keys WHERE release_id=? FOR UPDATE', [releaseId]);
          return rows[0]?.activation_key || null;
        },
        async markEditorial(uid){await query('INSERT IGNORE INTO lup_editorial_users(user_id) VALUES(?)',[uid]);},
        analytics(options){return readAnalytics(query,options);},
        async addOpeningNotice(email,receiptHash){
          const result=await query('INSERT IGNORE INTO lup_opening_notices(email,receipt_hash) VALUES (?,?)',[email,receiptHash]);
          if(result.affectedRows===1)await this.metric('notice_add');
          return result.affectedRows===1;
        },
        async removeOpeningNotice(receiptHash){
          const result=await query('DELETE FROM lup_opening_notices WHERE receipt_hash=?',[receiptHash]);
          if(result.affectedRows>0)await this.metric('notice_remove');
          return result.affectedRows>0;
        },
        async removeVerifiedOpeningNotice(email){
          const result=await query('DELETE FROM lup_opening_notices WHERE email=?',[email.trim().toLowerCase()]);
          if(result.affectedRows>0)await this.metric('notice_remove');
        },
        async enqueueMail(id,email,type,data){
          if(typeof email!=='string'||!email.includes('@'))return;
          await query('INSERT IGNORE INTO lup_mail_outbox(id,email,type,data_json,next_at) VALUES (?,?,?,?,?)',[id,email,type,JSON.stringify(data),Date.now()]);
        },
        async claimMail(){
          const now=Date.now();
          // Stop ambiguous retries before the provider's 24-hour idempotency window expires.
          await query("UPDATE lup_mail_outbox SET status='review' WHERE status IN ('pending','processing') AND first_attempt IS NOT NULL AND first_attempt<?",[now-20*3600000]);
          const row=(await query("SELECT * FROM lup_mail_outbox WHERE status IN ('pending','processing') AND next_at<=? ORDER BY next_at LIMIT 1 FOR UPDATE SKIP LOCKED",[now]))[0];
          if(!row)return null;
          await query("UPDATE lup_mail_outbox SET status='processing',attempts=attempts+1,first_attempt=COALESCE(first_attempt,?),next_at=? WHERE id=?",[now,now+120000,row.id]);
          return {id:row.id,email:row.email,type:row.type,data:JSON.parse(row.data_json)};
        },
        async finishMail(id,providerId){await query("UPDATE lup_mail_outbox SET status='sent',provider_id=?,last_error=NULL WHERE id=?",[providerId,id]);},
        async retryMail(id,error){await query("UPDATE lup_mail_outbox SET status=IF(attempts>=8,'review','pending'),next_at=?,last_error=? WHERE id=?",[Date.now()+300000,error,id]);},
        async getMemberData(uid,{readOnly=false}={}) {
          if(!readOnly)await query('INSERT IGNORE INTO lup_member_data (user_id,data_json) VALUES (?,?)',[uid,'{}']);
          const rows=await query('SELECT data_json FROM lup_member_data WHERE user_id=? FOR UPDATE',[uid]);
          return rows.length ? JSON.parse(rows[0].data_json) : {};
        },
        async saveMemberData(uid,data) { await query('UPDATE lup_member_data SET customer_id=?,data_json=? WHERE user_id=?',[data.customer||null,JSON.stringify(data),uid]); },
        async findCustomer(id) { return (await query('SELECT user_id FROM lup_member_data WHERE customer_id=?',[id]))[0]?.user_id||null; },
        async metric(event) { await query('INSERT INTO lup_metrics(day_key,event_key,total) VALUES (?,?,1) ON DUPLICATE KEY UPDATE total=total+1',[new Date().toISOString().slice(0,10),event]); },
        async getSeasonSolved(uid,season) { return (await query('SELECT solved_at FROM lup_season_rewards WHERE user_id=? AND season=?',[uid,season]))[0]?.solved_at||null; },
        async saveSeasonSolved(uid,season) { await query('INSERT IGNORE INTO lup_season_rewards (user_id,season,solved_at) VALUES (?,?,?)',[uid,season,new Date().toISOString()]); },
        async ensureProfile(user) {
          const now=new Date().toISOString();
          const created=await query('INSERT IGNORE INTO lup_profiles (user_id,name,color,created_at,updated_at) VALUES (?,?,?,?,?)',
            [user.userId,user.name?.trim().slice(0,32)||'Investigador','#b1846b',now,now]);
          return {...await this.getProfile(user.userId),newProfile:created.affectedRows===1};
        },
        async getProfile(uid) { return profile((await query('SELECT p.*,a.avatar FROM lup_profiles p LEFT JOIN lup_user_avatars a ON a.user_id=p.user_id WHERE p.user_id=?',[uid]))[0]); },
        async updateProfile(uid,name,color,avatarChoice) {
          if(avatarChoice==='detective')await query('DELETE FROM lup_user_avatars WHERE user_id=?',[uid]);
          else if(avatarChoice)await query('INSERT INTO lup_user_avatars(user_id,avatar) VALUES(?,?) ON DUPLICATE KEY UPDATE avatar=?',[uid,avatarChoice,avatarChoice]);
          await query('UPDATE lup_profiles SET name=?,color=?,updated_at=? WHERE user_id=?',[name,color,new Date().toISOString(),uid]);
          return this.getProfile(uid);
        },
        async setActive(uid,id) { await query('UPDATE lup_profiles SET active_session_id=? WHERE user_id=?',[id,uid]); },
        async withAvatars(sessions){
          const ids=[...new Set(sessions.flatMap(s=>s.members.map(m=>m.userId)))];
          if(!ids.length)return sessions;
          const rows=await query('SELECT user_id,avatar FROM lup_user_avatars WHERE user_id IN ('+ids.map(()=>'?').join(',')+')',ids);
          const choices=new Map(rows.map(row=>[row.user_id,row.avatar]));
          for(const s of sessions)for(const member of s.members)member.avatar=choices.get(member.userId)||'detective';
          return sessions;
        },
        async listSessions(uid) {
          const sessions=(await query('SELECT s.state_json FROM lup_sessions s JOIN lup_members m ON m.session_id=s.id WHERE m.user_id=? ORDER BY s.updated_at DESC LIMIT 200',[uid])).map(row=>JSON.parse(row.state_json));
          return this.withAvatars(sessions);
        },
        async getSession(id) { const record=state((await query('SELECT * FROM lup_sessions WHERE id=? FOR UPDATE',[id]))[0]);if(record)await this.withAvatars([record.session]);return record; },
        async lockSessionIdsForReset(uid) {
          const rows=await query('SELECT session_id FROM lup_members WHERE user_id=? ORDER BY session_id FOR UPDATE',[uid]);
          return rows.map(row=>row.session_id);
        },
        async deleteSoloSession(id,uid) {
          const removed=await query(`DELETE FROM lup_sessions WHERE id=?
            AND EXISTS (SELECT 1 FROM lup_members WHERE session_id=? AND user_id=?)
            AND NOT EXISTS (SELECT 1 FROM lup_members WHERE session_id=? AND user_id<>?)`,[id,id,uid,id,uid]);
          if(removed.affectedRows!==1)throw new ApiError(409,'El equipo ha cambiado. Revisa tus partidas antes de confirmar.');
        },
        async clearSeasonReward(uid) { await query('DELETE FROM lup_season_rewards WHERE user_id=? AND season=1',[uid]); },
        async findInvite(hash) { return state((await query('SELECT * FROM lup_sessions WHERE invite_hash=? FOR UPDATE',[hash]))[0]); },
        async insertSession(session) {
          session.reportCreatedAt=new Date().toISOString();
          await query('INSERT INTO lup_sessions (id,owner_id,state_json,updated_at) VALUES (?,?,?,?)',[session.id,session.ownerId,JSON.stringify(session),new Date().toISOString()]);
          for(const member of session.members) await this.addMember(session.id,member.userId);
        },
        async addMember(id,uid) { await query('INSERT IGNORE INTO lup_members (session_id,user_id) VALUES (?,?)',[id,uid]); },
        async removeMember(id,uid) {
          await query('DELETE FROM lup_members WHERE session_id=? AND user_id=?',[id,uid]);
          await query('UPDATE lup_profiles SET active_session_id=NULL WHERE user_id=? AND active_session_id=?',[uid,id]);
        },
        async saveSession(session) { await query('UPDATE lup_sessions SET owner_id=?,state_json=?,updated_at=? WHERE id=?',[session.ownerId,JSON.stringify(session),new Date().toISOString(),session.id]); },
        async setInvite(id,hash,until) { await query('UPDATE lup_sessions SET invite_hash=?,invite_until=? WHERE id=?',[hash,until,id]); }
      };
      const result=await callback(store);
      await connection.commit();
      return result;
    } catch(error) { await connection.rollback().catch(()=>{}); throw error; }
    finally { await connection.end(); }
  };
}
