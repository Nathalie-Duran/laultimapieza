import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {releaseCalendar,CASE_ORDER} from '../progression.mjs';
const start=Date.UTC(2026,0,1),second=Date.UTC(2026,1,1),end=Date.UTC(2026,2,1);
test('A renewal assigns exactly four new cases, carries earlier cases and cannot double grant on duplicate invoices',()=>{
 const one={id:'invoice1',start,end:second},two={id:'invoice2',start:second,end};
 const a=releaseCalendar([one,one],[],start);assert.equal(a.released,4);assert.deepEqual(a.currentCaseIds,CASE_ORDER.slice(0,4));
 const b=releaseCalendar([two,one,two],[],second);assert.equal(b.released,8);assert.deepEqual(b.currentCaseIds,CASE_ORDER.slice(4,8));assert.ok(b.unlockedCaseIds.includes(CASE_ORDER[0]));assert.ok(!b.unlockedCaseIds.includes(CASE_ORDER[8]));
 const refunded=releaseCalendar([{...one,revoked:true},two],[],second);assert.deepEqual(refunded.unlockedCaseIds,CASE_ORDER.slice(4,8));assert.equal(refunded.currentCycle,2);
 assert.deepEqual(releaseCalendar([one,two],[],end).currentCaseIds,[]);
});
test('Monthly progress counts solved assigned cases once; pending older cases are separate and other blocks stay locked',async()=>{
 const c=vm.createContext({});for(const f of ['stories.js','season.js','monthly-access.js'])vm.runInContext(await readFile(new URL('../public/'+f,import.meta.url),'utf8'),c);
 const calendar=releaseCalendar([{id:'one',start,end:second},{id:'two',start:second,end}],[],second);
 const m={stories:c.STORIES,userId:'a',sessions:[],membership:{ownAccess:true,canPlay:true,calendar},journey:{stops:[{caseId:CASE_ORDER[4],completed:true},{caseId:CASE_ORDER[4],completed:true},{caseId:CASE_ORDER[5],completed:false,status:'needs_solution'},{caseId:CASE_ORDER[0],completed:true},{caseId:CASE_ORDER[10],completed:true}]}};
 const html=c.MonthlyAccess.summary(m);assert.match(html,/Resueltos este mes: <strong>1 de 4/);assert.match(html,/3 casos pendientes de bloques anteriores/);assert.match(html,/Falta resolver el enigma/);
 assert.equal(c.MonthlyAccess.allowed(c.STORIES.find(s=>s.id===CASE_ORDER[7]),m),true);assert.equal(c.MonthlyAccess.allowed(c.STORIES.find(s=>s.id===CASE_ORDER[8]),m),false);
 m.membership.ownAccess=false;m.membership.canPlay=false;assert.equal(c.MonthlyAccess.allowed(c.STORIES.find(s=>s.id===CASE_ORDER[0]),m),false);
 m.membership.role='admin';assert.equal(c.MonthlyAccess.allowed(c.STORIES.find(s=>s.id===CASE_ORDER[11]),m),true);
});
