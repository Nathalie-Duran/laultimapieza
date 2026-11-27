import {ApiError} from './auth-provider.mjs';
import {createHash} from 'node:crypto';
import {isChallengeAvailable} from './challenge-schedule.mjs';

const DAY = 86400000;
export const noticeTypes = Object.freeze({case_finished:'milestones', board_finished:'milestones',
  pair_confirmed:'pairs', new_challenge:'challenges', inactivity:'reminders'});
const fields = ['milestones', 'pairs', 'challenges', 'reminders'];
export const noticesSchema = `CREATE TABLE IF NOT EXISTS lup_play_notices (
  user_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, email VARCHAR(254) NOT NULL,
  milestones BOOLEAN NOT NULL, pairs BOOLEAN NOT NULL, challenges BOOLEAN NOT NULL, reminders BOOLEAN NOT NULL,
  consent_at BIGINT NOT NULL, last_seen BIGINT NOT NULL, last_reminded BIGINT NOT NULL DEFAULT 0,
  INDEX lup_inactivity(reminders,last_seen), INDEX lup_new_challenges(challenges)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
export const publicationNoticeSchema = `CREATE TABLE IF NOT EXISTS lup_notice_publications (
  id CHAR(36) CHARACTER SET ascii PRIMARY KEY, pending BOOLEAN NOT NULL DEFAULT 1,
  INDEX lup_notice_due(pending)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
export function noticePreferences(row) {
  return Object.fromEntries(fields.map(key => [key, Boolean(row?.[key])]));
}
export function validateNoticePrefs(input) {
  if (!input || fields.some(key => typeof input[key] !== 'boolean')) throw new ApiError(400,'Revisa tus preferencias de correo.');
  return noticePreferences(input);
}
export function noticeStore(query) {
  return {
    async getNoticePrefs(uid, lock=false) {
      return (await query('SELECT * FROM lup_play_notices WHERE user_id=?'+(lock?' FOR UPDATE':''),[uid]))[0];
    },
    async putNoticePrefs(uid,email,prefs,now=Date.now()) {
      const old = await this.getNoticePrefs(uid,true);
      if (!fields.some(key => prefs[key])) {
        if (old) await query('DELETE FROM lup_play_notices WHERE user_id=?',[uid]);
      } else if (!old || old.email !== email || fields.some(key=>Boolean(old[key])!==prefs[key])) {
        await query(`INSERT INTO lup_play_notices(user_id,email,milestones,pairs,challenges,reminders,consent_at,last_seen)
          VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),milestones=VALUES(milestones),pairs=VALUES(pairs),
          challenges=VALUES(challenges),reminders=VALUES(reminders),consent_at=VALUES(consent_at),last_seen=VALUES(last_seen)`,
          [uid,email,...fields.map(key=>Number(prefs[key])),Math.max(now, Number(old?.consent_at || 0)+1),now]);
      }
      return prefs;
    },
    async visitForNotices(uid,email,now=Date.now()) {
      await query('DELETE FROM lup_play_notices WHERE user_id=? AND email<>?',[uid,email]);
      await this.touchNoticeActivity(uid,now);
    },
    async touchNoticeActivity(uid,now=Date.now()) {
      await query('UPDATE lup_play_notices SET last_seen=? WHERE user_id=? AND reminders=1',[now,uid]);
    },
    async queuePlayNotice(uid,type,event,payload={}) {
      const pref = await this.getNoticePrefs(uid,true);
      if (!pref?.[noticeTypes[type]]) return;
      const id = createHash('sha256').update(JSON.stringify([uid,type,event])).digest('hex');
      await this.enqueueMail(id,pref.email,type,{...payload,uid,consentAt:Number(pref.consent_at)});
    },
    async queuePublication(id) {
      await query('INSERT IGNORE INTO lup_notice_publications(id) VALUES(?)',[id]);
    },
    async queueActivePublications(now=Date.now()) {
      const rows=await query(`SELECT p.id,c.status,c.case_id,c.content_json FROM lup_notice_publications p
        JOIN lup_published_challenges c ON c.id=p.id WHERE p.pending=1 AND c.status='published' FOR UPDATE SKIP LOCKED`);
      for(const row of rows) {
        const {schedule}=JSON.parse(row.content_json);
        if(!isChallengeAvailable({status:row.status,schedule},now))continue;
        await query(`INSERT IGNORE INTO lup_mail_outbox(id,email,type,data_json,next_at)
        SELECT SHA2(CONCAT('new_challenge:',?,':',user_id),256),email,'new_challenge',
        JSON_OBJECT('uid',user_id,'consentAt',consent_at,'challengeId',?,'caseId',?),? FROM lup_play_notices WHERE challenges=1`,
          [row.id,row.id,row.case_id,now]);
        await query('UPDATE lup_notice_publications SET pending=0 WHERE id=?',[row.id]);
      }
    },
    async queueDueReminders(now=Date.now()) {
      const rows=await query(`SELECT * FROM lup_play_notices WHERE reminders=1 AND last_seen<=?
        AND last_seen>last_reminded ORDER BY last_seen LIMIT 100 FOR UPDATE SKIP LOCKED`,[now-14*DAY]);
      for(const row of rows) {
        await this.queuePlayNotice(row.user_id,'inactivity',row.last_seen,{lastSeen:Number(row.last_seen)});
        await query('UPDATE lup_play_notices SET last_reminded=last_seen WHERE user_id=?',[row.user_id]);
      }
    },
    async noticeStillWanted(job) {
      const key=noticeTypes[job.type];
      if (!key) return true;
      const prefs=await this.getNoticePrefs(job.data.uid);
      if(!prefs?.[key] || prefs.email!==job.email || Number(prefs.consent_at)!==job.data.consentAt) return false;
      if(job.type==='inactivity')return Number(prefs.last_seen)===job.data.lastSeen;
      if(job.type==='pair_confirmed') {
        const row=await this.getPartner(job.data.pairId);
        return row?.status==='accepted' && [row.ownerId,row.guestId].includes(job.data.uid);
      }
      if(job.type==='new_challenge') {
        const row=await this.lockChallenge(job.data.challengeId);
        return row?.caseId===job.data.caseId && isChallengeAvailable(row);
      }
      return true;
    }
  };
}

export async function notifyEnding(store,uid,data,scope,id) {
  if(scope!=='paid' || !store.queuePlayNotice) return;
  const base=Math.floor((id-1)/12)*12;
  const complete=Array.from({length:12},(_,i)=>data.valdemarCaseProgress.paid[base+i+1]?.choice).every(Boolean);
  // On the twelfth ending send a single message covering both milestones.
  await store.queuePlayNotice(uid,complete?'board_finished':'case_finished',complete?base/12+1:id,{caseId:id});
}
