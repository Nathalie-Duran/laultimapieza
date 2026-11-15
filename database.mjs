import { ApiError } from './auth-provider.mjs';

const schema = [
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
  return row ? { userId: row.user_id, name: row.name, color: row.color, avatar:'detective',
    activeSessionId:row.active_session_id, createdAt:row.created_at, updatedAt:row.updated_at } : null;
}
function state(row) {
  return row ? { session: JSON.parse(row.state_json), inviteHash:row.invite_hash, inviteUntil:Number(row.invite_until || 0) } : null;
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
      if (!initialized) initialized = (async()=>{for(const sql of schema) await connection.query(sql);})().catch(error=>{initialized=null;throw error;});
      await initialized;
      await connection.beginTransaction();
      const store = {
        async getMemberData(uid) {
          await query('INSERT IGNORE INTO lup_member_data (user_id,data_json) VALUES (?,?)',[uid,'{}']);
          return JSON.parse((await query('SELECT data_json FROM lup_member_data WHERE user_id=? FOR UPDATE',[uid]))[0].data_json);
        },
        async saveMemberData(uid,data) { await query('UPDATE lup_member_data SET customer_id=?,data_json=? WHERE user_id=?',[data.customer||null,JSON.stringify(data),uid]); },
        async findCustomer(id) { return (await query('SELECT user_id FROM lup_member_data WHERE customer_id=?',[id]))[0]?.user_id||null; },
        async metric(event) { await query('INSERT INTO lup_metrics(day_key,event_key,total) VALUES (?,?,1) ON DUPLICATE KEY UPDATE total=total+1',[new Date().toISOString().slice(0,10),event]); },
        async getSeasonSolved(uid,season) { return (await query('SELECT solved_at FROM lup_season_rewards WHERE user_id=? AND season=?',[uid,season]))[0]?.solved_at||null; },
        async saveSeasonSolved(uid,season) { await query('INSERT IGNORE INTO lup_season_rewards (user_id,season,solved_at) VALUES (?,?,?)',[uid,season,new Date().toISOString()]); },
        async ensureProfile(user) {
          const now=new Date().toISOString();
          await query('INSERT IGNORE INTO lup_profiles (user_id,name,color,created_at,updated_at) VALUES (?,?,?,?,?)',
            [user.userId,user.name?.trim().slice(0,32)||'Investigador','#b1846b',now,now]);
          return this.getProfile(user.userId);
        },
        async getProfile(uid) { return profile((await query('SELECT * FROM lup_profiles WHERE user_id=?',[uid]))[0]); },
        async updateProfile(uid,name,color) {
          await query('UPDATE lup_profiles SET name=?,color=?,updated_at=? WHERE user_id=?',[name,color,new Date().toISOString(),uid]);
          return this.getProfile(uid);
        },
        async setActive(uid,id) { await query('UPDATE lup_profiles SET active_session_id=? WHERE user_id=?',[id,uid]); },
        async listSessions(uid) {
          return (await query('SELECT s.state_json FROM lup_sessions s JOIN lup_members m ON m.session_id=s.id WHERE m.user_id=? ORDER BY s.updated_at DESC LIMIT 200',[uid])).map(row=>JSON.parse(row.state_json));
        },
        async getSession(id) { return state((await query('SELECT * FROM lup_sessions WHERE id=? FOR UPDATE',[id]))[0]); },
        async findInvite(hash) { return state((await query('SELECT * FROM lup_sessions WHERE invite_hash=? FOR UPDATE',[hash]))[0]); },
        async insertSession(session) {
          await query('INSERT INTO lup_sessions (id,owner_id,state_json,updated_at) VALUES (?,?,?,?)',[session.id,session.ownerId,JSON.stringify(session),new Date().toISOString()]);
          for(const member of session.members) await this.addMember(session.id,member.userId);
        },
        async addMember(id,uid) { await query('INSERT IGNORE INTO lup_members (session_id,user_id) VALUES (?,?)',[id,uid]); },
        async saveSession(session) { await query('UPDATE lup_sessions SET state_json=?,updated_at=? WHERE id=?',[JSON.stringify(session),new Date().toISOString(),session.id]); },
        async setInvite(id,hash,until) { await query('UPDATE lup_sessions SET invite_hash=?,invite_until=? WHERE id=?',[hash,until,id]); }
      };
      const result=await callback(store);
      await connection.commit();
      return result;
    } catch(error) { await connection.rollback().catch(()=>{}); throw error; }
    finally { await connection.end(); }
  };
}
