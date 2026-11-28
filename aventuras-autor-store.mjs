import {ApiError} from './auth-provider.mjs';

export const authorSchema=[
  `CREATE TABLE IF NOT EXISTS lup_author_titles (
    id VARCHAR(64) CHARACTER SET ascii PRIMARY KEY, case_id TINYINT UNSIGNED NOT NULL,
    edit_version INT UNSIGNED NOT NULL, published INT UNSIGNED NOT NULL DEFAULT 0,
    draft_json MEDIUMTEXT NOT NULL, updated_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_author_releases (
    id VARCHAR(64) CHARACTER SET ascii NOT NULL, revision INT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL, definition_json MEDIUMTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(id,revision)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_trial_activity (
    game VARCHAR(96) CHARACTER SET ascii NOT NULL, edition INT UNSIGNED NOT NULL,
    trial VARCHAR(160) NOT NULL, participant CHAR(64) CHARACTER SET ascii NOT NULL,
    first_at BIGINT NOT NULL, last_at BIGINT NOT NULL, solved_at BIGINT NULL,
    PRIMARY KEY(game,edition,trial,participant), INDEX lup_trial_period(first_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS lup_author_pair_runs (
    pair_id CHAR(36) CHARACTER SET ascii NOT NULL, game VARCHAR(64) CHARACTER SET ascii NOT NULL,
    record_json MEDIUMTEXT NOT NULL, PRIMARY KEY(pair_id,game),
    FOREIGN KEY(pair_id) REFERENCES lup_case_partners(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
const conflict=()=>new ApiError(409,'El borrador ha cambiado. Carga la última revisión antes de guardar.');
const parse=s=>typeof s==='string'?JSON.parse(s):s;
export function authorStore(query){
  return {
    async authorPairRun(pair,id){
      const [row]=await query('SELECT record_json FROM lup_author_pair_runs WHERE pair_id=? AND game=? FOR UPDATE',[pair,id]);
      return row?parse(row.record_json):null;
    },
    async saveAuthorPairRun(pair,id,record){
      await query('INSERT INTO lup_author_pair_runs(pair_id,game,record_json) VALUES(?,?,?) ON DUPLICATE KEY UPDATE record_json=VALUES(record_json)',[pair,id,JSON.stringify(record)]);
    },
    async listAuthorTitles(admin=false){
      if(admin)return (await query("SELECT id,case_id AS caseId,edit_version AS version,published AS revision,JSON_UNQUOTE(JSON_EXTRACT(draft_json,'$.titulo')) AS titulo FROM lup_author_titles ORDER BY case_id,id"));
      return query('SELECT a.id,a.case_id AS caseId,a.published AS revision,r.title AS titulo FROM lup_author_titles a JOIN lup_author_releases r ON r.id=a.id AND r.revision=a.published ORDER BY a.case_id,a.id');
    },
    async authorDraft(id){
      const [row]=await query('SELECT case_id AS caseId,edit_version AS version,published AS revision,draft_json AS definition FROM lup_author_titles WHERE id=?',[id]);
      return row?{...row,id,definition:parse(row.definition)}:null;
    },
    async authorRelease(id,revision){
      const [row]=await query('SELECT a.case_id AS caseId,r.revision,r.definition_json AS definition FROM lup_author_titles a JOIN lup_author_releases r ON r.id=a.id AND r.revision=COALESCE(?,a.published) WHERE a.id=?',[revision||null,id]);
      return row?{...row,id,definition:parse(row.definition)}:null;
    },
    async saveAuthorDraft({id,caseId,version,definition,publish}){
      const encoded=JSON.stringify(definition),next=version+1;
      if(version===0){
        try{await query('INSERT INTO lup_author_titles(id,case_id,edit_version,draft_json,updated_at) VALUES(?,?,1,?,?)',[id,caseId,encoded,Date.now()]);}
        catch(e){if(e.code==='ER_DUP_ENTRY')throw conflict();throw e;}
      }else{
        const saved=await query('UPDATE lup_author_titles SET case_id=?,edit_version=?,draft_json=?,updated_at=? WHERE id=? AND edit_version=? AND (published=0 OR case_id=?)',[caseId,next,encoded,Date.now(),id,version,caseId]);
        if(!saved.affectedRows)throw conflict();
      }
      if(publish){
        await query('INSERT INTO lup_author_releases(id,revision,title,definition_json) VALUES(?,?,?,?)',[id,next,definition.titulo,encoded]);
        await query('UPDATE lup_author_titles SET published=? WHERE id=?',[next,id]);
      }
      return this.authorDraft(id);
    },
    async noteTrial({game,edition,trial,participant,at,solved}){
      await query(`INSERT INTO lup_trial_activity(game,edition,trial,participant,first_at,last_at,solved_at) VALUES(?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE last_at=IF(solved_at IS NULL,VALUES(last_at),last_at),solved_at=COALESCE(solved_at,VALUES(solved_at))`,[game,edition,trial,participant,at,at,solved?at:null]);
    },
    async trialReport(first,now){
      return query(`SELECT game,edition,trial,COUNT(*) AS started,
        COUNT(solved_at) AS solved,SUM(solved_at IS NULL AND last_at<=?) AS inactive,
        SUM(CASE WHEN solved_at IS NULL THEN 0 ELSE solved_at-first_at END) AS elapsedMs
        FROM lup_trial_activity WHERE first_at>=? AND first_at<=?
        GROUP BY game,edition,trial ORDER BY inactive DESC,started DESC,game,edition,trial`,[now-14*86400000,first,now]);
    },
    async adminOperations(now){
      const mail=await query('SELECT status,COUNT(*) AS amount FROM lup_mail_outbox GROUP BY status');
      const [pairs]=await query(`SELECT COUNT(*) AS linked,
        COALESCE(SUM(a.active_until>? AND b.active_until>?),0) AS bothPaid
        FROM lup_offer_preferences_v2 pa JOIN lup_offer_buyers_v2 a ON a.user_id=pa.user_id
        JOIN lup_offer_buyers_v2 b ON b.email_key=pa.email_key AND a.user_id<b.user_id
        JOIN lup_offer_preferences_v2 pb ON pb.user_id=b.user_id AND pb.email_key=a.email_key
        WHERE NOT EXISTS (SELECT 1 FROM lup_editorial_users e WHERE e.user_id IN(a.user_id,b.user_id))`,[now,now]);
      const releases=await query('SELECT id,title,revision,created_at AS at FROM lup_author_releases ORDER BY created_at DESC,id LIMIT 12');
      return {mail:Object.fromEntries(mail.map(r=>[r.status,Number(r.amount)])),pairs:{linked:Number(pairs.linked),bothPaid:Number(pairs.bothPaid)},releases};
    }
  };
}
